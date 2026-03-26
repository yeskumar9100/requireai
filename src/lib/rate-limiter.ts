/**
 * Token-bucket rate limiter for Gemini free tier.
 *
 * Gemini 2.5 Flash free tier limits:
 *   - 15 requests per minute (RPM)
 *   - 500 requests per day (RPD)
 *   - 250,000 tokens per minute (TPM)
 */

const MIN_GAP_MS = 5000; // ~12 req/min, safe margin under 15 RPM
const MAX_RPD = 500;
const PACIFIC_TZ = 'America/Los_Angeles';
const RETRY_AFTER_STORAGE_KEY = 'requireai:retryAfterMs';

interface RateLimiterState {
  requestTimestamps: number[];
  dailyCount: number;
  dayKey: string;
  retryAfterMs: number;
}

function getPacificParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find(p => p.type === type)?.value || '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

function getPacificDayKey(): string {
  const now = getPacificParts(new Date());
  return `${now.year}-${String(now.month).padStart(2, '0')}-${String(now.day).padStart(2, '0')}`;
}

function getMsUntilNextPacificMidnight(): number {
  const now = new Date();
  const pacificNow = getPacificParts(now);

  const pacificAsUtcMs = Date.UTC(
    pacificNow.year,
    pacificNow.month - 1,
    pacificNow.day,
    pacificNow.hour,
    pacificNow.minute,
    pacificNow.second
  );
  const offsetMs = pacificAsUtcMs - now.getTime();

  const nextPacificMidnightAsUtcMs = Date.UTC(
    pacificNow.year,
    pacificNow.month - 1,
    pacificNow.day + 1,
    0,
    0,
    0
  );

  const nextPacificMidnightEpochMs = nextPacificMidnightAsUtcMs - offsetMs;
  return Math.max(1000, nextPacificMidnightEpochMs - now.getTime());
}

class RateLimiter {
  private state: RateLimiterState;
  private queue: Promise<void>;

  constructor() {
    this.state = {
      requestTimestamps: [],
      dailyCount: 0,
      dayKey: getPacificDayKey(),
      retryAfterMs: this.loadRetryAfterMs(),
    };
    this.queue = Promise.resolve();
  }

  private loadRetryAfterMs(): number {
    try {
      const raw = localStorage.getItem(RETRY_AFTER_STORAGE_KEY);
      const parsed = Number(raw || '0');
      if (Number.isFinite(parsed) && parsed > Date.now()) {
        return parsed;
      }
    } catch (_) {
      // no-op in non-browser environments
    }
    return 0;
  }

  private persistRetryAfterMs(value: number): void {
    try {
      if (value > Date.now()) {
        localStorage.setItem(RETRY_AFTER_STORAGE_KEY, String(value));
      } else {
        localStorage.removeItem(RETRY_AFTER_STORAGE_KEY);
      }
    } catch (_) {
      // no-op in non-browser environments
    }
  }

  private checkDayReset(): void {
    const currentDay = getPacificDayKey();
    if (currentDay !== this.state.dayKey) {
      console.log(`[RateLimiter] Day changed (${this.state.dayKey} -> ${currentDay}). Resetting daily count.`);
      this.state.dailyCount = 0;
      this.state.dayKey = currentDay;
    }
  }

  private pruneWindow(): void {
    const cutoff = Date.now() - 60_000;
    this.state.requestTimestamps = this.state.requestTimestamps.filter(t => t > cutoff);
  }

  getWaitTime(): number {
    this.checkDayReset();

    if (this.state.dailyCount >= MAX_RPD) {
      return -1;
    }

    const now = Date.now();

    if (this.state.retryAfterMs > now) {
      return this.state.retryAfterMs - now;
    }
    if (this.state.retryAfterMs !== 0) {
      this.state.retryAfterMs = 0;
      this.persistRetryAfterMs(0);
    }

    const lastRequest = this.state.requestTimestamps[this.state.requestTimestamps.length - 1];
    if (lastRequest) {
      const timeSinceLast = now - lastRequest;
      if (timeSinceLast < MIN_GAP_MS) {
        return MIN_GAP_MS - timeSinceLast;
      }
    }

    this.pruneWindow();
    if (this.state.requestTimestamps.length >= 9) {
      const oldest = this.state.requestTimestamps[0];
      return (oldest + 60_000) - now + 500;
    }

    return 0;
  }

  async waitForSlot(): Promise<void> {
    const acquireSlot = async () => {
      const waitTime = this.getWaitTime();

      if (waitTime === -1) {
        const retryAfterMs = this.getDailyResetWaitMs();
        const error: any = new Error(
          `Daily API limit reached (${MAX_RPD} requests/day). ` +
          `The quota resets at midnight Pacific time. ` +
          `You have used ${this.state.dailyCount} of ${MAX_RPD} requests today.`
        );
        error.status = 429;
        error.isQuotaExceeded = true;
        error.retryAfter = Math.ceil(retryAfterMs / 1000);
        throw error;
      }

      if (waitTime > 0) {
        console.log(`[RateLimiter] Waiting ${(waitTime / 1000).toFixed(1)}s before next request...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      const now = Date.now();
      this.state.requestTimestamps.push(now);
      this.state.dailyCount++;

      console.log(`[RateLimiter] Request #${this.state.dailyCount}/${MAX_RPD} today | ${this.state.requestTimestamps.length} in last 60s`);
    };

    const next = this.queue.then(acquireSlot);
    this.queue = next.catch(() => {});
    await next;
  }

  handleRateLimit(retryAfterSeconds?: number): void {
    const waitSec = retryAfterSeconds || 30;
    this.state.retryAfterMs = Date.now() + (waitSec * 1000);
    this.persistRetryAfterMs(this.state.retryAfterMs);
    console.warn(`[RateLimiter] 429 received. Backing off for ${waitSec}s.`);
  }

  getStats(): { dailyUsed: number; dailyLimit: number; minuteUsed: number; minuteLimit: number } {
    this.checkDayReset();
    this.pruneWindow();
    return {
      dailyUsed: this.state.dailyCount,
      dailyLimit: MAX_RPD,
      minuteUsed: this.state.requestTimestamps.length,
      minuteLimit: 10,
    };
  }

  estimateTime(chunksRemaining: number): number {
    return chunksRemaining * (MIN_GAP_MS / 1000);
  }

  getDailyResetWaitMs(): number {
    return getMsUntilNextPacificMidnight();
  }
}

export const rateLimiter = new RateLimiter();

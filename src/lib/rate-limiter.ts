/**
 * Token-bucket rate limiter for Gemini free tier.
 * 
 * Gemini 2.5 Flash free tier limits:
 *   - 15 requests per minute (RPM)
 *   - 500 requests per day (RPD)
 *   - 250,000 tokens per minute (TPM)
 * 
 * This limiter enforces per-minute and per-day quotas with
 * automatic wait/backoff to stay within limits.
 */

const MIN_GAP_MS = 5000;       // ~12 req/min — safe margin under 15 RPM
const MAX_RPD = 500;            // daily cap


interface RateLimiterState {
  /** Timestamps of recent requests (sliding window) */
  requestTimestamps: number[];
  /** Daily request count */
  dailyCount: number;
  /** Day key (YYYY-MM-DD UTC) to track daily reset */
  dayKey: string;
  /** If we hit a 429, the earliest we should retry */
  retryAfterMs: number;
}

function getDayKey(): string {
  // Use simple UTC date — avoid locale-based date parsing which breaks on some systems
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

class RateLimiter {
  private state: RateLimiterState;

  constructor() {
    this.state = {
      requestTimestamps: [],
      dailyCount: 0,
      dayKey: getDayKey(),
      retryAfterMs: 0,
    };
  }

  /**
   * Resets daily counter if the day has changed.
   */
  private checkDayReset(): void {
    const currentDay = getDayKey();
    if (currentDay !== this.state.dayKey) {
      console.log(`[RateLimiter] Day changed (${this.state.dayKey} → ${currentDay}). Resetting daily count.`);
      this.state.dailyCount = 0;
      this.state.dayKey = currentDay;
    }
  }

  /**
   * Prune timestamps older than 60 seconds from the sliding window.
   */
  private pruneWindow(): void {
    const cutoff = Date.now() - 60_000;
    this.state.requestTimestamps = this.state.requestTimestamps.filter(t => t > cutoff);
  }

  /**
   * Returns how long (in ms) we need to wait before the next request.
   * Returns 0 if we can proceed immediately.
   */
  getWaitTime(): number {
    this.checkDayReset();

    // If daily limit is exhausted, no point waiting
    if (this.state.dailyCount >= MAX_RPD) {
      return -1; // Signal: daily limit exhausted
    }

    const now = Date.now();

    // If we got a 429, respect the retry-after time
    if (this.state.retryAfterMs > now) {
      return this.state.retryAfterMs - now;
    }

    // Check minimum gap since last request
    const lastRequest = this.state.requestTimestamps[this.state.requestTimestamps.length - 1];
    if (lastRequest) {
      const timeSinceLast = now - lastRequest;
      if (timeSinceLast < MIN_GAP_MS) {
        return MIN_GAP_MS - timeSinceLast;
      }
    }

    // Check per-minute window (don't exceed 9 in the last 60s — leave margin)
    this.pruneWindow();
    if (this.state.requestTimestamps.length >= 9) {
      const oldest = this.state.requestTimestamps[0];
      return (oldest + 60_000) - now + 500; // wait until oldest falls off + 500ms buffer
    }

    return 0;
  }

  /**
   * Wait until a rate-limit slot is available, then record the request.
   * Throws if daily limit is exhausted.
   */
  async waitForSlot(): Promise<void> {
    const waitTime = this.getWaitTime();

    if (waitTime === -1) {
      throw new Error(
        `Daily API limit reached (${MAX_RPD} requests/day). ` +
        `The quota resets at midnight Pacific time. ` +
        `You have used ${this.state.dailyCount} of ${MAX_RPD} requests today.`
      );
    }

    if (waitTime > 0) {
      console.log(`[RateLimiter] Waiting ${(waitTime / 1000).toFixed(1)}s before next request...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Record this request
    const now = Date.now();
    this.state.requestTimestamps.push(now);
    this.state.dailyCount++;

    console.log(`[RateLimiter] Request #${this.state.dailyCount}/${MAX_RPD} today | ${this.state.requestTimestamps.length} in last 60s`);
  }

  /**
   * Call this when we receive a 429 response.
   * Parses Retry-After header if available.
   */
  handleRateLimit(retryAfterSeconds?: number): void {
    const waitSec = retryAfterSeconds || 30; // Default 30s if no header
    this.state.retryAfterMs = Date.now() + (waitSec * 1000);
    console.warn(`[RateLimiter] 429 received. Backing off for ${waitSec}s.`);
  }

  /**
   * Get current usage stats for UI display.
   */
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

  /**
   * Estimate time (in seconds) to process N remaining chunks.
   */
  estimateTime(chunksRemaining: number): number {
    return chunksRemaining * (MIN_GAP_MS / 1000);
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

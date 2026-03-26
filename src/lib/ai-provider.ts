import { supabase } from './supabase';
import { rateLimiter } from './rate-limiter';

/**
 * Multi-provider AI engine.
 * Loads configuration from Supabase 'ai_providers' table.
 * Fallback to .env keys if no DB config found.
 */

export interface AIProviderConfig {
  id?: string;
  name: string;
  provider: 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'nvidia';
  model: string;
  api_key: string;
  api_key_2?: string;
  base_url?: string;
  enabled: boolean;
  priority: number;
}

let cachedProviders: AIProviderConfig[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 30000; // 30 seconds

async function getActiveProviders(): Promise<AIProviderConfig[]> {
  const now = Date.now();
  if (cachedProviders && (now - lastFetchTime < CACHE_TTL)) {
    return cachedProviders;
  }

  try {
    const { data, error } = await supabase
      .from('ai_providers')
      .select('*')
      .eq('enabled', true)
      .order('priority', { ascending: true });

    if (error) throw error;

    if (data && data.length > 0) {
      // Auto-correct retired Gemini model names
      const RETIRED_GEMINI_MODELS = [
        'gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash-8b',
        'gemini-1.5-pro', 'gemini-1.5-pro-latest',
        'gemini-1.0-pro', 'gemini-1.0-pro-latest',
        'gemini-2.0-flash', 'gemini-2.0-flash-lite',
      ];
      const REPLACEMENT_MODEL = 'gemini-2.5-flash';

      cachedProviders = data.map((p: any) => {
        if (p.provider === 'gemini' && RETIRED_GEMINI_MODELS.includes(p.model)) {
          console.warn(`[AI] Auto-upgrading retired model "${p.model}" → "${REPLACEMENT_MODEL}"`);
          return { ...p, model: REPLACEMENT_MODEL };
        }
        return p;
      });
      lastFetchTime = now;
      return cachedProviders;
    }
  } catch (err) {
    console.warn('[AI] Failed to fetch providers from DB, using fallback:', err);
  }

  // Fallback to .env Gemini
  const envKeys = [
    import.meta.env.VITE_GEMINI_API_KEY_1,
    import.meta.env.VITE_GEMINI_API_KEY_2,
  ].filter(Boolean);

  if (envKeys.length > 0) {
    return [{
      name: 'Gemini (Env)',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      api_key: envKeys[0],
      api_key_2: envKeys[1] || undefined,
      enabled: true,
      priority: 1
    }];
  }

  return [];
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Core function: call AI with retry and fallback across providers.
 */
export async function callAI(prompt: string, options: { temperature?: number, retries?: number, signal?: AbortSignal } = {}): Promise<string> {
  const providers = await getActiveProviders();
  const { temperature = 0.1, retries = 3, signal } = options;
  if (providers.length === 0) {
    throw new Error('No AI providers configured. Add them in the Admin Dashboard.');
  }

  let lastErrorMessage = '';
  let sawQuotaLimitedProvider = false;
  let maxRetryAfterSeconds = 0;

  for (const config of providers) {
    console.log(`[AI] Trying provider: ${config.name} | model: ${config.model}`);
    // Build a key list: primary + secondary (if available)
    const keys = [config.api_key];
    if (config.api_key_2) keys.push(config.api_key_2);
    let providerQuotaLimited = false;

    for (let attempt = 0; attempt < retries; attempt++) {
      // Check cancellation before each attempt
      if (signal?.aborted) {
        throw new DOMException('Pipeline cancelled by user', 'AbortError');
      }

      // Wait for rate limiter slot
      await rateLimiter.waitForSlot();

      // Rotate keys across attempts
      const keyIndex = attempt % keys.length;
      const configWithKey = { ...config, api_key: keys[keyIndex] };

      try {
        const result = await executeCall(configWithKey, prompt, temperature);
        if (result) return result;
      } catch (error: any) {
        lastErrorMessage = error.message;
        console.error(`[AI] ${config.name} attempt ${attempt + 1} failed:`, error.message);

        if (error.status === 429) {
          if (error.isQuotaExceeded) {
            console.warn(`[AI] Provider quota exhausted on ${config.name}. Skipping immediate retries for this chunk.`);
            providerQuotaLimited = true;
            sawQuotaLimitedProvider = true;
            const retryAfter = Number(error.retryAfter) || 0;
            if (retryAfter > maxRetryAfterSeconds) maxRetryAfterSeconds = retryAfter;
            break;
          }

          // Parse Retry-After or exact message
          const retryAfter = error.retryAfter || 30;
          rateLimiter.handleRateLimit(retryAfter);
          console.warn(`[AI] Quota reached. Waiting ${retryAfter}s before attempt ${attempt + 2}...`);
          await delay(retryAfter * 1000);
          
          // Increase retries for rate limit errors specifically
          if (attempt < 10) { 
             continue;
          }
        }

        if (error.status === 400 && error.message?.includes('too long')) {
          // Content too long for model — skip, don't retry
          console.error(`[AI] Content too long for model. Skipping.`);
          throw error;
        }

        // For other errors, exponential backoff
        if (attempt < retries - 1) {
          const backoff = Math.min(2000 * Math.pow(2, attempt), 30000);
          console.log(`[AI] Retrying in ${backoff / 1000}s...`);
          await delay(backoff);
          continue;
        }
      }
    }
    if (providerQuotaLimited) {
      continue;
    }
    console.warn(`[AI] Provider ${config.name} exhausted, trying next...`);
  }

  if (sawQuotaLimitedProvider) {
    const quotaError: any = new Error(`All configured AI providers are currently quota-limited.`);
    quotaError.status = 429;
    quotaError.isQuotaExceeded = true;
    quotaError.retryAfter = maxRetryAfterSeconds || 30;
    throw quotaError;
  }

  throw new Error(`All configured AI providers failed. Last error: ${lastErrorMessage || 'Unknown failure'}`);
}

async function executeCall(config: AIProviderConfig, prompt: string, temperature: number): Promise<string> {
  const { provider, model, api_key, base_url } = config;

  switch (provider) {
    case 'gemini':
      return callGemini(api_key, model, prompt, temperature);
    case 'openai':
      return callOpenAI(api_key, model, prompt, temperature);
    case 'anthropic':
      return callAnthropic(api_key, model, prompt, temperature);
    case 'openrouter':
      return callOpenRouter(api_key, model, prompt, temperature, base_url);
    case 'nvidia':
      return callNvidia(api_key, model, prompt, temperature, base_url);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

async function callGemini(apiKey: string, model: string, prompt: string, temperature: number): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
    const error = new Error(err.error?.message || `Gemini error ${response.status}`);
    (error as any).status = response.status;
    // Parse Retry-After header or message for 429s
    if (response.status === 429) {
      const retryHeader = response.headers.get('Retry-After');
      let waitSeconds = retryHeader ? parseInt(retryHeader, 10) : 30;
      
      // Try parsing from message if header is missing
      const message = err.error?.message || '';
      const match = message.match(/retry in ([\d.]+)s/i);
      if (match && match[1]) {
        waitSeconds = Math.ceil(parseFloat(match[1]));
        console.warn(`[AI] Parsed wait time from Gemini message: ${waitSeconds}s`);
      }
      (error as any).retryAfter = waitSeconds;
      (error as any).isQuotaExceeded =
        /quota exceeded|free_tier_requests|generate_content_free_tier_requests/i.test(message);
    }
    throw error;
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');
  return text;
}

async function callOpenAI(apiKey: string, model: string, prompt: string, temperature: number): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
    const error = new Error(err.error?.message || `OpenAI error ${response.status}`);
    (error as any).status = response.status;
    throw error;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callAnthropic(apiKey: string, model: string, prompt: string, temperature: number): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
      temperature
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
    const error = new Error(err.error?.message || `Anthropic error ${response.status}`);
    (error as any).status = response.status;
    throw error;
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

async function callOpenRouter(apiKey: string, model: string, prompt: string, temperature: number, baseUrl?: string): Promise<string> {
  const url = baseUrl || 'https://openrouter.ai/api/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'RequireAI'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
    const error = new Error(err.error?.message || `OpenRouter error ${response.status}`);
    (error as any).status = response.status;
    throw error;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callNvidia(apiKey: string, model: string, prompt: string, temperature: number, baseUrl?: string): Promise<string> {
  const url = baseUrl || 'https://integrate.api.nvidia.com/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
    const error = new Error(err.error?.message || `NVIDIA error ${response.status}`);
    (error as any).status = response.status;
    throw error;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Chat-style call with multiple messages.
 */
export async function callAIChat(messages: { role: string; text: string }[]): Promise<string> {
  const providers = await getActiveProviders();
  if (providers.length === 0) throw new Error('No AI configured');

  // Rate limit chat calls too
  await rateLimiter.waitForSlot();

  const config = providers[0]; 
  const { provider, model, api_key } = config;

  if (provider === 'gemini') {
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }],
    }));
    return callGeminiComplex(api_key, model, contents);
  }

  const formattedMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.text
  }));

  return callGenericChat(config, formattedMessages);
}

async function callGeminiComplex(apiKey: string, model: string, contents: any[]): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents })
  });
  if (!response.ok) throw new Error(`Gemini Chat error ${response.status}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callGenericChat(config: AIProviderConfig, messages: any[]): Promise<string> {
  const endpoint = config.provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' :
                   config.provider === 'anthropic' ? 'https://api.anthropic.com/v1/messages' :
                   config.provider === 'openrouter' ? (config.base_url || 'https://openrouter.ai/api/v1/chat/completions') :
                   config.provider === 'nvidia' ? (config.base_url || 'https://integrate.api.nvidia.com/v1/chat/completions') : '';
  
  if (!endpoint) throw new Error(`Chat not implemented for ${config.provider}`);

  const headers: any = { 'Content-Type': 'application/json' };
  if (config.provider === 'openai' || config.provider === 'openrouter' || config.provider === 'nvidia') {
    headers['Authorization'] = `Bearer ${config.api_key}`;
  } else if (config.provider === 'anthropic') {
    headers['x-api-key'] = config.api_key;
    headers['anthropic-version'] = '2023-06-01';
  }

  const body: any = {
    model: config.model,
    messages: messages,
    temperature: 0.7
  };

  if (config.provider === 'anthropic' || config.provider === 'nvidia') {
    body.max_tokens = 4096;
  }

  const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`${config.provider} Chat error ${response.status}`);
  
  const data = await response.json();
  if (config.provider === 'anthropic') return data.content?.[0]?.text || '';
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Extract structured data from a text chunk.
 */
export async function extractFromChunk(chunkText: string, signal?: AbortSignal): Promise<any> {
  // No more hard truncation — chunks are pre-sized at ~2000 words in extraction.ts
  const prompt = `Analyze this business communication or project document text. 
Identify requirements, stakeholders, decisions, and timeline items. 
Even if the text seems fragmented, extract any potential insights.

Return ONLY valid JSON, no markdown, no extra text:
{
  "isRelevant": true,
  "requirements": [
    {"text": "requirement description", "category": "Functional", "priority": "high", "confidence": 0.9}
  ],
  "stakeholders": [
    {"name": "person name", "role": "their role", "influence": "high", "sentiment": "neutral"}
  ],
  "decisions": [
    {"text": "decision made", "decidedBy": "person name", "rationale": "why this decision"}
  ],
  "timeline": [
    {"milestone": "milestone name", "date": "date or timeframe"}
  ]
}

If the text is completely irrelevant (e.g. random noise), return:
{"isRelevant": false, "requirements": [], "stakeholders": [], "decisions": [], "timeline": []}

Text to analyze:
${chunkText}`;

  const response = await callAI(prompt, { signal });

  try {
    const clean = response
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    
    const parsed = JSON.parse(clean);
    
    return {
      isRelevant: parsed.isRelevant ?? (parsed.requirements?.length > 0),
      requirements: parsed.requirements || [],
      stakeholders: parsed.stakeholders || [],
      decisions: parsed.decisions || [],
      timeline: parsed.timeline || [],
    };
  } catch (err) {
    console.warn('[AI] Failed to parse extraction response:', err);
    return { isRelevant: false, requirements: [], stakeholders: [], decisions: [], timeline: [] };
  }
}

/**
 * Generate an executive summary for the BRD.
 */
export async function generateSummary(requirements: any[]): Promise<string> {
  if (!requirements || requirements.length === 0) {
    return 'No requirements extracted from the provided documents.';
  }

  const prompt = `Write a professional, comprehensive executive summary for a Business Requirements Document (BRD).
Context (Sample Requirements):
${requirements.slice(0, 15).map((r: any) => `- ${r.text}`).join('\n')}

Write a detailed summary of exactly 5-6 sentences outlining the core objective, key stakeholders, critical requirements, and overall scope of the project. Professional tone. Plain text only. No markdown formatting.`;

  return await callAI(prompt);
}

/**
 * Get display name of the current AI model.
 */
export async function getActiveProviderName(): Promise<string> {
  const providers = await getActiveProviders();
  if (providers.length > 0) return `${providers[0].name} (${providers[0].model})`;
  return 'No AI configured';
}

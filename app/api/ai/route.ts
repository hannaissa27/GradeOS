import { NextRequest, NextResponse } from 'next/server';

/**
 * AI proxy route.
 *
 * Provider + model are chosen with environment variables (see .env.example):
 *
 *   AI_PROVIDER = groq | gemini | openrouter      (optional — inferred from which key is set)
 *   AI_MODEL    = model id for that provider      (optional — sensible free default per provider)
 *
 *   GROQ_API_KEY        → https://console.groq.com/keys        (free tier)
 *   GEMINI_API_KEY      → https://aistudio.google.com/apikey   (free tier)
 *   OPENROUTER_API_KEY  → https://openrouter.ai/keys           (":free" models)
 *
 * The browser never sees the key — all calls go through this server route.
 */

type Provider = 'groq' | 'gemini' | 'openrouter';

const DEFAULT_MODEL: Record<Provider, string> = {
  // llama-3.1-8b-instant and llama-3.3-70b-versatile were retired by Groq on 2026-08-16.
  groq: 'openai/gpt-oss-20b',
  gemini: 'gemini-2.5-flash',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
};

function resolveProvider(): { provider: Provider; apiKey: string; model: string } | null {
  const forced = (process.env.AI_PROVIDER || '').toLowerCase() as Provider | '';
  const keys: Record<Provider, string | undefined> = {
    groq: process.env.GROQ_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
  };

  let provider: Provider | null = null;
  if (forced && keys[forced]) provider = forced;
  else if (keys.groq) provider = 'groq';
  else if (keys.gemini) provider = 'gemini';
  else if (keys.openrouter) provider = 'openrouter';

  if (!provider) return null;
  return {
    provider,
    apiKey: keys[provider]!,
    model: process.env.AI_MODEL || DEFAULT_MODEL[provider],
  };
}

/** Remove reasoning blocks some open models leak into the answer. */
function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  system: string | undefined,
  prompt: string,
  maxTokens: number,
  json: boolean,
  extraHeaders: Record<string, string> = {},
) {
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature: 0.4,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: prompt },
    ],
  };
  if (json) body.response_format = { type: 'json_object' };
  // gpt-oss models are reasoning models; keep reasoning short for snappy UI responses.
  if (/gpt-oss/i.test(model)) body.reasoning_effort = 'low';

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false as const, status: res.status, error: data?.error?.message || `Error ${res.status}` };
  }
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  return { ok: true as const, text: stripThinking(text) };
}

async function callGemini(
  apiKey: string,
  model: string,
  system: string | undefined,
  prompt: string,
  maxTokens: number,
  json: boolean,
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.4,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false as const, status: res.status, error: data?.error?.message || `Error ${res.status}` };
  }
  const parts: { text?: string }[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map(p => p.text ?? '').join('');
  return { ok: true as const, text: stripThinking(text) };
}

/** Lightweight status check used by the Settings panel — never exposes the key. */
export async function GET() {
  const cfg = resolveProvider();
  if (!cfg) return NextResponse.json({ configured: false });
  return NextResponse.json({ configured: true, provider: cfg.provider, model: cfg.model });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

    const { prompt, system, maxTokens, json } = body as {
      prompt?: string; system?: string; maxTokens?: number; json?: boolean;
    };
    if (!prompt) return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });

    const cfg = resolveProvider();
    if (!cfg) {
      return NextResponse.json(
        { error: 'AI not configured. Add GROQ_API_KEY (or GEMINI_API_KEY / OPENROUTER_API_KEY) to .env.local and restart.' },
        { status: 503 },
      );
    }

    const tokens = Math.min(Math.max(Number(maxTokens) || 800, 64), 2048);
    const sys = system ? String(system) : undefined;
    const usr = String(prompt);
    const wantJson = !!json;

    let result;
    if (cfg.provider === 'gemini') {
      result = await callGemini(cfg.apiKey, cfg.model, sys, usr, tokens, wantJson);
    } else if (cfg.provider === 'openrouter') {
      result = await callOpenAICompatible(
        'https://openrouter.ai/api/v1', cfg.apiKey, cfg.model, sys, usr, tokens, wantJson,
        { 'HTTP-Referer': 'https://gradeos.app', 'X-Title': 'GradeOS' },
      );
    } else {
      result = await callOpenAICompatible(
        'https://api.groq.com/openai/v1', cfg.apiKey, cfg.model, sys, usr, tokens, wantJson,
      );
    }

    if (!result.ok) {
      console.error(`[AI] ${cfg.provider}/${cfg.model} failed:`, result.status, result.error);
      // Preserve 429 so the UI can show a "rate limited" message; everything else is a 502.
      const status = result.status === 429 ? 429 : 502;
      return NextResponse.json({ error: result.error, provider: cfg.provider, model: cfg.model }, { status });
    }

    return NextResponse.json({ text: result.text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('[AI] Exception:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

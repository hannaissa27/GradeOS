import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { prompt, system, maxTokens, apiKey } = body;

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json({ error: 'NO_API_KEY' }, { status: 401 });
    }

    if (!prompt) {
      return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });
    }

    const requestBody = {
      model: 'claude-3-haiku-20240307',
      max_tokens: Math.min(maxTokens || 800, 1024),
      messages: [{ role: 'user', content: String(prompt) }],
      ...(system ? { system: String(system) } : {}),
    };

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data?.error?.message || data?.error?.type || `Anthropic ${res.status}`;
      console.error('[AI] Failed:', res.status, errMsg, JSON.stringify(data));
      if (res.status === 401) {
        return NextResponse.json({ error: 'INVALID_API_KEY' }, { status: 401 });
      }
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    const text = data?.content?.[0]?.text ?? '';
    return NextResponse.json({ text });

  } catch (err: any) {
    console.error('[AI] Exception:', err?.message);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

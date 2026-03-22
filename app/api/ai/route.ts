import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, system, maxTokens, apiKey } = body;

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json({ error: 'NO_API_KEY' }, { status: 401 });
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: maxTokens || 800,
        system: system || 'You are a helpful assistant.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();

    if (res.status === 401) {
      return NextResponse.json({ error: 'INVALID_API_KEY' }, { status: 401 });
    }

    if (!res.ok) {
      console.error('[AI route] Anthropic error:', res.status, data);
      return NextResponse.json(
        { error: data?.error?.message || `Anthropic error ${res.status}` },
        { status: res.status }
      );
    }

    const text = data?.content?.[0]?.text ?? '';
    return NextResponse.json({ text });

  } catch (err: any) {
    console.error('[AI route] exception:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

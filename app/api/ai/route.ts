import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { prompt, system, maxTokens } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[AI] Missing OPENAI_API_KEY environment variable');
      return NextResponse.json({ error: 'Server misconfigured: missing API key' }, { status: 500 });
    }

    const messages: { role: string; content: string }[] = [];
    if (system) {
      messages.push({ role: 'system', content: String(system) });
    }
    messages.push({ role: 'user', content: String(prompt) });

    const requestBody = {
      model: 'openai/gpt-4.1-nano',
      max_tokens: Math.min(maxTokens || 800, 1024),
      messages,
    };

    const res = await fetch('https://api.ai.vercel.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data?.error?.message || data?.error?.type || `AI Gateway ${res.status}`;
      console.error('[AI] Failed:', res.status, errMsg, JSON.stringify(data));
      return NextResponse.json({ error: errMsg }, { status: res.status });
    }

    const text = data?.choices?.[0]?.message?.content ?? '';
    return NextResponse.json({ text });

  } catch (err: any) {
    console.error('[AI] Exception:', err?.message);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

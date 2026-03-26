import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

    const { prompt, system, maxTokens } = body;
    if (!prompt) return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[AI] OPENAI_API_KEY not set');
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
    }

    // Use Vercel AI Gateway with gpt-4.1-nano
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-nano',
        max_tokens: Math.min(maxTokens || 800, 1024),
        messages: [
          ...(system ? [{ role: 'system', content: String(system) }] : []),
          { role: 'user', content: String(prompt) },
        ],
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data?.error?.message || `Error ${res.status}`;
      console.error('[AI] Failed:', res.status, errMsg);
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    const text = data?.choices?.[0]?.message?.content ?? '';
    return NextResponse.json({ text });

  } catch (err: any) {
    console.error('[AI] Exception:', err?.message);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

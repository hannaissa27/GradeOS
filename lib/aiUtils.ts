// AI is now handled server-side via Vercel AI Gateway.
// No API key is needed from users.

export async function callAI(
  userPrompt: string,
  systemPrompt: string,
  maxTokens = 800
): Promise<string> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: userPrompt, system: systemPrompt, maxTokens }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'AI request failed');
  }

  return data.text || '';
}

// Kept for backward compatibility — components that called callClaude still work
export const callClaude = callAI;

// No-op stubs — key management no longer needed
export function getAnthropicKey(): string | null { return null; }
export function setAnthropicKey(_key: string): void {}
export function removeAnthropicKey(): void {}
export function hasAIKey(): boolean { return true; }

export async function summarizeAnnouncements(announcements: { title: string; message: string }[]): Promise<string> {
  return callAI(
    announcements.map(a => `${a.title}\n${a.message}`).join('\n---\n'),
    'Summarize these course announcements briefly. Focus on deadlines and required actions.',
    400
  );
}

export async function chunkAssignment(title: string, description: string): Promise<string[]> {
  const response = await callAI(
    `Title: ${title}\nDescription: ${description || 'No description'}`,
    'Break this assignment into 4-8 actionable steps. Return ONLY a JSON array of strings.',
    400
  );
  try {
    const parsed = JSON.parse(response.replace(/```json|```/g, '').trim());
    if (Array.isArray(parsed)) return parsed.filter(s => typeof s === 'string');
  } catch {}
  return response.split('\n').map(l => l.replace(/^[\d\-\*\.]+\s*/, '').trim()).filter(Boolean);
}

export async function extractSyllabusDates(text: string): Promise<{ date: string; event: string }[]> {
  const response = await callAI(
    text.slice(0, 4000),
    'Extract all dates and events from this syllabus. Return ONLY a JSON array: [{"date":"YYYY-MM-DD","event":"description"}]',
    800
  );
  try {
    const parsed = JSON.parse(response.replace(/```json|```/g, '').trim());
    if (Array.isArray(parsed)) return parsed.filter(i => i.date && i.event);
  } catch {}
  return [];
}

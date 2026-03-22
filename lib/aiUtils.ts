const AI_KEY_STORAGE = 'gradeos-ai-key';

export function getAnthropicKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AI_KEY_STORAGE);
}

export function setAnthropicKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AI_KEY_STORAGE, key.trim());
}

export function removeAnthropicKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AI_KEY_STORAGE);
}

export function hasAIKey(): boolean {
  const k = getAnthropicKey();
  return !!k && k.length > 10;
}

export async function callClaude(
  userPrompt: string,
  systemPrompt: string,
  maxTokens = 800
): Promise<string> {
  const apiKey = getAnthropicKey();
  if (!apiKey) throw new Error('NO_API_KEY');

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: userPrompt, system: systemPrompt, maxTokens, apiKey }),
  });

  const data = await res.json();

  if (res.status === 401) {
    throw new Error(data.error === 'NO_API_KEY' ? 'NO_API_KEY' : 'INVALID_API_KEY');
  }

  if (!res.ok) {
    throw new Error(data.error || 'AI request failed');
  }

  return data.text || '';
}

export async function summarizeAnnouncements(announcements: { title: string; message: string }[]): Promise<string> {
  return callClaude(
    announcements.map(a => `${a.title}\n${a.message}`).join('\n---\n'),
    'Summarize these course announcements briefly. Focus on deadlines and required actions.',
    400
  );
}

export async function chunkAssignment(title: string, description: string): Promise<string[]> {
  const response = await callClaude(
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
  const response = await callClaude(
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

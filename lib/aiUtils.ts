// AI utility functions for GradeOS

const AI_KEY_STORAGE = 'gradeos-ai-key';

/**
 * Get stored Anthropic API key
 */
export function getAnthropicKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AI_KEY_STORAGE);
}

/**
 * Store Anthropic API key
 */
export function setAnthropicKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AI_KEY_STORAGE, key);
}

/**
 * Remove stored Anthropic API key
 */
export function removeAnthropicKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AI_KEY_STORAGE);
}

/**
 * Check if AI key is configured
 */
export function hasAIKey(): boolean {
  return !!getAnthropicKey();
}

/**
 * Call Claude API directly from browser
 * Note: Requires anthropic-dangerous-direct-browser-access header
 */
export async function callClaude(
  userPrompt: string,
  systemPrompt: string,
  maxTokens: number = 1024
): Promise<string> {
  const apiKey = getAnthropicKey();
  
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (response.status === 401) {
      throw new Error('INVALID_API_KEY');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || 'AI request failed');
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NO_API_KEY' || error.message === 'INVALID_API_KEY') {
        throw error;
      }
    }
    throw new Error('AI request failed. Please try again.');
  }
}

/**
 * Summarize announcements using Claude
 */
export async function summarizeAnnouncements(announcements: { title: string; message: string }[]): Promise<string> {
  const systemPrompt = `You are a helpful assistant summarizing course announcements for a student. 
Be concise and actionable. Focus on key dates, deadlines, and required actions.
Format as a brief summary with bullet points for action items.`;

  const userPrompt = `Summarize these announcements:\n\n${announcements.map(a => 
    `Title: ${a.title}\n${a.message}\n---`
  ).join('\n')}`;

  return callClaude(userPrompt, systemPrompt, 512);
}

/**
 * Break down an assignment into actionable steps
 */
export async function chunkAssignment(title: string, description: string): Promise<string[]> {
  const systemPrompt = `You are a study assistant helping break down assignments into manageable steps.
Return ONLY a JSON array of strings, each string being a clear action item.
Keep steps specific and actionable. Aim for 4-8 steps.
Example: ["Read chapter 5", "Take notes on key concepts", "Complete practice problems 1-10"]`;

  const userPrompt = `Break this assignment into steps:\n\nTitle: ${title}\n\nDescription: ${description || 'No description provided'}`;

  const response = await callClaude(userPrompt, systemPrompt, 512);
  
  try {
    // Try to parse as JSON
    const parsed = JSON.parse(response);
    if (Array.isArray(parsed)) {
      return parsed.filter(item => typeof item === 'string');
    }
  } catch {
    // If not valid JSON, split by newlines and clean up
    return response
      .split('\n')
      .map(line => line.replace(/^[\d\-\*\.\)]+\s*/, '').trim())
      .filter(line => line.length > 0);
  }
  
  return [];
}

/**
 * Extract dates from syllabus text
 */
export async function extractSyllabusDates(text: string): Promise<{ date: string; event: string }[]> {
  const systemPrompt = `You are a date extraction assistant for academic syllabi.
Extract all dates and their associated events/deadlines.
Return ONLY a JSON array of objects with "date" (ISO format YYYY-MM-DD) and "event" (description) fields.
Example: [{"date": "2024-03-15", "event": "Midterm Exam"}]`;

  const userPrompt = `Extract dates from this syllabus:\n\n${text.slice(0, 4000)}`;

  const response = await callClaude(userPrompt, systemPrompt, 1024);
  
  try {
    const parsed = JSON.parse(response);
    if (Array.isArray(parsed)) {
      return parsed.filter(item => 
        typeof item === 'object' && 
        item !== null && 
        typeof item.date === 'string' && 
        typeof item.event === 'string'
      );
    }
  } catch {
    return [];
  }
  
  return [];
}

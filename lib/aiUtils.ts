// AI utilities for GradeOS
// All AI calls route through /api/ai (server-side Groq key)

import type { Assignment } from './types';

export function hasAIKey(): boolean {
  return true;
}

export async function callClaude(
  userPrompt: string,
  systemPrompt: string,
  maxTokens = 800
): Promise<string> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: userPrompt,
      system: systemPrompt,
      maxTokens,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'AI request failed');
  }

  return data.text || '';
}

// ============ Batch Effort Estimation ============
// ONE AI call estimates effort for ALL pending assignments
// Cached in sessionStorage to avoid repeat calls

const EFFORT_CACHE_KEY = 'gradeos-effort-estimates';
const EFFORT_CACHE_TTL = 1000 * 60 * 60 * 4; // 4 hours

interface EffortCache {
  estimates: Record<string, number>; // assignmentId → minutes
  timestamp: number;
}

function getEffortCache(): EffortCache | null {
  try {
    const raw = sessionStorage.getItem(EFFORT_CACHE_KEY);
    if (!raw) return null;
    const cache: EffortCache = JSON.parse(raw);
    if (Date.now() - cache.timestamp > EFFORT_CACHE_TTL) return null;
    return cache;
  } catch {
    return null;
  }
}

function setEffortCache(estimates: Record<string, number>) {
  try {
    sessionStorage.setItem(EFFORT_CACHE_KEY, JSON.stringify({
      estimates,
      timestamp: Date.now(),
    }));
  } catch {}
}

export async function batchEstimateEffort(
  assignments: Assignment[]
): Promise<Record<string, number>> {
  if (assignments.length === 0) return {};

  // Check cache first
  const cache = getEffortCache();
  const uncached = cache
    ? assignments.filter(a => !(a.id in cache.estimates))
    : assignments;

  // If all cached, return immediately
  if (uncached.length === 0 && cache) return cache.estimates;

  // Build compact prompt — just names, types, points
  const lines = uncached.map((a, i) =>
    `${i + 1}. "${a.name}" (${a.pointsPossible}pts, ${(a.submissionTypes || []).join('/') || 'unknown'})`
  ).join('\n');

  try {
    const response = await callClaude(
      `Estimate effort in minutes for each assignment:\n${lines}`,
      `You estimate how long college assignments take. Return ONLY a JSON array of integers (minutes), one per assignment, in the same order. Base estimates on assignment type and points: quizzes 15-45min, short homework 30-60min, essays/papers 60-180min, labs 90-180min, projects 120-300min, discussions 15-30min. Example response: [30,90,45,120]\nReturn ONLY the array. No text.`,
      200
    );

    const parsed = JSON.parse(response.replace(/```json|```/g, '').trim());
    if (Array.isArray(parsed) && parsed.length === uncached.length) {
      const newEstimates: Record<string, number> = cache?.estimates ? { ...cache.estimates } : {};
      uncached.forEach((a, i) => {
        const mins = typeof parsed[i] === 'number' ? Math.max(15, Math.min(480, parsed[i])) : 60;
        newEstimates[a.id] = mins;
      });
      setEffortCache(newEstimates);
      return newEstimates;
    }
  } catch (err) {
    console.error('[GradeOS] Batch effort estimation failed:', err);
  }

  // Fallback: heuristic estimates based on points
  const fallback: Record<string, number> = cache?.estimates ? { ...cache.estimates } : {};
  uncached.forEach(a => {
    const types = (a.submissionTypes || []).join(',').toLowerCase();
    if (types.includes('quiz')) fallback[a.id] = 30;
    else if (types.includes('discussion')) fallback[a.id] = 20;
    else if (a.pointsPossible >= 100) fallback[a.id] = 120;
    else if (a.pointsPossible >= 50) fallback[a.id] = 60;
    else fallback[a.id] = 45;
  });
  setEffortCache(fallback);
  return fallback;
}

// ============ Missing Assignment Dismissal ============

const DISMISSED_MISSING_KEY = 'gradeos-dismissed-missing';

export function getDismissedMissing(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_MISSING_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function dismissMissing(assignmentId: string) {
  const current = getDismissedMissing();
  current.add(assignmentId);
  localStorage.setItem(DISMISSED_MISSING_KEY, JSON.stringify([...current]));
}

export function undismissMissing(assignmentId: string) {
  const current = getDismissedMissing();
  current.delete(assignmentId);
  localStorage.setItem(DISMISSED_MISSING_KEY, JSON.stringify([...current]));
}

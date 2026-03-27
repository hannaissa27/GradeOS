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

const EFFORT_CACHE_KEY = 'gradeos-effort-v2';
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
    sessionStorage.removeItem('gradeos-effort-estimates'); // clear old v1 cache
    sessionStorage.setItem(EFFORT_CACHE_KEY, JSON.stringify({
      estimates,
      timestamp: Date.now(),
    }));
  } catch {}
}

export function clearEffortCache() {
  try {
    sessionStorage.removeItem(EFFORT_CACHE_KEY);
    sessionStorage.removeItem('gradeos-effort-estimates');
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
      `You estimate how long high school and college assignments take to complete. Return ONLY a JSON array of integers (minutes), one per assignment, in the same order.

Use the assignment NAME as the primary signal — it tells you the real type:
- AP exams, mock exams, AP practice tests: 180-240 min
- Major tests, unit tests (2+ units), midterms, finals: 90-150 min
- Chapter tests, single-unit tests: 60-90 min
- Quizzes (any kind): 20-40 min
- Essays, research papers, written reports: 90-240 min scaled by points
- Lab reports, projects, presentations: 90-240 min scaled by points
- Homework, practice problems, worksheets, problem sets: 20-60 min scaled by points
- Discussions, reading responses, short reflections: 15-30 min
- Reading assignments: 30-60 min

An "AP Mock Exam" must NOT get the same estimate as a "Homework" or a "Quiz". Scale by points only as a secondary signal when names are ambiguous. Example response: [30,180,25,45]\nReturn ONLY the array. No text.`,
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

  // Fallback: heuristic estimates based on name and points
  const fallback: Record<string, number> = cache?.estimates ? { ...cache.estimates } : {};
  uncached.forEach(a => {
    const name = (a.name || '').toLowerCase();
    const types = (a.submissionTypes || []).join(',').toLowerCase();
    if (/ap.*(exam|mock|test|practice)/i.test(a.name) || /mock.*(ap|exam)/i.test(a.name)) {
      fallback[a.id] = 210;
    } else if (/midterm|final\s*exam/i.test(a.name)) {
      fallback[a.id] = 120;
    } else if (/unit\s*test|\d\s*unit.*test|chapter\s*test|major\s*test/i.test(a.name)) {
      fallback[a.id] = 100;
    } else if (/\btest\b/i.test(a.name)) {
      fallback[a.id] = 75;
    } else if (/\bquiz\b/i.test(a.name)) {
      fallback[a.id] = 25;
    } else if (/\bessay\b|research\s*paper|\bpaper\b|\breport\b/i.test(a.name)) {
      fallback[a.id] = Math.max(90, Math.min(180, a.pointsPossible));
    } else if (/\bproject\b|\bpresentation\b|\blab\b/i.test(a.name)) {
      fallback[a.id] = Math.max(90, Math.min(240, a.pointsPossible * 1.5));
    } else if (/\bdiscussion\b|\bresponse\b|\breflection\b/i.test(a.name) || types.includes('discussion')) {
      fallback[a.id] = 20;
    } else if (/\bhomework\b|\bpractice\b|\bworksheet\b|\bproblem\s*set\b/i.test(a.name)) {
      fallback[a.id] = Math.max(20, Math.min(60, a.pointsPossible / 2));
    } else if (a.pointsPossible >= 100) {
      fallback[a.id] = 120;
    } else if (a.pointsPossible >= 50) {
      fallback[a.id] = 60;
    } else {
      fallback[a.id] = 35;
    }
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

// ============ Assignment Ignore (hide from list + AI) ============

const IGNORED_ASSIGNMENTS_KEY = 'gradeos-ignored-assignments';

export function getIgnoredAssignments(): Set<string> {
  try {
    const raw = localStorage.getItem(IGNORED_ASSIGNMENTS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function ignoreAssignment(assignmentId: string) {
  const current = getIgnoredAssignments();
  current.add(assignmentId);
  localStorage.setItem(IGNORED_ASSIGNMENTS_KEY, JSON.stringify([...current]));
}

export function unignoreAssignment(assignmentId: string) {
  const current = getIgnoredAssignments();
  current.delete(assignmentId);
  localStorage.setItem(IGNORED_ASSIGNMENTS_KEY, JSON.stringify([...current]));
}

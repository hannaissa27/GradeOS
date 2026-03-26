'use client';

import React, { useState, useMemo } from 'react';
import { Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { callClaude } from '@/lib/aiUtils';
import { getGradeColor, gradeToLetter, formatDueDate } from '@/lib/gradeUtils';
import type { Course, Assignment, Submission } from '@/lib/types';

interface WeeklyBriefProps {
  courses: Course[];
  allAssignments: Assignment[];
  allSubmissions: Submission[];
}

export function WeeklyBrief({ courses, allAssignments, allSubmissions }: WeeklyBriefProps) {
  const [brief, setBrief] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const submissionMap = useMemo(() =>
    new Map(allSubmissions.map(s => [s.assignmentId, s])),
    [allSubmissions]
  );

  // Build context for AI
  const weekContext = useMemo(() => {
    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcoming = allAssignments
      .filter(a => {
        if (!a.dueDate) return false;
        const due = new Date(a.dueDate);
        if (due < now || due > weekEnd) return false;
        const sub = submissionMap.get(a.id);
        return !sub?.submittedAt && (sub?.score === null || sub?.score === undefined);
      })
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

    const missing = allAssignments.filter(a => {
      const sub = submissionMap.get(a.id);
      return sub?.missing && !sub?.excused;
    });

    const courseGrades = courses
      .filter(c => c.currentGrade !== null)
      .map(c => {
        const shortName = c.name.includes(':')
          ? c.name.split(':').slice(1).join(':').trim().replace(/^(AP|IB|Honors|Accelerated) /i, '').trim()
          : c.name;
        return `${shortName}: ${c.currentGrade}% (${gradeToLetter(c.currentGrade)})`;
      });

    const upcomingList = upcoming.map(a => {
      const daysLeft = Math.ceil((new Date(a.dueDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const courseName = courses.find(c => c.id === a.courseId)?.name || '';
      const shortCourse = courseName.includes(':')
        ? courseName.split(':').slice(1).join(':').trim().replace(/^(AP|IB|Honors|Accelerated) /i, '').trim()
        : courseName;
      return `"${a.name}" (${shortCourse}, ${a.pointsPossible}pts, due in ${daysLeft}d)`;
    });

    const missingList = missing.map(a => {
      const courseName = courses.find(c => c.id === a.courseId)?.name || '';
      return `"${a.name}" (${courseName}, ${a.pointsPossible}pts)`;
    });

    return { upcoming, missing, courseGrades, upcomingList, missingList };
  }, [allAssignments, submissionMap, courses]);

  const handleGenerate = async () => {
    if (weekContext.upcoming.length === 0 && weekContext.missing.length === 0) {
      setBrief("You have nothing due this week and no missing assignments. Enjoy the break — or get ahead on next week's work.");
      setHasGenerated(true);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const prompt = [
        `Current grades: ${weekContext.courseGrades.join(', ') || 'No grades yet'}`,
        weekContext.upcomingList.length > 0
          ? `Due this week (${weekContext.upcomingList.length}): ${weekContext.upcomingList.join('; ')}`
          : 'Nothing due this week.',
        weekContext.missingList.length > 0
          ? `Missing assignments (${weekContext.missingList.length}): ${weekContext.missingList.join('; ')}`
          : '',
      ].filter(Boolean).join('\n');

      const response = await callClaude(
        prompt,
        `You are a student's academic strategist. Given their current grades and this week's assignments, write a concise 3-5 sentence battle plan. Be direct and specific: which assignment to start first and why (use points and grade impact as reasoning), which course needs the most attention, and one concrete action for today. If there are missing assignments, address those first. Do NOT use bullet points, headers, or markdown. Write in second person ("You should..."). Keep it under 120 words.`,
        300
      );

      setBrief(response.trim());
      setHasGenerated(true);
    } catch (err: any) {
      if (err?.message?.includes('429') || err?.message?.includes('rate')) {
        setError('AI is busy — too many requests. Try again in a minute.');
      } else {
        setError('Could not generate brief. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Don't show if no data yet
  if (courses.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {!hasGenerated ? (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Sparkles className="h-4 w-4 text-primary" />
            )}
            <span className="text-sm font-medium">
              {loading ? 'Analyzing your week...' : 'Generate your weekly battle plan'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {weekContext.upcoming.length} due this week
            {weekContext.missing.length > 0 && ` · ${weekContext.missing.length} missing`}
          </span>
        </button>
      ) : (
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Your Week</span>
            </div>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Refresh
            </button>
          </div>
          {error ? (
            <p className="text-xs text-red-500">{error}</p>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">{brief}</p>
          )}
        </div>
      )}
    </div>
  );
}

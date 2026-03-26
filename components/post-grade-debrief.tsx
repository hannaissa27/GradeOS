'use client';

import React, { useState, useMemo } from 'react';
import { Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { callClaude } from '@/lib/aiUtils';
import { getGradeColor, gradeToLetter, courseColor } from '@/lib/gradeUtils';
import type { Course, Assignment, Submission } from '@/lib/types';

interface PostGradeDebriefProps {
  course: Course;
  assignments: Assignment[];
  submissions: Submission[];
}

interface RecentGrade {
  assignment: Assignment;
  submission: Submission;
  scorePct: number;
  isLow: boolean; // below course average
  isHigh: boolean; // significantly above
  daysAgo: number;
}

export function PostGradeDebrief({ course, assignments, submissions }: PostGradeDebriefProps) {
  const [debrief, setDebrief] = useState<Record<string, string>>({}); // assignmentId → debrief text
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Find grades returned in last 7 days
  const recentGrades = useMemo((): RecentGrade[] => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Course average
    let totalEarned = 0, totalPossible = 0;
    submissions.forEach(s => {
      if (s.score === null || s.score === undefined) return;
      const a = assignments.find(x => x.id === s.assignmentId);
      if (a?.pointsPossible) { totalEarned += s.score; totalPossible += a.pointsPossible; }
    });
    const courseAvg = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : null;

    return submissions
      .filter(s => {
        if (s.score === null || s.score === undefined) return false;
        const gradedDate = s.gradedAt || s.submittedAt;
        if (!gradedDate) return false;
        return new Date(gradedDate) >= weekAgo;
      })
      .map(s => {
        const a = assignments.find(x => x.id === s.assignmentId);
        if (!a || !a.pointsPossible) return null;
        const scorePct = Math.round((s.score! / a.pointsPossible) * 100);
        const daysAgo = Math.floor((now.getTime() - new Date(s.gradedAt || s.submittedAt!).getTime()) / (1000 * 60 * 60 * 24));
        return {
          assignment: a,
          submission: s,
          scorePct,
          isLow: courseAvg !== null && scorePct < courseAvg - 10,
          isHigh: courseAvg !== null && scorePct > courseAvg + 10,
          daysAgo,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.daysAgo - b!.daysAgo) as RecentGrade[];
  }, [assignments, submissions]);

  const handleDebrief = async (rg: RecentGrade) => {
    const id = rg.assignment.id;
    if (debrief[id]) return; // already generated

    setLoading(id);
    setError(null);
    try {
      const shortName = (() => {
        const n = course.name || '';
        const after = n.includes(':') ? n.split(':').slice(1).join(':').trim() : n;
        return after.replace(/^(AP|IB|Honors|Accelerated) /i, '').trim();
      })();

      // Build context
      const remaining = assignments.filter(a => {
        const sub = submissions.find(s => s.assignmentId === a.id);
        return !sub?.submittedAt && (sub?.score === null || sub?.score === undefined) && a.pointsPossible > 0;
      });
      const remainingCount = remaining.length;
      const remainingPts = remaining.reduce((s, a) => s + a.pointsPossible, 0);

      const groupName = rg.assignment.assignmentGroupName || 'Unknown';
      const groupWeight = rg.assignment.assignmentGroupWeight || 0;

      const prompt = `Course: ${shortName} (current grade: ${course.currentGrade !== null ? `${course.currentGrade}%` : 'unknown'})
Assignment: "${rg.assignment.name}"
Score: ${rg.submission.score}/${rg.assignment.pointsPossible} (${rg.scorePct}%)
Category: ${groupName} (${groupWeight}% of grade)
Remaining: ${remainingCount} assignments, ${remainingPts} total points
${rg.submission.late ? 'This was submitted late.' : ''}`;

      const response = await callClaude(
        prompt,
        `You debrief students on grades they just got back. In 3-4 sentences: explain the actual impact on their course grade (did it drop or rise, by how much), what they need on remaining work to recover or maintain, and whether this category (with its weight) makes this grade hurt more or less than it looks. If the score is high, acknowledge it but still tell them what it means for maintaining their grade. Be specific with numbers. No bullets. Second person.`,
        350
      );

      setDebrief(prev => ({ ...prev, [id]: response.trim() }));
    } catch (err: any) {
      setError(err?.message?.includes('429') ? 'AI is busy — try again in a minute.' : 'Could not generate debrief.');
    } finally {
      setLoading(null);
    }
  };

  if (recentGrades.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recently graded</p>
      {recentGrades.slice(0, 5).map(rg => {
        const id = rg.assignment.id;
        const hasDebrief = !!debrief[id];
        const isLoading = loading === id;

        return (
          <div key={id} className="rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => handleDebrief(rg)}
              disabled={isLoading}
              className="w-full text-left px-3 py-2.5 hover:bg-accent/20 transition-colors cursor-pointer flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{rg.assignment.name}</p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span className={`font-bold ${getGradeColor(rg.scorePct)}`}>
                    {rg.submission.score}/{rg.assignment.pointsPossible}
                  </span>
                  <span>·</span>
                  <span className={getGradeColor(rg.scorePct)}>{rg.scorePct}%</span>
                  {rg.assignment.assignmentGroupName && (
                    <><span>·</span><span>{rg.assignment.assignmentGroupName}</span></>
                  )}
                  <span>·</span>
                  <span>{rg.daysAgo === 0 ? 'today' : rg.daysAgo === 1 ? 'yesterday' : `${rg.daysAgo}d ago`}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {rg.isLow && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                {rg.isHigh && <TrendingUp className="h-3.5 w-3.5 text-green-500" />}
                {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                {!hasDebrief && !isLoading && (
                  <span className="text-[10px] text-muted-foreground">Tap to debrief</span>
                )}
              </div>
            </button>

            {hasDebrief && (
              <div className="px-3 pb-3 pt-1 border-t border-border">
                <p className="text-xs text-muted-foreground leading-relaxed">{debrief[id]}</p>
              </div>
            )}

            {error && loading === null && (
              <div className="px-3 pb-2">
                <p className="text-xs text-red-500">{error}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

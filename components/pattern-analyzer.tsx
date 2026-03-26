'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, BarChart3 } from 'lucide-react';
import { callClaude } from '@/lib/aiUtils';
import { getGradeColor } from '@/lib/gradeUtils';
import type { Assignment, Submission } from '@/lib/types';

interface PatternAnalyzerProps {
  courseName: string;
  assignments: Assignment[];
  submissions: Submission[];
  currentGrade: number | null;
  dismissedMissing: Set<string>;
}

interface CategoryStats {
  name: string;
  weight: number;
  graded: number;
  totalPts: number;
  earned: number;
  avgPct: number;
  remaining: number;
  remainingPts: number;
}

export function PatternAnalyzer({
  courseName,
  assignments,
  submissions,
  currentGrade,
  dismissedMissing,
}: PatternAnalyzerProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const submissionMap = useMemo(() =>
    new Map(submissions.map(s => [s.assignmentId, s])),
    [submissions]
  );

  // Build category stats from assignment groups
  const categories = useMemo((): CategoryStats[] => {
    const groups = new Map<string, CategoryStats>();

    for (const a of assignments) {
      if (!a.pointsPossible) continue;
      const groupId = a.assignmentGroupId || 'ungrouped';
      const groupName = a.assignmentGroupName || 'Other';
      const weight = a.assignmentGroupWeight || 0;

      if (!groups.has(groupId)) {
        groups.set(groupId, {
          name: groupName,
          weight,
          graded: 0,
          totalPts: 0,
          earned: 0,
          avgPct: 0,
          remaining: 0,
          remainingPts: 0,
        });
      }

      const g = groups.get(groupId)!;
      const sub = submissionMap.get(a.id);
      const isDismissed = dismissedMissing.has(a.id);

      if (sub?.score !== null && sub?.score !== undefined) {
        g.graded++;
        g.totalPts += a.pointsPossible;
        g.earned += sub.score;
      } else if (!sub?.excused && !isDismissed) {
        g.remaining++;
        g.remainingPts += a.pointsPossible;
      }
    }

    // Compute averages
    for (const g of groups.values()) {
      g.avgPct = g.totalPts > 0 ? Math.round((g.earned / g.totalPts) * 100) : 0;
    }

    return Array.from(groups.values())
      .filter(g => g.graded >= 1)
      .sort((a, b) => a.avgPct - b.avgPct); // worst first
  }, [assignments, submissions, dismissedMissing, submissionMap]);

  const handleAnalyze = async () => {
    if (categories.length < 2) return;

    setLoading(true);
    setError(null);
    try {
      const shortName = (() => {
        const n = courseName || '';
        const after = n.includes(':') ? n.split(':').slice(1).join(':').trim() : n;
        return after.replace(/^(AP|IB|Honors|Accelerated) /i, '').trim();
      })();

      const catLines = categories.map(c =>
        `${c.name} (${c.weight}% of grade): ${c.graded} graded, avg ${c.avgPct}%, earned ${c.earned}/${c.totalPts}pts${c.remaining > 0 ? `, ${c.remaining} remaining (${c.remainingPts}pts)` : ''}`
      ).join('\n');

      const response = await callClaude(
        `Course: ${shortName}\nCurrent grade: ${currentGrade !== null ? `${currentGrade}%` : 'unknown'}\n\nCategory breakdown:\n${catLines}`,
        `You analyze a student's grade patterns by category. Look at the data and provide 3-4 specific insights. For each insight, be concrete and include a projection. Format as a single paragraph per insight, separated by newlines. Examples of good insights:
- "Your Labs average (72%) is dragging your grade down. Labs are 30% of your grade. If you brought your lab average up to 85% on the remaining 3 labs, your course grade would rise from 79% to roughly 83% — that's a B- to B."
- "Your Quiz average (94%) is your strongest category but it's only 10% of your grade. The time you spend over-preparing for quizzes would be better spent on Essays (25% weight, 71% avg)."
- "You're at 89.2% — just 0.8% from an A-. One strong performance on the next Exam could push you over."
Be direct, use numbers, reference the actual category names and weights. No bullet points, no headers. Each insight is its own paragraph. Keep total under 200 words.`,
        500
      );

      setInsight(response.trim());
      setHasGenerated(true);
    } catch (err: any) {
      setError(err?.message?.includes('429') ? 'AI is busy — try again in a minute.' : 'Could not analyze. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // Need at least 2 categories with graded work
  if (categories.length < 2) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Pattern Analyzer
          </CardTitle>
          {hasGenerated && (
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {loading ? 'Analyzing...' : 'Refresh'}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Category bars — always visible */}
        <div className="space-y-2">
          {categories.map((c, i) => {
            const barWidth = Math.max(5, c.avgPct);
            return (
              <div key={i} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {c.name}
                    {c.weight > 0 && <span className="ml-1 text-[10px]">({c.weight}%)</span>}
                  </span>
                  <span className={`font-bold ${getGradeColor(c.avgPct)}`}>{c.avgPct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${c.avgPct >= 85 ? 'bg-green-500' : c.avgPct >= 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{c.graded} graded · {c.earned}/{c.totalPts} pts</span>
                  {c.remaining > 0 && <span>{c.remaining} remaining</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* AI insight */}
        {!hasGenerated ? (
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-border hover:bg-accent/30 transition-colors cursor-pointer text-xs text-muted-foreground hover:text-foreground"
          >
            {loading ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Analyzing patterns...</>
            ) : (
              'Analyze my grade patterns'
            )}
          </button>
        ) : error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : insight && (
          <div className="space-y-2 pt-2 border-t border-border">
            {insight.split('\n').filter(Boolean).map((paragraph, i) => (
              <p key={i} className="text-xs text-muted-foreground leading-relaxed">{paragraph}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

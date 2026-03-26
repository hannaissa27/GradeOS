'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Clock } from 'lucide-react';
import { callClaude } from '@/lib/aiUtils';
import { getGradeColor } from '@/lib/gradeUtils';
import type { Assignment, Submission } from '@/lib/types';

interface ProcrastinationDetectorProps {
  assignments: Assignment[];
  submissions: Submission[];
}

interface TimingBucket {
  label: string;
  count: number;
  avgScore: number | null;
  color: string;
  pct: number;
}

export function ProcrastinationDetector({ assignments, submissions }: ProcrastinationDetectorProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analysis = useMemo(() => {
    const graded = submissions.filter(s =>
      s.score !== null && s.submittedAt
    );

    if (graded.length < 5) return null;

    // Categorize by hours before deadline
    const buckets = {
      lastMinute: { count: 0, totalScore: 0, totalPossible: 0 }, // < 6 hours
      sameDay: { count: 0, totalScore: 0, totalPossible: 0 },    // 6-24 hours
      dayBefore: { count: 0, totalScore: 0, totalPossible: 0 },  // 24-48 hours
      early: { count: 0, totalScore: 0, totalPossible: 0 },      // > 48 hours
    };

    graded.forEach(s => {
      const a = assignments.find(x => x.id === s.assignmentId);
      if (!a?.dueDate || !a.pointsPossible) return;

      const hoursBefore = (new Date(a.dueDate).getTime() - new Date(s.submittedAt!).getTime()) / (1000 * 60 * 60);
      const bucket =
        hoursBefore < 0 ? buckets.lastMinute : // late = last minute
        hoursBefore < 6 ? buckets.lastMinute :
        hoursBefore < 24 ? buckets.sameDay :
        hoursBefore < 48 ? buckets.dayBefore :
        buckets.early;

      bucket.count++;
      bucket.totalScore += s.score!;
      bucket.totalPossible += a.pointsPossible;
    });

    const total = Object.values(buckets).reduce((s, b) => s + b.count, 0);
    if (total === 0) return null;

    const timingBuckets: TimingBucket[] = [
      {
        label: 'Last minute',
        count: buckets.lastMinute.count,
        avgScore: buckets.lastMinute.totalPossible > 0 ? Math.round((buckets.lastMinute.totalScore / buckets.lastMinute.totalPossible) * 100) : null,
        color: 'bg-red-500',
        pct: Math.round((buckets.lastMinute.count / total) * 100),
      },
      {
        label: 'Same day',
        count: buckets.sameDay.count,
        avgScore: buckets.sameDay.totalPossible > 0 ? Math.round((buckets.sameDay.totalScore / buckets.sameDay.totalPossible) * 100) : null,
        color: 'bg-amber-500',
        pct: Math.round((buckets.sameDay.count / total) * 100),
      },
      {
        label: 'Day before',
        count: buckets.dayBefore.count,
        avgScore: buckets.dayBefore.totalPossible > 0 ? Math.round((buckets.dayBefore.totalScore / buckets.dayBefore.totalPossible) * 100) : null,
        color: 'bg-blue-500',
        pct: Math.round((buckets.dayBefore.count / total) * 100),
      },
      {
        label: 'Early',
        count: buckets.early.count,
        avgScore: buckets.early.totalPossible > 0 ? Math.round((buckets.early.totalScore / buckets.early.totalPossible) * 100) : null,
        color: 'bg-green-500',
        pct: Math.round((buckets.early.count / total) * 100),
      },
    ];

    const rushPct = Math.round(((buckets.lastMinute.count + buckets.sameDay.count) / total) * 100);
    const earlyAvg = buckets.early.totalPossible > 0 ? Math.round((buckets.early.totalScore / buckets.early.totalPossible) * 100) : null;
    const rushAvg = (buckets.lastMinute.totalPossible + buckets.sameDay.totalPossible) > 0
      ? Math.round(((buckets.lastMinute.totalScore + buckets.sameDay.totalScore) / (buckets.lastMinute.totalPossible + buckets.sameDay.totalPossible)) * 100)
      : null;
    const scoreDiff = earlyAvg !== null && rushAvg !== null ? earlyAvg - rushAvg : null;

    return { timingBuckets, rushPct, earlyAvg, rushAvg, scoreDiff, total };
  }, [assignments, submissions]);

  const handleInsight = async () => {
    if (!analysis) return;
    setLoading(true);
    setError(null);
    try {
      const bucketLines = analysis.timingBuckets
        .filter(b => b.count > 0)
        .map(b => `${b.label}: ${b.count} submissions (${b.pct}%)${b.avgScore !== null ? `, avg score ${b.avgScore}%` : ''}`)
        .join('\n');

      const response = await callClaude(
        `My submission timing breakdown (${analysis.total} total):\n${bucketLines}\n\nRush submissions (last minute + same day): ${analysis.rushPct}%\n${analysis.scoreDiff !== null ? `Score difference: early submissions average ${analysis.scoreDiff}% higher than rush submissions` : ''}`,
        `You analyze a student's procrastination pattern using their real submission data. Give ONE paragraph (3-4 sentences max). State their pattern factually using the numbers, then give ONE specific, actionable change they could make. If early submissions score higher, quantify the GPA impact of shifting 2-3 assignments earlier. If there's no score difference, acknowledge that and suggest a different angle. Be direct, no lectures. Second person.`,
        250
      );

      setInsight(response.trim());
    } catch (err: any) {
      setError(err?.message?.includes('429') ? 'AI is busy — try in a minute.' : 'Could not analyze.');
    } finally {
      setLoading(false);
    }
  };

  if (!analysis) return null;

  const maxCount = Math.max(...analysis.timingBuckets.map(b => b.count));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          When you submit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visual bars */}
        <div className="space-y-3">
          {analysis.timingBuckets.filter(b => b.count > 0).map(bucket => (
            <div key={bucket.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{bucket.label}</span>
                <div className="flex items-center gap-2">
                  {bucket.avgScore !== null && (
                    <span className={`font-medium ${getGradeColor(bucket.avgScore)}`}>{bucket.avgScore}% avg</span>
                  )}
                  <span className="text-muted-foreground w-8 text-right">{bucket.pct}%</span>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${bucket.color} transition-all`}
                  style={{ width: `${maxCount > 0 ? (bucket.count / maxCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Headline stat */}
        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40">
          <span className="text-xs text-muted-foreground">Rush submissions</span>
          <span className={`text-sm font-bold ${analysis.rushPct > 50 ? 'text-red-500' : analysis.rushPct > 30 ? 'text-amber-500' : 'text-green-500'}`}>
            {analysis.rushPct}%
          </span>
        </div>
        {analysis.scoreDiff !== null && analysis.scoreDiff > 3 && (
          <p className="text-xs text-muted-foreground text-center">
            You score <span className="font-medium text-foreground">{analysis.scoreDiff}% higher</span> when you start early
          </p>
        )}

        {/* AI insight */}
        {!insight ? (
          <button
            onClick={handleInsight}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-border hover:bg-accent/30 transition-colors cursor-pointer text-xs text-muted-foreground hover:text-foreground"
          >
            {loading ? <><Loader2 className="h-3 w-3 animate-spin" /> Analyzing...</> : 'What does this mean for my grades?'}
          </button>
        ) : error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed">{insight}</p>
        )}
      </CardContent>
    </Card>
  );
}

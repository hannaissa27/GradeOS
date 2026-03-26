'use client';

import React, { useState, useMemo } from 'react';
import { Loader2, AlertTriangle, Calendar } from 'lucide-react';
import { callClaude } from '@/lib/aiUtils';
import { courseColor, minutesToLabel, gradeToLetter } from '@/lib/gradeUtils';
import type { Course, Assignment, Submission } from '@/lib/types';

interface CollisionDetectorProps {
  courses: Course[];
  allAssignments: Assignment[];
  allSubmissions: Submission[];
  effortEstimates: Record<string, number>;
  dismissedMissing: Set<string>;
}

interface Cluster {
  label: string;
  date: Date;
  assignments: (Assignment & { courseName: string; effort: number; gradeWeight: number })[];
  totalEffort: number;
}

export function CollisionDetector({
  courses,
  allAssignments,
  allSubmissions,
  effortEstimates,
  dismissedMissing,
}: CollisionDetectorProps) {
  const [triagePlan, setTriagePlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submissionMap = useMemo(() =>
    new Map(allSubmissions.map(s => [s.assignmentId, s])),
    [allSubmissions]
  );

  // Find clusters: days with 2+ assignments due within 48 hours
  const clusters = useMemo((): Cluster[] => {
    const now = new Date();
    const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const pending = allAssignments.filter(a => {
      if (!a.dueDate || dismissedMissing.has(a.id)) return false;
      const due = new Date(a.dueDate);
      if (due < now || due > twoWeeks) return false;
      const sub = submissionMap.get(a.id);
      return !sub?.submittedAt && (sub?.score === null || sub?.score === undefined);
    });

    // Group by date (day)
    const dayMap = new Map<string, typeof pending>();
    pending.forEach(a => {
      const day = new Date(a.dueDate!).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day)!.push(a);
    });

    // Also check 48-hour windows — merge adjacent days
    const sortedDays = [...dayMap.entries()].sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
    const merged: Cluster[] = [];

    for (let i = 0; i < sortedDays.length; i++) {
      const [dayStr, dayAssignments] = sortedDays[i];
      const dayDate = new Date(dayStr);
      let clusterAssignments = [...dayAssignments];

      // Check if next day is within 48 hours and also has assignments
      if (i + 1 < sortedDays.length) {
        const nextDate = new Date(sortedDays[i + 1][0]);
        if (nextDate.getTime() - dayDate.getTime() <= 48 * 60 * 60 * 1000) {
          clusterAssignments.push(...sortedDays[i + 1][1]);
          i++; // skip next day since we merged it
        }
      }

      if (clusterAssignments.length >= 2) {
        const enriched = clusterAssignments.map(a => {
          const course = courses.find(c => c.id === a.courseId);
          const shortName = (() => {
            const n = course?.name || a.courseCode || '';
            const after = n.includes(':') ? n.split(':').slice(1).join(':').trim() : n;
            return after.replace(/^(AP|IB|Honors|Accelerated) /i, '').trim();
          })();
          const allCourseAssignments = allAssignments.filter(x => x.courseId === a.courseId);
          const totalCoursePts = allCourseAssignments.reduce((s, x) => s + (x.pointsPossible || 0), 0);
          const gradeWeight = totalCoursePts > 0 ? Math.round((a.pointsPossible / totalCoursePts) * 100) : 0;

          return {
            ...a,
            courseName: shortName,
            effort: effortEstimates[a.id] || 60,
            gradeWeight,
          };
        });

        const totalEffort = enriched.reduce((s, a) => s + a.effort, 0);
        const label = dayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

        merged.push({ label, date: dayDate, assignments: enriched, totalEffort });
      }
    }

    return merged;
  }, [allAssignments, allSubmissions, courses, effortEstimates, dismissedMissing, submissionMap]);

  const handleTriage = async (cluster: Cluster) => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date();
      const daysUntil = Math.ceil((cluster.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      const assignmentLines = cluster.assignments
        .sort((a, b) => b.gradeWeight - a.gradeWeight)
        .map(a => `"${a.name}" (${a.courseName}, ${a.pointsPossible}pts, ~${minutesToLabel(a.effort)}, ${a.gradeWeight}% of course grade)`)
        .join('\n');

      const response = await callClaude(
        `I have ${cluster.assignments.length} assignments due ${cluster.label} (${daysUntil} days from now). Total effort: ~${minutesToLabel(cluster.totalEffort)}.\n\n${assignmentLines}`,
        `You're a student's time strategist. Create a work-back schedule for this collision. In 3-5 sentences: tell them which to start first and when (use specific days like "Start Monday evening"), which is highest priority by grade impact, and if they can only finish some of them, which to skip and why (cite the grade weight). Be direct. No bullets, no headers. Second person.`,
        350
      );

      setTriagePlan(response.trim());
    } catch (err: any) {
      setError(err?.message?.includes('429') ? 'AI is busy — try again in a minute.' : 'Could not generate plan. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (clusters.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
            Due date collision{clusters.length > 1 ? 's' : ''} ahead
          </span>
        </div>

        {clusters.map((cluster, ci) => (
          <div key={ci} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">{cluster.label}</span>
                <span className="text-xs text-muted-foreground">
                  — {cluster.assignments.length} assignments, ~{minutesToLabel(cluster.totalEffort)} total
                </span>
              </div>
            </div>

            <div className="space-y-1">
              {cluster.assignments
                .sort((a, b) => b.gradeWeight - a.gradeWeight)
                .map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-background/50">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: courseColor(a.courseId) }} />
                    <span className="truncate flex-1">{a.name}</span>
                    <span className="text-muted-foreground flex-shrink-0">{a.courseName}</span>
                    <span className="text-muted-foreground flex-shrink-0">~{minutesToLabel(a.effort)}</span>
                    <span className="font-medium flex-shrink-0 text-amber-600 dark:text-amber-400">{a.gradeWeight}%</span>
                  </div>
                ))}
            </div>

            {!triagePlan ? (
              <button
                onClick={() => handleTriage(cluster)}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-amber-500/30 hover:bg-amber-500/10 transition-colors cursor-pointer text-xs font-medium text-amber-600 dark:text-amber-400"
              >
                {loading ? <><Loader2 className="h-3 w-3 animate-spin" /> Building triage plan...</> : 'Build triage plan'}
              </button>
            ) : (
              <div className="rounded-lg bg-background/80 border border-border p-3">
                {error ? (
                  <p className="text-xs text-red-500">{error}</p>
                ) : (
                  <p className="text-xs text-muted-foreground leading-relaxed">{triagePlan}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

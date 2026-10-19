'use client';

import React, { useState, useMemo } from 'react';
import { Loader2, AlertTriangle, ChevronDown } from 'lucide-react';
import { callClaude, aiErrorMessage } from '@/lib/aiUtils';
import { courseColor, minutesToLabel } from '@/lib/gradeUtils';
import type { Course, Assignment, Submission } from '@/lib/types';

interface CollisionDetectorProps {
  courses: Course[];
  allAssignments: Assignment[];
  allSubmissions: Submission[];
  effortEstimates: Record<string, number>;
  dismissedMissing: Set<string>;
}

interface Cluster {
  key: string;
  label: string;
  date: Date;
  assignments: (Assignment & { courseName: string; effort: number; gradeWeight: number })[];
  totalEffort: number;
}

interface TriageState {
  loading: boolean;
  plan: string | null;
  error: string | null;
}

export function CollisionDetector({
  courses,
  allAssignments,
  allSubmissions,
  effortEstimates,
  dismissedMissing,
}: CollisionDetectorProps) {
  // State is keyed per cluster so that acting on one box never affects the others.
  const [triage, setTriage] = useState<Record<string, TriageState>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

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

    const dayMap = new Map<string, typeof pending>();
    pending.forEach(a => {
      const d = new Date(a.dueDate!);
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day)!.push(a);
    });

    const sortedDays = [...dayMap.entries()].sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
    const merged: Cluster[] = [];

    for (let i = 0; i < sortedDays.length; i++) {
      const [dayStr, dayAssignments] = sortedDays[i];
      const dayDate = new Date(dayStr);
      const clusterAssignments = [...dayAssignments];

      if (i + 1 < sortedDays.length) {
        const nextDate = new Date(sortedDays[i + 1][0]);
        if (nextDate.getTime() - dayDate.getTime() <= 48 * 60 * 60 * 1000) {
          clusterAssignments.push(...sortedDays[i + 1][1]);
          i++;
        }
      }

      if (clusterAssignments.length >= 2) {
        const enriched = clusterAssignments.map(a => {
          const course = courses.find(c => c.id === a.courseId);
          const n = course?.name || a.courseCode || '';
          const after = n.includes(':') ? n.split(':').slice(1).join(':').trim() : n;
          const shortName = after.replace(/^(AP|IB|Honors|Accelerated) /i, '').trim();
          const allCourseAssignments = allAssignments.filter(x => x.courseId === a.courseId);
          const totalCoursePts = allCourseAssignments.reduce((s, x) => s + (x.pointsPossible || 0), 0);
          const gradeWeight = totalCoursePts > 0 ? Math.round((a.pointsPossible / totalCoursePts) * 100) : 0;
          return { ...a, courseName: shortName, effort: effortEstimates[a.id] || 60, gradeWeight };
        }).sort((a, b) => b.gradeWeight - a.gradeWeight);

        const totalEffort = enriched.reduce((s, a) => s + a.effort, 0);
        const label = dayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        merged.push({ key: dayStr, label, date: dayDate, assignments: enriched, totalEffort });
      }
    }

    return merged;
  }, [allAssignments, courses, effortEstimates, dismissedMissing, submissionMap]);

  const handleTriage = async (cluster: Cluster) => {
    const key = cluster.key;
    setTriage(prev => ({ ...prev, [key]: { loading: true, plan: prev[key]?.plan ?? null, error: null } }));
    try {
      const daysUntil = Math.ceil((cluster.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const assignmentLines = cluster.assignments
        .map(a => `"${a.name}" (${a.courseName}, ${a.pointsPossible}pts, ~${minutesToLabel(a.effort)}, ${a.gradeWeight}% of course grade)`)
        .join('\n');

      const response = await callClaude(
        `I have ${cluster.assignments.length} assignments due ${cluster.label} (${daysUntil} days from now). Total effort: ~${minutesToLabel(cluster.totalEffort)}.\n\n${assignmentLines}`,
        `You're a student's time strategist. Create a work-back schedule for this collision. In 3-5 sentences: tell them which to start first and when (use specific days like "Start Monday evening"), which is highest priority by grade impact, and if they can only finish some of them, which to skip and why (cite the grade weight). Be direct. No bullets, no headers. Second person.`,
        350
      );
      setTriage(prev => ({ ...prev, [key]: { loading: false, plan: response.trim(), error: null } }));
    } catch (err) {
      setTriage(prev => ({ ...prev, [key]: { loading: false, plan: null, error: aiErrorMessage(err, 'Could not generate plan. Try again.') } }));
    }
  };

  if (clusters.length === 0) return null;

  const totalAssignments = clusters.reduce((s, c) => s + c.assignments.length, 0);

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5">
      <div className="px-4 py-2.5 flex items-center gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
        <span className="font-medium text-amber-700 dark:text-amber-400">
          {clusters.length === 1 ? 'Busy day ahead' : `${clusters.length} busy days ahead`}
        </span>
        <span className="text-xs text-muted-foreground">— {totalAssignments} assignments land close together</span>
      </div>

      <div className="divide-y divide-amber-500/15 border-t border-amber-500/15">
        {clusters.map(cluster => {
          const state = triage[cluster.key];
          const isOpen = expanded === cluster.key;
          return (
            <div key={cluster.key}>
              <button
                onClick={() => setExpanded(isOpen ? null : cluster.key)}
                className="w-full px-4 py-2 flex items-center justify-between text-xs hover:bg-amber-500/5 transition-colors cursor-pointer"
              >
                <span className="font-medium">{cluster.label}</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {cluster.assignments.length} due · ~{minutesToLabel(cluster.totalEffort)}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>

              {isOpen && (
                <div className="px-4 pb-3 space-y-2">
                  <div className="space-y-1">
                    {cluster.assignments.map(a => (
                      <div key={a.id} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-background/60">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: courseColor(a.courseId) }} />
                        <span className="truncate flex-1">{a.name}</span>
                        <span className="text-muted-foreground flex-shrink-0 hidden sm:inline">{a.courseName}</span>
                        <span className="text-muted-foreground flex-shrink-0">~{minutesToLabel(a.effort)}</span>
                        <span className="font-medium flex-shrink-0 text-amber-700 dark:text-amber-400">{a.gradeWeight}%</span>
                      </div>
                    ))}
                  </div>

                  {state?.plan ? (
                    <div className="rounded-lg bg-background/80 border border-border p-3 space-y-2">
                      <p className="text-xs text-muted-foreground leading-relaxed">{state.plan}</p>
                      <button
                        onClick={() => handleTriage(cluster)}
                        disabled={state.loading}
                        className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                      >
                        {state.loading ? 'Refreshing…' : 'Regenerate'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <button
                        onClick={() => handleTriage(cluster)}
                        disabled={state?.loading}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-amber-500/30 hover:bg-amber-500/10 transition-colors cursor-pointer text-xs font-medium text-amber-700 dark:text-amber-400 disabled:opacity-60"
                      >
                        {state?.loading
                          ? <><Loader2 className="h-3 w-3 animate-spin" /> Building plan…</>
                          : 'Plan this with AI'}
                      </button>
                      {state?.error && <p className="text-xs text-red-500">{state.error}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

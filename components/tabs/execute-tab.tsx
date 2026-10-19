'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { LiveGradeCard, LiveGradeCardSkeleton } from '@/components/live-grade-card';
import { PriorityStack } from '@/components/priority-stack';
import { WeeklyBrief } from '@/components/weekly-brief';
import { GradeImpactAdvisor } from '@/components/grade-impact-advisor';
import { CollisionDetector } from '@/components/collision-detector';
import { AlertCircle } from 'lucide-react';
import { GradeAutopsy } from '@/components/grade-autopsy';
import { batchEstimateEffort, getDismissedMissing, getIgnoredAssignments } from '@/lib/aiUtils';
import type { Course, Assignment, Submission } from '@/lib/types';

interface ExecuteTabProps {
  courses: Course[];
  allAssignments: Assignment[];
  allSubmissions: Submission[];
  isLoading: boolean;
  error: string | null;
  onSelectCourse?: (courseId: string) => void;
  onRetry: () => void;
  getAssignmentsForCourse: (courseId: string) => Assignment[];
  getSubmissionsForCourse: (courseId: string) => Submission[];
}

export function ExecuteTab({
  courses,
  allAssignments,
  allSubmissions,
  isLoading,
  error,
  onSelectCourse,
  onRetry,
  getAssignmentsForCourse,
  getSubmissionsForCourse,
}: ExecuteTabProps) {
  const [effortEstimates, setEffortEstimates] = useState<Record<string, number>>({});
  const [dismissedMissing, setDismissedMissing] = useState<Set<string>>(new Set());
  const [ignoredAssignments, setIgnoredAssignments] = useState<Set<string>>(() => getIgnoredAssignments());

  const submissionMap = useMemo(() =>
    new Map(allSubmissions.map(s => [s.assignmentId, s])),
    [allSubmissions]
  );

  // Assignments visible to AI (excluded ignored ones)
  const aiAssignments = useMemo(() =>
    allAssignments.filter(a => !ignoredAssignments.has(a.id)),
    [allAssignments, ignoredAssignments]
  );

  useEffect(() => {
    setDismissedMissing(getDismissedMissing());
  }, []);

  // Batch estimate effort for all pending non-ignored assignments — ONE AI call
  useEffect(() => {
    if (aiAssignments.length === 0) return;

    const pending = aiAssignments.filter(a => {
      const sub = submissionMap.get(a.id);
      return !sub?.submittedAt && (sub?.score === null || sub?.score === undefined) && !sub?.excused;
    });

    if (pending.length === 0) return;

    let cancelled = false;
    batchEstimateEffort(pending)
      .then(est => { if (!cancelled) setEffortEstimates(est); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [aiAssignments, submissionMap]);

  const handleDismissMissingChange = () => setDismissedMissing(getDismissedMissing());
  const handleIgnoredChange = () => setIgnoredAssignments(getIgnoredAssignments());

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <AlertCircle className="h-6 w-6 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <button onClick={onRetry} className="text-xs underline text-muted-foreground hover:text-foreground cursor-pointer">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!isLoading && !error && courses.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-center">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">No courses found.</p>
          <button onClick={onRetry} className="text-xs underline text-muted-foreground hover:text-foreground cursor-pointer">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const hasEstimates = Object.keys(effortEstimates).length > 0;

  return (
    <div className="space-y-6">
      {/* Grades — the headline */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {isLoading
          ? [...Array(4)].map((_, i) => <LiveGradeCardSkeleton key={i} />)
          : courses.map((course) => (
              <LiveGradeCard
                key={course.id}
                course={course}
                assignments={getAssignmentsForCourse(course.id)}
                submissions={getSubmissionsForCourse(course.id)}
                dismissedMissing={dismissedMissing}
                onClick={() => onSelectCourse?.(course.id)}
              />
            ))}
      </section>

      {/* Heads-up: deadlines that land together */}
      {!isLoading && hasEstimates && (
        <CollisionDetector
          courses={courses}
          allAssignments={aiAssignments}
          allSubmissions={allSubmissions}
          effortEstimates={effortEstimates}
          dismissedMissing={dismissedMissing}
        />
      )}

      {/* AI insights — one quiet card, each tool is a single row until you open it */}
      {!isLoading && (
        <section className="rounded-xl border border-border bg-card divide-y divide-border">
          <WeeklyBrief
            courses={courses}
            allAssignments={aiAssignments}
            allSubmissions={allSubmissions}
          />
          {hasEstimates && (
            <GradeImpactAdvisor
              courses={courses}
              allAssignments={aiAssignments}
              allSubmissions={allSubmissions}
              effortEstimates={effortEstimates}
              dismissedMissing={dismissedMissing}
            />
          )}
          <GradeAutopsy
            courses={courses}
            allAssignments={allAssignments}
            allSubmissions={allSubmissions}
          />
        </section>
      )}

      {/* Assignments */}
      <PriorityStack
        assignments={allAssignments}
        submissions={allSubmissions}
        courses={courses}
        isLoading={isLoading}
        effortEstimates={effortEstimates}
        dismissedMissing={dismissedMissing}
        onDismissedMissingChange={handleDismissMissingChange}
        onIgnoredChange={handleIgnoredChange}
      />
    </div>
  );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { LiveGradeCard, LiveGradeCardSkeleton } from '@/components/live-grade-card';
import { PriorityStack } from '@/components/priority-stack';
import { WeeklyBrief } from '@/components/weekly-brief';
import { GradeImpactAdvisor } from '@/components/grade-impact-advisor';
import { CollisionDetector } from '@/components/collision-detector';
import { AlertCircle } from 'lucide-react';
import { GradeAutopsy } from '@/components/grade-autopsy';
import { batchEstimateEffort, getDismissedMissing } from '@/lib/aiUtils';
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

  const submissionMap = useMemo(() =>
    new Map(allSubmissions.map(s => [s.assignmentId, s])),
    [allSubmissions]
  );

  // Load dismissed missing on mount
  useEffect(() => {
    setDismissedMissing(getDismissedMissing());
  }, []);

  // Batch estimate effort for all pending assignments — ONE AI call
  useEffect(() => {
    if (allAssignments.length === 0) return;

    const pending = allAssignments.filter(a => {
      const sub = submissionMap.get(a.id);
      return !sub?.submittedAt && (sub?.score === null || sub?.score === undefined) && !sub?.excused;
    });

    if (pending.length === 0) return;

    batchEstimateEffort(pending)
      .then(setEffortEstimates)
      .catch(() => {});
  }, [allAssignments, submissionMap]);

  // Callback for when missing is dismissed in a child
  const handleDismissMissingChange = () => {
    setDismissedMissing(getDismissedMissing());
  };

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

  return (
    <div className="space-y-5">
      {/* AI Weekly Brief */}
      {!isLoading && (
        <WeeklyBrief
          courses={courses}
          allAssignments={allAssignments}
          allSubmissions={allSubmissions}
        />
      )}

      {/* Due Date Collisions */}
      {!isLoading && Object.keys(effortEstimates).length > 0 && (
        <CollisionDetector
          courses={courses}
          allAssignments={allAssignments}
          allSubmissions={allSubmissions}
          effortEstimates={effortEstimates}
          dismissedMissing={dismissedMissing}
        />
      )}

      {/* Grade cards */}
      <div>
        <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Your grades right now — click any course for details</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
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
        </div>
      </div>

      {/* Grade Autopsy */}
      {!isLoading && (
        <GradeAutopsy
          courses={courses}
          allAssignments={allAssignments}
          allSubmissions={allSubmissions}
        />
      )}

      {/* Grade Impact Advisor — cross-course optimization */}
      {!isLoading && Object.keys(effortEstimates).length > 0 && (
        <GradeImpactAdvisor
          courses={courses}
          allAssignments={allAssignments}
          allSubmissions={allSubmissions}
          effortEstimates={effortEstimates}
          dismissedMissing={dismissedMissing}
        />
      )}

      {/* Assignments — sorted by priority, uses AI effort estimates */}
      <PriorityStack
        assignments={allAssignments}
        submissions={allSubmissions}
        courses={courses}
        isLoading={isLoading}
        effortEstimates={effortEstimates}
        dismissedMissing={dismissedMissing}
        onDismissedMissingChange={handleDismissMissingChange}
      />
    </div>
  );
}

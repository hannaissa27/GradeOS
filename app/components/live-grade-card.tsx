'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getGradeColor, gradeToLetter, formatDueDate, computeCurrentGrade, getSemesterStart } from '@/lib/gradeUtils';
import type { Course, Assignment, Submission } from '@/lib/types';

interface LiveGradeCardProps {
  course: Course;
  assignments: Assignment[];
  submissions: Submission[];
  onClick?: () => void;
}

// Shorten course name for the card — remove course code prefix if it's in the name
function shortName(course: Course): string {
  // e.g. "ARA 301: Arabic Lingual & Literary Studies" -> "Arabic"
  // e.g. "PHY 401: Accelerated Physics" -> "Physics"
  // e.g. "MCT 501: AP Calculus AB" -> "Calculus AB"
  const name = course.name;
  // Strip "CODE: " prefix
  const afterColon = name.includes(':') ? name.split(':').slice(1).join(':').trim() : name;
  // Strip AP/IB/Honors prefix
  const stripped = afterColon.replace(/^(AP|IB|Honors|Accelerated)\s+/i, '').trim();
  // Take first 2 meaningful words
  const words = stripped.split(' ').filter(Boolean);
  return words.slice(0, 2).join(' ');
}

export function LiveGradeCard({ course, assignments, submissions, onClick }: LiveGradeCardProps) {
  const submissionMap = new Map(submissions.map(s => [s.assignmentId, s]));

  const missingCount = assignments.filter(a => {
    const sub = submissionMap.get(a.id);
    return sub?.missing && !sub?.submittedAt;
  }).length;

  const nextDue = assignments
    .filter(a => {
      const sub = submissionMap.get(a.id);
      return !sub?.submittedAt && (sub?.score === null || sub?.score === undefined) && a.dueDate && new Date(a.dueDate) > new Date();
    })
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0];

  const semesterStart = new Date(getSemesterStart());
  const grade = computeCurrentGrade(assignments, submissions, semesterStart) ?? course.currentGrade;
  const gradeColor = getGradeColor(grade);

  return (
    <button
      className="text-left w-full rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors cursor-pointer p-3 group"
      onClick={onClick}
    >
      {/* Course name — prominently, not the number */}
      <p className="text-xs text-muted-foreground truncate mb-1">{shortName(course)}</p>

      {/* Grade */}
      <div className="flex items-baseline justify-between">
        {grade !== null ? (
          <>
            <span className={`text-xl font-semibold ${gradeColor}`} data-grade="true">
              {grade}%
            </span>
            <span className={`text-xs ${gradeColor}`} data-grade="true">
              {gradeToLetter(grade)}
            </span>
          </>
        ) : (
          <span className="text-xl font-semibold text-muted-foreground">N/A</span>
        )}
      </div>

      {/* Thin progress bar */}
      <div className="h-px w-full bg-border mt-2 mb-1.5 overflow-hidden rounded-full">
        {grade !== null && (
          <div
            className="h-full bg-muted-foreground/40 transition-all"
            style={{ width: `${Math.min(grade, 100)}%` }}
          />
        )}
      </div>

      {/* Sub-info */}
      <div className="text-xs text-muted-foreground space-y-0.5">
        {nextDue && <p className="truncate">{formatDueDate(nextDue.dueDate)}</p>}
        {missingCount > 0 && (
          <p className="text-red-500">{missingCount} missing</p>
        )}
      </div>
    </button>
  );
}

export function LiveGradeCardSkeleton() {
  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-px w-full" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

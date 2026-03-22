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

function getShortName(course: Course): string {
  const name = course.name;
  const afterColon = name.includes(':') ? name.split(':').slice(1).join(':').trim() : name;
  const stripped = afterColon.replace(/^(AP|IB|Honors|Accelerated)\s+/i, '').trim();
  const words = stripped.split(' ').filter(Boolean);
  // Max 3 words to fit in card
  return words.slice(0, 3).join(' ');
}

function getLetterBg(grade: number | null): string {
  if (grade === null) return 'bg-muted text-muted-foreground';
  if (grade >= 90) return 'bg-green-500/15 text-green-600 dark:text-green-400';
  if (grade >= 80) return 'bg-blue-500/15 text-blue-600 dark:text-blue-400';
  if (grade >= 70) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
  return 'bg-red-500/15 text-red-600 dark:text-red-400';
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
      return !sub?.submittedAt && (sub?.score === null || sub?.score === undefined)
        && a.dueDate && new Date(a.dueDate) > new Date();
    })
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0];

  const semesterStart = new Date(getSemesterStart());
  const grade = computeCurrentGrade(assignments, submissions, semesterStart) ?? course.currentGrade;
  const letter = gradeToLetter(grade);
  const gradeColor = getGradeColor(grade);
  const letterBg = getLetterBg(grade);
  const shortName = getShortName(course);

  // Days until next due
  const daysUntil = nextDue?.dueDate
    ? Math.ceil((new Date(nextDue.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <button
      className="text-left w-full rounded-xl border border-border bg-card hover:bg-accent/20 transition-all cursor-pointer p-4 group relative overflow-hidden"
      onClick={onClick}
      title={`${course.name} — click for details`}
    >
      {/* Course name */}
      <p className="text-xs text-muted-foreground truncate mb-2 font-medium">{shortName}</p>

      {/* Grade + letter side by side */}
      <div className="flex items-end justify-between mb-2">
        <span className={`text-3xl font-bold leading-none ${gradeColor}`} data-grade="true">
          {grade !== null ? `${grade}%` : 'N/A'}
        </span>
        {letter && (
          <span className={`text-sm font-bold px-2 py-0.5 rounded-md ${letterBg}`}>
            {letter}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-border rounded-full overflow-hidden mb-2">
        {grade !== null && (
          <div
            className={`h-full rounded-full transition-all ${grade >= 90 ? 'bg-green-500' : grade >= 80 ? 'bg-blue-500' : grade >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(grade, 100)}%` }}
          />
        )}
      </div>

      {/* Sub-info */}
      <div className="space-y-0.5">
        {nextDue && daysUntil !== null && (
          <p className="text-xs text-muted-foreground truncate">
            {daysUntil === 0 ? 'Due today —' : daysUntil === 1 ? 'Due tomorrow:' : `Due in ${daysUntil}d:`}{' '}
            <span className="text-foreground">{nextDue.name}</span>
          </p>
        )}
        {missingCount > 0 && (
          <p className="text-xs font-medium text-red-500">
            {missingCount} missing assignment{missingCount !== 1 ? 's' : ''}
          </p>
        )}
        {!nextDue && missingCount === 0 && (
          <p className="text-xs text-green-600 dark:text-green-400">All caught up</p>
        )}
      </div>

      {/* Click hint */}
      <p className="text-[10px] text-muted-foreground/60 mt-2 group-hover:text-muted-foreground transition-colors">
        Tap for details →
      </p>
    </button>
  );
}

export function LiveGradeCardSkeleton() {
  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <Skeleton className="h-3 w-20" />
      <div className="flex items-end justify-between">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-6 w-8 rounded-md" />
      </div>
      <Skeleton className="h-1 w-full rounded-full" />
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-2.5 w-16" />
    </div>
  );
}

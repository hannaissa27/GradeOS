'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { getGradeColor, getGradeBackground, gradeToLetter, formatDueDate, computeCurrentGrade, getSemesterStart } from '@/lib/gradeUtils';
import type { Course, Assignment, Submission } from '@/lib/types';

interface LiveGradeCardProps {
  course: Course;
  assignments: Assignment[];
  submissions: Submission[];
  onClick?: () => void;
}

export function LiveGradeCard({ course, assignments, submissions, onClick }: LiveGradeCardProps) {
  // Calculate pending and missing assignments
  const submissionMap = new Map(submissions.map(s => [s.assignmentId, s]));
  const pendingAssignments = assignments.filter(a => {
    const sub = submissionMap.get(a.id);
    return !sub?.submittedAt && a.dueDate && new Date(a.dueDate) > new Date();
  });
  const missingAssignments = assignments.filter(a => {
    const sub = submissionMap.get(a.id);
    return sub?.missing || (!sub?.submittedAt && a.dueDate && new Date(a.dueDate) < new Date());
  });
  
  // Get next due assignment
  const nextDue = pendingAssignments
    .filter(a => a.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0];

  // Compute grade from current semester only, override Canvas's possibly cumulative score
  const semesterStart = new Date(getSemesterStart());
  const grade = computeCurrentGrade(assignments, submissions, semesterStart) ?? course.currentGrade;
  const gradeColorClass = getGradeColor(grade);
  const progressBgClass = getGradeBackground(grade);

  return (
    <Card 
      className="overflow-hidden cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
            {course.code}
          </p>
          <p className="font-medium text-xs leading-tight truncate">
            {course.name}
          </p>
          <div className="flex items-baseline justify-between">
            {grade !== null ? (
              <>
                <span className={`text-2xl font-bold ${gradeColorClass}`} data-grade>
                  {grade}%
                </span>
                <span className={`text-xs font-medium ${gradeColorClass}`} data-grade>
                  {gradeToLetter(grade)}
                </span>
              </>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-2xl font-bold text-muted-foreground cursor-help">N/A</span>
                  </TooltipTrigger>
                  <TooltipContent><p>Grade hidden by instructor</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="h-[2px] w-full bg-muted rounded-full overflow-hidden">
            <div className={`h-full ${progressBgClass}`} style={{ width: `${grade ?? 0}%` }} />
          </div>
          <div className="flex flex-col gap-0.5 text-xs">
            {nextDue && <p className="text-muted-foreground truncate">Next: {formatDueDate(nextDue.dueDate)}</p>}
            {missingAssignments.length > 0 && (
              <p className="text-red-500 font-medium">{missingAssignments.length} missing</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function LiveGradeCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="space-y-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-full" />
          <div className="flex items-baseline justify-between">
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-4 w-6" />
          </div>
          <Skeleton className="h-[3px] w-full" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import React from 'react';
import { LiveGradeCard, LiveGradeCardSkeleton } from '@/components/live-grade-card';
import { PriorityStack } from '@/components/priority-stack';
import { WeeklyBrief } from '@/components/weekly-brief';
import { AlertCircle } from 'lucide-react';
import { GradeAutopsy } from '@/components/grade-autopsy';
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
                  onClick={() => onSelectCourse?.(course.id)}
                />
              ))}
        </div>
      </div>

      {/* Grade Autopsy — auto-detected bombed assignments */}
      {!isLoading && (
        <GradeAutopsy
          courses={courses}
          allAssignments={allAssignments}
          allSubmissions={allSubmissions}
        />
      )}

      {/* Assignments — sorted by priority */}
      <PriorityStack
        assignments={allAssignments}
        submissions={allSubmissions}
        courses={courses}
        isLoading={isLoading}
      />
    </div>
  );
}

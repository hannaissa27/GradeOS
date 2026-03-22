'use client';

import React, { useState, useEffect } from 'react';
import { LiveGradeCard, LiveGradeCardSkeleton } from '@/components/live-grade-card';
import { PriorityStack } from '@/components/priority-stack';
import { CrunchForecast } from '@/components/crunch-forecast';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { HelpTip } from '@/components/help-tip';
import { getAllEffortOverrides } from '@/lib/db-queries';
import { GradeAutopsy } from '@/components/grade-autopsy';
import type { Course, Assignment, Submission, Announcement } from '@/lib/types';

interface ExecuteTabProps {
  courses: Course[];
  allAssignments: Assignment[];
  allSubmissions: Submission[];
  announcements: Announcement[];
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
  const [effortOverrides, setEffortOverrides] = useState<Map<string, number>>(new Map());
  const [trashedIds, setTrashedIds] = useState<Set<string>>(new Set());
  const [crunchOpen, setCrunchOpen] = useState(true);

  useEffect(() => {
    getAllEffortOverrides().then(setEffortOverrides).catch(() => {});
    try {
      const saved = JSON.parse(localStorage.getItem('gradeos-trashed') || '[]');
      setTrashedIds(new Set(saved));
    } catch {}
  }, []);

  const handleEffortSet = (assignmentId: string, minutes: number) => {
    setEffortOverrides(prev => {
      const next = new Map(prev);
      next.set(assignmentId, minutes);
      return next;
    });
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

      {/* Grade Autopsy — auto-detected bombed assignments */}
      {!isLoading && (
        <GradeAutopsy
          courses={courses}
          allAssignments={allAssignments}
          allSubmissions={allSubmissions}
        />
      )}

      {/* Crunch Forecast — collapsible, open by default */}
      {!isLoading && (
        <div className="rounded-lg border border-border">
          <button
            onClick={() => setCrunchOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Crunch Forecast</span>
              <HelpTip text="Shows you the next 14 days as columns. Each assignment sits in the day it's due, sized by how long it takes. When a day has more work than your daily capacity, it turns red — that's a crunch day. Use the suggestions to spread work earlier and avoid last-minute panic." />
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${crunchOpen ? 'rotate-180' : ''}`} />
          </button>
          {crunchOpen && (
            <div className="px-4 pb-4">
              <CrunchForecast
                assignments={allAssignments}
                submissions={allSubmissions}
                effortOverrides={effortOverrides}
                trashedIds={trashedIds}
                onEffortSet={handleEffortSet}
              />
            </div>
          )}
        </div>
      )}

      {/* Priority queue — full width */}
      <PriorityStack
        assignments={allAssignments}
        submissions={allSubmissions}
        courses={courses}
        isLoading={isLoading}
        effortOverrides={effortOverrides}
        onEffortChange={handleEffortSet}
      />
    </div>
  );
}

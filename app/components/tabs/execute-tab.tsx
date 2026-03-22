'use client';

import React from 'react';
import { LiveGradeCard, LiveGradeCardSkeleton } from '@/components/live-grade-card';
import { PriorityStack } from '@/components/priority-stack';
import { AnnouncementDigest } from '@/components/announcement-digest';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
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
  announcements,
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
        <Card className="border-destructive/50 max-w-md w-full">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Something went wrong</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button onClick={onRetry} variant="outline">
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isLoading && !error && courses.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-6">
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">No courses found.</p>
              <p className="text-xs text-muted-foreground">
                Open your browser console (F12) and look for "[GradeOS] raw courses response:" to see what Canvas returned.
              </p>
              <Button onClick={onRetry} variant="outline" size="sm">
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Live Grade Cards */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Live Grades</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {isLoading ? (
            [...Array(4)].map((_, i) => <LiveGradeCardSkeleton key={i} />)
          ) : (
            courses.map((course) => (
              <LiveGradeCard
                key={course.id}
                course={course}
                assignments={getAssignmentsForCourse(course.id)}
                submissions={getSubmissionsForCourse(course.id)}
                onClick={() => onSelectCourse?.(course.id)}
              />
            ))
          )}
        </div>
      </section>

      {/* Two Column Layout for Priority Stack and Announcements */}
      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <PriorityStack
            assignments={allAssignments}
            submissions={allSubmissions}
            courses={courses}
            isLoading={isLoading}
          />
        </section>

        <section>
          <AnnouncementDigest
            announcements={announcements}
            courses={courses}
            isLoading={isLoading}
          />
        </section>
      </div>
    </div>
  );
}

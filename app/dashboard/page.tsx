'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCanvas } from '@/lib/canvas-context';
import { DashboardNav } from '@/components/dashboard-nav';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExecuteTab } from '@/components/tabs/execute-tab';
import { PlanTab } from '@/components/tabs/plan-tab';
import { ScheduleTab } from '@/components/tabs/schedule-tab';
import { ReflectTab } from '@/components/tabs/reflect-tab';
import { CommandPalette } from '@/components/command-palette';
import { useZenMode } from '@/hooks/use-zen-mode';
import { fetchCourses, fetchAssignments, fetchSubmissions, fetchAnnouncements } from '@/lib/canvas-service';
import { computeCurrentGrade, getSemesterStart } from '@/lib/gradeUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import type { Course, Assignment, Submission, Announcement } from '@/lib/types';

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connection } = useCanvas();
  const { isZenMode, toggleZenMode } = useZenMode();

  const [activeTab, setActiveTab] = useState('execute');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Shared data — loaded once, passed as props to all tabs
  const [courses, setCourses] = useState<Course[]>([]);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Handle URL params for tab
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['execute', 'courses', 'schedule', 'reflect'].includes(tab)) {
      setActiveTab(tab);
    }
    const courseId = searchParams.get('course');
    if (courseId) {
      setSelectedCourseId(courseId);
      setActiveTab('courses');
    }
  }, [searchParams]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    if (!hasLoadedOnce) setError(null);
    try {
      const coursesData = await fetchCourses(connection);

      const assignmentsResults = await Promise.all(
        coursesData.map(async (course) => {
          try {
            const assignments = await fetchAssignments(course.id, connection);
            console.log(`[GradeOS] ${course.code}: ${assignments.length} assignments`);
            return assignments.map((a) => ({
              ...a,
              courseName: course.name,
              courseCode: course.code,
            }));
          } catch (err) {
            console.error(`[GradeOS] FAILED to fetch assignments for ${course.code}:`, err);
            return [];
          }
        })
      );

      const submissionsResults = await Promise.all(
        coursesData.map((course) => fetchSubmissions(course.id, connection))
      );

      const allAssignmentsFlat = assignmentsResults.flat();
      const allSubmissionsFlat = submissionsResults.flat();

      setAllAssignments(allAssignmentsFlat);
      setAllSubmissions(allSubmissionsFlat);

      // Compute grades from actual submissions, not Canvas's cumulative score
      const semStart = getSemesterStart();
      const coursesWithGrades = coursesData.map((course) => {
        const courseAssignments = allAssignmentsFlat.filter((a) => a.courseId === course.id);
        const courseSubmissions = allSubmissionsFlat.filter((s) => s.courseId === course.id);
        const computedGrade = computeCurrentGrade(courseAssignments, courseSubmissions, new Date(semStart));
        return { ...course, currentGrade: computedGrade ?? course.currentGrade };
      });

      setCourses(coursesWithGrades);
      setError(null);
      setHasLoadedOnce(true);

      if (connection.connected) {
        const announcementsData = await fetchAnnouncements(
          coursesData.map((c) => c.id),
          connection
        );
        setAnnouncements(announcementsData);
      }
    } catch (err) {
      // Only surface the error if we have no data yet — avoids the flash on first load
      if (!hasLoadedOnce) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } else {
        console.error('[GradeOS] Background refresh failed:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [connection, hasLoadedOnce]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-dismiss error after 8 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSelectCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    setActiveTab('courses');
    router.push(`/dashboard?tab=courses&course=${courseId}`);
  };

  const handleBackFromCourse = () => {
    setSelectedCourseId(null);
    setActiveTab('execute');
    router.push('/dashboard');
  };

  const getAssignmentsForCourse = (courseId: string) =>
    allAssignments.filter((a) => a.courseId === courseId);

  const getSubmissionsForCourse = (courseId: string) =>
    allSubmissions.filter((s) => s.courseId === courseId);

  return (
    <div id="dashboard-root" className={`min-h-screen bg-background ${isZenMode ? 'zen-mode' : ''}`}>
      <DashboardNav
        isZenMode={isZenMode}
        onToggleZenMode={toggleZenMode}
        onSync={loadData}
      />

      <CommandPalette
        courses={courses}
        assignments={allAssignments}
        onSync={loadData}
        onToggleZenMode={toggleZenMode}
        zenModeActive={isZenMode}
        onSelectCourse={handleSelectCourse}
      />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="execute">Execute</TabsTrigger>
            <TabsTrigger value="courses">Courses</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="reflect">Reflect</TabsTrigger>
          </TabsList>

          <TabsContent value="execute" className="mt-0">
            <ExecuteTab
              courses={courses}
              allAssignments={allAssignments}
              allSubmissions={allSubmissions}
              announcements={announcements}
              isLoading={isLoading}
              error={error}
              onSelectCourse={handleSelectCourse}
              onRetry={loadData}
              getAssignmentsForCourse={getAssignmentsForCourse}
              getSubmissionsForCourse={getSubmissionsForCourse}
            />
          </TabsContent>

          <TabsContent value="courses" className="mt-0">
            <PlanTab
              selectedCourseId={selectedCourseId}
              courses={courses}
              allAssignments={allAssignments}
              allSubmissions={allSubmissions}
              isLoading={isLoading}
              onSelectCourse={handleSelectCourse}
              onBack={handleBackFromCourse}
              getAssignmentsForCourse={getAssignmentsForCourse}
              getSubmissionsForCourse={getSubmissionsForCourse}
            />
          </TabsContent>

          <TabsContent value="schedule" className="mt-0">
            <ScheduleTab
              courses={courses}
              allAssignments={allAssignments}
              allSubmissions={allSubmissions}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="reflect" className="mt-0">
            <ReflectTab
              courses={courses}
              assignments={allAssignments}
              submissions={allSubmissions}
              isLoading={isLoading}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

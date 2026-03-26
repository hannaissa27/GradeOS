'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCanvas } from '@/lib/canvas-context';
import { DashboardNav } from '@/components/dashboard-nav';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExecuteTab } from '@/components/tabs/execute-tab';
import { PlanTab } from '@/components/tabs/plan-tab';
import { ReflectTab } from '@/components/tabs/reflect-tab';
import { useZenMode } from '@/hooks/use-zen-mode';
import { fetchCourses, fetchAssignments, fetchSubmissions } from '@/lib/canvas-service';
import { computeCurrentGrade, getSemesterStart } from '@/lib/gradeUtils';
import type { Course, Assignment, Submission } from '@/lib/types';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connection } = useCanvas();
  const { isZenMode, toggleZenMode } = useZenMode();

  const [activeTab, setActiveTab] = useState('execute');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const getCached = (key: string) => {
    try { const v = sessionStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
  };
  const [courses, setCourses] = useState<Course[]>(() => getCached('gradeos-courses') || []);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>(() => getCached('gradeos-assignments') || []);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>(() => getCached('gradeos-submissions') || []);
  const [isLoading, setIsLoading] = useState(() => !(getCached('gradeos-courses')?.length > 0));
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(() => !!(getCached('gradeos-courses')?.length > 0));

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['execute', 'courses', 'reflect'].includes(tab)) {
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
      try {
        sessionStorage.setItem('gradeos-courses', JSON.stringify(coursesWithGrades));
        sessionStorage.setItem('gradeos-assignments', JSON.stringify(allAssignmentsFlat));
        sessionStorage.setItem('gradeos-submissions', JSON.stringify(allSubmissionsFlat));
      } catch {}
    } catch (err) {
      if (hasLoadedOnce) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      }
      console.error('[GradeOS] loadData failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [connection, hasLoadedOnce]);

  useEffect(() => {
    if (!hasLoadedOnce) {
      loadData();
    }
  }, []);

  const prevConnected = React.useRef(false);
  useEffect(() => {
    if (connection.connected && !prevConnected.current && !hasLoadedOnce) {
      loadData();
    }
    prevConnected.current = connection.connected;
  }, [connection.connected]);

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

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="execute">Dashboard</TabsTrigger>
            <TabsTrigger value="courses">My Courses</TabsTrigger>
            <TabsTrigger value="reflect">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="execute" className="mt-0">
            <ExecuteTab
              courses={courses}
              allAssignments={allAssignments}
              allSubmissions={allSubmissions}
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

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}

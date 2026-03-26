'use client';

import React, { useState, useMemo } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import { callClaude } from '@/lib/aiUtils';
import { getGradeColor, gradeToLetter, courseColor } from '@/lib/gradeUtils';
import type { Course, Assignment, Submission } from '@/lib/types';

interface GradeImpactAdvisorProps {
  courses: Course[];
  allAssignments: Assignment[];
  allSubmissions: Submission[];
  effortEstimates: Record<string, number>;
  dismissedMissing: Set<string>;
}

export function GradeImpactAdvisor({
  courses,
  allAssignments,
  allSubmissions,
  effortEstimates,
  dismissedMissing,
}: GradeImpactAdvisorProps) {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const submissionMap = useMemo(() =>
    new Map(allSubmissions.map(s => [s.assignmentId, s])),
    [allSubmissions]
  );

  // Build per-course analysis data
  const courseAnalysis = useMemo(() => {
    const now = new Date();
    const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    return courses
      .filter(c => c.currentGrade !== null)
      .map(course => {
        const shortName = (() => {
          const n = course.name || '';
          const after = n.includes(':') ? n.split(':').slice(1).join(':').trim() : n;
          return after.replace(/^(AP|IB|Honors|Accelerated) /i, '').trim();
        })();

        const upcoming = allAssignments.filter(a => {
          if (a.courseId !== course.id || !a.dueDate) return false;
          const due = new Date(a.dueDate);
          if (due < now || due > twoWeeks) return false;
          const sub = submissionMap.get(a.id);
          if (dismissedMissing.has(a.id)) return false;
          return !sub?.submittedAt && (sub?.score === null || sub?.score === undefined);
        });

        const totalUpcomingPts = upcoming.reduce((s, a) => s + a.pointsPossible, 0);
        const totalEffortMins = upcoming.reduce((s, a) => s + (effortEstimates[a.id] || 60), 0);

        // Grade impact: how much would 100% on upcoming assignments move the grade?
        const allCourseAssignments = allAssignments.filter(a => a.courseId === course.id);
        const totalCoursePts = allCourseAssignments.reduce((s, a) => s + (a.pointsPossible || 0), 0);
        const impactPct = totalCoursePts > 0 ? (totalUpcomingPts / totalCoursePts) * 100 : 0;

        return {
          course,
          shortName,
          grade: course.currentGrade!,
          upcoming,
          totalUpcomingPts,
          totalEffortMins,
          impactPct,
          ptsPerHour: totalEffortMins > 0 ? Math.round(totalUpcomingPts / (totalEffortMins / 60)) : 0,
        };
      })
      .filter(c => c.upcoming.length > 0)
      .sort((a, b) => {
        // Sort by: lowest grade × highest impact first (biggest opportunity)
        const scoreA = (100 - a.grade) * a.impactPct;
        const scoreB = (100 - b.grade) * b.impactPct;
        return scoreB - scoreA;
      });
  }, [courses, allAssignments, allSubmissions, effortEstimates, dismissedMissing, submissionMap]);

  const handleGenerate = async () => {
    if (courseAnalysis.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const prompt = courseAnalysis.map(c =>
        `${c.shortName}: ${c.grade}% (${gradeToLetter(c.grade)}), ${c.upcoming.length} upcoming (${c.totalUpcomingPts}pts, ~${Math.round(c.totalEffortMins / 60)}h effort), ${Math.round(c.impactPct)}% of total grade`
      ).join('\n');

      const response = await callClaude(
        `Here are my courses with upcoming work in the next 2 weeks:\n${prompt}`,
        `You are a student's academic strategist. Analyze their courses and tell them WHERE to spend their time for maximum GPA impact. Be specific and direct in 4-6 sentences. Compare courses: which one has the most grade-moving work? Which grade is already safe and can be deprioritized? If one course is at a borderline (89%, 79%, 69%) flag that a few points could change the letter grade. End with one concrete reallocation: "Shift X hours from [safe course] to [at-risk course]." No bullet points, no headers. Second person.`,
        400
      );

      setAdvice(response.trim());
      setHasGenerated(true);
    } catch (err: any) {
      setError(err?.message?.includes('429') ? 'AI is busy — try again in a minute.' : 'Could not generate. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (courses.length === 0 || courseAnalysis.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {!hasGenerated ? (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <TrendingUp className="h-4 w-4 text-primary" />
            )}
            <span className="text-sm font-medium">
              {loading ? 'Analyzing your courses...' : 'Where should I spend my time?'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {courseAnalysis.length} courses with upcoming work
          </span>
        </button>
      ) : (
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Grade Impact Advisor</span>
            </div>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {/* Course comparison bars */}
          <div className="space-y-1.5">
            {courseAnalysis.slice(0, 5).map(c => (
              <div key={c.course.id} className="flex items-center gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: courseColor(c.course.id) }} />
                <span className="w-28 truncate text-muted-foreground">{c.shortName}</span>
                <span className={`w-10 font-bold ${getGradeColor(c.grade)}`}>{c.grade}%</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(c.impactPct * 2, 100)}%`, opacity: 0.3 + (c.impactPct / 100) * 0.7 }}
                  />
                </div>
                <span className="text-muted-foreground w-16 text-right">{c.totalUpcomingPts}pts</span>
                <span className="text-muted-foreground w-10 text-right">~{Math.round(c.totalEffortMins / 60)}h</span>
              </div>
            ))}
          </div>

          {/* AI advice */}
          {error ? (
            <p className="text-xs text-red-500">{error}</p>
          ) : advice && (
            <p className="text-sm text-muted-foreground leading-relaxed">{advice}</p>
          )}
        </div>
      )}
    </div>
  );
}

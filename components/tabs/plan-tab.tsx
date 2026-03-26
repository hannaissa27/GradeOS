'use client';

import React, { useState, useMemo } from 'react';
import { GradeRescue } from '@/components/grade-rescue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, ChevronDown, Zap, Loader2, Clock } from 'lucide-react';
import { HelpTip } from '@/components/help-tip';
import {
  courseColor,
  getGradeColor,
  gradeToLetter,
  formatDueDate,
  getDueDateColor,
} from '@/lib/gradeUtils';
import { callClaude } from '@/lib/aiUtils';
import type { Course, Assignment, Submission } from '@/lib/types';

interface PlanTabProps {
  selectedCourseId: string | null;
  courses: Course[];
  allAssignments: Assignment[];
  allSubmissions: Submission[];
  isLoading: boolean;
  onSelectCourse: (courseId: string) => void;
  onBack: () => void;
  getAssignmentsForCourse: (courseId: string) => Assignment[];
  getSubmissionsForCourse: (courseId: string) => Submission[];
}

export function PlanTab({
  selectedCourseId,
  courses,
  allAssignments,
  allSubmissions,
  isLoading,
  onSelectCourse,
  onBack,
  getAssignmentsForCourse,
  getSubmissionsForCourse,
}: PlanTabProps) {
  const [completedOpen, setCompletedOpen] = useState(false);

  const selectedCourse = selectedCourseId ? courses.find(c => c.id === selectedCourseId) ?? null : null;
  const assignments = selectedCourseId ? getAssignmentsForCourse(selectedCourseId) : [];
  const submissions = selectedCourseId ? getSubmissionsForCourse(selectedCourseId) : [];

  const now = new Date();

  const missingAssignments = useMemo(() =>
    assignments.filter(a => {
      const sub = submissions.find(s => s.assignmentId === a.id);
      return sub?.missing && !sub?.excused;
    }), [assignments, submissions]);

  const upcomingAssignments = useMemo(() =>
    assignments.filter(a => {
      const sub = submissions.find(s => s.assignmentId === a.id);
      const isGraded = sub?.score !== null && sub?.score !== undefined;
      const isSubmitted = !!sub?.submittedAt;
      const isPast = a.dueDate ? new Date(a.dueDate) < now : false;
      return !isGraded && !(isSubmitted && isPast);
    }), [assignments, submissions]);

  const completedAssignments = useMemo(() =>
    assignments.filter(a => {
      const sub = submissions.find(s => s.assignmentId === a.id);
      const isGraded = sub?.score !== null && sub?.score !== undefined;
      const isSubmitted = !!sub?.submittedAt;
      const isPast = a.dueDate ? new Date(a.dueDate) < now : false;
      return isGraded || (isSubmitted && isPast);
    }), [assignments, submissions]);

  // ─── Course Grid ───────────────────────────────────────────────────────────
  if (!selectedCourseId) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">My Courses</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Click any course to see your grade, assignments, and what you need to hit your target.</p>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
          </div>
        ) : courses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No courses found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {courses.map(course => {
              const ca = allAssignments.filter(a => a.courseId === course.id);
              const cs = allSubmissions.filter(s => s.courseId === course.id);
              const pending = ca.filter(a => {
                const sub = cs.find(s => s.assignmentId === a.id);
                return !sub?.submittedAt && (sub?.score === null || sub?.score === undefined) && a.dueDate && new Date(a.dueDate) > now;
              });
              const missing = cs.filter(s => s.missing).length;
              const shortName = (() => {
                const n = course.name || '';
                const after = n.includes(':') ? n.split(':').slice(1).join(':').trim() : n;
                return after.replace(/^(AP|IB|Honors|Accelerated) /i, '').trim();
              })();

              return (
                <button
                  key={course.id}
                  className="text-left w-full rounded-xl border border-border bg-card hover:bg-accent/20 transition-all cursor-pointer p-4 group"
                  onClick={() => onSelectCourse(course.id)}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: courseColor(course.id) }} />
                    <p className="font-semibold text-sm truncate">{shortName}</p>
                  </div>
                  <div className="flex items-end justify-between mb-3">
                    <div>
                      {course.currentGrade !== null ? (
                        <>
                          <p className={`text-3xl font-bold grade-value leading-none ${getGradeColor(course.currentGrade)}`} data-grade="true">{course.currentGrade}%</p>
                          <p className={`text-xs mt-0.5 ${getGradeColor(course.currentGrade)}`}>{gradeToLetter(course.currentGrade)} grade</p>
                        </>
                      ) : (
                        <p className="text-3xl font-bold text-muted-foreground">N/A</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground group-hover:text-primary transition-colors">Open →</p>
                  </div>
                  <div className="text-xs space-y-0.5">
                    {pending.length > 0 ? (
                      <p className="text-muted-foreground"><span className="font-medium text-foreground">{pending.length}</span> upcoming</p>
                    ) : (
                      <p className="text-green-600 dark:text-green-400">Nothing due soon</p>
                    )}
                    {missing > 0 && <p className="text-red-500 font-medium">{missing} missing</p>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Course Detail ─────────────────────────────────────────────────────────
  if (!selectedCourse) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground mb-2">Course not found.</p>
        <button onClick={onBack} className="text-xs underline cursor-pointer text-muted-foreground hover:text-foreground">Go back</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-md hover:bg-accent transition-colors cursor-pointer text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: courseColor(selectedCourseId) }} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base truncate">
            {selectedCourse.name.includes(':')
              ? selectedCourse.name.split(':').slice(1).join(':').trim().replace(/^(AP|IB|Honors|Accelerated) /i, '').trim()
              : selectedCourse.name}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          {selectedCourse.currentGrade !== null ? (
            <>
              <span className={`text-2xl font-bold grade-value ${getGradeColor(selectedCourse.currentGrade)}`} data-grade="true">
                {selectedCourse.currentGrade}%
              </span>
              <span className={`ml-1.5 text-base grade-value ${getGradeColor(selectedCourse.currentGrade)}`} data-grade="true">
                {gradeToLetter(selectedCourse.currentGrade)}
              </span>
            </>
          ) : (
            <span className="text-2xl font-bold text-muted-foreground">N/A</span>
          )}
        </div>
      </div>

      {/* Missing assignments */}
      {missingAssignments.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-1.5">
          <p className="text-xs font-medium text-red-500">{missingAssignments.length} missing assignment{missingAssignments.length !== 1 ? 's' : ''}</p>
          {missingAssignments.map(a => (
            <div key={a.id} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate flex-1">{a.name}</span>
              <span className="text-muted-foreground ml-2 flex-shrink-0">{a.pointsPossible} pts · {formatDueDate(a.dueDate)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Grade Planner */}
      <GradeRescue
        currentGrade={selectedCourse.currentGrade ?? null}
        assignments={assignments}
        submissions={submissions}
      />

      {/* Upcoming Assignments */}
      <section>
        <h2 className="text-sm font-semibold mb-3">
          Upcoming
          {upcomingAssignments.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">({upcomingAssignments.length})</span>
          )}
        </h2>
        {isLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : upcomingAssignments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No upcoming assignments.</p>
        ) : (
          <div className="space-y-2">
            {upcomingAssignments.map(a => (
              <AssignmentRow key={a.id} assignment={a} submission={submissions.find(s => s.assignmentId === a.id)} />
            ))}
          </div>
        )}
      </section>

      {/* Completed */}
      {completedAssignments.length > 0 && (
        <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <ChevronDown className={`h-4 w-4 transition-transform ${completedOpen ? 'rotate-180' : ''}`} />
              Completed ({completedAssignments.length})
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-2">
            {completedAssignments.map(a => (
              <AssignmentRow key={a.id} assignment={a} submission={submissions.find(s => s.assignmentId === a.id)} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// ─── Assignment Row ────────────────────────────────────────────────────────

function AssignmentRow({ assignment, submission }: {
  assignment: Assignment;
  submission?: Submission;
}) {
  const [open, setOpen] = useState(false);

  const isGraded = submission?.score !== null && submission?.score !== undefined;
  const score = submission?.score ?? null;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        className="w-full text-left px-3 py-2.5 hover:bg-accent/20 transition-colors cursor-pointer flex items-center gap-3"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{assignment.name}</p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <span>{assignment.pointsPossible} pts</span>
            <span>·</span>
            <span className={getDueDateColor(assignment.dueDate)}>{formatDueDate(assignment.dueDate)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isGraded && (
            <span className={`text-sm font-bold ${getGradeColor(Math.round((score! / assignment.pointsPossible) * 100))}`}>
              {score}/{assignment.pointsPossible}
            </span>
          )}
          {submission?.missing && <span className="text-xs text-red-500 font-medium">Missing</span>}
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-border space-y-3">
          <FirstMoveButton assignment={assignment} />

          {assignment.description && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3"
              dangerouslySetInnerHTML={{ __html: assignment.description.slice(0, 300) }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Assignment Decoder Button ────────────────────────────────────────────

function FirstMoveButton({ assignment }: { assignment: Assignment }) {
  const [result, setResult] = useState<{ plain: string; deliverable: string; hidden: string; firstStep: string; timeEstimate: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async () => {
    if (open && result) { setOpen(false); return; }
    setOpen(true);
    if (result || loading) return;

    setLoading(true);
    try {
      const cleanDesc = (assignment.description || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500);

      const prompt = `Assignment: ${assignment.name}. Points: ${assignment.pointsPossible}. Due: ${assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'No due date'}. ${cleanDesc ? `Description: ${cleanDesc}` : ''}`.trim();

      const response = await callClaude(
        prompt,
        `You decode assignments so students understand them instantly. Return ONLY valid JSON:
{"plain":"One sentence: what to do. Start with a verb.","deliverable":"What to hand in, be specific.","hidden":"One sentence about easy-to-miss requirements, or 'Nothing hidden.' if straightforward.","firstStep":"One 2-minute action to start RIGHT NOW.","timeEstimate":"Realistic estimate like 'About 45 minutes'."}
Return ONLY the JSON. No markdown.`,
        400
      );

      const parsed = JSON.parse(response.replace(/```json|```/g, '').trim());
      if (parsed.plain && parsed.firstStep && parsed.timeEstimate) {
        setResult(parsed);
      } else throw new Error('Bad response');
    } catch (err: any) {
      const msg = err?.message || '';
      setError(msg.includes('429') || msg.includes('rate')
        ? 'AI is rate-limited. Try again in a minute.'
        : 'Could not decode. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handle}
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${open ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
        Decode
      </button>

      {open && (
        <div className="mt-2 rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
          {error ? (
            <p className="text-xs text-red-500">{error}</p>
          ) : loading ? (
            <p className="text-xs text-muted-foreground">Decoding...</p>
          ) : result && (
            <>
              <p className="text-xs text-muted-foreground">{result.plain}</p>
              {result.deliverable && (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Hand in</p>
                  <p className="text-xs font-medium">{result.deliverable}</p>
                </div>
              )}
              {result.hidden && !result.hidden.toLowerCase().includes('nothing hidden') && (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500">Easy to miss</p>
                  <p className="text-xs text-muted-foreground">{result.hidden}</p>
                </div>
              )}
              <div className="pt-1 border-t border-border/50 space-y-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Start now</p>
                <p className="text-sm font-medium">{result.firstStep}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{result.timeEstimate}</span>
              </div>
            </>
          )}
          <button onClick={() => setOpen(false)} className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer underline">Close</button>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useMemo } from 'react';
import { useCanvas } from '@/lib/canvas-context';
import { GradeRescue } from '@/components/grade-rescue';
import { SemesterArc } from '@/components/semester-arc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
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
import { hasAIKey, callClaude } from '@/lib/aiUtils';
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
  const { connection } = useCanvas();
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

      {/* Grade Trajectory */}
      <SemesterArc assignments={assignments} submissions={submissions} isLoading={isLoading} />

      {/* Grade Rescue */}
      <GradeRescue
        currentGrade={selectedCourse.currentGrade ?? null}
        assignments={assignments}
        submissions={submissions}
      />

      {/* Grade Simulator */}
      <GradeSimulator
        assignments={assignments}
        submissions={submissions}
        currentGrade={selectedCourse.currentGrade ?? null}
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
              <AssignmentRow key={a.id} assignment={a} submission={submissions.find(s => s.assignmentId === a.id)} allAssignments={assignments} allSubmissions={submissions} currentGrade={selectedCourse.currentGrade ?? null} />
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
              <AssignmentRow key={a.id} assignment={a} submission={submissions.find(s => s.assignmentId === a.id)} allAssignments={assignments} allSubmissions={submissions} currentGrade={selectedCourse.currentGrade ?? null} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// ─── Assignment Row ────────────────────────────────────────────────────────

function AssignmentRow({ assignment, submission, allAssignments, allSubmissions, currentGrade }: {
  assignment: Assignment;
  submission?: Submission;
  allAssignments: Assignment[];
  allSubmissions: Submission[];
  currentGrade: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [whatIfScore, setWhatIfScore] = useState<number | null>(null);

  const isGraded = submission?.score !== null && submission?.score !== undefined;
  const score = submission?.score ?? null;

  const whatIfGrade = whatIfScore !== null ? (() => {
    let earned = 0, possible = 0;
    for (const a of allAssignments) {
      if (!a.pointsPossible) continue;
      if (a.id === assignment.id) { earned += whatIfScore; possible += a.pointsPossible; continue; }
      const sub = allSubmissions.find(s => s.assignmentId === a.id);
      if (sub?.score !== null && sub?.score !== undefined) { earned += sub.score; possible += a.pointsPossible; }
    }
    return possible > 0 ? Math.round((earned / possible) * 1000) / 10 : null;
  })() : null;

  const delta = whatIfGrade !== null && currentGrade !== null
    ? Math.round((whatIfGrade - currentGrade) * 10) / 10 : null;

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
          {/* First Move */}
          <FirstMoveButton assignment={assignment} />

          {/* What-if only for ungraded */}
          {!isGraded && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">What if I score...</p>
              <Slider
                value={[whatIfScore ?? 0]}
                onValueChange={([v]) => setWhatIfScore(Math.round(v * 2) / 2)}
                min={0} max={assignment.pointsPossible} step={0.5}
                className="w-full cursor-pointer"
              />
              {whatIfGrade !== null && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Course grade would be <span className={`font-bold ${getGradeColor(whatIfGrade)}`}>{whatIfGrade}%</span>
                    {delta !== null && <span className={`ml-1 ${delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>({delta >= 0 ? '+' : ''}{delta}%)</span>}
                  </p>
                  <button className="text-xs text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setWhatIfScore(null)}>Clear</button>
                </div>
              )}
            </div>
          )}

          {/* Description */}
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

// ─── First Move Button ─────────────────────────────────────────────────────

function FirstMoveButton({ assignment }: { assignment: Assignment }) {
  const [result, setResult] = useState<{ plain: string; firstStep: string; timeEstimate: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async () => {
    if (open && result) { setOpen(false); return; }
    setOpen(true);
    if (result || loading) return;

    if (!hasAIKey()) {
      setError('Add your Anthropic API key in Settings to use this feature.');
      return;
    }

    setLoading(true);
    try {
      const prompt = `Assignment: "${assignment.name}"
Points: ${assignment.pointsPossible}
Due: ${assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'No due date'}
Description: ${assignment.description ? assignment.description.replace(/<[^>]+>/g, '').slice(0, 400) : 'No description'}`;

      const response = await callClaude(prompt,
        `You help students start assignments. Return ONLY valid JSON:
{"plain":"One sentence what the student actually has to do. Start with a verb.","firstStep":"The single first physical action taking under 2 minutes.","timeEstimate":"Realistic time like 'About 45 minutes'"}`,
        400);

      const parsed = JSON.parse(response.replace(/```json|```/g, '').trim());
      if (parsed.plain && parsed.firstStep && parsed.timeEstimate) setResult(parsed);
      else throw new Error('Bad response');
    } catch (err: any) {
      const msg = err?.message || '';
      setError(msg === 'NO_API_KEY' ? 'Add your API key in Settings.' : 'Could not generate. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handle}
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${open ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
        How do I start?
      </button>

      {open && (
        <div className="mt-2 rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
          {error ? (
            <p className="text-xs text-muted-foreground">{error}</p>
          ) : loading ? (
            <p className="text-xs text-muted-foreground">Thinking...</p>
          ) : result && (
            <>
              <p className="text-xs text-muted-foreground">{result.plain}</p>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary mb-0.5">Do this right now</p>
                <p className="text-sm font-medium">{result.firstStep}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border">
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

// ─── Grade Simulator ────────────────────────────────────────────────────────

function GradeSimulator({ assignments, submissions, currentGrade }: {
  assignments: Assignment[];
  submissions: Submission[];
  currentGrade: number | null;
}) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [showCompleted, setShowCompleted] = useState(false);

  const eligible = assignments.filter(a => a.pointsPossible > 0);
  const ungraded = eligible.filter(a => {
    const s = submissions.find(x => x.assignmentId === a.id);
    return s?.score === null || s?.score === undefined;
  });
  const graded = eligible.filter(a => {
    const s = submissions.find(x => x.assignmentId === a.id);
    return s?.score !== null && s?.score !== undefined;
  });

  const projected = useMemo(() => {
    let e = 0, p = 0;
    for (const a of eligible) {
      if (!a.pointsPossible) continue;
      const hypo = scores[a.id];
      if (hypo !== undefined) { e += hypo; p += a.pointsPossible; }
      else {
        const sub = submissions.find(s => s.assignmentId === a.id);
        if (sub?.score !== null && sub?.score !== undefined) { e += sub.score; p += a.pointsPossible; }
      }
    }
    return p > 0 ? Math.round((e / p) * 1000) / 10 : null;
  }, [scores, eligible, submissions]);

  const delta = projected !== null && currentGrade !== null
    ? Math.round((projected - currentGrade) * 10) / 10 : null;
  const hasAny = Object.keys(scores).length > 0;
  const overriddenCount = graded.filter(a => scores[a.id] !== undefined).length;

  if (eligible.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">Grade Simulator</CardTitle>
            <HelpTip text="Set a hypothetical score on any upcoming assignment to see how your course grade would change. You can also expand completed assignments to override them and run what-if scenarios." />
          </div>
          {hasAny && (
            <button onClick={() => setScores({})} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline">Reset all</button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Grade impact summary */}
        {hasAny && projected !== null ? (
          <div className="flex items-center gap-6 p-3 bg-muted/40 rounded-lg">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Current</p>
              <p className={`text-xl font-bold ${getGradeColor(currentGrade)}`} data-grade="true">
                {currentGrade !== null ? `${currentGrade}%` : 'N/A'}
              </p>
            </div>
            <div className="text-muted-foreground">→</div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Projected</p>
              <p className={`text-xl font-bold ${getGradeColor(projected)}`} data-grade="true">{projected}%</p>
            </div>
            {delta !== null && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Change</p>
                <p className={`text-xl font-bold ${delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {delta >= 0 ? '+' : ''}{delta}%
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {ungraded.length > 0
              ? 'Drag a slider below to see how a hypothetical score would affect your grade.'
              : 'All assignments graded. Expand completed assignments below to override scores.'}
          </p>
        )}

        {/* Upcoming — main use case */}
        {ungraded.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Upcoming</p>
            {ungraded.map(a => {
              const val = scores[a.id];
              const pct = val !== undefined ? Math.round((val / a.pointsPossible) * 100) : null;
              return (
                <div key={a.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium leading-snug flex-1">{a.name}</p>
                    <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
                      {val !== undefined ? `${val}` : '—'} / {a.pointsPossible}
                      {pct !== null && <span className={`ml-1.5 font-bold ${getGradeColor(pct)}`}> ({pct}%)</span>}
                    </span>
                  </div>
                  <Slider min={0} max={a.pointsPossible} step={0.5}
                    value={[val ?? 0]}
                    onValueChange={([v]) => setScores(p => ({ ...p, [a.id]: Math.round(v * 2) / 2 }))}
                    className="cursor-pointer" />
                  {val !== undefined && (
                    <button className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                      onClick={() => { const n = {...scores}; delete n[a.id]; setScores(n); }}>
                      Clear
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Completed — collapsed by default */}
        {graded.length > 0 && (
          <div>
            <button
              onClick={() => setShowCompleted(v => !v)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer w-full py-1"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showCompleted ? 'rotate-180' : ''}`} />
              <span>Override completed assignments ({graded.length})</span>
              {overriddenCount > 0 && <span className="ml-auto text-amber-500">{overriddenCount} overridden</span>}
            </button>
            {showCompleted && (
              <div className="mt-2 space-y-2">
                {graded.map(a => {
                  const realScore = submissions.find(s => s.assignmentId === a.id)?.score ?? 0;
                  const val = scores[a.id] !== undefined ? scores[a.id] : realScore;
                  const isOverridden = scores[a.id] !== undefined && Math.abs(scores[a.id] - realScore) > 0.1;
                  return (
                    <div key={a.id} className={`rounded-lg border p-3 space-y-2 ${isOverridden ? 'border-amber-500/30 bg-amber-500/5' : 'border-border'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs truncate flex-1 ${isOverridden ? 'font-medium' : 'text-muted-foreground'}`}>{a.name}</p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isOverridden && (
                            <button className="text-[10px] text-amber-500 cursor-pointer underline"
                              onClick={() => { const n = {...scores}; delete n[a.id]; setScores(n); }}>Reset</button>
                          )}
                          <span className="text-xs text-muted-foreground font-mono">{val} / {a.pointsPossible}</span>
                        </div>
                      </div>
                      <Slider min={0} max={a.pointsPossible} step={0.5} value={[val]}
                        onValueChange={([v]) => setScores(p => ({ ...p, [a.id]: Math.round(v * 2) / 2 }))}
                        className="cursor-pointer" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

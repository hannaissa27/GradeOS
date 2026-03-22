'use client';

import React, { useState, useMemo } from 'react';
import { useCanvas } from '@/lib/canvas-context';
import { ResourceHeist } from '@/components/resource-heist';
import { SyllabusSpy } from '@/components/syllabus-spy';
import { GradeRescue } from '@/components/grade-rescue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import { ArrowLeft, Check, Sparkles, AlertCircle, ChevronDown, Zap, Loader2, Clock } from 'lucide-react';
import { HelpTip } from '@/components/help-tip';
import {
  courseColor,
  getGradeColor,
  gradeToLetter,
  formatDueDate,
  getDueDateColor,
  getAssignmentTypeBadge,
  computeProjectedGrade,
} from '@/lib/gradeUtils';
import { hasAIKey, callClaude } from '@/lib/aiUtils';
import { SemesterArc } from '@/components/semester-arc';
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
  const [expandedAssignment, setExpandedAssignment] = useState<string | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  const assignments = selectedCourseId ? getAssignmentsForCourse(selectedCourseId) : [];
  const submissions = selectedCourseId ? getSubmissionsForCourse(selectedCourseId) : [];

  const now = new Date();

  // Missing: explicitly flagged as missing by Canvas
  const missingAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const submission = submissions.find((s) => s.assignmentId === a.id);
      return submission?.missing && !submission?.excused;
    });
  }, [assignments, submissions]);

  // Upcoming: due in future or no due date, and not graded/submitted
  const upcomingAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const submission = submissions.find((s) => s.assignmentId === a.id);
      const isGraded = submission?.score !== null && submission?.score !== undefined;
      const isSubmitted = !!submission?.submittedAt;
      const isPast = a.dueDate ? new Date(a.dueDate) < now : false;
      return !isGraded && !(isSubmitted && isPast);
    });
  }, [assignments, submissions]);

  // Completed: graded or submitted-past-due
  const completedAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const submission = submissions.find((s) => s.assignmentId === a.id);
      const isGraded = submission?.score !== null && submission?.score !== undefined;
      const isSubmitted = !!submission?.submittedAt;
      const isPast = a.dueDate ? new Date(a.dueDate) < now : false;
      return isGraded || (isSubmitted && isPast);
    });
  }, [assignments, submissions]);

  // If no course selected, show course grid
  if (!selectedCourseId) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">My Courses</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Click any course to see your grade, assignments, and what you need to hit your target.</p>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : courses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No courses found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {courses.map((course) => {
              const courseAssignments = allAssignments.filter(a => a.courseId === course.id);
              const courseSubmissions = allSubmissions.filter(s => s.courseId === course.id);
              const pending = courseAssignments.filter(a => {
                const sub = courseSubmissions.find(s => s.assignmentId === a.id);
                return !sub?.submittedAt && (sub?.score === null || sub?.score === undefined) && a.dueDate && new Date(a.dueDate) > new Date();
              });
              return (
                <button
                  key={course.id}
                  className="text-left w-full rounded-xl border border-border bg-card hover:bg-accent/20 transition-all cursor-pointer p-4 group"
                  onClick={() => onSelectCourse(course.id)}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: courseColor(course.id) }} />
                    <p className="font-semibold text-sm truncate">
                      {course.name.includes(':') ? course.name.split(':').slice(1).join(':').trim().replace(/^(AP|IB|Honors|Accelerated) /i,'').trim() : course.name}
                    </p>
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
                    {courseSubmissions.filter(s => s.missing).length > 0 && (
                      <p className="text-red-500 font-medium">{courseSubmissions.filter(s => s.missing).length} missing</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Course detail view - safety first
  if (!selectedCourse) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Course not found. <button onClick={onBack} className="underline cursor-pointer">Go back</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Header — back button + course name + grade */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-md hover:bg-accent transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: courseColor(selectedCourseId || '') }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">
            {selectedCourse?.name?.includes(':')
              ? selectedCourse.name.split(':').slice(1).join(':').trim().replace(/^(AP|IB|Honors|Accelerated) /i,'').trim()
              : selectedCourse?.name}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          {selectedCourse?.currentGrade !== null ? (
            <>
              <span className={`text-2xl font-bold grade-value ${getGradeColor(selectedCourse?.currentGrade ?? null)}`} data-grade="true">
                {selectedCourse?.currentGrade}%
              </span>
              <span className={`ml-1.5 text-base grade-value ${getGradeColor(selectedCourse?.currentGrade ?? null)}`} data-grade="true">
                {gradeToLetter(selectedCourse?.currentGrade ?? null)}
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
      </div>

      {/* Missing assignments alert */}
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

      {/* Grade Rescue — the star feature */}
      <GradeRescue
        currentGrade={selectedCourse?.currentGrade ?? null}
        assignments={assignments}
        submissions={submissions}
      />

      {/* What-If + Tools row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WhatIfCalculator
          assignments={upcomingAssignments}
          submissions={submissions}
          currentGrade={selectedCourse?.currentGrade ?? null}
          allAssignments={assignments}
          allSubmissions={submissions}
        />
        {connection.connected && selectedCourse && (
          <div className="space-y-4">
            <ResourceHeist course={selectedCourse} connection={connection} />
            <SyllabusSpy />
          </div>
        )}
      </div>

      {/* Upcoming Assignments */}
      <section>
        <h2 className="text-sm font-semibold mb-3">
          Upcoming
          {upcomingAssignments.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">({upcomingAssignments.length})</span>
          )}
        </h2>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : upcomingAssignments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No upcoming assignments.</p>
        ) : (
          <AssignmentList
            assignments={upcomingAssignments}
            submissions={submissions}
            expandedAssignment={expandedAssignment}
            onExpand={setExpandedAssignment}
          />
        )}
      </section>

      {/* Completed — collapsible */}
      {completedAssignments.length > 0 && (
        <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <ChevronDown className={`h-4 w-4 transition-transform ${completedOpen ? 'rotate-180' : ''}`} />
              Completed ({completedAssignments.length})
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <AssignmentList
              assignments={completedAssignments}
              submissions={submissions}
              expandedAssignment={expandedAssignment}
              onExpand={setExpandedAssignment}
            />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// --- Assignment List ---

interface AssignmentListProps {
  assignments: Assignment[];
  submissions: Submission[];
  expandedAssignment: string | null;
  onExpand: (id: string | null) => void;
}

function AssignmentList({ assignments, submissions, expandedAssignment, onExpand }: AssignmentListProps) {
  // Ensure value is always a string (empty string = nothing open) so
  // the Accordion stays controlled and never flips to uncontrolled.
  return (
    <Accordion
      type="single"
      collapsible
      value={expandedAssignment ?? ''}
      onValueChange={(value) => onExpand(value === '' ? null : value)}
    >
      {assignments.map((assignment) => {
        const submission = submissions.find((s) => s.assignmentId === assignment.id);
        const typeBadge = getAssignmentTypeBadge(assignment.submissionTypes);

        return (
          <AccordionItem key={assignment.id} value={assignment.id}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3 flex-1 text-left">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{assignment.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className={typeBadge.className}>
                      {typeBadge.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {assignment.pointsPossible} pts
                    </span>
                    <span className={`text-xs ${getDueDateColor(assignment.dueDate)}`}>
                      {formatDueDate(assignment.dueDate)}
                    </span>
                  </div>
                </div>
                {submission?.score !== null && submission?.score !== undefined && (
                  <Badge variant="outline" className="text-[oklch(var(--grade-safe))]">
                    {submission.score}/{assignment.pointsPossible}
                  </Badge>
                )}
                {submission?.submittedAt && !submission?.score && (
                  <Badge variant="outline" className="text-[oklch(var(--grade-safe))]">
                    <Check className="w-3 h-3 mr-1" />
                    Submitted
                  </Badge>
                )}
                {submission?.missing && <Badge variant="destructive">Missing</Badge>}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {/* First Move button inside content — NOT in trigger (nested buttons crash) */}
              {!submission?.submittedAt && (submission?.score === null || submission?.score === undefined) && (
                <div className="pb-3">
                  <FirstMoveButton assignment={assignment} />
                </div>
              )}
              <AssignmentDetail assignment={assignment} submission={submission} />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

// --- What-If Calculator ---

interface WhatIfCalculatorProps {
  assignments: Assignment[];
  submissions: Submission[];
  currentGrade: number | null;
  allAssignments: Assignment[];
  allSubmissions: Submission[];
}

function WhatIfCalculator({
  assignments,
  submissions,
  currentGrade,
  allAssignments,
  allSubmissions,
}: WhatIfCalculatorProps) {
  const [hypotheticalScores, setHypotheticalScores] = useState<Record<string, number>>({});

  // All assignments with points
  const eligibleAssignments = allAssignments.filter(a => a.pointsPossible > 0);

  // Split into graded and ungraded
  const gradedAssignments = eligibleAssignments.filter(a => {
    const sub = allSubmissions.find(s => s.assignmentId === a.id);
    return sub?.score !== null && sub?.score !== undefined;
  });
  const ungradedAssignments = eligibleAssignments.filter(a => {
    const sub = allSubmissions.find(s => s.assignmentId === a.id);
    return sub?.score === null || sub?.score === undefined;
  });

  // Projected grade using hypothetical overrides
  const projectedGrade = useMemo(() => {
    let totalEarned = 0;
    let totalPossible = 0;
    for (const a of eligibleAssignments) {
      if (!a.pointsPossible) continue;
      const hypo = hypotheticalScores[a.id];
      if (hypo !== undefined) {
        totalEarned += Math.min(hypo, a.pointsPossible);
        totalPossible += a.pointsPossible;
      } else {
        const sub = allSubmissions.find(s => s.assignmentId === a.id);
        const score = sub?.score ?? null;
        if (score !== null) {
          totalEarned += score;
          totalPossible += a.pointsPossible;
        }
      }
    }
    if (totalPossible === 0) return null;
    return Math.round((totalEarned / totalPossible) * 1000) / 10;
  }, [hypotheticalScores, eligibleAssignments, allSubmissions]);

  const delta = projectedGrade !== null && currentGrade !== null
    ? Math.round((projectedGrade - currentGrade) * 10) / 10
    : null;

  const hasAny = Object.keys(hypotheticalScores).length > 0;

  if (!eligibleAssignments || eligibleAssignments.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">Grade Simulator</CardTitle>
            <HelpTip text="Drag a slider on any upcoming assignment to see what your course grade would be if you scored that. Drag completed assignments to override your real score — useful for 'what if I had gotten an A on that test?' The projected grade updates live as you drag." />
          </div>
          {hasAny && (
            <button onClick={() => setHypotheticalScores({})} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
              Reset all
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Drag any slider to see how it affects your grade</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Grade summary bar */}
        <div className="flex items-center gap-4 p-3 bg-muted/40 rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground">Current</p>
            <p className={`text-lg font-bold grade-value ${getGradeColor(currentGrade)}`} data-grade="true">
              {currentGrade !== null ? `${currentGrade}%` : "N/A"}
            </p>
          </div>
          {projectedGrade !== null && (
            <>
              <div className="text-muted-foreground">→</div>
              <div>
                <p className="text-xs text-muted-foreground">Projected</p>
                <p className={`text-lg font-bold grade-value ${getGradeColor(projectedGrade)}`} data-grade="true">
                  {projectedGrade}%
                </p>
              </div>
              {delta !== null && (
                <div>
                  <p className="text-xs text-muted-foreground">Change</p>
                  <p className={`text-lg font-bold ${delta >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {delta >= 0 ? "+" : ""}{delta}%
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Upcoming assignments */}
        {ungradedAssignments.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upcoming — what if I score...</p>
            {ungradedAssignments.map((a) => {
              const value = hypotheticalScores[a.id];
              const pct = value !== undefined ? Math.round((value / a.pointsPossible) * 100) : null;
              return (
                <div key={a.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm truncate flex-1 mr-2">{a.name}</p>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {value !== undefined ? `${value} / ${a.pointsPossible} pts` : `-- / ${a.pointsPossible} pts`}
                      {pct !== null && <span className="ml-1 text-muted-foreground">({pct}%)</span>}
                    </span>
                  </div>
                  <Slider
                    min={0} max={a.pointsPossible} step={0.5}
                    value={[value ?? 0]}
                    onValueChange={([v]) => setHypotheticalScores(prev => ({ ...prev, [a.id]: Math.round(v * 2) / 2 }))}
                    className="w-full cursor-pointer"
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Completed assignments - override */}
        {gradedAssignments.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completed — drag to override</p>
            {gradedAssignments.map((a) => {
              const realSub = allSubmissions.find(s => s.assignmentId === a.id);
              const realScore = realSub?.score ?? 0;
              const hypo = hypotheticalScores[a.id];
              const value = hypo !== undefined ? hypo : realScore;
              const isOverridden = hypo !== undefined && Math.abs(hypo - realScore) > 0.1;
              const pct = Math.round((value / a.pointsPossible) * 100);
              return (
                <div key={a.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm truncate flex-1 mr-2 ${isOverridden ? "font-medium" : "text-muted-foreground"}`}>
                      {a.name}
                      {isOverridden && <span className="ml-1.5 text-xs text-amber-500">overridden</span>}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isOverridden && (
                        <button className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                          onClick={() => { const n = {...hypotheticalScores}; delete n[a.id]; setHypotheticalScores(n); }}>
                          Reset
                        </button>
                      )}
                      <span className="text-xs text-muted-foreground">{value} / {a.pointsPossible} pts ({pct}%)</span>
                    </div>
                  </div>
                  <Slider
                    min={0} max={a.pointsPossible} step={0.5}
                    value={[value]}
                    onValueChange={([v]) => setHypotheticalScores(prev => ({ ...prev, [a.id]: Math.round(v * 2) / 2 }))}
                    className="w-full cursor-pointer"
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
// --- First Move Button (inline in course assignment list) ---

function FirstMoveButton({ assignment }: { assignment: Assignment }) {
  const [result, setResult] = useState<{ plain: string; firstStep: string; timeEstimate: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (result) return; // already loaded

    if (!hasAIKey()) {
      setError('Add your API key in Settings () to use First Move.');
      return;
    }

    setLoading(true);
    try {
      const prompt = `Assignment: "${assignment.name}"
Course: ${assignment.courseName || assignment.courseCode}
Points: ${assignment.pointsPossible}
Due: ${assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'No due date'}
Submission type: ${assignment.submissionTypes?.join(', ') || 'unknown'}
Description: ${assignment.description ? assignment.description.replace(/<[^>]+>/g, '').slice(0, 500) : 'No description provided'}`;

      const response = await callClaude(
        prompt,
        `You help students beat procrastination by making assignments feel small and concrete.
Given an assignment, return ONLY valid JSON with exactly these three fields:
{
  "plain": "One sentence in plain English describing what the student actually has to do — no academic jargon. Start with a verb.",
  "firstStep": "The single most concrete first physical action the student can take RIGHT NOW that takes under 2 minutes. One tiny action only.",
  "timeEstimate": "A realistic time estimate like 'About 45 minutes' or 'Plan for 2 hours'."
}
Return ONLY the JSON object. No explanation, no markdown, no extra text.`,
        400
      );
      const parsed = JSON.parse(response.replace(/```json|```/g, '').trim());
      if (parsed.plain && parsed.firstStep && parsed.timeEstimate) {
        setResult(parsed);
      }
    } catch {
      setError('Could not generate. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={handleClick}
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border cursor-pointer transition-colors ${
          open ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/20'
        }`}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
        How do I start?
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-72 bg-popover border border-border rounded-lg shadow-xl p-3 space-y-2.5">
          {error ? (
            <p className="text-xs text-red-500">{error}</p>
          ) : loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Thinking...
            </div>
          ) : result && (
            <>
              <p className="text-xs text-muted-foreground leading-relaxed">{result.plain}</p>
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Do this right now</p>
                <p className="text-sm font-medium leading-snug">{result.firstStep}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t border-border pt-2">
                <Clock className="h-3 w-3" />
                <span>{result.timeEstimate}</span>
              </div>
            </>
          )}
          <button onClick={() => setOpen(false)} className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer underline">
            Close
          </button>
        </div>
      )}
    </div>
  );
}


// --- Assignment Detail ---

function AssignmentDetail({
  assignment,
  submission,
}: {
  assignment: Assignment;
  submission?: Submission;
}) {
  const [chunks, setChunks] = useState<string[]>([]);
  const [checkedChunks, setCheckedChunks] = useState<Set<number>>(new Set());
  const [isChunking, setIsChunking] = useState(false);
  const [chunkError, setChunkError] = useState<string | null>(null);

  const handleBreakDown = async () => {
    if (!hasAIKey()) {
      setChunkError('Add your Anthropic API key in Integrations to use AI features.');
      return;
    }

    setIsChunking(true);
    setChunkError(null);

    try {
      const steps = await chunkAssignment(
        assignment.name,
        stripHtml(assignment.description || '')
      );
      setChunks(steps);
    } catch (error) {
      if (error instanceof Error && error.message === 'NO_API_KEY') {
        setChunkError('Add your Anthropic API key in Integrations to use AI features.');
      } else if (error instanceof Error && error.message === 'INVALID_API_KEY') {
        setChunkError('Invalid API key. Please check your Anthropic API key.');
      } else {
        setChunkError('Failed to break down assignment. Please try again.');
      }
    } finally {
      setIsChunking(false);
    }
  };

  const toggleChunk = (index: number) => {
    setCheckedChunks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  function stripHtml(html: string): string {
    if (typeof document === 'undefined') return html;
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  const progress =
    chunks.length > 0 ? Math.round((checkedChunks.size / chunks.length) * 100) : 0;

  return (
    <div className="space-y-4 pt-2">
      {assignment.description && (
        <div className="text-sm text-muted-foreground">
          <p className="line-clamp-3">{stripHtml(assignment.description)}</p>
        </div>
      )}

      <div className="space-y-2">
        {chunks.length === 0 ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBreakDown}
              disabled={isChunking}
            >
              <Sparkles className="w-3 h-3 mr-2" />
              {isChunking ? 'Breaking down...' : 'Break This Down'}
            </Button>
            {chunkError && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {chunkError}
              </p>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-[oklch(var(--grade-safe))] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </div>

            <div className="space-y-1">
              {chunks.map((chunk, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                    checkedChunks.has(i) ? 'bg-muted/30' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checkedChunks.has(i)}
                    onChange={() => toggleChunk(i)}
                    className="mt-0.5"
                  />
                  <span
                    className={`text-sm ${checkedChunks.has(i) ? 'line-through text-muted-foreground' : ''}`}
                  >
                    {chunk}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

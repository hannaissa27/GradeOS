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
import { ArrowLeft, Check, Sparkles, AlertCircle, ChevronDown, RotateCcw } from 'lucide-react';
import {
  courseColor,
  getGradeColor,
  gradeToLetter,
  formatDueDate,
  getDueDateColor,
  getAssignmentTypeBadge,
  computeProjectedGrade,
} from '@/lib/gradeUtils';
import { hasAIKey, chunkAssignment } from '@/lib/aiUtils';
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
        <h2 className="text-lg font-semibold">Courses</h2>
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
                  className="text-left w-full rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors cursor-pointer p-4 group"
                  onClick={() => onSelectCourse(course.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: courseColor(course.id) }} />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate leading-tight">{course.name.includes(':') ? course.name.split(':').slice(1).join(':').trim().replace(/^(AP|IB|Honors|Accelerated) /i,'').trim() : course.name}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {course.currentGrade !== null ? (
                        <>
                          <p className={`text-xl font-bold grade-value ${getGradeColor(course.currentGrade)}`} data-grade="true">
                            {course.currentGrade}%
                          </p>
                          <p className={`text-xs ${getGradeColor(course.currentGrade)}`}>
                            {gradeToLetter(course.currentGrade)}
                          </p>
                        </>
                      ) : (
                        <p className="text-xl font-bold text-muted-foreground">N/A</p>
                      )}
                    </div>
                  </div>
                  {pending.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2.5">
                      {pending.length} assignment{pending.length !== 1 ? 's' : ''} due soon
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Course detail view
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
          style={{ backgroundColor: courseColor(selectedCourseId) }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{selectedCourse?.code}</p>
          <h1 className="text-lg font-semibold leading-tight truncate">{selectedCourse?.name}</h1>
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
  const [hypotheticalScores, setHypotheticalScores] = useState<Record<string, number | null>>({});

  const eligibleAssignments = allAssignments.filter(a => a.pointsPossible > 0);

  const projectedGrade = useMemo(() => {
    let totalEarned = 0;
    let totalPossible = 0;
    for (const a of eligibleAssignments) {
      if (!a.pointsPossible) continue;
      const hypo = hypotheticalScores[a.id];
      if (hypo !== null && hypo !== undefined) {
        totalEarned += Math.min(hypo, a.pointsPossible);
        totalPossible += a.pointsPossible;
      } else {
        const sub = allSubmissions.find(s => s.assignmentId === a.id);
        const score = sub?.score ?? (a as any).submissionScore ?? null;
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

  const hasAnyHypothetical = Object.values(hypotheticalScores).some(v => v !== null && v !== undefined);
  const handleReset = () => setHypotheticalScores({});

  const unsubmitted = eligibleAssignments.filter(a => {
    const sub = allSubmissions.find(s => s.assignmentId === a.id);
    return !sub?.submittedAt && (sub?.score === null || sub?.score === undefined);
  });
  const completed = eligibleAssignments.filter(a => {
    const sub = allSubmissions.find(s => s.assignmentId === a.id);
    return sub?.score !== null && sub?.score !== undefined;
  });

  if (eligibleAssignments.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">What-If Calculator</CardTitle>
          {hasAnyHypothetical && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs">
              <RotateCcw className="w-3 h-3 mr-1" />Reset all
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-6 text-sm p-3 bg-muted/50 rounded-lg sticky top-0 z-10">
          <div>
            <p className="text-xs text-muted-foreground">Current</p>
            <p className={`text-xl font-bold grade-value ${getGradeColor(currentGrade)}`} data-grade="true">
              {currentGrade !== null ? `${currentGrade}%` : "N/A"}
            </p>
          </div>
          {projectedGrade !== null && (
            <>
              <div className="text-muted-foreground text-lg">&rarr;</div>
              <div>
                <p className="text-xs text-muted-foreground">What-If</p>
                <p className={`text-xl font-bold grade-value ${getGradeColor(projectedGrade)}`} data-grade="true">
                  {projectedGrade}%
                </p>
              </div>
              {delta !== null && (
                <div>
                  <p className="text-xs text-muted-foreground">Delta</p>
                  <p className={`text-xl font-bold ${delta >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {delta >= 0 ? "+" : ""}{delta}%
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {unsubmitted.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upcoming</p>
            {unsubmitted.map((a) => {
              const value = hypotheticalScores[a.id];
              return (
                <div key={a.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate flex-1 mr-2">{a.name}</p>
                    <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
                      {value !== null && value !== undefined ? value : "--"} / {a.pointsPossible} pts
                    </span>
                  </div>
                  <Slider min={0} max={a.pointsPossible} step={1}
                    value={[value !== null && value !== undefined ? value : 0]}
                    onValueChange={([v]) => setHypotheticalScores(prev => ({ ...prev, [a.id]: v }))}
                    className="w-full" />
                </div>
              );
            })}
          </div>
        )}

        {completed.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completed — drag to override</p>
            {completed.map((a) => {
              const realSub = allSubmissions.find(s => s.assignmentId === a.id);
              const realScore = realSub?.score ?? null;
              const hypo = hypotheticalScores[a.id];
              const value = hypo !== undefined ? hypo : realScore;
              const isOverridden = hypo !== undefined && hypo !== realScore;
              return (
                <div key={a.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm truncate flex-1 mr-2 ${isOverridden ? "font-medium" : "text-muted-foreground"}`}>
                      {a.name}
                      {isOverridden && <span className="ml-1.5 text-xs text-amber-500">overridden</span>}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isOverridden && (
                        <button className="text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => { const n = {...hypotheticalScores}; delete n[a.id]; setHypotheticalScores(n); }}>
                          Reset
                        </button>
                      )}
                      <span className="text-xs font-mono text-muted-foreground">
                        {value !== null ? value : "--"} / {a.pointsPossible} pts
                      </span>
                    </div>
                  </div>
                  <Slider min={0} max={a.pointsPossible} step={1}
                    value={[value !== null ? value : 0]}
                    onValueChange={([v]) => setHypotheticalScores(prev => ({ ...prev, [a.id]: v }))}
                    className="w-full" />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
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

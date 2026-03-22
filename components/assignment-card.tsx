'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, Trash2, ChevronDown, Clock, AlertTriangle, Zap, Loader2 } from 'lucide-react';
import {
  courseColor,
  formatDueDate,
  getDueDateColor,
  minutesToLabel,
  getGradeColor,
} from '@/lib/gradeUtils';
import { getEffortOverride, setEffortOverride } from '@/lib/db-queries';
import { callClaude, hasAIKey } from '@/lib/aiUtils';
import type { Assignment, Submission } from '@/lib/types';

interface FirstMoveResult {
  plain: string;       // one sentence: what this actually is
  firstStep: string;   // the single first physical action
  timeEstimate: string; // "About 90 minutes"
}

interface AssignmentCardProps {
  assignment: Assignment;
  submission?: Submission;
  allAssignments?: Assignment[];
  allSubmissions?: Submission[];
  currentCourseGrade?: number | null;
  onEffortChange?: (assignmentId: string, minutes: number) => void;
  onStar?: (assignmentId: string, starred: boolean) => void;
  onTrash?: (assignmentId: string) => void;
  starredIds?: Set<string>;
  trashedIds?: Set<string>;
}

export function AssignmentCard({
  assignment,
  submission,
  allAssignments = [],
  allSubmissions = [],
  currentCourseGrade,
  onEffortChange,
  onStar,
  onTrash,
  starredIds = new Set(),
  trashedIds = new Set(),
}: AssignmentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [effortMinutes, setEffortMinutes] = useState<number>(60);
  const [savedEffort, setSavedEffort] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [whatIfScore, setWhatIfScore] = useState<number | null>(null);
  const [missingDismissed, setMissingDismissed] = useState(false);

  // First Move state
  const [firstMove, setFirstMove] = useState<FirstMoveResult | null>(null);
  const [firstMoveLoading, setFirstMoveLoading] = useState(false);
  const [firstMoveError, setFirstMoveError] = useState<string | null>(null);

  useEffect(() => {
    getEffortOverride(assignment.id).then(minutes => {
      if (minutes !== null) { setEffortMinutes(minutes); setSavedEffort(minutes); }
    }).catch(() => {});
  }, [assignment.id]);

  const handleFirstMove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (firstMove) {
      // Toggle off if already showing
      setFirstMove(null);
      return;
    }

    if (!hasAIKey()) {
      setFirstMoveError('Add your Anthropic API key in Settings to use First Move.');
      setIsExpanded(true);
      return;
    }

    setFirstMoveLoading(true);
    setFirstMoveError(null);
    setIsExpanded(true);

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
  "plain": "One sentence in plain English describing what the student actually has to do — no academic jargon, no rubric language. Start with a verb.",
  "firstStep": "The single most concrete first physical action the student can take RIGHT NOW that takes under 2 minutes. Not a plan. Not step 1 of 10. One tiny action. Examples: 'Open a Google Doc and type your name and the date at the top.' or 'Find your textbook and flip to the chapter listed in the assignment.' or 'Write one sentence answering the main question, even badly.'",
  "timeEstimate": "A realistic time estimate like 'About 45 minutes' or 'Plan for 2 hours'. Base it on the assignment type and point value."
}
Return ONLY the JSON object. No explanation, no markdown, no extra text.`,
        400
      );

      const cleaned = response.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (parsed.plain && parsed.firstStep && parsed.timeEstimate) {
        setFirstMove(parsed as FirstMoveResult);
      } else {
        throw new Error('Incomplete response');
      }
    } catch (err: any) {
      if (err.message === 'NO_API_KEY' || err.message === 'INVALID_API_KEY') {
        setFirstMoveError('Invalid API key. Check your key in Settings.');
      } else {
        setFirstMoveError('Could not generate. Try again.');
      }
    } finally {
      setFirstMoveLoading(false);
    }
  };

  const dueDateColorClass = getDueDateColor(assignment.dueDate);
  const isStarred = starredIds.has(assignment.id);
  const isMissing = submission?.missing && !missingDismissed;

  if (trashedIds.has(assignment.id)) return null;

  // Grade impact
  const totalPossible = allAssignments.reduce((s, a) => s + (a.pointsPossible || 0), 0);
  const gradeImpact = totalPossible > 0
    ? Math.round((assignment.pointsPossible / totalPossible) * 1000) / 10
    : null;

  // Per-card what-if
  const whatIfGrade = whatIfScore !== null ? (() => {
    let earned = 0, possible = 0;
    for (const a of allAssignments) {
      if (!a.pointsPossible) continue;
      if (a.id === assignment.id) { earned += whatIfScore; possible += a.pointsPossible; continue; }
      const sub = allSubmissions.find(s => s.assignmentId === a.id);
      const score = sub?.score ?? (a as any).submissionScore ?? null;
      if (score !== null) { earned += score; possible += a.pointsPossible; }
    }
    if (possible === 0) return null;
    return Math.round((earned / possible) * 1000) / 10;
  })() : null;

  const gradeDelta = whatIfGrade !== null && currentCourseGrade != null
    ? Math.round((whatIfGrade - currentCourseGrade) * 10) / 10
    : null;

  const rawName = assignment.courseName || assignment.courseCode;
  const courseDisplay = rawName.includes(':')
    ? rawName.split(':').slice(1).join(':').trim().replace(/^(AP|IB|Honors|Accelerated)\s+/i, '').trim()
    : rawName;

  return (
    <Card className={`overflow-hidden ${isStarred ? 'ring-1 ring-yellow-400/50' : ''}`}>
      <CardContent className="px-3 py-2">
        {/* Top row */}
        <div className="flex items-start gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2"
            style={{ backgroundColor: courseColor(assignment.courseId) }}
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm leading-snug truncate">{assignment.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap text-xs text-muted-foreground">
              <span className="truncate max-w-[120px]">{courseDisplay}</span>
              <span>·</span>
              <span>{assignment.pointsPossible} pts</span>
              {gradeImpact !== null && (
                <><span>·</span><span className="text-amber-500 dark:text-amber-400">{gradeImpact}% of grade</span></>
              )}
              {savedEffort !== null && (
                <><span>·</span><span className="text-muted-foreground">~{minutesToLabel(savedEffort)}</span></>
              )}
              <span>·</span>
              <span className={dueDateColorClass}>{formatDueDate(assignment.dueDate)}</span>
            </div>
            {isMissing && (
              <div className="flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                <span className="text-xs text-red-500">Marked missing</span>
                <button
                  onClick={() => setMissingDismissed(true)}
                  className="text-xs text-muted-foreground hover:text-foreground underline ml-1 cursor-pointer"
                >
                  dismiss
                </button>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* First Move button */}
            <button
              onClick={handleFirstMove}
              disabled={firstMoveLoading}
              className={`flex items-center gap-1 px-1.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                firstMove
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
              title="How do I start this?"
            >
              {firstMoveLoading
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Zap className="h-3 w-3" />
              }
              <span className="hidden sm:inline text-xs">How to start</span>
            </button>

            <button
              onClick={() => onStar?.(assignment.id, !isStarred)}
              className={`p-1 rounded hover:bg-accent transition-colors cursor-pointer ${isStarred ? 'text-yellow-400' : 'text-muted-foreground hover:text-yellow-400'}`}
              title={isStarred ? 'Unstar' : 'Star'}
            >
              <Star className="h-3 w-3" fill={isStarred ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={() => onTrash?.(assignment.id)}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-accent transition-colors cursor-pointer"
              title="Remove from queue"
            >
              <Trash2 className="h-3 w-3" />
            </button>
            <button
              onClick={() => setIsExpanded(v => !v)}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Expanded panel */}
        {isExpanded && (
          <div className="mt-2.5 pt-2.5 border-t border-border space-y-3">

            {/* First Move result */}
            {(firstMove || firstMoveError) && (
              <div className={`space-y-2.5 rounded-lg p-3 ${firstMove ? 'bg-primary/5 border border-primary/20' : 'bg-red-500/5 border border-red-500/20'}`}>
                {firstMoveError ? (
                  <p className="text-xs text-red-500">{firstMoveError}</p>
                ) : firstMove && (
                  <>
                    {/* What it actually is */}
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {firstMove.plain}
                    </p>

                    {/* The first step — hero element */}
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Do this right now</p>
                      <p className="text-sm font-medium leading-snug">{firstMove.firstStep}</p>
                    </div>

                    {/* Time estimate */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span>{firstMove.timeEstimate}</span>
                    </div>

                    <button
                      onClick={() => setFirstMove(null)}
                      className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer underline"
                    >
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Effort */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />Estimated effort
                </p>
                <span className="text-xs font-medium">
                  {minutesToLabel(effortMinutes)}
                  {isSaving && <span className="ml-1 opacity-50">saving...</span>}
                </span>
              </div>
              <Slider
                value={[effortMinutes]}
                onValueChange={([v]) => setEffortMinutes(v)}
                onValueCommit={([v]) => {
                  setIsSaving(true);
                  setEffortOverride(assignment.id, v)
                    .then(() => { setSavedEffort(v); onEffortChange?.(assignment.id, v); })
                    .catch(() => {})
                    .finally(() => setIsSaving(false));
                }}
                min={15} max={480} step={15}
                className="w-full cursor-pointer"
              />
            </div>

            {/* What-if */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <p className="text-xs text-muted-foreground">What if I score...</p>
                <span className="text-xs font-mono text-muted-foreground">
                  {whatIfScore !== null ? whatIfScore : '--'} / {assignment.pointsPossible} pts
                </span>
              </div>
              <Slider
                value={[whatIfScore ?? 0]}
                onValueChange={([v]) => setWhatIfScore(Math.round(v * 2) / 2)}
                min={0} max={assignment.pointsPossible} step={0.5}
                className="w-full cursor-pointer"
              />
              {whatIfGrade !== null && (
                <div className="flex items-center justify-between pt-1">
                  <div className="text-xs text-muted-foreground">
                    Course grade would be
                    <span className={`ml-1.5 font-bold text-sm ${getGradeColor(whatIfGrade)}`}>
                      {whatIfGrade}%
                    </span>
                    {gradeDelta !== null && (
                      <span className={`ml-1 ${gradeDelta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        ({gradeDelta >= 0 ? '+' : ''}{gradeDelta}%)
                      </span>
                    )}
                  </div>
                  <button className="text-xs text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setWhatIfScore(null)}>
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AssignmentCardSkeleton() {
  return (
    <Card>
      <CardContent className="px-3 py-2">
        <div className="flex items-start gap-2">
          <Skeleton className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

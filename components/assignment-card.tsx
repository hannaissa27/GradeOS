'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, Clock, AlertTriangle, Zap, Loader2 } from 'lucide-react';
import {
  courseColor,
  formatDueDate,
  getDueDateColor,
  minutesToLabel,
  getGradeColor,
} from '@/lib/gradeUtils';
import { getEffortOverride, setEffortOverride } from '@/lib/db-queries';
import { callClaude } from '@/lib/aiUtils';
import type { Assignment, Submission } from '@/lib/types';

interface FirstMoveResult {
  plain: string;         // what the assignment actually asks for
  deliverable: string;   // what to hand in
  hidden: string;        // buried requirements most students miss
  firstStep: string;     // one concrete action under 2 minutes
  timeEstimate: string;  // "About 90 minutes"
}

interface AssignmentCardProps {
  assignment: Assignment;
  submission?: Submission;
  allAssignments?: Assignment[];
  allSubmissions?: Submission[];
  currentCourseGrade?: number | null;
  onEffortChange?: (assignmentId: string, minutes: number) => void;
}

export function AssignmentCard({
  assignment,
  submission,
  allAssignments = [],
  allSubmissions = [],
  currentCourseGrade,
  onEffortChange,
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
        `You decode assignments so students understand them instantly. Given an assignment, return ONLY valid JSON:
{
  "plain": "One sentence: what the student actually has to do. No jargon. Start with a verb.",
  "deliverable": "What to hand in. Be specific: '500-word essay as PDF' or 'completed worksheet uploaded as image' or 'online quiz, 20 questions'.",
  "hidden": "One sentence about requirements students usually miss — formatting, citation style, specific sections to include, word counts buried in the description. If nothing hidden, say 'No hidden requirements — straightforward.'",
  "firstStep": "One concrete 2-minute action to start RIGHT NOW. Not a plan. One tiny physical action like 'Open a Google Doc and type your name at the top.'",
  "timeEstimate": "Realistic estimate like 'About 45 minutes' based on assignment type and points."
}
Return ONLY the JSON. No markdown, no explanation.`,
        500
      );

      const cleaned = response.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (parsed.plain && parsed.firstStep && parsed.timeEstimate) {
        setFirstMove({
          plain: parsed.plain,
          deliverable: parsed.deliverable || '',
          hidden: parsed.hidden || '',
          firstStep: parsed.firstStep,
          timeEstimate: parsed.timeEstimate,
        });
      } else {
        throw new Error('Incomplete response');
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('429') || msg.includes('rate')) {
        setFirstMoveError('AI is rate-limited. Try again in a minute.');
      } else {
        setFirstMoveError('Could not decode. Try again.');
      }
    } finally {
      setFirstMoveLoading(false);
    }
  };

  const dueDateColorClass = getDueDateColor(assignment.dueDate);
  const isMissing = submission?.missing && !missingDismissed;

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
    <Card className="overflow-hidden">
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
              <span className="hidden sm:inline text-xs">Decode</span>
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

            {/* Assignment Decoder result */}
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

                    {/* Deliverable */}
                    {firstMove.deliverable && (
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Hand in</p>
                        <p className="text-xs font-medium">{firstMove.deliverable}</p>
                      </div>
                    )}

                    {/* Hidden requirements */}
                    {firstMove.hidden && !firstMove.hidden.toLowerCase().includes('no hidden') && (
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500">Easy to miss</p>
                        <p className="text-xs text-muted-foreground">{firstMove.hidden}</p>
                      </div>
                    )}

                    {/* The first step — hero element */}
                    <div className="space-y-0.5 pt-1 border-t border-border/50">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Start now</p>
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

'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, Clock, AlertTriangle, Zap, Loader2, CheckCircle2 } from 'lucide-react';
import {
  courseColor,
  formatDueDate,
  getDueDateColor,
  minutesToLabel,
  getGradeColor,
} from '@/lib/gradeUtils';
import { callClaude, dismissMissing, undismissMissing } from '@/lib/aiUtils';
import type { Assignment, Submission } from '@/lib/types';

interface FirstMoveResult {
  plain: string;
  deliverable: string;
  hidden: string;
  firstStep: string;
  timeEstimate: string;
}

interface AssignmentCardProps {
  assignment: Assignment;
  submission?: Submission;
  allAssignments?: Assignment[];
  allSubmissions?: Submission[];
  currentCourseGrade?: number | null;
  aiEffortMinutes?: number;
  dismissedMissing?: Set<string>;
  onDismissedMissingChange?: () => void;
}

export function AssignmentCard({
  assignment,
  submission,
  allAssignments = [],
  allSubmissions = [],
  currentCourseGrade,
  aiEffortMinutes,
  dismissedMissing = new Set(),
  onDismissedMissingChange,
}: AssignmentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Decoder state
  const [firstMove, setFirstMove] = useState<FirstMoveResult | null>(null);
  const [firstMoveLoading, setFirstMoveLoading] = useState(false);
  const [firstMoveError, setFirstMoveError] = useState<string | null>(null);

  const handleFirstMove = async () => {
    if (firstMove) {
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
        `You decode assignments so students understand them instantly. Return ONLY valid JSON:
{
  "plain": "One sentence: what to do. Start with a verb.",
  "deliverable": "What to hand in. Be specific.",
  "hidden": "One sentence about easy-to-miss requirements, or 'Nothing hidden.' if straightforward.",
  "firstStep": "One 2-minute action to start RIGHT NOW.",
  "timeEstimate": "Realistic estimate like 'About 45 minutes'."
}
Return ONLY the JSON. No markdown.`,
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
  const isMissing = submission?.missing && !dismissedMissing.has(assignment.id);
  const wasDismissed = submission?.missing && dismissedMissing.has(assignment.id);

  // Grade impact
  const totalPossible = allAssignments.reduce((s, a) => s + (a.pointsPossible || 0), 0);
  const gradeImpact = totalPossible > 0
    ? Math.round((assignment.pointsPossible / totalPossible) * 1000) / 10
    : null;

  const rawName = assignment.courseName || assignment.courseCode;
  const courseDisplay = rawName.includes(':')
    ? rawName.split(':').slice(1).join(':').trim().replace(/^(AP|IB|Honors|Accelerated)\s+/i, '').trim()
    : rawName;

  const handleDismissMissing = () => {
    dismissMissing(assignment.id);
    onDismissedMissingChange?.();
  };

  const handleUndismissMissing = () => {
    undismissMissing(assignment.id);
    onDismissedMissingChange?.();
  };

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
              {gradeImpact !== null && gradeImpact >= 1 && (
                <><span>·</span><span className="text-amber-500 dark:text-amber-400">{gradeImpact}% of grade</span></>
              )}
              {aiEffortMinutes && (
                <><span>·</span><span className="text-muted-foreground">~{minutesToLabel(aiEffortMinutes)}</span></>
              )}
              <span>·</span>
              <span className={dueDateColorClass}>{formatDueDate(assignment.dueDate)}</span>
            </div>

            {/* Missing warning with persistent dismiss */}
            {isMissing && (
              <div className="flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                <span className="text-xs text-red-500">Marked missing</span>
                <button
                  onClick={handleDismissMissing}
                  className="text-xs text-muted-foreground hover:text-foreground underline ml-1 cursor-pointer flex items-center gap-0.5"
                >
                  <CheckCircle2 className="h-3 w-3" /> Mark as done
                </button>
              </div>
            )}
            {wasDismissed && (
              <div className="flex items-center gap-1 mt-1">
                <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                <span className="text-xs text-green-600 dark:text-green-400">Marked as done</span>
                <button
                  onClick={handleUndismissMissing}
                  className="text-xs text-muted-foreground hover:text-foreground underline ml-1 cursor-pointer"
                >
                  undo
                </button>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={handleFirstMove}
              disabled={firstMoveLoading}
              className={`flex items-center gap-1 px-1.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                firstMove
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
              title="Decode this assignment"
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

            {/* Decoder result */}
            {(firstMove || firstMoveError) && (
              <div className={`space-y-2.5 rounded-lg p-3 ${firstMove ? 'bg-primary/5 border border-primary/20' : 'bg-red-500/5 border border-red-500/20'}`}>
                {firstMoveError ? (
                  <p className="text-xs text-red-500">{firstMoveError}</p>
                ) : firstMove && (
                  <>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {firstMove.plain}
                    </p>

                    {firstMove.deliverable && (
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Hand in</p>
                        <p className="text-xs font-medium">{firstMove.deliverable}</p>
                      </div>
                    )}

                    {firstMove.hidden && !firstMove.hidden.toLowerCase().includes('no hidden') && !firstMove.hidden.toLowerCase().includes('nothing hidden') && (
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500">Easy to miss</p>
                        <p className="text-xs text-muted-foreground">{firstMove.hidden}</p>
                      </div>
                    )}

                    <div className="space-y-0.5 pt-1 border-t border-border/50">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Start now</p>
                      <p className="text-sm font-medium leading-snug">{firstMove.firstStep}</p>
                    </div>

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

            {/* AI effort estimate display */}
            {aiEffortMinutes && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>AI estimates ~{minutesToLabel(aiEffortMinutes)} of effort</span>
              </div>
            )}

            {/* Description preview */}
            {assignment.description && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3"
                dangerouslySetInnerHTML={{ __html: assignment.description.slice(0, 300) }}
              />
            )}
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

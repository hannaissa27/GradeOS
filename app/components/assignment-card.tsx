'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, Trash2, ChevronDown, Check, X, Clock, AlertTriangle } from 'lucide-react';
import {
  courseColor,
  formatDueDate,
  getDueDateColor,
  minutesToLabel,
  calculateROI,
  getGradeColor,
} from '@/lib/gradeUtils';
import { getEffortOverride, setEffortOverride } from '@/lib/db-queries';
import type { Assignment, Submission } from '@/lib/types';

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

  useEffect(() => {
    getEffortOverride(assignment.id).then(minutes => {
      if (minutes !== null) { setEffortMinutes(minutes); setSavedEffort(minutes); }
    }).catch(() => {});
  }, [assignment.id]);

  const handleSaveEffort = async () => {
    setIsSaving(true);
    try {
      await setEffortOverride(assignment.id, effortMinutes);
      setSavedEffort(effortMinutes);
      onEffortChange?.(assignment.id, effortMinutes);
    } catch {}
    finally { setIsSaving(false); }
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

  // Display name: prefer full course name, fall back to code
  const courseDisplay = assignment.courseName || assignment.courseCode;

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
                  title="Dismiss missing label"
                >
                  dismiss
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-0 flex-shrink-0">
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
            {/* Effort */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />Estimated effort
                </p>
                <span className="text-xs font-medium">{minutesToLabel(effortMinutes)}</span>
              </div>
              <Slider
                value={[effortMinutes]}
                onValueChange={([v]) => setEffortMinutes(v)}
                min={15} max={480} step={15}
                className="w-full cursor-pointer"
              />
              {effortMinutes !== (savedEffort ?? 60) && (
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEffortMinutes(savedEffort ?? 60)} disabled={isSaving}
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer px-2 py-1 rounded hover:bg-accent transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleSaveEffort} disabled={isSaving}
                    className="text-xs font-medium cursor-pointer px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                    Save
                  </button>
                </div>
              )}
            </div>

            {/* What-if */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <p className="text-xs text-muted-foreground">What if I score...</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">
                    {whatIfScore !== null ? whatIfScore : '--'} / {assignment.pointsPossible} pts
                  </span>
                  {whatIfGrade !== null && (
                    <span className={`text-xs font-bold ${getGradeColor(whatIfGrade)}`}>
                      → {whatIfGrade}%
                      {gradeDelta !== null && (
                        <span className={`ml-1 ${gradeDelta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          ({gradeDelta >= 0 ? '+' : ''}{gradeDelta}%)
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
              <Slider
                value={[whatIfScore ?? 0]}
                onValueChange={([v]) => setWhatIfScore(v)}
                min={0} max={assignment.pointsPossible} step={1}
                className="w-full cursor-pointer"
              />
              {whatIfScore !== null && (
                <button className="text-xs text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setWhatIfScore(null)}>
                  Clear
                </button>
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

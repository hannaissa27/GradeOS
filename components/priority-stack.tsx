'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, Clock, EyeOff, ChevronDown } from 'lucide-react';
import { HelpTip } from '@/components/help-tip';
import { AssignmentCard, AssignmentCardSkeleton } from './assignment-card';
import { calculateROI } from '@/lib/gradeUtils';
import { getIgnoredAssignments } from '@/lib/aiUtils';
import type { Assignment, Submission, Course } from '@/lib/types';

interface PriorityStackProps {
  assignments: Assignment[];
  submissions: Submission[];
  courses?: Course[];
  isLoading?: boolean;
  effortEstimates?: Record<string, number>;
  dismissedMissing?: Set<string>;
  onDismissedMissingChange?: () => void;
  onIgnoredChange?: () => void;
}

type SortMode = 'roi' | 'urgency';

export function PriorityStack({
  assignments,
  submissions,
  courses = [],
  isLoading,
  effortEstimates = {},
  dismissedMissing = new Set(),
  onDismissedMissingChange,
  onIgnoredChange,
}: PriorityStackProps) {
  const [sortMode, setSortMode] = useState<SortMode>('urgency');
  const [ignoredAssignments, setIgnoredAssignments] = useState<Set<string>>(() => getIgnoredAssignments());
  const [showIgnored, setShowIgnored] = useState(false);

  const handleIgnoredChange = () => {
    setIgnoredAssignments(getIgnoredAssignments());
    onIgnoredChange?.();
  };

  const submissionMap = useMemo(() =>
    new Map(submissions.map(s => [s.assignmentId, s])),
    [submissions]
  );

  const pendingAssignments = useMemo(() => {
    return assignments.filter(a => {
      const sub = submissionMap.get(a.id);
      if (sub?.submittedAt) return false;
      if (sub?.score !== null && sub?.score !== undefined) return false;
      if (sub?.excused) return false;
      return true;
    });
  }, [assignments, submissionMap]);

  const visibleAssignments = useMemo(() =>
    pendingAssignments.filter(a => !ignoredAssignments.has(a.id)),
    [pendingAssignments, ignoredAssignments]
  );

  const hiddenAssignments = useMemo(() =>
    pendingAssignments.filter(a => ignoredAssignments.has(a.id)),
    [pendingAssignments, ignoredAssignments]
  );

  const sortedAssignments = useMemo(() => {
    const sorted = [...visibleAssignments];
    if (sortMode === 'roi') {
      sorted.sort((a, b) => {
        const effortA = effortEstimates[a.id] || 60;
        const effortB = effortEstimates[b.id] || 60;
        return calculateROI(b.pointsPossible, effortB) - calculateROI(a.pointsPossible, effortA);
      });
    } else {
      sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    }
    return sorted;
  }, [visibleAssignments, sortMode, effortEstimates]);

  const getCourseGrade = (assignment: Assignment): number | null => {
    const course = courses.find(c => c.id === assignment.courseId);
    return course?.currentGrade ?? null;
  };

  const getCourseAssignments = (assignment: Assignment) =>
    assignments.filter(a => a.courseId === assignment.courseId);

  const getCourseSubmissions = (assignment: Assignment) =>
    submissions.filter(s => s.courseId === assignment.courseId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Assignments</h3>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <AssignmentCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-sm">Assignments</h3>
            <HelpTip text="Your pending assignments sorted by priority. High value uses AI-estimated effort to find assignments with the most grade impact per hour. Due soonest sorts by deadline. Click the eye-off icon on any assignment to hide it from this list and from AI calculations." />
          </div>
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={sortMode === 'urgency' ? 'secondary' : 'ghost'} size="sm"
                  onClick={() => setSortMode('urgency')} className="h-7 px-2 text-xs">
                  <Clock className="h-3 w-3 mr-1" />Due soonest
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Sort by due date</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={sortMode === 'roi' ? 'secondary' : 'ghost'} size="sm"
                  onClick={() => setSortMode('roi')} className="h-7 px-2 text-xs">
                  <TrendingUp className="h-3 w-3 mr-1" />High value
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Most grade impact per hour (AI-estimated effort)</p></TooltipContent>
            </Tooltip>
          </div>
        </div>

        {sortedAssignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-1.5">
            <p className="text-sm font-medium">All caught up</p>
            <p className="text-xs text-muted-foreground">No pending assignments right now.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedAssignments.map(assignment => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                submission={submissionMap.get(assignment.id)}
                allAssignments={getCourseAssignments(assignment)}
                allSubmissions={getCourseSubmissions(assignment)}
                currentCourseGrade={getCourseGrade(assignment)}
                aiEffortMinutes={effortEstimates[assignment.id]}
                dismissedMissing={dismissedMissing}
                onDismissedMissingChange={onDismissedMissingChange}
                ignoredAssignments={ignoredAssignments}
                onIgnoredChange={handleIgnoredChange}
              />
            ))}
          </div>
        )}

        {/* Hidden assignments section */}
        {hiddenAssignments.length > 0 && (
          <div className="pt-1">
            <button
              onClick={() => setShowIgnored(v => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <EyeOff className="h-3 w-3" />
              <span>{hiddenAssignments.length} hidden assignment{hiddenAssignments.length !== 1 ? 's' : ''} (ignored by AI)</span>
              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${showIgnored ? 'rotate-180' : ''}`} />
            </button>
            {showIgnored && (
              <div className="space-y-2 mt-2 opacity-60">
                {hiddenAssignments.map(assignment => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    submission={submissionMap.get(assignment.id)}
                    allAssignments={getCourseAssignments(assignment)}
                    allSubmissions={getCourseSubmissions(assignment)}
                    currentCourseGrade={getCourseGrade(assignment)}
                    aiEffortMinutes={effortEstimates[assignment.id]}
                    dismissedMissing={dismissedMissing}
                    onDismissedMissingChange={onDismissedMissingChange}
                    ignoredAssignments={ignoredAssignments}
                    onIgnoredChange={handleIgnoredChange}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

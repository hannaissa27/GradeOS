'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, Clock, Star, Trash2 } from 'lucide-react';
import { HelpTip } from '@/components/help-tip';
import { AssignmentCard, AssignmentCardSkeleton } from './assignment-card';
import { calculateROI } from '@/lib/gradeUtils';
import { getAllEffortOverrides } from '@/lib/db-queries';
import type { Assignment, Submission, Course } from '@/lib/types';

interface PriorityStackProps {
  assignments: Assignment[];
  submissions: Submission[];
  courses?: Course[];
  isLoading?: boolean;
  effortOverrides?: Map<string, number>;
  onEffortChange?: (assignmentId: string, minutes: number) => void;
}

type SortMode = 'roi' | 'urgency';
type ViewMode = 'queue' | 'starred' | 'trash';

export function PriorityStack({ assignments, submissions, courses = [], isLoading, effortOverrides: externalOverrides, onEffortChange: externalOnEffortChange }: PriorityStackProps) {
  const [sortMode, setSortMode] = useState<SortMode>('roi');
  const [showTop3, setShowTop3] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('queue');
  const [localEffortOverrides, setLocalEffortOverrides] = useState<Map<string, number>>(new Map());
  // Use external overrides if provided (shared with CrunchForecast), else use local
  const effortOverrides = externalOverrides ?? localEffortOverrides;
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [trashedIds, setTrashedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getAllEffortOverrides().then(setLocalEffortOverrides).catch(() => {});
    // Load persisted starred/trashed from localStorage
    try {
      const savedStarred = JSON.parse(localStorage.getItem('gradeos-starred') || '[]');
      const savedTrashed = JSON.parse(localStorage.getItem('gradeos-trashed') || '[]');
      setStarredIds(new Set(savedStarred));
      setTrashedIds(new Set(savedTrashed));
    } catch {}
  }, []);

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

  const sortedAssignments = useMemo(() => {
    const sorted = [...pendingAssignments];
    if (sortMode === 'roi') {
      sorted.sort((a, b) => {
        const roiA = calculateROI(a.pointsPossible, effortOverrides.get(a.id) ?? 60);
        const roiB = calculateROI(b.pointsPossible, effortOverrides.get(b.id) ?? 60);
        return roiB - roiA;
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
  }, [pendingAssignments, sortMode, effortOverrides]);

  const handleEffortChange = (assignmentId: string, minutes: number) => {
    setLocalEffortOverrides(prev => {
      const next = new Map(prev);
      next.set(assignmentId, minutes);
      return next;
    });
    externalOnEffortChange?.(assignmentId, minutes);
  };

  const handleStar = (assignmentId: string, starred: boolean) => {
    setStarredIds(prev => {
      const next = new Set(prev);
      starred ? next.add(assignmentId) : next.delete(assignmentId);
      localStorage.setItem('gradeos-starred', JSON.stringify([...next]));
      return next;
    });
  };

  const handleTrash = (assignmentId: string) => {
    setTrashedIds(prev => {
      const next = new Set(prev);
      next.add(assignmentId);
      localStorage.setItem('gradeos-trashed', JSON.stringify([...next]));
      return next;
    });
  };

  const handleRestore = (assignmentId: string) => {
    setTrashedIds(prev => {
      const next = new Set(prev);
      next.delete(assignmentId);
      localStorage.setItem('gradeos-trashed', JSON.stringify([...next]));
      return next;
    });
  };

  const handleClearTrash = () => {
    setTrashedIds(new Set());
    localStorage.setItem('gradeos-trashed', '[]');
  };

  // Get course grade for a given assignment
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
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Assignments</h3>
        </div>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <AssignmentCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  const visibleAssignments = viewMode === 'starred'
    ? sortedAssignments.filter(a => starredIds.has(a.id) && !trashedIds.has(a.id))
    : viewMode === 'trash'
    ? sortedAssignments.filter(a => trashedIds.has(a.id))
    : sortedAssignments.filter(a => !trashedIds.has(a.id));

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold text-sm">Assignments</h3>
          <HelpTip text="Your pending assignments sorted by priority. ROI sort puts the highest-value assignments (most grade impact per hour of effort) at the top so you work on what matters most first. Urgency sort puts soonest-due assignments first. Expand any card to set effort estimate or simulate your grade." />
        </div>
        <div className="flex items-center gap-1.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={sortMode === 'urgency' && !showTop3 ? 'secondary' : 'ghost'} size="sm"
                  onClick={() => { setSortMode('urgency'); setShowTop3(false); }} className="h-7 px-2 text-xs">
                  <Clock className="h-3 w-3 mr-1" />Due soonest
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Sort by due date</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={sortMode === 'roi' && !showTop3 ? 'secondary' : 'ghost'} size="sm"
                  onClick={() => { setSortMode('roi'); setShowTop3(false); }} className="h-7 px-2 text-xs">
                  <TrendingUp className="h-3 w-3 mr-1" />High value
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Assignments that give the most grade impact per hour of effort</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={showTop3 ? 'secondary' : 'ghost'} size="sm"
                  onClick={() => setShowTop3(v => !v)} className="h-7 px-2 text-xs">
                  Top 3
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Shows your 3 most urgent assignments — set effort estimates on each card to unlock High value sort</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* View mode tabs */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setViewMode('queue')}
          className={`text-xs px-2 py-1 rounded transition-colors ${viewMode === 'queue' ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground'}`}
        >
          All ({sortedAssignments.filter(a => !trashedIds.has(a.id)).length})
        </button>
        <button
          onClick={() => setViewMode('starred')}
          className={`text-xs px-2 py-1 rounded transition-colors flex items-center gap-1 ${viewMode === 'starred' ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Star className="h-2.5 w-2.5" />
          Starred ({starredIds.size})
        </button>
        <button
          onClick={() => setViewMode('trash')}
          className={`text-xs px-2 py-1 rounded transition-colors flex items-center gap-1 ${viewMode === 'trash' ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Trash2 className="h-2.5 w-2.5" />
          Removed ({trashedIds.size})
        </button>
      </div>

      {/* Trash view actions */}
      {viewMode === 'trash' && trashedIds.size > 0 && (
        <Button variant="outline" size="sm" onClick={handleClearTrash} className="h-7 text-xs">
          Clear all removed
        </Button>
      )}

      {/* Cards */}
      {showTop3 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Your 3 most urgent assignments right now:</p>
          {sortedAssignments.filter(a => !trashedIds.has(a.id)).slice(0, 3).map(a => {
            const hasEffort = effortOverrides.has(a.id);
            return (
              <div key={a.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-card">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.courseCode} · {a.dueDate ? new Date(a.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {!hasEffort && (
                    <span className="text-[10px] text-amber-500">Set effort to rank</span>
                  )}
                  <span className="text-xs font-medium">{a.pointsPossible}pts</span>
                </div>
              </div>
            );
          })}
          {!sortedAssignments.some(a => effortOverrides.has(a.id)) && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
              High value sorting requires effort estimates. Expand any assignment and set how long it will take.
            </p>
          )}
          <button onClick={() => setShowTop3(false)} className="text-xs text-muted-foreground underline cursor-pointer">Show all assignments</button>
        </div>
      ) : visibleAssignments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-1.5">
          {viewMode === 'queue' ? (
            <>
              <p className="text-sm font-medium">All caught up</p>
              <p className="text-xs text-muted-foreground">No pending assignments right now.</p>
            </>
          ) : viewMode === 'starred' ? (
            <>
              <p className="text-sm text-muted-foreground">No starred assignments yet</p>
              <p className="text-xs text-muted-foreground">Star any assignment to pin it here.</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing removed.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleAssignments.map(assignment => (
            viewMode === 'trash' ? (
              <div key={assignment.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{assignment.name}</p>
                  <p className="text-xs text-muted-foreground">{assignment.courseCode}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRestore(assignment.id)} className="h-7 text-xs ml-2">
                  Restore
                </Button>
              </div>
            ) : (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                submission={submissionMap.get(assignment.id)}
                allAssignments={getCourseAssignments(assignment)}
                allSubmissions={getCourseSubmissions(assignment)}
                currentCourseGrade={getCourseGrade(assignment)}
                onEffortChange={handleEffortChange}
                onStar={handleStar}
                onTrash={handleTrash}
                starredIds={starredIds}
                trashedIds={trashedIds}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
}

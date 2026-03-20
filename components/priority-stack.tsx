'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, Clock, Star, Trash2 } from 'lucide-react';
import { AssignmentCard, AssignmentCardSkeleton } from './assignment-card';
import { calculateROI } from '@/lib/gradeUtils';
import { getAllEffortOverrides } from '@/lib/db-queries';
import type { Assignment, Submission, Course } from '@/lib/types';

interface PriorityStackProps {
  assignments: Assignment[];
  submissions: Submission[];
  courses?: Course[];
  isLoading?: boolean;
}

type SortMode = 'roi' | 'urgency';
type ViewMode = 'queue' | 'starred' | 'trash';

export function PriorityStack({ assignments, submissions, courses = [], isLoading }: PriorityStackProps) {
  const [sortMode, setSortMode] = useState<SortMode>('roi');
  const [viewMode, setViewMode] = useState<ViewMode>('queue');
  const [effortOverrides, setEffortOverrides] = useState<Map<string, number>>(new Map());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [trashedIds, setTrashedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getAllEffortOverrides().then(setEffortOverrides).catch(() => {});
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
    setEffortOverrides(prev => {
      const next = new Map(prev);
      next.set(assignmentId, minutes);
      return next;
    });
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
          <h3 className="font-semibold text-sm">Priority Queue</h3>
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
        <h3 className="font-semibold text-sm">Priority Queue</h3>
        <TooltipProvider>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={sortMode === 'roi' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSortMode('roi')}
                  className="h-7 px-2"
                >
                  <TrendingUp className="h-3 w-3 mr-1" />ROI
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Sort by grade points per hour</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={sortMode === 'urgency' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSortMode('urgency')}
                  className="h-7 px-2"
                >
                  <Clock className="h-3 w-3 mr-1" />Urgency
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Sort by due date</p></TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
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
      {visibleAssignments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <p className="text-sm">
            {viewMode === 'starred' ? 'No starred assignments' :
             viewMode === 'trash' ? 'Nothing removed' :
             'No pending assignments'}
          </p>
          {viewMode === 'queue' && <p className="text-xs mt-1">You're all caught up!</p>}
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

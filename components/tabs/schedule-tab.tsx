'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getTimeBlocks, createTimeBlock, deleteTimeBlock, getAllEffortOverrides, getTodos } from '@/lib/db-queries';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Trash2, GripVertical, Pin, PinOff } from 'lucide-react';
import { courseColor, formatDueDate, minutesToLabel } from '@/lib/gradeUtils';
import type { Assignment, Submission, Course, TimeBlock, Todo } from '@/lib/types';

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CELL_HEIGHT = 56;

interface ScheduleTabProps {
  courses?: Course[];
  allAssignments?: Assignment[];
  allSubmissions?: Submission[];
  isLoading?: boolean;
}

export function ScheduleTab({
  courses = [],
  allAssignments = [],
  allSubmissions = [],
  isLoading = false,
}: ScheduleTabProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [effortOverrides, setEffortOverrides] = useState<Map<string, number>>(new Map());
  const [blocksLoading, setBlocksLoading] = useState(true);
  const [draggedAssignment, setDraggedAssignment] = useState<Assignment | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('gradeos-schedule-pinned') || '[]');
      setPinnedIds(new Set(saved));
    } catch {}
  }, []);

  const weekDates = useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + weekOffset * 7);
    startOfWeek.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });
  }, [weekOffset]);

  const weekStart = weekDates[0];
  const weekEnd = new Date(weekDates[6]);
  weekEnd.setHours(23, 59, 59, 999);

  // Only load time blocks (not assignments — those come from props)
  useEffect(() => {
    setBlocksLoading(true);
    Promise.all([
      getTimeBlocks(weekStart, weekEnd),
      getAllEffortOverrides(),
      getTodos(),
    ]).then(([blocks, overrides, todoList]) => {
      setTimeBlocks(blocks);
      setEffortOverrides(overrides);
      setTodos(todoList.filter(t => !t.completed && t.dueDate));
    }).catch(() => {}).finally(() => setBlocksLoading(false));
  }, [weekOffset]);

  const submissionMap = useMemo(() =>
    new Map(allSubmissions.map(s => [s.assignmentId, s])),
    [allSubmissions]
  );

  const pendingAssignments = useMemo(() => {
    return allAssignments
      .filter(a => {
        const sub = submissionMap.get(a.id);
        return !sub?.submittedAt && !sub?.excused && (sub?.score === null || sub?.score === undefined);
      })
      .sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  }, [allAssignments, submissionMap]);

  // Pinned = assignments explicitly added to schedule list
  const pinnedAssignments = pendingAssignments.filter(a => pinnedIds.has(a.id));
  // Unpinned shown in suggestion pool
  const unpinnedAssignments = pendingAssignments.filter(a => !pinnedIds.has(a.id));

  const handlePin = (assignmentId: string) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      next.has(assignmentId) ? next.delete(assignmentId) : next.add(assignmentId);
      localStorage.setItem('gradeos-schedule-pinned', JSON.stringify([...next]));
      return next;
    });
  };


  const handleDrop = async (dayIndex: number, hour: number) => {
    if (!draggedAssignment) return;
    const startTime = new Date(weekDates[dayIndex]);
    startTime.setHours(hour, 0, 0, 0);
    const effortMinutes = effortOverrides.get(draggedAssignment.id) ?? 60;
    const endTime = new Date(startTime.getTime() + effortMinutes * 60 * 1000);

    // Add block to UI immediately (optimistic)
    const localBlock: TimeBlock = {
      id: `local-${Date.now()}`,
      assignmentId: draggedAssignment.id,
      courseId: draggedAssignment.courseId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      createdAt: new Date().toISOString(),
    };
    setTimeBlocks(prev => [...prev, localBlock]);
    setDropError(null);
    setDraggedAssignment(null);

    // Try to persist in background — silent failure
    try {
      const saved = await createTimeBlock(draggedAssignment.id, draggedAssignment.courseId, startTime, endTime);
      setTimeBlocks(prev => prev.map(b => b.id === localBlock.id ? saved : b));
    } catch {
      // Keep local block for this session — no error shown
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    // Remove from UI immediately
    setTimeBlocks(prev => prev.filter(b => b.id !== blockId));
    // Only try Supabase delete for non-local blocks
    if (!blockId.startsWith('local-')) {
      try {
        await deleteTimeBlock(blockId);
      } catch (e) {
        console.warn('Could not delete from Supabase:', e);
      }
    }
  };

  const getBlocksForSlot = (dayIndex: number, hour: number) => {
    const slotStart = new Date(weekDates[dayIndex]);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
    return timeBlocks.filter(block => {
      const blockStart = new Date(block.startTime);
      return blockStart >= slotStart && blockStart < slotEnd;
    });
  };

  const pendingCount = pendingAssignments.length;
  const pinnedCount = pinnedIds.size;

  if (isLoading || blocksLoading) {
    return (
      <div className="flex gap-4">
        <div className="w-64 flex-shrink-0 space-y-2">
          <Skeleton className="h-6 w-40" />
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
        <Skeleton className="flex-1 h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* How to use explainer */}
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-1">
        <p className="text-sm font-medium">How to use My Week</p>
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p><span className="font-medium text-foreground">Step 1</span> — Pin assignments from the list on the left using the pin icon.</p>
          <p><span className="font-medium text-foreground">Step 2</span> — Drag pinned assignments onto the calendar to plan study sessions.</p>
          <p><span className="font-medium text-foreground">Step 3</span> — Click any block on the calendar to remove it.</p>
        </div>
      </div>

    <div className="flex gap-4 h-[calc(100vh-240px)]">
      {/* Left sidebar */}
      <div className="w-64 flex-shrink-0 overflow-y-auto space-y-4">

        {/* Pinned to schedule */}
        <div>
          <h3 className="font-semibold text-sm mb-1">My Schedule List</h3>
          <p className="text-xs text-muted-foreground mb-2">Drag these onto the calendar →</p>
          {pinnedAssignments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">
              Pin assignments below to add them here, then drag to calendar
            </p>
          ) : (
            <div className="space-y-1.5">
              {pinnedAssignments.map(a => {
                const effort = effortOverrides.get(a.id) ?? 60;
                return (
                  <Card key={a.id} className="cursor-grab active:cursor-grabbing"
                    draggable onDragStart={() => setDraggedAssignment(a)} onDragEnd={() => setDraggedAssignment(null)}>
                    <CardContent className="px-3 py-2">
                      <div className="flex items-start gap-2">
                        <GripVertical className="w-3 h-3 text-muted-foreground mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: courseColor(a.courseId) }} />
                            <span className="text-xs text-muted-foreground truncate">{a.courseCode}</span>
                          </div>
                          <p className="text-xs font-medium truncate">{a.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{minutesToLabel(effort)} · {formatDueDate(a.dueDate)}</p>
                        </div>
                        <button onClick={() => handlePin(a.id)} className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5" title="Unpin">
                          <PinOff className="h-3 w-3" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Assignment pool */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">All Pending</h3>
          <div className="space-y-1.5">
            {unpinnedAssignments.slice(0, 15).map(a => (
              <div key={a.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: courseColor(a.courseId) }} />
                  <p className="text-xs truncate">{a.name}</p>
                </div>
                <button onClick={() => handlePin(a.id)} className="text-muted-foreground hover:text-foreground cursor-pointer flex-shrink-0 p-0.5" title="Add to schedule list">
                  <Pin className="h-3 w-3" />
                </button>
              </div>
            ))}
            {unpinnedAssignments.length === 0 && pinnedAssignments.length > 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">All pinned</p>
            )}
            {pendingAssignments.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No pending assignments</p>
            )}
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-auto">
        <div className="flex items-center justify-between mb-3 sticky top-0 bg-background z-10 pb-2">
          <button onClick={() => setWeekOffset(v => v - 1)} className="p-1.5 rounded hover:bg-accent transition-colors cursor-pointer">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium">
            {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <button onClick={() => setWeekOffset(v => v + 1)} className="p-1.5 rounded hover:bg-accent transition-colors cursor-pointer">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>



        <div className="grid grid-cols-8 border-l border-t border-border">
          <div className="border-r border-b border-border bg-muted/30 h-10" />
          {weekDates.map((date, i) => {
            const isToday = date.toDateString() === new Date().toDateString();
            // Todos due on this day
            const dayTodos = todos.filter(t => {
              if (!t.dueDate) return false;
              return new Date(t.dueDate).toDateString() === date.toDateString();
            });
            return (
              <div key={i} className={`border-r border-b border-border p-1.5 text-center ${isToday ? 'bg-primary/5' : 'bg-muted/30'}`}>
                <p className="text-xs text-muted-foreground">{DAYS[date.getDay()]}</p>
                <p className={`text-sm font-medium ${isToday ? 'text-primary' : ''}`}>{date.getDate()}</p>
                {dayTodos.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                    {dayTodos.slice(0, 2).map(t => (
                      <span key={t.id} className="text-[9px] bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded px-1 truncate max-w-[50px]">
                        {t.title}
                      </span>
                    ))}
                    {dayTodos.length > 2 && (
                      <span className="text-[9px] text-muted-foreground">+{dayTodos.length - 2}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {HOURS.map(hour => (
            <React.Fragment key={hour}>
              <div className="border-r border-b border-border px-2 text-xs text-muted-foreground text-right bg-muted/10 flex items-center justify-end" style={{ height: CELL_HEIGHT }}>
                {hour === 12 ? '12pm' : hour > 12 ? `${hour - 12}pm` : `${hour}am`}
              </div>
              {weekDates.map((_, dayIndex) => {
                const blocks = getBlocksForSlot(dayIndex, hour);
                const isToday = weekDates[dayIndex].toDateString() === new Date().toDateString();
                return (
                  <div
                    key={`${dayIndex}-${hour}`}
                    className={`border-r border-b border-border relative transition-colors ${isToday ? 'bg-primary/5' : ''} ${draggedAssignment ? 'hover:bg-accent/40 cursor-copy' : ''}`}
                    style={{ height: CELL_HEIGHT }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => handleDrop(dayIndex, hour)}
                  >
                    {blocks.map(block => {
                      const assignment = allAssignments.find(a => a.id === block.assignmentId);
                      if (!assignment) return null;
                      const startTime = new Date(block.startTime);
                      const endTime = new Date(block.endTime);
                      const durationMins = (endTime.getTime() - startTime.getTime()) / 60000;
                      const heightPx = Math.min((durationMins / 60) * CELL_HEIGHT, CELL_HEIGHT - 4);
                      return (
                        <Popover key={block.id}>
                          <PopoverTrigger asChild>
                            <div className="absolute inset-x-0.5 top-0.5 rounded p-1 text-xs cursor-pointer overflow-hidden"
                              style={{ backgroundColor: courseColor(assignment.courseId), height: heightPx, opacity: 0.9 }}>
                              <p className="font-medium truncate text-white text-[10px] drop-shadow-sm">{assignment.name}</p>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-56" align="start">
                            <div className="space-y-2">
                              <p className="font-medium text-sm">{assignment.name}</p>
                              <p className="text-xs text-muted-foreground">{assignment.courseCode}</p>
                              <p className="text-xs text-muted-foreground">
                                {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </p>
                              <Button variant="destructive" size="sm" className="w-full cursor-pointer" onClick={() => handleDeleteBlock(block.id)}>
                                <Trash2 className="w-3 h-3 mr-2" />Remove
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    })}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}

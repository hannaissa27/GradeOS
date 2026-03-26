'use client';

import React, { useState, useMemo } from 'react';
import { Slider } from '@/components/ui/slider';
import { courseColor, minutesToLabel, formatDueDate } from '@/lib/gradeUtils';
import { setEffortOverride } from '@/lib/db-queries';
import type { Assignment, Submission } from '@/lib/types';

interface CrunchForecastProps {
  assignments: Assignment[];
  submissions: Submission[];
  effortOverrides: Map<string, number>;
  trashedIds: Set<string>;
  onEffortSet: (assignmentId: string, minutes: number) => void;
}

const DEFAULT_CAPACITY_HOURS = 3;
const DAYS_AHEAD = 14;

export function CrunchForecast({
  assignments,
  submissions,
  effortOverrides,
  trashedIds,
  onEffortSet,
}: CrunchForecastProps) {
  const [capacityHours, setCapacityHours] = useState(DEFAULT_CAPACITY_HOURS);
  const [userShifts, setUserShifts] = useState<Map<string, number>>(new Map()); // assignmentId -> daysShifted

  const submissionMap = useMemo(() =>
    new Map(submissions.map(s => [s.assignmentId, s])),
    [submissions]
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build the 14-day window
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  // Get pending assignments with due dates in next 14 days
  const pendingAssignments = useMemo(() => {
    return assignments.filter(a => {
      if (trashedIds.has(a.id)) return false;
      const sub = submissionMap.get(a.id);
      if (sub?.submittedAt || sub?.excused) return false;
      if (sub?.score !== null && sub?.score !== undefined) return false;
      if (!a.dueDate) return false;
      const due = new Date(a.dueDate);
      due.setHours(23, 59, 59, 0);
      return due >= today && due <= new Date(today.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000);
    });
  }, [assignments, submissions, trashedIds]);

  // Assignments missing effort estimates
  const missingEffort = pendingAssignments.filter(a => !effortOverrides.has(a.id));

  // For each pending assignment, determine which day it's "scheduled" on
  // User can shift assignments to earlier days
  const getAssignmentDay = (a: Assignment): Date => {
    const shift = userShifts.get(a.id) ?? 0;
    const due = new Date(a.dueDate!);
    due.setHours(0, 0, 0, 0);
    const shifted = new Date(due);
    shifted.setDate(due.getDate() - shift);
    // Don't go before today
    if (shifted < today) return new Date(today);
    return shifted;
  };

  // Build day buckets
  const dayBuckets = useMemo(() => {
    const buckets = new Map<string, Assignment[]>();
    days.forEach(d => buckets.set(d.toDateString(), []));

    pendingAssignments.forEach(a => {
      const day = getAssignmentDay(a);
      const key = day.toDateString();
      if (buckets.has(key)) {
        buckets.get(key)!.push(a);
      }
    });
    return buckets;
  }, [pendingAssignments, userShifts, days]);

  // Calculate hours per day
  const getHoursForDay = (day: Date): number => {
    const assignments = dayBuckets.get(day.toDateString()) || [];
    return assignments.reduce((sum, a) => {
      const mins = effortOverrides.get(a.id) ?? 60;
      return sum + mins / 60;
    }, 0);
  };

  // Backfill suggestion: find overloaded days and suggest earlier slots
  const suggestions = useMemo(() => {
    const result: { assignmentId: string; fromDay: Date; toDay: Date; hoursNeeded: number }[] = [];

    days.forEach(day => {
      const hours = getHoursForDay(day);
      if (hours <= capacityHours) return;

      const overflow = hours - capacityHours;
      const dayAssignments = (dayBuckets.get(day.toDateString()) || [])
        .sort((a, b) => (effortOverrides.get(a.id) ?? 60) - (effortOverrides.get(b.id) ?? 60));

      let remaining = overflow;
      for (const a of dayAssignments) {
        if (remaining <= 0) break;
        const aHours = (effortOverrides.get(a.id) ?? 60) / 60;
        if (aHours <= remaining) {
          // Find an earlier day with capacity
          for (let i = days.indexOf(day) - 1; i >= 0; i--) {
            const candidateDay = days[i];
            const candidateHours = getHoursForDay(candidateDay);
            if (candidateHours + aHours <= capacityHours) {
              result.push({
                assignmentId: a.id,
                fromDay: day,
                toDay: candidateDay,
                hoursNeeded: aHours,
              });
              remaining -= aHours;
              break;
            }
          }
        }
      }
    });
    return result;
  }, [dayBuckets, days, capacityHours, effortOverrides]);

  const isToday = (d: Date) => d.toDateString() === new Date().toDateString();
  const isCrunch = (d: Date) => getHoursForDay(d) > capacityHours;
  const maxHours = Math.max(capacityHours + 1, ...days.map(d => getHoursForDay(d)));

  const handleShiftLeft = (assignmentId: string) => {
    setUserShifts(prev => {
      const next = new Map(prev);
      next.set(assignmentId, (next.get(assignmentId) ?? 0) + 1);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Effort nudge banner */}
      {missingEffort.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2">
            {missingEffort.length} assignment{missingEffort.length !== 1 ? 's' : ''} missing effort estimates — Workload Planner works best when all assignments have estimates
          </p>
          <div className="space-y-2">
            {missingEffort.slice(0, 4).map(a => (
              <EffortNudgeRow
                key={a.id}
                assignment={a}
                onSet={(mins) => onEffortSet(a.id, mins)}
              />
            ))}
            {missingEffort.length > 4 && (
              <p className="text-xs text-muted-foreground">+{missingEffort.length - 4} more — expand any card in the Priority Queue to set them</p>
            )}
          </div>
        </div>
      )}

      {/* Capacity control */}
      <div className="flex items-center gap-4">
        <p className="text-xs text-muted-foreground whitespace-nowrap">Daily capacity:</p>
        <Slider
          value={[capacityHours]}
          onValueChange={([v]) => setCapacityHours(v)}
          min={1} max={8} step={0.5}
          className="w-32 cursor-pointer"
        />
        <span className="text-xs font-medium whitespace-nowrap">{capacityHours}h / day</span>
      </div>

      {/* Timeline */}
      {pendingAssignments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No assignments due in the next 14 days.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-1 min-w-max pb-2">
            {days.map((day, i) => {
              const hoursForDay = getHoursForDay(day);
              const crunch = hoursForDay > capacityHours;
              const isEmpty = hoursForDay === 0;
              const barHeight = isEmpty ? 4 : Math.round((hoursForDay / maxHours) * 120);
              const capacityLinePos = Math.round((capacityHours / maxHours) * 120);
              const dayAssignments = dayBuckets.get(day.toDateString()) || [];
              const hasSuggestion = suggestions.some(s => dayAssignments.some(a => a.id === s.assignmentId));

              return (
                <div key={i} className="flex flex-col items-center gap-1" style={{ width: 64 }}>
                  {/* Day label */}
                  <p className={`text-[10px] font-medium ${isToday(day) ? 'text-primary' : 'text-muted-foreground'}`}>
                    {isToday(day) ? 'Today' : day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>

                  {/* Bar container */}
                  <div className="relative w-full flex flex-col-reverse" style={{ height: 128 }}>
                    {/* Capacity line */}
                    <div
                      className="absolute left-0 right-0 border-t border-dashed border-muted-foreground/40 z-10"
                      style={{ bottom: capacityLinePos }}
                    />

                    {/* Assignment blocks stacked */}
                    {dayAssignments.length === 0 ? (
                      <div className="w-full rounded-sm bg-muted/20" style={{ height: 4 }} />
                    ) : (
                      <div className="w-full flex flex-col-reverse gap-px">
                        {dayAssignments.map(a => {
                          const mins = effortOverrides.get(a.id) ?? 60;
                          const blockHeight = Math.max(8, Math.round((mins / 60 / maxHours) * 120));
                          const suggested = suggestions.find(s => s.assignmentId === a.id);
                          return (
                            <div
                              key={a.id}
                              className={`w-full rounded-sm relative group cursor-pointer transition-opacity hover:opacity-80 ${suggested ? 'opacity-60' : ''}`}
                              style={{
                                height: blockHeight,
                                backgroundColor: courseColor(a.courseId),
                                opacity: crunch && !suggested ? 0.9 : 0.5,
                              }}
                              title={`${a.name} — ${minutesToLabel(mins)}`}
                              onClick={() => suggested && handleShiftLeft(a.id)}
                            >
                              {blockHeight > 16 && (
                                <p className="text-[8px] text-white truncate px-1 py-0.5 leading-tight drop-shadow-sm">
                                  {a.name}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Crunch overlay */}
                    {crunch && (
                      <div className="absolute inset-0 rounded border border-red-500/40 bg-red-500/5 pointer-events-none" />
                    )}
                  </div>

                  {/* Hours label */}
                  {!isEmpty && (
                    <p className={`text-[10px] font-medium ${crunch ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {hoursForDay.toFixed(1)}h
                    </p>
                  )}

                  {/* Crunch label */}
                  {crunch && (
                    <p className="text-[9px] text-red-500 font-medium leading-tight text-center">CRUNCH</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Crunch day breakdown + suggestions */}
      {suggestions.length > 0 && (() => {
        // Group suggestions by the crunch day they fix
        const crunchDays = [...new Set(suggestions.map(s => s.fromDay.toDateString()))];
        return (
          <div className="space-y-3">
            <p className="text-xs font-semibold">Your overloaded days — here is how to split them:</p>
            {crunchDays.map(dayStr => {
              const daySuggestions = suggestions.filter(s => s.fromDay.toDateString() === dayStr);
              const day = daySuggestions[0].fromDay;
              const totalHours = getHoursForDay(day);
              return (
                <div key={dayStr} className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-red-500">
                      {day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-xs text-red-500">
                      {totalHours.toFixed(1)}h work vs {capacityHours}h limit
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Move these to earlier days to get under your {capacityHours}h limit:
                  </p>
                  {daySuggestions.map((s, i) => {
                    const a = pendingAssignments.find(x => x.id === s.assignmentId);
                    if (!a) return null;
                    const mins = effortOverrides.get(a.id) ?? 60;
                    return (
                      <div key={i} className="flex items-center justify-between gap-2 bg-background rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: courseColor(a.courseId) }} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{a.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {minutesToLabel(mins)} → move to {s.toDay.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleShiftLeft(s.assignmentId)}
                          className="text-xs px-3 py-1 rounded-lg bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors flex-shrink-0 font-medium"
                        >
                          Move it
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-8 border-t border-dashed border-muted-foreground/40" />
          <span>Daily capacity</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/40" />
          <span>Crunch day</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-muted" />
          <span>Free day</span>
        </div>
      </div>
    </div>
  );
}

// Small inline effort-setter for the nudge banner
function EffortNudgeRow({ assignment, onSet }: { assignment: Assignment; onSet: (mins: number) => void }) {
  const [mins, setMins] = useState(60);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await setEffortOverride(assignment.id, mins).catch(() => {});
    onSet(mins);
    setSaved(true);
  };

  if (saved) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: courseColor(assignment.courseId) }} />
        <p className="text-xs truncate">{assignment.name}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Slider
          value={[mins]}
          onValueChange={([v]) => setMins(v)}
          min={15} max={480} step={15}
          className="w-24 cursor-pointer"
        />
        <span className="text-xs w-20 text-muted-foreground">{minutesToLabel(mins)}</span>
        <button
          onClick={handleSave}
          className="text-[10px] px-2 py-0.5 rounded bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          Set
        </button>
      </div>
    </div>
  );
}

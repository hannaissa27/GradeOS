'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Target, TrendingUp, Plus } from 'lucide-react';
import { getGradeColor, gradeToLetter } from '@/lib/gradeUtils';
import type { Assignment, Submission } from '@/lib/types';

interface GradeRescueProps {
  currentGrade: number | null;
  assignments: Assignment[];
  submissions: Submission[];
}

interface FutureAssignment {
  id: string;
  name: string;
  pointsPossible: number;
  isCustom?: boolean;
}

export function GradeRescue({ currentGrade, assignments, submissions }: GradeRescueProps) {
  const [targetInput, setTargetInput] = useState('');
  const [customAssignments, setCustomAssignments] = useState<FutureAssignment[]>([]);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomPoints, setNewCustomPoints] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);

  const submissionMap = useMemo(() =>
    new Map(submissions.map(s => [s.assignmentId, s])),
    [submissions]
  );

  // Graded assignments — have a real score
  const gradedAssignments = useMemo(() =>
    assignments.filter(a => {
      const sub = submissionMap.get(a.id);
      return sub?.score !== null && sub?.score !== undefined;
    }),
    [assignments, submissionMap]
  );

  // Remaining: not yet graded, not excused
  const remainingAssignments = useMemo(() =>
    assignments.filter(a => {
      const sub = submissionMap.get(a.id);
      if (sub?.excused) return false;
      return sub?.score === null || sub?.score === undefined;
    }).filter(a => a.pointsPossible > 0),
    [assignments, submissionMap]
  );

  // All future assignments = Canvas remaining + custom ones added by user
  const allFuture: FutureAssignment[] = [
    ...remainingAssignments.map(a => ({ id: a.id, name: a.name, pointsPossible: a.pointsPossible })),
    ...customAssignments,
  ];

  // Points already earned
  const earnedPoints = useMemo(() => {
    let earned = 0;
    let possible = 0;
    for (const a of gradedAssignments) {
      const sub = submissionMap.get(a.id);
      if (sub?.score !== null && sub?.score !== undefined) {
        earned += sub.score;
        possible += a.pointsPossible;
      }
    }
    return { earned, possible };
  }, [gradedAssignments, submissionMap]);

  // Total points possible in the course (graded + remaining + custom)
  const totalPossible = earnedPoints.possible + allFuture.reduce((s, a) => s + a.pointsPossible, 0);
  const futurePossible = allFuture.reduce((s, a) => s + a.pointsPossible, 0);

  // --- Core math ---

  // Ceiling: if you get 100% on everything remaining
  const ceiling = totalPossible > 0
    ? Math.round(((earnedPoints.earned + futurePossible) / totalPossible) * 1000) / 10
    : null;

  // Projection: if you maintain your current average on everything remaining
  const currentAvgRate = earnedPoints.possible > 0 ? earnedPoints.earned / earnedPoints.possible : null;
  const projectedFinal = currentAvgRate !== null && totalPossible > 0
    ? Math.round(((earnedPoints.earned + currentAvgRate * futurePossible) / totalPossible) * 1000) / 10
    : null;

  // Target grade math
  const target = parseFloat(targetInput);
  const isValidTarget = !isNaN(target) && target >= 0 && target <= 100;

  const rescueCalc = useMemo(() => {
    if (!isValidTarget || totalPossible === 0 || allFuture.length === 0) return null;

    const neededTotal = (target / 100) * totalPossible;
    const neededFromFuture = neededTotal - earnedPoints.earned;

    // If already achieved
    if (neededFromFuture <= 0) {
      return { type: 'already_achieved' as const, neededRate: 0 };
    }

    // If impossible even with 100%
    if (neededFromFuture > futurePossible) {
      return { type: 'impossible' as const, neededRate: neededFromFuture / futurePossible };
    }

    const neededRate = neededFromFuture / futurePossible;

    // Per-assignment minimum scores needed (uniform rate across all remaining)
    const perAssignment = allFuture.map(a => ({
      ...a,
      neededScore: Math.ceil(neededRate * a.pointsPossible * 10) / 10,
      neededPercent: Math.round(neededRate * 100),
    }));

    return { type: 'achievable' as const, neededRate, neededFromFuture, perAssignment };
  }, [isValidTarget, target, totalPossible, earnedPoints, futurePossible, allFuture]);

  const handleAddCustom = () => {
    const pts = parseFloat(newCustomPoints);
    if (!newCustomName.trim() || isNaN(pts) || pts <= 0) return;
    setCustomAssignments(prev => [...prev, {
      id: `custom-${Date.now()}`,
      name: newCustomName.trim(),
      pointsPossible: pts,
      isCustom: true,
    }]);
    setNewCustomName('');
    setNewCustomPoints('');
    setShowAddCustom(false);
  };

  const removeCustom = (id: string) => {
    setCustomAssignments(prev => prev.filter(a => a.id !== id));
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Grade Rescue
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* The 3 key numbers — always visible */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Current</p>
            <p className={`text-2xl font-bold grade-value ${getGradeColor(currentGrade)}`} data-grade="true">
              {currentGrade !== null ? `${currentGrade}%` : '--'}
            </p>
            <p className="text-xs text-muted-foreground">{gradeToLetter(currentGrade)}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3" />If you keep going
            </p>
            <p className={`text-2xl font-bold grade-value ${getGradeColor(projectedFinal)}`} data-grade="true">
              {projectedFinal !== null ? `${projectedFinal}%` : '--'}
            </p>
            <p className="text-xs text-muted-foreground">{gradeToLetter(projectedFinal)}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />Best possible
            </p>
            <p className={`text-2xl font-bold grade-value ${getGradeColor(ceiling)}`} data-grade="true">
              {ceiling !== null ? `${ceiling}%` : '--'}
            </p>
            <p className="text-xs text-muted-foreground">{gradeToLetter(ceiling)}</p>
          </div>
        </div>

        {/* Remaining assignments summary */}
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{allFuture.length}</span> assignments remaining
          {' · '}<span className="font-medium text-foreground">{futurePossible} pts</span> still up for grabs
          {customAssignments.length > 0 && (
            <span className="ml-1 text-primary">({customAssignments.length} added manually)</span>
          )}
        </div>

        {/* Add future assignments not on Canvas */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">Missing assignments from Canvas?</p>
            <button
              onClick={() => setShowAddCustom(v => !v)}
              className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />Add manually
            </button>
          </div>
          {showAddCustom && (
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Assignment name"
                value={newCustomName}
                onChange={e => setNewCustomName(e.target.value)}
                className="h-7 text-xs flex-1"
                onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
              />
              <Input
                placeholder="Pts"
                value={newCustomPoints}
                onChange={e => setNewCustomPoints(e.target.value)}
                className="h-7 text-xs w-16"
                type="number"
                min="0"
                onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
              />
              <button
                onClick={handleAddCustom}
                className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors"
              >
                Add
              </button>
            </div>
          )}
          {customAssignments.length > 0 && (
            <div className="mt-2 space-y-1">
              {customAssignments.map(a => (
                <div key={a.id} className="flex items-center justify-between text-xs bg-primary/5 rounded px-2 py-1">
                  <span className="text-primary font-medium">{a.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{a.pointsPossible} pts</span>
                    <button onClick={() => removeCustom(a.id)} className="text-muted-foreground hover:text-destructive cursor-pointer">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Target input */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium whitespace-nowrap">I want to finish with</p>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="0"
                max="100"
                placeholder="85"
                value={targetInput}
                onChange={e => setTargetInput(e.target.value)}
                className="h-8 w-20 text-center text-sm font-bold"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            {isValidTarget && (
              <span className="text-sm text-muted-foreground">({gradeToLetter(target)})</span>
            )}
          </div>

          {/* Ceiling check */}
          {isValidTarget && ceiling !== null && target > ceiling && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Not mathematically possible</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Even if you score 100% on everything remaining, the highest you can finish is <strong>{ceiling}%</strong> ({gradeToLetter(ceiling)}).
                  {customAssignments.length === 0 && ' If there are assignments not yet on Canvas, add them above.'}
                </p>
              </div>
            </div>
          )}

          {/* Already achieved */}
          {isValidTarget && rescueCalc?.type === 'already_achieved' && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <TrendingUp className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                You've already hit {target}% — keep it up and you'll finish there.
              </p>
            </div>
          )}

          {/* Achievable — show per-assignment targets */}
          {isValidTarget && rescueCalc?.type === 'achievable' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm font-medium">
                  You need to average <span className="text-primary font-bold">{Math.round(rescueCalc.neededRate * 100)}%</span> on everything remaining.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  That's <strong>{Math.round(rescueCalc.neededFromFuture)} of {futurePossible} points</strong> still available.
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Minimum needed per assignment</p>
                {rescueCalc.perAssignment.map(a => {
                  const pct = a.neededPercent;
                  const isHard = pct > 90;
                  const isMedium = pct > 75;
                  return (
                    <div key={a.id} className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {a.isCustom && <span className="text-[10px] text-primary bg-primary/10 rounded px-1 flex-shrink-0">manual</span>}
                        <p className="text-xs truncate">{a.name}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">{a.pointsPossible} pts</span>
                        <span className={`text-xs font-bold min-w-[48px] text-right ${
                          isHard ? 'text-red-500' : isMedium ? 'text-amber-500' : 'text-green-500'
                        }`}>
                          {a.neededScore} / {a.pointsPossible}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          isHard ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                          isMedium ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                          'bg-green-500/10 text-green-600 dark:text-green-400'
                        }`}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Warning if any assignment requires >95% */}
              {rescueCalc.perAssignment.some(a => a.neededPercent > 95) && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  Some assignments need near-perfect scores. Missing even one makes this harder.
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

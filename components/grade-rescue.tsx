'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Target, Plus, X } from 'lucide-react';
import { HelpTip } from '@/components/help-tip';
import { getGradeColor, gradeToLetter } from '@/lib/gradeUtils';
import type { Assignment, Submission } from '@/lib/types';

interface GradeRescueProps {
  currentGrade: number | null;
  assignments: Assignment[];
  submissions: Submission[];
}

interface CustomAssignment {
  id: string;
  name: string;
  pointsPossible: number;
  groupId: string; // which category it belongs to
}

interface Group {
  id: string;
  name: string;
  weight: number; // 0-100
  earned: number;
  possible: number;
  remaining: number; // points remaining (ungraded) in this group
  customRemaining: number; // custom-added points in this group
}

export function GradeRescue({ currentGrade, assignments, submissions }: GradeRescueProps) {
  const [targetInput, setTargetInput] = useState('');
  const [customAssignments, setCustomAssignments] = useState<CustomAssignment[]>([]);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomPoints, setNewCustomPoints] = useState('');
  const [newCustomGroup, setNewCustomGroup] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPoints, setEditPoints] = useState('');
  const [editGroup, setEditGroup] = useState('');

  const submissionMap = useMemo(() =>
    new Map(submissions.map(s => [s.assignmentId, s])),
    [submissions]
  );

  // Check if course uses weighted categories
  const hasWeights = assignments.some(a => (a.assignmentGroupWeight || 0) > 0);

  // Build groups from assignments
  const groups = useMemo((): Group[] => {
    if (!hasWeights) {
      // Simple points-based — treat as one group
      let earned = 0, possible = 0, remaining = 0;
      for (const a of assignments) {
        if (!a.pointsPossible) continue;
        const sub = submissionMap.get(a.id);
        if (sub?.score !== null && sub?.score !== undefined) {
          earned += sub.score;
          possible += a.pointsPossible;
        } else if (!sub?.excused) {
          remaining += a.pointsPossible;
        }
      }
      const customRemaining = customAssignments.reduce((s, a) => s + a.pointsPossible, 0);
      return [{ id: 'all', name: 'All assignments', weight: 100, earned, possible, remaining, customRemaining }];
    }

    // Weighted categories
    const groupMap = new Map<string, Group>();
    for (const a of assignments) {
      if (!a.pointsPossible || !a.assignmentGroupId) continue;
      const gid = a.assignmentGroupId;
      if (!groupMap.has(gid)) {
        groupMap.set(gid, {
          id: gid,
          name: (a as any).assignmentGroupName || `Group ${gid}`,
          weight: a.assignmentGroupWeight || 0,
          earned: 0, possible: 0, remaining: 0, customRemaining: 0,
        });
      }
      const g = groupMap.get(gid)!;
      // Set a cleaner name if we can infer it (Canvas doesn't always give us the name here)
      const sub = submissionMap.get(a.id);
      if (sub?.score !== null && sub?.score !== undefined) {
        g.earned += sub.score;
        g.possible += a.pointsPossible;
      } else if (!sub?.excused) {
        g.remaining += a.pointsPossible;
      }
    }

    // Add custom assignments to their groups
    for (const ca of customAssignments) {
      if (groupMap.has(ca.groupId)) {
        groupMap.get(ca.groupId)!.customRemaining += ca.pointsPossible;
      }
    }

    return Array.from(groupMap.values()).filter(g => g.weight > 0);
  }, [assignments, submissions, customAssignments, hasWeights, submissionMap]);

  // Current weighted grade (should match Canvas)
  const computedGrade = useMemo(() => {
    if (!hasWeights) {
      const g = groups[0];
      if (!g || g.possible === 0) return currentGrade;
      return Math.round((g.earned / g.possible) * 1000) / 10;
    }
    let weightedSum = 0, totalWeight = 0;
    for (const g of groups) {
      if (g.possible > 0 && g.weight > 0) {
        weightedSum += (g.earned / g.possible) * g.weight;
        totalWeight += g.weight;
      }
    }
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 1000) / 10 : currentGrade;
  }, [groups, hasWeights, currentGrade]);

  // Best possible grade (100% on everything remaining)
  const ceiling = useMemo(() => {
    if (!hasWeights) {
      const g = groups[0];
      if (!g) return null;
      const total = g.possible + g.remaining + g.customRemaining;
      return total > 0 ? Math.round(((g.earned + g.remaining + g.customRemaining) / total) * 1000) / 10 : null;
    }
    let weightedSum = 0, totalWeight = 0;
    for (const g of groups) {
      if (g.weight === 0) continue;
      const totalPts = g.possible + g.remaining + g.customRemaining;
      if (totalPts > 0) {
        weightedSum += ((g.earned + g.remaining + g.customRemaining) / totalPts) * g.weight;
        totalWeight += g.weight;
      }
    }
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 1000) / 10 : null;
  }, [groups, hasWeights]);

  // Projected grade (maintain current rate on everything remaining)
  const projected = useMemo(() => {
    if (!hasWeights) {
      const g = groups[0];
      if (!g || g.possible === 0) return null;
      const rate = g.earned / g.possible;
      const total = g.possible + g.remaining + g.customRemaining;
      return total > 0 ? Math.round(((g.earned + rate * (g.remaining + g.customRemaining)) / total) * 1000) / 10 : null;
    }
    let weightedSum = 0, totalWeight = 0;
    for (const g of groups) {
      if (g.weight === 0) continue;
      const totalPts = g.possible + g.remaining + g.customRemaining;
      if (totalPts === 0) continue;
      const rate = g.possible > 0 ? g.earned / g.possible : 0;
      const projected = (g.earned + rate * (g.remaining + g.customRemaining)) / totalPts;
      weightedSum += projected * g.weight;
      totalWeight += g.weight;
    }
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 1000) / 10 : null;
  }, [groups, hasWeights]);

  // Target grade calculation
  const target = parseFloat(targetInput);
  const isValidTarget = !isNaN(target) && target >= 0 && target <= 100;

  const rescueCalc = useMemo(() => {
    if (!isValidTarget) return null;

    if (!hasWeights) {
      const g = groups[0];
      if (!g) return null;
      const futurePts = g.remaining + g.customRemaining;
      if (futurePts === 0) return null;
      const totalPts = g.possible + futurePts;
      const needed = (target / 100) * totalPts - g.earned;
      if (needed <= 0) return { type: 'already_achieved' as const };
      if (needed > futurePts) return { type: 'impossible' as const };
      const rate = needed / futurePts;
      return { type: 'achievable' as const, rate, perGroup: [{ ...g, neededRate: rate }] };
    }

    // Weighted: figure out required rate per group
    // We need: sum(groupScore_i * weight_i) / totalWeight = target
    // Where groupScore_i = (earned_i + rate_i * remaining_i) / total_i
    // Simplest: apply same needed percentage uniformly across all remaining points per group
    const perGroup: (Group & { neededRate: number; neededPct: number; futurePts: number })[] = [];
    let achievable = true;

    // Binary search: find the uniform "score you need on all remaining" that hits the target
    // across weighted categories
    const simulate = (neededPct: number) => {
      let ws = 0, tw = 0;
      for (const g of groups) {
        if (g.weight === 0) continue;
        const future = g.remaining + g.customRemaining;
        const total = g.possible + future;
        if (total === 0) continue;
        const projected = (g.earned + neededPct * future) / total;
        ws += projected * g.weight;
        tw += g.weight;
      }
      return tw > 0 ? (ws / tw) * 100 : 0;
    };

    // Check if achievable at 100%
    if (simulate(1.0) < target - 0.05) return { type: 'impossible' as const };
    if (simulate(0) >= target - 0.05) return { type: 'already_achieved' as const };

    // Binary search for needed rate
    let lo = 0, hi = 1;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (simulate(mid) < target) lo = mid;
      else hi = mid;
    }
    const neededRate = (lo + hi) / 2;

    for (const g of groups) {
      if (g.weight === 0) continue;
      const futurePts = g.remaining + g.customRemaining;
      perGroup.push({ ...g, neededRate, neededPct: Math.round(neededRate * 100), futurePts });
    }

    return { type: 'achievable' as const, rate: neededRate, perGroup };
  }, [isValidTarget, target, groups, hasWeights]);

  const handleAddCustom = () => {
    const pts = parseFloat(newCustomPoints);
    if (!newCustomName.trim() || isNaN(pts) || pts <= 0) return;
    const groupId = newCustomGroup || (groups[0]?.id || 'all');
    setCustomAssignments(prev => [...prev, {
      id: `custom-${Date.now()}`,
      name: newCustomName.trim(),
      pointsPossible: pts,
      groupId,
    }]);
    setNewCustomName('');
    setNewCustomPoints('');
    setNewCustomGroup('');
    setShowAddCustom(false);
  };

  const gradeDisplay = computedGrade ?? currentGrade;

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Grade Planner
          </CardTitle>
          <HelpTip text={hasWeights
            ? "This course uses weighted categories (e.g. Tests = 40%, Homework = 20%). Grade Planner calculates what you need on each remaining assignment per category to hit your target grade. Add any upcoming assignments not yet on Canvas using 'Add manually'."
            : "Type your target grade to see the minimum you need on every remaining assignment. Add future assignments not yet on Canvas using 'Add manually'."
          } />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* 3 headline numbers */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Current</p>
            <p className={`text-xl font-bold ${getGradeColor(gradeDisplay)}`} data-grade="true">
              {gradeDisplay !== null ? `${gradeDisplay}%` : 'N/A'}
            </p>
            <p className={`text-xs ${getGradeColor(gradeDisplay)}`}>{gradeToLetter(gradeDisplay)}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">If you keep this average</p>
            <p className={`text-xl font-bold ${getGradeColor(projected)}`} data-grade="true">
              {projected !== null ? `${projected}%` : '—'}
            </p>
            <p className={`text-xs ${getGradeColor(projected)}`}>{gradeToLetter(projected)}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Best possible</p>
            <p className={`text-xl font-bold ${getGradeColor(ceiling)}`} data-grade="true">
              {ceiling !== null ? `${ceiling}%` : '—'}
            </p>
            <p className={`text-xs ${getGradeColor(ceiling)}`}>{gradeToLetter(ceiling)}</p>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Best possible</strong> = if you get 100% on everything left.
          <strong className="text-foreground"> If you keep this average</strong> = if you score the same percentage on remaining work as you have been.
        </p>

        {/* Category breakdown if weighted */}
        {hasWeights && groups.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Category breakdown</p>
            <div className="space-y-1.5">
              {groups.map(g => {
                const catGrade = g.possible > 0 ? Math.round((g.earned / g.possible) * 1000) / 10 : null;
                const future = g.remaining + g.customRemaining;
                return (
                  <div key={g.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{g.name || `${g.weight}% category`}</span>
                      <span className="text-muted-foreground text-[10px]">{g.weight}% of grade</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {catGrade !== null && (
                        <span className={`font-bold ${getGradeColor(catGrade)}`}>{catGrade}% now</span>
                      )}
                      {future > 0 && (
                        <span className="text-muted-foreground">{future} pts remaining</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Target input */}
        <div className="space-y-2">
          <label className="text-xs font-medium">I want to finish with:</label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="e.g. 85"
              min={0} max={100}
              value={targetInput}
              onChange={e => setTargetInput(e.target.value)}
              className="w-24 h-8 text-sm"
            />
            <span className="text-sm text-muted-foreground">%</span>
            {targetInput && <span className="text-sm font-medium">{gradeToLetter(parseFloat(targetInput))}</span>}
          </div>
        </div>

        {/* Results */}
        {isValidTarget && rescueCalc && (
          <div className="space-y-3">
            {rescueCalc.type === 'already_achieved' && (
              <div className="text-xs text-green-600 dark:text-green-400 bg-green-500/10 rounded-lg px-3 py-2">
                You have already achieved {target}% — keep going!
              </div>
            )}
            {rescueCalc.type === 'impossible' && (
              <div className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
                {target}% is no longer mathematically possible. The highest you can still reach is {ceiling}%.
              </div>
            )}
            {rescueCalc.type === 'achievable' && (
              <div className="space-y-2">
                <div className="text-xs bg-primary/10 rounded-lg px-3 py-2 text-center">
                  <span className="text-muted-foreground">You need to average </span>
                  <span className={`text-lg font-bold ${rescueCalc.rate >= 0.9 ? 'text-red-500' : rescueCalc.rate >= 0.75 ? 'text-amber-500' : 'text-green-500'}`}>
                    {Math.round(rescueCalc.rate * 100)}%
                  </span>
                  <span className="text-muted-foreground"> on everything remaining</span>
                </div>

                {hasWeights && rescueCalc.perGroup && rescueCalc.perGroup.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">Per category:</p>
                    {rescueCalc.perGroup.map(g => (
                      g.futurePts > 0 && (
                        <div key={g.id} className="flex items-center justify-between text-xs px-3 py-1.5 rounded bg-muted/30">
                          <span className="text-muted-foreground">{g.name || `${g.weight}% category`} — {g.futurePts} pts left</span>
                          <span className={`font-bold ${g.neededPct >= 90 ? 'text-red-500' : g.neededPct >= 75 ? 'text-amber-500' : 'text-green-500'}`}>
                            Need {g.neededPct}%
                          </span>
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Remaining assignments list */}
        {groups.flatMap(g => {
          const remaining = assignments.filter(a => {
            if (!a.pointsPossible) return false;
            const sub = submissionMap.get(a.id);
            return (sub?.score === null || sub?.score === undefined) && !sub?.excused;
          }).filter(a => !hasWeights || a.assignmentGroupId === g.id);
          return remaining;
        }).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Remaining assignments on Canvas</p>
            {assignments.filter(a => {
              if (!a.pointsPossible) return false;
              const sub = submissionMap.get(a.id);
              return (sub?.score === null || sub?.score === undefined) && !sub?.excused;
            }).slice(0, 8).map(a => {
              const targetScore = rescueCalc?.type === 'achievable'
                ? Math.ceil(rescueCalc.rate * a.pointsPossible * 10) / 10 : null;
              const pct = targetScore !== null ? Math.round((targetScore / a.pointsPossible) * 100) : null;
              return (
                <div key={a.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-muted/30">
                  <span className="text-muted-foreground truncate flex-1 mr-2">{a.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0 text-muted-foreground">
                    <span>{a.pointsPossible} pts</span>
                    {pct !== null && (
                      <span className={`font-medium ${pct >= 90 ? 'text-red-500' : pct >= 75 ? 'text-amber-500' : 'text-green-500'}`}>
                        need {pct}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Custom assignments */}
        {customAssignments.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Added manually</p>
            {customAssignments.map(a => (
              editingCustomId === a.id ? (
                <div key={a.id} className="space-y-2 p-2 rounded-lg border border-primary/30 bg-primary/5">
                  <Input placeholder="Name" value={editName} onChange={e => setEditName(e.target.value)} className="h-7 text-xs" />
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Points" value={editPoints} onChange={e => setEditPoints(e.target.value)} className="h-7 text-xs w-24" />
                    {hasWeights && groups.length > 1 && (
                      <select value={editGroup} onChange={e => setEditGroup(e.target.value)}
                        className="flex-1 h-7 text-xs rounded-md border border-input bg-background px-2">
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name || `${g.weight}%`} ({g.weight}%)</option>)}
                      </select>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      const pts = parseFloat(editPoints);
                      if (!editName.trim() || isNaN(pts) || pts <= 0) return;
                      setCustomAssignments(p => p.map(x => x.id === a.id
                        ? { ...x, name: editName.trim(), pointsPossible: pts, groupId: editGroup || x.groupId }
                        : x));
                      setEditingCustomId(null);
                    }} className="flex-1 py-1 text-xs bg-primary text-primary-foreground rounded cursor-pointer hover:bg-primary/90">
                      Save
                    </button>
                    <button onClick={() => setEditingCustomId(null)} className="px-2 py-1 text-xs border border-border rounded cursor-pointer hover:bg-accent">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div key={a.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-primary/5 group cursor-pointer"
                  onClick={() => { setEditingCustomId(a.id); setEditName(a.name); setEditPoints(String(a.pointsPossible)); setEditGroup(a.groupId); }}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-primary font-medium truncate">{a.name}</span>
                    <span className="text-muted-foreground">{a.pointsPossible} pts</span>
                    {hasWeights && <span className="text-muted-foreground text-[10px]">{groups.find(g => g.id === a.groupId)?.name || ''}</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-muted-foreground">Edit</span>
                    <button onClick={e => { e.stopPropagation(); setCustomAssignments(p => p.filter(x => x.id !== a.id)); }}
                      className="text-muted-foreground hover:text-destructive cursor-pointer">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        {/* Add custom */}
        {showAddCustom ? (
          <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/20">
            <p className="text-xs font-medium">Add an upcoming assignment not yet on Canvas</p>
            <Input placeholder="Assignment name" value={newCustomName} onChange={e => setNewCustomName(e.target.value)} className="h-8 text-xs" />
            <div className="flex gap-2">
              <Input type="number" placeholder="Points possible" value={newCustomPoints} onChange={e => setNewCustomPoints(e.target.value)} className="h-8 text-xs w-32" />
              {hasWeights && groups.length > 1 && (
                <select value={newCustomGroup} onChange={e => setNewCustomGroup(e.target.value)}
                  className="flex-1 h-8 text-xs rounded-md border border-input bg-background px-2">
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name || `${g.weight}% category`} ({g.weight}%)</option>)}
                </select>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddCustom}
                className="flex-1 py-1.5 text-xs bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 transition-colors">
                Add
              </button>
              <button onClick={() => setShowAddCustom(false)}
                className="px-3 py-1.5 text-xs text-muted-foreground border border-border rounded-md cursor-pointer hover:bg-accent">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddCustom(true)}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 cursor-pointer transition-colors">
            <Plus className="h-3 w-3" />
            Add assignment not yet on Canvas
          </button>
        )}

        <p className="text-[10px] text-muted-foreground">
          Teachers often add assignments as the semester goes. Use "Add" above to include any upcoming exams not yet posted.
        </p>
      </CardContent>
    </Card>
  );
}

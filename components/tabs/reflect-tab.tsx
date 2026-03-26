'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Clock, Target, Zap } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { 
  getGradeColor, 
  gradeToLetter, 
  computeProjectedGrade, 
  submissionTiming,
  courseColor,
  minutesToLabel
} from '@/lib/gradeUtils';
import { getAllEffortOverrides } from '@/lib/db-queries';
import { HelpTip } from '@/components/help-tip';
import type { Course, Assignment, Submission } from '@/lib/types';

interface AnalyticsData {
  courses: Course[];
  assignments: Assignment[];
  submissions: Submission[];
}

interface ReflectTabProps {
  courses: Course[];
  assignments: Assignment[];
  submissions: Submission[];
  isLoading: boolean;
}

const shortCourseName = (course: Course) => {
  const name = course.name || course.code;
  const afterColon = name.includes(':') ? name.split(':').slice(1).join(':').trim() : name;
  return afterColon.replace(/^(AP|IB|Honors|Accelerated) /i, '').trim().split(' ').slice(0, 3).join(' ');
};


export function ReflectTab({ courses, assignments, submissions, isLoading }: ReflectTabProps) {
  const data: AnalyticsData = { courses, assignments, submissions };
  const [effortOverrides, setEffortOverrides] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    getAllEffortOverrides().then(setEffortOverrides).catch(() => {});
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Intro banner */}
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-1">
        <p className="text-sm font-medium">Your study patterns, in numbers</p>
        <p className="text-xs text-muted-foreground">Analytics shows things Canvas never will — where you are losing points, how your grades are trending, and whether starting early actually improves your scores. All calculated from your real grade data.</p>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold">Weekly Wrap</h2>
          <HelpTip text="Six cards calculated from your real Canvas data — what's due this week, where your grades are trending, how submitting early vs late affects your scores, and what small assignments you're losing points on. All real numbers, nothing made up." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <GradeRiskCard data={data} />
          <GradeChangeCard data={data} />
          <EarlyBirdCard data={data} />
          <WorkloadForecastCard data={data} />
          <MomentumCard data={data} />
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold">Monthly Wrap</h2>
          <HelpTip text="Bigger picture analytics for the semester — your grade in every course over time, submission habits (early vs on-time vs late), where you lost points, and your grade trajectory as a line chart. Tap courses on the trajectory chart to show or hide them." />
        </div>
        <div className="space-y-4">
          <SemesterSnapshotCard data={data} />
          <SubmissionPatternsCard data={data} />
          <PointsLostCard data={data} />
          <GradeTrajectoryCard data={data} />
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold">Effort Calibration</h2>
          <HelpTip text="Shows every assignment where you set an effort estimate in the Priority Queue, alongside your actual score. Helps you see if your time estimates are accurate — if you're estimating 1 hour but scoring 60%, you're either underestimating the work or not using the time well." />
        </div>
        <EffortCalibrationCard data={data} effortOverrides={effortOverrides} />
      </section>
    </div>
  );
}

// ============ Weekly Wrap Cards ============

function GradeRiskCard({ data }: { data: AnalyticsData }) {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const submissionMap = new Map(data.submissions.map(s => [s.assignmentId, s]));

  const upcoming = data.assignments
    .filter(a => {
      if (!a.dueDate || !a.pointsPossible) return false;
      const due = new Date(a.dueDate);
      if (due < now || due > nextWeek) return false;
      const sub = submissionMap.get(a.id);
      return !sub?.submittedAt && (sub?.score === null || sub?.score === undefined);
    })
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  const totalPts = upcoming.reduce((s, a) => s + a.pointsPossible, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />Due this week
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <>
            <p className="text-2xl font-bold text-[oklch(var(--grade-safe))]">Nothing due</p>
            <p className="text-xs text-muted-foreground mt-1">Clear week ahead</p>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold">{upcoming.length} assignment{upcoming.length !== 1 ? 's' : ''}</p>
            <p className="text-xs text-muted-foreground">{totalPts} total points at stake</p>
            <div className="mt-3 space-y-1.5">
              {upcoming.slice(0, 4).map(a => {
                const courseName = data.courses.find(c => c.id === a.courseId)?.name || '';
                const shortName = courseName.includes(':') ? courseName.split(':').slice(1).join(':').trim() : courseName;
                const daysLeft = Math.ceil((new Date(a.dueDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={a.id} className="flex items-center justify-between text-xs">
                    <span className="truncate flex-1 mr-2">{a.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0 text-muted-foreground">
                      <span>{a.pointsPossible}pts</span>
                      <span className={daysLeft <= 1 ? 'text-red-500 font-medium' : daysLeft <= 3 ? 'text-amber-500' : ''}>
                        {daysLeft === 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : `in ${daysLeft}d`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GradeChangeCard({ data }: { data: AnalyticsData }) {
  // Compare running grade at the midpoint of semester vs now
  const changes = data.courses
    .filter(c => !/advisory|homeroom/i.test(c.name) && c.currentGrade !== null)
    .map(course => {
      const subs = data.submissions
        .filter(s => s.courseId === course.id && s.score !== null && (s.submittedAt || s.gradedAt))
        .sort((a, b) => new Date(a.submittedAt || a.gradedAt!).getTime() - new Date(b.submittedAt || b.gradedAt!).getTime());
      if (subs.length < 3) return null;

      // Grade at the earliest 1/3 of submissions
      const earlySlice = subs.slice(0, Math.ceil(subs.length / 3));
      let e = 0, p = 0;
      earlySlice.forEach(s => {
        const a = data.assignments.find(a => a.id === s.assignmentId);
        if (a?.pointsPossible) { e += s.score!; p += a.pointsPossible; }
      });
      const earlyGrade = p > 0 ? Math.round((e / p) * 100) : null;
      if (earlyGrade === null) return null;

      // Current grade is the authoritative number from Canvas
      const current = course.currentGrade!;
      const delta = current - earlyGrade;

      const shortName = course.name.includes(':') ? course.name.split(':').slice(1).join(':').trim().replace(/^(AP|IB|Honors) /i, '').trim() : course.name;
      return { course, shortName: shortName.split(' ').slice(0, 3).join(' '), early: earlyGrade, recent: current, delta };
    }).filter(Boolean) as { course: Course; shortName: string; early: number; recent: number; delta: number }[];

  if (changes.length === 0) {
    return (
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4" />Grade trend</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Not enough data yet</p></CardContent>
      </Card>
    );
  }

  const improving = changes.filter(c => c.delta > 1).length;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />Grade trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{improving} of {changes.length}</p>
        <p className="text-xs text-muted-foreground">courses improving recently</p>
        <div className="mt-3 space-y-1.5">
          {changes.map(c => (
            <div key={c.course.id} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate flex-1 mr-2">{c.shortName}</span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span>{c.early}%</span>
                <span className="text-muted-foreground">→</span>
                <span>{c.recent}%</span>
                <span className={`font-bold ${c.delta > 1 ? 'text-green-500' : c.delta < -1 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  ({c.delta > 0 ? '+' : ''}{c.delta}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EarlyBirdCard({ data }: { data: AnalyticsData }) {
  const submissionMap = new Map(data.submissions.map(s => [s.assignmentId, s]));
  let earlyCount = 0, lateCount = 0, earlyEarned = 0, earlyPossible = 0, lateEarned = 0, latePossible = 0;

  data.submissions.filter(s => s.score !== null && s.submittedAt).forEach(sub => {
    const a = data.assignments.find(a => a.id === sub.assignmentId);
    if (!a?.dueDate || !a.pointsPossible) return;
    const daysBefore = (new Date(a.dueDate).getTime() - new Date(sub.submittedAt!).getTime()) / (1000 * 60 * 60 * 24);
    if (sub.late) { lateCount++; lateEarned += sub.score!; latePossible += a.pointsPossible; }
    else if (daysBefore >= 1) { earlyCount++; earlyEarned += sub.score!; earlyPossible += a.pointsPossible; }
  });

  const earlyAvg = earlyPossible > 0 ? Math.round((earlyEarned / earlyPossible) * 100) : null;
  const lateAvg = latePossible > 0 ? Math.round((lateEarned / latePossible) * 100) : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />Early vs late
        </CardTitle>
      </CardHeader>
      <CardContent>
        {earlyAvg !== null && lateAvg !== null ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-green-500">{earlyAvg}%</span>
              <span className="text-muted-foreground text-sm">early</span>
              <span className="text-muted-foreground">vs</span>
              <span className="text-2xl font-bold text-red-500">{lateAvg}%</span>
              <span className="text-muted-foreground text-sm">late</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {earlyAvg > lateAvg
                ? `You score ${earlyAvg - lateAvg}% higher when you submit early`
                : earlyAvg === lateAvg ? 'Timing does not seem to affect your scores'
                : 'Late submissions score higher — timing may not be the issue'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{earlyCount} early · {lateCount} late submissions</p>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-muted-foreground">No data</p>
            <p className="text-xs text-muted-foreground">Need both early and late submissions to compare</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function WorkloadForecastCard({ data }: { data: AnalyticsData }) {
  const now = new Date();
  const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const submissionMap = new Map(data.submissions.map(s => [s.assignmentId, s]));

  const upcoming = data.assignments.filter(a => {
    if (!a.dueDate) return false;
    const due = new Date(a.dueDate);
    if (due < now || due > twoWeeks) return false;
    const sub = submissionMap.get(a.id);
    return !sub?.submittedAt && (sub?.score === null || sub?.score === undefined);
  });

  const byDay: Record<string, number> = {};
  upcoming.forEach(a => {
    const key = new Date(a.dueDate!).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    byDay[key] = (byDay[key] || 0) + 1;
  });

  const busiest = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4" />Next 2 weeks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{upcoming.length}</p>
        <p className="text-xs text-muted-foreground">assignments due</p>
        {busiest && (
          <p className="text-xs text-muted-foreground mt-1">
            Busiest: <span className="font-medium text-foreground">{busiest[0]}</span> ({busiest[1]} due)
          </p>
        )}
        {Object.keys(byDay).length > 0 && (
          <div className="mt-3 space-y-1">
            {Object.entries(byDay).slice(0, 4).map(([day, count]) => (
              <div key={day} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" style={{ opacity: Math.min(1, count / 3) }} />
                <span className="text-muted-foreground">{day}</span>
                <span className="ml-auto font-medium">{count}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MomentumCard({ data }: { data: AnalyticsData }) {
  // Show each course's current grade vs their actual Canvas grade
  const courses = data.courses.filter(c => !/advisory|homeroom/i.test(c.name) && c.currentGrade !== null);

  if (courses.length === 0) {
    return (
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Course grades</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">No grade data</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4" />Your grades now
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {courses.map(c => {
            const shortName = c.name.includes(':') ? c.name.split(':').slice(1).join(':').trim().replace(/^(AP|IB|Honors) /i, '').split(' ').slice(0, 3).join(' ') : c.name.split(' ').slice(0, 3).join(' ');
            return (
              <div key={c.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate flex-1 mr-2">{shortName}</span>
                <span className={`font-bold ${getGradeColor(c.currentGrade)}`} data-grade="true">{c.currentGrade}%</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}


function SemesterSnapshotCard({ data }: { data: AnalyticsData }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Semester Snapshot</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4">
          {data.courses.map(course => {
            const projected = computeProjectedGrade(
              data.submissions
                .filter(s => s.courseId === course.id && s.score !== null)
                .map(s => {
                  const a = data.assignments.find(a => a.id === s.assignmentId);
                  return { earned: s.score!, possible: a?.pointsPossible || 0 };
                })
            );
            
            return (
              <div key={course.id} className="flex items-center gap-2 min-w-[200px]">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: courseColor(course.id) }}
                />
                <span className="text-sm font-medium truncate max-w-[120px]">{shortCourseName(course)}</span>
                <span className={`text-lg font-bold ${getGradeColor(course.currentGrade)}`} data-grade>
                  {course.currentGrade !== null ? `${course.currentGrade}%` : '--'}
                </span>
                {projected && (
                  <Badge variant="outline" className="text-xs">
                    {gradeToLetter(projected)}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function SubmissionPatternsCard({ data }: { data: AnalyticsData }) {
  const allSubs = data.submissions
    .filter(s => s.submittedAt && s.score !== null);

  if (allSubs.length < 3) {
    return (
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Submission Habits</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Not enough submissions yet</p></CardContent>
      </Card>
    );
  }

  let earlyCount = 0, onTimeCount = 0, lateCount = 0;
  let earlyEarned = 0, earlyPossible = 0;
  let lateEarned = 0, latePossible = 0;

  allSubs.forEach(sub => {
    const a = data.assignments.find(a => a.id === sub.assignmentId);
    if (!a?.dueDate || !a.pointsPossible) return;

    const due = new Date(a.dueDate).getTime();
    const submitted = new Date(sub.submittedAt!).getTime();
    const daysBefore = (due - submitted) / (1000 * 60 * 60 * 24);

    if (sub.late) {
      lateCount++;
      lateEarned += sub.score!;
      latePossible += a.pointsPossible;
    } else if (daysBefore >= 1) {
      earlyCount++;
      earlyEarned += sub.score!;
      earlyPossible += a.pointsPossible;
    } else {
      onTimeCount++;
    }
  });

  const earlyAvg = earlyPossible > 0 ? Math.round((earlyEarned / earlyPossible) * 100) : null;
  const lateAvg = latePossible > 0 ? Math.round((lateEarned / latePossible) * 100) : null;
  const total = earlyCount + onTimeCount + lateCount;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Submission Habits</CardTitle>
        <p className="text-xs text-muted-foreground">Based on {total} graded submissions this semester</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="space-y-1">
            <p className="text-2xl font-bold text-green-500">{earlyCount}</p>
            <p className="text-xs text-muted-foreground">Submitted early</p>
            {earlyAvg !== null && <p className="text-xs font-medium">{earlyAvg}% avg</p>}
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold">{onTimeCount}</p>
            <p className="text-xs text-muted-foreground">On time</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-red-500">{lateCount}</p>
            <p className="text-xs text-muted-foreground">Submitted late</p>
            {lateAvg !== null && <p className="text-xs font-medium">{lateAvg}% avg</p>}
          </div>
        </div>

        {earlyAvg !== null && lateAvg !== null && earlyAvg !== lateAvg && (
          <div className={`text-xs rounded-lg px-3 py-2 ${earlyAvg > lateAvg ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
            {earlyAvg > lateAvg
              ? `You score ${earlyAvg - lateAvg}% higher when you submit early. Starting earlier pays off.`
              : `Your early and late scores are similar — timing is not your main issue.`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function PointsLostCard({ data }: { data: AnalyticsData }) {
  const reasons: { reason: string; points: number; course: string }[] = [];
  
  const getCourseName = (courseId: string) => {
    const c = data.courses.find(x => x.id === courseId);
    if (!c) return courseId;
    const n = c.name || '';
    const after = n.includes(':') ? n.split(':').slice(1).join(':').trim() : n;
    return after.replace(/^(AP|IB|Honors|Accelerated) /i, '').trim().split(' ').slice(0, 3).join(' ');
  };

  // Late submissions — compare actual vs possible
  data.submissions
    .filter(s => s.late && s.score !== null)
    .forEach(s => {
      const assignment = data.assignments.find(a => a.id === s.assignmentId);
      if (!assignment) return;
      const pct = s.score! / assignment.pointsPossible;
      // Only flag if scored under 70% AND late — likely a late penalty
      if (pct < 0.7 && assignment.pointsPossible > 0) {
        const lost = Math.round(assignment.pointsPossible * 0.9 - s.score!);
        if (lost > 0) {
          reasons.push({ reason: 'Late submission', points: lost, course: getCourseName(assignment.courseId) });
        }
      }
    });

  // Missing submissions
  data.submissions
    .filter(s => s.missing)
    .forEach(s => {
      const assignment = data.assignments.find(a => a.id === s.assignmentId);
      if (assignment) {
        reasons.push({ reason: 'Missing: ' + assignment.name.slice(0, 25), points: assignment.pointsPossible, course: getCourseName(assignment.courseId) });
      }
    });

  // Low-scoring assignments (below 60%)
  data.submissions
    .filter(s => s.score !== null && !s.missing && !s.late)
    .forEach(s => {
      const assignment = data.assignments.find(a => a.id === s.assignmentId);
      if (!assignment || !assignment.pointsPossible) return;
      const pct = s.score! / assignment.pointsPossible;
      if (pct < 0.6) {
        const lost = Math.round(assignment.pointsPossible - s.score!);
        if (lost >= 3) {
          reasons.push({ reason: assignment.name.slice(0, 30), points: lost, course: getCourseName(assignment.courseId) });
        }
      }
    });

  const sortedReasons = reasons.sort((a, b) => b.points - a.points);
  const totalLost = reasons.reduce((sum, r) => sum + r.points, 0);

  if (sortedReasons.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Where You Lost Points</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Complete a full month of coursework to see this
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Where You Lost Points</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-[oklch(var(--grade-danger))] mb-4">
          -{totalLost} pts total
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 font-medium">Reason</th>
                <th className="text-right py-2 font-medium">Points</th>
                <th className="text-right py-2 font-medium">Course</th>
              </tr>
            </thead>
            <tbody>
              {sortedReasons.slice(0, 5).map((r, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2">{r.reason}</td>
                  <td className="py-2 text-right text-[oklch(var(--grade-danger))]">-{r.points}</td>
                  <td className="py-2 text-right text-muted-foreground">{r.course}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function GradeTrajectoryCard({ data }: { data: AnalyticsData }) {
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(
    new Set(data.courses
      .filter(c => !/advisory|school meeting|homeroom|counseling/i.test(c.name || ''))
      .map(c => c.id))
  );

  const getShortName = (course: Course) => {
    const name = course.name;
    const afterColon = name.includes(':') ? name.split(':').slice(1).join(':').trim() : name;
    const stripped = afterColon.replace(/^(AP|IB|Honors|Accelerated) /i, '').trim();
    return stripped.split(' ').slice(0, 2).join(' ');
  };

  const toggleCourse = (id: string) => {
    setSelectedCourseIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id); // keep at least 1
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const courseLines = data.courses
    .filter(course => selectedCourseIds.has(course.id))
    .filter(course => {
      // Skip advisory/non-academic courses
      const name = (course.name || '').toLowerCase();
      return !/advisory|school meeting|homeroom|counseling/.test(name);
    })
    .map(course => {
      // Use both submission records AND embedded submissionScore on assignments
      // This catches grades posted by teacher but not "submitted" by student (in-class tests etc.)
      const courseSubmissions = data.submissions
        .filter(s => s.courseId === course.id && s.score !== null && (s.submittedAt || s.gradedAt))
        .sort((a, b) => {
          const aDate = new Date(a.submittedAt || a.gradedAt!).getTime();
          const bDate = new Date(b.submittedAt || b.gradedAt!).getTime();
          return aDate - bDate;
        });

      if (courseSubmissions.length < 2) return null;

      let cumEarned = 0;
      let cumPossible = 0;
      const points = courseSubmissions.map(s => {
        const assignment = data.assignments.find(a => a.id === s.assignmentId);
        const pts = assignment?.pointsPossible || 0;
        if (pts === 0) return null;
        const dateToUse = s.submittedAt || s.gradedAt;
        if (!dateToUse) return null;
        cumEarned += s.score!;
        cumPossible += pts;
        return {
          date: new Date(dateToUse).getTime(),
          grade: cumPossible > 0 ? Math.round((cumEarned / cumPossible) * 100) : null,
        };
      }).filter((p): p is { date: number; grade: number } => p !== null && p.grade !== null);

      if (points.length < 2) return null;
      return { course, shortName: getShortName(course), points, color: courseColor(course.id) };
    }).filter(Boolean) as { course: Course; shortName: string; points: { date: number; grade: number }[]; color: string }[];

  const allDates = [...new Set(courseLines.flatMap(c => c.points.map(p => p.date)))].sort();
  const chartData = allDates.map(date => {
    const point: Record<string, number | string> = {
      date,
      label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
    courseLines.forEach(line => {
      const match = [...line.points].reverse().find(p => p.date <= date);
      if (match) point[line.shortName] = match.grade;
    });
    return point;
  });

  const allGrades = courseLines.flatMap(l => l.points.map(p => p.grade));
  const minGrade = allGrades.length > 0 ? Math.max(0, Math.floor(Math.min(...allGrades) / 10) * 10 - 5) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Grade Trajectory</CardTitle>
        <p className="text-xs text-muted-foreground">Running grade per course — tap to show/hide</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Course selector */}
        <div className="flex flex-wrap gap-2">
          {data.courses.map(course => {
            const isSelected = selectedCourseIds.has(course.id);
            const color = courseColor(course.id);
            return (
              <button
                key={course.id}
                onClick={() => toggleCourse(course.id)}
                className={`text-xs px-2 py-1 rounded-full border cursor-pointer transition-all ${
                  isSelected ? 'border-transparent text-white' : 'border-border text-muted-foreground bg-transparent'
                }`}
                style={isSelected ? { backgroundColor: color } : {}}
              >
                {getShortName(course)}
              </button>
            );
          })}
        </div>

        {courseLines.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Not enough graded submissions yet</p>
        ) : (
          <>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#888" }} interval="preserveStartEnd" tickCount={6} />
                  <YAxis domain={[minGrade, 100]} tick={{ fontSize: 10, fill: "#888" }} tickFormatter={v => `${v}%`} width={35} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover border border-border rounded-lg p-2 shadow-lg text-xs space-y-1">
                            <p className="font-medium text-muted-foreground">{label}</p>
                            {payload.map((p, i) => (
                              <p key={i} style={{ color: p.color as string }}>{p.name}: {p.value}%</p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {courseLines.map(line => (
                    <Line
                      key={line.course.id}
                      type="monotone"
                      dataKey={line.shortName}
                      stroke={line.color}
                      strokeWidth={2}
                      dot={{ r: 2, strokeWidth: 0, fill: line.color }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
// ============ Effort Calibration ============

function EffortCalibrationCard({
  data,
  effortOverrides,
}: {
  data: AnalyticsData;
  effortOverrides: Map<string, number>;
}) {
  // Find assignments where the student set an effort estimate
  const calibrationData = data.assignments
    .filter(a => effortOverrides.has(a.id))
    .map(a => {
      const estimated = effortOverrides.get(a.id)!;
      const submission = data.submissions.find(s => s.assignmentId === a.id);
      const score = submission?.score ?? null;
      const pointsPossible = a.pointsPossible || 1;
      const scorePercent = score !== null ? Math.round((score / pointsPossible) * 100) : null;
      return {
        name: a.name,
        courseCode: a.courseCode,
        estimated,
        scorePercent,
        pointsPossible,
        score,
      };
    });

  const totalEstimatedHours = calibrationData.reduce((s, d) => s + d.estimated, 0) / 60;
  const avgScoreOnEstimated = calibrationData.filter(d => d.scorePercent !== null).length > 0
    ? Math.round(
        calibrationData
          .filter(d => d.scorePercent !== null)
          .reduce((s, d) => s + d.scorePercent!, 0) /
        calibrationData.filter(d => d.scorePercent !== null).length
      )
    : null;

  if (calibrationData.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          <p>No effort estimates set yet.</p>
          <p className="text-xs mt-1">Use the effort slider on Priority Queue cards to track how long you think assignments will take. Your estimates will appear here with actual results.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Effort Calibration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Total time budgeted</p>
            <p className="text-2xl font-bold">{totalEstimatedHours.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground">across {calibrationData.length} assignments</p>
          </div>
          {avgScoreOnEstimated !== null && (
            <div>
              <p className="text-xs text-muted-foreground">Avg score on tracked work</p>
              <p className={`text-2xl font-bold ${getGradeColor(avgScoreOnEstimated)}`}>
                {avgScoreOnEstimated}%
              </p>
              <p className="text-xs text-muted-foreground">{gradeToLetter(avgScoreOnEstimated)}</p>
            </div>
          )}
        </div>

        {/* Per-assignment breakdown */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assignment breakdown</p>
          <div className="space-y-1.5">
            {calibrationData.map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.courseCode}</p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                  <div className="text-right">
                    <p className="text-muted-foreground">Estimated</p>
                    <p className="font-medium">{minutesToLabel(d.estimated)}</p>
                  </div>
                  {d.scorePercent !== null ? (
                    <div className="text-right">
                      <p className="text-muted-foreground">Score</p>
                      <p className={`font-medium ${getGradeColor(d.scorePercent)}`}>
                        {d.score}/{d.pointsPossible}
                      </p>
                    </div>
                  ) : (
                    <div className="text-right">
                      <p className="text-muted-foreground">Score</p>
                      <p className="text-muted-foreground">Pending</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Insight */}
        {avgScoreOnEstimated !== null && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              {avgScoreOnEstimated >= 85
                ? `Your effort estimates are paying off — you're averaging ${avgScoreOnEstimated}% on assignments you planned for.`
                : avgScoreOnEstimated >= 75
                ? `You're averaging ${avgScoreOnEstimated}% on tracked assignments. Consider adding more time to your estimates.`
                : `Your tracked assignments average ${avgScoreOnEstimated}%. Try increasing your effort estimates or starting earlier.`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

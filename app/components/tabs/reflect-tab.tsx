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
      <section>
        <h2 className="text-lg font-semibold mb-4">Weekly Wrap</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <GradeRiskCard data={data} />
          <ProjectedFinalsCard data={data} />
          <EarlyBirdCard data={data} />
          <GradeLeakCard data={data} />
          <WorkloadForecastCard data={data} />
          <MomentumCard data={data} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Monthly Wrap</h2>
        <div className="space-y-4">
          <SemesterSnapshotCard data={data} />
          <SubmissionPatternsCard data={data} />
          <PointsLostCard data={data} />
          <GradeTrajectoryCard data={data} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Effort Calibration</h2>
        <EffortCalibrationCard data={data} effortOverrides={effortOverrides} />
      </section>
    </div>
  );
}

// ============ Weekly Wrap Cards ============

function GradeRiskCard({ data }: { data: AnalyticsData }) {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  // Find assignments due this week with most points
  const upcomingAssignments = data.assignments
    .filter(a => a.dueDate && new Date(a.dueDate) <= nextWeek && new Date(a.dueDate) > new Date())
    .sort((a, b) => b.pointsPossible - a.pointsPossible);

  const totalPointsAtRisk = upcomingAssignments.reduce((sum, a) => sum + a.pointsPossible, 0);
  const topRiskCourse = upcomingAssignments[0]?.courseCode;

  if (upcomingAssignments.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Grade Risk This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-[oklch(var(--grade-safe))]">Clear week ahead</p>
          <p className="text-xs text-muted-foreground mt-1">No major assignments due</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Grade Risk This Week
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{totalPointsAtRisk} pts</p>
        <p className="text-xs text-muted-foreground">at stake in {topRiskCourse}</p>
        <div className="mt-2 space-y-1">
          {upcomingAssignments.slice(0, 3).map(a => (
            <p key={a.id} className="text-xs truncate">
              {a.name} ({a.pointsPossible} pts)
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectedFinalsCard({ data }: { data: AnalyticsData }) {
  const projections = data.courses.map(course => {
    const courseSubmissions = data.submissions.filter(s => s.courseId === course.id);
    const courseAssignments = data.assignments.filter(a => a.courseId === course.id);
    
    const points = courseSubmissions
      .filter(s => s.score !== null)
      .map(s => {
        const assignment = courseAssignments.find(a => a.id === s.assignmentId);
        return {
          earned: s.score!,
          possible: assignment?.pointsPossible || 0,
        };
      });
    
    const projected = computeProjectedGrade(points);
    return {
      course,
      current: course.currentGrade,
      projected,
    };
  });

  const onTrackForA = projections.filter(p => (p.projected ?? p.current ?? 0) >= 90).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4" />
          Projected Final Grades
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{onTrackForA} of {data.courses.length}</p>
        <p className="text-xs text-muted-foreground">courses on track for A</p>
        <div className="mt-2 space-y-1">
          {projections.slice(0, 4).map(p => (
            <div key={p.course.id} className="flex items-center justify-between text-xs">
              <span className="truncate">{p.course.name.split(':')[0].replace(/AP |IB /gi,'').trim().slice(0,15)}</span>
              <span className={getGradeColor(p.projected ?? p.current)}>
                {p.current !== null ? `${p.current}%` : '--'} 
                {p.projected && p.projected !== p.current && (
                  <span className="text-muted-foreground"> → {p.projected}%</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EarlyBirdCard({ data }: { data: AnalyticsData }) {
  const submissionsWithTiming = data.submissions
    .filter(s => s.submittedAt && s.score !== null)
    .map(s => {
      const assignment = data.assignments.find(a => a.id === s.assignmentId);
      return {
        ...s,
        timing: submissionTiming(s.submittedAt, assignment?.dueDate ?? null),
        assignment,
      };
    });

  const earlySubmissions = submissionsWithTiming.filter(s => s.timing === 'early');
  const lateSubmissions = submissionsWithTiming.filter(s => s.timing === 'late');

  if (submissionsWithTiming.length < 3) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Early Bird Advantage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Not enough data yet</p>
          <p className="text-xs text-muted-foreground mt-1">Submit 3+ assignments to see this</p>
        </CardContent>
      </Card>
    );
  }

  const earlyAvg = earlySubmissions.length > 0
    ? earlySubmissions.reduce((sum, s) => {
        const assignment = s.assignment;
        return sum + ((s.score! / (assignment?.pointsPossible || 1)) * 100);
      }, 0) / earlySubmissions.length
    : 0;

  const lateAvg = lateSubmissions.length > 0
    ? lateSubmissions.reduce((sum, s) => {
        const assignment = s.assignment;
        return sum + ((s.score! / (assignment?.pointsPossible || 1)) * 100);
      }, 0) / lateSubmissions.length
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Early Bird Advantage
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">
          <span className="text-[oklch(var(--grade-safe))]">{Math.round(earlyAvg)}%</span>
          <span className="text-muted-foreground text-lg mx-1">vs</span>
          <span className="text-[oklch(var(--grade-danger))]">{Math.round(lateAvg)}%</span>
        </p>
        <p className="text-xs text-muted-foreground">early vs last-minute submissions</p>
      </CardContent>
    </Card>
  );
}

function GradeLeakCard({ data }: { data: AnalyticsData }) {
  // Find missed low-stakes work (<20 pts)
  const missedLowStakes = data.submissions
    .filter(s => s.missing)
    .map(s => {
      const assignment = data.assignments.find(a => a.id === s.assignmentId);
      return { submission: s, assignment };
    })
    .filter(item => item.assignment && item.assignment.pointsPossible < 20);

  const pointsLost = missedLowStakes.reduce((sum, item) => 
    sum + (item.assignment?.pointsPossible || 0), 0);

  if (pointsLost === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Silent Grade Leak
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-[oklch(var(--grade-safe))]">0 pts</p>
          <p className="text-xs text-muted-foreground">No points lost to missed low-stakes work</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Silent Grade Leak
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-[oklch(var(--grade-danger))]">-{pointsLost} pts</p>
        <p className="text-xs text-muted-foreground">from missed low-stakes work</p>
        <div className="mt-2 space-y-1">
          {missedLowStakes.slice(0, 3).map((item, i) => (
            <p key={i} className="text-xs truncate text-muted-foreground">
              {item.assignment?.name} ({item.assignment?.pointsPossible} pts)
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WorkloadForecastCard({ data }: { data: AnalyticsData }) {
  // Calculate hours due in next 2 weeks by day
  const twoWeeksOut = new Date();
  twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);
  
  const upcomingByDay: Record<string, number> = {};
  const submissionMap = new Map(data.submissions.map(s => [s.assignmentId, s]));
  
  data.assignments
    .filter(a => {
      const sub = submissionMap.get(a.id);
      return a.dueDate && 
        new Date(a.dueDate) <= twoWeeksOut && 
        new Date(a.dueDate) > new Date() &&
        !sub?.submittedAt;
    })
    .forEach(a => {
      const dueDate = new Date(a.dueDate!);
      const dayKey = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const estimatedHours = a.pointsPossible > 50 ? 3 : a.pointsPossible > 20 ? 2 : 1;
      upcomingByDay[dayKey] = (upcomingByDay[dayKey] || 0) + estimatedHours;
    });

  const chartData = Object.entries(upcomingByDay).map(([day, hours]) => ({
    day,
    hours,
    fill: hours > 4 ? 'oklch(var(--grade-danger))' : hours > 2 ? 'oklch(var(--grade-warning))' : 'oklch(var(--grade-safe))',
  }));

  const totalHours = Object.values(upcomingByDay).reduce((sum, h) => sum + h, 0);
  const busiestDay = Object.entries(upcomingByDay).sort((a, b) => b[1] - a[1])[0];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Workload Forecast</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">~{totalHours}h</p>
        <p className="text-xs text-muted-foreground mb-2">due in 2 weeks</p>
        {chartData.length > 0 ? (
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis hide />
                <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No upcoming work</p>
        )}
        {busiestDay && (
          <p className="text-xs text-muted-foreground mt-1">
            Busiest: {busiestDay[0]} ({busiestDay[1]}h)
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MomentumCard({ data }: { data: AnalyticsData }) {
  // Calculate per-course trend
  const trends = data.courses.map(course => {
    const courseSubmissions = data.submissions
      .filter(s => s.courseId === course.id && s.score !== null)
      .sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());
    
    if (courseSubmissions.length < 2) return null;
    
    // Compare first half average to second half
    const midpoint = Math.floor(courseSubmissions.length / 2);
    const firstHalf = courseSubmissions.slice(0, midpoint);
    const secondHalf = courseSubmissions.slice(midpoint);
    
    const avgFirst = firstHalf.reduce((sum, s) => {
      const a = data.assignments.find(a => a.id === s.assignmentId);
      return sum + ((s.score! / (a?.pointsPossible || 1)) * 100);
    }, 0) / firstHalf.length;
    
    const avgSecond = secondHalf.reduce((sum, s) => {
      const a = data.assignments.find(a => a.id === s.assignmentId);
      return sum + ((s.score! / (a?.pointsPossible || 1)) * 100);
    }, 0) / secondHalf.length;
    
    const delta = avgSecond - avgFirst;
    
    return {
      course,
      delta,
      trend: delta > 2 ? 'up' : delta < -2 ? 'down' : 'stable',
    };
  }).filter(Boolean) as { course: Course; delta: number; trend: 'up' | 'down' | 'stable' }[];

  if (trends.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Momentum Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Not enough data yet</p>
          <p className="text-xs text-muted-foreground mt-1">Need 2+ weeks of submissions</p>
        </CardContent>
      </Card>
    );
  }

  const mostImproved = trends.filter(t => t.trend === 'up').sort((a, b) => b.delta - a.delta)[0];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Momentum Tracker</CardTitle>
      </CardHeader>
      <CardContent>
        {mostImproved && (
          <>
            <p className="text-2xl font-bold text-[oklch(var(--grade-safe))]">
              +{Math.round(mostImproved.delta)}%
            </p>
            <p className="text-xs text-muted-foreground">{mostImproved.course.code} improving</p>
          </>
        )}
        <div className="mt-2 space-y-1">
          {trends.slice(0, 4).map(t => (
            <div key={t.course.id} className="flex items-center justify-between text-xs">
              <span className="truncate max-w-[80px]">{t.course.name.split(':')[0].replace(/AP |IB /gi,'').trim()}</span>
              <span className="flex items-center gap-1">
                {t.trend === 'up' && <TrendingUp className="h-3 w-3 text-[oklch(var(--grade-safe))]" />}
                {t.trend === 'down' && <TrendingDown className="h-3 w-3 text-[oklch(var(--grade-danger))]" />}
                {t.trend === 'stable' && <Minus className="h-3 w-3 text-muted-foreground" />}
                {Math.round(Math.abs(t.delta))}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ Monthly Wrap Cards ============

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
                <span className="text-sm font-medium truncate max-w-[120px]">{course.name.replace(/^(AP|IB|Honors) /i, '').split(':')[0].trim()}</span>
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
  const patterns = { early: 0, on_time: 0, late: 0 };
  const gradesByTiming = { early: [] as number[], on_time: [] as number[], late: [] as number[] };
  
  data.submissions
    .filter(s => s.submittedAt && s.score !== null)
    .forEach(s => {
      const assignment = data.assignments.find(a => a.id === s.assignmentId);
      const timing = submissionTiming(s.submittedAt, assignment?.dueDate ?? null);
      if (timing === 'not_submitted') return;
      
      patterns[timing]++;
      const percentage = (s.score! / (assignment?.pointsPossible || 1)) * 100;
      gradesByTiming[timing].push(percentage);
    });

  const total = patterns.early + patterns.on_time + patterns.late;
  const completionRate = total > 0 
    ? Math.round((total / data.assignments.length) * 100) 
    : 0;

  const pieData = [
    { name: 'Early', value: patterns.early, fill: 'oklch(var(--grade-safe))' },
    { name: 'On Time', value: patterns.on_time, fill: 'oklch(var(--chart-2))' },
    { name: 'Late', value: patterns.late, fill: 'oklch(var(--grade-danger))' },
  ].filter(d => d.value > 0);

  const avgByTiming = Object.entries(gradesByTiming).map(([timing, grades]) => ({
    timing,
    avg: grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : 0,
    count: grades.length,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">30-Day Submission Patterns</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="space-y-2">
              {avgByTiming.map(({ timing, avg, count }) => (
                <div key={timing} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded"
                      style={{ 
                        backgroundColor: timing === 'early' ? 'oklch(var(--grade-safe))' 
                          : timing === 'on_time' ? 'oklch(var(--chart-2))' 
                          : 'oklch(var(--grade-danger))' 
                      }}
                    />
                    <span className="text-sm capitalize">{timing.replace('_', ' ')}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">{count}</span>
                    <span className="text-muted-foreground ml-2">avg {avg}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center">
            {pieData.length > 0 ? (
              <div className="relative">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius={35}
                      outerRadius={55}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-xl font-bold">{completionRate}%</p>
                    <p className="text-xs text-muted-foreground">done</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No submissions yet</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PointsLostCard({ data }: { data: AnalyticsData }) {
  const reasons: { reason: string; points: number; course: string }[] = [];
  
  // Late penalties
  data.submissions
    .filter(s => s.late && s.score !== null)
    .forEach(s => {
      const assignment = data.assignments.find(a => a.id === s.assignmentId);
      if (assignment) {
        const expectedScore = assignment.pointsPossible * 0.9; // Assume 90% without penalty
        const lost = Math.max(0, expectedScore - s.score!);
        if (lost > 0) {
          reasons.push({
            reason: 'Late Penalty',
            points: Math.round(lost),
            course: assignment.courseCode,
          });
        }
      }
    });

  // Missing submissions
  data.submissions
    .filter(s => s.missing)
    .forEach(s => {
      const assignment = data.assignments.find(a => a.id === s.assignmentId);
      if (assignment) {
        reasons.push({
          reason: 'Missing',
          points: assignment.pointsPossible,
          course: assignment.courseCode,
        });
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
  // Use short course name (first word or acronym) as key to avoid number codes
  const getShortName = (course: Course) => {
    // e.g. "AP Calculus AB" -> "Calc AB", "Arabic Lingual..." -> "Arabic"
    const words = course.name.replace(/^(AP|IB|Honors)\s+/i, '').split(' ');
    return words.slice(0, 2).join(' ');
  };

  const courseLines = data.courses.map(course => {
    const courseSubmissions = data.submissions
      .filter(s => s.courseId === course.id && s.submittedAt && s.score !== null)
      .sort((a, b) => new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime());

    if (courseSubmissions.length < 2) return null;

    let cumEarned = 0;
    let cumPossible = 0;

    const points = courseSubmissions.map(s => {
      const assignment = data.assignments.find(a => a.id === s.assignmentId);
      const pts = assignment?.pointsPossible || 0;
      if (pts === 0) return null; // skip zero-point assignments — they skew to 100%
      cumEarned += s.score!;
      cumPossible += pts;
      return {
        date: new Date(s.submittedAt!).getTime(),
        grade: cumPossible > 0 ? Math.round((cumEarned / cumPossible) * 100) : null,
      };
    }).filter((p): p is { date: number; grade: number } => p !== null && p.grade !== null);

    if (points.length < 2) return null;

    return {
      course,
      shortName: getShortName(course),
      points,
      color: courseColor(course.id),
    };
  }).filter(Boolean) as { course: Course; shortName: string; points: { date: number; grade: number }[]; color: string }[];

  if (courseLines.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Grade Trajectory</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Not enough graded submissions yet to show trajectory
          </p>
        </CardContent>
      </Card>
    );
  }

  // Build chart data with real dates on x-axis
  const allDates = [...new Set(courseLines.flatMap(c => c.points.map(p => p.date)))].sort();
  const chartData = allDates.map(date => {
    const point: Record<string, number | string> = {
      date,
      label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
    courseLines.forEach(line => {
      // Find the most recent grade up to this date
      const match = [...line.points].reverse().find(p => p.date <= date);
      if (match) point[line.shortName] = match.grade;
    });
    return point;
  });

  // Find grade range for y-axis
  const allGrades = courseLines.flatMap(l => l.points.map(p => p.grade));
  const minGrade = Math.max(0, Math.floor(Math.min(...allGrades) / 10) * 10 - 5);
  const maxGrade = 100;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Grade Trajectory</CardTitle>
        <p className="text-xs text-muted-foreground">Running grade per course over the semester</p>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: '#888' }}
                interval="preserveStartEnd"
                tickCount={6}
              />
              <YAxis
                domain={[minGrade, maxGrade]}
                tick={{ fontSize: 10, fill: '#888' }}
                tickFormatter={v => `${v}%`}
                width={35}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-popover border border-border rounded-lg p-2 shadow-lg text-xs space-y-1">
                        <p className="font-medium text-muted-foreground">{label}</p>
                        {payload.map((p, i) => (
                          <p key={i} style={{ color: p.color as string }}>
                            {p.name}: {p.value}%
                          </p>
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
        <div className="flex flex-wrap gap-3 mt-2">
          {courseLines.map(line => (
            <div key={line.course.id} className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-1 rounded" style={{ backgroundColor: line.color }} />
              <span>{line.shortName}</span>
            </div>
          ))}
        </div>
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

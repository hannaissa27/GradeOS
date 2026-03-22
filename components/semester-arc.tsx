'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { computeProjectedGrade, getSemesterStart } from '@/lib/gradeUtils';
import type { Assignment, Submission } from '@/lib/types';

interface SemesterArcProps {
  assignments: Assignment[];
  submissions: Submission[];
  isLoading?: boolean;
}

export function SemesterArc({ assignments, submissions, isLoading }: SemesterArcProps) {
  const chartData = useMemo(() => {
    const semesterStart = new Date(getSemesterStart());

    const gradedSubmissions = submissions
      .filter((s) => s.score !== null && s.submittedAt)
      .filter((s) => new Date(s.submittedAt!) >= semesterStart)
      .map((sub) => {
        const assignment = assignments.find((a) => a.id === sub.assignmentId);
        if (!assignment) return null;
        return {
          date: new Date(sub.submittedAt!).getTime(),
          score: sub.score!,
          possible: assignment.pointsPossible,
          name: assignment.name,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.date - b!.date) as {
        date: number;
        score: number;
        possible: number;
        name: string;
      }[];

    if (gradedSubmissions.length < 2) return null;

    let cumulativeEarned = 0;
    let cumulativePossible = 0;

    const dataPoints: Array<{
      date: number;
      actual?: number;
      projected?: number;
      name: string;
    }> = gradedSubmissions.map((sub) => {
      cumulativeEarned += sub.score;
      cumulativePossible += sub.possible;
      const runningGrade = (cumulativeEarned / cumulativePossible) * 100;
      return {
        date: sub.date,
        actual: Math.round(runningGrade * 10) / 10,
        name: sub.name,
      };
    });

    const projectedGrade = computeProjectedGrade(
      gradedSubmissions.map((s) => ({ earned: s.score, possible: s.possible }))
    );

    if (projectedGrade !== null) {
      const lastPoint = dataPoints[dataPoints.length - 1];
      // Bridge point — both lines meet here
      dataPoints.push({
        date: Date.now(),
        actual: lastPoint.actual,
        projected: lastPoint.actual,
        name: 'Today',
      });
      // End-of-semester projected point
      dataPoints.push({
        date: Date.now() + 90 * 24 * 60 * 60 * 1000,
        projected: projectedGrade,
        name: 'End of Semester',
      });
    }

    return dataPoints;
  }, [assignments, submissions]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Grade Trajectory</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!chartData || chartData.length < 2) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Grade Trajectory</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Submit more assignments to see your trajectory
        </CardContent>
      </Card>
    );
  }

  const tickFormatter = (value: number) =>
    new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Find the min/max grade to set a sensible y domain
  const allGrades = chartData
    .flatMap(d => [d.actual, d.projected])
    .filter((v): v is number => v !== undefined);
  const minGrade = Math.max(0, Math.floor(Math.min(...allGrades) / 10) * 10 - 10);
  const maxGrade = Math.min(100, Math.ceil(Math.max(...allGrades) / 10) * 10 + 5);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Grade Trajectory</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your running grade over the semester — blue line is real, dashed is projected final
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <XAxis
                dataKey="date"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tick={{ fontSize: 10, fill: '#888' }}
                tickFormatter={tickFormatter}
                tickCount={5}
              />
              <YAxis
                domain={[minGrade, maxGrade]}
                tick={{ fontSize: 10, fill: '#888' }}
                tickFormatter={(value) => `${value}%`}
                width={35}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border border-border rounded-lg p-2 shadow-lg text-xs">
                        <p className="font-medium mb-1">
                          {data.name === 'Today' || data.name === 'End of Semester'
                            ? data.name
                            : new Date(data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                        {data.actual !== undefined && (
                          <p style={{ color: '#3b82f6' }}>Grade: {data.actual}%</p>
                        )}
                        {data.projected !== undefined && data.name !== 'Today' && (
                          <p style={{ color: '#888' }}>Projected: {data.projected}%</p>
                        )}
                        {data.name && data.name !== 'Today' && data.name !== 'End of Semester' && (
                          <p className="text-muted-foreground mt-1 truncate max-w-[160px]">{data.name}</p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={90} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls
                name="Grade"
              />
              <Line
                type="monotone"
                dataKey="projected"
                stroke="#888"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls
                name="Projected"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 rounded" style={{ backgroundColor: '#3b82f6' }} />
            <span>Your grade over time</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0 border-t-2 border-dashed" style={{ borderColor: '#888' }} />
            <span>Where you will finish</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

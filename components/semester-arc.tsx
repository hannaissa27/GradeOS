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
  const chartData = useMemo(() => { try {
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
  } catch { return null; }
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Grade Trajectory</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <XAxis
                dataKey="date"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tick={{ fontSize: 10 }}
                tickFormatter={tickFormatter}
              />
              <YAxis
                domain={[50, 100]}
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border border-border rounded-lg p-2 shadow-lg text-xs">
                        <p className="font-medium">{data.name}</p>
                        {data.actual !== undefined && (
                          <p className="text-muted-foreground">Actual: {data.actual}%</p>
                        )}
                        {data.projected !== undefined && (
                          <p className="text-muted-foreground">Projected: {data.projected}%</p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={90} stroke="hsl(142, 71%, 45%)" strokeDasharray="3 3" />
              <ReferenceLine y={80} stroke="hsl(38, 92%, 50%)" strokeDasharray="3 3" />
              <ReferenceLine y={70} stroke="hsl(0, 84%, 60%)" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="hsl(221, 83%, 53%)"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(221, 83%, 53%)" }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="projected"
                stroke="hsl(215, 16%, 55%)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-foreground" />
            <span>Actual grade</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 border-t-2 border-dashed border-muted-foreground" />
            <span>Projected final</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

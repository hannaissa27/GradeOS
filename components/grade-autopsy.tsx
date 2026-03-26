'use client';

import React, { useState, useMemo } from 'react';
import { Loader2, ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react';
import { callClaude, hasAIKey } from '@/lib/aiUtils';
import { courseColor, gradeToLetter, formatDueDate } from '@/lib/gradeUtils';
import { HelpTip } from '@/components/help-tip';
import type { Course, Assignment, Submission } from '@/lib/types';

interface GradeAutopsyProps {
  courses: Course[];
  allAssignments: Assignment[];
  allSubmissions: Submission[];
}

type StudyTiming = 'night_before' | 'two_three_days' | 'week_before' | 'didnt_study';
type ExitFeeling = 'confident' | 'unsure' | 'knew_i_failed';
type FailureType = 'time_failure' | 'confidence_illusion' | 'knowledge_gap' | 'test_taking_failure';

interface AutopsyResult {
  failureType: FailureType;
  failureLabel: string;
  diagnosis: string;
  nextAction: string;
  assignmentName: string;
}

interface AutopsySession {
  assignmentId: string;
  step: 'q1' | 'q2' | 'analyzing' | 'result';
  studyTiming?: StudyTiming;
  result?: AutopsyResult;
  error?: string;
}

const FAILURE_COLORS: Record<FailureType, string> = {
  time_failure: 'text-amber-500',
  confidence_illusion: 'text-red-500',
  knowledge_gap: 'text-orange-500',
  test_taking_failure: 'text-blue-500',
};

const FAILURE_BG: Record<FailureType, string> = {
  time_failure: 'bg-amber-500/10 border-amber-500/20',
  confidence_illusion: 'bg-red-500/10 border-red-500/20',
  knowledge_gap: 'bg-orange-500/10 border-orange-500/20',
  test_taking_failure: 'bg-blue-500/10 border-blue-500/20',
};

export function GradeAutopsy({ courses, allAssignments, allSubmissions }: GradeAutopsyProps) {
  const [sessions, setSessions] = useState<Map<string, AutopsySession>>(new Map());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  
  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('gradeos-autopsy-dismissed') || '[]');
      setDismissed(new Set(saved));
    } catch {}
  }, []);

  const dismiss = (assignmentId: string) => {
    const next = new Set(dismissed);
    next.add(assignmentId);
    setDismissed(next);
    localStorage.setItem('gradeos-autopsy-dismissed', JSON.stringify([...next]));
  };

  // Find assignments that scored below the course average — these are autopsy candidates
  const autopsyCandidates = useMemo(() => {
    const candidates: { assignment: Assignment; submission: Submission; course: Course; pct: number; coursePct: number }[] = [];

    for (const course of courses) {
      const courseAssignments = allAssignments.filter(a => a.courseId === course.id);
      const courseSubmissions = allSubmissions.filter(s => s.courseId === course.id && s.score !== null);

      if (courseSubmissions.length < 2) continue; // need at least 2 to compare

      // Compute course average percentage
      let totalEarned = 0, totalPossible = 0;
      for (const sub of courseSubmissions) {
        const asgn = courseAssignments.find(a => a.id === sub.assignmentId);
        if (!asgn || !asgn.pointsPossible) continue;
        totalEarned += sub.score!;
        totalPossible += asgn.pointsPossible;
      }
      if (totalPossible === 0) continue;
      const coursePct = (totalEarned / totalPossible) * 100;

      // Find graded assignments significantly below the course average
      for (const sub of courseSubmissions) {
        if (dismissed.has(sub.assignmentId)) continue;
        const asgn = courseAssignments.find(a => a.id === sub.assignmentId);
        if (!asgn || !asgn.pointsPossible) continue;
        if (!sub.score === null) continue;

        const pct = (sub.score! / asgn.pointsPossible) * 100;
        const gap = coursePct - pct;

        // Flag if 15+ percentage points below their own course average AND below 75%
        if (gap >= 15 && pct < 75) {
          candidates.push({ assignment: asgn, submission: sub, course, pct, coursePct });
        }
      }
    }

    // Sort by gap size — worst first
    return candidates.sort((a, b) => (b.coursePct - b.pct) - (a.coursePct - a.pct));
  }, [courses, allAssignments, allSubmissions, dismissed]);

  if (autopsyCandidates.length === 0) return null;

  const setSession = (assignmentId: string, update: Partial<AutopsySession>) => {
    setSessions(prev => {
      const next = new Map(prev);
      const existing = next.get(assignmentId) || { assignmentId, step: 'q1' };
      next.set(assignmentId, { ...existing, ...update });
      return next;
    });
  };

  const handleStudyTiming = (assignmentId: string, timing: StudyTiming) => {
    setSession(assignmentId, { step: 'q2', studyTiming: timing });
  };

  const handleExitFeeling = async (assignmentId: string, feeling: ExitFeeling) => {
    const session = sessions.get(assignmentId);
    if (!session) return;

    setSession(assignmentId, { step: 'analyzing' });

    const candidate = autopsyCandidates.find(c => c.assignment.id === assignmentId);
    if (!candidate) return;

    if (!hasAIKey()) {
      setSession(assignmentId, {
        step: 'result',
        error: 'Add your Anthropic API key in Settings to get your diagnosis.',
      });
      return;
    }

    // Build grade history context
    const courseHistory = allSubmissions
      .filter(s => s.courseId === candidate.course.id && s.score !== null)
      .map(s => {
        const a = allAssignments.find(x => x.id === s.assignmentId);
        if (!a) return null;
        const pct = Math.round((s.score! / a.pointsPossible) * 100);
        return `${a.name}: ${s.score}/${a.pointsPossible} (${pct}%)${s.late ? ' [late]' : ''}`;
      })
      .filter(Boolean)
      .slice(-10)
      .join('\n');

    // Next upcoming assignment in the course
    const nextAssignment = allAssignments
      .filter(a => {
        const sub = allSubmissions.find(s => s.assignmentId === a.id);
        return a.courseId === candidate.course.id
          && a.dueDate
          && new Date(a.dueDate) > new Date()
          && (!sub?.score && !sub?.submittedAt);
      })
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0];

    const timingLabels: Record<StudyTiming, string> = {
      night_before: 'night before',
      two_three_days: '2-3 days before',
      week_before: 'a week before',
      didnt_study: "didn't study at all",
    };

    const feelingLabels: Record<ExitFeeling, string> = {
      confident: 'confident walking out',
      unsure: 'unsure walking out',
      knew_i_failed: 'knew they failed walking out',
    };

    try {
      const userMsg = [
        `Course: ${candidate.course.name}`,
        `Bombed: "${candidate.assignment.name}" — ${Math.round(candidate.pct)}% (course avg: ${Math.round(candidate.coursePct)}%)`,
        `Points lost: ${candidate.assignment.pointsPossible - candidate.submission.score!} / ${candidate.assignment.pointsPossible}`,
        `Study timing: ${timingLabels[session.studyTiming!]}`,
        `Exit feeling: ${feelingLabels[feeling]}`,
        courseHistory ? `Recent grades: ${courseHistory}` : '',
        nextAssignment ? `Next assignment: "${nextAssignment.name}" due ${nextAssignment.dueDate ? new Date(nextAssignment.dueDate).toLocaleDateString() : 'unknown'}` : '',
      ].filter(Boolean).join('. ');

      const response = await callClaude(
        userMsg,

        'You are an academic coach. Diagnose why a student bombed an assignment. Four failure types: time_failure, confidence_illusion, knowledge_gap, test_taking_failure. Return ONLY this JSON (no markdown): {"failureType":"one of the four","failureLabel":"2-4 word label","diagnosis":"2-3 direct sentences naming what happened","nextAction":"one concrete next step for their next assignment"}',
        600
      );

      const parsed = JSON.parse(response.replace(/```json|```/g, '').trim());
      setSession(assignmentId, {
        step: 'result',
        result: {
          ...parsed,
          assignmentName: candidate.assignment.name,
        },
      });
    } catch (err: any) {
      const msg = err?.message || '';
      setSession(assignmentId, {
        step: 'result',
        error: msg === 'NO_API_KEY'
          ? 'No API key set. Go to Settings to add your Anthropic key.'
          : msg === 'INVALID_API_KEY'
          ? 'Invalid API key. Check your key in Settings.'
          : 'Analysis failed — check your API key in Settings and try again.',
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-red-500">Grade Autopsy</h3>
        <HelpTip text="When you score significantly below your own average in a course, Grade Autopsy activates automatically. It asks you two quick questions, then tells you exactly which type of failure caused it — and gives you one specific action to prevent it next time. There are only four failure types. Knowing yours is the whole point." />
        <span className="text-xs text-muted-foreground">— {autopsyCandidates.length} assignment{autopsyCandidates.length !== 1 ? 's' : ''} need{autopsyCandidates.length === 1 ? 's' : ''} attention</span>
      </div>

      {autopsyCandidates.map(({ assignment, submission, course, pct, coursePct }) => {
        const session = sessions.get(assignment.id);
        const gap = Math.round(coursePct - pct);

        return (
          <div key={assignment.id} className="rounded-lg border border-red-500/20 bg-red-500/5 overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between p-3 pb-2">
              <div className="flex items-start gap-2 min-w-0">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: courseColor(course.id) }} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{assignment.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {course.name.includes(':') ? course.name.split(':').slice(1).join(':').trim().replace(/^(AP|IB|Honors|Accelerated) /i,'').trim() : course.name}
                    {' · '}
                    <span className="text-red-500 font-medium">{Math.round(pct)}%</span>
                    {' · '}
                    <span className="text-muted-foreground">{gap}pts below your average</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCollapsed(prev => {
                  const next = new Set(prev);
                  next.has(assignment.id) ? next.delete(assignment.id) : next.add(assignment.id);
                  return next;
                })}
                className="text-muted-foreground hover:text-foreground cursor-pointer p-1 flex-shrink-0"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${collapsed.has(assignment.id) ? '-rotate-90' : ''}`} />
              </button>
            </div>

            {/* Content based on session state */}
            {!collapsed.has(assignment.id) && (!session ? (
              /* Prompt to start */
              <div className="px-3 pb-3">
                <p className="text-xs text-muted-foreground mb-2">
                  Something went wrong here. Let's figure out what — takes 10 seconds.
                </p>
                  <button
                    onClick={() => setSession(assignment.id, { assignmentId: assignment.id, step: 'q1' })}
                    className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 cursor-pointer transition-colors"
                  >
                    Run autopsy <ChevronRight className="h-3 w-3" />
                  </button>
              </div>
            ) : session.step === 'q1' ? (
              /* Q1: Study timing */
              <div className="px-3 pb-3 space-y-2">
                <p className="text-xs font-medium">When did you start studying for this?</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    ['night_before', 'Night before'],
                    ['two_three_days', '2–3 days before'],
                    ['week_before', 'A week before'],
                    ['didnt_study', "Didn't study"],
                  ] as [StudyTiming, string][]).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => handleStudyTiming(assignment.id, value)}
                      className="text-xs px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer transition-colors text-left font-medium"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : session.step === 'q2' ? (
              /* Q2: Exit feeling */
              <div className="px-3 pb-3 space-y-2">
                <p className="text-xs font-medium">How did you feel walking out?</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    ['confident', 'Confident'],
                    ['unsure', 'Unsure'],
                    ['knew_i_failed', 'Knew I failed'],
                  ] as [ExitFeeling, string][]).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => handleExitFeeling(assignment.id, value)}
                      className="text-xs px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer transition-colors font-medium"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : session.step === 'analyzing' ? (
              /* Analyzing */
              <div className="px-3 pb-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analyzing your pattern...
              </div>
            ) : session.step === 'result' ? (
              /* Result */
              <div className="px-3 pb-3">
                {session.error ? (
                  <p className="text-xs text-muted-foreground">{session.error}</p>
                ) : session.result && (
                  <div className={`rounded-lg border p-3 space-y-3 ${FAILURE_BG[session.result.failureType]}`}>
                    {/* Failure type badge */}
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold uppercase tracking-wide ${FAILURE_COLORS[session.result.failureType]}`}>
                        {session.result.failureLabel}
                      </span>
                    </div>

                    {/* Diagnosis */}
                    <p className="text-xs leading-relaxed text-foreground/80">
                      {session.result.diagnosis}
                    </p>

                    {/* Next action */}
                    <div className="space-y-1 pt-1 border-t border-border/30">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">What to do next</p>
                      <p className="text-xs font-medium leading-snug">{session.result.nextAction}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : null)}
          </div>
        );
      })}
    </div>
  );
}

// Grade utility functions for GradeOS

/**
 * Get semester start date based on current month.
 * Fall: Aug 1 | Summer: May 15 | Spring: Jan 1
 */
export function getSemesterStart(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  
  let semStart: Date;
  if (month >= 7) {
    // Fall semester (August onwards)
    semStart = new Date(year, 7, 1); // Aug 1
  } else if (month >= 5) {
    // Summer (June-July)
    semStart = new Date(year, 4, 15); // May 15
  } else {
    // Spring semester (Jan-May)
    semStart = new Date(year, 0, 1); // Jan 1
  }
  
  return semStart.toISOString();
}

/**
 * Compute current grade from only current-semester assignments and submissions
 */
export function computeCurrentGrade(
  assignments: { id: string; dueDate?: string | null; pointsPossible: number; submissionScore?: number | null }[],
  submissions: { assignmentId: string; score: number | null }[],
  semesterStart: Date
): number | null {
  const semesterAssignments = assignments.filter(a => {
    if (!a.dueDate) return true;
    return new Date(a.dueDate) >= semesterStart;
  });

  let totalEarned = 0;
  let totalPossible = 0;

  for (const assignment of semesterAssignments) {
    if (!assignment.pointsPossible || assignment.pointsPossible === 0) continue;
    
    // Check submissions array first, then fall back to embedded score
    const submission = submissions.find(s => s.assignmentId === assignment.id);
    const score = submission?.score ?? (assignment as any).submissionScore ?? null;
    
    if (score !== null) {
      totalEarned += score;
      totalPossible += assignment.pointsPossible;
    }
  }

  if (totalPossible === 0) return null;
  return Math.round((totalEarned / totalPossible) * 10000) / 100;
}

/**
 * Compute projected grade using linear regression on graded assignments
 */
export function computeProjectedGrade(points: { earned: number; possible: number }[]): number | null {
  const validPoints = points.filter(p => p.possible > 0);
  if (validPoints.length < 2) return null;
  
  // Simple weighted average for projection
  const totalEarned = validPoints.reduce((sum, p) => sum + p.earned, 0);
  const totalPossible = validPoints.reduce((sum, p) => sum + p.possible, 0);
  
  if (totalPossible === 0) return null;
  return Math.round((totalEarned / totalPossible) * 100 * 10) / 10;
}

/**
 * Convert minutes to human-readable label
 */
export function minutesToLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return hours === 1 ? '1 hour' : `${hours} hours`;
  return `${hours} hour${hours > 1 ? 's' : ''} ${mins} min`;
}

/**
 * Generate deterministic color for a course based on ID
 */
export function courseColor(courseId: string): string {
  const charCodeSum = courseId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const hue = (charCodeSum * 137) % 360;
  return `hsl(${hue}, 60%, 45%)`;
}

/**
 * Format due date for display
 */
export function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return 'No due date';
  
  const now = new Date();
  const due = new Date(dateStr);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  
  if (dueDay < today) return `Overdue · ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  if (dueDay.getTime() === today.getTime()) return 'Due Today';
  if (dueDay.getTime() === tomorrow.getTime()) return 'Due Tomorrow';
  
  return `Due ${due.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
}

/**
 * Get Tailwind color class for due date urgency
 */
export function getDueDateColor(dateStr: string | null): string {
  if (!dateStr) return 'text-muted-foreground';
  
  const now = new Date();
  const due = new Date(dateStr);
  const hoursUntil = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  if (hoursUntil < 0) return 'text-[oklch(var(--grade-danger))]';
  if (hoursUntil < 24) return 'text-[oklch(var(--grade-warning))]';
  if (hoursUntil < 72) return 'text-[oklch(var(--grade-warning))]';
  return 'text-muted-foreground';
}

/**
 * Determine submission timing category
 */
export function submissionTiming(submittedAt: string | null, dueAt: string | null): 'early' | 'on_time' | 'late' | 'not_submitted' {
  if (!submittedAt) return 'not_submitted';
  if (!dueAt) return 'on_time';
  
  const submitted = new Date(submittedAt);
  const due = new Date(dueAt);
  const hoursEarly = (due.getTime() - submitted.getTime()) / (1000 * 60 * 60);
  
  if (hoursEarly >= 24) return 'early';
  if (hoursEarly >= 0) return 'on_time';
  return 'late';
}

/**
 * Get grade color class based on score
 */
export function getGradeColor(grade: number | null): string {
  if (grade === null) return 'text-muted-foreground';
  if (grade >= 85) return 'text-[oklch(var(--grade-safe))]';
  if (grade >= 75) return 'text-[oklch(var(--grade-warning))]';
  return 'text-[oklch(var(--grade-danger))]';
}

/**
 * Get grade background color for progress bars
 */
export function getGradeBackground(grade: number | null): string {
  if (grade === null) return 'bg-muted';
  if (grade >= 85) return 'bg-[oklch(var(--grade-safe))]';
  if (grade >= 75) return 'bg-[oklch(var(--grade-warning))]';
  return 'bg-[oklch(var(--grade-danger))]';
}

/**
 * Convert grade percentage to letter grade
 */
export function gradeToLetter(grade: number | null): string {
  if (grade === null) return '--';
  if (grade >= 93) return 'A';
  if (grade >= 90) return 'A-';
  if (grade >= 87) return 'B+';
  if (grade >= 83) return 'B';
  if (grade >= 80) return 'B-';
  if (grade >= 77) return 'C+';
  if (grade >= 73) return 'C';
  if (grade >= 70) return 'C-';
  if (grade >= 67) return 'D+';
  if (grade >= 63) return 'D';
  if (grade >= 60) return 'D-';
  return 'F';
}

/**
 * Get assignment type badge variant
 */
export function getAssignmentTypeBadge(submissionTypes: string[]): { label: string; className: string } {
  const types = submissionTypes.join(',').toLowerCase();
  
  if (types.includes('online_quiz')) {
    return { label: 'Quiz', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' };
  }
  if (types.includes('online_text_entry') || types.includes('online_upload')) {
    if (types.includes('essay') || types.includes('paper')) {
      return { label: 'Essay', className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' };
    }
    return { label: 'Homework', className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' };
  }
  if (types.includes('discussion')) {
    return { label: 'Discussion', className: 'bg-teal-500/10 text-teal-600 dark:text-teal-400' };
  }
  if (types.includes('external_tool')) {
    return { label: 'External', className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' };
  }
  
  return { label: 'Assignment', className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' };
}

/**
 * Calculate ROI for an assignment (points per hour of effort)
 */
export function calculateROI(pointsPossible: number, effortMinutes: number): number {
  if (effortMinutes <= 0) return pointsPossible; // High ROI for unknown effort
  const effortHours = effortMinutes / 60;
  return Math.round((pointsPossible / effortHours) * 10) / 10;
}

/**
 * Format relative time (e.g., "3 days ago")
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

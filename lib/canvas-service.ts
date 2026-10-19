// Canvas LMS integration service - handles API calls and mock data
import { CanvasConnection, Course, Assignment, Submission, Announcement, File } from './types';
import { getSemesterStart } from './gradeUtils';

const MOCK_COURSES: Course[] = [
  {
    id: '1',
    name: 'Data Structures',
    code: 'CS 201',
    enrollmentState: 'active',
    currentGrade: 87,
    finalGrade: null,
    teachers: [{ id: '1', name: 'Dr. Smith', email: 'smith@university.edu' }],
  },
  {
    id: '2',
    name: 'Organic Chemistry',
    code: 'CHEM 301',
    enrollmentState: 'active',
    currentGrade: 79,
    finalGrade: null,
    teachers: [{ id: '2', name: 'Prof. Johnson', email: 'johnson@university.edu' }],
  },
  {
    id: '3',
    name: 'Linear Algebra',
    code: 'MATH 251',
    enrollmentState: 'active',
    currentGrade: 92,
    finalGrade: null,
    teachers: [{ id: '3', name: 'Dr. Lee', email: 'lee@university.edu' }],
  },
  {
    id: '4',
    name: 'English Literature',
    code: 'ENG 150',
    enrollmentState: 'active',
    currentGrade: 88,
    finalGrade: null,
    teachers: [{ id: '4', name: 'Prof. Garcia', email: 'garcia@university.edu' }],
  },
];


function mapAssignments(
  raw: any[],
  courseId: string,
  groupWeights: Record<string, number>,
  groupNames: Record<string, string>,
): Assignment[] {
  const semesterStart = new Date(getSemesterStart());
  return raw
    .filter((a: any) => a.published && a.id != null)
    .filter((a: any) => !a.due_at || new Date(a.due_at) >= semesterStart)
    .map((a: any) => ({
      id: String(a.id),
      courseId,
      courseName: '',
      courseCode: '',
      name: a.name,
      description: a.description || null,
      dueDate: a.due_at || null,
      pointsPossible: a.points_possible || 0,
      submissionTypes: a.submission_types || [],
      published: a.published,
      assignmentGroupId: a.assignment_group_id ? String(a.assignment_group_id) : null,
      assignmentGroupWeight: a.assignment_group_id ? (groupWeights[String(a.assignment_group_id)] || 0) : 0,
      assignmentGroupName: a.assignment_group_id ? (groupNames[String(a.assignment_group_id)] || '') : '',
      submissionScore: a.submission?.score ?? null,
      submissionState: a.submission?.workflow_state || 'unsubmitted',
      submittedAt: a.submission?.submitted_at || null,
      grade: a.submission?.grade || null,
    }))
    .sort((a, b) => {
      if (!a.dueDate || !b.dueDate) return 0;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
}

function mapSubmissions(raw: any[], courseId: string): Submission[] {
  const semStart = new Date(getSemesterStart());
  return raw
    .filter((a: any) => a.submission && a.id != null)
    .filter((a: any) => !a.due_at || new Date(a.due_at) >= semStart)
    .map((a: any) => ({
      id: (a.submission.id != null ? String(a.submission.id) : '') || String(a.id),
      userId: a.submission.user_id != null ? String(a.submission.user_id) : '',
      assignmentId: String(a.id),
      courseId,
      score: a.submission.score ?? null,
      grade: a.submission.grade || null,
      submittedAt: a.submission.submitted_at || null,
      gradedAt: a.submission.graded_at || null,
      late: a.submission.late || false,
      // Don't mark as missing if already submitted/graded, or if no online submission is needed
      missing: (() => {
        const types: string[] = a.submission_types || [];
        const noOnlineNeeded = types.every((t: string) => t === 'none' || t === 'not_graded' || t === 'on_paper');
        if (noOnlineNeeded) return false;
        if (a.submission.workflow_state === 'submitted' || a.submission.workflow_state === 'graded' || a.submission.submitted_at) return false;
        return a.submission.missing || false;
      })(),
      excused: a.submission.excused || false,
      workflowState: a.submission.workflow_state || 'unsubmitted',
    }));
}

// ─── Demo data ───────────────────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000;
const inDays = (d: number) => new Date(Date.now() + d * DAY).toISOString();

interface MockSpec {
  id: string; name: string; pts: number; due: number; type: string;
  group?: { id: string; name: string; weight: number };
  score?: number; late?: boolean; missing?: boolean; submittedDaysBeforeDue?: number;
}

const MOCK_WORK: Record<string, { course: Course; items: MockSpec[] }> = {
  '1': {
    course: MOCK_COURSES[0],
    items: [
      { id: 'a1-p1', name: 'Linked Lists Homework', pts: 40, due: -28, type: 'online_upload', group: { id: 'g1-hw', name: 'Homework', weight: 30 }, score: 38, submittedDaysBeforeDue: 2 },
      { id: 'a1-p2', name: 'Stacks & Queues Quiz', pts: 50, due: -21, type: 'online_quiz', group: { id: 'g1-q', name: 'Quizzes', weight: 20 }, score: 44, submittedDaysBeforeDue: 0 },
      { id: 'a1-p3', name: 'Recursion Homework', pts: 40, due: -14, type: 'online_upload', group: { id: 'g1-hw', name: 'Homework', weight: 30 }, score: 29, late: true, submittedDaysBeforeDue: -1 },
      { id: 'a1-p4', name: 'Midterm Exam', pts: 150, due: -6, type: 'online_quiz', group: { id: 'g1-ex', name: 'Exams', weight: 50 }, score: 128, submittedDaysBeforeDue: 0 },
      { id: 'a1-1', name: 'Binary Search Trees Implementation', pts: 100, due: 2, type: 'online_upload', group: { id: 'g1-hw', name: 'Homework', weight: 30 } },
      { id: 'a1-2', name: 'Graph Algorithms Quiz', pts: 50, due: 7, type: 'online_quiz', group: { id: 'g1-q', name: 'Quizzes', weight: 20 } },
    ],
  },
  '2': {
    course: MOCK_COURSES[1],
    items: [
      { id: 'a2-p1', name: 'Lab Report: Distillation', pts: 75, due: -25, type: 'online_upload', group: { id: 'g2-lab', name: 'Labs', weight: 35 }, score: 54, submittedDaysBeforeDue: 0 },
      { id: 'a2-p2', name: 'Nomenclature Quiz', pts: 30, due: -18, type: 'online_quiz', group: { id: 'g2-q', name: 'Quizzes', weight: 15 }, score: 27, submittedDaysBeforeDue: 1 },
      { id: 'a2-p3', name: 'Problem Set 3', pts: 50, due: -10, type: 'online_upload', group: { id: 'g2-hw', name: 'Problem Sets', weight: 20 }, missing: true },
      { id: 'a2-p4', name: 'Stereochemistry Exam', pts: 100, due: -4, type: 'online_quiz', group: { id: 'g2-ex', name: 'Exams', weight: 30 }, score: 81, submittedDaysBeforeDue: 0 },
      { id: 'a2-1', name: 'Lab Report: Synthesis', pts: 75, due: 3, type: 'online_upload', group: { id: 'g2-lab', name: 'Labs', weight: 35 } },
      { id: 'a2-2', name: 'Reaction Mechanisms Exam', pts: 150, due: 3, type: 'online_quiz', group: { id: 'g2-ex', name: 'Exams', weight: 30 } },
    ],
  },
  '3': {
    course: MOCK_COURSES[2],
    items: [
      { id: 'a3-p1', name: 'Vector Spaces Homework', pts: 40, due: -24, type: 'online_upload', score: 39, submittedDaysBeforeDue: 3 },
      { id: 'a3-p2', name: 'Determinants Quiz', pts: 30, due: -15, type: 'online_quiz', score: 26, submittedDaysBeforeDue: 0 },
      { id: 'a3-p3', name: 'Eigenvalues Homework', pts: 40, due: -8, type: 'online_upload', score: 37, submittedDaysBeforeDue: 2 },
      { id: 'a3-1', name: 'Matrix Operations Homework', pts: 40, due: 4, type: 'online_upload' },
      { id: 'a3-2', name: 'Midterm 2', pts: 120, due: 11, type: 'online_quiz' },
    ],
  },
  '4': {
    course: MOCK_COURSES[3],
    items: [
      { id: 'a4-p1', name: 'Reading Response: Woolf', pts: 20, due: -26, type: 'discussion_topic', group: { id: 'g4-d', name: 'Discussions', weight: 20 }, score: 19, submittedDaysBeforeDue: 1 },
      { id: 'a4-p2', name: 'Essay 1: Modernism', pts: 100, due: -16, type: 'online_upload', group: { id: 'g4-e', name: 'Essays', weight: 60 }, score: 84, submittedDaysBeforeDue: 0 },
      { id: 'a4-p3', name: 'Reading Response: Eliot', pts: 20, due: -9, type: 'discussion_topic', group: { id: 'g4-d', name: 'Discussions', weight: 20 }, score: 20, submittedDaysBeforeDue: 2 },
      { id: 'a4-p4', name: 'Poetry Quiz', pts: 25, due: -3, type: 'online_quiz', group: { id: 'g4-q', name: 'Quizzes', weight: 20 }, score: 17, submittedDaysBeforeDue: 0 },
      { id: 'a4-1', name: 'Essay: Modern Poetry Analysis', pts: 200, due: 6, type: 'online_upload', group: { id: 'g4-e', name: 'Essays', weight: 60 } },
    ],
  },
};

function getMockAssignments(courseId: string): Assignment[] {
  const entry = MOCK_WORK[courseId];
  if (!entry) return [];
  return entry.items.map(m => ({
    id: m.id,
    courseId,
    courseName: entry.course.name,
    courseCode: entry.course.code,
    name: m.name,
    description: null,
    dueDate: inDays(m.due),
    pointsPossible: m.pts,
    submissionTypes: [m.type],
    published: true,
    assignmentGroupId: m.group?.id ?? null,
    assignmentGroupWeight: m.group?.weight ?? 0,
    assignmentGroupName: m.group?.name ?? '',
    submissionScore: m.score ?? null,
    submissionState: m.score !== undefined ? 'graded' : 'unsubmitted',
    submittedAt: m.score !== undefined ? inDays(m.due - (m.submittedDaysBeforeDue ?? 0)) : null,
    grade: m.score !== undefined ? String(m.score) : null,
  }));
}

function getMockSubmissions(courseId: string): Submission[] {
  const entry = MOCK_WORK[courseId];
  if (!entry) return [];
  return entry.items
    .filter(m => m.score !== undefined || m.missing)
    .map(m => ({
      id: `sub-${m.id}`,
      userId: 'demo',
      assignmentId: m.id,
      courseId,
      grade: m.score ?? null,
      score: m.score ?? null,
      submittedAt: m.score !== undefined ? inDays(m.due - (m.submittedDaysBeforeDue ?? 0)) : null,
      gradedAt: m.score !== undefined ? inDays(m.due + 1) : null,
      late: !!m.late,
      missing: !!m.missing,
      excused: false,
      workflowState: m.score !== undefined ? 'graded' : 'unsubmitted',
    }));
}

// Canvas API fetch - uses server-side proxy to avoid CORS issues
async function canvasFetch<T>(path: string, connection: CanvasConnection): Promise<T> {
  try {
    const res = await fetch('/api/canvas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canvasUrl: connection.canvasUrl,
        accessToken: connection.accessToken,
        path,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Canvas API error: ${res.status}`);
    }

    return data;
  } catch (error: any) {
    // Handle network errors
    if (error.message?.includes('Failed to fetch') || error.name === 'TypeError') {
      throw new Error('Network error. Please check your connection and try again.');
    }
    throw error;
  }
}

export async function validateToken(canvasUrl: string, token: string) {
  // Demo mode - skip validation
  if (token === 'demo' || token === 'DEMO') {
    return {
      connected: false, // Keep as false to use mock data
      userName: 'Demo Student',
      isDemo: true,
      error: undefined,
    };
  }

  const tempConnection: CanvasConnection = {
    canvasUrl,
    accessToken: token,
    connected: false,
    userName: '',
  };
  try {
    const user = await canvasFetch<any>('/users/self?include[]=email', tempConnection);
    return {
      connected: true,
      userName: user.name || 'Student',
      isDemo: false,
      error: undefined,
    };
  } catch (error: any) {
    console.error('[GradeOS] validateToken failed:', error);
    return {
      connected: false,
      userName: '',
      isDemo: false,
      error: error.message || 'Connection failed. Check your Canvas URL and token.',
    };
  }
}

export async function fetchCourses(connection: CanvasConnection): Promise<Course[]> {
  if (!connection.connected) {
    return MOCK_COURSES;
  }

  try {
    const courses = await canvasFetch<any>(
      '/courses?enrollment_state=active&include[]=total_scores&include[]=enrollments&include[]=teachers&include[]=term&per_page=100&state[]=available',
      connection
    );

    // Guard: Canvas sometimes returns {errors: [...]} instead of array
    if (!Array.isArray(courses)) {
      console.error('[GradeOS] courses response is not an array:', courses);
      throw new Error(
        courses?.errors?.[0]?.message || 
        courses?.message || 
        'Canvas returned unexpected data. Check your token permissions.'
      );
    }

    // Filter to current enrollment term only
    const today = new Date();
    
    return courses
      .filter((course) => course.id != null)
      .filter((course) => {
        // Filter out advisory/homeroom/non-academic courses
        const name = (course.name || '').toLowerCase();
        if (/advisory|school meeting|homeroom|counseling|lunch|study hall/.test(name)) return false;
        // If the course has term info, only include it if the term hasn't ended
        if (course.term?.end_at) {
          return new Date(course.term.end_at) >= today;
        }
        // If no term info, include it (better to show too much than too little)
        return true;
      })
      .map((course) => ({
        id: (course.id != null ? String(course.id) : ""),
        name: course.name || 'Unnamed Course',
        code: course.course_code || (course.id != null ? String(course.id) : ""),
        enrollmentState: course.enrollment_state || 'active',
        currentGrade: null, // Will be computed from actual submissions, not Canvas's cumulative score
        finalGrade: course.enrollments?.[0]?.computed_final_score ?? null,
        teachers: (course.teachers || [])
          .filter((t: any) => t != null)
          .map((t: any) => ({
            id: (t.id != null ? t.id : '').toString(),
            name: t.display_name || t.name || 'Professor',
            email: t.email || '',
          })),
      }));
  } catch (error) {
    throw error;
  }
}

export async function fetchAssignments(courseId: string, connection: CanvasConnection): Promise<Assignment[]> {
  if (!connection.connected) {
    return getMockAssignments(courseId);
  }

  try {
    const path = `/courses/${courseId}/assignments?per_page=100&include[]=submission&include[]=assignment_group&order_by=due_at`;
    const assignments = await canvasFetch<any>(path, connection);

    // Guard against non-array response
    if (!Array.isArray(assignments)) {
      console.warn('[GradeOS] assignments not array for course', courseId, assignments);
      return [];
    }

    // Also fetch assignment groups to get weights
    let groupWeights: Record<string, number> = {};
    let groupNames: Record<string, string> = {};
    try {
      const groups = await canvasFetch<any>(`/courses/${courseId}/assignment_groups?per_page=100`, connection);
      if (Array.isArray(groups)) {
        groups.forEach((g: any) => {
          if (g.id != null) {
            groupWeights[String(g.id)] = g.group_weight || 0;
            groupNames[String(g.id)] = g.name || '';
          }
        });
      }
    } catch {}

    return mapAssignments(assignments, courseId, groupWeights, groupNames);
  } catch (error) {
    throw error;
  }
}

/**
 * Fetch assignments and submissions for a course with ONE Canvas request.
 * (fetchAssignments and fetchSubmissions hit the same endpoint; calling both doubles the API load.)
 */
export async function fetchCourseWork(
  courseId: string,
  connection: CanvasConnection,
): Promise<{ assignments: Assignment[]; submissions: Submission[] }> {
  if (!connection.connected) {
    return { assignments: getMockAssignments(courseId), submissions: getMockSubmissions(courseId) };
  }

  const path = `/courses/${courseId}/assignments?per_page=100&include[]=submission&include[]=assignment_group&order_by=due_at`;
  const raw = await canvasFetch<any>(path, connection);
  if (!Array.isArray(raw)) {
    console.warn('[GradeOS] assignments not array for course', courseId, raw);
    return { assignments: [], submissions: [] };
  }

  let groupWeights: Record<string, number> = {};
  let groupNames: Record<string, string> = {};
  try {
    const groups = await canvasFetch<any>(`/courses/${courseId}/assignment_groups?per_page=100`, connection);
    if (Array.isArray(groups)) {
      groups.forEach((g: any) => {
        if (g.id != null) {
          groupWeights[String(g.id)] = g.group_weight || 0;
          groupNames[String(g.id)] = g.name || '';
        }
      });
    }
  } catch {}

  return {
    assignments: mapAssignments(raw, courseId, groupWeights, groupNames),
    submissions: mapSubmissions(raw, courseId),
  };
}

export async function fetchSubmissions(courseId: string, connection: CanvasConnection): Promise<Submission[]> {
  if (!connection.connected) return getMockSubmissions(courseId);

  try {
    const path = `/courses/${courseId}/assignments?per_page=100&include[]=submission&order_by=due_at`;
    const assignments = await canvasFetch<any>(path, connection);

    // Guard against non-array response
    if (!Array.isArray(assignments)) {
      console.warn('[GradeOS] submissions failed for course', courseId, ':', assignments);
      return [];
    }

    return mapSubmissions(assignments, courseId);
  } catch (error) {
    console.warn('[GradeOS] fetchSubmissions failed for course', courseId, error);
    return [];
  }
}

export async function fetchAnnouncements(courseIds: string[], connection: CanvasConnection): Promise<Announcement[]> {
  if (!connection.connected) return [];

  try {
    const announcements: Announcement[] = [];
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    for (const courseId of courseIds) {
      const items = await canvasFetch<any>(
        `/courses/${courseId}/discussion_topics?only_announcements=true&per_page=20`,
        connection
      );

      // Guard against non-array response
      if (!Array.isArray(items)) {
        console.warn('[GradeOS] announcements not array for course', courseId);
        continue;
      }

      for (const item of items) {
        const postedAt = new Date(item.posted_at);
        if (postedAt >= twoWeeksAgo) {
          announcements.push({
            id: (item.id != null ? String(item.id) : ""),
            courseId,
            title: item.title,
            message: item.message,
            postedAt: item.posted_at,
            author: {
              id: (item.user_id != null ? String(item.user_id) : ""),
              name: item.user?.name || 'Professor',
            },
          });
        }
      }
    }

    return announcements;
  } catch (error) {
    throw error;
  }
}

export async function fetchModuleFiles(courseId: string, connection: CanvasConnection): Promise<File[]> {
  if (!connection.connected) return [];

  try {
    const files = await canvasFetch<any[]>(
      `/courses/${courseId}/files?per_page=100`,
      connection
    );

    return files.map((file) => ({
      id: (file.id != null ? String(file.id) : ""),
      courseId,
      name: file.filename,
      url: file.url,
      size: file.size,
      contentType: file.mime_class,
      createdAt: file.created_at,
      updatedAt: file.updated_at,
    }));
  } catch (error) {
    throw error;
  }
}

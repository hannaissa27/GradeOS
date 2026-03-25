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

    console.log('[GradeOS] raw courses response:', JSON.stringify(courses).slice(0, 500));

    courses.forEach((c: any) => {
      console.log('[GradeOS] course:', c.name, '| enrollment grade:', c.enrollments?.[0]?.computed_current_score, '| term:', c.term?.name, '| term end:', c.term?.end_at, '| workflow:', c.workflow_state);
    });

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
    // Generate unique mock assignments per course
    const mockAssignments: Record<string, Assignment[]> = {
      '1': [
        { id: 'a1-1', courseId: '1', courseName: 'Data Structures', courseCode: 'CS 201', name: 'Binary Search Trees Implementation', description: null, dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), pointsPossible: 100, submissionTypes: ['online_upload'], published: true },
        { id: 'a1-2', courseId: '1', courseName: 'Data Structures', courseCode: 'CS 201', name: 'Graph Algorithms Quiz', description: null, dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), pointsPossible: 50, submissionTypes: ['online_quiz'], published: true },
      ],
      '2': [
        { id: 'a2-1', courseId: '2', courseName: 'Organic Chemistry', courseCode: 'CHEM 301', name: 'Lab Report: Synthesis', description: null, dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), pointsPossible: 75, submissionTypes: ['online_upload'], published: true },
        { id: 'a2-2', courseId: '2', courseName: 'Organic Chemistry', courseCode: 'CHEM 301', name: 'Reaction Mechanisms Exam', description: null, dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), pointsPossible: 150, submissionTypes: ['online_quiz'], published: true },
      ],
      '3': [
        { id: 'a3-1', courseId: '3', courseName: 'Linear Algebra', courseCode: 'MATH 251', name: 'Matrix Operations Homework', description: null, dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), pointsPossible: 40, submissionTypes: ['online_upload'], published: true },
      ],
      '4': [
        { id: 'a4-1', courseId: '4', courseName: 'English Literature', courseCode: 'ENG 150', name: 'Essay: Modern Poetry Analysis', description: null, dueDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(), pointsPossible: 200, submissionTypes: ['online_upload'], published: true },
      ],
    };
    return mockAssignments[courseId] || [];
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
    try {
      const groups = await canvasFetch<any>(`/courses/${courseId}/assignment_groups?per_page=100`, connection);
      if (Array.isArray(groups)) {
        groups.forEach((g: any) => {
          if (g.id != null) groupWeights[String(g.id)] = g.group_weight || 0;
        });
      }
    } catch {}

    const semesterStart = new Date(getSemesterStart());

    return assignments
      .filter((a: any) => a.published && a.id != null)
      .filter((a: any) => {
        if (!a.due_at) return true;
        return new Date(a.due_at) >= semesterStart;
      })
      .map((a: any) => ({
        id: (a.id != null ? String(a.id) : ""),
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
        // Embedded submission data from include[]=submission
        submissionScore: a.submission?.score ?? null,
        submissionState: a.submission?.workflow_state || 'unsubmitted',
        submittedAt: a.submission?.submitted_at || null,
        grade: a.submission?.grade || null,
      }))
      .sort((a, b) => {
        if (!a.dueDate || !b.dueDate) return 0;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  } catch (error) {
    throw error;
  }
}

export async function fetchSubmissions(courseId: string, connection: CanvasConnection): Promise<Submission[]> {
  if (!connection.connected) return [];

  try {
    const path = `/courses/${courseId}/assignments?per_page=100&include[]=submission&order_by=due_at`;
    const assignments = await canvasFetch<any>(path, connection);

    // Guard against non-array response
    if (!Array.isArray(assignments)) {
      console.warn('[GradeOS] submissions failed for course', courseId, ':', assignments);
      return [];
    }

    const semStart = new Date(getSemesterStart());

    return assignments
      .filter((a: any) => a.submission && a.id != null)
      .filter((a: any) => {
        if (!a.due_at) return true;
        return new Date(a.due_at) >= semStart;
      })
      .map((a: any) => ({
        id: (a.submission.id != null ? String(a.submission.id) : "") || (a.id != null ? String(a.id) : ""),
        userId: (a.submission.user_id != null ? String(a.submission.user_id) : "") || '',
        assignmentId: (a.id != null ? String(a.id) : ""),
        courseId,
        score: a.submission.score ?? null,
        grade: a.submission.grade || null,
        submittedAt: a.submission.submitted_at || null,
        gradedAt: a.submission.graded_at || null,
        late: a.submission.late || false,
        // Don't mark as missing if already submitted/graded, or if no online submission needed
        missing: (() => {
          const types: string[] = a.submission_types || [];
          const noOnlineNeeded = types.every((t: string) =>
            t === 'none' || t === 'not_graded' || t === 'on_paper'
          );
          if (noOnlineNeeded) return false;
          // Also don't mark missing if already submitted or graded
          if (a.submission.workflow_state === 'submitted' ||
              a.submission.workflow_state === 'graded' ||
              a.submission.submitted_at) return false;
          return a.submission.missing || false;
        })(),
        excused: a.submission.excused || false,
        workflowState: a.submission.workflow_state || 'unsubmitted',
      }));
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

export interface CanvasConnection {
  canvasUrl: string;
  accessToken: string;
  connected: boolean;
  userName: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  enrollmentState: string;
  currentGrade: number | null;
  finalGrade: number | null;
  teachers: Teacher[];
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
}

export interface Assignment {
  id: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  name: string;
  description: string | null;
  dueDate: string | null;
  pointsPossible: number;
  submissionTypes: string[];
  published: boolean;
  assignmentGroupId?: string | null;
  assignmentGroupWeight?: number;
  // Embedded submission data
  submissionScore?: number | null;
  submissionState?: string;
  submittedAt?: string | null;
  grade?: string | null;
}

export interface Submission {
  id: string;
  userId: string;
  assignmentId: string;
  courseId: string;
  grade: number | null;
  score: number | null;
  submittedAt: string | null;
  gradedAt: string | null;
  late: boolean;
  missing: boolean;
  excused: boolean;
  workflowState?: string;
}

export interface Announcement {
  id: string;
  courseId: string;
  title: string;
  message: string;
  postedAt: string;
  author: {
    id: string;
    name: string;
  };
}

export interface File {
  id: string;
  courseId: string;
  name: string;
  url: string;
  size: number;
  contentType: string;
  createdAt: string;
  updatedAt: string;
}

export interface Todo {
  id: string;
  title: string;
  notes: string;
  dueDate: string | null;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  courseTag: string;
  durationMinutes: number | null;
  sortOrder: number;
  createdAt: string;
}

export interface TimeBlock {
  id: string;
  assignmentId: string;
  courseId: string;
  startTime: string;
  endTime: string;
  createdAt: string;
}

export interface EffortOverride {
  id: string;
  assignmentId: string;
  effortMinutes: number;
  updatedAt: string;
}

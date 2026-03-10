/**
 * SmartGrade API Client
 *
 * Centralized API layer for all backend communication.
 * Organized into domain-specific modules (auth, organizations, classes,
 * exams, submissions, grading) with a backward-compatible `api` export.
 *
 * Features:
 * - JWT token management with automatic refresh
 * - Type-safe request/response handling
 * - Upload progress tracking via XMLHttpRequest
 * - Centralized error handling with ApiError
 */
import type {
  ExamFormData,
  VerifyTemplateResponse,
  ExamResponse,
  ExamListItem,
  ExamTimeInfo,
  AIQuestionRubric,
  DigitizeResponse,
  SubmissionResponse,
  SubmissionListItem,
  VerifiedAnswer,
  AuthTokenResponse,
  TeacherSignupData,
  StudentSignupData,
  LoginData,
  User,
  Organization,
  OrganizationDetail,
  OrganizationUpdate,
  ClassCreate,
  ClassUpdate,
  ClassResponse,
  ClassDetailResponse,
  InviteStudentRequest,
  InvitationResponse,
  EnrollmentResponse,
  EnrollmentStatusUpdate,
  ExamExtensionCreate,
  ExamExtensionResponse,
  GradeAnswerRequest,
  BulkGradeRequest,
  PublishMarksRequest,
  StudentAnswerResponse,
  StudentExamResult,
  SuccessResponse,
  MissedStudentResponse,
  ExamSubmissionSummary,
} from './types';

const API_BASE = '/api';

// ============ Token Storage Keys ============

const ACCESS_TOKEN_KEY = 'smartgrade_access_token';
const REFRESH_TOKEN_KEY = 'smartgrade_refresh_token';
const USER_KEY = 'smartgrade_user';

// ============ Error Handling ============

/**
 * Custom error class for API failures.
 * Carries the HTTP status code alongside the message.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ============ Token Manager ============

/**
 * Manages JWT tokens and user data in localStorage.
 */
export const tokenManager = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  getUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },

  setTokens(accessToken: string, refreshToken: string, user: User): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clearTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  },
};

// ============ Request Helpers ============

/**
 * Build authorization headers. Optionally include Content-Type for JSON.
 */
function getAuthHeaders(includeContentType = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  const token = tokenManager.getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Parse a fetch Response. On 401 attempts a token refresh.
 * Throws ApiError for non-2xx responses.
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      const refreshToken = tokenManager.getRefreshToken();
      if (refreshToken) {
        try {
          await authApi.refresh(refreshToken);
        } catch {
          tokenManager.clearTokens();
        }
      }
    }

    const body = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new ApiError(
      response.status,
      body.message || body.detail || 'Request failed',
    );
  }
  return response.json() as Promise<T>;
}

/**
 * Build a query string from an object, omitting undefined/null values.
 */
function buildQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null,
  );
  if (entries.length === 0) return '';
  return (
    '?' +
    entries
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')
  );
}

// ============ Auth API ============

export const authApi = {
  /** Sign up as a teacher. */
  async signupTeacher(data: TeacherSignupData): Promise<AuthTokenResponse> {
    const res = await fetch(`${API_BASE}/auth/signup/teacher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await handleResponse<AuthTokenResponse>(res);
    tokenManager.setTokens(result.access_token, result.refresh_token, result.user);
    return result;
  },

  /** Sign up as a student. */
  async signupStudent(data: StudentSignupData): Promise<AuthTokenResponse> {
    const res = await fetch(`${API_BASE}/auth/signup/student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await handleResponse<AuthTokenResponse>(res);
    tokenManager.setTokens(result.access_token, result.refresh_token, result.user);
    return result;
  },

  /** Log in with email + password. */
  async login(data: LoginData): Promise<AuthTokenResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await handleResponse<AuthTokenResponse>(res);
    tokenManager.setTokens(result.access_token, result.refresh_token, result.user);
    return result;
  },

  /** Log in with Google OAuth id_token. */
  async googleLogin(
    idToken: string,
    role: 'teacher' | 'student',
  ): Promise<AuthTokenResponse> {
    const res = await fetch(`${API_BASE}/auth/google/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken, role }),
    });
    const result = await handleResponse<AuthTokenResponse>(res);
    tokenManager.setTokens(result.access_token, result.refresh_token, result.user);
    return result;
  },

  /** Refresh an expired access token. */
  async refresh(refreshToken: string): Promise<AuthTokenResponse> {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const result = await handleResponse<AuthTokenResponse>(res);
    const user = tokenManager.getUser();
    if (user) {
      tokenManager.setTokens(result.access_token, result.refresh_token, user);
    }
    return result;
  },

  /** Log out (revoke refresh token on server). */
  async logout(): Promise<void> {
    const refreshToken = tokenManager.getRefreshToken();
    if (refreshToken) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch {
        // Ignore logout network errors
      }
    }
    tokenManager.clearTokens();
  },

  /** Get current authenticated user info. */
  async getCurrentUser(): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<User>(res);
  },
};

// ============ Organizations API ============

export const organizationsApi = {
  /**
   * Get the current teacher's organization.
   * Each teacher has exactly one organization created during signup.
   */
  async getMyOrganization(): Promise<OrganizationDetail> {
    const res = await fetch(`${API_BASE}/organizations/me`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<OrganizationDetail>(res);
  },

  /** Update the current teacher's organization. */
  async updateMyOrganization(data: OrganizationUpdate): Promise<Organization> {
    const res = await fetch(`${API_BASE}/organizations/me`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<Organization>(res);
  },
};

// ============ Classes API ============

export const classesApi = {
  /**
   * Create a new class.
   * The class is automatically assigned to the teacher's organization.
   */
  async create(data: ClassCreate): Promise<ClassResponse> {
    const res = await fetch(`${API_BASE}/classes/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<ClassResponse>(res);
  },

  /** List all classes the teacher is managing. */
  async listTeaching(): Promise<ClassResponse[]> {
    const res = await fetch(`${API_BASE}/classes/teaching`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<ClassResponse[]>(res);
  },

  /** List classes the student is enrolled in. */
  async listEnrolled(): Promise<ClassResponse[]> {
    const res = await fetch(`${API_BASE}/classes/enrolled`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<ClassResponse[]>(res);
  },

  /** Get full class detail (includes student list). */
  async get(classId: string): Promise<ClassDetailResponse> {
    const res = await fetch(`${API_BASE}/classes/${classId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<ClassDetailResponse>(res);
  },

  /** Update class name or description. */
  async update(classId: string, data: ClassUpdate): Promise<ClassResponse> {
    const res = await fetch(`${API_BASE}/classes/${classId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<ClassResponse>(res);
  },

  /** Archive a class (soft delete). */
  async archive(classId: string): Promise<ClassResponse> {
    const res = await fetch(`${API_BASE}/classes/${classId}/archive`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse<ClassResponse>(res);
  },

  /** Delete a class permanently. */
  async delete(classId: string): Promise<SuccessResponse> {
    const res = await fetch(`${API_BASE}/classes/${classId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<SuccessResponse>(res);
  },

  // --- Teacher-side Invitation Management ---

  /** Invite a student to a class by email. */
  async inviteStudent(
    classId: string,
    data: InviteStudentRequest,
  ): Promise<InvitationResponse> {
    const res = await fetch(`${API_BASE}/classes/${classId}/invitations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<InvitationResponse>(res);
  },

  /** List invitations for a class. Optionally filter by status. */
  async listInvitations(
    classId: string,
    status?: string,
  ): Promise<InvitationResponse[]> {
    const qs = buildQuery({ status });
    const res = await fetch(`${API_BASE}/classes/${classId}/invitations${qs}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<InvitationResponse[]>(res);
  },

  /** Cancel a pending invitation. */
  async cancelInvitation(invitationId: string): Promise<SuccessResponse> {
    const res = await fetch(`${API_BASE}/classes/invitations/${invitationId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<SuccessResponse>(res);
  },

  /** Resend a rejected invitation (creates new pending invitation). */
  async resendInvitation(invitationId: string): Promise<InvitationResponse> {
    const res = await fetch(
      `${API_BASE}/classes/invitations/${invitationId}/resend`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
      },
    );
    return handleResponse<InvitationResponse>(res);
  },

  // --- Enrollment Management ---

  /** Update enrollment status (e.g., archive a student). */
  async updateEnrollment(
    enrollmentId: string,
    data: EnrollmentStatusUpdate,
  ): Promise<EnrollmentResponse> {
    const res = await fetch(`${API_BASE}/classes/enrollments/${enrollmentId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<EnrollmentResponse>(res);
  },

  /** Remove a student enrollment entirely. */
  async removeEnrollment(enrollmentId: string): Promise<SuccessResponse> {
    const res = await fetch(`${API_BASE}/classes/enrollments/${enrollmentId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<SuccessResponse>(res);
  },
};

// ============ Student Invitations API ============

export const invitationsApi = {
  /** List invitations for the current student. Optionally filter by status. */
  async list(status?: string): Promise<InvitationResponse[]> {
    const qs = buildQuery({ status });
    const res = await fetch(`${API_BASE}/invitations/${qs}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<InvitationResponse[]>(res);
  },

  /** Accept or reject an invitation. */
  async respond(
    invitationId: string,
    action: 'accept' | 'reject',
  ): Promise<InvitationResponse> {
    const res = await fetch(`${API_BASE}/invitations/${invitationId}/respond`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action }),
    });
    return handleResponse<InvitationResponse>(res);
  },
};

// ============ Exams API ============

export const examsApi = {
  /** Send exam template to AI for rubric generation. */
  async verifyTemplate(data: ExamFormData): Promise<VerifyTemplateResponse> {
    const res = await fetch(`${API_BASE}/verify-template`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        title: data.title,
        subject: data.subject,
        questions: data.questions.map((q) => ({
          question_number: q.question_number,
          text: q.text,
          max_marks: q.max_marks,
          ideal_answer: q.ideal_answer,
          evaluation_rubric: q.evaluation_rubric || undefined,
        })),
      }),
    });
    return handleResponse<VerifyTemplateResponse>(res);
  },

  /** Create and finalize an exam with AI rubrics attached. */
  async finalize(
    data: ExamFormData,
    aiRubrics: AIQuestionRubric[],
  ): Promise<ExamResponse> {
    const res = await fetch(`${API_BASE}/exams/finalize`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        title: data.title,
        subject: data.subject,
        class_id: data.class_id,
        start_time: data.start_time || null,
        end_time: data.end_time || null,
        grace_period_minutes: data.grace_period_minutes ?? 5,
        questions: data.questions.map((q, idx) => ({
          question_number: q.question_number,
          text: q.text,
          max_marks: q.max_marks,
          ideal_answer: q.ideal_answer,
          evaluation_rubric: q.evaluation_rubric || undefined,
          order: idx,
        })),
        ai_rubrics: aiRubrics,
      }),
    });
    return handleResponse<ExamResponse>(res);
  },

  /** List exams created by the current teacher. Optionally filter by class. */
  async listTeaching(classId?: string): Promise<ExamListItem[]> {
    const qs = buildQuery({ class_id: classId });
    const res = await fetch(`${API_BASE}/exams/teaching${qs}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<ExamListItem[]>(res);
  },

  /** List exams available to the current student. Optionally filter by class. */
  async listStudent(classId?: string): Promise<ExamListItem[]> {
    const qs = buildQuery({ class_id: classId });
    const res = await fetch(`${API_BASE}/exams/student${qs}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<ExamListItem[]>(res);
  },

  /** Get exam time info for countdown timer (student view). */
  async getTimeInfo(examId: string): Promise<ExamTimeInfo> {
    const res = await fetch(`${API_BASE}/exams/${examId}/time-info`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<ExamTimeInfo>(res);
  },

  /** List all exams for a specific class. */
  async listByClass(classId: string): Promise<ExamListItem[]> {
    const res = await fetch(`${API_BASE}/exams/class/${classId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<ExamListItem[]>(res);
  },

  /** Get a single exam with full question details. */
  async get(examId: string): Promise<ExamResponse> {
    const res = await fetch(`${API_BASE}/exams/${examId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<ExamResponse>(res);
  },

  /** Update a draft exam (not yet finalized). */
  async update(
    examId: string,
    data: Partial<ExamFormData>,
  ): Promise<ExamResponse> {
    const res = await fetch(`${API_BASE}/exams/${examId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<ExamResponse>(res);
  },

  /** Delete a draft exam. */
  async delete(examId: string): Promise<SuccessResponse> {
    const res = await fetch(`${API_BASE}/exams/${examId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<SuccessResponse>(res);
  },

  // --- Extensions ---

  /** Grant a time extension to a student for a specific exam. */
  async grantExtension(
    examId: string,
    data: ExamExtensionCreate,
  ): Promise<ExamExtensionResponse> {
    const res = await fetch(`${API_BASE}/exams/${examId}/extensions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<ExamExtensionResponse>(res);
  },

  /** List all extensions granted for an exam. */
  async listExtensions(examId: string): Promise<ExamExtensionResponse[]> {
    const res = await fetch(`${API_BASE}/exams/${examId}/extensions`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<ExamExtensionResponse[]>(res);
  },
};

// ============ Submissions API ============

export const submissionsApi = {
  /**
   * Upload and digitize a handwritten submission.
   * Uses XMLHttpRequest for upload progress tracking.
   */
  async digitize(
    examId: string,
    imageFile: File,
    onProgress?: (progress: number) => void,
  ): Promise<DigitizeResponse> {
    const formData = new FormData();
    formData.append('exam_id', examId);
    formData.append('image', imageFile);

    return new Promise<DigitizeResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 50));
        }
      });

      xhr.addEventListener('load', () => {
        if (onProgress) onProgress(100);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as DigitizeResponse);
          } catch {
            reject(new ApiError(xhr.status, 'Invalid response from server'));
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new ApiError(xhr.status, err.detail || err.message || 'Upload failed'));
          } catch {
            reject(new ApiError(xhr.status, 'Upload failed'));
          }
        }
      });

      xhr.addEventListener('error', () =>
        reject(new ApiError(0, 'Network error during upload')),
      );

      xhr.open('POST', `${API_BASE}/digitize-submission`);
      const token = tokenManager.getAccessToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);
    });
  },

  /** Verify extracted answers after teacher/student review. */
  async verify(
    submissionId: string,
    answers: VerifiedAnswer[],
  ): Promise<SubmissionResponse> {
    const res = await fetch(`${API_BASE}/submissions/${submissionId}/verify`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ answers }),
    });
    return handleResponse<SubmissionResponse>(res);
  },

  /** Build the URL for a submission image (original or processed). */
  getImageUrl(
    submissionId: string,
    type: 'original' | 'processed',
  ): string {
    return `${API_BASE}/submissions/${submissionId}/image/${type}`;
  },
};

// ============ Grading API ============

export const gradingApi = {
  /** List all submissions for a specific exam (teacher view). */
  async listExamSubmissions(examId: string): Promise<SubmissionListItem[]> {
    const res = await fetch(`${API_BASE}/grading/exams/${examId}/submissions`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<SubmissionListItem[]>(res);
  },

  /** Get full submission detail with answers (teacher view). */
  async getSubmission(submissionId: string): Promise<SubmissionResponse> {
    const res = await fetch(`${API_BASE}/grading/submissions/${submissionId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<SubmissionResponse>(res);
  },

  /** Grade a single student answer. */
  async gradeAnswer(
    answerId: string,
    data: GradeAnswerRequest,
  ): Promise<StudentAnswerResponse> {
    const res = await fetch(`${API_BASE}/grading/answers/${answerId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<StudentAnswerResponse>(res);
  },

  /** Bulk-grade all answers in a submission. */
  async bulkGrade(
    submissionId: string,
    data: BulkGradeRequest,
  ): Promise<SubmissionResponse> {
    const res = await fetch(
      `${API_BASE}/grading/submissions/${submissionId}/bulk-grade`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      },
    );
    return handleResponse<SubmissionResponse>(res);
  },

  /** Publish (or unpublish) marks for an exam. */
  async publishMarks(
    examId: string,
    data: PublishMarksRequest,
  ): Promise<SuccessResponse> {
    const res = await fetch(`${API_BASE}/grading/exams/${examId}/publish`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<SuccessResponse>(res);
  },

  /** Get all published results for the current student. */
  async getMyResults(): Promise<StudentExamResult[]> {
    const res = await fetch(`${API_BASE}/grading/results`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<StudentExamResult[]>(res);
  },

  /** Get a specific exam result for the current student. */
  async getExamResult(examId: string): Promise<StudentExamResult> {
    const res = await fetch(`${API_BASE}/grading/results/${examId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<StudentExamResult>(res);
  },

  /** Get exam submission summary including missed students. */
  async getExamSummary(examId: string): Promise<ExamSubmissionSummary> {
    const res = await fetch(`${API_BASE}/grading/exams/${examId}/summary`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<ExamSubmissionSummary>(res);
  },

  /** Get list of students who missed an exam (didn't submit). */
  async getMissedStudents(examId: string): Promise<MissedStudentResponse[]> {
    const res = await fetch(`${API_BASE}/grading/exams/${examId}/missed`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<MissedStudentResponse[]>(res);
  },

  /** Mark a specific student as missed (create zero-grade submission). */
  async markStudentMissed(
    examId: string,
    studentId: string,
  ): Promise<SubmissionListItem> {
    const res = await fetch(
      `${API_BASE}/grading/exams/${examId}/missed/${studentId}`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
      },
    );
    return handleResponse<SubmissionListItem>(res);
  },

  /** Mark all missed students with zero grades. */
  async markAllMissed(examId: string): Promise<{ marked_count: number; message: string }> {
    const res = await fetch(
      `${API_BASE}/grading/exams/${examId}/missed/mark-all`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
      },
    );
    return handleResponse<{ marked_count: number; message: string }>(res);
  },
};

// ============ Backward-Compatible API Object ============

/**
 * Legacy `api` export preserving the interface used by existing components
 * (CreateExam, SubmitExam, etc.). Delegates to the new domain-specific modules.
 *
 * New code should import the domain-specific APIs directly:
 *   import { examsApi, submissionsApi, gradingApi } from '@/lib/api';
 */
export const api = {
  /** Verify exam template with AI. */
  async verifyTemplate(data: ExamFormData): Promise<VerifyTemplateResponse> {
    return examsApi.verifyTemplate(data);
  },

  /** Finalize and save exam. */
  async finalizeExam(
    data: ExamFormData,
    aiRubrics: AIQuestionRubric[],
  ): Promise<ExamResponse> {
    return examsApi.finalize(data, aiRubrics);
  },

  /** List exams (teacher view). */
  async getExams(): Promise<ExamListItem[]> {
    return examsApi.listTeaching();
  },

  /** Get single exam by ID. */
  async getExam(id: string): Promise<ExamResponse> {
    return examsApi.get(id);
  },

  /**
   * Upload and digitize a submission.
   * studentName/studentId are no longer sent (backend uses JWT);
   * kept in signature for backward compatibility.
   */
  async digitizeSubmission(
    examId: string,
    imageFile: File,
    _studentName?: string,
    _studentId?: string,
    onProgress?: (progress: number) => void,
  ): Promise<DigitizeResponse> {
    return submissionsApi.digitize(examId, imageFile, onProgress);
  },

  /** Get submission detail. */
  async getSubmission(id: string): Promise<SubmissionResponse> {
    return gradingApi.getSubmission(id);
  },

  /** Get all submissions for an exam. */
  async getExamSubmissions(examId: string): Promise<SubmissionListItem[]> {
    return gradingApi.listExamSubmissions(examId);
  },

  /** Verify submission with corrected answers. */
  async verifySubmission(
    submissionId: string,
    answers: VerifiedAnswer[],
  ): Promise<SubmissionResponse> {
    return submissionsApi.verify(submissionId, answers);
  },

  /** Get image URL for a submission. */
  getSubmissionImageUrl(
    submissionId: string,
    type: 'original' | 'processed',
  ): string {
    return submissionsApi.getImageUrl(submissionId, type);
  },
};

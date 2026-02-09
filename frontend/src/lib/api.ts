import type { 
  ExamFormData, 
  VerifyTemplateResponse, 
  ExamResponse,
  ExamListItem,
  AIQuestionRubric,
  DigitizeResponse,
  SubmissionResponse,
  SubmissionListItem,
  VerifiedAnswer,
  AuthTokenResponse,
  TeacherSignupData,
  StudentSignupData,
  LoginData,
  User
} from './types';

const API_BASE = '/api';

// Token storage keys
const ACCESS_TOKEN_KEY = 'smartgrade_access_token';
const REFRESH_TOKEN_KEY = 'smartgrade_refresh_token';
const USER_KEY = 'smartgrade_user';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Token management
export const tokenManager = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  getUser(): User | null {
    const userData = localStorage.getItem(USER_KEY);
    return userData ? JSON.parse(userData) : null;
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
  }
};

// Get auth headers
function getAuthHeaders(): Record<string, string> {
  const token = tokenManager.getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // Handle 401 - try to refresh token
    if (response.status === 401) {
      const refreshToken = tokenManager.getRefreshToken();
      if (refreshToken) {
        try {
          await authApi.refresh(refreshToken);
          // Retry the original request would require more complex logic
          // For now, just clear tokens and throw
        } catch {
          tokenManager.clearTokens();
        }
      }
    }
    
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new ApiError(response.status, error.message || error.detail || 'Request failed');
  }
  return response.json();
}

// ============ Auth API ============

export const authApi = {
  /**
   * Sign up as a teacher
   */
  async signupTeacher(data: TeacherSignupData): Promise<AuthTokenResponse> {
    const response = await fetch(`${API_BASE}/auth/signup/teacher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await handleResponse<AuthTokenResponse>(response);
    tokenManager.setTokens(result.access_token, result.refresh_token, result.user);
    return result;
  },

  /**
   * Sign up as a student
   */
  async signupStudent(data: StudentSignupData): Promise<AuthTokenResponse> {
    const response = await fetch(`${API_BASE}/auth/signup/student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await handleResponse<AuthTokenResponse>(response);
    tokenManager.setTokens(result.access_token, result.refresh_token, result.user);
    return result;
  },

  /**
   * Login with email and password
   */
  async login(data: LoginData): Promise<AuthTokenResponse> {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await handleResponse<AuthTokenResponse>(response);
    tokenManager.setTokens(result.access_token, result.refresh_token, result.user);
    return result;
  },

  /**
   * Login with Google OAuth token
   */
  async googleLogin(idToken: string, role: 'teacher' | 'student'): Promise<AuthTokenResponse> {
    const response = await fetch(`${API_BASE}/auth/google/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken, role }),
    });
    const result = await handleResponse<AuthTokenResponse>(response);
    tokenManager.setTokens(result.access_token, result.refresh_token, result.user);
    return result;
  },

  /**
   * Refresh access token
   */
  async refresh(refreshToken: string): Promise<AuthTokenResponse> {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const result = await handleResponse<AuthTokenResponse>(response);
    const user = tokenManager.getUser();
    if (user) {
      tokenManager.setTokens(result.access_token, result.refresh_token, user);
    }
    return result;
  },

  /**
   * Logout
   */
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
        // Ignore logout errors
      }
    }
    tokenManager.clearTokens();
  },

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User> {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<User>(response);
  },
};

export const api = {
  /**
   * Verify exam template with AI
   */
  async verifyTemplate(data: ExamFormData): Promise<VerifyTemplateResponse> {
    const response = await fetch(`${API_BASE}/verify-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title,
        subject: data.subject,
        questions: data.questions.map(q => ({
          question_number: q.question_number,
          text: q.text,
          max_marks: q.max_marks,
          ideal_answer: q.ideal_answer,
        })),
      }),
    });
    return handleResponse<VerifyTemplateResponse>(response);
  },

  /**
   * Finalize and save exam
   */
  async finalizeExam(
    data: ExamFormData, 
    aiRubrics: AIQuestionRubric[]
  ): Promise<ExamResponse> {
    const response = await fetch(`${API_BASE}/exams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title,
        subject: data.subject,
        questions: data.questions.map(q => ({
          question_number: q.question_number,
          text: q.text,
          max_marks: q.max_marks,
          ideal_answer: q.ideal_answer,
        })),
        ai_rubrics: aiRubrics,
      }),
    });
    return handleResponse<ExamResponse>(response);
  },

  /**
   * Get all exams (list view)
   */
  async getExams(): Promise<ExamListItem[]> {
    const response = await fetch(`${API_BASE}/exams`);
    return handleResponse<ExamListItem[]>(response);
  },

  /**
   * Get single exam by ID
   */
  async getExam(id: string): Promise<ExamResponse> {
    const response = await fetch(`${API_BASE}/exams/${id}`);
    return handleResponse<ExamResponse>(response);
  },

  /**
   * Upload and digitize a submission
   */
  async digitizeSubmission(
    examId: string,
    imageFile: File,
    studentName?: string,
    studentId?: string,
    onProgress?: (progress: number) => void
  ): Promise<DigitizeResponse> {
    const formData = new FormData();
    formData.append('exam_id', examId);
    formData.append('image', imageFile);
    if (studentName) formData.append('student_name', studentName);
    if (studentId) formData.append('student_id', studentId);

    // Use XMLHttpRequest for progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = Math.round((e.loaded / e.total) * 50); // Upload is 50%
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (onProgress) onProgress(100);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.detail || 'Upload failed'));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error'));
      });

      xhr.open('POST', `${API_BASE}/digitize-submission`);
      xhr.send(formData);
    });
  },

  /**
   * Get submission by ID
   */
  async getSubmission(id: string): Promise<SubmissionResponse> {
    const response = await fetch(`${API_BASE}/submissions/${id}`);
    return handleResponse<SubmissionResponse>(response);
  },

  /**
   * Get all submissions for an exam
   */
  async getExamSubmissions(examId: string): Promise<SubmissionListItem[]> {
    const response = await fetch(`${API_BASE}/exams/${examId}/submissions`);
    return handleResponse<SubmissionListItem[]>(response);
  },

  /**
   * Verify submission with corrected answers
   */
  async verifySubmission(
    submissionId: string,
    answers: VerifiedAnswer[]
  ): Promise<SubmissionResponse> {
    const response = await fetch(`${API_BASE}/submissions/${submissionId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    return handleResponse<SubmissionResponse>(response);
  },

  /**
   * Get image URL for submission
   */
  getSubmissionImageUrl(submissionId: string, type: 'original' | 'processed'): string {
    return `${API_BASE}/submissions/${submissionId}/image/${type}`;
  },
};

// ============ Auth Types ============

export type UserRole = 'teacher' | 'student' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  organization_name?: string;
  role: UserRole;
  is_verified: boolean;
  auth_provider: 'local' | 'google';
  created_at: string;
}

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface TeacherSignupData {
  name: string;
  email: string;
  organization_name: string;
  password: string;
  confirm_password: string;
}

export interface StudentSignupData {
  name: string;
  email: string;
  password: string;
  confirm_password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

// ============ Question types ============

// Question types
export interface Question {
  id: string;
  question_number: number;
  text: string;
  max_marks: number;
  ideal_answer: string;
}

export interface QuestionFormData {
  id: string;
  question_number: number;
  text: string;
  max_marks: number;
  ideal_answer: string;
}

// AI Rubric types
export interface AIQuestionRubric {
  question_number: number;
  key_concepts: string[];
  grading_criteria: string;
  marks: number;
}

export interface VerifyTemplateResponse {
  questions: AIQuestionRubric[];
  total_marks: number;
  suggestions: string[];
  raw_interpretation?: string;
}

// Exam types
export interface ExamFormData {
  title: string;
  subject: string;
  questions: QuestionFormData[];
}

export interface ExamResponse {
  id: string;
  title: string;
  subject: string;
  total_marks: number;
  is_finalized: boolean;
  created_at: string;
  updated_at: string;
  questions: Question[];
}

export interface ExamListItem {
  id: string;
  title: string;
  subject: string;
  total_marks: number;
  is_finalized: boolean;
  created_at: string;
  question_count: number;
}

// Form validation
export interface ValidationError {
  field: string;
  message: string;
}

// Submission types
export interface ExtractedAnswer {
  question_number: number;
  extracted_text: string;
  confidence: number;
}

export interface DigitizeResponse {
  submission_id: string;
  answers: ExtractedAnswer[];
  original_image_url: string;
  processed_image_url?: string;
}

export interface StudentAnswer {
  id: string;
  question_id: string;
  question_number: number;
  extracted_text: string;
  verified_text?: string;
  confidence: number;
  marks_awarded?: number;
}

export interface SubmissionResponse {
  id: string;
  exam_id: string;
  student_name?: string;
  student_id?: string;
  status: string;
  is_verified: boolean;
  original_image_url: string;
  created_at: string;
  answers: StudentAnswer[];
}

export interface SubmissionListItem {
  id: string;
  exam_id: string;
  exam_title: string;
  student_name?: string;
  status: string;
  is_verified: boolean;
  created_at: string;
  answer_count: number;
}

export interface VerifiedAnswer {
  question_number: number;
  verified_text: string;
}

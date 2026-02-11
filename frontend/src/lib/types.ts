/**
 * SmartGrade Frontend Type Definitions
 *
 * All TypeScript interfaces for API requests/responses and data structures.
 * Organized by domain: Auth, Organization, Class, Invitation, Enrollment,
 * Exam, Submission, Grading, and common utility types.
 */

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

// ============ Organization Types ============

export interface OrganizationCreate {
  name: string;
  description?: string;
}

export interface OrganizationUpdate {
  name?: string;
  description?: string;
}

export interface Organization {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationDetail extends Organization {
  member_count: number;
  class_count: number;
  owner_name: string | null;
}

export interface OrganizationMember {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  role: string;
  created_at: string;
}

export interface AddMemberRequest {
  email: string;
  role?: 'teacher' | 'owner';
}

// ============ Class Types ============

export interface ClassCreate {
  name: string;
  description?: string;
  organization_id: string;
}

export interface ClassUpdate {
  name?: string;
  description?: string;
}

export interface ClassResponse {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  organization_name: string | null;
  teacher_id: string;
  teacher_name: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  student_count: number;
  exam_count: number;
}

export interface ClassDetailResponse extends ClassResponse {
  students: EnrollmentResponse[];
  pending_invitations: number;
}

// ============ Invitation Types ============

export interface InviteStudentRequest {
  email: string;
}

export interface InvitationResponse {
  id: string;
  class_id: string;
  class_name: string | null;
  organization_name: string | null;
  student_id: string;
  student_name: string | null;
  student_email: string | null;
  invited_by: string;
  invited_by_name: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  responded_at: string | null;
}

export interface InvitationActionRequest {
  action: 'accept' | 'reject';
}

// ============ Enrollment Types ============

export interface EnrollmentResponse {
  id: string;
  class_id: string;
  student_id: string;
  student_name: string | null;
  student_email: string | null;
  status: 'active' | 'archived';
  enrolled_at: string;
  archived_at: string | null;
}

export interface EnrollmentStatusUpdate {
  status: 'active' | 'archived';
}

// ============ Question Types ============

/**
 * Form-level question data used in the exam creation form.
 * `question_number` is kept as `number` for auto-incrementing form logic.
 * Converted to string when sent to the API.
 */
export interface QuestionFormData {
  id: string;
  question_number: number;
  text: string;
  max_marks: number;
  ideal_answer: string;
  evaluation_rubric?: string;
}

/**
 * Question data returned from the API.
 * `question_number` is a string to support flexible formats (1, 1a, I, etc.).
 */
export interface QuestionResponse {
  id: string;
  question_number: string;
  text: string;
  max_marks: number;
  ideal_answer: string;
  evaluation_rubric: string | null;
  ai_rubric: string | null;
  order: number;
}

// ============ AI Rubric Types ============

export interface AIQuestionRubric {
  question_number: string;
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

// ============ Exam Types ============

/**
 * Exam form data for creation. New optional fields support
 * class assignment and time windows while keeping backward
 * compatibility with the existing ExamForm component.
 */
export interface ExamFormData {
  title: string;
  subject: string;
  class_id?: string;
  start_time?: string;
  end_time?: string;
  grace_period_minutes?: number;
  questions: QuestionFormData[];
}

export interface ExamResponse {
  id: string;
  title: string;
  subject: string;
  class_id: string;
  class_name: string | null;
  total_marks: number;
  is_finalized: boolean;
  status: string;
  start_time: string | null;
  end_time: string | null;
  grace_period_minutes: number;
  is_published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  questions: QuestionResponse[];
}

export interface ExamListItem {
  id: string;
  title: string;
  subject: string;
  class_id: string;
  class_name: string | null;
  total_marks: number;
  is_finalized: boolean;
  status: string;
  start_time: string | null;
  end_time: string | null;
  is_published: boolean;
  created_at: string;
  question_count: number;
  submission_count: number;
}

// ============ Exam Extension Types ============

export interface ExamExtensionCreate {
  student_id: string;
  extended_end_time: string;
  reason?: string;
}

export interface ExamExtensionResponse {
  id: string;
  exam_id: string;
  student_id: string;
  student_name: string | null;
  extended_end_time: string;
  reason: string | null;
  granted_by: string;
  created_at: string;
}

// ============ Submission Types ============

export interface ExtractedAnswer {
  question_number: string;
  extracted_text: string;
  confidence: number;
}

export interface DigitizeResponse {
  submission_id: string;
  answers: ExtractedAnswer[];
  original_image_url: string;
  processed_image_url?: string;
}

export interface VerifiedAnswer {
  question_number: string;
  verified_text: string;
}

export interface StudentAnswerResponse {
  id: string;
  question_id: string;
  question_number: string;
  extracted_text: string;
  verified_text: string | null;
  confidence: number;

  // AI grading
  ai_marks: number | null;
  ai_feedback: string | null;
  ai_flagged_for_review: boolean;

  // Teacher grading
  teacher_marks: number | null;
  teacher_feedback: string | null;

  // Final result
  final_marks: number | null;
  is_published: boolean;
}

export interface SubmissionResponse {
  id: string;
  exam_id: string;
  student_id: string;
  student_name: string | null;
  status: string;
  is_verified: boolean;
  file_paths: string[] | null;
  original_image_url: string | null;
  digital_receipt_hash: string | null;
  submitted_at: string;
  created_at: string;
  answers: StudentAnswerResponse[];
}

export interface SubmissionListItem {
  id: string;
  exam_id: string;
  exam_title: string | null;
  student_id: string;
  student_name: string | null;
  status: string;
  is_verified: boolean;
  submitted_at: string;
  created_at: string;
  answer_count: number;
}

// ============ Grading Types ============

export interface GradeAnswerRequest {
  teacher_marks: number;
  teacher_feedback?: string;
}

export interface BulkGradeItem {
  answer_id: string;
  teacher_marks: number;
  teacher_feedback?: string;
}

export interface BulkGradeRequest {
  grades: BulkGradeItem[];
}

export interface PublishMarksRequest {
  submission_ids?: string[];
  publish?: boolean;
}

// ============ Student Result Types ============

export interface StudentExamResult {
  exam_id: string;
  exam_title: string;
  subject: string;
  total_marks: number;
  obtained_marks: number;
  percentage: number;
  is_published: boolean;
  answers: StudentAnswerResponse[];
}

// ============ Common Types ============

export interface SuccessResponse {
  success: boolean;
  message: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

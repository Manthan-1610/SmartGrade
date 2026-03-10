/**
 * GradingInterface
 *
 * The core teacher grading page. Shows all submissions for a specific exam
 * and allows teachers to review AI grades, override marks, add feedback,
 * and publish results.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DashboardLayout,
  DashboardLoader,
  EmptyState,
} from '@/components/layout/DashboardLayout';
import { Button, Badge, Alert } from '@/components/ui';
import { examsApi, gradingApi } from '@/lib/api';
import type {
  ExamResponse,
  SubmissionListItem,
  SubmissionResponse,
  StudentAnswerResponse,
  GradeAnswerRequest,
  MissedStudentResponse,
  ExamSubmissionSummary,
} from '@/lib/types';
import {
  ArrowLeft,
  ChevronDown,
  CheckCircle,
  AlertTriangle,
  Send,
  Eye,
  Edit3,
  Save,
  X,
  BarChart3,
  Users,
  MessageSquare,
  UserX,
  Ban,
  Mail,
} from 'lucide-react';

/* ---------- Types ---------- */

interface EditingAnswer {
  answerId: string;
  marks: number;
  feedback: string;
}

/* ---------- Component ---------- */

export default function GradingInterface() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  // Main state
  const [exam, setExam] = useState<ExamResponse | null>(null);
  const [summary, setSummary] = useState<ExamSubmissionSummary | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [missedStudents, setMissedStudents] = useState<MissedStudentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Submission detail state
  const [activeSubmission, setActiveSubmission] = useState<SubmissionResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Editing state
  const [editingAnswer, setEditingAnswer] = useState<EditingAnswer | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Publishing state
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);

  // Missed students state
  const [isMarkingMissed, setIsMarkingMissed] = useState(false);
  const [activeTab, setActiveTab] = useState<'submissions' | 'missed'>('submissions');

  /* ---------- Data Loading ---------- */

  const loadData = useCallback(async () => {
    if (!examId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [examData, summaryData] = await Promise.all([
        examsApi.get(examId),
        gradingApi.getExamSummary(examId),
      ]);
      setExam(examData);
      setSummary(summaryData);
      setSubmissions(summaryData.submissions);
      setMissedStudents(summaryData.missed_students);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exam data');
    } finally {
      setIsLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadSubmissionDetail = useCallback(async (submissionId: string) => {
    setIsLoadingDetail(true);
    setEditingAnswer(null);
    try {
      const detail = await gradingApi.getSubmission(submissionId);
      setActiveSubmission(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submission');
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  /* ---------- Grading Actions ---------- */

  const handleSaveGrade = useCallback(
    async (answerId: string, data: GradeAnswerRequest) => {
      setIsSaving(true);
      try {
        const updated = await gradingApi.gradeAnswer(answerId, data);
        // Update the answer in the active submission
        setActiveSubmission((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            answers: prev.answers.map((a) => (a.id === answerId ? updated : a)),
          };
        });
        setEditingAnswer(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save grade');
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  const handlePublish = useCallback(
    async (submissionIds?: string[]) => {
      if (!examId) return;
      setIsPublishing(true);
      setPublishSuccess(null);
      try {
        const result = await gradingApi.publishMarks(examId, {
          submission_ids: submissionIds,
          publish: true,
        });
        setPublishSuccess(result.message || 'Marks published successfully!');
        loadData(); // Refresh
        if (activeSubmission) {
          loadSubmissionDetail(activeSubmission.id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to publish marks');
      } finally {
        setIsPublishing(false);
      }
    },
    [examId, loadData, activeSubmission, loadSubmissionDetail],
  );

  const handleMarkStudentMissed = useCallback(
    async (studentId: string) => {
      if (!examId) return;
      setIsMarkingMissed(true);
      try {
        await gradingApi.markStudentMissed(examId, studentId);
        setPublishSuccess('Student marked as missed with zero grades.');
        loadData(); // Refresh to move them to submissions list
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to mark student as missed');
      } finally {
        setIsMarkingMissed(false);
      }
    },
    [examId, loadData],
  );

  const handleMarkAllMissed = useCallback(async () => {
    if (!examId) return;
    setIsMarkingMissed(true);
    try {
      const result = await gradingApi.markAllMissed(examId);
      setPublishSuccess(result.message);
      loadData(); // Refresh
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark all students as missed');
    } finally {
      setIsMarkingMissed(false);
    }
  }, [examId, loadData]);

  /* ---------- Computed ---------- */

  const questionMap = useMemo(() => {
    if (!exam) return new Map<string, { text: string; max_marks: number; question_number: string }>();
    const map = new Map<string, { text: string; max_marks: number; question_number: string }>();
    exam.questions.forEach((q) => map.set(q.id, { text: q.text, max_marks: q.max_marks, question_number: q.question_number }));
    return map;
  }, [exam]);

  /* ---------- Render ---------- */

  if (isLoading) {
    return (
      <DashboardLayout title="Grading">
        <DashboardLoader />
      </DashboardLayout>
    );
  }

  if (!exam) {
    return (
      <DashboardLayout title="Grading">
        <Alert variant="error">Exam not found.</Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={`Grade: ${exam.title}`}
      subtitle={`${exam.subject} · ${exam.questions.length} questions · ${exam.total_marks} marks`}
      headerAction={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => navigate('/grading')}
          >
            Back
          </Button>
          {submissions.length > 0 && (
            <Button
              size="sm"
              leftIcon={<Send className="w-4 h-4" />}
              onClick={() => handlePublish()}
              isLoading={isPublishing}
            >
              Publish All
            </Button>
          )}
        </div>
      }
    >
      {error && (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {publishSuccess && (
        <Alert variant="success" className="mb-6" onDismiss={() => setPublishSuccess(null)}>
          {publishSuccess}
        </Alert>
      )}

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-bg-card border border-border rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-text-primary">{summary.total_enrolled}</p>
            <p className="text-xs text-text-muted">Enrolled</p>
          </div>
          <div className="bg-bg-card border border-border rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-success">{summary.submitted_count}</p>
            <p className="text-xs text-text-muted">Submitted</p>
          </div>
          <div className="bg-bg-card border border-border rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-danger">{summary.missed_count}</p>
            <p className="text-xs text-text-muted">Missed</p>
          </div>
          <div className="bg-bg-card border border-border rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-primary">{summary.published_count}</p>
            <p className="text-xs text-text-muted">Published</p>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Panel: Submissions/Missed Tabs */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="bg-bg-card border border-border rounded-xl">
            {/* Tab Headers */}
            <div className="flex border-b border-border">
              <button
                onClick={() => setActiveTab('submissions')}
                className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeTab === 'submissions'
                    ? 'text-primary border-b-2 border-primary bg-primary/5'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Users className="w-4 h-4" />
                Submitted ({submissions.length})
              </button>
              <button
                onClick={() => setActiveTab('missed')}
                className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeTab === 'missed'
                    ? 'text-danger border-b-2 border-danger bg-danger/5'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <UserX className="w-4 h-4" />
                Missed ({missedStudents.length})
              </button>
            </div>

            {/* Submissions Tab */}
            {activeTab === 'submissions' && (
              <>
                {submissions.length === 0 ? (
                  <div className="p-6 text-center text-text-muted text-sm">
                    No submissions yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-border max-h-[calc(100vh-360px)] overflow-y-auto">
                    {submissions.map((sub) => (
                      <li key={sub.id}>
                        <button
                          onClick={() => loadSubmissionDetail(sub.id)}
                          className={`w-full text-left p-4 hover:bg-bg-hover transition-colors ${
                            activeSubmission?.id === sub.id
                              ? 'bg-primary/5 border-l-2 border-l-primary'
                              : ''
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-text-primary text-sm truncate">
                              {sub.student_name || 'Unknown Student'}
                            </p>
                            <Badge
                              variant={
                                sub.is_missed
                                  ? 'danger'
                                  : sub.status === 'graded'
                                    ? 'success'
                                    : sub.is_verified
                                      ? 'primary'
                                      : 'warning'
                              }
                              size="sm"
                            >
                              {sub.is_missed ? 'Absent' : sub.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-text-muted">
                            {sub.is_missed ? (
                              <span className="text-danger">No submission · 0 marks</span>
                            ) : (
                              <>
                                <span>{sub.answer_count} answers</span>
                                <span>·</span>
                                <span>{new Date(sub.submitted_at).toLocaleString()}</span>
                              </>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {/* Missed Students Tab */}
            {activeTab === 'missed' && (
              <>
                {missedStudents.length === 0 ? (
                  <div className="p-6 text-center text-text-muted text-sm">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success" />
                    <p>All enrolled students have submitted!</p>
                  </div>
                ) : (
                  <div>
                    {/* Bulk Action */}
                    <div className="p-3 border-b border-border bg-danger/5">
                      <Button
                        variant="danger"
                        size="sm"
                        className="w-full"
                        leftIcon={<Ban className="w-4 h-4" />}
                        onClick={handleMarkAllMissed}
                        isLoading={isMarkingMissed}
                      >
                        Mark All as Zero ({missedStudents.length})
                      </Button>
                    </div>
                    <ul className="divide-y divide-border max-h-[calc(100vh-420px)] overflow-y-auto">
                      {missedStudents.map((student) => (
                        <li key={student.student_id} className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="min-w-0">
                              <p className="font-medium text-text-primary text-sm truncate">
                                {student.student_name}
                              </p>
                              <p className="text-xs text-text-muted flex items-center gap-1 truncate">
                                <Mail className="w-3 h-3 flex-shrink-0" />
                                {student.student_email}
                              </p>
                            </div>
                            <Badge variant="danger" size="sm">
                              <UserX className="w-3 h-3 mr-1" />
                              Missed
                            </Badge>
                          </div>
                          {student.had_extension && student.extended_deadline && (
                            <p className="text-xs text-warning mb-2">
                              Had extension until {new Date(student.extended_deadline).toLocaleString()}
                            </p>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full"
                            leftIcon={<Ban className="w-3.5 h-3.5" />}
                            onClick={() => handleMarkStudentMissed(student.student_id)}
                            disabled={isMarkingMissed}
                          >
                            Mark as Zero
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Panel: Submission Detail */}
        <div className="flex-1 min-w-0">
          {!activeSubmission && !isLoadingDetail ? (
            <EmptyState
              icon={<Eye className="w-8 h-8 text-text-muted" />}
              title="Select a Submission"
              description="Click on a student submission from the left panel to start grading."
            />
          ) : isLoadingDetail ? (
            <DashboardLoader />
          ) : activeSubmission ? (
            <SubmissionDetail
              submission={activeSubmission}
              questionMap={questionMap}
              editingAnswer={editingAnswer}
              setEditingAnswer={setEditingAnswer}
              onSaveGrade={handleSaveGrade}
              onPublish={() => handlePublish([activeSubmission.id])}
              isSaving={isSaving}
              isPublishing={isPublishing}
            />
          ) : null}
        </div>
      </div>
    </DashboardLayout>
  );
}

/* ============================================================
   Sub-Components
   ============================================================ */

interface SubmissionDetailProps {
  submission: SubmissionResponse;
  questionMap: Map<string, { text: string; max_marks: number; question_number: string }>;
  editingAnswer: EditingAnswer | null;
  setEditingAnswer: (e: EditingAnswer | null) => void;
  onSaveGrade: (answerId: string, data: GradeAnswerRequest) => Promise<void>;
  onPublish: () => void;
  isSaving: boolean;
  isPublishing: boolean;
}

function SubmissionDetail({
  submission,
  questionMap,
  editingAnswer,
  setEditingAnswer,
  onSaveGrade,
  onPublish,
  isSaving,
  isPublishing,
}: SubmissionDetailProps) {
  const totalObtained = submission.answers.reduce(
    (sum, a) => sum + (a.final_marks ?? a.teacher_marks ?? a.ai_marks ?? 0),
    0,
  );
  const totalMax = submission.answers.reduce(
    (sum, a) => sum + (questionMap.get(a.question_id)?.max_marks ?? 0),
    0,
  );
  const flaggedCount = submission.answers.filter((a) => a.ai_flagged_for_review).length;
  const allGraded = submission.answers.every(
    (a) => a.teacher_marks !== null || a.ai_marks !== null,
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Submission Header */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-text-primary text-lg">
              {submission.student_name || 'Unknown Student'}
            </h3>
            <p className="text-sm text-text-muted">
              Submitted {new Date(submission.submitted_at).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">
                {totalObtained}
                <span className="text-base text-text-muted font-normal">/{totalMax}</span>
              </p>
              <p className="text-xs text-text-muted">
                {totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(0) : 0}%
              </p>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center gap-4 text-sm">
          <Badge variant={submission.is_verified ? 'success' : 'warning'} size="sm">
            {submission.is_verified ? 'Verified' : 'Unverified'}
          </Badge>
          {flaggedCount > 0 && (
            <span className="flex items-center gap-1 text-warning text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              {flaggedCount} flagged for review
            </span>
          )}
          {allGraded && (
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Send className="w-3.5 h-3.5" />}
              onClick={onPublish}
              isLoading={isPublishing}
            >
              Publish This Student
            </Button>
          )}
        </div>
      </div>

      {/* Answers */}
      <div className="space-y-4">
        {submission.answers
          .sort(
            (a, b) =>
              (parseInt(a.question_number) || 0) - (parseInt(b.question_number) || 0),
          )
          .map((answer) => (
            <AnswerCard
              key={answer.id}
              answer={answer}
              question={questionMap.get(answer.question_id)}
              isEditing={editingAnswer?.answerId === answer.id}
              editData={editingAnswer?.answerId === answer.id ? editingAnswer : null}
              onStartEdit={() =>
                setEditingAnswer({
                  answerId: answer.id,
                  marks: answer.teacher_marks ?? answer.ai_marks ?? 0,
                  feedback: answer.teacher_feedback ?? '',
                })
              }
              onCancelEdit={() => setEditingAnswer(null)}
              onSave={() => {
                if (!editingAnswer) return;
                onSaveGrade(editingAnswer.answerId, {
                  teacher_marks: editingAnswer.marks,
                  teacher_feedback: editingAnswer.feedback || undefined,
                });
              }}
              onEditChange={(field, value) =>
                setEditingAnswer(
                  editingAnswer ? { ...editingAnswer, [field]: value } : null,
                )
              }
              isSaving={isSaving}
            />
          ))}
      </div>
    </div>
  );
}

/* ---------- Answer Card ---------- */

interface AnswerCardProps {
  answer: StudentAnswerResponse;
  question?: { text: string; max_marks: number; question_number: string };
  isEditing: boolean;
  editData: EditingAnswer | null;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onEditChange: (field: 'marks' | 'feedback', value: string | number) => void;
  isSaving: boolean;
}

function AnswerCard({
  answer,
  question,
  isEditing,
  editData,
  onStartEdit,
  onCancelEdit,
  onSave,
  onEditChange,
  isSaving,
}: AnswerCardProps) {
  const [expanded, setExpanded] = useState(answer.ai_flagged_for_review);
  const maxMarks = question?.max_marks ?? 0;
  const currentMarks = answer.final_marks ?? answer.teacher_marks ?? answer.ai_marks;
  const hasTeacherGrade = answer.teacher_marks !== null;

  return (
    <div
      className={`bg-bg-card border rounded-xl overflow-hidden transition-all ${
        answer.ai_flagged_for_review
          ? 'border-warning/50 shadow-warning/5 shadow-md'
          : 'border-border'
      }`}
    >
      {/* Card Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-bg-hover/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">
              Q{answer.question_number}
            </span>
            {answer.ai_flagged_for_review && (
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
            )}
            {hasTeacherGrade && (
              <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-text-secondary truncate">
            {question?.text ?? 'Question text unavailable'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          <span className="text-sm font-medium text-text-primary">
            {currentMarks ?? '—'}
            <span className="text-text-muted">/{maxMarks}</span>
          </span>
          {answer.confidence < 0.7 && (
            <Badge variant="danger" size="sm">
              {(answer.confidence * 100).toFixed(0)}% conf
            </Badge>
          )}
          <ChevronDown
            className={`w-4 h-4 text-text-muted transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-4 space-y-4 animate-fade-in">
          {/* Student's Answer */}
          <div>
            <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">
              Student's Answer
            </h4>
            <div className="bg-bg-primary rounded-lg p-3 text-sm text-text-primary whitespace-pre-wrap">
              {answer.verified_text || answer.extracted_text || 'No answer text available'}
            </div>
            {answer.confidence < 0.7 && (
              <p className="text-xs text-warning mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Low OCR confidence ({(answer.confidence * 100).toFixed(0)}%) — please
                verify the text above
              </p>
            )}
          </div>

          {/* AI Grading Section */}
          {answer.ai_marks !== null && (
            <div className="bg-primary/5 rounded-lg p-3">
              <h4 className="text-xs font-medium text-primary uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5" />
                AI Assessment
              </h4>
              <div className="flex items-center gap-4 text-sm">
                <span className="font-semibold text-primary">
                  {answer.ai_marks}/{maxMarks} marks
                </span>
                {answer.ai_feedback && (
                  <span className="text-text-secondary">{answer.ai_feedback}</span>
                )}
              </div>
            </div>
          )}

          {/* Teacher Grading Section */}
          {isEditing && editData ? (
            <div className="bg-bg-hover rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-1">
                <Edit3 className="w-3.5 h-3.5" />
                Your Grade
              </h4>
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-secondary whitespace-nowrap">
                  Marks:
                </label>
                <input
                  type="number"
                  min={0}
                  max={maxMarks}
                  step={0.5}
                  value={editData.marks}
                  onChange={(e) => onEditChange('marks', parseFloat(e.target.value) || 0)}
                  className="w-24 rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-text-muted">/ {maxMarks}</span>
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-1 block">
                  Feedback (optional):
                </label>
                <textarea
                  value={editData.feedback}
                  onChange={(e) => onEditChange('feedback', e.target.value)}
                  rows={2}
                  placeholder="Add feedback for the student..."
                  className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<X className="w-3.5 h-3.5" />}
                  onClick={onCancelEdit}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  leftIcon={<Save className="w-3.5 h-3.5" />}
                  onClick={onSave}
                  isLoading={isSaving}
                >
                  Save Grade
                </Button>
              </div>
            </div>
          ) : hasTeacherGrade ? (
            <div className="bg-success/5 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-medium text-success uppercase tracking-wider mb-1 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Teacher Grade
                  </h4>
                  <p className="text-sm font-semibold text-text-primary">
                    {answer.teacher_marks}/{maxMarks} marks
                  </p>
                  {answer.teacher_feedback && (
                    <p className="text-sm text-text-secondary mt-1 flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                      {answer.teacher_feedback}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                  onClick={onStartEdit}
                >
                  Edit
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Edit3 className="w-4 h-4" />}
              onClick={onStartEdit}
            >
              {answer.ai_marks !== null ? 'Override AI Grade' : 'Add Grade'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

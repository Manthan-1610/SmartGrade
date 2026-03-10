/**
 * Class Detail Page
 *
 * Shows enrolled students, pending invitations, and exams for a class.
 * Teachers can invite students, manage enrollments, and navigate to exams.
 */
import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DashboardLayout,
  DashboardLoader,
  EmptyState,
} from '@/components/layout/DashboardLayout';
import { Button, Input, Alert, Badge } from '@/components/ui';
import { classesApi, examsApi } from '@/lib/api';
import type {
  ClassDetailResponse,
  EnrollmentResponse,
  ExamListItem,
  InvitationResponse,
} from '@/lib/types';
import {
  Plus,
  Users,
  Mail,
  FileText,
  UserPlus,
  X,
  Check,
  Clock,
  Archive,
  RotateCcw,
  Trash2,
  Pencil,
  Timer,
  Ban,
  CheckCircle,
} from 'lucide-react';

/* ---- Exam status helpers ---- */

function getExamStatus(exam: ExamListItem): 'not_started' | 'open' | 'ended' {
  const now = Date.now();
  if (exam.start_time && new Date(exam.start_time).getTime() > now) return 'not_started';
  if (exam.end_time && new Date(exam.end_time).getTime() < now) return 'ended';
  return 'open';
}

function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const absDiff = Math.abs(diff);
  const mins = Math.round(absDiff / 60_000);
  if (mins < 60) return `${mins}m ${diff > 0 ? 'from now' : 'ago'}`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ${diff > 0 ? 'from now' : 'ago'}`;
  const days = Math.round(hrs / 24);
  return `${days}d ${diff > 0 ? 'from now' : 'ago'}`;
}

export default function ClassDetail() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();

  const [classData, setClassData] = useState<ClassDetailResponse | null>(null);
  const [invitations, setInvitations] = useState<InvitationResponse[]>([]);
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'students' | 'invitations' | 'exams'>('students');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [examToDelete, setExamToDelete] = useState<ExamListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadClassData = useCallback(async () => {
    if (!classId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [detail, invites, classExams] = await Promise.all([
        classesApi.get(classId),
        classesApi.listInvitations(classId),
        examsApi.listTeaching(classId),
      ]);
      setClassData(detail);
      setInvitations(invites);
      setExams(classExams);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load class');
    } finally {
      setIsLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadClassData();
  }, [loadClassData]);

  const handleArchiveToggle = async (enrollment: EnrollmentResponse) => {
    try {
      const newStatus = enrollment.status === 'active' ? 'archived' : 'active';
      await classesApi.updateEnrollment(enrollment.id, { status: newStatus as 'active' | 'archived' });
      loadClassData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update enrollment');
    }
  };

  const handleRemoveEnrollment = async (enrollmentId: string) => {
    if (!confirm('Remove this student from the class?')) return;
    try {
      await classesApi.removeEnrollment(enrollmentId);
      loadClassData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove student');
    }
  };

  const handleDeleteExam = async () => {
    if (!examToDelete) return;
    setIsDeleting(true);
    try {
      await examsApi.delete(examToDelete.id);
      setExamToDelete(null);
      loadClassData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete exam');
      setExamToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const pendingInvitations = invitations.filter((i) => i.status === 'pending');
  const activeStudents = classData?.students.filter((s) => s.status === 'active') ?? [];
  const archivedStudents = classData?.students.filter((s) => s.status === 'archived') ?? [];

  const tabs = [
    { key: 'students' as const, label: 'Students', count: classData?.students.length ?? 0 },
    { key: 'invitations' as const, label: 'Invitations', count: pendingInvitations.length },
    { key: 'exams' as const, label: 'Exams', count: exams.length },
  ];

  return (
    <DashboardLayout
      title={classData?.name ?? 'Class Detail'}
      subtitle={classData?.organization_name ?? undefined}
      headerAction={
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<UserPlus className="w-4 h-4" />}
            onClick={() => setShowInviteModal(true)}
          >
            <span className="hidden sm:inline">Invite</span>
          </Button>
          <Button
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/create-exam', { state: { classId } })}
          >
            <span className="hidden sm:inline">New Exam</span>
          </Button>
        </div>
      }
    >
      {error && (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <DashboardLoader />
      ) : !classData ? (
        <EmptyState
          icon={<FileText className="w-8 h-8 text-text-muted" />}
          title="Class Not Found"
          description="This class doesn't exist or you don't have access."
          action={<Button onClick={() => navigate('/classes')}>Go to Classes</Button>}
        />
      ) : (
        <div className="space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-bg-card border border-border rounded-xl px-5 py-4 text-center">
              <p className="text-2xl font-bold text-text-primary">{activeStudents.length}</p>
              <p className="text-xs text-text-muted mt-1">Active Students</p>
            </div>
            <div className="bg-bg-card border border-border rounded-xl px-5 py-4 text-center">
              <p className="text-2xl font-bold text-warning">{pendingInvitations.length}</p>
              <p className="text-xs text-text-muted mt-1">Pending Invites</p>
            </div>
            <div className="bg-bg-card border border-border rounded-xl px-5 py-4 text-center">
              <p className="text-2xl font-bold text-primary">{exams.length}</p>
              <p className="text-xs text-text-muted mt-1">Exams</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-bg-secondary rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-bg-card text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      activeTab === tab.key
                        ? 'bg-primary/20 text-primary'
                        : 'bg-bg-hover text-text-muted'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'students' && (
            <div className="space-y-4 animate-fade-in">
              {activeStudents.length === 0 && archivedStudents.length === 0 ? (
                <EmptyState
                  icon={<Users className="w-8 h-8 text-text-muted" />}
                  title="No Students Yet"
                  description="Invite students to join this class."
                  action={
                    <Button
                      leftIcon={<UserPlus className="w-4 h-4" />}
                      onClick={() => setShowInviteModal(true)}
                    >
                      Invite Student
                    </Button>
                  }
                />
              ) : (
                <>
                  {activeStudents.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-text-secondary mb-3">
                        Active ({activeStudents.length})
                      </h3>
                      <div className="space-y-2">
                        {activeStudents.map((s) => (
                          <StudentRow
                            key={s.id}
                            enrollment={s}
                            onArchive={() => handleArchiveToggle(s)}
                            onRemove={() => handleRemoveEnrollment(s.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {archivedStudents.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-text-muted mb-3">
                        Archived ({archivedStudents.length})
                      </h3>
                      <div className="space-y-2 opacity-60">
                        {archivedStudents.map((s) => (
                          <StudentRow
                            key={s.id}
                            enrollment={s}
                            onArchive={() => handleArchiveToggle(s)}
                            onRemove={() => handleRemoveEnrollment(s.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'invitations' && (
            <div className="space-y-3 animate-fade-in">
              {invitations.length === 0 ? (
                <EmptyState
                  icon={<Mail className="w-8 h-8 text-text-muted" />}
                  title="No Invitations"
                  description="Send invitations to students via email."
                  action={
                    <Button
                      leftIcon={<UserPlus className="w-4 h-4" />}
                      onClick={() => setShowInviteModal(true)}
                    >
                      Invite Student
                    </Button>
                  }
                />
              ) : (
                invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between bg-bg-card border border-border rounded-lg px-5 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {inv.student_name ?? inv.student_email}
                      </p>
                      <p className="text-xs text-text-muted">{inv.student_email}</p>
                    </div>
                    <Badge
                      variant={
                        inv.status === 'accepted'
                          ? 'success'
                          : inv.status === 'rejected'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {inv.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                      {inv.status === 'accepted' && <Check className="w-3 h-3 mr-1" />}
                      {inv.status === 'rejected' && <X className="w-3 h-3 mr-1" />}
                      {inv.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'exams' && (
            <div className="space-y-3 animate-fade-in">
              {exams.length === 0 ? (
                <EmptyState
                  icon={<FileText className="w-8 h-8 text-text-muted" />}
                  title="No Exams"
                  description="Create an exam for this class."
                  action={
                    <Button
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={() => navigate('/create-exam', { state: { classId } })}
                    >
                      Create Exam
                    </Button>
                  }
                />
              ) : (
                exams.map((exam) => {
                  const status = getExamStatus(exam);
                  const statusBadge = (() => {
                    if (status === 'open') {
                      return (
                        <Badge variant="success" size="sm">
                          <Clock className="w-3 h-3 mr-1" />
                          Due {relativeTime(exam.end_time!)}
                        </Badge>
                      );
                    }
                    if (status === 'not_started') {
                      return (
                        <Badge variant="warning" size="sm">
                          <Timer className="w-3 h-3 mr-1" />
                          Starts {relativeTime(exam.start_time!)}
                        </Badge>
                      );
                    }
                    return (
                      <Badge variant="danger" size="sm">
                        <Ban className="w-3 h-3 mr-1" />
                        Ended
                      </Badge>
                    );
                  })();

                  return (
                    <div
                      key={exam.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-bg-card border border-border rounded-lg px-5 py-4 animate-fade-in"
                    >
                      {/* Exam Info — clickable to view grading */}
                      <button
                        onClick={() => navigate(`/grading/${exam.id}`)}
                        className="min-w-0 text-left flex-1 hover:opacity-80 transition-opacity mb-3 sm:mb-0"
                      >
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-text-primary">{exam.title}</span>
                          <Badge variant={exam.is_finalized ? 'success' : 'warning'} size="sm">
                            {exam.is_finalized ? (
                              <><CheckCircle className="w-3 h-3 mr-1" />Finalized</>
                            ) : (
                              'Draft'
                            )}
                          </Badge>
                          {exam.end_time && statusBadge}
                        </div>
                        <p className="text-xs text-text-muted">
                          {exam.subject} · {exam.question_count} questions · {exam.total_marks} marks
                          {exam.submission_count > 0 && ` · ${exam.submission_count} submissions`}
                        </p>
                      </button>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<Pencil className="w-4 h-4" />}
                          onClick={() => navigate(`/exams/${exam.id}/edit`)}
                          disabled={exam.is_finalized}
                          title={exam.is_finalized ? 'Cannot edit finalized exams' : 'Edit exam'}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          leftIcon={<Trash2 className="w-4 h-4" />}
                          onClick={() => setExamToDelete(exam)}
                          disabled={exam.is_finalized}
                          title={exam.is_finalized ? 'Cannot delete finalized exams' : 'Delete exam'}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && classId && (
        <InviteStudentModal
          classId={classId}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => {
            setShowInviteModal(false);
            loadClassData();
          }}
        />
      )}

      {/* Delete Exam Confirmation */}
      {examToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setExamToDelete(null)} />
          <div className="relative bg-bg-secondary border border-border rounded-2xl w-full max-w-md p-6 animate-scale-in">
            <h3 className="text-lg font-semibold text-text-primary mb-2">Delete Exam</h3>
            <p className="text-sm text-text-secondary mb-4">
              Are you sure you want to delete <strong>{examToDelete.title}</strong>? This action
              cannot be undone.
            </p>
            <Alert variant="warning" className="mb-4">
              Only draft exams can be deleted. Finalized exams are permanent.
            </Alert>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setExamToDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteExam}
                isLoading={isDeleting}
              >
                {isDeleting ? 'Deleting…' : 'Delete Exam'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

/* ---- Sub-components ---- */

function StudentRow({
  enrollment,
  onArchive,
  onRemove,
}: {
  enrollment: EnrollmentResponse;
  onArchive: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between bg-bg-card border border-border rounded-lg px-5 py-3 animate-fade-in">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">
          {enrollment.student_name ?? 'Unknown'}
        </p>
        <p className="text-xs text-text-muted">{enrollment.student_email}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        <button
          onClick={onArchive}
          className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted transition-colors"
          title={enrollment.status === 'active' ? 'Archive student' : 'Restore student'}
        >
          {enrollment.status === 'active' ? (
            <Archive className="w-4 h-4" />
          ) : (
            <RotateCcw className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={onRemove}
          className="p-1.5 rounded-lg hover:bg-danger/10 text-text-muted hover:text-danger transition-colors"
          title="Remove student"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function InviteStudentModal({
  classId,
  onClose,
  onInvited,
}: {
  classId: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    setIsSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const result = await classesApi.inviteStudent(classId, { email: email.trim() });
      setSuccess(`Invitation sent to ${result.student_email ?? email}`);
      setEmail('');
      // Auto-close after brief delay so user sees success
      setTimeout(onInvited, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-secondary border border-border rounded-2xl w-full max-w-md p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-text-primary">Invite Student</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-text-secondary mb-4">
          Enter the student's email address. They must have a SmartGrade student account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}
          <Input
            label="Student Email"
            type="email"
            placeholder="student@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              leftIcon={<Mail className="w-4 h-4" />}
            >
              Send Invite
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

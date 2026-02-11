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
} from 'lucide-react';

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
                exams.map((exam) => (
                  <button
                    key={exam.id}
                    onClick={() => navigate(`/grading/${exam.id}`)}
                    className="w-full flex items-center justify-between bg-bg-card border border-border rounded-lg px-5 py-4 hover:border-primary/40 transition-all text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-text-primary">{exam.title}</span>
                        <Badge variant={exam.is_finalized ? 'success' : 'warning'} size="sm">
                          {exam.is_finalized ? 'Active' : 'Draft'}
                        </Badge>
                      </div>
                      <p className="text-xs text-text-muted">
                        {exam.subject} · {exam.question_count} questions · {exam.total_marks} marks
                        {exam.submission_count > 0 && ` · ${exam.submission_count} submissions`}
                      </p>
                    </div>
                  </button>
                ))
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

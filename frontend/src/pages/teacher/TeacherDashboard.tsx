/**
 * Teacher Dashboard
 *
 * Main hub showing organization info, classes, recent exams,
 * and quick-action links.
 */
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  DashboardLayout,
  DashboardLoader,
  EmptyState,
  StatCard,
} from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui';
import { Badge } from '@/components/ui';
import { Alert } from '@/components/ui';
import { organizationsApi, classesApi, examsApi } from '@/lib/api';
import type { OrganizationDetail, ClassResponse, ExamListItem } from '@/lib/types';
import {
  Plus,
  BookOpen,
  FileText,
  Users,
  Building2,
  BarChart3,
  ArrowRight,
  Clock,
  Timer,
  Ban,
  CheckCircle,
} from 'lucide-react';

// ---- Exam status utilities ----

type ExamTimeStatus = 'not_started' | 'open' | 'ended';

/**
 * Determine the live timing status of an exam based on start/end times.
 * Note: This is separate from finalized/draft status.
 */
function getExamTimeStatus(exam: ExamListItem): ExamTimeStatus {
  const now = new Date();

  if (exam.start_time && now < new Date(exam.start_time)) {
    return 'not_started';
  }

  if (exam.end_time && now > new Date(exam.end_time)) {
    return 'ended';
  }

  return 'open';
}

/** Human-readable relative time until or since a date. */
function relativeTime(iso: string): string {
  const target = new Date(iso);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const absDiff = Math.abs(diffMs);

  const minutes = Math.floor(absDiff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const label =
    days > 0
      ? `${days}d ${hours % 24}h`
      : hours > 0
        ? `${hours}h ${minutes % 60}m`
        : `${minutes}m`;

  return diffMs > 0 ? `in ${label}` : `${label} ago`;
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [organization, setOrganization] = useState<OrganizationDetail | null>(null);
  const [classes, setClasses] = useState<ClassResponse[]>([]);
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [org, cls, exs] = await Promise.all([
        organizationsApi.getMyOrganization(),
        classesApi.listTeaching(),
        examsApi.listTeaching(),
      ]);
      setOrganization(org);
      setClasses(cls);
      setExams(exs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const totalStudents = classes.reduce((sum, c) => sum + c.student_count, 0);
  const totalExams = exams.length;
  const pendingGrading = exams.filter(
    (e) => e.is_finalized && e.submission_count > 0,
  ).length;

  return (
    <DashboardLayout
      title={`Welcome, ${user?.name?.split(' ')[0] ?? 'Teacher'}`}
      subtitle={organization ? organization.name : 'Loading...'}
      headerAction={
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<BookOpen className="w-4 h-4" />}
            onClick={() => navigate('/classes')}
          >
            <span className="hidden sm:inline">Classes</span>
          </Button>
          <Button
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/create-exam')}
          >
            <span className="hidden sm:inline">New Exam</span>
          </Button>
        </div>
      }
    >
      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <DashboardLoader />
      ) : (
        <div className="space-y-8">
          {/* Stats Row */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Organization"
              value={organization?.name ?? '—'}
              icon={<Building2 className="w-5 h-5 text-primary" />}
            />
            <StatCard
              label="Classes"
              value={classes.length}
              icon={<BookOpen className="w-5 h-5 text-secondary" />}
            />
            <StatCard
              label="Total Students"
              value={totalStudents}
              icon={<Users className="w-5 h-5 text-success" />}
            />
            <StatCard
              label="Active Exams"
              value={totalExams}
              icon={<FileText className="w-5 h-5 text-warning" />}
              trend={pendingGrading > 0 ? `${pendingGrading} with submissions` : undefined}
            />
          </section>

          {/* Quick Actions */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <QuickAction
                icon={<BookOpen className="w-6 h-6 text-primary" />}
                title="Create Class"
                description="Start a new class section"
                onClick={() => navigate('/classes', { state: { createClass: true } })}
              />
              <QuickAction
                icon={<FileText className="w-6 h-6 text-secondary" />}
                title="Create Exam"
                description="Design a new exam template"
                onClick={() => navigate('/create-exam')}
              />
              <QuickAction
                icon={<BarChart3 className="w-6 h-6 text-success" />}
                title="View Grading"
                description="Review and grade submissions"
                onClick={() => navigate('/grading')}
              />
            </div>
          </section>

          {/* Classes Overview */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Your Classes</h2>
              {classes.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => navigate('/classes')}
                >
                  View All
                </Button>
              )}
            </div>
            {classes.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="w-8 h-8 text-text-muted" />}
                title="No classes yet"
                description="Create your first class to start inviting students."
                action={
                  <Button
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => navigate('/classes', { state: { createClass: true } })}
                  >
                    Create Class
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {classes.slice(0, 6).map((cls) => (
                  <ClassCard
                    key={cls.id}
                    cls={cls}
                    onClick={() => navigate(`/classes/${cls.id}`)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Recent Exams */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Recent Exams</h2>
              {exams.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => navigate('/grading')}
                >
                  View All
                </Button>
              )}
            </div>
            {exams.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-8 h-8 text-text-muted" />}
                title="No exams created"
                description="Create an exam template to get started with grading."
                action={
                  <Button
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => navigate('/create-exam')}
                  >
                    Create Exam
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {exams.slice(0, 6).map((exam) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    onClick={() => navigate(`/grading/${exam.id}`)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}

// ============ Sub-components ============

function QuickAction({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-4 p-4 bg-bg-card border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
    >
      <div className="p-2 bg-bg-elevated rounded-lg group-hover:bg-primary/10 transition-colors">
        {icon}
      </div>
      <div>
        <h3 className="font-medium text-text-primary group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-sm text-text-secondary">{description}</p>
      </div>
    </button>
  );
}

function ClassCard({
  cls,
  onClick,
}: {
  cls: ClassResponse;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="p-4 bg-bg-card border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left group animate-fade-in"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-text-primary group-hover:text-primary transition-colors truncate">
          {cls.name}
        </h3>
        {cls.is_archived && <Badge variant="warning">Archived</Badge>}
      </div>
      <div className="flex items-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" /> {cls.student_count} students
        </span>
        <span className="flex items-center gap-1">
          <FileText className="w-3 h-3" /> {cls.exam_count} exams
        </span>
      </div>
    </button>
  );
}

function ExamCard({
  exam,
  onClick,
}: {
  exam: ExamListItem;
  onClick: () => void;
}) {
  const timeStatus = getExamTimeStatus(exam);

  // Determine badge based on finalized status AND time status
  const getBadge = () => {
    if (!exam.is_finalized) {
      return (
        <Badge variant="default" size="sm">
          <Clock className="w-3 h-3 mr-1" />
          Draft
        </Badge>
      );
    }

    // Finalized exam — show time-based status
    if (timeStatus === 'not_started') {
      return (
        <Badge variant="warning" size="sm">
          <Timer className="w-3 h-3 mr-1" />
          Scheduled
        </Badge>
      );
    }
    if (timeStatus === 'ended') {
      return (
        <Badge variant="danger" size="sm">
          <Ban className="w-3 h-3 mr-1" />
          Closed
        </Badge>
      );
    }
    // open
    return (
      <Badge variant="success" size="sm">
        <CheckCircle className="w-3 h-3 mr-1" />
        Active
      </Badge>
    );
  };

  return (
    <button
      onClick={onClick}
      className="p-4 bg-bg-card border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left group animate-fade-in"
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <h3 className="font-medium text-text-primary group-hover:text-primary transition-colors truncate">
          {exam.title}
        </h3>
        {getBadge()}
      </div>
      <p className="text-xs text-text-muted mb-2 truncate">{exam.subject}</p>
      <div className="flex items-center gap-3 text-xs text-text-secondary flex-wrap">
        <span>{exam.question_count} questions</span>
        <span>·</span>
        <span>{exam.total_marks} marks</span>
        {exam.submission_count > 0 && (
          <>
            <span>·</span>
            <span className="text-warning">{exam.submission_count} submissions</span>
          </>
        )}
      </div>

      {/* Time context line */}
      {exam.is_finalized && (
        <div className="mt-2 text-xs text-text-muted flex items-center gap-1">
          {timeStatus === 'not_started' && exam.start_time && (
            <>
              <Timer className="w-3 h-3 text-warning" />
              <span>Starts {relativeTime(exam.start_time)}</span>
            </>
          )}
          {timeStatus === 'open' && exam.end_time && (
            <>
              <Clock className="w-3 h-3 text-success" />
              <span>Closes {relativeTime(exam.end_time)}</span>
            </>
          )}
          {timeStatus === 'ended' && exam.end_time && (
            <>
              <Ban className="w-3 h-3 text-danger" />
              <span>Closed {relativeTime(exam.end_time)}</span>
            </>
          )}
        </div>
      )}
    </button>
  );
}

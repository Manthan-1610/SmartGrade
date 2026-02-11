/**
 * Teacher Dashboard
 *
 * Main hub showing organization overview, classes, recent exams,
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
import type { Organization, ClassResponse, ExamListItem } from '@/lib/types';
import {
  Plus,
  BookOpen,
  FileText,
  Users,
  Building2,
  Clock,
  BarChart3,
  ArrowRight,
} from 'lucide-react';

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [classes, setClasses] = useState<ClassResponse[]>([]);
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [orgs, cls, exs] = await Promise.all([
        organizationsApi.list(),
        classesApi.listTeaching(),
        examsApi.listTeaching(),
      ]);
      setOrganizations(orgs);
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
      subtitle="Here's an overview of your teaching activity"
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
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
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
              label="Organizations"
              value={organizations.length}
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
                icon={<Building2 className="w-6 h-6 text-primary" />}
                title="Create Organization"
                description="Set up a new coaching center"
                onClick={() => navigate('/classes', { state: { createOrg: true } })}
              />
              <QuickAction
                icon={<BookOpen className="w-6 h-6 text-secondary" />}
                title="Create Class"
                description="Start a new class section"
                onClick={() => navigate('/classes', { state: { createClass: true } })}
              />
              <QuickAction
                icon={<FileText className="w-6 h-6 text-success" />}
                title="Create Exam"
                description="Design a new exam template"
                onClick={() => navigate('/create-exam')}
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
                title="No Classes Yet"
                description="Create your first class and start inviting students."
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classes.slice(0, 6).map((cls) => (
                  <ClassCard key={cls.id} cls={cls} onClick={() => navigate(`/classes/${cls.id}`)} />
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
                  onClick={() => navigate('/exams')}
                >
                  View All
                </Button>
              )}
            </div>
            {exams.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-8 h-8 text-text-muted" />}
                title="No Exams Yet"
                description="Create your first exam with AI-powered rubric generation."
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
              <div className="space-y-3">
                {exams.slice(0, 5).map((exam) => (
                  <ExamRow key={exam.id} exam={exam} navigate={navigate} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}

/* ---- Sub-components ---- */

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
      className="group flex items-center gap-4 bg-bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-lg transition-all text-left animate-fade-in"
    >
      <div className="p-2.5 bg-bg-hover rounded-lg group-hover:bg-primary/10 transition-colors">
        {icon}
      </div>
      <div>
        <p className="font-medium text-text-primary group-hover:text-primary transition-colors">
          {title}
        </p>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
    </button>
  );
}

function ClassCard({ cls, onClick }: { cls: ClassResponse; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group text-left bg-bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-lg transition-all animate-fade-in"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-text-primary group-hover:text-primary transition-colors truncate">
          {cls.name}
        </h3>
        {cls.is_archived && <Badge variant="warning">Archived</Badge>}
      </div>
      {cls.organization_name && (
        <p className="text-xs text-text-muted mb-3 truncate">{cls.organization_name}</p>
      )}
      <div className="flex items-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" /> {cls.student_count} students
        </span>
        <span className="flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" /> {cls.exam_count} exams
        </span>
      </div>
    </button>
  );
}

function ExamRow({
  exam,
  navigate,
}: {
  exam: ExamListItem;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <div
      className="flex items-center justify-between bg-bg-card border border-border rounded-lg px-5 py-4 hover:border-border-light transition-colors cursor-pointer animate-fade-in"
      onClick={() => navigate(`/grading/${exam.id}`)}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-text-primary truncate">{exam.title}</span>
          <Badge variant={exam.is_finalized ? 'success' : 'warning'} size="sm">
            {exam.is_finalized ? 'Active' : 'Draft'}
          </Badge>
          {exam.is_published && (
            <Badge variant="primary" size="sm">Published</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span>{exam.subject}</span>
          <span>•</span>
          <span>{exam.question_count} questions</span>
          <span>•</span>
          <span>{exam.total_marks} marks</span>
          {exam.submission_count > 0 && (
            <>
              <span>•</span>
              <span className="text-primary">{exam.submission_count} submissions</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        {exam.end_time && (
          <span className="text-xs text-text-muted flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {new Date(exam.end_time).toLocaleDateString()}
          </span>
        )}
        <BarChart3 className="w-4 h-4 text-text-muted" />
      </div>
    </div>
  );
}

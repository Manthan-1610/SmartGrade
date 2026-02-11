/**
 * Student Dashboard
 *
 * Landing page for students showing enrolled classes, upcoming exams,
 * pending invitations, and recent results at a glance.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  DashboardLayout,
  DashboardLoader,
  EmptyState,
  StatCard,
} from '@/components/layout/DashboardLayout';
import { Button, Badge, Alert } from '@/components/ui';
import { classesApi, examsApi, invitationsApi, gradingApi } from '@/lib/api';
import type { ClassResponse, ExamListItem, InvitationResponse, StudentExamResult } from '@/lib/types';
import {
  BookOpen,
  FileText,
  Mail,
  BarChart3,
  ArrowRight,
  Clock,
  Award,
  TrendingUp,
} from 'lucide-react';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [classes, setClasses] = useState<ClassResponse[]>([]);
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationResponse[]>([]);
  const [results, setResults] = useState<StudentExamResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [cls, exs, invites, res] = await Promise.all([
        classesApi.listEnrolled(),
        examsApi.listStudent(),
        invitationsApi.list('pending'),
        gradingApi.getMyResults(),
      ]);
      setClasses(cls);
      setExams(exs);
      setInvitations(invites);
      setResults(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const upcomingExams = exams.filter((e) => {
    if (!e.end_time) return true;
    return new Date(e.end_time) > new Date();
  });
  const avgPercentage =
    results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length)
      : null;

  return (
    <DashboardLayout
      title={`Welcome, ${user?.name?.split(' ')[0] ?? 'Student'}`}
      subtitle="Your learning overview"
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
              label="Enrolled Classes"
              value={classes.length}
              icon={<BookOpen className="w-5 h-5 text-primary" />}
            />
            <StatCard
              label="Upcoming Exams"
              value={upcomingExams.length}
              icon={<FileText className="w-5 h-5 text-warning" />}
            />
            <StatCard
              label="Pending Invites"
              value={invitations.length}
              icon={<Mail className="w-5 h-5 text-secondary" />}
              trend={invitations.length > 0 ? 'Action needed' : undefined}
            />
            <StatCard
              label="Average Score"
              value={avgPercentage !== null ? `${avgPercentage}%` : '—'}
              icon={<TrendingUp className="w-5 h-5 text-success" />}
            />
          </section>

          {/* Pending Invitations Alert */}
          {invitations.length > 0 && (
            <section className="animate-fade-in">
              <div className="bg-primary/10 border border-primary/30 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="w-6 h-6 text-primary" />
                    <div>
                      <p className="font-medium text-text-primary">
                        You have {invitations.length} pending invitation{invitations.length > 1 ? 's' : ''}
                      </p>
                      <p className="text-sm text-text-secondary">
                        Review and accept to join new classes
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                    onClick={() => navigate('/invitations')}
                  >
                    Review
                  </Button>
                </div>
              </div>
            </section>
          )}

          {/* Upcoming Exams */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Upcoming Exams</h2>
              {exams.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => navigate('/my-classes')}
                >
                  View All
                </Button>
              )}
            </div>
            {upcomingExams.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-8 h-8 text-text-muted" />}
                title="No Upcoming Exams"
                description="You'll see exams here once your teacher creates them."
              />
            ) : (
              <div className="space-y-3">
                {upcomingExams.slice(0, 5).map((exam) => (
                  <button
                    key={exam.id}
                    onClick={() => navigate('/submit-exam', { state: { examId: exam.id } })}
                    className="w-full flex items-center justify-between bg-bg-card border border-border rounded-xl px-5 py-4 hover:border-primary/40 hover:shadow-lg transition-all text-left animate-fade-in"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-text-primary">{exam.title}</span>
                        <Badge variant="primary" size="sm">{exam.subject}</Badge>
                      </div>
                      <p className="text-xs text-text-muted">
                        {exam.question_count} questions · {exam.total_marks} marks
                        {exam.class_name && ` · ${exam.class_name}`}
                      </p>
                    </div>
                    {exam.end_time && (
                      <span className="flex items-center gap-1 text-xs text-text-muted flex-shrink-0 ml-4">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(exam.end_time).toLocaleDateString()}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* My Classes */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">My Classes</h2>
              {classes.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => navigate('/my-classes')}
                >
                  View All
                </Button>
              )}
            </div>
            {classes.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="w-8 h-8 text-text-muted" />}
                title="No Classes Yet"
                description="Accept an invitation from a teacher to join a class."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {classes.slice(0, 6).map((cls) => (
                  <div
                    key={cls.id}
                    className="bg-bg-card border border-border rounded-xl p-5 animate-fade-in"
                  >
                    <h3 className="font-semibold text-text-primary mb-1">{cls.name}</h3>
                    {cls.organization_name && (
                      <p className="text-xs text-text-muted mb-3">{cls.organization_name}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-text-secondary">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" /> {cls.exam_count} exams
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent Results */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Recent Results</h2>
              {results.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => navigate('/results')}
                >
                  View All
                </Button>
              )}
            </div>
            {results.length === 0 ? (
              <EmptyState
                icon={<BarChart3 className="w-8 h-8 text-text-muted" />}
                title="No Results Yet"
                description="Results will appear here after your teacher publishes marks."
              />
            ) : (
              <div className="space-y-3">
                {results.slice(0, 5).map((result) => (
                  <button
                    key={result.exam_id}
                    onClick={() => navigate(`/results/${result.exam_id}`)}
                    className="w-full flex items-center justify-between bg-bg-card border border-border rounded-lg px-5 py-4 hover:border-primary/40 transition-all text-left animate-fade-in"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-text-primary">{result.exam_title}</span>
                      <p className="text-xs text-text-muted mt-0.5">{result.subject}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <div className="text-right">
                        <p className="font-semibold text-text-primary">
                          {result.obtained_marks}/{result.total_marks}
                        </p>
                        <p className="text-xs text-text-muted">{result.percentage}%</p>
                      </div>
                      <Award
                        className={`w-5 h-5 ${
                          result.percentage >= 80
                            ? 'text-success'
                            : result.percentage >= 50
                              ? 'text-warning'
                              : 'text-danger'
                        }`}
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}

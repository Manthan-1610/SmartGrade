/**
 * Student Dashboard
 *
 * Landing page for students showing enrolled classes, upcoming exams,
 * pending invitations, and recent results at a glance.
 *
 * Exam cards display live status:
 *  - "Not Yet Started" — before start_time (grayed, shows start time)
 *  - "Open"            — between start_time and effective deadline (clickable)
 *  - "Ended"           — past end_time + grace (disabled)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
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
  AlertTriangle,
  Ban,
  Timer,
} from 'lucide-react';

// ---- Exam status utilities ----

type ExamStatus = 'not_started' | 'open' | 'ended';

/**
 * Derive the live status of an exam based on its start/end times.
 * `grace_period_minutes` defaults to 0 if the list item doesn't carry it
 * (the ExamListItem schema does not include grace period, so we treat
 * end_time as the hard cutoff from the list view; the real grace-period
 * enforcement happens on the backend and in the SubmitExam page).
 */
function getExamStatus(exam: ExamListItem): ExamStatus {
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

  // Categorize exams by live status
  const categorizedExams = useMemo(() => {
    const notStarted: ExamListItem[] = [];
    const open: ExamListItem[] = [];
    const ended: ExamListItem[] = [];

    for (const exam of exams) {
      const status = getExamStatus(exam);
      if (status === 'not_started') notStarted.push(exam);
      else if (status === 'open') open.push(exam);
      else ended.push(exam);
    }

    return { notStarted, open, ended };
  }, [exams]);

  /** All exams that still need attention (not-started + open). */
  const upcomingExams = useMemo(
    () => [...categorizedExams.open, ...categorizedExams.notStarted],
    [categorizedExams],
  );

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
                {upcomingExams.slice(0, 5).map((exam) => {
                  const status = getExamStatus(exam);
                  const isClickable = status === 'open';

                  return (
                    <button
                      key={exam.id}
                      onClick={() => {
                        if (isClickable) {
                          navigate('/submit-exam', { state: { examId: exam.id } });
                        }
                      }}
                      disabled={!isClickable}
                      className={`w-full flex items-center justify-between rounded-xl px-5 py-4 text-left transition-all animate-fade-in border ${
                        status === 'open'
                          ? 'bg-bg-card border-border hover:border-primary/40 hover:shadow-lg cursor-pointer'
                          : 'bg-bg-secondary border-border/60 opacity-75 cursor-not-allowed'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`font-medium ${status === 'open' ? 'text-text-primary' : 'text-text-muted'}`}>
                            {exam.title}
                          </span>
                          <Badge variant="primary" size="sm">{exam.subject}</Badge>

                          {/* Status badge */}
                          {status === 'not_started' && (
                            <Badge variant="warning" size="sm">
                              <Timer className="w-3 h-3 mr-1" />
                              Not Yet Started
                            </Badge>
                          )}
                          {status === 'open' && (
                            <Badge variant="success" size="sm">
                              <Clock className="w-3 h-3 mr-1" />
                              Open
                            </Badge>
                          )}
                          {status === 'ended' && (
                            <Badge variant="danger" size="sm">
                              <Ban className="w-3 h-3 mr-1" />
                              Ended
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-text-muted">
                          {exam.question_count} questions · {exam.total_marks} marks
                          {exam.class_name && ` · ${exam.class_name}`}
                        </p>

                        {/* Contextual time info */}
                        {status === 'not_started' && exam.start_time && (
                          <p className="text-xs text-warning mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Starts {relativeTime(exam.start_time)} ({new Date(exam.start_time).toLocaleString()})
                          </p>
                        )}
                        {status === 'open' && exam.end_time && (
                          <p className="text-xs text-success mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Ends {relativeTime(exam.end_time)}
                          </p>
                        )}
                      </div>

                      {/* Right side time indicator */}
                      {exam.end_time && status === 'open' && (
                        <span className="flex items-center gap-1 text-xs text-text-muted flex-shrink-0 ml-4">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(exam.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {status === 'not_started' && (
                        <span className="flex items-center gap-1 text-xs text-warning flex-shrink-0 ml-4">
                          <Timer className="w-3.5 h-3.5" />
                          Upcoming
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Ended Exams (collapsed, optional view) */}
            {categorizedExams.ended.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-text-muted mb-2">
                  {categorizedExams.ended.length} ended exam{categorizedExams.ended.length > 1 ? 's' : ''} — results will appear below once published.
                </p>
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

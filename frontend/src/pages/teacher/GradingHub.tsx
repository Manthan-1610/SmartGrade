/**
 * Grading Hub
 *
 * Shows all exams with submissions awaiting grading.
 * Teachers can drill into individual exam grading.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DashboardLayout,
  DashboardLoader,
  EmptyState,
} from '@/components/layout/DashboardLayout';
import { Button, Badge, Alert } from '@/components/ui';
import { examsApi } from '@/lib/api';
import type { ExamListItem } from '@/lib/types';
import {
  BarChart3,
  Clock,
  CheckCircle,
  ArrowRight,
  Search,
} from 'lucide-react';

export default function GradingHub() {
  const navigate = useNavigate();

  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadExams = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await examsApi.listTeaching();
      // Only show finalized exams with submissions
      setExams(data.filter((e) => e.is_finalized));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exams');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const filtered = exams.filter(
    (e) =>
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.subject.toLowerCase().includes(search.toLowerCase()),
  );

  const withSubmissions = filtered.filter((e) => e.submission_count > 0);
  const noSubmissions = filtered.filter((e) => e.submission_count === 0);

  return (
    <DashboardLayout
      title="Grade Submissions"
      subtitle="Review AI-assisted grades and finalize student marks"
    >
      {error && (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <DashboardLoader />
      ) : exams.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="w-8 h-8 text-text-muted" />}
          title="No Exams to Grade"
          description="Finalize an exam first, then students can submit answers."
          action={
            <Button onClick={() => navigate('/create-exam')}>Create Exam</Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Search */}
          {exams.length > 3 && (
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search exams..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-bg-input border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {/* Exams with Submissions */}
          {withSubmissions.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-3">
                Awaiting Review ({withSubmissions.length})
              </h2>
              <div className="space-y-3">
                {withSubmissions.map((exam) => (
                  <ExamGradingCard key={exam.id} exam={exam} navigate={navigate} />
                ))}
              </div>
            </section>
          )}

          {/* Exams without Submissions */}
          {noSubmissions.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-3">
                No Submissions Yet ({noSubmissions.length})
              </h2>
              <div className="space-y-3 opacity-60">
                {noSubmissions.map((exam) => (
                  <ExamGradingCard key={exam.id} exam={exam} navigate={navigate} />
                ))}
              </div>
            </section>
          )}

          {filtered.length === 0 && search && (
            <p className="text-center text-text-muted py-12">
              No exams match "{search}"
            </p>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

/* ---- Sub-components ---- */

function ExamGradingCard({
  exam,
  navigate,
}: {
  exam: ExamListItem;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <button
      onClick={() => navigate(`/grading/${exam.id}`)}
      className="w-full flex items-center justify-between bg-bg-card border border-border rounded-xl px-5 py-4 hover:border-primary/40 hover:shadow-lg transition-all text-left animate-fade-in"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-text-primary">{exam.title}</span>
          {exam.is_published ? (
            <Badge variant="success" size="sm">
              <CheckCircle className="w-3 h-3 mr-1" />
              Published
            </Badge>
          ) : exam.submission_count > 0 ? (
            <Badge variant="warning" size="sm">
              {exam.submission_count} pending
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span>{exam.subject}</span>
          <span>·</span>
          <span>{exam.question_count} questions</span>
          <span>·</span>
          <span>{exam.total_marks} marks</span>
          {exam.class_name && (
            <>
              <span>·</span>
              <span>{exam.class_name}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        {exam.end_time && (
          <span className="text-xs text-text-muted flex items-center gap-1 mr-2">
            <Clock className="w-3.5 h-3.5" />
            {new Date(exam.end_time).toLocaleDateString()}
          </span>
        )}
        <ArrowRight className="w-4 h-4 text-text-muted" />
      </div>
    </button>
  );
}

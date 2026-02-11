/**
 * Student Results Page
 *
 * Shows all published exam results with detailed answer breakdowns.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DashboardLayout,
  DashboardLoader,
  EmptyState,
} from '@/components/layout/DashboardLayout';
import { Button, Badge, Alert } from '@/components/ui';
import { gradingApi } from '@/lib/api';
import type { StudentExamResult, StudentAnswerResponse } from '@/lib/types';
import {
  BarChart3,
  Award,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';

/**
 * Results list page — shows all published exam results.
 */
export default function Results() {
  const navigate = useNavigate();

  const [results, setResults] = useState<StudentExamResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadResults = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await gradingApi.getMyResults();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load results');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  return (
    <DashboardLayout
      title="My Results"
      subtitle="View your exam performance and detailed feedback"
    >
      {error && (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <DashboardLoader />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="w-8 h-8 text-text-muted" />}
          title="No Results Yet"
          description="Your results will appear here after your teacher publishes marks."
        />
      ) : (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-2">
            <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-text-primary">{results.length}</p>
              <p className="text-xs text-text-muted mt-1">Exams</p>
            </div>
            <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-success">
                {Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length)}%
              </p>
              <p className="text-xs text-text-muted mt-1">Average</p>
            </div>
            <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-primary">
                {Math.max(...results.map((r) => r.percentage))}%
              </p>
              <p className="text-xs text-text-muted mt-1">Best</p>
            </div>
            <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-text-primary">
                {results.reduce((s, r) => s + r.obtained_marks, 0)}/
                {results.reduce((s, r) => s + r.total_marks, 0)}
              </p>
              <p className="text-xs text-text-muted mt-1">Total Marks</p>
            </div>
          </div>

          {/* Results List */}
          {results.map((result) => (
            <button
              key={result.exam_id}
              onClick={() => navigate(`/results/${result.exam_id}`)}
              className="w-full flex items-center justify-between bg-bg-card border border-border rounded-xl px-5 py-4 hover:border-primary/40 hover:shadow-lg transition-all text-left animate-fade-in"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-text-primary">{result.exam_title}</span>
                  <Badge variant="primary" size="sm">{result.subject}</Badge>
                </div>
                <p className="text-xs text-text-muted">
                  {result.answers.length} questions · {result.total_marks} total marks
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                <div className="text-right">
                  <p className="text-lg font-bold text-text-primary">
                    {result.obtained_marks}/{result.total_marks}
                  </p>
                  <p className="text-xs text-text-muted">{result.percentage}%</p>
                </div>
                <ScoreIndicator percentage={result.percentage} />
              </div>
            </button>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

/**
 * Detailed result view for a single exam.
 */
export function ResultDetail() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  const [result, setResult] = useState<StudentExamResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());

  const loadResult = useCallback(async () => {
    if (!examId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await gradingApi.getExamResult(examId);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load result');
    } finally {
      setIsLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    loadResult();
  }, [loadResult]);

  const toggleExpand = (answerId: string) => {
    setExpandedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(answerId)) next.delete(answerId);
      else next.add(answerId);
      return next;
    });
  };

  return (
    <DashboardLayout
      title={result?.exam_title ?? 'Exam Result'}
      subtitle={result ? `${result.subject} · ${result.obtained_marks}/${result.total_marks} marks (${result.percentage}%)` : undefined}
      headerAction={
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate('/results')}
        >
          Back
        </Button>
      }
    >
      {error && (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <DashboardLoader />
      ) : !result ? (
        <EmptyState
          icon={<BarChart3 className="w-8 h-8 text-text-muted" />}
          title="Result Not Found"
          description="This result doesn't exist or hasn't been published yet."
          action={<Button onClick={() => navigate('/results')}>Back to Results</Button>}
        />
      ) : (
        <div className="space-y-6">
          {/* Score Summary */}
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary mb-1">Your Score</p>
                <p className="text-4xl font-bold text-text-primary">
                  {result.obtained_marks}
                  <span className="text-lg text-text-muted">/{result.total_marks}</span>
                </p>
                <p className="text-sm text-text-secondary mt-1">{result.percentage}%</p>
              </div>
              <ScoreIndicator percentage={result.percentage} size="lg" />
            </div>

            {/* Progress Bar */}
            <div className="mt-4 h-2 bg-bg-hover rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  result.percentage >= 80
                    ? 'bg-success'
                    : result.percentage >= 50
                      ? 'bg-warning'
                      : 'bg-danger'
                }`}
                style={{ width: `${result.percentage}%` }}
              />
            </div>
          </div>

          {/* Answers Breakdown */}
          <div>
            <h2 className="text-lg font-semibold text-text-primary mb-4">Answer Breakdown</h2>
            <div className="space-y-3">
              {result.answers.map((answer) => (
                <AnswerCard
                  key={answer.id}
                  answer={answer}
                  isExpanded={expandedAnswers.has(answer.id)}
                  onToggle={() => toggleExpand(answer.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

/* ---- Sub-components ---- */

function AnswerCard({
  answer,
  isExpanded,
  onToggle,
}: {
  answer: StudentAnswerResponse;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const marks = answer.teacher_marks ?? answer.ai_marks ?? 0;
  const feedback = answer.teacher_feedback || answer.ai_feedback;

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden animate-fade-in">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-bg-hover/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-lg flex-shrink-0">
            Q{answer.question_number}
          </span>
          <div className="min-w-0">
            <span className="text-sm text-text-secondary truncate block">
              {answer.verified_text || answer.extracted_text || 'No text extracted'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          {answer.ai_flagged_for_review && (
            <span title="Flagged for review"><AlertTriangle className="w-4 h-4 text-warning" /></span>
          )}
          <span className="font-semibold text-text-primary text-sm">
            {marks} marks
          </span>
          {answer.confidence > 0 && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                answer.confidence >= 0.8
                  ? 'bg-success/15 text-success'
                  : answer.confidence >= 0.5
                    ? 'bg-warning/15 text-warning'
                    : 'bg-danger/15 text-danger'
              }`}
            >
              {Math.round(answer.confidence * 100)}%
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-1 border-t border-border space-y-3 animate-fade-in">
          {/* Extracted Text */}
          <div>
            <p className="text-xs font-medium text-text-muted mb-1">Your Answer (Extracted)</p>
            <p className="text-sm text-text-primary bg-bg-secondary rounded-lg px-4 py-3">
              {answer.extracted_text || 'No text extracted'}
            </p>
          </div>

          {/* Verified Text (if different) */}
          {answer.verified_text && answer.verified_text !== answer.extracted_text && (
            <div>
              <p className="text-xs font-medium text-text-muted mb-1">Verified Text</p>
              <p className="text-sm text-text-primary bg-bg-secondary rounded-lg px-4 py-3">
                {answer.verified_text}
              </p>
            </div>
          )}

          {/* Marks Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            {answer.ai_marks !== null && (
              <div className="bg-bg-secondary rounded-lg px-4 py-3">
                <p className="text-xs text-text-muted mb-0.5">AI Score</p>
                <p className="text-sm font-medium text-text-primary">{answer.ai_marks} marks</p>
              </div>
            )}
            {answer.teacher_marks !== null && (
              <div className="bg-bg-secondary rounded-lg px-4 py-3">
                <p className="text-xs text-text-muted mb-0.5">Teacher Score</p>
                <p className="text-sm font-medium text-text-primary">{answer.teacher_marks} marks</p>
              </div>
            )}
          </div>

          {/* Feedback */}
          {feedback && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
              <p className="text-xs font-medium text-primary mb-1">Feedback</p>
              <p className="text-sm text-text-primary">{feedback}</p>
            </div>
          )}

          {/* Flags */}
          {answer.ai_flagged_for_review && (
            <div className="flex items-center gap-2 text-sm text-warning">
              <AlertTriangle className="w-4 h-4" />
              This answer was flagged for manual review
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreIndicator({
  percentage,
  size = 'sm',
}: {
  percentage: number;
  size?: 'sm' | 'lg';
}) {
  const iconSize = size === 'lg' ? 'w-10 h-10' : 'w-6 h-6';

  if (percentage >= 80) {
    return <CheckCircle className={`${iconSize} text-success`} />;
  }
  if (percentage >= 50) {
    return <Award className={`${iconSize} text-warning`} />;
  }
  return <XCircle className={`${iconSize} text-danger`} />;
}

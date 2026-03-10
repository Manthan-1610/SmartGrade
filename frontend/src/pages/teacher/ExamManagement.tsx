/**
 * ExamManagement Page
 *
 * Centralized exam management for teachers with full CRUD operations:
 *   - List all exams (grouped by status)
 *   - Search and filter
 *   - View exam details
 *   - Edit draft exams
 *   - Delete draft exams (with confirmation)
 *   - Navigate to create new exam
 *
 * Finalized exams can only be viewed; editing and deletion are restricted
 * to prevent data integrity issues with student submissions.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DashboardLayout,
  DashboardLoader,
  EmptyState,
} from '@/components/layout/DashboardLayout';
import { Button, Badge, Alert, Card, CardHeader } from '@/components/ui';
import { examsApi } from '@/lib/api';
import type { ExamListItem } from '@/lib/types';
import {
  Plus,
  Search,
  FileText,
  Pencil,
  Trash2,
  Eye,
  Clock,
  CheckCircle,
  AlertTriangle,
  Filter,
  BarChart3,
  X,
} from 'lucide-react';

type StatusFilter = 'all' | 'draft' | 'finalized' | 'published';

/** Format a datetime string for display. */
function formatDateTime(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Get human-readable exam status. */
function getExamStatusInfo(exam: ExamListItem) {
  if (exam.is_published) {
    return { label: 'Published', variant: 'success' as const, icon: CheckCircle };
  }
  if (exam.is_finalized) {
    return { label: 'Finalized', variant: 'primary' as const, icon: CheckCircle };
  }
  return { label: 'Draft', variant: 'warning' as const, icon: Clock };
}

export default function ExamManagement() {
  const navigate = useNavigate();

  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<ExamListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadExams = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await examsApi.listTeaching();
      setExams(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exams');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  /** Apply search and status filter. */
  const filteredExams = exams.filter((exam) => {
    // Search filter
    const matchesSearch =
      !search ||
      exam.title.toLowerCase().includes(search.toLowerCase()) ||
      exam.subject.toLowerCase().includes(search.toLowerCase()) ||
      (exam.class_name ?? '').toLowerCase().includes(search.toLowerCase());

    // Status filter
    let matchesStatus = true;
    if (statusFilter === 'draft') matchesStatus = !exam.is_finalized;
    else if (statusFilter === 'finalized') matchesStatus = exam.is_finalized && !exam.is_published;
    else if (statusFilter === 'published') matchesStatus = exam.is_published;

    return matchesSearch && matchesStatus;
  });

  /** Handle exam deletion. */
  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await examsApi.delete(deleteTarget.id);
      setExams((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete exam',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  /** Status filter counts. */
  const counts = {
    all: exams.length,
    draft: exams.filter((e) => !e.is_finalized).length,
    finalized: exams.filter((e) => e.is_finalized && !e.is_published).length,
    published: exams.filter((e) => e.is_published).length,
  };

  return (
    <DashboardLayout
      title="Exam Templates"
      subtitle="Create, edit, and manage your exam blueprints"
      headerAction={
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => navigate('/create-exam')}
        >
          Create Exam
        </Button>
      }
    >
      {/* Error Display */}
      {error && (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <DashboardLoader />
      ) : exams.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-8 h-8 text-text-muted" />}
          title="No Exams Created"
          description="Get started by creating your first exam template."
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
        <div className="space-y-6">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Search Bar */}
            <div className="relative flex-1 w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search by title, subject, or class..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-bg-input border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-bg-hover"
                >
                  <X className="w-3.5 h-3.5 text-text-muted" />
                </button>
              )}
            </div>

            {/* Status Filters */}
            <div className="flex items-center gap-1 bg-bg-card border border-border rounded-lg p-1">
              <Filter className="w-4 h-4 text-text-muted ml-2 mr-1" />
              {(
                [
                  { key: 'all', label: 'All' },
                  { key: 'draft', label: 'Drafts' },
                  { key: 'finalized', label: 'Finalized' },
                  { key: 'published', label: 'Published' },
                ] as { key: StatusFilter; label: string }[]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    statusFilter === key
                      ? 'bg-primary text-white'
                      : 'text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  {label} ({counts[key]})
                </button>
              ))}
            </div>
          </div>

          {/* Exam List */}
          {filteredExams.length === 0 ? (
            <p className="text-center text-text-muted py-12">
              {search
                ? `No exams match "${search}"`
                : 'No exams in this category'}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredExams.map((exam) => (
                <ExamRow
                  key={exam.id}
                  exam={exam}
                  onView={() => navigate(`/grading/${exam.id}`)}
                  onEdit={() => navigate(`/exams/${exam.id}/edit`)}
                  onDelete={() => setDeleteTarget(exam)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          examTitle={deleteTarget.title}
          isDeleting={isDeleting}
          error={deleteError}
          onConfirm={handleDelete}
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteError(null);
          }}
        />
      )}
    </DashboardLayout>
  );
}

// ============ Sub-components ============

/** Single exam row with actions. */
function ExamRow({
  exam,
  onView,
  onEdit,
  onDelete,
}: {
  exam: ExamListItem;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = getExamStatusInfo(exam);
  const StatusIcon = status.icon;
  const isDraft = !exam.is_finalized;
  const isLocked = exam.is_finalized;

  return (
    <Card
      padding="none"
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-4 animate-fade-in gap-4"
    >
      {/* Left: Exam Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-medium text-text-primary">{exam.title}</span>
          <Badge variant={status.variant} size="sm">
            <StatusIcon className="w-3 h-3 mr-1" />
            {status.label}
          </Badge>
          {exam.submission_count > 0 && (
            <Badge variant="default" size="sm">
              <BarChart3 className="w-3 h-3 mr-1" />
              {exam.submission_count} submission{exam.submission_count !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
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
          {exam.start_time && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDateTime(exam.start_time)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Eye className="w-4 h-4" />}
          onClick={onView}
        >
          View
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Pencil className="w-4 h-4" />}
          onClick={isDraft ? onEdit : undefined}
          disabled={isLocked}
          title={isLocked ? 'Finalized exams cannot be edited' : 'Edit exam details'}
          className={isLocked ? 'opacity-50 cursor-not-allowed' : ''}
        >
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Trash2 className={`w-4 h-4 ${isDraft ? 'text-danger' : ''}`} />}
          onClick={isDraft ? onDelete : undefined}
          disabled={isLocked}
          title={isLocked ? 'Finalized exams cannot be deleted' : 'Delete exam'}
          className={isDraft ? 'text-danger hover:bg-danger/10' : 'opacity-50 cursor-not-allowed'}
        >
          Delete
        </Button>
      </div>
    </Card>
  );
}

/** Confirmation overlay for deleting an exam. */
function DeleteConfirmDialog({
  examTitle,
  isDeleting,
  error,
  onConfirm,
  onCancel,
}: {
  examTitle: string;
  isDeleting: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <Card className="w-full max-w-md mx-4 shadow-2xl">
        <CardHeader
          icon={<AlertTriangle className="w-6 h-6 text-danger" />}
          title="Delete Exam"
          description="This action cannot be undone."
        />

        <div className="mt-4 space-y-4">
          <p className="text-sm text-text-secondary">
            Are you sure you want to permanently delete{' '}
            <strong className="text-text-primary">"{examTitle}"</strong>? This
            will remove all associated questions.
          </p>

          {error && (
            <Alert variant="error">{error}</Alert>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={onCancel}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={onConfirm}
              isLoading={isDeleting}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              {isDeleting ? 'Deleting...' : 'Delete Exam'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

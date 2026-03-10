/**
 * EditExam Page
 *
 * Allows teachers to edit a draft (non-finalized) exam's metadata
 * and time window settings. Loads the current exam data, presents
 * an editable form, and submits changes via the exams API.
 *
 * Finalized exams cannot be edited; the user is shown a read-only
 * view with an explanation.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DashboardLayout,
  DashboardLoader,
} from '@/components/layout/DashboardLayout';
import { Button, Input, Card, CardHeader, Badge, Alert } from '@/components/ui';
import { examsApi } from '@/lib/api';
import type { ExamResponse } from '@/lib/types';
import {
  ArrowLeft,
  Save,
  BookOpen,
  Clock,
  FileText,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

/** Convert ISO string to datetime-local input value. */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const dt = new Date(iso);
  // datetime-local requires YYYY-MM-DDTHH:mm format
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  const hours = String(dt.getHours()).padStart(2, '0');
  const minutes = String(dt.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/** Format a datetime string for display. */
function formatDateTime(dt: string | null): string {
  if (!dt) return 'Not set';
  return new Date(dt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function EditExam() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  // Loading & error state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Exam data
  const [exam, setExam] = useState<ExamResponse | null>(null);

  // Editable fields
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [gracePeriod, setGracePeriod] = useState(0);

  // Validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /** Load exam data. */
  const loadExam = useCallback(async () => {
    if (!examId) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await examsApi.get(examId);
      setExam(data);

      // Populate form fields
      setTitle(data.title);
      setSubject(data.subject);
      setStartTime(toDatetimeLocal(data.start_time));
      setEndTime(toDatetimeLocal(data.end_time));
      setGracePeriod(data.grace_period_minutes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exam');
    } finally {
      setIsLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    loadExam();
  }, [loadExam]);

  /** Validate form fields. */
  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!title.trim()) {
      errors.title = 'Exam title is required';
    }
    if (!subject.trim()) {
      errors.subject = 'Subject is required';
    }
    if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
      errors.end_time = 'End time must be after start time';
    }
    if (gracePeriod < 0) {
      errors.grace_period = 'Grace period cannot be negative';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /** Submit form changes. */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!examId || !validate()) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updated = await examsApi.update(examId, {
        title: title.trim(),
        subject: subject.trim(),
        start_time: startTime || undefined,
        end_time: endTime || undefined,
        grace_period_minutes: gracePeriod,
      });
      setExam(updated);
      setSuccessMessage('Exam updated successfully');

      // Auto-dismiss success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update exam');
    } finally {
      setIsSaving(false);
    }
  };

  /** Check if any field has changed. */
  const hasChanges =
    exam &&
    (title !== exam.title ||
      subject !== exam.subject ||
      startTime !== toDatetimeLocal(exam.start_time) ||
      endTime !== toDatetimeLocal(exam.end_time) ||
      gracePeriod !== exam.grace_period_minutes);

  return (
    <DashboardLayout
      title="Edit Exam"
      subtitle={exam?.title ?? 'Loading...'}
      headerAction={
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate(-1)}
        >
          Back
        </Button>
      }
    >
      {isLoading ? (
        <DashboardLoader />
      ) : !exam ? (
        <Alert variant="error">Exam not found or you don't have access.</Alert>
      ) : exam.is_finalized ? (
        /* Read-only view for finalized exams */
        <div className="space-y-6">
          <Alert variant="warning">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">This exam is finalized</p>
                <p className="text-sm mt-1">
                  Finalized exams cannot be edited to preserve data integrity
                  for student submissions and grading records.
                </p>
              </div>
            </div>
          </Alert>

          <Card>
            <CardHeader
              icon={<FileText className="w-6 h-6 text-primary" />}
              title="Exam Details"
              description="Read-only view of the finalized exam"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <ReadOnlyField label="Title" value={exam.title} />
              <ReadOnlyField label="Subject" value={exam.subject} />
              <ReadOnlyField label="Class" value={exam.class_name ?? '—'} />
              <ReadOnlyField
                label="Status"
                value={exam.is_published ? 'Published' : 'Finalized'}
              />
              <ReadOnlyField
                label="Start Time"
                value={formatDateTime(exam.start_time)}
              />
              <ReadOnlyField
                label="End Time"
                value={formatDateTime(exam.end_time)}
              />
              <ReadOnlyField
                label="Grace Period"
                value={`${exam.grace_period_minutes} minutes`}
              />
              <ReadOnlyField
                label="Total Marks"
                value={String(exam.total_marks)}
              />
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              <h3 className="text-sm font-medium text-text-secondary mb-3">
                Questions ({exam.questions.length})
              </h3>
              <div className="space-y-2">
                {exam.questions.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant="primary" size="sm">
                        Q{q.question_number}
                      </Badge>
                      <span className="text-sm text-text-primary truncate">
                        {q.text}
                      </span>
                    </div>
                    <Badge variant="warning" size="sm">
                      {q.max_marks} marks
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button
              variant="secondary"
              onClick={() => navigate(-1)}
            >
              Back
            </Button>
          </div>
        </div>
      ) : (
        /* Editable form for draft exams */
        <form onSubmit={handleSave} className="space-y-6">
          {/* Success Message */}
          {successMessage && (
            <Alert variant="success" onDismiss={() => setSuccessMessage(null)}>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {successMessage}
              </div>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Exam Details */}
          <Card className="animate-fade-in">
            <CardHeader
              icon={<BookOpen className="w-6 h-6 text-primary" />}
              title="Exam Details"
              description="Update the exam title and subject"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
              <Input
                label="Exam Title"
                required
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, title: '' }));
                }}
                placeholder="e.g., Mid-Term Examination 2026"
                error={fieldErrors.title}
              />
              <Input
                label="Subject"
                required
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, subject: '' }));
                }}
                placeholder="e.g., Biology, Mathematics"
                error={fieldErrors.subject}
              />
            </div>
          </Card>

          {/* Time Window */}
          <Card className="animate-fade-in">
            <CardHeader
              icon={<Clock className="w-6 h-6 text-secondary" />}
              title="Time Window"
              description="Adjust when the exam becomes available and the deadline"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-bg-input border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                />
                <p className="mt-1 text-xs text-text-muted">
                  Leave empty for immediate availability
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  End Time / Deadline
                </label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, end_time: '' }));
                  }}
                  min={startTime || undefined}
                  className={`w-full px-4 py-2.5 text-sm bg-bg-input border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200 ${
                    fieldErrors.end_time
                      ? 'border-error focus:ring-error'
                      : 'border-border'
                  }`}
                />
                {fieldErrors.end_time && (
                  <p className="mt-1 text-xs text-error">
                    {fieldErrors.end_time}
                  </p>
                )}
                <p className="mt-1 text-xs text-text-muted">
                  Leave empty for no deadline
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Grace Period (minutes)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={gracePeriod}
                  onChange={(e) => {
                    setGracePeriod(parseInt(e.target.value) || 0);
                    setFieldErrors((prev) => ({
                      ...prev,
                      grace_period: '',
                    }));
                  }}
                  className="w-full px-4 py-2.5 text-sm bg-bg-input border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                />
                <p className="mt-1 text-xs text-text-muted">
                  Extra time after deadline
                </p>
              </div>
            </div>
          </Card>

          {/* Questions (read-only for now — editing questions is part of the creation flow) */}
          <Card className="animate-fade-in">
            <CardHeader
              icon={<FileText className="w-6 h-6 text-text-muted" />}
              title={`Questions (${exam.questions.length})`}
              description="Questions are set during creation and cannot be modified after. Create a new exam if questions need to change."
            />

            <div className="mt-4 space-y-2">
              {exam.questions.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="primary" size="sm">
                      Q{q.question_number}
                    </Badge>
                    <span className="text-sm text-text-primary truncate">
                      {q.text}
                    </span>
                  </div>
                  <Badge variant="warning" size="sm">
                    {q.max_marks} marks
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row justify-between gap-4 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSaving}
              disabled={!hasChanges}
              leftIcon={<Save className="w-4 h-4" />}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      )}
    </DashboardLayout>
  );
}

// ============ Helper Components ============

/** Simple read-only field display. */
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-text-primary font-medium">{value}</p>
    </div>
  );
}

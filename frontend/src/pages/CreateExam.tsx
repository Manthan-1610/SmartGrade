/**
 * CreateExam Page
 *
 * Multi-step exam creation flow:
 *   1. Fill out exam form (title, subject, class, time windows, questions)
 *   2. AI verification pass → review rubric
 *   3. Confirm & finalize
 *
 * Supports receiving a `classId` via route state (from ClassDetail "New Exam" button).
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ExamForm } from '@/components/ExamForm';
import { ReviewConfirm } from '@/components/ReviewConfirm';
import { api } from '@/lib/api';
import type { ExamFormData, VerifyTemplateResponse } from '@/lib/types';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Alert } from '@/components/ui';
import { CheckCircle2, ArrowLeft, Plus } from 'lucide-react';

type Step = 'form' | 'review' | 'success';

export function CreateExam() {
  const navigate = useNavigate();
  const location = useLocation();
  const preselectedClassId = (location.state as { classId?: string } | null)?.classId;

  const [step, setStep] = useState<Step>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [examData, setExamData] = useState<ExamFormData | null>(null);
  const [aiRubric, setAiRubric] = useState<VerifyTemplateResponse | null>(null);
  const [savedExamId, setSavedExamId] = useState<string | null>(null);

  const handleFormSubmit = async (data: ExamFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Inject preselected class if not already set
      const payload = preselectedClassId && !data.class_id
        ? { ...data, class_id: preselectedClassId }
        : data;
      const rubric = await api.verifyTemplate(payload);
      setExamData(payload);
      setAiRubric(rubric);
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze exam');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!examData || !aiRubric) return;

    setIsLoading(true);
    setError(null);

    try {
      const saved = await api.finalizeExam(examData, aiRubric.questions);
      setSavedExamId(saved.id);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save exam');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep('form');
  };

  const handleCreateAnother = () => {
    setStep('form');
    setExamData(null);
    setAiRubric(null);
    setSavedExamId(null);
    setError(null);
  };

  /* ---------- Step Labels ---------- */

  const steps = [
    { label: '1. Create Template', key: 'form' },
    { label: '2. Review AI Rubric', key: 'review' },
    { label: '3. Finalized', key: 'success' },
  ] as const;

  const stepIdx = steps.findIndex((s) => s.key === step);

  return (
    <DashboardLayout
      title="Create Exam"
      subtitle="Build an AI-verified exam template"
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
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm">
          {steps.map((s, idx) => (
            <div key={s.key} className="flex items-center gap-2">
              {idx > 0 && <span className="text-text-muted">&rarr;</span>}
              <span
                className={`px-3 py-1 rounded-full transition-colors ${
                  idx === stepIdx
                    ? 'bg-primary text-white'
                    : idx < stepIdx
                      ? 'bg-success/20 text-success'
                      : 'bg-bg-card text-text-muted'
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Step Content */}
      {step === 'form' && (
        <ExamForm onSubmit={handleFormSubmit} isLoading={isLoading} />
      )}

      {step === 'review' && examData && aiRubric && (
        <ReviewConfirm
          examData={examData}
          aiRubric={aiRubric}
          onConfirm={handleConfirm}
          onBack={handleBack}
          isLoading={isLoading}
        />
      )}

      {step === 'success' && (
        <div className="rounded-xl border border-border bg-bg-card p-6 shadow-lg text-center py-12 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-success/20 rounded-full mb-6">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-2xl font-semibold text-text-primary mb-2">
            Exam Created Successfully!
          </h2>
          <p className="text-text-secondary mb-6">
            Your exam template has been finalized and saved.
          </p>
          {savedExamId && (
            <p className="text-sm text-text-muted mb-6">
              Exam ID:{' '}
              <code className="bg-bg-secondary px-2 py-1 rounded">{savedExamId}</code>
            </p>
          )}
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate(preselectedClassId ? `/classes/${preselectedClassId}` : '/dashboard')}
            >
              {preselectedClassId ? 'Back to Class' : 'Go to Dashboard'}
            </Button>
            <Button leftIcon={<Plus className="w-4 h-4" />} onClick={handleCreateAnother}>
              Create Another Exam
            </Button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

import { useState } from 'react';
import { ExamForm } from '@/components/ExamForm';
import { ReviewConfirm } from '@/components/ReviewConfirm';
import { api } from '@/lib/api';
import type { ExamFormData, VerifyTemplateResponse } from '@/lib/types';
import { CheckCircle2, GraduationCap } from 'lucide-react';

type Step = 'form' | 'review' | 'success';

export function CreateExam() {
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
      const rubric = await api.verifyTemplate(data);
      setExamData(data);
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

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-bg-secondary/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">SmartGrade</h1>
              <p className="text-sm text-text-secondary">
                AI-Powered Exam Grading
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="bg-bg-secondary border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span className={`px-3 py-1 rounded-full ${
              step === 'form' 
                ? 'bg-primary text-white' 
                : 'bg-success/20 text-success'
            }`}>
              1. Create Template
            </span>
            <span className="text-text-muted">&rarr;</span>
            <span className={`px-3 py-1 rounded-full ${
              step === 'review' 
                ? 'bg-primary text-white' 
                : step === 'success'
                  ? 'bg-success/20 text-success'
                  : 'bg-bg-card text-text-muted'
            }`}>
              2. Review AI Rubric
            </span>
            <span className="text-text-muted">&rarr;</span>
            <span className={`px-3 py-1 rounded-full ${
              step === 'success' 
                ? 'bg-success text-white' 
                : 'bg-bg-card text-text-muted'
            }`}>
              3. Finalized
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-danger/10 border border-danger/30 rounded-lg text-danger">
            {error}
          </div>
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
          <div className="rounded-xl border border-border bg-bg-card p-6 shadow-lg text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-success/20 rounded-full mb-6">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Exam Created Successfully!</h2>
            <p className="text-text-secondary mb-6">
              Your exam template has been finalized and saved.
            </p>
            {savedExamId && (
              <p className="text-sm text-text-muted mb-6">
                Exam ID: <code className="bg-bg-secondary px-2 py-1 rounded">{savedExamId}</code>
              </p>
            )}
            <button
              onClick={handleCreateAnother}
              className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-primary bg-primary text-white hover:bg-primary-dark focus:ring-primary"
            >
              Create Another Exam
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

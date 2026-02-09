import { useState, useEffect } from 'react';
import { ImageCapture } from '@/components/ImageCapture';
import { VerificationUI } from '@/components/VerificationUI';
import { api } from '@/lib/api';
import type { 
  ExamResponse, 
  ExamListItem,
  ExtractedAnswer, 
  VerifiedAnswer 
} from '@/lib/types';
import { 
  GraduationCap, 
  CheckCircle2, 
  Upload,
  FileText,
  ArrowLeft,
  User
} from 'lucide-react';

type Step = 'select-exam' | 'capture' | 'verify' | 'success';

export function SubmitExam() {
  const [step, setStep] = useState<Step>('select-exam');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Data
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [selectedExam, setSelectedExam] = useState<ExamResponse | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  
  // Submission data
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [extractedAnswers, setExtractedAnswers] = useState<ExtractedAnswer[]>([]);
  const [imageUrl, setImageUrl] = useState<string>('');

  // Load exams on mount
  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    try {
      const data = await api.getExams();
      // Only show finalized exams
      setExams(data.filter(e => e.is_finalized));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exams');
    }
  };

  const handleSelectExam = async (examId: string) => {
    setIsLoading(true);
    try {
      const exam = await api.getExam(examId);
      setSelectedExam(exam);
      setStep('capture');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exam');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelect = async (file: File) => {
    if (!selectedExam) return;

    setIsLoading(true);
    setError(null);
    setProgress(0);

    try {
      const result = await api.digitizeSubmission(
        selectedExam.id,
        file,
        studentName || undefined,
        studentId || undefined,
        setProgress
      );

      setSubmissionId(result.submission_id);
      setExtractedAnswers(result.answers);
      setImageUrl(api.getSubmissionImageUrl(result.submission_id, 'original'));
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image');
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };

  const handleVerify = async (answers: VerifiedAnswer[]) => {
    if (!submissionId) return;

    setIsLoading(true);
    setError(null);

    try {
      await api.verifySubmission(submissionId, answers);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save verification');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'capture') {
      setSelectedExam(null);
      setStep('select-exam');
    } else if (step === 'verify') {
      setStep('capture');
    }
  };

  const handleNewSubmission = () => {
    setStep('select-exam');
    setSelectedExam(null);
    setSubmissionId(null);
    setExtractedAnswers([]);
    setImageUrl('');
    setStudentName('');
    setStudentId('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-bg-secondary/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">SmartGrade</h1>
                <p className="text-sm text-text-secondary">
                  Submit & Digitize Papers
                </p>
              </div>
            </div>

            {step !== 'select-exam' && step !== 'success' && (
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="bg-bg-secondary border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm overflow-x-auto">
            <span className={`px-3 py-1 rounded-full whitespace-nowrap ${
              step === 'select-exam' 
                ? 'bg-primary text-white' 
                : 'bg-success/20 text-success'
            }`}>
              1. Select Exam
            </span>
            <span className="text-text-muted">&rarr;</span>
            <span className={`px-3 py-1 rounded-full whitespace-nowrap ${
              step === 'capture' 
                ? 'bg-primary text-white' 
                : step === 'verify' || step === 'success'
                  ? 'bg-success/20 text-success'
                  : 'bg-bg-card text-text-muted'
            }`}>
              2. Upload Image
            </span>
            <span className="text-text-muted">&rarr;</span>
            <span className={`px-3 py-1 rounded-full whitespace-nowrap ${
              step === 'verify' 
                ? 'bg-primary text-white' 
                : step === 'success'
                  ? 'bg-success/20 text-success'
                  : 'bg-bg-card text-text-muted'
            }`}>
              3. Verify Text
            </span>
            <span className="text-text-muted">&rarr;</span>
            <span className={`px-3 py-1 rounded-full whitespace-nowrap ${
              step === 'success' 
                ? 'bg-success text-white' 
                : 'bg-bg-card text-text-muted'
            }`}>
              4. Complete
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-danger/10 border border-danger/30 rounded-lg text-danger">
            {error}
          </div>
        )}

        {/* Step: Select Exam */}
        {step === 'select-exam' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-bg-card p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Select Exam</h2>
                  <p className="text-sm text-text-secondary">
                    Choose an exam to submit a student paper
                  </p>
                </div>
              </div>

              {exams.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-text-muted mx-auto mb-4" />
                  <p className="text-text-secondary">
                    No finalized exams found.
                  </p>
                  <p className="text-sm text-text-muted">
                    Create and finalize an exam template first.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {exams.map((exam) => (
                    <button
                      key={exam.id}
                      onClick={() => handleSelectExam(exam.id)}
                      disabled={isLoading}
                      className="text-left p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all group"
                    >
                      <h3 className="font-medium text-text-primary group-hover:text-primary">
                        {exam.title}
                      </h3>
                      <p className="text-sm text-text-secondary mt-1">
                        {exam.subject}
                      </p>
                      <div className="flex items-center gap-3 mt-3 text-xs text-text-muted">
                        <span>{exam.question_count} questions</span>
                        <span>•</span>
                        <span>{exam.total_marks} marks</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step: Capture */}
        {step === 'capture' && selectedExam && (
          <div className="space-y-6">
            {/* Exam Info */}
            <div className="rounded-xl border border-border bg-bg-card p-6 shadow-lg">
              <h2 className="text-lg font-semibold mb-1">{selectedExam.title}</h2>
              <p className="text-sm text-text-secondary">
                {selectedExam.subject} • {selectedExam.questions.length} questions • {selectedExam.total_marks} marks
              </p>
            </div>

            {/* Student Info (Optional) */}
            <div className="rounded-xl border border-border bg-bg-card p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <User className="w-5 h-5 text-text-muted" />
                <h3 className="font-medium">Student Information (Optional)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    Student Name
                  </label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Enter student name"
                    className="w-full rounded-lg border border-border bg-bg-input px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus/20 transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    Student ID / Roll Number
                  </label>
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="Enter student ID"
                    className="w-full rounded-lg border border-border bg-bg-input px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus/20 transition-all duration-200"
                  />
                </div>
              </div>
            </div>

            {/* Image Capture */}
            <div className="rounded-xl border border-border bg-bg-card p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-secondary/20 rounded-lg">
                  <Upload className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Upload Answer Sheet</h2>
                  <p className="text-sm text-text-secondary">
                    Upload a clear photo of the handwritten exam paper
                  </p>
                </div>
              </div>

              <ImageCapture
                onImageSelect={handleImageSelect}
                isProcessing={isLoading}
                progress={progress}
              />
            </div>
          </div>
        )}

        {/* Step: Verify */}
        {step === 'verify' && selectedExam && (
          <div className="space-y-6">
            {/* Exam Info */}
            <div className="rounded-xl border border-border bg-bg-card p-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">{selectedExam.title}</h2>
                  <p className="text-sm text-text-secondary">
                    {studentName || 'Unknown Student'} {studentId && `(${studentId})`}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-warning/20 text-warning">
                  Pending Verification
                </span>
              </div>
            </div>

            {/* Verification UI */}
            <VerificationUI
              imageUrl={imageUrl}
              exam={selectedExam}
              extractedAnswers={extractedAnswers}
              onVerify={handleVerify}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className="rounded-xl border border-border bg-bg-card p-6 shadow-lg text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-success/20 rounded-full mb-6">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Submission Verified!</h2>
            <p className="text-text-secondary mb-6">
              The student's answers have been extracted and verified.
            </p>
            {submissionId && (
              <p className="text-sm text-text-muted mb-6">
                Submission ID: <code className="bg-bg-secondary px-2 py-1 rounded">{submissionId}</code>
              </p>
            )}
            <button
              onClick={handleNewSubmission}
              className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-primary bg-primary text-white hover:bg-primary-dark focus:ring-primary"
            >
              Submit Another Paper
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

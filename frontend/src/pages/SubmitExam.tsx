/**
 * SubmitExam Page
 * 
 * Student exam submission flow:
 * 1. Select exam → 2. Upload image/PDF → 3. Verify extracted text → 4. Success with receipt
 * 
 * Features:
 * - Countdown timer with server time sync
 * - Support for JPG, PNG, and PDF uploads
 * - Digital receipt for submission verification
 */
import { useState, useEffect } from 'react';
import { ImageCapture } from '@/components/ImageCapture';
import { VerificationUI } from '@/components/VerificationUI';
import { CountdownTimer } from '@/components/CountdownTimer';
import { api, examsApi } from '@/lib/api';
import type { 
  ExamResponse, 
  ExamListItem,
  ExamTimeInfo,
  ExtractedAnswer, 
  VerifiedAnswer 
} from '@/lib/types';
import { 
  GraduationCap, 
  CheckCircle2, 
  Upload,
  FileText,
  ArrowLeft,
  User,
  Copy,
  Check,
  Shield
} from 'lucide-react';
import { Alert } from '@/components/ui';

type Step = 'select-exam' | 'capture' | 'verify' | 'success';

export function SubmitExam() {
  const [step, setStep] = useState<Step>('select-exam');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Data
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [selectedExam, setSelectedExam] = useState<ExamResponse | null>(null);
  const [timeInfo, setTimeInfo] = useState<ExamTimeInfo | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  
  // Submission data
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [digitalReceipt, setDigitalReceipt] = useState<string | null>(null);
  const [extractedAnswers, setExtractedAnswers] = useState<ExtractedAnswer[]>([]);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Load exams on mount
  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    try {
      // Use student endpoint to get exams from enrolled classes
      const data = await examsApi.listStudent();
      // Only show finalized exams
      setExams(data.filter(e => e.is_finalized));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exams');
    }
  };

  const handleSelectExam = async (examId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch exam details and time info in parallel
      const [exam, timeInfoData] = await Promise.all([
        api.getExam(examId),
        examsApi.getTimeInfo(examId),
      ]);
      
      setSelectedExam(exam);
      setTimeInfo(timeInfoData);
      
      // Check if exam is open
      if (timeInfoData.is_expired) {
        setError('This exam has ended. You cannot submit anymore.');
        return;
      }
      
      if (!timeInfoData.is_open) {
        setError('This exam has not started yet. Please wait until the scheduled time.');
        return;
      }
      
      setStep('capture');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exam');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeExpired = () => {
    setError('Time has expired! You can no longer submit.');
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
      // The API should return a digital_receipt_hash after creating the submission
      if ('digital_receipt_hash' in result) {
        setDigitalReceipt((result as { digital_receipt_hash?: string }).digital_receipt_hash || null);
      }
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
      const response = await api.verifySubmission(submissionId, answers);
      // Get digital receipt from response
      if ('digital_receipt_hash' in response) {
        setDigitalReceipt((response as { digital_receipt_hash?: string }).digital_receipt_hash || null);
      }
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
      setTimeInfo(null);
      setStep('select-exam');
    } else if (step === 'verify') {
      setStep('capture');
    }
  };

  const handleNewSubmission = () => {
    setStep('select-exam');
    setSelectedExam(null);
    setTimeInfo(null);
    setSubmissionId(null);
    setDigitalReceipt(null);
    setExtractedAnswers([]);
    setImageUrl('');
    setStudentName('');
    setStudentId('');
    setError(null);
  };

  const copyReceipt = async () => {
    if (digitalReceipt) {
      await navigator.clipboard.writeText(digitalReceipt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
              2. Upload
            </span>
            <span className="text-text-muted">&rarr;</span>
            <span className={`px-3 py-1 rounded-full whitespace-nowrap ${
              step === 'verify' 
                ? 'bg-primary text-white' 
                : step === 'success'
                  ? 'bg-success/20 text-success'
                  : 'bg-bg-card text-text-muted'
            }`}>
              3. Verify
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
          <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
            {error}
          </Alert>
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
                    Choose an exam to submit your answer sheet
                  </p>
                </div>
              </div>

              {exams.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-text-muted mx-auto mb-4" />
                  <p className="text-text-secondary">
                    No exams available for submission.
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
                        {exam.end_time && (
                          <>
                            <span>•</span>
                            <span>Due: {new Date(exam.end_time).toLocaleDateString()}</span>
                          </>
                        )}
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
            {/* Countdown Timer */}
            {timeInfo && timeInfo.effective_deadline && (
              <CountdownTimer
                deadline={timeInfo.effective_deadline}
                gracePeriodMinutes={timeInfo.grace_period_minutes}
                serverTime={timeInfo.server_time}
                hasExtension={timeInfo.has_extension}
                onExpired={handleTimeExpired}
              />
            )}

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
                    Upload a clear photo (.jpg, .png) or PDF of your handwritten exam paper
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
            {/* Timer (still visible during verification) */}
            {timeInfo && timeInfo.effective_deadline && (
              <CountdownTimer
                deadline={timeInfo.effective_deadline}
                gracePeriodMinutes={timeInfo.grace_period_minutes}
                serverTime={timeInfo.server_time}
                hasExtension={timeInfo.has_extension}
                onExpired={handleTimeExpired}
              />
            )}

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
              Your answers have been extracted and submitted successfully.
            </p>
            
            {/* Digital Receipt */}
            <div className="max-w-md mx-auto mb-6">
              <div className="flex items-center gap-2 justify-center mb-3">
                <Shield className="w-5 h-5 text-primary" />
                <span className="font-medium text-text-primary">Digital Receipt</span>
              </div>
              <p className="text-sm text-text-secondary mb-3">
                Keep this receipt as proof of your submission. It can be used to verify your submission later.
              </p>
              
              {submissionId && (
                <div className="bg-bg-secondary p-4 rounded-lg border border-border">
                  <p className="text-xs text-text-muted mb-2">Submission ID:</p>
                  <code className="text-sm text-text-primary break-all">
                    {submissionId}
                  </code>
                </div>
              )}
              
              {digitalReceipt && (
                <div className="mt-4 bg-bg-secondary p-4 rounded-lg border border-border">
                  <p className="text-xs text-text-muted mb-2">Receipt Hash (SHA-256):</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-text-primary break-all flex-1 text-left">
                      {digitalReceipt}
                    </code>
                    <button
                      onClick={copyReceipt}
                      className="p-2 hover:bg-bg-hover rounded-lg transition-colors"
                      title="Copy receipt"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-success" />
                      ) : (
                        <Copy className="w-4 h-4 text-text-muted" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
            
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

/**
 * ExamForm Component
 * 
 * Dynamic form for creating exam templates with multiple questions.
 * Requires selecting a class for the exam to be assigned to.
 * Handles validation and submission to AI verification.
 */
import { useState, useCallback, useEffect } from 'react';
import { Plus, Sparkles, BookOpen, GraduationCap, Clock } from 'lucide-react';
import { QuestionCard } from './QuestionCard';
import { Card, CardHeader, Button, Input, Badge, Alert } from '@/components/ui';
import { generateId } from '@/lib/utils';
import { classesApi } from '@/lib/api';
import type { ExamFormData, QuestionFormData, ValidationError, ClassResponse } from '@/lib/types';

interface ExamFormProps {
  /** Callback when form is submitted with valid data */
  onSubmit: (data: ExamFormData) => void;
  /** Whether the form is currently processing */
  isLoading: boolean;
  /** Pre-selected class ID (from navigation state) */
  preselectedClassId?: string;
}

function createEmptyQuestion(questionNumber: number): QuestionFormData {
  return {
    id: generateId(),
    question_number: String(questionNumber),
    text: '',
    max_marks: 0,
    ideal_answer: '',
  };
}

export function ExamForm({ onSubmit, isLoading, preselectedClassId }: ExamFormProps) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [classId, setClassId] = useState(preselectedClassId ?? '');
  const [questions, setQuestions] = useState<QuestionFormData[]>([
    createEmptyQuestion(1),
  ]);
  const [errors, setErrors] = useState<ValidationError[]>([]);

  // Time window fields
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [gracePeriod, setGracePeriod] = useState(5);

  // Class data for dropdown
  const [classes, setClasses] = useState<ClassResponse[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [classError, setClassError] = useState<string | null>(null);

  // Load teacher's classes
  useEffect(() => {
    const loadClasses = async () => {
      setIsLoadingClasses(true);
      setClassError(null);
      try {
        const data = await classesApi.listTeaching();
        setClasses(data);
        // If preselectedClassId is provided, verify it exists
        if (preselectedClassId && !data.find(c => c.id === preselectedClassId)) {
          setClassError('Pre-selected class not found');
          setClassId('');
        }
      } catch (err) {
        setClassError(err instanceof Error ? err.message : 'Failed to load classes');
      } finally {
        setIsLoadingClasses(false);
      }
    };
    loadClasses();
  }, [preselectedClassId]);

  const totalMarks = questions.reduce((sum, q) => sum + (q.max_marks || 0), 0);

  const addQuestion = useCallback(() => {
    const newQuestion = createEmptyQuestion(questions.length + 1);
    setQuestions(prev => [...prev, newQuestion]);
  }, [questions.length]);

  const updateQuestion = useCallback((index: number, updated: QuestionFormData) => {
    setQuestions(prev => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  }, []);

  const deleteQuestion = useCallback((index: number) => {
    setQuestions(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: ValidationError[] = [];

    if (!title.trim()) {
      newErrors.push({ field: 'title', message: 'Exam title is required' });
    }

    if (!subject.trim()) {
      newErrors.push({ field: 'subject', message: 'Subject is required' });
    }

    if (!classId) {
      newErrors.push({ field: 'class_id', message: 'Please select a class for this exam' });
    }

    questions.forEach((q, index) => {
      const qLabel = q.question_number.trim() || `#${index + 1}`;
      
      if (!q.question_number.trim()) {
        newErrors.push({ 
          field: `question_${index}_number`, 
          message: `Question ${index + 1}: Question number is required` 
        });
      }
      if (!q.text.trim()) {
        newErrors.push({ 
          field: `question_${index}_text`, 
          message: `Question ${qLabel}: Text is required` 
        });
      }
      if (q.max_marks <= 0) {
        newErrors.push({ 
          field: `question_${index}_marks`, 
          message: `Question ${qLabel}: Marks must be positive` 
        });
      }
      if (!q.ideal_answer.trim()) {
        newErrors.push({ 
          field: `question_${index}_answer`, 
          message: `Question ${qLabel}: Ideal answer is required` 
        });
      }
    });

    setErrors(newErrors);
    return newErrors.length === 0;
  }, [title, subject, classId, questions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      // Scroll to error display
      document.getElementById('error-summary')?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'center' 
      });
      return;
    }

    onSubmit({
      title: title.trim(),
      subject: subject.trim(),
      class_id: classId,
      start_time: startTime || undefined,
      end_time: endTime || undefined,
      grace_period_minutes: gracePeriod,
      questions,
    });
  };

  const selectedClass = classes.find(c => c.id === classId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Class Selection */}
      <Card className="animate-fade-in">
        <CardHeader
          icon={<GraduationCap className="w-6 h-6 text-primary" />}
          title="Select Class"
          description="Choose the class this exam is for"
        />

        {classError && (
          <Alert variant="error" className="mt-4">
            {classError}
          </Alert>
        )}

        {isLoadingClasses ? (
          <div className="mt-4 flex items-center gap-3 text-text-secondary">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Loading classes...
          </div>
        ) : classes.length === 0 ? (
          <Alert variant="warning" className="mt-4">
            No classes found. Please create a class first before creating an exam.
          </Alert>
        ) : (
          <div className="mt-4">
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Class <span className="text-error">*</span>
            </label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              disabled={!!preselectedClassId && classes.find(c => c.id === preselectedClassId) !== undefined}
              className={`
                w-full px-4 py-2.5 text-sm bg-bg-input border rounded-lg
                text-text-primary focus:outline-none focus:ring-2 focus:ring-primary
                transition-all duration-200
                ${errors.find(e => e.field === 'class_id') 
                  ? 'border-error focus:ring-error' 
                  : 'border-border focus:border-primary'}
                ${preselectedClassId ? 'bg-bg-elevated cursor-not-allowed' : ''}
              `}
            >
              <option value="">Select a class...</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} ({cls.student_count} students)
                </option>
              ))}
            </select>
            {errors.find(e => e.field === 'class_id') && (
              <p className="mt-1.5 text-sm text-error">
                {errors.find(e => e.field === 'class_id')?.message}
              </p>
            )}
            {selectedClass && (
              <p className="mt-2 text-sm text-text-muted">
                {selectedClass.student_count} enrolled students will receive this exam
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Header Info */}
      <Card className="animate-fade-in">
        <CardHeader
          icon={<BookOpen className="w-6 h-6 text-primary" />}
          title="Exam Details"
          description="Define your exam title and subject"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
          <Input
            label="Exam Title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Mid-Term Examination 2026"
            error={errors.find(e => e.field === 'title')?.message}
          />
          <Input
            label="Subject"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g., Biology, Mathematics"
            error={errors.find(e => e.field === 'subject')?.message}
          />
        </div>
      </Card>

      {/* Time Window */}
      <Card className="animate-fade-in">
        <CardHeader
          icon={<Clock className="w-6 h-6 text-secondary" />}
          title="Time Window (Optional)"
          description="Set when the exam becomes available and the deadline"
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
              onChange={(e) => setEndTime(e.target.value)}
              min={startTime || undefined}
              className="w-full px-4 py-2.5 text-sm bg-bg-input border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
            />
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
              onChange={(e) => setGracePeriod(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2.5 text-sm bg-bg-input border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
            />
            <p className="mt-1 text-xs text-text-muted">
              Extra time after deadline
            </p>
          </div>
        </div>
      </Card>

      {/* Questions Section */}
      <section aria-labelledby="questions-heading">
        <div className="flex items-center justify-between mb-4">
          <h2 id="questions-heading" className="text-xl font-semibold">
            Questions
          </h2>
          <Badge variant="warning" size="md">
            Total: {totalMarks} marks
          </Badge>
        </div>

        <div className="space-y-4">
          {questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              question={question}
              onChange={(updated) => updateQuestion(index, updated)}
              onDelete={() => deleteQuestion(index)}
              canDelete={questions.length > 1}
              animationDelay={`stagger-${Math.min(index + 1, 5)}`}
            />
          ))}

          <button
            type="button"
            onClick={addQuestion}
            className="
              w-full py-4 border-2 border-dashed border-border rounded-xl
              text-text-secondary hover:text-primary hover:border-primary
              transition-all duration-200 flex items-center justify-center gap-2
              focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
              focus:ring-offset-bg-primary
            "
          >
            <Plus className="w-5 h-5" aria-hidden="true" />
            <span>Add Question</span>
          </button>
        </div>
      </section>

      {/* Error Summary */}
      {errors.length > 0 && (
        <Alert
          id="error-summary"
          variant="error"
          title={`Please fix ${errors.length} error${errors.length > 1 ? 's' : ''}`}
        >
          <ul className="list-disc list-inside space-y-1 mt-2">
            {errors.map((error, index) => (
              <li key={index}>{error.message}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Submit */}
      <div className="flex justify-end pt-4">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          disabled={classes.length === 0}
          leftIcon={<Sparkles className="w-5 h-5" aria-hidden="true" />}
        >
          {isLoading ? 'Analyzing with AI...' : 'Generate AI Rubric'}
        </Button>
      </div>
    </form>
  );
}

/**
 * ExamForm Component
 * 
 * Dynamic form for creating exam templates with multiple questions.
 * Handles validation and submission to AI verification.
 */
import { useState, useCallback } from 'react';
import { Plus, Sparkles, BookOpen } from 'lucide-react';
import { QuestionCard } from './QuestionCard';
import { Card, CardHeader, Button, Input, Badge, Alert } from '@/components/ui';
import { generateId } from '@/lib/utils';
import type { ExamFormData, QuestionFormData, ValidationError } from '@/lib/types';

interface ExamFormProps {
  /** Callback when form is submitted with valid data */
  onSubmit: (data: ExamFormData) => void;
  /** Whether the form is currently processing */
  isLoading: boolean;
}

function createEmptyQuestion(questionNumber: number): QuestionFormData {
  return {
    id: generateId(),
    question_number: questionNumber,
    text: '',
    max_marks: 0,
    ideal_answer: '',
  };
}

export function ExamForm({ onSubmit, isLoading }: ExamFormProps) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [questions, setQuestions] = useState<QuestionFormData[]>([
    createEmptyQuestion(1),
  ]);
  const [errors, setErrors] = useState<ValidationError[]>([]);

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
      return prev
        .filter((_, i) => i !== index)
        .map((q, i) => ({ ...q, question_number: i + 1 }));
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

    questions.forEach((q) => {
      if (!q.text.trim()) {
        newErrors.push({ 
          field: `question_${q.question_number}_text`, 
          message: `Question ${q.question_number}: Text is required` 
        });
      }
      if (q.max_marks <= 0) {
        newErrors.push({ 
          field: `question_${q.question_number}_marks`, 
          message: `Question ${q.question_number}: Marks must be positive` 
        });
      }
      if (!q.ideal_answer.trim()) {
        newErrors.push({ 
          field: `question_${q.question_number}_answer`, 
          message: `Question ${q.question_number}: Ideal answer is required` 
        });
      }
    });

    setErrors(newErrors);
    return newErrors.length === 0;
  }, [title, subject, questions]);

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
      questions,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
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
          leftIcon={<Sparkles className="w-5 h-5" aria-hidden="true" />}
        >
          {isLoading ? 'Analyzing with AI...' : 'Generate AI Rubric'}
        </Button>
      </div>
    </form>
  );
}

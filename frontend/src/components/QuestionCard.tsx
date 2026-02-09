/**
 * QuestionCard Component
 * 
 * Displays and edits a single exam question with marks and ideal answer.
 * Used in the exam template creation flow.
 */
import { memo } from 'react';
import { Trash2, GripVertical } from 'lucide-react';
import { Input, Textarea, Badge, Button } from '@/components/ui';
import type { QuestionFormData } from '@/lib/types';

interface QuestionCardProps {
  /** Question data to display/edit */
  question: QuestionFormData;
  /** Callback when question data changes */
  onChange: (question: QuestionFormData) => void;
  /** Callback when delete button is clicked */
  onDelete: () => void;
  /** Whether the delete button should be enabled */
  canDelete: boolean;
  /** Animation delay class for staggered animations */
  animationDelay?: string;
}

export const QuestionCard = memo(function QuestionCard({ 
  question, 
  onChange, 
  onDelete, 
  canDelete,
  animationDelay = ''
}: QuestionCardProps) {
  const handleChange = (
    field: keyof QuestionFormData, 
    value: string | number
  ) => {
    onChange({ ...question, [field]: value });
  };

  return (
    <article
      className={`
        rounded-xl border border-border bg-bg-card p-6 shadow-lg
        animate-fade-in transition-all duration-200
        hover:border-border-light hover:shadow-xl
        ${animationDelay}
      `}
      aria-label={`Question ${question.question_number}`}
    >
      {/* Header */}
      <header className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="p-1 text-text-muted hover:text-text-secondary cursor-grab active:cursor-grabbing"
            aria-label="Drag to reorder"
            tabIndex={-1}
          >
            <GripVertical className="w-5 h-5" aria-hidden="true" />
          </button>
          <Badge variant="primary">
            Question {question.question_number}
          </Badge>
        </div>
        
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            aria-label={`Delete question ${question.question_number}`}
            className="text-text-muted hover:text-danger hover:bg-danger/10"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </Button>
        )}
      </header>

      {/* Question Text */}
      <div className="mb-5">
        <Textarea
          label="Question Text"
          required
          value={question.text}
          onChange={(e) => handleChange('text', e.target.value)}
          placeholder="Enter your question here..."
          rows={2}
        />
      </div>

      {/* Marks and Ideal Answer Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* Max Marks */}
        <div>
          <Input
            label="Max Marks"
            required
            type="number"
            min={1}
            value={question.max_marks || ''}
            onChange={(e) => handleChange('max_marks', parseInt(e.target.value) || 0)}
            placeholder="5"
          />
        </div>

        {/* Ideal Answer */}
        <div className="md:col-span-3">
          <Textarea
            label="Ideal Answer"
            required
            value={question.ideal_answer}
            onChange={(e) => handleChange('ideal_answer', e.target.value)}
            placeholder="The expected correct answer for grading reference..."
            rows={3}
          />
        </div>
      </div>
    </article>
  );
});

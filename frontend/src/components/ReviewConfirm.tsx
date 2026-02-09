/**
 * ReviewConfirm Component
 * 
 * Displays AI-generated rubric alongside teacher's original input.
 * Allows teacher to review and confirm before finalizing.
 */
import { useState, memo } from 'react';
import { 
  CheckCircle2, 
  ArrowLeft, 
  Lightbulb, 
  ChevronDown, 
  ChevronUp,
  Award,
  Target
} from 'lucide-react';
import { Card, CardHeader, Badge, Button, Alert } from '@/components/ui';
import type { 
  ExamFormData, 
  VerifyTemplateResponse, 
  AIQuestionRubric 
} from '@/lib/types';

interface ReviewConfirmProps {
  /** Original exam data from form */
  examData: ExamFormData;
  /** AI-generated rubric */
  aiRubric: VerifyTemplateResponse;
  /** Callback when teacher confirms */
  onConfirm: () => void;
  /** Callback to go back to editing */
  onBack: () => void;
  /** Loading state */
  isLoading: boolean;
}

interface QuestionReviewCardProps {
  questionNumber: number;
  originalText: string;
  originalAnswer: string;
  maxMarks: number;
  aiRubric: AIQuestionRubric | undefined;
  isInitiallyExpanded?: boolean;
}

const QuestionReviewCard = memo(function QuestionReviewCard({ 
  questionNumber, 
  originalText, 
  originalAnswer, 
  maxMarks,
  aiRubric,
  isInitiallyExpanded = false
}: QuestionReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);

  return (
    <Card padding="none" className="overflow-hidden animate-fade-in">
      {/* Header - Always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls={`question-${questionNumber}-content`}
        className="
          w-full flex items-center justify-between p-4 
          hover:bg-bg-hover/50 transition-colors
          focus:outline-none focus:bg-bg-hover/50
        "
      >
        <div className="flex items-center gap-3">
          <Badge variant="primary">Q{questionNumber}</Badge>
          <span className="font-medium text-text-primary text-left truncate max-w-[200px] md:max-w-[400px]">
            {originalText}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="warning">{maxMarks} marks</Badge>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-text-muted" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-5 h-5 text-text-muted" aria-hidden="true" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div 
          id={`question-${questionNumber}-content`}
          className="px-4 pb-4 space-y-4 animate-fade-in"
        >
          {/* Original Question */}
          <div className="p-4 bg-bg-secondary rounded-lg">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
              Your Question
            </p>
            <p className="text-text-primary">{originalText}</p>
          </div>

          {/* Original Answer */}
          <div className="p-4 bg-bg-secondary rounded-lg">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
              Ideal Answer
            </p>
            <p className="text-text-primary whitespace-pre-wrap">{originalAnswer}</p>
          </div>

          {/* AI Interpretation */}
          {aiRubric && (
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Target className="w-5 h-5" aria-hidden="true" />
                <span className="font-semibold">AI Grading Strategy</span>
              </div>

              {/* Key Concepts */}
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                  Key Concepts to Verify
                </p>
                <div className="flex flex-wrap gap-2">
                  {aiRubric.key_concepts.map((concept, idx) => (
                    <Badge key={idx} variant="success">
                      {concept}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Grading Criteria */}
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                  Grading Criteria
                </p>
                <p className="text-text-primary text-sm leading-relaxed">
                  {aiRubric.grading_criteria}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
});

export function ReviewConfirm({ 
  examData, 
  aiRubric, 
  onConfirm, 
  onBack,
  isLoading 
}: ReviewConfirmProps) {
  const aiRubricMap = new Map(
    aiRubric.questions.map(r => [r.question_number, r])
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="animate-fade-in">
        <CardHeader
          icon={<Award className="w-6 h-6 text-success" />}
          title="Review AI Rubric"
          description="Verify the AI's interpretation before finalizing"
        />

        {/* Exam Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 p-4 bg-bg-secondary rounded-lg">
          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
              Title
            </p>
            <p className="font-semibold mt-1 truncate">{examData.title}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
              Subject
            </p>
            <p className="font-semibold mt-1">{examData.subject}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
              Questions
            </p>
            <p className="font-semibold mt-1">{examData.questions.length}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
              Total Marks
            </p>
            <p className="font-semibold mt-1 text-primary">{aiRubric.total_marks}</p>
          </div>
        </div>
      </Card>

      {/* AI Suggestions */}
      {aiRubric.suggestions.length > 0 && (
        <Alert variant="warning" title="AI Suggestions" className="animate-slide-in">
          <ul className="space-y-1 mt-2">
            {aiRubric.suggestions.map((suggestion, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Questions Review */}
      <section aria-labelledby="rubrics-heading">
        <h3 id="rubrics-heading" className="text-lg font-semibold mb-4">
          Question Rubrics
        </h3>
        
        <div className="space-y-3">
          {examData.questions
            .sort((a, b) => a.question_number - b.question_number)
            .map((question, index) => (
              <QuestionReviewCard
                key={question.id}
                questionNumber={question.question_number}
                originalText={question.text}
                originalAnswer={question.ideal_answer}
                maxMarks={question.max_marks}
                aiRubric={aiRubricMap.get(question.question_number)}
                isInitiallyExpanded={index === 0}
              />
            ))}
        </div>
      </section>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row justify-between gap-4 pt-6 border-t border-border">
        <Button
          type="button"
          variant="secondary"
          onClick={onBack}
          disabled={isLoading}
          leftIcon={<ArrowLeft className="w-4 h-4" aria-hidden="true" />}
        >
          Edit Questions
        </Button>

        <Button
          type="button"
          variant="success"
          size="lg"
          onClick={onConfirm}
          isLoading={isLoading}
          leftIcon={<CheckCircle2 className="w-5 h-5" aria-hidden="true" />}
        >
          {isLoading ? 'Saving...' : 'Finalize Exam'}
        </Button>
      </div>
    </div>
  );
}

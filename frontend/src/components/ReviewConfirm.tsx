/**
 * ReviewConfirm Component
 * 
 * Displays AI-generated rubric alongside teacher's original input.
 * Allows teacher to review, EDIT the grading strategy, and confirm.
 */
import { useState, memo, useCallback } from 'react';
import { 
  CheckCircle2, 
  ArrowLeft, 
  Lightbulb, 
  ChevronDown, 
  ChevronUp,
  Award,
  Target,
  Pencil,
  X,
  Save
} from 'lucide-react';
import { Card, CardHeader, Badge, Button, Alert, Textarea } from '@/components/ui';
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
  /** Callback when teacher confirms - receives edited rubrics */
  onConfirm: (editedRubrics: AIQuestionRubric[]) => void;
  /** Callback to go back to editing */
  onBack: () => void;
  /** Loading state */
  isLoading: boolean;
}

interface QuestionReviewCardProps {
  questionNumber: string;
  originalText: string;
  originalAnswer: string;
  maxMarks: number;
  aiRubric: AIQuestionRubric | undefined;
  isInitiallyExpanded?: boolean;
  onRubricEdit: (questionNumber: string, updatedRubric: AIQuestionRubric) => void;
}

const QuestionReviewCard = memo(function QuestionReviewCard({ 
  questionNumber, 
  originalText, 
  originalAnswer, 
  maxMarks,
  aiRubric,
  isInitiallyExpanded = false,
  onRubricEdit
}: QuestionReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCriteria, setEditedCriteria] = useState(aiRubric?.grading_criteria ?? '');
  const [editedConcepts, setEditedConcepts] = useState(aiRubric?.key_concepts.join(', ') ?? '');

  const handleSave = () => {
    if (aiRubric) {
      const updated: AIQuestionRubric = {
        ...aiRubric,
        grading_criteria: editedCriteria,
        key_concepts: editedConcepts.split(',').map(c => c.trim()).filter(c => c),
      };
      onRubricEdit(questionNumber, updated);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedCriteria(aiRubric?.grading_criteria ?? '');
    setEditedConcepts(aiRubric?.key_concepts.join(', ') ?? '');
    setIsEditing(false);
  };

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

          {/* AI Interpretation - Editable */}
          {aiRubric && (
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <Target className="w-5 h-5" aria-hidden="true" />
                  <span className="font-semibold">AI Grading Strategy</span>
                </div>
                {!isEditing ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    leftIcon={<Pencil className="w-4 h-4" />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                  >
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      leftIcon={<X className="w-4 h-4" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancel();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      leftIcon={<Save className="w-4 h-4" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSave();
                      }}
                    >
                      Save
                    </Button>
                  </div>
                )}
              </div>

              {isEditing ? (
                /* Editing Mode */
                <div className="space-y-4">
                  {/* Key Concepts - Editable */}
                  <div>
                    <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                      Key Concepts (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={editedConcepts}
                      onChange={(e) => setEditedConcepts(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm bg-white/80 border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="concept1, concept2, concept3"
                    />
                  </div>

                  {/* Grading Criteria - Editable */}
                  <div>
                    <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                      Grading Criteria
                    </label>
                    <Textarea
                      value={editedCriteria}
                      onChange={(e) => setEditedCriteria(e.target.value)}
                      rows={4}
                      placeholder="Describe how to award marks..."
                    />
                  </div>
                </div>
              ) : (
                /* View Mode */
                <>
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
                </>
              )}
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
  // State to track edited rubrics
  const [editedRubrics, setEditedRubrics] = useState<Map<string, AIQuestionRubric>>(
    new Map(aiRubric.questions.map(r => [r.question_number, r]))
  );

  const handleRubricEdit = useCallback((questionNumber: string, updatedRubric: AIQuestionRubric) => {
    setEditedRubrics(prev => {
      const next = new Map(prev);
      next.set(questionNumber, updatedRubric);
      return next;
    });
  }, []);

  const handleConfirm = () => {
    onConfirm(Array.from(editedRubrics.values()));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="animate-fade-in">
        <CardHeader
          icon={<Award className="w-6 h-6 text-success" />}
          title="Review AI Rubric"
          description="Review and edit the AI's grading strategy before finalizing"
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
            <p className="font-semibold mt-1">{aiRubric.total_marks}</p>
          </div>
        </div>
      </Card>

      {/* AI Suggestions */}
      {aiRubric.suggestions && aiRubric.suggestions.length > 0 && (
        <Alert variant="info" className="animate-fade-in">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-info mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-medium text-info">AI Suggestions</p>
              <ul className="mt-2 space-y-1 text-sm">
                {aiRubric.suggestions.map((suggestion, idx) => (
                  <li key={idx}>{suggestion}</li>
                ))}
              </ul>
            </div>
          </div>
        </Alert>
      )}

      {/* Questions Review */}
      <section>
        <h3 className="text-lg font-semibold mb-4">
          Question-by-Question Review
        </h3>
        <p className="text-sm text-text-secondary mb-4">
          Click "Edit" on any question to customize the AI's grading strategy.
        </p>
        
        <div className="space-y-3">
          {examData.questions
            .map((question, index) => (
              <QuestionReviewCard
                key={question.id}
                questionNumber={question.question_number}
                originalText={question.text}
                originalAnswer={question.ideal_answer}
                maxMarks={question.max_marks}
                aiRubric={editedRubrics.get(question.question_number)}
                isInitiallyExpanded={index === 0}
                onRubricEdit={handleRubricEdit}
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
          leftIcon={<ArrowLeft className="w-5 h-5" />}
        >
          Back to Edit
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleConfirm}
          isLoading={isLoading}
          leftIcon={<CheckCircle2 className="w-5 h-5" />}
        >
          {isLoading ? 'Saving...' : 'Approve & Go Live'}
        </Button>
      </div>
    </div>
  );
}

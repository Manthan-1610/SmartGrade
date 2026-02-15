import { useState, useRef, useEffect } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Check, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Maximize2
} from 'lucide-react';
import type { ExtractedAnswer, ExamResponse, VerifiedAnswer } from '@/lib/types';

interface VerificationUIProps {
  imageUrl: string;
  exam: ExamResponse;
  extractedAnswers: ExtractedAnswer[];
  onVerify: (answers: VerifiedAnswer[]) => void;
  isLoading: boolean;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-success';
  if (confidence >= 0.6) return 'text-warning';
  return 'text-danger';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.6) return 'Medium';
  return 'Low';
}

export function VerificationUI({ 
  imageUrl, 
  exam,
  extractedAnswers, 
  onVerify,
  isLoading 
}: VerificationUIProps) {
  const [editedAnswers, setEditedAnswers] = useState<Map<string, string>>(new Map());
  const [zoom, setZoom] = useState(1);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set(['1']));
  const [, setIsFullscreen] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Initialize edited answers with extracted text
  useEffect(() => {
    const initial = new Map<string, string>();
    extractedAnswers.forEach(ans => {
      initial.set(ans.question_number, ans.extracted_text);
    });
    setEditedAnswers(initial);
  }, [extractedAnswers]);

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));
  const handleResetZoom = () => setZoom(1);

  const toggleQuestion = (num: string) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(num)) {
        next.delete(num);
      } else {
        next.add(num);
      }
      return next;
    });
  };

  const updateAnswer = (questionNumber: string, text: string) => {
    setEditedAnswers(prev => {
      const next = new Map(prev);
      next.set(questionNumber, text);
      return next;
    });
  };

  const handleVerify = () => {
    const answers: VerifiedAnswer[] = [];
    editedAnswers.forEach((text, questionNumber) => {
      answers.push({ question_number: questionNumber, verified_text: text });
    });
    onVerify(answers);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      imageContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Create map for easy lookup
  const answerMap = new Map(extractedAnswers.map(a => [a.question_number, a]));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Side - Image Viewer */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Original Image</h3>
          
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-bg-card rounded-lg p-1">
            <button
              onClick={handleZoomOut}
              className="p-2 hover:bg-bg-secondary rounded transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 text-sm text-text-secondary min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-2 hover:bg-bg-secondary rounded transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-2 hover:bg-bg-secondary rounded transition-colors"
              title="Reset zoom"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-bg-secondary rounded transition-colors"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Container */}
        <div 
          ref={imageContainerRef}
          className="relative overflow-auto rounded-xl border border-border bg-bg-card"
          style={{ maxHeight: '70vh' }}
        >
          <div 
            className="transition-transform duration-200 origin-top-left"
            style={{ transform: `scale(${zoom})` }}
          >
            <img
              src={imageUrl}
              alt="Student submission"
              className="w-full"
              draggable={false}
            />
          </div>
        </div>

        <p className="text-xs text-text-muted text-center">
          Scroll to pan • Use controls to zoom
        </p>
      </div>

      {/* Right Side - Extracted Text */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Extracted Answers</h3>
          <span className="text-sm text-text-secondary">
            {extractedAnswers.length} questions
          </span>
        </div>

        {/* Answer Cards */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
          {exam.questions
            .sort((a, b) => a.order - b.order)
            .map((question) => {
              const extracted = answerMap.get(question.question_number);
              const isExpanded = expandedQuestions.has(question.question_number);
              const editedText = editedAnswers.get(question.question_number) || '';

              return (
                <div 
                  key={question.question_number}
                  className="rounded-xl border border-border bg-bg-card overflow-hidden"
                >
                  {/* Question Header */}
                  <button
                    onClick={() => toggleQuestion(question.question_number)}
                    className="w-full flex items-center justify-between p-4 hover:bg-bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/20 text-primary">
                        Q{question.question_number}
                      </span>
                      <span className="text-sm text-text-secondary truncate max-w-[200px]">
                        {question.text.slice(0, 40)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {extracted && (
                        <span className={`flex items-center gap-1 text-xs ${getConfidenceColor(extracted.confidence)}`}>
                          {extracted.confidence < 0.6 && (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {getConfidenceLabel(extracted.confidence)}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-text-muted" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-text-muted" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="p-4 pt-0 space-y-3">
                      {/* Original Question */}
                      <div className="p-3 bg-bg-secondary rounded-lg">
                        <p className="text-xs text-text-muted mb-1">Question:</p>
                        <p className="text-sm text-text-primary">{question.text}</p>
                        <p className="text-xs text-text-muted mt-2">
                          Max marks: {question.max_marks}
                        </p>
                      </div>

                      {/* Confidence Indicator */}
                      {extracted && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${
                                extracted.confidence >= 0.8 ? 'bg-success' :
                                extracted.confidence >= 0.6 ? 'bg-warning' : 'bg-danger'
                              }`}
                              style={{ width: `${extracted.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-muted">
                            {Math.round(extracted.confidence * 100)}% confidence
                          </span>
                        </div>
                      )}

                      {/* Editable Answer */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5">
                          Extracted Answer (editable):
                        </label>
                        <textarea
                          value={editedText}
                          onChange={(e) => updateAnswer(question.question_number, e.target.value)}
                          className="w-full rounded-lg border border-border bg-bg-input px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus/20 transition-all duration-200 min-h-[100px] resize-y text-sm"
                          placeholder="No text extracted..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Verify Button */}
        <div className="pt-4">
          <button
            onClick={handleVerify}
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-primary disabled:opacity-50 disabled:cursor-not-allowed bg-success text-white hover:bg-emerald-600 focus:ring-success gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Verify & Proceed
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

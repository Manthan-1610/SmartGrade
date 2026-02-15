"""
Gemini AI service for rubric generation and semantic analysis.

Uses externalized prompt templates for maintainability.
"""
import json
import google.generativeai as genai
from typing import List
from ..config import get_settings
from ..schemas import QuestionForVerification, VerifyTemplateResponse, AIQuestionRubric
from ..prompts import get_rubric_generation_prompt
from ..logging_config import get_logger

settings = get_settings()
logger = get_logger(__name__)


class GeminiService:
    """Service for interacting with Google's Gemini AI."""
    
    def __init__(self):
        self.model = None
        
        if not settings.gemini_api_key:
            logger.warning("GEMINI_API_KEY not configured. Using mock responses.")
            return
        
        try:
            genai.configure(api_key=settings.gemini_api_key)
            self.model = genai.GenerativeModel(settings.gemini_model)
            logger.info(f"Gemini initialized with model: {settings.gemini_model}")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini: {e}")
            self.model = None
    
    def generate_rubric(
        self, 
        title: str, 
        subject: str, 
        questions: List[QuestionForVerification]
    ) -> VerifyTemplateResponse:
        """
        Analyze exam template and generate AI grading strategy.
        
        Args:
            title: Exam title
            subject: Subject name
            questions: List of questions with ideal answers
            
        Returns:
            VerifyTemplateResponse with AI-generated rubrics
        """
        if not self.model:
            return self._generate_mock_response(questions)
        
        # Build questions text for prompt
        questions_text = "\n".join([
            f"""
Question {q.question_number}:
- Text: {q.text}
- Maximum Marks: {q.max_marks}
- Ideal Answer: {q.ideal_answer}
"""
            for q in questions
        ])
        
        total_marks = sum(q.max_marks for q in questions)
        
        # Get prompt from template
        prompt = get_rubric_generation_prompt(
            title=title,
            subject=subject,
            total_marks=total_marks,
            questions_text=questions_text,
        )
        
        try:
            response = self.model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.3,
                )
            )
            
            result = json.loads(response.text)
            
            logger.info(f"Generated rubric for '{title}': {total_marks} total marks")
            return VerifyTemplateResponse(**result)
            
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return self._generate_mock_response(questions)
    
    def _generate_mock_response(
        self, 
        questions: List[QuestionForVerification]
    ) -> VerifyTemplateResponse:
        """Generate mock response for testing without API key."""
        rubrics = []
        for q in questions:
            words = q.ideal_answer.split()
            key_concepts = [w.strip('.,!?') for w in words[:5] if len(w) > 3]
            
            rubrics.append(AIQuestionRubric(
                question_number=q.question_number,
                key_concepts=key_concepts if key_concepts else ["main concept", "supporting detail"],
                grading_criteria=f"Award {q.max_marks} marks for demonstrating understanding. Partial marks for incomplete but correct responses.",
                marks=q.max_marks
            ))
        
        return VerifyTemplateResponse(
            questions=rubrics,
            total_marks=sum(q.max_marks for q in questions),
            suggestions=["Consider adding specific marking criteria for partial answers."],
            raw_interpretation="Mock response - configure GEMINI_API_KEY for AI analysis"
        )


# Singleton instance
gemini_service = GeminiService()

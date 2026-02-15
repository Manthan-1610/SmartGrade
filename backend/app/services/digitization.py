"""
Digitization service using Gemini Vision for handwritten text extraction.

Supports both images and PDFs (PDFs are converted to images internally).
Uses externalized prompt templates for maintainability.
"""
import json
import google.generativeai as genai
from typing import List
from ..config import get_settings
from ..schemas import ExtractedAnswer
from ..prompts import get_answer_extraction_prompt
from ..logging_config import get_logger

settings = get_settings()
logger = get_logger(__name__)


class DigitizationService:
    """Service for extracting text from handwritten exam submissions."""
    
    def __init__(self):
        self.model = None
        
        if not settings.gemini_api_key:
            logger.warning("GEMINI_API_KEY not configured. Using mock OCR responses.")
            return
        
        try:
            genai.configure(api_key=settings.gemini_api_key)
            self.model = genai.GenerativeModel(settings.gemini_model)
            logger.info(f"Gemini Vision initialized: {settings.gemini_model}")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini Vision: {e}")
            self.model = None
    
    def extract_answers(
        self,
        image_bytes: bytes,
        questions: List[dict],
        mime_type: str = "image/png"
    ) -> List[ExtractedAnswer]:
        """
        Extract handwritten answers from an image using Gemini Vision.
        
        Args:
            image_bytes: Processed image bytes
            questions: List of question dicts with question_number, text, max_marks
            mime_type: MIME type of the image
            
        Returns:
            List of ExtractedAnswer objects with confidence scores
        """
        if not self.model:
            logger.warning("Gemini Vision not available. Returning mock responses.")
            return self._generate_mock_response(questions)
        
        # Build questions list for prompt
        questions_list = "\n".join([
            f"- Question {q['question_number']}: {q['text'][:100]}..."
            if len(q['text']) > 100 else f"- Question {q['question_number']}: {q['text']}"
            for q in questions
        ])
        
        prompt = get_answer_extraction_prompt(
            questions_list=questions_list,
            question_count=len(questions),
        )
        
        try:
            image_part = {
                "mime_type": mime_type,
                "data": image_bytes
            }
            
            response = self.model.generate_content(
                [prompt, image_part],
                generation_config=genai.GenerationConfig(
                    temperature=0.1,
                )
            )
            
            # Parse response - extract JSON from text
            response_text = response.text.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            
            result = json.loads(response_text)
            answers = []
            
            for ans in result.get("answers", []):
                answers.append(ExtractedAnswer(
                    question_number=str(ans["question_number"]),
                    extracted_text=ans.get("extracted_text", ""),
                    confidence=min(max(ans.get("confidence", 0.5), 0.0), 1.0)
                ))
            
            logger.info(f"Extracted {len(answers)} answers via Gemini Vision")
            return answers
            
        except Exception as e:
            logger.error(f"Gemini Vision error: {e}. Using mock responses.")
            return self._generate_mock_response(questions)
    
    def extract_answers_from_multiple_images(
        self,
        images: List[tuple],  # List of (bytes, mime_type) tuples
        questions: List[dict],
    ) -> List[ExtractedAnswer]:
        """
        Extract answers from multiple images (e.g., multi-page PDF).
        
        Combines results from all images and picks highest confidence per question.
        
        Args:
            images: List of (image_bytes, mime_type) tuples
            questions: List of question dicts
            
        Returns:
            Combined list of ExtractedAnswer objects
        """
        all_answers: dict[str, ExtractedAnswer] = {}
        
        for image_bytes, mime_type in images:
            page_answers = self.extract_answers(image_bytes, questions, mime_type)
            
            for ans in page_answers:
                existing = all_answers.get(ans.question_number)
                # Keep the answer with higher confidence or longer text
                if not existing or ans.confidence > existing.confidence:
                    all_answers[ans.question_number] = ans
        
        return list(all_answers.values())
    
    def _generate_mock_response(self, questions: List[dict]) -> List[ExtractedAnswer]:
        """Generate mock response for testing."""
        return [
            ExtractedAnswer(
                question_number=str(q["question_number"]),
                extracted_text=f"[Mock OCR for Q{q['question_number']}] Configure GEMINI_API_KEY for actual extraction.",
                confidence=0.85
            )
            for q in questions
        ]


# Singleton instance
digitization_service = DigitizationService()

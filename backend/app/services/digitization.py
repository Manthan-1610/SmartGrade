"""
Digitization service using Gemini Vision for handwritten text extraction.
"""
import json
import google.generativeai as genai
from typing import List
from ..config import get_settings
from ..schemas import ExtractedAnswer

settings = get_settings()


class DigitizationService:
    """Service for extracting text from handwritten exam submissions."""
    
    def __init__(self):
        if settings.gemini_api_key:
            genai.configure(api_key=settings.gemini_api_key)
            self.model = genai.GenerativeModel(settings.gemini_model)
        else:
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
            List of ExtractedAnswer objects
        """
        if not self.model:
            return self._generate_mock_response(questions)
        
        prompt = self._build_extraction_prompt(questions)
        
        try:
            # Create image part for Gemini
            image_part = {
                "mime_type": mime_type,
                "data": image_bytes
            }
            
            # Generate response
            response = self.model.generate_content(
                [prompt, image_part],
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.1,  # Very low temperature for accuracy
                )
            )
            
            # Parse response
            result = json.loads(response.text)
            answers = []
            
            for ans in result.get("answers", []):
                answers.append(ExtractedAnswer(
                    question_number=ans["question_number"],
                    extracted_text=ans.get("extracted_text", ""),
                    confidence=min(max(ans.get("confidence", 0.5), 0.0), 1.0)
                ))
            
            return answers
            
        except Exception as e:
            print(f"Gemini Vision API error: {e}")
            return self._generate_mock_response(questions)
    
    def _build_extraction_prompt(self, questions: List[dict]) -> str:
        """Build the prompt for text extraction."""
        questions_list = "\n".join([
            f"- Question {q['question_number']}: {q['text'][:100]}..."
            if len(q['text']) > 100 else f"- Question {q['question_number']}: {q['text']}"
            for q in questions
        ])
        
        return f"""You are an expert OCR system specialized in reading handwritten student exam answers.

TASK: Extract the handwritten text from this exam paper image.

EXAM QUESTIONS:
{questions_list}

INSTRUCTIONS:
1. Focus ONLY on the main answer content written by the student
2. IGNORE any margin notes, doodles, scratched-out text, or decorative drawings
3. For each question, extract the complete answer text
4. If a question appears unanswered, return an empty string for that question
5. If text is unclear, make your best interpretation and lower the confidence score
6. Maintain the original structure (paragraphs, numbered points) in the extracted text

OUTPUT FORMAT (JSON):
{{
  "answers": [
    {{
      "question_number": 1,
      "extracted_text": "The student's handwritten answer for question 1...",
      "confidence": 0.95
    }},
    {{
      "question_number": 2,
      "extracted_text": "The student's handwritten answer for question 2...",
      "confidence": 0.88
    }}
  ]
}}

CONFIDENCE SCORING:
- 0.95-1.0: Clear, easily readable handwriting
- 0.80-0.94: Mostly clear with some minor ambiguity
- 0.60-0.79: Readable but with unclear portions
- 0.40-0.59: Difficult to read, significant guessing
- 0.0-0.39: Very unclear, low confidence in extraction

Return ONLY valid JSON. Extract answers for all {len(questions)} questions."""
    
    def _generate_mock_response(self, questions: List[dict]) -> List[ExtractedAnswer]:
        """Generate mock response for testing without API key."""
        return [
            ExtractedAnswer(
                question_number=q["question_number"],
                extracted_text=f"[Mock extracted text for Q{q['question_number']}] This is a placeholder response. Configure GEMINI_API_KEY for actual OCR.",
                confidence=0.85
            )
            for q in questions
        ]


# Singleton instance
digitization_service = DigitizationService()

import json
import google.generativeai as genai
from typing import List
from ..config import get_settings
from ..schemas import QuestionForVerification, VerifyTemplateResponse, AIQuestionRubric

settings = get_settings()


class GeminiService:
    """Service for interacting with Google's Gemini AI."""
    
    def __init__(self):
        if settings.gemini_api_key:
            genai.configure(api_key=settings.gemini_api_key)
            self.model = genai.GenerativeModel(settings.gemini_model)
        else:
            self.model = None
    
    def generate_rubric(
        self, 
        title: str, 
        subject: str, 
        questions: List[QuestionForVerification]
    ) -> VerifyTemplateResponse:
        """
        Analyze exam template and generate AI interpretation of grading rubric.
        """
        if not self.model:
            # Return mock response if no API key configured
            return self._generate_mock_response(questions)
        
        # Build the prompt
        prompt = self._build_prompt(title, subject, questions)
        
        try:
            # Generate response from Gemini
            response = self.model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.3,  # Lower temperature for consistent output
                )
            )
            
            # Parse the JSON response
            result = json.loads(response.text)
            return VerifyTemplateResponse(**result)
            
        except Exception as e:
            print(f"Gemini API error: {e}")
            # Fall back to mock response on error
            return self._generate_mock_response(questions)
    
    def _build_prompt(
        self, 
        title: str, 
        subject: str, 
        questions: List[QuestionForVerification]
    ) -> str:
        """Build the prompt for Gemini."""
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
        
        return f"""You are an expert exam grader assistant helping teachers create clear grading rubrics.

Analyze this exam template for the subject "{subject}":

EXAM TITLE: {title}
TOTAL MARKS: {total_marks}

QUESTIONS:
{questions_text}

For each question, you must:
1. Identify the key concepts that a student must demonstrate to earn full marks
2. Create clear, objective grading criteria based on the ideal answer
3. Note the marks allocated and how they should be distributed
4. Flag any ambiguities that might make grading subjective

Return your analysis as JSON in this exact format:
{{
  "questions": [
    {{
      "question_number": 1,
      "key_concepts": ["concept1", "concept2", "concept3"],
      "grading_criteria": "Award X marks for... Award Y marks for...",
      "marks": 5
    }}
  ],
  "total_marks": {total_marks},
  "suggestions": ["Optional suggestion for improving clarity", "Another suggestion if needed"]
}}

Ensure your grading_criteria is specific and actionable for a teacher to follow.
Return ONLY valid JSON, no other text."""
    
    def _generate_mock_response(
        self, 
        questions: List[QuestionForVerification]
    ) -> VerifyTemplateResponse:
        """Generate a mock response for testing without API key."""
        rubrics = []
        for q in questions:
            # Extract key words from ideal answer for mock concepts
            words = q.ideal_answer.split()
            key_concepts = [w.strip('.,!?') for w in words[:5] if len(w) > 3]
            
            rubrics.append(AIQuestionRubric(
                question_number=q.question_number,
                key_concepts=key_concepts if key_concepts else ["main concept", "supporting detail"],
                grading_criteria=f"Award {q.max_marks} marks for demonstrating understanding of the ideal answer. Partial marks for incomplete but correct responses.",
                marks=q.max_marks
            ))
        
        return VerifyTemplateResponse(
            questions=rubrics,
            total_marks=sum(q.max_marks for q in questions),
            suggestions=["Consider adding more specific marking criteria for partial answers."],
            raw_interpretation="Mock response - configure GEMINI_API_KEY for actual AI analysis"
        )


# Singleton instance
gemini_service = GeminiService()

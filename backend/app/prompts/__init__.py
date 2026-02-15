"""
Prompt template loader.

Loads prompt templates from text files for AI services.
This keeps prompts separate from code for easier maintenance and versioning.
"""
import os
from functools import lru_cache
from typing import Dict

PROMPTS_DIR = os.path.dirname(__file__)


@lru_cache(maxsize=10)
def load_prompt(name: str) -> str:
    """
    Load a prompt template from file.
    
    Args:
        name: Name of the prompt file (without .txt extension)
        
    Returns:
        Prompt template string
        
    Raises:
        FileNotFoundError: If prompt file doesn't exist
    """
    filepath = os.path.join(PROMPTS_DIR, f"{name}.txt")
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()


def get_rubric_generation_prompt(
    title: str,
    subject: str,
    total_marks: float,
    questions_text: str,
) -> str:
    """Get the rubric generation prompt with variables filled in."""
    template = load_prompt("rubric_generation")
    return template.format(
        title=title,
        subject=subject,
        total_marks=total_marks,
        questions_text=questions_text,
    )


def get_answer_extraction_prompt(
    questions_list: str,
    question_count: int,
) -> str:
    """Get the answer extraction prompt with variables filled in."""
    template = load_prompt("answer_extraction")
    return template.format(
        questions_list=questions_list,
        question_count=question_count,
    )


def get_semantic_grading_prompt(
    exam_title: str,
    subject: str,
    qa_pairs: str,
) -> str:
    """Get the semantic grading prompt with variables filled in."""
    template = load_prompt("semantic_grading")
    return template.format(
        exam_title=exam_title,
        subject=subject,
        qa_pairs=qa_pairs,
    )

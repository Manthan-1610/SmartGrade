"""
Database reset script - drops all tables except users and recreates them.

Run this to sync the database schema with the models after schema changes,
while preserving all user accounts.
"""
from sqlalchemy import text
from sqlmodel import SQLModel
from app.database import engine
from app.models import (
    User, RefreshToken,
    Organization,
    Class, ClassInvitation, ClassEnrollment,
    Exam, Question, ExamExtension,
    Submission, StudentAnswer, DigitalReceipt,
)
from app.logging_config import get_logger

logger = get_logger(__name__)


def reset_database_preserve_users():
    """
    Drop all tables EXCEPT users and recreate them with current schema.
    
    This preserves all user accounts while resetting exams, submissions, and related data.
    
    WARNING: This will delete all exam, submission, and question data!
    User accounts will be preserved.
    """
    try:
        with engine.connect() as conn:
            # Drop tables in order of dependencies (reverse of creation order)
            tables_to_drop = [
                "digital_receipts",      # Depends on submissions, users, exams
                "student_answers",       # Depends on questions and submissions
                "submissions",           # Depends on exams and users
                "exam_extensions",       # Depends on exams and users
                "questions",             # Depends on exams
                "exams",                 # Depends on classes and users
                "class_enrollments",     # Depends on classes and users
                "class_invitations",     # Depends on classes and users
                "classes",               # Depends on organizations and users
                "organizations",         # Depends on users
                "refresh_tokens",        # Depends on users
            ]
            
            logger.info("Dropping dependent tables (preserving users table)...")
            for table_name in tables_to_drop:
                try:
                    conn.execute(text(f"DROP TABLE IF EXISTS {table_name} CASCADE"))
                    logger.info(f"Dropped table: {table_name}")
                except Exception as e:
                    logger.warning(f"Could not drop table {table_name}: {e}")
            
            conn.commit()
            logger.info("All dependent tables dropped successfully")
        
        logger.info("Recreating tables with current schema (except users)...")
        # Create all tables, which will skip users since it already exists
        SQLModel.metadata.create_all(engine)
        logger.info("All dependent tables recreated successfully")
        
        print("\n✓ Database reset complete!")
        print("Tables reset: organizations, classes, class_invitations, class_enrollments,")
        print("  exams, questions, exam_extensions, submissions, student_answers,")
        print("  digital_receipts, refresh_tokens")
        print("Preserved: users table with all accounts intact")
        
    except Exception as e:
        logger.error(f"Error during database reset: {e}")
        print(f"\n✗ Error: {e}")
        raise


def reset_database():
    """
    Drop all existing tables and recreate them with current schema.
    
    WARNING: This will delete ALL data in the database!
    """
    try:
        logger.info("Dropping all existing tables...")
        SQLModel.metadata.drop_all(engine)
        logger.info("All tables dropped successfully")
        
        logger.info("Recreating all tables with current schema...")
        SQLModel.metadata.create_all(engine)
        logger.info("All tables recreated successfully")
        
        print("\n✓ Database reset complete!")
        print("All tables have been recreated with the current schema.")
        
    except Exception as e:
        logger.error(f"Error during database reset: {e}")
        print(f"\n✗ Error: {e}")
        raise


if __name__ == "__main__":
    print("=" * 60)
    print("DATABASE RESET UTILITY")
    print("=" * 60)
    print("\nChoose reset option:")
    print("  1 - Reset all tables EXCEPT users (preserve accounts)")
    print("  2 - Reset ALL tables including users (full reset)")
    print("\n")
    
    choice = input("Enter your choice (1 or 2): ").strip()
    
    if choice == "1":
        print("\nWARNING: This will delete all exams, submissions, and questions!")
        print("User accounts will be PRESERVED.\n")
        response = input("Type 'yes' to confirm: ").strip().lower()
        if response == 'yes':
            reset_database_preserve_users()
        else:
            print("\nDatabase reset cancelled.")
    elif choice == "2":
        print("\nWARNING: This will delete ALL data in the database!")
        print("This should only be used in development environments.\n")
        response = input("Type 'yes' to confirm: ").strip().lower()
        if response == 'yes':
            reset_database()
        else:
            print("\nDatabase reset cancelled.")
    else:
        print("\nInvalid choice. Please enter 1 or 2.")

# import secrets

# # Generate a secure random token (e.g., a 32-byte hex string)
# secure_key = secrets.token_hex(32)
# print(secure_key)
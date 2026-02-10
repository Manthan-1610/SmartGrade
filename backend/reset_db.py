# """
# Database reset script - drops all tables and recreates them with current schema.

# Run this to sync the database schema with the models after schema changes.
# """
# from sqlmodel import SQLModel
# from app.database import engine
# from app.models import User, RefreshToken, Question, Exam, Submission, StudentAnswer
# from app.logging_config import get_logger

# logger = get_logger(__name__)


# def reset_database():
#     """
#     Drop all existing tables and recreate them with current schema.
    
#     WARNING: This will delete all data in the database!
#     """
#     try:
#         logger.info("Dropping all existing tables...")
#         SQLModel.metadata.drop_all(engine)
#         logger.info("All tables dropped successfully")
        
#         logger.info("Recreating all tables with current schema...")
#         SQLModel.metadata.create_all(engine)
#         logger.info("All tables recreated successfully")
        
#         print("\n✓ Database reset complete!")
#         print("All tables have been recreated with the current schema.")
        
#     except Exception as e:
#         logger.error(f"Error during database reset: {e}")
#         print(f"\n✗ Error: {e}")
#         raise


# if __name__ == "__main__":
#     print("=" * 60)
#     print("DATABASE RESET UTILITY")
#     print("=" * 60)
#     print("\nWARNING: This will delete ALL data in the database!")
#     print("This should only be used in development environments.\n")
    
#     response = input("Type 'yes' to confirm database reset: ").strip().lower()
    
#     if response == 'yes':
#         reset_database()
#     else:
#         print("\nDatabase reset cancelled.")

import secrets

# Generate a secure random token (e.g., a 32-byte hex string)
secure_key = secrets.token_hex(32)
print(secure_key)
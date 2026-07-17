import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Read .env file into environment
load_dotenv()

# Get the DATABASE_URL from environment
# Example: postgresql://devshelf:devshelf123@db:5432/devshelf
DATABASE_URL = os.getenv("DATABASE_URL")

# create_engine = the actual connection to PostgreSQL
# pool_pre_ping=True means: test connection before using it
# if DB restarted, it reconnects automatically instead of crashing
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# SessionLocal = a factory that creates DB sessions
# Each API request gets its own session, closes when done
# autocommit=False → we control when to save changes
# autoflush=False  → don't auto-send queries until we say so
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base = parent class for all your DB table models
# Every table you define will inherit from this
Base = declarative_base()

# This function gives each API request its own DB session
# yield = give the session to the route, then close it after
# This is called a "dependency" in FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

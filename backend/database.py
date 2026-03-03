"""
Database Configuration for Flood DAS
=====================================
PostgreSQL + PostGIS database connection and session management.
Configured for Kukatpally Nala Sub-Catchment flood monitoring system.
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Database configuration
# For production, use environment variables
# Using peer authentication (default on Fedora/RHEL)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2:///flood_das"
)

# Create SQLAlchemy engine with PostGIS support
engine = create_engine(
    DATABASE_URL,
    echo=True,  # Set to False in production
    pool_pre_ping=True,  # Enable connection health checks
    pool_size=5,
    max_overflow=10
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db():
    """
    Dependency function for FastAPI.
    Yields database session and ensures proper cleanup.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initialize database tables.
    Creates all tables defined in models.py
    """
    from . import models  # Import models to register them
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables created successfully")


def init_postgis(db_session):
    """
    Enable PostGIS extension on the database.
    Must be run once during initial setup.
    """
    try:
        db_session.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
        db_session.commit()
        print("✓ PostGIS extension enabled")
    except Exception as e:
        print(f"PostGIS extension may already exist: {e}")
        db_session.rollback()

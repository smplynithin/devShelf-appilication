import uuid
from sqlalchemy import Column, String, Text, DateTime, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from .database import Base

class Bookmark(Base):
    __tablename__ = "bookmarks"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title      = Column(String(255), nullable=False)
    url        = Column(Text, nullable=False)
    notes      = Column(Text, nullable=True)
    tags       = Column(ARRAY(String), server_default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Snippet(Base):
    __tablename__ = "snippets"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title      = Column(String(255), nullable=False)
    language   = Column(String(50), nullable=False)
    code       = Column(Text, nullable=False)
    tags       = Column(ARRAY(String), server_default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
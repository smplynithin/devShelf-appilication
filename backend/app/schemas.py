from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from uuid import UUID
from datetime import datetime

# --- Bookmark Schemas ---

# What the API expects when CREATING a bookmark
class BookmarkCreate(BaseModel):
    title: str
    url:   str
    notes: Optional[str] = None        # optional field
    tags:  Optional[List[str]] = []    # optional, defaults to empty list

# What the API returns when READING a bookmark
# includes id and created_at which are DB-generated
class BookmarkResponse(BaseModel):
    id:         UUID
    title:      str
    url:        str
    notes:      Optional[str]
    tags:       List[str]
    created_at: datetime

    # This tells Pydantic to read data from SQLAlchemy objects
    # without this, it only reads plain dictionaries
    class Config:
        from_attributes = True


# --- Snippet Schemas ---

class SnippetCreate(BaseModel):
    title:    str
    language: str
    code:     str
    tags:     Optional[List[str]] = []

class SnippetResponse(BaseModel):
    id:         UUID
    title:      str
    language:   str
    code:       str
    tags:       List[str]
    created_at: datetime

    class Config:
        from_attributes = True

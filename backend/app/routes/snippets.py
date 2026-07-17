import json
import redis
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from ..database import get_db
from ..models import Snippet
from ..schemas import SnippetCreate, SnippetResponse

router = APIRouter(prefix="/snippets", tags=["snippets"])

redis_client = redis.from_url(
    os.getenv("REDIS_URL", "redis://cache:6379"),
    decode_responses=True
)

@router.post("/", response_model=SnippetResponse)
def create_snippet(snippet: SnippetCreate, db: Session = Depends(get_db)):
    db_snippet = Snippet(
        title=snippet.title,
        language=snippet.language,
        code=snippet.code,
        tags=snippet.tags
    )
    db.add(db_snippet)
    db.commit()
    db.refresh(db_snippet)

    for key in redis_client.keys("search:*"):
        redis_client.delete(key)

    return db_snippet


@router.get("/", response_model=List[SnippetResponse])
def get_snippets(language: Optional[str] = None, db: Session = Depends(get_db)):
    if language:
        snippets = db.query(Snippet).filter(Snippet.language == language).all()
    else:
        snippets = db.query(Snippet).all()
    return snippets


@router.get("/search", response_model=List[SnippetResponse])
def search_snippets(q: str, db: Session = Depends(get_db)):
    cache_key = f"search:snippets:{q.lower()}"

    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    results = db.query(Snippet).filter(
        or_(
            Snippet.title.ilike(f"%{q}%"),
            Snippet.code.ilike(f"%{q}%"),
            Snippet.tags.any(q.lower())
        )
    ).all()

    serialized = [
        {
            "id": str(r.id),
            "title": r.title,
            "language": r.language,
            "code": r.code,
            "tags": r.tags,
            "created_at": r.created_at.isoformat()
        }
        for r in results
    ]

    redis_client.set(cache_key, json.dumps(serialized), ex=300)
    return results


@router.get("/{snippet_id}", response_model=SnippetResponse)
def get_snippet(snippet_id: str, db: Session = Depends(get_db)):
    snippet = db.query(Snippet).filter(Snippet.id == snippet_id).first()
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return snippet


@router.delete("/{snippet_id}")
def delete_snippet(snippet_id: str, db: Session = Depends(get_db)):
    snippet = db.query(Snippet).filter(Snippet.id == snippet_id).first()
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")
    db.delete(snippet)
    db.commit()

    for key in redis_client.keys("search:*"):
        redis_client.delete(key)

    return {"message": "Snippet deleted"}

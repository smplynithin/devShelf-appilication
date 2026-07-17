import json
import redis
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from sqlalchemy.dialects.postgresql import ARRAY
from typing import List, Optional
from ..database import get_db
from ..models import Bookmark
from ..schemas import BookmarkCreate, BookmarkResponse

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])

redis_client = redis.from_url(
    os.getenv("REDIS_URL", "redis://cache:6379"),
    decode_responses=True
)

@router.post("/", response_model=BookmarkResponse)
def create_bookmark(bookmark: BookmarkCreate, db: Session = Depends(get_db)):
    db_bookmark = Bookmark(
        title=bookmark.title,
        url=bookmark.url,
        notes=bookmark.notes,
        tags=bookmark.tags
    )
    db.add(db_bookmark)
    db.commit()
    db.refresh(db_bookmark)

    for key in redis_client.keys("search:*"):
        redis_client.delete(key)

    return db_bookmark


@router.get("/", response_model=List[BookmarkResponse])
def get_bookmarks(tag: Optional[str] = None, db: Session = Depends(get_db)):
    if tag:
        bookmarks = db.query(Bookmark).filter(
            Bookmark.tags.contains([tag])
        ).all()
    else:
        bookmarks = db.query(Bookmark).all()
    return bookmarks


@router.get("/search", response_model=List[BookmarkResponse])
def search_bookmarks(q: str, db: Session = Depends(get_db)):
    cache_key = f"search:bookmarks:{q.lower()}"

    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    # Use any() for PostgreSQL array search instead of contains()
    results = db.query(Bookmark).filter(
        or_(
            Bookmark.title.ilike(f"%{q}%"),
            Bookmark.notes.ilike(f"%{q}%"),
            Bookmark.tags.any(q.lower())
        )
    ).all()

    serialized = [
        {
            "id": str(r.id),
            "title": r.title,
            "url": r.url,
            "notes": r.notes,
            "tags": r.tags,
            "created_at": r.created_at.isoformat()
        }
        for r in results
    ]

    redis_client.set(cache_key, json.dumps(serialized), ex=300)
    return results


@router.get("/{bookmark_id}", response_model=BookmarkResponse)
def get_bookmark(bookmark_id: str, db: Session = Depends(get_db)):
    bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id).first()
    if not bookmark:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    return bookmark


@router.delete("/{bookmark_id}")
def delete_bookmark(bookmark_id: str, db: Session = Depends(get_db)):
    bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id).first()
    if not bookmark:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    db.delete(bookmark)
    db.commit()

    for key in redis_client.keys("search:*"):
        redis_client.delete(key)

    return {"message": "Bookmark deleted"}

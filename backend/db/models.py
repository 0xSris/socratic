from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class Session(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    session_id: str = Field(unique=True, index=True)
    topic: str
    goal: Optional[str] = None
    status: str = "active"  # active | completed
    turn_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Turn(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    user_id: int = Field(index=True)
    turn_index: int
    question: str
    user_answer: Optional[str] = None
    assessment: Optional[str] = None   # JSON: {confidence, concepts_revealed, reasoning}
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ConceptNode(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    name: str
    confidence: float = 0.0      # 0.0 = unknown, 1.0 = mastered
    state: str = "unknown"       # unknown | inferred | shaky | confident | mastered
    evidence: Optional[str] = None  # what the user said that revealed this
    x: Optional[float] = None   # graph position
    y: Optional[float] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ConceptEdge(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    source: str   # concept name
    target: str   # concept name
    relation: str = "requires"  # requires | related | extends


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    display_name: str
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Attachment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    session_id: Optional[str] = Field(default=None, index=True)
    filename: str
    content_type: str
    path: str
    size_bytes: int
    created_at: datetime = Field(default_factory=datetime.utcnow)

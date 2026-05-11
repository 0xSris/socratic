import json
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Annotated, Optional

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from sqlmodel import select

from auth import create_access_token, get_current_user, hash_password, verify_password
from db.database import get_session, init_db
from db.models import Attachment, ConceptEdge, ConceptNode, Session as DBSession, Turn, User
from agent.tutor import (
    assess_answer,
    build_graph_summary,
    get_first_question,
    get_next_question,
    initialize_graph,
    merge_assessment_into_graph,
)

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))


@asynccontextmanager
async def lifespan(app: FastAPI):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    init_db()
    yield


app = FastAPI(title="Socratic Tutor API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app"),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str = Field(min_length=1, max_length=80)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class StartRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=160)
    goal: Optional[str] = Field(default=None, max_length=240)


class AnswerRequest(BaseModel):
    session_id: str
    answer: str = Field(min_length=1, max_length=4000)
    attachment_ids: list[int] = []


class UserResponse(BaseModel):
    id: int
    email: str
    display_name: str


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


CurrentUser = Annotated[User, Depends(get_current_user)]


def _user_response(user: User) -> UserResponse:
    return UserResponse(id=user.id or 0, email=user.email, display_name=user.display_name)


def _get_graph_nodes(session_id: str) -> list[dict]:
    with get_session() as s:
        nodes = s.exec(select(ConceptNode).where(ConceptNode.session_id == session_id)).all()
        return [
            {
                "name": n.name,
                "confidence": n.confidence,
                "state": n.state,
                "x": n.x,
                "y": n.y,
                "evidence": n.evidence,
            }
            for n in nodes
        ]


def _get_edges(session_id: str) -> list[dict]:
    with get_session() as s:
        edges = s.exec(select(ConceptEdge).where(ConceptEdge.session_id == session_id)).all()
        return [{"source": e.source, "target": e.target, "relation": e.relation} for e in edges]


def _get_history(session_id: str) -> list[dict]:
    with get_session() as s:
        turns = s.exec(
            select(Turn).where(Turn.session_id == session_id).order_by(Turn.turn_index)
        ).all()
        return [
            {
                "question": t.question,
                "answer": t.user_answer,
                "assessment": json.loads(t.assessment) if t.assessment else None,
                "turn_index": t.turn_index,
            }
            for t in turns
        ]


def _save_nodes(session_id: str, nodes: list[dict]):
    with get_session() as s:
        existing = s.exec(select(ConceptNode).where(ConceptNode.session_id == session_id)).all()
        for n in existing:
            s.delete(n)
        s.flush()
        for node in nodes:
            s.add(
                ConceptNode(
                    session_id=session_id,
                    name=node["name"],
                    confidence=node.get("confidence", 0.0),
                    state=node.get("state", "unknown"),
                    x=node.get("x"),
                    y=node.get("y"),
                    evidence=node.get("evidence"),
                    updated_at=datetime.utcnow(),
                )
            )


def _require_session_owner(session_id: str, user: User) -> DBSession:
    with get_session() as s:
        session = s.exec(
            select(DBSession).where(DBSession.session_id == session_id, DBSession.user_id == user.id)
        ).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return session


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest):
    with get_session() as s:
        existing = s.exec(select(User).where(User.email == req.email.lower())).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email is already registered")
        user = User(
            email=req.email.lower(),
            display_name=req.display_name.strip(),
            password_hash=hash_password(req.password),
        )
        s.add(user)
        s.flush()
        s.refresh(user)
        token = create_access_token(user)
        return AuthResponse(token=token, user=_user_response(user))


@app.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    with get_session() as s:
        user = s.exec(select(User).where(User.email == req.email.lower())).first()
        if not user or not verify_password(req.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        return AuthResponse(token=create_access_token(user), user=_user_response(user))


@app.get("/auth/me", response_model=UserResponse)
async def me(user: CurrentUser):
    return _user_response(user)


@app.post("/attachments")
async def upload_attachment(user: CurrentUser, file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Attachment is too large")

    safe_name = Path(file.filename or "attachment").name
    stored_name = f"{uuid.uuid4()}-{safe_name}"
    destination = UPLOAD_DIR / stored_name
    with destination.open("wb") as out:
        out.write(content)

    with get_session() as s:
        attachment = Attachment(
            user_id=user.id or 0,
            filename=safe_name,
            content_type=file.content_type or "application/octet-stream",
            path=str(destination),
            size_bytes=len(content),
        )
        s.add(attachment)
        s.flush()
        s.refresh(attachment)
        return {
            "id": attachment.id,
            "filename": attachment.filename,
            "content_type": attachment.content_type,
            "size_bytes": attachment.size_bytes,
        }


@app.post("/session/start")
async def start_session(req: StartRequest, user: CurrentUser):
    session_id = str(uuid.uuid4())
    graph_data = initialize_graph(req.topic)
    first_q = get_first_question(req.topic, req.goal or req.topic)

    with get_session() as s:
        s.add(
            DBSession(
                user_id=user.id or 0,
                session_id=session_id,
                topic=req.topic,
                goal=req.goal,
                status="active",
                turn_count=0,
            )
        )

    nodes = graph_data.get("concepts", [])
    _save_nodes(
        session_id,
        [
            {
                "name": c["name"],
                "confidence": 0.0,
                "state": "unknown",
                "x": c.get("x"),
                "y": c.get("y"),
            }
            for c in nodes
        ],
    )

    with get_session() as s:
        for edge in graph_data.get("edges", []):
            s.add(
                ConceptEdge(
                    session_id=session_id,
                    source=edge["source"],
                    target=edge["target"],
                    relation=edge.get("relation", "requires"),
                )
            )
        s.add(Turn(session_id=session_id, user_id=user.id or 0, turn_index=0, question=first_q))

    return {
        "session_id": session_id,
        "question": first_q,
        "graph": {"nodes": _get_graph_nodes(session_id), "edges": _get_edges(session_id)},
    }


@app.post("/session/answer")
async def submit_answer(req: AnswerRequest, user: CurrentUser):
    session = _require_session_owner(req.session_id, user)
    topic = session.topic
    goal = session.goal or session.topic

    with get_session() as s:
        attachments = s.exec(
            select(Attachment).where(Attachment.id.in_(req.attachment_ids), Attachment.user_id == user.id)
        ).all() if req.attachment_ids else []
        for attachment in attachments:
            attachment.session_id = req.session_id
            s.add(attachment)

    history = _get_history(req.session_id)
    current_nodes = _get_graph_nodes(req.session_id)
    unanswered = next((t for t in reversed(history) if not t["answer"]), None)
    if not unanswered:
        raise HTTPException(status_code=400, detail="No pending question")

    attachment_note = ""
    if attachments:
        names = ", ".join(a.filename for a in attachments)
        attachment_note = f"\n\nStudent attached: {names}"

    current_question = unanswered["question"]
    turn_idx = unanswered["turn_index"]
    assessment = assess_answer(topic, current_question, req.answer + attachment_note)
    updated_nodes = merge_assessment_into_graph(current_nodes, assessment, current_nodes)
    _save_nodes(req.session_id, updated_nodes)

    with get_session() as s:
        turn = s.exec(
            select(Turn).where(Turn.session_id == req.session_id, Turn.turn_index == turn_idx)
        ).first()
        if turn:
            turn.user_answer = req.answer
            turn.assessment = json.dumps(assessment)
            s.add(turn)

    answered_turns = [t for t in history if t["answer"]] + [{"question": current_question, "answer": req.answer}]
    graph_summary = build_graph_summary(updated_nodes)
    next_question = get_next_question(topic, goal, answered_turns, graph_summary)
    new_turn_idx = turn_idx + 1

    with get_session() as s:
        s.add(Turn(session_id=req.session_id, user_id=user.id or 0, turn_index=new_turn_idx, question=next_question))
        session_row = s.exec(select(DBSession).where(DBSession.session_id == req.session_id)).first()
        if session_row:
            session_row.turn_count = new_turn_idx
            session_row.updated_at = datetime.utcnow()
            s.add(session_row)

    return {
        "question": next_question,
        "assessment": assessment,
        "graph": {"nodes": _get_graph_nodes(req.session_id), "edges": _get_edges(req.session_id)},
    }


@app.get("/session/{session_id}")
async def get_session_data(session_id: str, user: CurrentUser):
    session = _require_session_owner(session_id, user)
    history = _get_history(session_id)
    current_q = next((t["question"] for t in reversed(history) if not t["answer"]), None)

    return {
        "session_id": session_id,
        "topic": session.topic,
        "goal": session.goal,
        "status": session.status,
        "turn_count": session.turn_count,
        "current_question": current_q,
        "history": history,
        "graph": {"nodes": _get_graph_nodes(session_id), "edges": _get_edges(session_id)},
    }


@app.get("/sessions")
async def list_sessions(user: CurrentUser):
    with get_session() as s:
        sessions = s.exec(
            select(DBSession).where(DBSession.user_id == user.id).order_by(DBSession.created_at.desc())
        ).all()
        return [
            {
                "session_id": row.session_id,
                "topic": row.topic,
                "status": row.status,
                "turn_count": row.turn_count,
                "created_at": row.created_at.isoformat(),
            }
            for row in sessions
        ]

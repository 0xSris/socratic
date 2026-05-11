import os
import sys
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./test_socratic.db"
os.environ["JWT_SECRET"] = "test-secret"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

import main
from db.database import engine
from sqlmodel import SQLModel


def setup_function():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)


def test_register_login_and_secured_sessions(monkeypatch):
    monkeypatch.setattr(
        main,
        "initialize_graph",
        lambda topic: {
            "concepts": [{"name": "foundations", "x": 100, "y": 100}],
            "edges": [],
        },
    )
    monkeypatch.setattr(main, "get_first_question", lambda topic, goal: "What do you already know?")
    monkeypatch.setattr(
        main,
        "assess_answer",
        lambda topic, question, answer: {
            "confidence": 0.5,
            "correctness": "partial",
            "concepts_demonstrated": [{"name": "foundations", "confidence": 0.7, "state": "confident"}],
            "concepts_missing": [],
            "reasoning_quality": "mechanical",
            "follow_up_direction": "deeper",
            "internal_note": "test",
        },
    )
    monkeypatch.setattr(main, "get_next_question", lambda topic, goal, history, graph_summary: "What follows from that?")

    with TestClient(main.app) as client:
        blocked = client.post("/session/start", json={"topic": "Algebra"})
        assert blocked.status_code == 401

        registered = client.post(
            "/auth/register",
            json={"email": "learner@example.com", "password": "password123", "display_name": "Learner"},
        )
        assert registered.status_code == 201
        token = registered.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        started = client.post("/session/start", json={"topic": "Algebra", "goal": "Practice"}, headers=headers)
        assert started.status_code == 200
        session_id = started.json()["session_id"]

        answered = client.post(
            "/session/answer",
            json={"session_id": session_id, "answer": "I know variables.", "attachment_ids": []},
            headers=headers,
        )
        assert answered.status_code == 200
        assert answered.json()["question"] == "What follows from that?"

        sessions = client.get("/sessions", headers=headers)
        assert sessions.status_code == 200
        assert len(sessions.json()) == 1


def test_user_cannot_read_another_users_session(monkeypatch):
    monkeypatch.setattr(main, "initialize_graph", lambda topic: {"concepts": [], "edges": []})
    monkeypatch.setattr(main, "get_first_question", lambda topic, goal: "Question?")

    with TestClient(main.app) as client:
        first = client.post(
            "/auth/register",
            json={"email": "one@example.com", "password": "password123", "display_name": "One"},
        ).json()["token"]
        second = client.post(
            "/auth/register",
            json={"email": "two@example.com", "password": "password123", "display_name": "Two"},
        ).json()["token"]

        started = client.post(
            "/session/start",
            json={"topic": "Databases"},
            headers={"Authorization": f"Bearer {first}"},
        )
        session_id = started.json()["session_id"]

        forbidden = client.get(
            f"/session/{session_id}",
            headers={"Authorization": f"Bearer {second}"},
        )
        assert forbidden.status_code == 404

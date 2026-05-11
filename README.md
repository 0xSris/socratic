# Socratic

Socratic is a logged-in Q&A tutoring app built around a minimalist chat interface. Students ask and answer questions in alternating user and tutor bubbles, while the backend stores sessions, turns, attachments, and concept graph state.

## Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Frontend | Next.js 14, React, Tailwind | Landify-inspired cards, form fields, and clean chat bubbles. |
| Backend | FastAPI | Existing backend preserved and secured with JWT. |
| Database | PostgreSQL via SQLModel | `DATABASE_URL` controls Postgres in production; SQLite remains the local fallback. |
| Auth | JWT bearer tokens | `/auth/register`, `/auth/login`, and `/auth/me`. |
| Uploads | Multipart file upload | Attachment metadata is stored in the database; files are stored under `UPLOAD_DIR`. |
| CI | GitHub Actions | Backend tests, frontend typecheck, and frontend build. |

## Repository Structure

```txt
socratic/
  .github/workflows/ci.yml
  backend/
    agent/tutor.py
    db/database.py
    db/models.py
    tests/test_auth_sessions.py
    auth.py
    main.py
    requirements.txt
  frontend/
    app/
      page.tsx
      history/page.tsx
      session/[id]/page.tsx
      graph/[id]/page.tsx
      globals.css
    components/
      auth/AuthPanel.tsx
      chat/ChatBubble.tsx
      graph/KnowledgeGraph.tsx
      ui/AnswerInput.tsx
      ui/AssessmentFeedback.tsx
      ui/QuestionDisplay.tsx
    lib/api.ts
    lib/useSession.ts
    package.json
```

## Local Setup

Backend:

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`, create an account, start a topic, and answer the tutor's questions.

## Environment

Backend variables:

```env
GROQ_API_KEY=your_groq_key_here
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/socratic
JWT_SECRET=replace-with-a-long-random-secret
CORS_ORIGINS=http://localhost:3000
UPLOAD_DIR=uploads
MAX_UPLOAD_BYTES=10485760
```

Frontend variables:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | No | Create user and return JWT. |
| `POST` | `/auth/login` | No | Authenticate and return JWT. |
| `GET` | `/auth/me` | Yes | Fetch current user. |
| `POST` | `/attachments` | Yes | Upload one attachment. |
| `POST` | `/session/start` | Yes | Create a tutoring session and first question. |
| `POST` | `/session/answer` | Yes | Save answer, assess it, and return next question. |
| `GET` | `/session/{id}` | Yes | Fetch a user's own session. |
| `GET` | `/sessions` | Yes | List a user's sessions. |

## Deployment

### Vercel Frontend

1. Set project root to `frontend`.
2. Add `NEXT_PUBLIC_API_URL` pointing to the deployed backend.
3. Deploy with the default Next.js build command, `npm run build`.

### Heroku Backend

1. Create a Heroku app and add Heroku Postgres.
2. Set config vars: `GROQ_API_KEY`, `JWT_SECRET`, `CORS_ORIGINS`, `UPLOAD_DIR`, and `DATABASE_URL`.
3. Use this process command:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

For persistent uploads in production, replace local disk uploads with object storage such as S3, GCS, or Firebase Storage.

## Tests

```bash
cd backend
pytest

cd ../frontend
npm run typecheck
npm run build
```

## Suggested Commit Messages

```txt
feat(auth): add jwt registration and login endpoints
feat(chat): add authenticated socratic chat with attachments
feat(db): configure postgres-ready sqlmodel storage
test(api): cover secured session ownership
ci: add backend and frontend github actions workflow
docs: document setup deployment and release checklist
```

## Release Checklist

- [ ] Create a fresh Postgres database and set `DATABASE_URL`.
- [ ] Set a strong `JWT_SECRET`.
- [ ] Restrict `CORS_ORIGINS` to deployed frontend domains.
- [ ] Confirm `GROQ_API_KEY` is present in backend runtime.
- [ ] Run `pytest`, `npm run typecheck`, and `npm run build`.
- [ ] Verify login, session start, answer submit, history, graph view, and attachment upload.
- [ ] Confirm CI passes on GitHub.
- [ ] Deploy backend, then deploy frontend with the backend URL.
- [ ] Smoke test production with a new user account.

# KKUMDREAM Backend

FastAPI backend for 꿈드림.

## Responsibilities

- Authenticated REST API
- Dream draft, give, inbox, outbox, room APIs
- AI text generation orchestration
- AI image generation job queue
- Cloudflare R2 image upload
- Firebase push notification dispatch
- Cost and generation logs

## Local Setup

```powershell
cd KKUMDREAM/backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements-dev.txt
copy .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

Python is not currently available through this machine's PATH except the Windows Store alias. Install Python 3.12 or disable the Windows Store `python.exe` alias before running the commands.

## Database Migrations

Use Alembic for all schema changes:

```powershell
alembic upgrade head
alembic revision --autogenerate -m "describe schema change"
```

`python scripts/create_tables.py` is kept as a compatibility shortcut and now runs `alembic upgrade head`.

## Mock Mode

`AI_MOCK_MODE=true` lets the API generate deterministic dream text without paid AI calls. Use it until auth, DB, and the compose flow are stable.

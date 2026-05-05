# Database And Migrations

KKUMDREAM uses PostgreSQL as the source of truth. The mobile app may cache data in MMKV, but user accounts, rooms, dreams, comments, reactions, AI jobs, and device tokens belong in PostgreSQL.

## Migration Tool

The backend uses Alembic.

Run all migrations:

```powershell
cd C:\dev\KkumDream\KKUMDREAM\backend
conda activate kkumdream
alembic upgrade head
```

The compatibility script does the same thing:

```powershell
python scripts/create_tables.py
```

Create a new migration after changing SQLAlchemy models:

```powershell
alembic revision --autogenerate -m "describe schema change"
```

Review the generated file under `backend/alembic/versions` before applying it. Autogenerate is useful, but it is not a substitute for reading the migration.

Rollback the latest migration locally:

```powershell
alembic downgrade -1
```

Check current migration state:

```powershell
alembic current
alembic history
```

## Existing Local Databases

If a local database was created with the old `Base.metadata.create_all()` script and it only contains disposable development data, the cleanest path is to recreate that database and run:

```powershell
alembic upgrade head
```

If an existing database already matches the initial schema and must be kept, mark it as migrated:

```powershell
alembic stamp head
```

Only use `stamp` when the schema already matches the migration. It records version state without changing tables.

## Initial Schema

The first migration creates these tables:

- `users`: Google/mock user identity and profile data.
- `device_tokens`: Firebase Cloud Messaging tokens per user/device.
- `friendships`: friend request and accepted friendship state.
- `groups`: dream rooms owned by a user.
- `group_members`: room membership and role.
- `dreams`: draft/given/opened/replied dream cards.
- `dream_comments`: card comments, including highlighted owner comments.
- `dream_reactions`: per-user card reactions.
- `daily_give_limits`: one-dream-per-day enforcement.
- `ai_generation_jobs`: database-backed image generation queue.
- `ai_generation_logs`: AI text/image cost and status audit log.

## Data Ownership

Use PostgreSQL for:

- user accounts and provider identity
- friend and group relationships
- sent and received dreams
- comments and reactions
- daily limits
- AI job state and generation logs
- device push tokens

Use Cloudflare R2 or another object store for:

- generated card images
- thumbnails
- profile images
- future audio or file attachments

Use mobile MMKV only for:

- app access token
- current user cache
- recent API response cache
- temporary draft UI state

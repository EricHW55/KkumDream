# KKUMDREAM

꿈드림 앱 개발 루트입니다.

## Stack

- Frontend: React Native CLI + TypeScript
- Backend: Python 3.12 + FastAPI
- DB/Auth: PostgreSQL / Supabase
- Storage: Cloudflare R2
- Push: Firebase Cloud Messaging

## Project Layout

```txt
KKUMDREAM/
  backend/  FastAPI API server, AI generation worker
  mobile/   React Native CLI TypeScript app
  docs/     Architecture and setup notes
```

## Development Order

1. Backend data model and API contract
2. Mobile navigation and Dream card UI
3. Compose flow with mock AI response
4. Supabase Auth and PostgreSQL connection
5. R2 image upload and AI image worker
6. Firebase push notification

See:

- `docs/architecture.md`
- `docs/database.md`
- `docs/development.md`
- `docs/next_milestones.md`

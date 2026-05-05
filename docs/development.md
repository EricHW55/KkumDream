# Development Setup

## Prerequisites

- Node.js 22.11 or newer
- npm
- Python 3.12
- Android Studio for Android builds
- Xcode and CocoaPods for iOS builds
- Supabase project
- Cloudflare R2 bucket
- Firebase project for FCM

## Backend

```powershell
cd KKUMDREAM/backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements-dev.txt
copy .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

Local mock auth is enabled by setting `AUTH_MOCK_USER_ID` in `.env`.

`python scripts/create_tables.py` is still available as a shortcut for `alembic upgrade head`.

## Image Worker

```powershell
cd KKUMDREAM/backend
.\.venv\Scripts\activate
python -m app.workers.image_worker
```

Keep `AI_MOCK_MODE=true` until the core compose flow is stable. In mock mode, no paid AI or R2 call is made.

## Mobile

```powershell
cd KKUMDREAM/mobile
npm.cmd install
npm.cmd run android
```

For iOS:

```bash
cd KKUMDREAM/mobile/ios
bundle install
bundle exec pod install
cd ..
npm run ios
```

The Android emulator reaches the local backend through:

```txt
http://10.0.2.2:8000/api/v1
```

Change `mobile/src/config/env.ts` for a device build or deployed API.

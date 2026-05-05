# Auth And Deployment Setup

## Architecture

KKUMDREAM uses this production auth/data flow:

1. The mobile app signs in with Google and receives a Google `idToken`.
2. The app sends that `idToken` to `POST /api/v1/auth/google`.
3. The backend verifies the Google token, creates or updates a `users` row, and returns a KKUMDREAM access token.
4. The app stores the KKUMDREAM token and user profile in MMKV.
5. On later app launches, the app reads MMKV and enters the app without asking the user to log in again.
6. API calls send `Authorization: Bearer <token>`, and the backend uses that user id to return that user's rooms, inbox, outbox, and drafts.

The backend remains the source of truth. The mobile app caches data locally to reduce repeat reads and keep the UI responsive.

## Google Login Setup

Create OAuth clients in Google Cloud Console.

Android:

1. Find the Android package name in `mobile/android/app/build.gradle`.
   Current value:

   ```txt
   com.kkumdreammobile
   ```

2. Get the debug SHA-1 fingerprint:

   ```powershell
   cd C:\dev\KkumDream\KKUMDREAM\mobile\android
   .\gradlew.bat signingReport
   ```

3. In Google Cloud Console, create an OAuth client of type `Android` with:

   ```txt
   Package name: com.kkumdreammobile
   SHA-1: <debug or release SHA-1>
   ```

4. Also create an OAuth client of type `Web application`.

5. Put the Web client id in:

   ```ts
   // mobile/src/config/env.ts
   export const GOOGLE_WEB_CLIENT_ID = '...apps.googleusercontent.com';
   ```

Backend:

Set the same Web client id:

```env
GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com
```

## Local Backend

Use PostgreSQL locally. The backend expects an async SQLAlchemy URL:

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/kkumdream
APP_JWT_SECRET=replace-with-a-long-random-secret
GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com
AUTH_MOCK_USER_ID=
AI_MOCK_MODE=true
```

Important:

- Leave `AUTH_MOCK_USER_ID` empty when testing real Google login.
- If `AUTH_MOCK_USER_ID` is set, local requests without a bearer token use that mock user.
- Requests with a KKUMDREAM bearer token still use the token user.

Run database migrations:

```powershell
cd C:\dev\KkumDream\KKUMDREAM\backend
conda activate kkumdream
alembic upgrade head
```

`python scripts/create_tables.py` is kept as a compatibility shortcut and runs the same migration upgrade.

Run API:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Mobile

Install deps:

```bash
cd /c/dev/KkumDream/KKUMDREAM/mobile
npm install
```

Run Metro:

```bash
npm start
```

Run Android:

```bash
npm run android
```

The app calls:

```txt
http://10.0.2.2:8000/api/v1
```

`10.0.2.2` points from Android Emulator to the host PC.

## Production Hosting Recommendation

For the cheapest practical production path:

1. Backend: Render Web Service, Fly.io, or Railway.
2. Database: Managed PostgreSQL.
3. Storage: Cloudflare R2 for generated images.
4. Push: Firebase Cloud Messaging.

Recommended first setup:

- Backend on Render Web Service.
- PostgreSQL on Render Postgres or Supabase Postgres.
- Keep AI generation in mock mode until auth, rooms, and dream flows are stable.

Backend environment variables in production:

```env
ENVIRONMENT=production
DATABASE_URL=postgresql+asyncpg://...
APP_JWT_SECRET=<long random secret>
GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com
AI_MOCK_MODE=false
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
REPLICATE_API_TOKEN=...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...
R2_PUBLIC_BASE_URL=https://...
FIREBASE_CREDENTIALS_JSON=...
```

Run command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## Database Choice

Use PostgreSQL.

Why:

- The backend already uses SQLAlchemy + asyncpg.
- User, dream, group, friendship, comment, reaction, and daily limit tables are relational.
- Managed Postgres is cheap enough at small scale and avoids building sync logic around app-only storage.

Use app-local MMKV for:

- Auth session token and current user.
- Cached room/inbox/outbox data.
- Draft UI state if needed later.

Do not use app-local storage as the source of truth for:

- User accounts.
- Friend/group membership.
- Sent/received dreams.
- Comments/reactions.

Those must live in PostgreSQL so the same user sees the same data across devices.

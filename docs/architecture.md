# KKUMDREAM Architecture

## Runtime Components

```txt
React Native app
  -> FastAPI REST API
      -> Supabase PostgreSQL
      -> AI text provider
      -> ai_generation_jobs table
  -> Image worker
      -> Replicate FLUX schnell
      -> Cloudflare R2
      -> FastAPI DB update
  -> Firebase Cloud Messaging
```

## Core Rules

- A dream is not complete without a receiver.
- `receiver_id` and `group_id` are mutually exclusive.
- A user can give at most one dream per day.
- Text generation happens at draft time.
- Image generation happens once, only when `draft -> given`.
- Given dreams are not deleted by the giver.
- The card is rendered by the app; only generated artwork is stored as an image.

## MVP Queue Strategy

The MVP uses the database as the job queue through `ai_generation_jobs`.

This keeps the initial stack smaller than Celery + Redis while still preserving the important async boundary:

```txt
POST /dreams/{id}/give
  -> status = given
  -> image_status = queued
  -> ai_generation_jobs row inserted
  -> worker generates/upload image
  -> image_status = ready
```

Introduce Redis/Celery later when queue throughput, retry visibility, or scheduling becomes a real bottleneck.


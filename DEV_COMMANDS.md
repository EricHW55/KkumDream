# KKUMDREAM Local Dev Commands

## 1. Backend

Open **Anaconda Prompt** or a PowerShell where conda works.

```powershell
conda activate kkumdream
cd C:\dev\KkumDream\KKUMDREAM\backend
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Run the `copy .env.example .env` command only once, or when `.env` does not exist.

Backend docs should open at:

```txt
http://127.0.0.1:8000/docs
```

## 2. Metro

Open **Git Bash** in another terminal.

```bash
cd /c/dev/KkumDream/KKUMDREAM/mobile
npm start
```

Keep this terminal running.

## 3. Android Emulator

Open **Android Studio**.

```txt
Device Manager > start an emulator
```

The app already points to:

```txt
http://10.0.2.2:8000/api/v1
```

`10.0.2.2` is the Android emulator address for the backend running on this PC.

## 4. Run The App

After the backend, Metro, and emulator are running, open another **Git Bash** terminal.

```bash
cd /c/dev/KkumDream/KKUMDREAM/mobile
npm run android
```

## Quick Check Commands

Backend environment:

```powershell
conda activate kkumdream
python --version
python -c "import fastapi, uvicorn; print('backend deps ok')"
```

Mobile:

```bash
cd /c/dev/KkumDream/KKUMDREAM/mobile
npm run lint
npm test -- --runInBand
```

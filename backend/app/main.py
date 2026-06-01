import asyncio
import json
from contextlib import asynccontextmanager
from html import escape
from urllib.parse import quote

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse

from app.api.router import api_router
from app.core.config import settings
from app.core.scheduler import run_billing_reconciliation_loop, run_midnight_cleanup_loop


@asynccontextmanager
async def _lifespan(app: FastAPI):
    settings.validate_production_settings()
    cleanup_task = asyncio.create_task(run_midnight_cleanup_loop())
    billing_configured = (
        settings.google_play_service_account_json or settings.google_play_service_account_file
    )
    billing_task = (
        asyncio.create_task(run_billing_reconciliation_loop())
        if billing_configured
        else None
    )
    try:
        yield
    finally:
        tasks = [task for task in (cleanup_task, billing_task) if task is not None]
        for task in tasks:
            task.cancel()
        for task in tasks:
            try:
                await task
            except asyncio.CancelledError:
                pass


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=_lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/d/{dream_id}", response_class=HTMLResponse, include_in_schema=False)
    async def dream_share_landing(dream_id: str, claim: str | None = None) -> HTMLResponse:
        encoded_dream_id = quote(dream_id, safe="")
        deep_link = f"kkumdream://d/{encoded_dream_id}"
        if claim:
            deep_link = f"{deep_link}?claim={quote(claim, safe='')}"
        html = _build_share_landing_html(
            deep_link=deep_link,
            play_store_url=settings.android_play_store_url,
            app_store_url=settings.ios_app_store_url,
        )
        return HTMLResponse(html)

    @app.get("/account-deletion", response_class=HTMLResponse, include_in_schema=False)
    async def account_deletion_page() -> HTMLResponse:
        return HTMLResponse(
            _build_account_deletion_html(
                app_name="꿈드림",
                support_email=settings.app_support_email,
            )
        )

    @app.get("/child-safety", response_class=HTMLResponse, include_in_schema=False)
    async def child_safety_page() -> HTMLResponse:
        return HTMLResponse(
            _build_child_safety_html(
                app_name=settings.app_name,
                support_email=settings.app_support_email,
            )
        )

    @app.get("/.well-known/assetlinks.json", include_in_schema=False)
    async def android_asset_links() -> JSONResponse:
        if not settings.android_app_link_sha256_fingerprints:
            return JSONResponse([])
        return JSONResponse(
            [
                {
                    "relation": ["delegate_permission/common.handle_all_urls"],
                    "target": {
                        "namespace": "android_app",
                        "package_name": settings.android_package_name,
                        "sha256_cert_fingerprints": (
                            settings.android_app_link_sha256_fingerprints
                        ),
                    },
                }
            ]
        )

    @app.get("/.well-known/apple-app-site-association", include_in_schema=False)
    async def apple_app_site_association() -> JSONResponse:
        details = []
        if settings.ios_app_id:
            details.append({"appIDs": [settings.ios_app_id], "components": [{"/": "/d/*"}]})
        return JSONResponse({"applinks": {"details": details}})

    return app


app = create_app()


def _build_share_landing_html(
    deep_link: str,
    play_store_url: str,
    app_store_url: str,
) -> str:
    escaped_deep_link = escape(deep_link, quote=True)
    js_deep_link = json.dumps(deep_link)
    js_play_store_url = json.dumps(play_store_url)
    js_app_store_url = json.dumps(app_store_url)
    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>꿈카드 받기</title>
  <style>
    body {{
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #fbfafd;
      color: #27252b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    main {{
      width: min(420px, calc(100vw - 40px));
      padding: 28px;
      border: 1px solid #e5dff5;
      border-radius: 24px;
      background: #fff;
      box-shadow: 0 16px 40px rgba(91, 73, 176, 0.12);
    }}
    h1 {{ margin: 0 0 10px; font-size: 26px; }}
    p {{ margin: 0 0 18px; color: #686570; line-height: 1.55; }}
    a {{
      display: block;
      min-height: 52px;
      border-radius: 16px;
      background: #6250b7;
      color: white;
      text-align: center;
      line-height: 52px;
      text-decoration: none;
      font-weight: 700;
    }}
  </style>
</head>
<body>
  <main>
    <h1>꿈카드 받기</h1>
    <p>앱이 설치되어 있으면 꿈드림이 열리고, 설치되어 있지 않으면 설치 페이지로 이동합니다.</p>
    <a id="open-app" href="{escaped_deep_link}">앱에서 열기</a>
  </main>
  <script>
    const deepLink = {js_deep_link};
    const playStoreUrl = {js_play_store_url};
    const appStoreUrl = {js_app_store_url};
    const ua = navigator.userAgent || "";
    const fallbackUrl = /iPhone|iPad|iPod/i.test(ua) ? appStoreUrl : playStoreUrl;
    const startedAt = Date.now();
    window.location.href = deepLink;
    window.setTimeout(() => {{
      if (Date.now() - startedAt < 2200) {{
        window.location.href = fallbackUrl;
      }}
    }}, 1400);
    </script>
</body>
</html>"""


def _build_child_safety_html(app_name: str, support_email: str) -> str:
    escaped_app_name = escape(app_name)
    escaped_email = escape(support_email, quote=True)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{escaped_app_name} Child Safety Standards</title>
  <style>
    :root {{
      color-scheme: light;
      --ink: #27252b;
      --muted: #5e5a66;
      --line: #e8e0f6;
      --paper: #fcf9ff;
      --accent: #6f5ad7;
      --accent-soft: rgba(111, 90, 215, 0.08);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      min-height: 100vh;
      background: linear-gradient(180deg, #fcfaff 0%, #f6f3ff 100%);
      color: var(--ink);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.65;
    }}
    main {{
      width: min(860px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 48px 0 64px;
    }}
    article {{
      padding: 36px;
      border: 1px solid var(--line);
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 20px 48px rgba(73, 57, 120, 0.12);
    }}
    h1 {{
      margin: 0 0 12px;
      font-size: clamp(30px, 5vw, 46px);
      line-height: 1.15;
    }}
    h2 {{
      margin: 28px 0 10px;
      font-size: 20px;
    }}
    p, li {{ color: var(--muted); }}
    ul {{ padding-left: 22px; }}
    a {{
      color: var(--accent);
      font-weight: 700;
    }}
    .notice {{
      margin-top: 24px;
      padding: 16px 18px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--accent-soft);
    }}
  </style>
</head>
<body>
  <main>
    <article>
      <h1>{escaped_app_name} Child Safety Standards</h1>
      <p>
        {escaped_app_name} is committed to protecting children and preventing child sexual abuse and exploitation (CSAE).
        We do not allow content, behavior, or interactions that exploit, sexualize, or endanger minors.
      </p>

      <h2>Our standards</h2>
      <ul>
        <li>Any CSAE content is strictly prohibited.</li>
        <li>Users may not use the service to groom, exploit, threaten, or sexualize minors.</li>
        <li>Users may not upload or share abusive images, videos, messages, or links involving minors.</li>
        <li>We may remove violating content, restrict accounts, and preserve records as required for safety and legal compliance.</li>
      </ul>

      <h2>Reporting concerns</h2>
      <p>
        Users can report safety concerns, abusive content, or harmful behavior by contacting
        <a href="mailto:{escaped_email}?subject={escaped_app_name}%20Child%20Safety%20Report">{escaped_email}</a>.
        Reports related to child safety are reviewed with priority.
      </p>

      <h2>Enforcement</h2>
      <p>
        When we identify content or behavior that may involve child exploitation or abuse, we may remove the content,
        suspend or terminate involved accounts, and report relevant information to appropriate authorities or organizations
        when legally required.
      </p>

      <div class="notice">
        For urgent child safety concerns involving immediate risk, contact local law enforcement first and then notify us at
        <a href="mailto:{escaped_email}">{escaped_email}</a>.
      </div>
    </article>
  </main>
</body>
</html>"""


def _build_account_deletion_html(app_name: str, support_email: str) -> str:
    escaped_app_name = escape(app_name)
    escaped_email = escape(support_email, quote=True)
    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{escaped_app_name} 계정 삭제 안내</title>
  <style>
    :root {{
      color-scheme: light;
      --ink: #2f2a24;
      --muted: #70675d;
      --line: #e4d6c5;
      --paper: #fffaf1;
      --accent: #6f5ad7;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      min-height: 100vh;
      background: linear-gradient(135deg, #fffaf1 0%, #edf7f7 100%);
      color: var(--ink);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif;
      line-height: 1.65;
    }}
    main {{
      width: min(760px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 56px 0;
    }}
    article {{
      padding: 34px;
      border: 1px solid var(--line);
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.82);
      box-shadow: 0 18px 45px rgba(77, 60, 35, 0.1);
    }}
    h1 {{
      margin: 0 0 12px;
      font-size: clamp(28px, 5vw, 42px);
      line-height: 1.2;
    }}
    h2 {{
      margin: 30px 0 10px;
      font-size: 20px;
    }}
    p, li {{ color: var(--muted); }}
    ul, ol {{ padding-left: 22px; }}
    a {{
      color: var(--accent);
      font-weight: 700;
    }}
    .notice {{
      margin-top: 24px;
      padding: 16px 18px;
      border-radius: 14px;
      background: var(--paper);
      border: 1px solid var(--line);
    }}
  </style>
</head>
<body>
  <main>
    <article>
      <h1>{escaped_app_name} 계정 및 데이터 삭제 안내</h1>
      <p>
        {escaped_app_name} 계정 삭제를 원하시면 아래 절차에 따라 요청해 주세요.
        요청을 확인한 뒤 서비스 데이터 삭제를 진행합니다.
      </p>

      <h2>삭제 요청 방법</h2>
      <ol>
        <li>앱에서 사용한 Google 계정 이메일 주소를 확인합니다.</li>
        <li>
          <a href="mailto:{escaped_email}?subject={escaped_app_name}%20계정%20삭제%20요청">
            {escaped_email}
          </a>
          로 계정 삭제 요청 메일을 보냅니다.
        </li>
        <li>메일 제목에 "{escaped_app_name} 계정 삭제 요청"을 적고, 본문에 가입 이메일 주소를 함께 적어 주세요.</li>
      </ol>

      <h2>삭제되는 데이터</h2>
      <ul>
        <li>계정 식별 정보와 프로필 정보</li>
        <li>꿈 기록, 꿈 카드, 댓글, 반응 등 사용자가 생성한 콘텐츠</li>
        <li>앱 이용을 위해 서버에 저장된 기기 및 알림 관련 정보</li>
      </ul>

      <h2>일부 보관될 수 있는 데이터</h2>
      <p>
        결제, 환불, 보안, 부정 이용 방지, 법적 의무 이행을 위해 필요한 기록은 관련 법령,
        앱 마켓 정책, 내부 보안 정책에 따라 제한된 기간 보관될 수 있습니다.
      </p>

      <div class="notice">
        계정 삭제가 완료되면 같은 계정으로 다시 로그인하더라도 이전 데이터는 복구되지 않을 수 있습니다.
      </div>
    </article>
  </main>
</body>
</html>"""

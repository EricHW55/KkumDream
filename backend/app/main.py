import asyncio
import json
from contextlib import asynccontextmanager
from html import escape
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.core.scheduler import run_billing_reconciliation_loop, run_midnight_cleanup_loop

STATIC_DIR = Path(__file__).resolve().parent / "static"


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
    if STATIC_DIR.exists():
        app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    async def marketing_landing_page() -> HTMLResponse:
        return HTMLResponse(
            _build_marketing_landing_html(
                play_store_url=settings.android_play_store_url,
                app_store_url=settings.ios_app_store_url,
                support_email=settings.app_support_email,
            )
        )

    @app.get("/support", response_class=HTMLResponse, include_in_schema=False)
    async def support_page() -> HTMLResponse:
        return HTMLResponse(
            _build_support_html(
                play_store_url=settings.android_play_store_url,
                app_store_url=settings.ios_app_store_url,
                support_email=settings.app_support_email,
            )
        )

    @app.get("/admin/moderation", response_class=HTMLResponse, include_in_schema=False)
    async def moderation_admin_page() -> HTMLResponse:
        return HTMLResponse(_build_moderation_admin_html())

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

    @app.get("/r/{invite_code}", response_class=HTMLResponse, include_in_schema=False)
    async def room_invite_landing(invite_code: str) -> HTMLResponse:
        encoded_invite_code = quote(invite_code, safe="")
        deep_link = f"kkumdream://r/{encoded_invite_code}"
        html = _build_share_landing_html(
            deep_link=deep_link,
            play_store_url=settings.android_play_store_url,
            app_store_url=settings.ios_app_store_url,
            title="꿈방 초대",
            heading="꿈방 초대",
            description=(
                "앱이 설치되어 있으면 꿈드림이 열려 꿈방에 참가하고, "
                "설치되어 있지 않으면 설치 페이지로 이동합니다."
            ),
            button_label="앱에서 꿈방 참가",
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

    @app.get("/privacy", response_class=HTMLResponse, include_in_schema=False)
    async def privacy_policy_page() -> HTMLResponse:
        return HTMLResponse(
            _build_privacy_policy_html(
                app_name="꿈드림",
                support_email=settings.app_support_email,
            )
        )

    @app.get("/terms", response_class=HTMLResponse, include_in_schema=False)
    async def terms_of_service_page() -> HTMLResponse:
        return HTMLResponse(
            _build_terms_html(
                app_name="꿈드림",
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
            details.append(
                {
                    "appIDs": [settings.ios_app_id],
                    "components": [{"/": "/d/*"}, {"/": "/r/*"}],
                }
            )
        return JSONResponse({"applinks": {"details": details}})

    return app


app = create_app()


def _is_store_url_ready(url: str | None) -> bool:
    return bool(url and url.strip().startswith(("https://", "http://")))


def _store_button_html(label: str, url: str | None, platform_class: str) -> str:
    escaped_label = escape(label)
    if _is_store_url_ready(url):
        escaped_url = escape(url.strip(), quote=True)
        return (
            f'<a class="store-button {platform_class}" href="{escaped_url}" '
            'target="_blank" rel="noopener noreferrer">'
            f"<span>바로가기</span><strong>{escaped_label}</strong></a>"
        )
    return (
        f'<span class="store-button disabled {platform_class}" aria-disabled="true">'
        f"<span>준비 중</span><strong>{escaped_label}</strong></span>"
    )


def _store_buttons_html(play_store_url: str | None, app_store_url: str | None) -> str:
    return (
        _store_button_html("Google Play", play_store_url, "play")
        + _store_button_html("App Store", app_store_url, "apple")
    )


def _build_marketing_landing_html(
    play_store_url: str,
    app_store_url: str,
    support_email: str,
) -> str:
    store_buttons = _store_buttons_html(play_store_url, app_store_url)
    escaped_email = escape(support_email, quote=True)
    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="오늘 꾼 꿈을, 친구에게 선물해요. 꿈드림은 꿈을 작은 카드로 만들어 가까운 사람에게 전하는 앱입니다." />
  <meta property="og:title" content="꿈드림" />
  <meta property="og:description" content="오늘 꾼 꿈을, 친구에게 선물해요." />
  <title>꿈드림 - 오늘 꾼 꿈을, 친구에게 선물해요</title>
  <style>
    :root {{
      color-scheme: light;
      --ink: #2f2a24;
      --muted: #6f665d;
      --paper: #fffaf1;
      --cream: #fff7e8;
      --mint: #dfeeed;
      --peach: #f6c7ad;
      --violet: #6f5ad7;
      --violet-deep: #433579;
      --line: rgba(91, 71, 42, 0.16);
    }}
    * {{ box-sizing: border-box; }}
    html {{ scroll-behavior: smooth; }}
    body {{
      margin: 0;
      color: var(--ink);
      background:
        linear-gradient(180deg, rgba(255, 250, 241, 0.92), rgba(237, 247, 247, 0.94)),
        url("/static/marketing/paper_texture.webp");
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif;
      letter-spacing: 0;
    }}
    a {{ color: inherit; }}
    .page {{
      min-height: 100vh;
      overflow: hidden;
    }}
    .hero {{
      position: relative;
      min-height: 92svh;
      display: grid;
      grid-template-rows: auto 1fr auto;
      width: min(1120px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 24px 0 18px;
    }}
    nav {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-height: 48px;
    }}
    .brand {{
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      color: var(--violet-deep);
      text-decoration: none;
    }}
    .brand img {{
      width: 38px;
      height: 38px;
      border-radius: 10px;
      box-shadow: 0 8px 18px rgba(67, 53, 121, 0.16);
    }}
    .nav-links {{
      display: flex;
      align-items: center;
      gap: 18px;
      font-size: 14px;
      color: var(--muted);
    }}
    .nav-links a {{
      text-decoration: none;
    }}
    .hero-main {{
      position: relative;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(300px, 440px);
      align-items: center;
      gap: 44px;
      padding: 38px 0 28px;
      z-index: 1;
    }}
    .eyebrow {{
      margin: 0 0 14px;
      color: var(--violet);
      font-size: 15px;
      font-weight: 800;
    }}
    h1 {{
      margin: 0;
      font-size: clamp(48px, 9vw, 92px);
      line-height: 0.98;
      color: var(--violet-deep);
    }}
    .tagline {{
      margin: 18px 0 0;
      max-width: 580px;
      color: #4b4039;
      font-size: clamp(22px, 4vw, 36px);
      line-height: 1.28;
      font-weight: 800;
    }}
    .lead {{
      margin: 18px 0 0;
      max-width: 620px;
      color: var(--muted);
      font-size: 18px;
      line-height: 1.75;
    }}
    .scene {{
      position: relative;
      min-height: 430px;
      isolation: isolate;
    }}
    .phone {{
      position: absolute;
      right: 38px;
      top: 42px;
      width: min(270px, 66vw);
      height: 390px;
      border: 1px solid rgba(67, 53, 121, 0.18);
      border-radius: 38px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(255, 247, 232, 0.84)),
        url("/static/marketing/paper_texture.webp");
      box-shadow: 0 24px 70px rgba(67, 53, 121, 0.18);
      overflow: hidden;
      transform: rotate(2deg);
    }}
    .phone::before {{
      content: "";
      position: absolute;
      inset: 18px 18px auto;
      height: 7px;
      border-radius: 999px;
      background: rgba(67, 53, 121, 0.16);
    }}
    .dream-card {{
      position: absolute;
      left: 28px;
      right: 28px;
      top: 64px;
      padding: 24px 22px;
      border: 1px solid rgba(111, 90, 215, 0.18);
      border-radius: 22px;
      background: rgba(255, 250, 241, 0.9);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.62);
    }}
    .dream-card strong {{
      display: block;
      color: var(--violet-deep);
      font-size: 24px;
      margin-bottom: 14px;
    }}
    .dream-card p {{
      margin: 0;
      color: var(--muted);
      line-height: 1.7;
    }}
    .message-chip {{
      position: absolute;
      left: 30px;
      right: 30px;
      bottom: 34px;
      padding: 16px 18px;
      border-radius: 20px 20px 20px 8px;
      background: #f7d783;
      color: #4b4039;
      font-weight: 800;
      line-height: 1.45;
    }}
    .moon-art {{
      position: absolute;
      width: 220px;
      right: 212px;
      top: 0;
      opacity: 0.94;
      filter: drop-shadow(0 14px 24px rgba(111, 90, 215, 0.18));
      transform: rotate(-8deg);
      z-index: -1;
    }}
    .star-art {{
      position: absolute;
      width: 98px;
      right: 0;
      top: 264px;
      opacity: 0.9;
      transform: rotate(12deg);
    }}
    .small-star {{
      position: absolute;
      width: 54px;
      left: 22px;
      bottom: 52px;
      opacity: 0.86;
      transform: rotate(-16deg);
    }}
    .store-panel {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      padding: 16px 0 0;
      border-top: 1px solid var(--line);
    }}
    .store-copy {{
      margin: 0;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.5;
    }}
    .store-buttons {{
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }}
    .store-button {{
      min-width: 150px;
      min-height: 54px;
      display: grid;
      align-content: center;
      padding: 8px 18px;
      border-radius: 15px;
      color: white;
      background: #2f2a24;
      text-decoration: none;
      box-shadow: 0 12px 26px rgba(47, 42, 36, 0.16);
    }}
    .store-button span {{
      font-size: 11px;
      opacity: 0.74;
    }}
    .store-button strong {{
      font-size: 17px;
      line-height: 1.1;
    }}
    .store-button.apple {{
      background: var(--violet-deep);
    }}
    .store-button.disabled {{
      color: #7d756c;
      background: rgba(255, 255, 255, 0.72);
      border: 1px dashed rgba(111, 90, 215, 0.32);
      box-shadow: none;
    }}
    section {{
      border-top: 1px solid var(--line);
    }}
    .section-inner {{
      width: min(1040px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 72px 0;
    }}
    h2 {{
      margin: 0 0 14px;
      color: var(--violet-deep);
      font-size: clamp(28px, 5vw, 44px);
      line-height: 1.2;
    }}
    .section-lead {{
      margin: 0;
      max-width: 720px;
      color: var(--muted);
      font-size: 17px;
      line-height: 1.8;
    }}
    .features {{
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
      margin-top: 30px;
    }}
    .feature {{
      min-height: 170px;
      padding: 24px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.54);
    }}
    .feature b {{
      display: block;
      margin-bottom: 10px;
      color: var(--ink);
      font-size: 18px;
    }}
    .feature p {{
      margin: 0;
      color: var(--muted);
      line-height: 1.7;
    }}
    .flow {{
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-top: 30px;
      counter-reset: step;
    }}
    .flow li {{
      list-style: none;
      min-height: 118px;
      padding: 20px;
      border-top: 3px solid var(--peach);
      background: rgba(255, 250, 241, 0.6);
      color: var(--muted);
      line-height: 1.65;
    }}
    .flow li::before {{
      counter-increment: step;
      content: counter(step);
      display: block;
      margin-bottom: 8px;
      color: var(--violet);
      font-weight: 900;
    }}
    footer {{
      border-top: 1px solid var(--line);
      color: var(--muted);
    }}
    footer .section-inner {{
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 30px 0;
      font-size: 14px;
    }}
    footer a {{
      color: var(--violet-deep);
      font-weight: 700;
      text-decoration: none;
    }}
    @media (max-width: 820px) {{
      .hero {{
        min-height: 94svh;
      }}
      .hero-main {{
        grid-template-columns: 1fr;
        gap: 8px;
        padding-top: 24px;
      }}
      .scene {{
        min-height: 330px;
      }}
      .phone {{
        right: 50%;
        top: 20px;
        transform: translateX(50%) rotate(1.5deg);
        height: 312px;
      }}
      .moon-art {{
        right: calc(50% + 72px);
        width: 170px;
      }}
      .star-art {{
        right: calc(50% - 190px);
        top: 214px;
      }}
      .store-panel {{
        align-items: stretch;
        flex-direction: column;
      }}
      .store-buttons {{
        justify-content: stretch;
      }}
      .store-button {{
        flex: 1 1 150px;
      }}
      .features,
      .flow {{
        grid-template-columns: 1fr;
      }}
      .nav-links {{
        gap: 12px;
      }}
      footer .section-inner {{
        flex-direction: column;
      }}
    }}
  </style>
</head>
<body>
  <div class="page">
    <header class="hero">
      <nav>
        <a class="brand" href="/">
          <img src="/static/marketing/app_icon_dawn_moon.png" alt="" />
          <span>꿈드림</span>
        </a>
        <div class="nav-links">
          <a href="#features">앱 소개</a>
          <a href="/support">지원</a>
        </div>
      </nav>
      <div class="hero-main">
        <div>
          <p class="eyebrow">꿈을 카드로 만들어 전하는 작은 선물</p>
          <h1>꿈드림</h1>
          <p class="tagline">오늘 꾼 꿈을, 친구에게 선물해요.</p>
          <p class="lead">
            잠에서 깬 뒤 희미하게 남은 장면을 적으면, 꿈드림이 짧은 이야기와 그림 카드로
            다듬어 줍니다. 혼자 간직하던 꿈을 가까운 사람에게 조용히 건넬 수 있어요.
          </p>
        </div>
        <div class="scene" aria-hidden="true">
          <img class="moon-art" src="/static/marketing/dream_loading_moon.png" alt="" />
          <img class="star-art" src="/static/marketing/dream_loading_star.png" alt="" />
          <img class="small-star" src="/static/marketing/star_violet.png" alt="" />
          <div class="phone">
            <div class="dream-card">
              <strong>달빛 버스 정류장</strong>
              <p>비 대신 내려온 종이 조각들이 꿈의 장면을 작은 카드로 접어 줍니다.</p>
            </div>
            <div class="message-chip">이 꿈, 너에게 보내고 싶었어.</div>
          </div>
        </div>
      </div>
      <div class="store-panel">
        <p class="store-copy">출시된 스토어는 바로 열리고, 준비 중인 스토어는 준비 중으로 표시됩니다.</p>
        <div class="store-buttons">{store_buttons}</div>
      </div>
    </header>

    <section id="features">
      <div class="section-inner">
        <h2>기억나는 장면만 적어도 괜찮아요.</h2>
        <p class="section-lead">
          꿈드림은 긴 해석보다 장면의 온도를 살립니다. 꿈의 순서와 상징은 지키고,
          친구에게 보낼 수 있는 카드처럼 읽기 쉬운 이야기와 이미지로 정리합니다.
        </p>
        <div class="features">
          <div class="feature">
            <b>꿈 메모 정리</b>
            <p>방금 깬 뒤 남은 단어와 장면을 부드러운 이야기로 다듬습니다.</p>
          </div>
          <div class="feature">
            <b>그림 카드 생성</b>
            <p>동화책 같은 무드와 선택한 질감으로 꿈의 한 장면을 그립니다.</p>
          </div>
          <div class="feature">
            <b>친구에게 선물</b>
            <p>받는 사람에게 맞춘 짧은 메시지와 함께 꿈카드를 보낼 수 있습니다.</p>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div class="section-inner">
        <h2>꿈을 보내는 흐름</h2>
        <p class="section-lead">적고, 고르고, 보냅니다. 꿈방에서는 함께 받은 꿈을 모아볼 수 있어요.</p>
        <ol class="flow">
          <li>오늘 꾼 꿈을 짧게 적습니다.</li>
          <li>말투, 길이, 카드 디자인을 고릅니다.</li>
          <li>이야기와 그림이 만들어집니다.</li>
          <li>친구나 꿈방에 조용히 건넵니다.</li>
        </ol>
      </div>
    </section>

    <footer>
      <div class="section-inner">
        <span>© 꿈드림</span>
        <span>
          <a href="/support">지원</a> ·
          <a href="/privacy">개인정보 처리방침</a> ·
          <a href="/terms">이용약관</a> ·
          <a href="mailto:{escaped_email}">문의</a>
        </span>
      </div>
    </footer>
  </div>
</body>
</html>"""


def _build_support_html(
    play_store_url: str,
    app_store_url: str,
    support_email: str,
) -> str:
    store_buttons = _store_buttons_html(play_store_url, app_store_url)
    escaped_email = escape(support_email, quote=True)
    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>꿈드림 지원</title>
  <style>
    :root {{
      color-scheme: light;
      --ink: #2f2a24;
      --muted: #6f665d;
      --line: rgba(91, 71, 42, 0.16);
      --violet: #6f5ad7;
      --violet-deep: #433579;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      color: var(--ink);
      background:
        linear-gradient(180deg, rgba(255, 250, 241, 0.94), rgba(237, 247, 247, 0.94)),
        url("/static/marketing/paper_texture.webp");
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif;
      line-height: 1.65;
    }}
    main {{
      width: min(880px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 48px 0 72px;
    }}
    header {{
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 24px;
      padding-bottom: 34px;
      border-bottom: 1px solid var(--line);
    }}
    h1 {{
      margin: 0 0 12px;
      color: var(--violet-deep);
      font-size: clamp(36px, 7vw, 64px);
      line-height: 1.1;
    }}
    p {{ color: var(--muted); }}
    .app-icon {{
      width: 112px;
      height: 112px;
      border-radius: 24px;
      box-shadow: 0 18px 34px rgba(67, 53, 121, 0.18);
    }}
    section {{
      padding: 34px 0;
      border-bottom: 1px solid var(--line);
    }}
    h2 {{
      margin: 0 0 14px;
      color: var(--violet-deep);
      font-size: 24px;
    }}
    .contact-row,
    .link-grid {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }}
    .support-link,
    .mail-button {{
      display: block;
      min-height: 58px;
      padding: 16px 18px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.62);
      color: var(--ink);
      text-decoration: none;
      font-weight: 800;
    }}
    .mail-button {{
      background: var(--violet-deep);
      color: white;
      border-color: var(--violet-deep);
    }}
    .store-buttons {{
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }}
    .store-button {{
      min-width: 150px;
      min-height: 54px;
      display: grid;
      align-content: center;
      padding: 8px 18px;
      border-radius: 15px;
      color: white;
      background: #2f2a24;
      text-decoration: none;
    }}
    .store-button span {{
      font-size: 11px;
      opacity: 0.74;
    }}
    .store-button strong {{
      font-size: 17px;
      line-height: 1.1;
    }}
    .store-button.apple {{
      background: var(--violet-deep);
    }}
    .store-button.disabled {{
      color: #7d756c;
      background: rgba(255, 255, 255, 0.72);
      border: 1px dashed rgba(111, 90, 215, 0.32);
    }}
    ul {{
      padding-left: 22px;
      color: var(--muted);
    }}
    footer {{
      padding-top: 26px;
      color: var(--muted);
      font-size: 14px;
    }}
    @media (max-width: 680px) {{
      header {{
        grid-template-columns: 1fr;
      }}
      .contact-row,
      .link-grid {{
        grid-template-columns: 1fr;
      }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>꿈드림 지원</h1>
        <p>
          앱 이용, 결제, 계정, 신고와 안전 문제를 확인할 수 있는 공식 지원 페이지입니다.
          문의가 필요하면 아래 이메일로 보내주세요.
        </p>
      </div>
      <img class="app-icon" src="/static/marketing/app_icon_dawn_moon.png" alt="" />
    </header>

    <section>
      <h2>문의</h2>
      <div class="contact-row">
        <a class="mail-button" href="mailto:{escaped_email}?subject=꿈드림%20문의">이메일로 문의하기</a>
        <a class="support-link" href="mailto:{escaped_email}?subject=꿈드림%20신고%20및%20안전%20문의">신고 및 안전 문의</a>
      </div>
      <p>앱에서 발생한 문제는 사용 중인 기기, 앱 버전, 문제가 발생한 화면을 함께 보내주면 확인이 빠릅니다.</p>
    </section>

    <section>
      <h2>자주 필요한 도움</h2>
      <div class="link-grid">
        <a class="support-link" href="/privacy">개인정보 처리방침</a>
        <a class="support-link" href="/terms">이용약관</a>
        <a class="support-link" href="/account-deletion">계정 및 데이터 삭제 안내</a>
        <a class="support-link" href="/child-safety">아동 안전 기준</a>
      </div>
    </section>

    <section>
      <h2>신고와 차단</h2>
      <ul>
        <li>부적절한 꿈카드나 댓글은 앱 안의 신고 기능으로 접수할 수 있습니다.</li>
        <li>신고가 누적된 콘텐츠는 자동으로 가려지고, 운영자가 검토 후 조치합니다.</li>
        <li>특정 사용자를 보고 싶지 않을 때는 차단 기능을 사용할 수 있습니다.</li>
      </ul>
    </section>

    <section>
      <h2>앱 다운로드</h2>
      <p>스토어 링크가 준비된 플랫폼은 바로 이동할 수 있습니다.</p>
      <div class="store-buttons">{store_buttons}</div>
    </section>

    <footer>
      © 꿈드림 · <a href="mailto:{escaped_email}">{escape(support_email)}</a>
    </footer>
  </main>
</body>
</html>"""


def _build_moderation_admin_html() -> str:
    return """<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>꿈드림 신고 관리</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #25212b;
      --muted: #6b6473;
      --line: #e4deee;
      --paper: #fbf9ff;
      --accent: #5f4ac8;
      --danger: #b83a3a;
      --warn: #9a641c;
      --ok: #2c7458;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f7f4ff;
      color: var(--ink);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif;
      line-height: 1.55;
    }
    main {
      width: min(1180px, calc(100vw - 28px));
      margin: 0 auto;
      padding: 28px 0 60px;
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: end;
      padding-bottom: 22px;
    }
    h1 { margin: 0; font-size: clamp(30px, 5vw, 46px); }
    p { color: var(--muted); }
    .panel {
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.86);
    }
    .token-form {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      margin-bottom: 16px;
    }
    input, select, textarea, button {
      font: inherit;
    }
    input, select, textarea {
      min-height: 44px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px 12px;
      background: white;
      color: var(--ink);
    }
    button {
      min-height: 40px;
      border: 0;
      border-radius: 8px;
      padding: 9px 13px;
      background: var(--accent);
      color: white;
      font-weight: 800;
      cursor: pointer;
    }
    button.secondary { background: #ece7fb; color: var(--accent); }
    button.warn { background: var(--warn); }
    button.danger { background: var(--danger); }
    button.ok { background: var(--ok); }
    button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
      margin: 16px 0;
    }
    .stats {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 16px;
    }
    .stat {
      min-width: 160px;
      padding: 14px 16px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: white;
    }
    .stat b { display: block; font-size: 24px; }
    .reports {
      display: grid;
      gap: 12px;
    }
    .report {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: white;
      overflow: hidden;
    }
    .report-head {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      padding: 16px;
      border-bottom: 1px solid var(--line);
    }
    .report-title {
      margin: 0 0 6px;
      font-weight: 900;
      font-size: 18px;
    }
    .meta {
      color: var(--muted);
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 999px;
      background: #f1ecff;
      color: var(--accent);
      font-size: 12px;
      font-weight: 900;
    }
    .badge.danger {
      background: #ffe9e9;
      color: var(--danger);
    }
    .report-body {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 280px;
      gap: 16px;
      padding: 16px;
    }
    .preview {
      min-height: 120px;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--paper);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .actions {
      display: grid;
      gap: 8px;
      align-content: start;
    }
    .note {
      width: 100%;
      resize: vertical;
    }
    .empty {
      padding: 26px;
      text-align: center;
      color: var(--muted);
    }
    @media (max-width: 820px) {
      header,
      .report-head,
      .report-body,
      .token-form {
        grid-template-columns: 1fr;
      }
      header {
        display: grid;
        align-items: start;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>신고 관리</h1>
        <p>신고된 꿈카드와 댓글을 확인하고 숨김, 복구, 정지, 계정 삭제 조치를 적용합니다.</p>
      </div>
      <a href="/support">지원 페이지</a>
    </header>

    <section class="panel">
      <form class="token-form" id="token-form">
        <input id="admin-token" type="password" autocomplete="current-password" placeholder="ADMIN_API_TOKEN" />
        <button type="submit">관리자 토큰 적용</button>
      </form>
      <div class="toolbar">
        <label>
          상태
          <select id="status-filter">
            <option value="open">open</option>
            <option value="">all</option>
            <option value="resolved">resolved</option>
            <option value="dismissed">dismissed</option>
          </select>
        </label>
        <button class="secondary" id="refresh" type="button">새로고침</button>
      </div>
      <div class="stats" id="stats"></div>
      <div class="reports" id="reports">
        <div class="empty">관리자 토큰을 입력하면 신고 목록이 표시됩니다.</div>
      </div>
    </section>
  </main>

  <script>
    const tokenInput = document.querySelector("#admin-token");
    const tokenForm = document.querySelector("#token-form");
    const statusFilter = document.querySelector("#status-filter");
    const refreshButton = document.querySelector("#refresh");
    const stats = document.querySelector("#stats");
    const reports = document.querySelector("#reports");
    const storedToken = sessionStorage.getItem("kkumdreamAdminToken");
    if (storedToken) {
      tokenInput.value = storedToken;
      loadAll();
    }

    tokenForm.addEventListener("submit", event => {
      event.preventDefault();
      sessionStorage.setItem("kkumdreamAdminToken", tokenInput.value.trim());
      loadAll();
    });
    refreshButton.addEventListener("click", loadAll);
    statusFilter.addEventListener("change", loadAll);

    function headers() {
      return {
        "Content-Type": "application/json",
        "X-Admin-Token": sessionStorage.getItem("kkumdreamAdminToken") || tokenInput.value.trim(),
      };
    }

    async function loadAll() {
      const token = tokenInput.value.trim();
      if (!token) return;
      sessionStorage.setItem("kkumdreamAdminToken", token);
      reports.innerHTML = '<div class="empty">불러오는 중입니다.</div>';
      try {
        const [summaryResponse, reportResponse] = await Promise.all([
          fetch("/api/v1/safety/admin/reports/summary", { headers: headers() }),
          fetch(`/api/v1/safety/admin/reports?status_filter=${encodeURIComponent(statusFilter.value)}&limit=200`, { headers: headers() }),
        ]);
        if (!summaryResponse.ok || !reportResponse.ok) {
          throw new Error("관리자 토큰이 맞지 않거나 요청이 실패했습니다.");
        }
        renderSummary(await summaryResponse.json());
        renderReports(await reportResponse.json());
      } catch (error) {
        reports.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
      }
    }

    function renderSummary(summary) {
      const top = summary.topTargets?.[0];
      stats.innerHTML = `
        <div class="stat"><span>열린 신고</span><b>${summary.openReports ?? 0}</b></div>
        <div class="stat"><span>자동 숨김 기준</span><b>${summary.autoHideThreshold ?? "-"}</b></div>
        <div class="stat"><span>최다 신고 대상</span><b>${top ? top.totalReports : 0}</b></div>
      `;
    }

    function renderReports(items) {
      if (!items.length) {
        reports.innerHTML = '<div class="empty">표시할 신고가 없습니다.</div>';
        return;
      }
      reports.innerHTML = items.map(reportTemplate).join("");
      reports.querySelectorAll("[data-action]").forEach(button => {
        button.addEventListener("click", () => runAction(button.dataset.reportId, button.dataset.action));
      });
    }

    function reportTemplate(report) {
      const target = [report.targetType, report.targetId].filter(Boolean).join(" · ");
      const userState = [
        report.reportedUserDeletedAt ? "삭제됨" : "",
        report.reportedUserSuspendedUntil ? `정지: ${formatDate(report.reportedUserSuspendedUntil)}` : "",
      ].filter(Boolean).join(" · ");
      const hiddenBadge = report.targetHidden ? '<span class="badge danger">숨김</span>' : "";
      const targetActions = targetButtons(report);
      const userActions = report.reportedUserId ? `
        <button class="warn" data-report-id="${report.id}" data-action="suspend_user">7일 정지</button>
        <button class="danger" data-report-id="${report.id}" data-action="delete_user">계정 삭제</button>
      ` : "";
      return `
        <article class="report">
          <div class="report-head">
            <div>
              <p class="report-title">${escapeHtml(report.targetTitle || report.reason || "신고")}</p>
              <div class="meta">
                <span class="badge">${escapeHtml(report.status)}</span>
                ${hiddenBadge}
                ${escapeHtml(target)}
                <br />
                신고자: ${escapeHtml(report.reporterNickname || report.reporterId)}
                · 대상 유저: ${escapeHtml(report.reportedUserNickname || report.reportedUserId || "-")}
                ${userState ? ` · ${escapeHtml(userState)}` : ""}
              </div>
            </div>
            <div class="meta">${formatDate(report.createdAt)}</div>
          </div>
          <div class="report-body">
            <div>
              <div class="preview">${escapeHtml(report.targetContent || "대상 미리보기가 없습니다.")}</div>
              ${report.detail ? `<p><b>신고 상세</b><br />${escapeHtml(report.detail)}</p>` : ""}
              <p class="meta">신고 ID: ${escapeHtml(report.id)}</p>
            </div>
            <div class="actions">
              ${targetActions}
              ${userActions}
              <button class="ok" data-report-id="${report.id}" data-action="mark_resolved">조치 없이 종결</button>
              <button class="secondary" data-report-id="${report.id}" data-action="dismiss_report">신고 기각</button>
            </div>
          </div>
        </article>
      `;
    }

    function targetButtons(report) {
      if (report.targetType === "dream") {
        return `
          <button class="danger" data-report-id="${report.id}" data-action="hide_dream">꿈카드 숨김</button>
          <button class="secondary" data-report-id="${report.id}" data-action="restore_dream">꿈카드 복구</button>
        `;
      }
      if (report.targetType === "comment") {
        return `
          <button class="danger" data-report-id="${report.id}" data-action="hide_comment">댓글 숨김</button>
          <button class="secondary" data-report-id="${report.id}" data-action="restore_comment">댓글 복구</button>
        `;
      }
      return "";
    }

    async function runAction(reportId, action) {
      let durationDays = null;
      if (action === "suspend_user") {
        const input = window.prompt("정지 일수를 입력하세요.", "7");
        if (!input) return;
        durationDays = Number.parseInt(input, 10);
        if (!Number.isInteger(durationDays) || durationDays < 1) {
          window.alert("정지 일수는 1 이상의 숫자여야 합니다.");
          return;
        }
      }
      if (action === "delete_user" && !window.confirm("해당 계정을 삭제 처리할까요? 되돌리기 어렵습니다.")) {
        return;
      }
      const note = window.prompt("관리 메모를 남길 수 있습니다.", "") || null;
      const response = await fetch("/api/v1/safety/admin/actions", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ reportId, action, durationDays, note }),
      });
      if (!response.ok) {
        const body = await response.text();
        window.alert(`조치 실패: ${body}`);
        return;
      }
      await loadAll();
    }

    function formatDate(value) {
      if (!value) return "-";
      try {
        return new Intl.DateTimeFormat("ko-KR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(value));
      } catch {
        return value;
      }
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }
  </script>
</body>
</html>"""


def _build_share_landing_html(
    deep_link: str,
    play_store_url: str,
    app_store_url: str,
    title: str = "꿈카드 받기",
    heading: str = "꿈카드 받기",
    description: str = (
        "앱이 설치되어 있으면 꿈드림이 열리고, "
        "설치되어 있지 않으면 설치 페이지로 이동합니다."
    ),
    button_label: str = "앱에서 열기",
) -> str:
    escaped_deep_link = escape(deep_link, quote=True)
    escaped_title = escape(title)
    escaped_heading = escape(heading)
    escaped_description = escape(description)
    escaped_button_label = escape(button_label)
    js_deep_link = json.dumps(deep_link)
    js_play_store_url = json.dumps(play_store_url)
    js_app_store_url = json.dumps(app_store_url)
    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{escaped_title}</title>
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
    <h1>{escaped_heading}</h1>
    <p>{escaped_description}</p>
    <a id="open-app" href="{escaped_deep_link}">{escaped_button_label}</a>
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
        <li>계정 식별 정보, 로그인 연동 정보, 이메일, 프로필 이미지</li>
        <li>작성 중이던 꿈카드 초안, 댓글, 반응, 친구 및 방 참여 정보</li>
        <li>앱 이용을 위해 서버에 저장된 기기 및 알림 관련 정보</li>
      </ul>

      <h2>일부 보관될 수 있는 데이터</h2>
      <p>
        결제, 환불, 보안, 부정 이용 방지, 법적 의무 이행을 위해 필요한 기록은 관련 법령,
        앱 마켓 정책, 내부 보안 정책에 따라 제한된 기간 보관될 수 있습니다.
        이미 전달된 꿈카드는 수신자 또는 방의 카드 기록으로 남을 수 있으며,
        FROM/TO 표시명은 카드 기록의 일부로 보존될 수 있습니다.
        다만 계정 식별 정보, 로그인 정보, 이메일, 프로필 이미지는 삭제 또는 익명화됩니다.
      </p>

      <div class="notice">
        계정 삭제가 완료되면 같은 계정으로 다시 로그인하더라도 이전 데이터는 복구되지 않을 수 있습니다.
      </div>
    </article>
  </main>
</body>
</html>"""


_LEGAL_PAGE_STYLE = """
    :root {
      color-scheme: light;
      --ink: #2f2a24;
      --muted: #5e5a66;
      --line: #e4d6c5;
      --paper: #fffaf1;
      --accent: #6f5ad7;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: linear-gradient(135deg, #fffaf1 0%, #edf7f7 100%);
      color: var(--ink);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif;
      line-height: 1.65;
    }
    main {
      width: min(760px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 56px 0;
    }
    article {
      padding: 34px;
      border: 1px solid var(--line);
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.82);
      box-shadow: 0 18px 45px rgba(77, 60, 35, 0.1);
    }
    h1 { margin: 0 0 6px; font-size: clamp(28px, 5vw, 42px); line-height: 1.2; }
    h2 { margin: 30px 0 10px; font-size: 20px; }
    p, li { color: var(--muted); }
    ul, ol { padding-left: 22px; }
    a { color: var(--accent); font-weight: 700; }
    .updated { margin: 0 0 18px; font-size: 14px; color: #9a9097; }
    .notice {
      margin-top: 24px;
      padding: 16px 18px;
      border-radius: 14px;
      background: var(--paper);
      border: 1px solid var(--line);
    }
"""

# Bump when the policy/terms text materially changes.
_PRIVACY_LAST_UPDATED = "2026년 6월 10일"
_TERMS_LAST_UPDATED = "2026년 6월 10일"


def _build_privacy_policy_html(app_name: str, support_email: str) -> str:
    escaped_app_name = escape(app_name)
    escaped_email = escape(support_email, quote=True)
    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{escaped_app_name} 개인정보 처리방침</title>
  <style>{_LEGAL_PAGE_STYLE}</style>
</head>
<body>
  <main>
    <article>
      <h1>{escaped_app_name} 개인정보 처리방침</h1>
      <p class="updated">최종 업데이트: {_PRIVACY_LAST_UPDATED}</p>
      <p>
        {escaped_app_name}(이하 "서비스")은 이용자의 개인정보를 소중히 다루며, 관련 법령을 준수합니다.
        본 방침은 서비스가 어떤 정보를 수집하고 어떻게 이용·보관·삭제하는지 설명합니다.
      </p>

      <h2>1. 수집하는 정보</h2>
      <ul>
        <li><strong>계정 정보</strong>: Google 계정으로 로그인할 때 제공되는 이메일 주소, 이름, 프로필 사진.</li>
        <li><strong>프로필 설정</strong>: 이용자가 설정한 닉네임, 선택하거나 직접 업로드한 프로필 이미지.</li>
        <li><strong>이용자 콘텐츠</strong>: 작성한 꿈카드(제목·내용·이미지), 댓글, 반응, 친구 및 방 참여 정보.</li>
        <li><strong>결제 정보</strong>: 구독("꿈드림 패스") 구매 시 앱 마켓이 발급한 구매 영수증·토큰과 구독 활성화 상태.
          실제 카드 번호 등 결제 수단 정보는 Apple App Store 또는 Google Play가 처리하며 서비스는 보관하지 않습니다.</li>
        <li><strong>기기 및 알림 정보</strong>: 푸시 알림 발송을 위한 기기 토큰, 앱 설정 값.</li>
        <li><strong>사진 보관함 접근</strong>: 이용자가 프로필 또는 꿈카드 이미지를 직접 선택·저장할 때에 한해 접근합니다.</li>
      </ul>

      <h2>2. 이용 목적</h2>
      <ul>
        <li>회원 식별 및 로그인, 서비스 제공 및 운영.</li>
        <li>꿈카드 작성·전달·보관, 댓글·친구·방 기능 제공.</li>
        <li>구독 결제 처리 및 권한 관리, 구매 복원.</li>
        <li>푸시 알림 발송(이용자가 설정한 알림에 한함).</li>
        <li>신고·차단 처리, 부정 이용 방지, 서비스 안전 및 법적 의무 이행.</li>
      </ul>

      <h2>3. 제3자 서비스 및 처리 위탁</h2>
      <p>서비스는 운영을 위해 아래 제3자 서비스를 이용합니다.</p>
      <ul>
        <li><strong>Google 로그인</strong> — 회원 인증.</li>
        <li><strong>Firebase Cloud Messaging (Google)</strong> — 푸시 알림 발송.</li>
        <li><strong>AI 이미지 생성 제공자</strong> — 꿈 내용을 바탕으로 한 카드 이미지 생성.</li>
        <li><strong>Apple App Store / Google Play</strong> — 구독 결제 처리.</li>
      </ul>

      <h2>4. 보관 및 삭제</h2>
      <p>
        개인정보는 서비스 제공에 필요한 기간 동안 보관하며, 이용자가 계정을 삭제하면 계정 식별 정보·로그인 정보·이메일·프로필 이미지는
        삭제 또는 익명화됩니다. 자세한 절차는
        <a href="/account-deletion">계정 삭제 안내</a> 페이지를 참고하세요.
        다만 결제·환불·보안·부정 이용 방지·법적 의무 이행에 필요한 기록은 관련 법령과 마켓 정책에 따라 제한된 기간 보관될 수 있습니다.
      </p>

      <h2>5. 아동 보호</h2>
      <p>
        서비스는 아동 대상 성적 학대·착취(CSAE)를 비롯한 아동 위해 콘텐츠를 일절 허용하지 않습니다. 자세한 기준은
        <a href="/child-safety">아동 안전 기준</a> 페이지를 참고하세요.
      </p>

      <h2>6. 보안</h2>
      <p>서비스는 개인정보를 보호하기 위해 합리적인 기술적·관리적 보호 조치를 적용합니다.</p>

      <h2>7. 이용자의 권리</h2>
      <p>
        이용자는 자신의 개인정보 열람·정정·삭제를 요청할 수 있습니다. 요청은 아래 이메일로 접수해 주세요.
      </p>

      <h2>8. 문의</h2>
      <p>
        개인정보 관련 문의는
        <a href="mailto:{escaped_email}?subject={escaped_app_name}%20개인정보%20문의">{escaped_email}</a>
        로 보내주세요.
      </p>

      <div class="notice">
        본 방침이 변경되는 경우 본 페이지를 통해 고지하며, 변경된 방침은 게시한 시점부터 적용됩니다.
      </div>
    </article>
  </main>
</body>
</html>"""


def _build_terms_html(app_name: str, support_email: str) -> str:
    escaped_app_name = escape(app_name)
    escaped_email = escape(support_email, quote=True)
    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{escaped_app_name} 이용약관</title>
  <style>{_LEGAL_PAGE_STYLE}</style>
</head>
<body>
  <main>
    <article>
      <h1>{escaped_app_name} 이용약관</h1>
      <p class="updated">최종 업데이트: {_TERMS_LAST_UPDATED}</p>
      <p>
        본 약관은 {escaped_app_name}(이하 "서비스") 이용에 관한 조건을 정합니다. 서비스를 이용하면 본 약관에 동의한 것으로 봅니다.
      </p>

      <h2>1. 서비스 이용</h2>
      <p>이용자는 관련 법령과 본 약관을 준수하여 서비스를 이용해야 합니다.</p>

      <h2>2. 계정</h2>
      <p>
        서비스는 Google 계정을 통한 로그인을 제공합니다. 이용자는 자신의 계정 활동에 대한 책임이 있으며,
        언제든지 앱 내에서 계정을 삭제할 수 있습니다.
      </p>

      <h2>3. 이용자 콘텐츠 및 금지 행위</h2>
      <p>
        서비스는 이용자가 만든 콘텐츠(꿈카드, 댓글 등)를 다룹니다. 이용자는 다음 행위를 해서는 안 됩니다.
      </p>
      <ul>
        <li>불쾌감을 주거나 모욕적·폭력적·음란하거나 불법적인 콘텐츠 게시.</li>
        <li>타인을 괴롭히거나 위협·차별·사칭하는 행위.</li>
        <li>아동을 위해하거나 성적으로 대상화하는 일체의 콘텐츠 및 행위.</li>
        <li>타인의 권리(개인정보·지식재산권 등) 침해.</li>
      </ul>
      <p>
        <strong>서비스는 불쾌감을 주는 콘텐츠와 가학적 이용자에 대해 무관용 원칙을 적용합니다.</strong>
        이용자는 앱 내 신고 및 차단 기능을 사용할 수 있으며, 접수된 신고는 검토 후 24시간 이내에 조치(콘텐츠 삭제 및 해당 이용자 이용 제한 등)될 수 있습니다.
      </p>

      <h2>4. 구독 및 결제</h2>
      <p>
        "꿈드림 패스"는 자동 갱신 구독입니다. 결제는 Apple App Store 또는 Google Play 계정으로 청구되며,
        구독은 현재 기간 종료 최소 24시간 전에 해지하지 않으면 자동 갱신됩니다. 해지 및 환불은 각 마켓의 구독 관리 화면에서 처리됩니다.
      </p>

      <h2>5. 면책</h2>
      <p>서비스는 관련 법령이 허용하는 범위에서 "있는 그대로" 제공되며, 서비스 이용으로 발생한 손해에 대해 법령이 정한 범위 내에서 책임을 집니다.</p>

      <h2>6. 약관 변경</h2>
      <p>서비스는 필요한 경우 본 약관을 변경할 수 있으며, 변경 시 본 페이지를 통해 고지합니다.</p>

      <h2>7. 문의</h2>
      <p>
        문의는
        <a href="mailto:{escaped_email}?subject={escaped_app_name}%20약관%20문의">{escaped_email}</a>
        로 보내주세요.
      </p>

      <div class="notice">
        개인정보 처리에 관한 사항은 <a href="/privacy">개인정보 처리방침</a>을 참고하세요.
      </div>
    </article>
  </main>
</body>
</html>"""

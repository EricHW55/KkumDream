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

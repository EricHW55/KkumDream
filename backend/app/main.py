import json
from html import escape
from urllib.parse import quote

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse

from app.api.router import api_router
from app.core.config import settings


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="0.1.0")

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

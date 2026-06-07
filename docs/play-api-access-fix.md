# 꿈드림 패스 결제 검증 실패(401) — 원인과 해결

작성일: 2026-06-08

## 한 줄 요약

결제는 구글에서 정상 성사되는데, **백엔드가 구글 Play Developer API를 호출할 권한이 없어서**
패스 권한이 저장되지 않는다. 원인은 **GCP 프로젝트가 Play Console에 "연결(API access link)"되어
있지 않은 것.** 코드 버그 아님.

---

## 증상

- 앱에서 패스를 결제하면 결제는 되는데(다음 결제일까지 잡힘), 앱에는 패스가 안 보임.
- "구매 복원"을 눌러도 `Could not verify purchase`.
- 다른 계정으로 로그인해도 안 보임.
- DB 확인:
  - `subscriptions` 테이블이 **비어 있음** (백엔드가 구독을 한 번도 저장 못 함)
  - `rtdn_events`에는 실제 구매 알림(`notificationType=4`)이 들어와 있음 (구글 쪽은 정상)

## 진단 과정 (확정된 사실)

1. 백엔드 로그(Fly):
   ```
   BillingVerificationError: Play API 401
   reason: "permissionDenied", domain: "androidpublisher"
   "The current user has insufficient permissions..."
   ```
2. 서비스 계정(SA)으로 직접 Play API를 호출해 본 결과 (`backend/scripts/iap_diag.py`):
   - 구독 조회 → **401 permissionDenied**
   - 앱 편집본 생성(`edits.insert`, 가장 기본 접근) → **403 PERMISSION_DENIED**
   - → SA가 **이 앱에 대한 API 접근 자체가 전혀 없음** (재무 권한만의 문제가 아님)
3. 이미 확인하여 **원인이 아닌 것들**:
   - ❌ 코드 버그 — 아님 (검증 로직 정상)
   - ❌ Fly 시크릿의 SA가 다른 계정 — 아님 (올바른 SA로 재배포해도 동일)
   - ❌ 재무 권한 누락 — 아님 ("재무 데이터 보기" + "주문/구독 관리" 일주일 넘게 저장됨)
   - ❌ 권한 전파 지연 — 아님 (1주일 이상 경과)
   - ❌ Android Publisher API 미활성 — 아님 (GCP에서 활성 확인됨)

## 진짜 원인

Play Console에는 권한 통로가 **두 개**다:

| 통로 | 용도 | 상태 |
|---|---|---|
| 사용자 및 권한에 SA 초대 | Play Console **화면(UI)** 접근 | ✅ 되어 있음 |
| **API 액세스에서 GCP 프로젝트 연결** | **Developer API** 호출 인가 | ❌ **안 되어 있음** |

두 번째(프로젝트 연결)가 빠져서, SA를 사용자로 초대하고 권한을 켜도 API는 계속 거부한다.
`play.google.com/console/.../api-access` 가 홈으로 튕긴 것도 "API 액세스가 설정된 적 없음"의 증거.

## 관련 정보

- **연결할 GCP 프로젝트:** `project-017368d3-4b1e-4057-958` (이름: KkumDream-App)
- **서비스 계정:** `kkumdream-play-api@project-017368d3-4b1e-4057-958.iam.gserviceaccount.com`
- **SA 키 ID:** `f4bf7946ae1a0e73fb6efc6fc958bcaad7b91d8c` (GCP IAM에 존재 확인됨)
- **Play 개발자 계정 ID:** `8761412092521036557`
- **패키지명:** `com.kkumdreammobile`
- **주의:** GCP에 비슷한 프로젝트가 둘 있음 → 반드시 `project-017368d3-...`(KkumDream-App)를
  연결할 것. `kkumdream-27e4c`(KkumDream-PlayAPI)는 Firebase용이라 **틀림**.

---

## 해결 절차

### 1. Play Console → API 액세스 페이지 열기

전체 URL로 접속 (계정 소유자 `yueric55`로 로그인된 상태에서):
```
https://play.google.com/console/u/0/developers/8761412092521036557/api-access
```
- 또 홈으로 튕기면: 소유자 계정으로 로그인됐는지 확인. (API 액세스 설정은 소유자/관리자만 가능)

### 2. GCP 프로젝트 연결

- 페이지에 **"Google Cloud 프로젝트 연결" / "기존 프로젝트 연결"** 버튼 → `project-017368d3-...` 선택
- 표시되는 **약관에 동의**
- (이미 다른 프로젝트가 연결돼 있으면, `project-017368d3-...`로 바꾸거나 추가)

### 3. SA에 API 액세스 권한 확인

- 연결 후 같은 페이지의 **서비스 계정** 목록에 `kkumdream-play-api@...`이 보이는지 확인
- "액세스 권한 부여/관리"에서 **재무 데이터 보기 + 주문 및 구독 관리** 권한이 적용돼 있는지 확인
  (이미 "사용자 및 권한"에서 줬으므로 보통 그대로 인식됨)

### 4. 검증 (앱 없이 즉시 확인 가능)

로컬에서 진단 스크립트 재실행:
```powershell
# 최초 1회만 (이미 설치돼 있으면 생략)
python -m venv $env:TEMP\iapdiag
& "$env:TEMP\iapdiag\Scripts\python.exe" -m pip install google-auth requests

& "$env:TEMP\iapdiag\Scripts\python.exe" "C:\dev\KkumDream\KKUMDREAM\backend\scripts\iap_diag.py"
```
- `edits.insert`가 **200**으로 바뀌면 연결 성공.
- 구독 조회는 토큰이 만료/무효면 404가 날 수 있는데, **401만 아니면 권한은 풀린 것.**

### 5. 실제 복구

- 앱에서 **내 정보 → 꿈드림 패스 → "구매 복원"** 탭.
- Fly 로그에 `POST /api/v1/billing/verify ... 200 OK` 뜨면 끝.
- Supabase `subscriptions` 테이블에 행이 생기고 앱에 패스 표시됨.
- **환불·재구매 불필요** — 기존 구독이 살아 있어 복원만으로 정상화됨.

---

## 참고

- 권한이 풀린 뒤에는 RTDN(실시간 알림)·스케줄러 자동 reconcile도 같은 SA를 쓰므로 함께 정상 작동.
- 이건 **출시 차단 이슈**였음 — 연결 전까지 모든 결제가 동일하게 막혀 있었음.
- 진단 스크립트 위치: `backend/scripts/iap_diag.py` (재사용 가능).

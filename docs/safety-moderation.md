# 안전·신고·차단 (Safety & Moderation)

꿈드림의 사용자 안전 기능 정리. 계정 삭제, 신고, 차단(그림자 차단), 신고 자동 숨김,
관리자 조회까지 한 곳에 모았습니다. 무인 운영(운영자 상시 대기 없음)을 전제로 설계되었습니다.

> 관련 마이그레이션: `202606050001_add_account_safety_controls`, `202606050002_add_report_auto_hide_columns`
> 배포 전 `alembic upgrade head` 필수.

---

## 1. 한눈에 보기

| 기능 | 단위 | 효과 | 운영자 개입 |
|---|---|---|---|
| 차단(Block) | 사용자 | 차단한 사람에게 상대 카드·댓글 숨김, 전송 무력화(그림자 차단) | 불필요 (본인 조치) |
| 신고(Report) | 카드/댓글/유저 | `content_reports`에 기록 | 검토는 선택 |
| 자동 숨김(Auto-hide) | 카드/댓글 | 서로 다른 N명이 신고하면 "신고됨"으로 마스킹 | 불필요 (자동) |
| 계정 삭제 | 사용자 | 소프트 삭제 + 익명화 | 불필요 |
| 관리자 조회 | - | 신고 현황 읽기 전용 API | 운영자 전용 |

설계 원칙:
- **차단 = 사용자 단위(관계)** — 영구적·관계적 의도. 양쪽 모든 콘텐츠에 적용.
- **신고 = 콘텐츠 단위** — 일회적 판단. 임계치를 누적해 *그 카드만* 정확히 가림.
- **삭제가 아닌 마스킹** — 자동 숨김된 콘텐츠는 보존되어 검토 후 복구 가능.

---

## 2. 차단 — 그림자 차단(Shadow Ban)

차단은 **단방향 가시성**으로 동작합니다. (`blocked_user_ids_for`가 "내가 차단한 사람"만 반환)

- **차단한 사람(A)**: 상대(B)의 카드·댓글이 목록/상세/방 어디에서도 안 보임. B에게서 새 카드도 안 옴.
- **차단당한 사람(B)**: 앱이 **정상처럼 보임**. A에게 카드 전송·댓글 작성이 "성공한 것처럼" 보이지만, 실제로는 A에게 도달하지 않음(필터링 + 푸시 억제). 차단당했다는 사실이 노출되지 않음.

| 동작 | 차단 전 | 그림자 차단 후 |
|---|---|---|
| B→A 카드 전송 | `ForbiddenError`(차단 사실 노출) | 생성 성공, A 받은함에서 제외 + 푸시 없음 |
| B의 댓글 | 거부 | 작성됨, A에게만 안 보임 + 푸시 없음 |
| B의 링크 수령(claim) | 거부 | 수령됨, A에게 "수령됨" 푸시 없음 |

구현: `app/services/safety_service.py` (`blocked_user_ids_for`), `app/services/dream_service.py`
(`give_dream`, `create_dream_comment`, `claim_dream_via_token`의 `suppress_delivery`).

### 차단 해제 동작
- 차단/해제는 `user_blocks` 행을 추가/삭제할 뿐 **콘텐츠를 삭제하지 않음**.
- 해제하면 그동안 가려졌던 받은 카드·댓글이 **그대로 다시 노출**됨. 다시 차단하면 다시 숨겨짐 (토글).
- 단, 차단 기간 중 발송됐어야 할 **푸시 알림은 소급 발송되지 않음**.

### 모바일 UI
- 카드 상세: 상단바 우측 ⋮ 메뉴 → 신고 / 차단. (내가 보낸 카드는 신고 항목 숨김)
- 댓글: 각 댓글에 신고 / 차단.
- 내 정보 → "차단 관리"(접기/펼치기, 검색 가능)에서 목록 확인 및 차단 해제.

---

## 3. 신고 — 자동 숨김(Auto-hide)

사용자가 신고하면 `content_reports`에 한 줄 기록됩니다. **같은 카드/댓글을 서로 다른
`report_auto_hide_threshold`(기본 5)명이 신고하면 자동으로 숨김** 처리됩니다.

- 대상에 `hidden_at` 타임스탬프 설정 (삭제 아님).
- 응답에서 내용이 마스킹되고 `isHidden: true` 플래그가 내려감.
  - 카드: 제목 "신고된 카드", 본문/이미지/태그 제거, FROM/TO·날짜는 유지.
  - 댓글: "신고가 접수되어 가려진 댓글이에요."로 대체.
- 모바일은 마스킹 상태를 전용 UI로 렌더(카드 플립 비활성, 댓글 회색 이탤릭).

> ⚠️ **임계치와 노출 범위 주의**: 1:1 카드는 받는 사람 1명만 볼 수 있어 distinct 신고자가
> 최대 1명입니다. 따라서 임계치 5는 **꿈방·공유 카드**에서 주로 발동합니다. 1:1 카드의
> 부적절 콘텐츠는 받는 사람의 **차단**으로 즉시 가려지는 흐름을 의도했습니다.

구현: `app/services/safety_service.py`의 `create_report` → `_maybe_auto_hide`,
마스킹은 `app/services/dream_service.py`의 `to_dream_out` / `DreamCommentView`.

---

## 4. 계정 삭제 — 소프트 삭제 + 익명화

`DELETE /auth/me` 호출 시 (`delete_user_account`):

- **하드 삭제**: 작성 중 초안과 그 댓글/반응, 친구관계, 기기 토큰, 본인이 남긴 반응·댓글,
  일일 발송 제한, 차단 레코드.
- **방 처리**: 멤버십 제거, 방장이면 최고참에게 이양, 남은 멤버 없으면 방 삭제.
- **익명화(소프트 삭제)**: 유저 행 유지하되 `nickname="탈퇴한 사용자"`, `email/profile=NULL`,
  `provider="deleted"`, `deleted_at=now`.
- 이미 전달된 카드의 FROM/TO 이름은 **스냅샷 컬럼**(`giver_display_name`,
  `receiver_display_name`)으로 보존되어 "탈퇴한 사용자"로 바뀌지 않음.
- 삭제된 계정의 토큰은 `current_user_id` 의존성에서 **401**로 거부됨.

구현: `app/services/user_service.py`, `app/api/routes/auth.py`, `app/api/deps.py`.
모바일: 내 정보 하단 "계정 삭제" 버튼 + 확인 모달.

---

## 5. 관리자 신고 조회 (Admin)

운영자 전용 **읽기 전용** API. 앱 화면이 아니라 서버에 직접 요청(curl 등)합니다.
`X-Admin-Token` 헤더가 `ADMIN_API_TOKEN`(env)과 일치해야 하며, 미설정 시 항상 403.

### `GET /api/v1/safety/admin/reports`
신고 목록(최신순). 쿼리: `status_filter`(예: `open`), `limit`(기본 200, 최대 500).

```json
[
  {
    "id": "...",
    "targetType": "dream",
    "targetId": "...",
    "reporterId": "...",
    "reporterNickname": "유하람",
    "reportedUserId": "...",
    "reportedUserNickname": "권민준",
    "reason": "inappropriate",
    "detail": null,
    "status": "open",
    "createdAt": "2026-06-05T..."
  }
]
```

### `GET /api/v1/safety/admin/reports/summary`
한눈에 보는 통계. 쿼리: `limit`(top targets 개수, 기본 20).

```json
{
  "openReports": 12,
  "autoHideThreshold": 5,
  "topTargets": [
    { "targetType": "dream", "targetId": "...", "distinctReporters": 4, "totalReports": 6 }
  ]
}
```

### 호출 예시
```bash
curl -H "X-Admin-Token: <ADMIN_API_TOKEN>" \
  https://<server>/api/v1/safety/admin/reports/summary
```

> 이 엔드포인트는 **조회만** 합니다(삭제·정지 등 조치 없음). 부적절 콘텐츠 차단은 자동 숨김이
> 담당하며, 이 API는 "그 외 검토가 필요한 신고가 있나" 확인하는 보조 도구입니다.

구현: `app/api/routes/safety.py` (`require_admin`, `admin_reports`, `admin_report_summary`),
`app/services/safety_service.py` (`list_reports_for_admin`, `report_summary`).

---

## 6. 사용자용 API (앱)

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/safety/reports` | 카드/댓글/유저/방 신고 |
| GET | `/safety/blocks` | 내가 차단한 사용자 목록(닉네임·프로필 포함) |
| POST | `/safety/blocks` | 사용자 차단 |
| DELETE | `/safety/blocks/{blocked_user_id}` | 차단 해제 |
| DELETE | `/auth/me` | 계정 삭제 |

신고 사유(`reason`): `inappropriate`, `harassment`, `spam`, `privacy`, `minor_safety`, `other`.
신고 대상(`targetType`): `dream`, `comment`, `user`, `room`.
(user 신고는 `reportedUserId` 필수, 그 외는 `targetId` 필수)

모바일 클라이언트: `mobile/src/api/safety.ts`, `mobile/src/api/auth.ts`.

---

## 7. 설정 (환경변수)

| 키 | 기본값 | 설명 |
|---|---|---|
| `REPORT_AUTO_HIDE_THRESHOLD` | `5` | 자동 숨김 임계치(서로 다른 신고자 수) |
| `ADMIN_API_TOKEN` | (없음) | 관리자 엔드포인트 접근 토큰. **미설정 시 admin API 전부 403** |

정의: `app/core/config.py`의 `Settings`.

---

## 8. 데이터 모델 요약

- `user_blocks`: `blocker_id`, `blocked_user_id` (유니크 쌍, 자기차단 금지)
- `content_reports`: `reporter_id`, `target_type`, `target_id`, `reported_user_id`,
  `reason`, `detail`, `status`(기본 `open`)
- `dreams.hidden_at`, `dream_comments.hidden_at`: 자동 숨김 타임스탬프
- `dreams.giver_display_name`, `dreams.receiver_display_name`: FROM/TO 스냅샷
- `users.deleted_at`: 소프트 삭제 시각

모델: `app/models/safety.py`, `app/models/dream.py`, `app/models/user.py`.

---

## 9. 향후 확장 아이디어 (미구현)

- 관리자 조회를 **앱 내 관리자 화면**으로 제공
- `summary`를 **매일 운영자에게 푸시/이메일** 자동 발송(스케줄러)
- 조회를 넘어 **카드 강제 숨김/복구, 계정 정지** 같은 조치 API
- 1:1 카드 전용 신고 정책(받는 사람 1건 신고 시 본인 화면 즉시 숨김 등)

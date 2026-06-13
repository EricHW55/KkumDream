# Kkumdream 1.3.9 Release Notes

## Store Notes

앱 시작 직후 일부 iOS 기기에서 앱이 종료될 수 있던 문제를 수정했습니다.
Pass 구매 복구와 아침 알림 예약이 앱 실행을 방해하지 않도록 안정성을 개선했습니다.

## Build Info

- App version: 1.3.9
- Android versionCode: 16
- iOS buildNumber: 14
- Backend iOS latest version: 1.3.9

## Internal Notes

- Guarded billing initialization with a shared single-flight connection flow.
- Deferred automatic Pass purchase recovery until after startup interactions.
- Limited hidden Pass modal billing setup to the moment the modal is opened.
- Deferred local morning reminder scheduling and kept the feature opt-in for new installs.
- Updated Android, iOS, and backend release metadata for the 1.3.9 release.

# SalesMap Cohort v2.10.4 전체 로직 검증 v0.1

검증일: 2026-05-24 KST

## 검증 범위

- 로컬 `/Users/appler/Documents/Claude/Projects/SalesTeam_Cohort/index.html`
- 배포본 `https://yechunghee.github.io/SalesMap_Cohort/`
- 주요 경로: SalesMap API 설정, 코호트/파이프라인 지표, 기간 필터, Slack 통보, OCR 공유 설정, 체류 히트맵 fallback, 브라우저 초기 렌더

## 실행 증거

- 로컬/배포본 일치: `wc -c` 둘 다 `400478`, MD5 둘 다 `56dd92e03e3efac86225fff8365a2f31`
- 배포본 HTTP: `HTTP/2 200`, `last-modified: Sat, 23 May 2026 15:38:23 GMT`
- 인라인 스크립트 문법: `scripts=1`, `script 1: ok (243494 chars)`
- Chrome headless 초기 렌더: `chrome_status=0`, DOM dump 생성, screenshot 생성
- 초기 렌더 확인: KPI/테이블 빈 상태 UI 렌더, 콘솔 stderr 0 bytes

## 판정

출시 파일 동기화와 초기 구동은 통과입니다. 그러나 운영 지표 신뢰도와 알림 성공 판정에는 수정 전 승인하기 어려운 결함이 남아 있습니다.

## 주요 발견

### P1. Slack 전송 성공을 실제로 검증하지 못함

위치: `index.html:3394-3415`

`sendSlackNotification()`은 Worker가 없으면 Slack webhook을 `mode: "no-cors"`로 직접 호출하고, 응답 상태를 확인하지 않은 채 성공으로 간주합니다. 이 경우 브라우저는 opaque response를 반환하므로 실제 Slack 전송 성공/실패를 판정할 수 없습니다. `btn-send-slack-real`은 이 함수를 `await`한 뒤 곧바로 "Slack 전송 완료 및 이력 기록"을 띄우므로, 운영자는 실패를 성공으로 오인할 수 있습니다.

권장: Worker proxy가 없으면 실전송 버튼을 비활성화하거나, 검증 가능한 proxy 응답만 성공으로 기록합니다.

### P1. 파이프라인 KPI의 결제/완료 지표가 실제 단계 정의와 불일치

위치: `index.html:6044-6048`, `index.html:6130-6138`, `index.html:6264-6277`, `index.html:2202-2207`

단계 정의상 `자금집행 완료`는 `cat:"완료"`, `결제 완료`는 `cat:"성사"`입니다. 그런데 `pipelineMetrics`는 `wonDeals/lostDeals/activeDeals`만 저장하고 `paidDeals`를 저장하지 않습니다. 이후 KPI 카드의 "결제 완료" 값은 `pm.paidDeals ?? pm.wonDeals`라서 `paidDeals`가 없으면 `결제 완료`가 아니라 `성사 딜 수`를 표시합니다. 또한 `activeDeals = total - won - lost`라서 `자금집행 완료` 단계가 진행 중 딜에 섞입니다.

권장: `completedDeals`, `paidDeals`, `collectionDeals`, `activeDeals`를 단계 카테고리별로 명시 분리하고 KPI 라벨과 계산식을 맞춥니다.

### P1. 앱 전용 API 설정 원칙을 여전히 깨는 OCR fallback 존재

위치: `index.html:1819-1846`, `index.html:3540-3565`, `index.html:4894-4902`

코호트 전용 토큰이 없으면 `ocr_salesmap_token`과 `ocr_worker_url`을 읽어 SalesMap API에 사용합니다. 이전 검증 기준에서 "각 앱이 자체 API 설정을 관리해야 한다"는 조건이면 이 fallback은 release blocker입니다. UI도 "OCR 공유 토큰" 상태를 정상 대체 경로처럼 노출합니다.

권장: 코호트 앱은 `cohort_salesmap_token` / `cohort_worker_url`만 사용하고, OCR 키는 사업자번호/NTS/Gemini 같은 OCR 기능 범위로만 제한합니다.

### P2. 상단 역할 배지가 `undefined 운영`으로 표시됨

위치: `index.html:3690-3710`

`ROLE_CFG`는 `icon`을 정의하지만 렌더는 `${cfg.emoji}`를 사용합니다. 실제 Chrome screenshot에서 상단 배지가 `undefined 운영`으로 표시되었습니다.

권장: `badge.innerHTML = `${cfg.icon} ${cfg.label}`` 또는 `badge.textContent = cfg.label`로 정리합니다.

### P2. `전체 기간` 선택 시 카드 내부 지표가 현재 월로 되돌아감

위치: `index.html:1753-1760`, `index.html:4679-4688`, `index.html:5328-5338`, `index.html:5478-5504`

상단 기간 필터가 `전체 기간`이면 `syncCardDropdownsToPeriod("all")`이 퍼널/구매유형/코호트 내부 필터를 현재 월로 리셋합니다. 그 뒤 `recomputeForPeriod(allDeals, rawLeads)`는 내부 월간 필터 값을 사용해 일부 카드만 현재 월 기준으로 계산합니다. 결과적으로 상단은 "전체 기간"인데, 일부 카드 내부 로직은 현재 월로 계산될 수 있습니다.

권장: `all` 선택 시 내부 카드도 전체 기준으로 계산하거나, UI 라벨을 "전체 기간 + 카드별 월간 필터"처럼 명확히 분리합니다.

### P2. 체류 시간 히트맵은 실데이터가 일부 비어도 mock 값으로 셀을 채움

위치: `index.html:6447-6477`, `index.html:6480-6552`

`STATE.dwellHeatmap`이 존재해도 특정 stage/month 조합의 데이터가 없으면 mock base 값을 사용합니다. 안내 문구는 `!dwellMap`일 때만 표시되므로, 부분 실데이터 상태에서도 일부 셀은 mock인데 사용자는 이를 실측값으로 볼 수 있습니다.

권장: 실데이터 모드에서는 결측 셀을 `–` 또는 `데이터 없음`으로 표시하고, mock은 명시적인 데모 모드에서만 사용합니다.

### P3. AppleGothic 기본 폰트 지시와 현재 CSS가 불일치

위치: `index.html:37-38`

현재 기본 폰트는 `"Pretendard","Spoqa Han Sans Neo",-apple-system,...`이고 `AppleGothic`이 없습니다. 프로젝트 지시가 "모든 웹페이지 제작시 기본 구성은 애플고딕체 폰트 사용"이면 CSS 기준 미준수입니다.

권장: `--font-sans:"AppleGothic","Apple SD Gothic Neo",...`처럼 기본 스택을 지시에 맞춥니다.

## 통과 항목

- 로컬과 GitHub Pages 배포본은 현재 동일합니다.
- 인라인 JavaScript는 문법 오류 없이 파싱됩니다.
- 브라우저 초기 로드에서 치명적인 `ReferenceError` / `TypeError`는 재현되지 않았습니다.
- 주요 DOM id 참조는 동적 생성 id를 제외하고 초기 HTML과 맞습니다.
- `cohort_salesmap_token` 직접 설정 경로는 존재합니다.

## 결론

현재 v2.10.4는 "페이지가 열리고 배포 파일이 맞다"는 기준은 통과합니다. 다만 운영판정 로직 기준으로는 Slack 성공 판정, KPI 단계 카운트, OCR 공유 토큰 fallback, 전체 기간 필터 불일치 때문에 release clean으로 보기 어렵습니다.

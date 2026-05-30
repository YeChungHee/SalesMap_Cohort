# SalesMap Cohort v2.12.3 현재 상태 검증 v0.1

검증일: 2026-05-25 KST

## 검증 대상

- 로컬: `/Users/appler/Documents/Claude/Projects/SalesTeam_Cohort/index.html`
- 배포본: `https://yechunghee.github.io/SalesMap_Cohort/`
- 핵심 기준: `유입 > 리드 전환 > 딜 성사 > 딜 완료`를 유입월 코호트 기준으로 추적하는지 확인

## 실행 증거

- 배포 상태: `HTTP/2 200`
- 배포 수정 시각: `last-modified: Mon, 25 May 2026 10:46:31 GMT`
- 로컬/배포본 일치: `436057 bytes`, MD5 `72b7e9aef6cc2aa009bdf25f1661b9cb`
- JS 문법: `scripts=1`, `script 1: ok (269221 chars)`
- Chrome headless 초기 렌더: `chrome_status=0`, stderr 0 bytes
- 스크린샷: `/tmp/salesmap-current-shot.png`

## 현재 판정

배포/구동은 정상입니다. `CHANGELOG` 최신은 `v2.12.3`이고 실제 웹페이지도 그 코드와 일치합니다. 다만 `<title>`은 아직 `v2.11.0`으로 남아 있어 버전 표기 정합성은 미완료입니다.

코호트 기준은 v2.11.0 대비 일부 개선되었습니다. 특히 `리드 전환 = totalInflow` 하드코딩은 제거되어 `cohortTotals().leads` 기반으로 바뀌었습니다. 그러나 직전 기준인 `유입 > 리드 전환 > 딜 성사 > 딜 완료` 관점에서는 Row1 코호트 카드에 아직 `딜 완료`가 없습니다.

## 닫힌 항목

### 배포 동기화

로컬과 GitHub Pages 파일이 byte/hash 기준으로 완전히 동일합니다. 현재 검증 결과는 실제 웹페이지 상태에 그대로 적용됩니다.

### 초기 구동

인라인 JavaScript 문법과 Chrome headless 초기 렌더가 모두 통과했습니다. `undefined 운영`, `ReferenceError`, `TypeError`, `SyntaxError`는 초기 렌더에서 재현되지 않았습니다.

### 리드 전환 100% 고정 문제

`computeCohortKPI()`가 더 이상 `leadConversion = totalInflow`으로 고정하지 않고 `cohortTotals().leads`를 사용합니다. 이전의 명백한 100% 하드코딩은 닫혔습니다.

### 히트맵 결측 mock 표시

실데이터 모드 결측 셀은 `–`로 표시되고, mock 데이터는 데이터 미로드 상태에서만 사용됩니다.

## 남은 발견

### P1. Row1 유입 코호트에 `딜 완료`가 없음

위치: `index.html:2436-2451`

현재 Row1 카드는 `총 유입 / 리드 전환 / 딜 전환 / 딜 성사 / 이용 고객`입니다. 직전 기준은 `유입 > 리드 전환 > 딜 성사 > 딜 완료`였으므로, 유입월 코호트에서 최종 완료 단계가 빠져 있습니다.

예: `5월 유입 -> 5월 딜 성사 -> 8월 딜 완료` 고객은 5월 코호트의 M+3 완료로 보여야 합니다. 현재 구조에서는 `딜 완료`가 Row2의 실거래 일자 기준에만 존재하므로, 유입월 코호트 완료율을 직접 볼 수 없습니다.

권장: Row1을 `총 유입 / 리드 전환 / 딜 성사 / 딜 완료 / 완료율 또는 평균 완료기간`으로 재편하고, `computeCohortKPI()`에 `completedCount`와 가능하면 `completedOrgDetails`를 추가합니다.

### P1. `computeCohortKPI()`의 코호트 기준이 유입월 고정이라기보다 현재 `cohortTotals()`에 의존함

위치: `index.html:5825-5887`, `index.html:6560-6690`

`computeCohortKPI()`는 `cohortTotals()`를 기준으로 `totalInflow`, `leadConversion`, `dealConversion`을 가져옵니다. 이 값은 `recomputeForPeriod()`가 만든 `STATE.cohortsBySource`에 의존합니다. 특정 기간에서는 딜의 `거래 준비 진입일` 중심 필터와 유입 소스 집계가 섞일 수 있어, "유입월에 고정한 고객 집합을 이후 월 완료까지 추적"하는 순수 코호트 모델과는 아직 다릅니다.

권장: 코호트 anchor set을 먼저 만들고, 이후 단계는 그 anchor set 안에서 전체 기간 이벤트를 추적합니다.

### P2. `<title>` 버전이 최신 CHANGELOG와 불일치

위치: `index.html:6`, `index.html:956`

`CHANGELOG[0]`은 `v2.12.3`이지만 문서 title은 `v2.11.0`입니다. 사이드바와 업데이트 화면은 `v2.12.3`으로 렌더되므로 사용자 브라우저 탭/문서 메타만 뒤처진 상태입니다.

### P2. `전체 기간` 선택 시 내부 카드 필터는 여전히 현재 월로 리셋됨

위치: `index.html:1965-1988`

상단 `전체 기간` 선택 시 내부 퍼널/구매유형/코호트 드롭다운 값이 현재 월로 리셋됩니다. 상단 기간과 내부 카드 기간의 기준이 달라질 수 있습니다.

### P2. Slack 전송 성공 검증 불가 fallback 유지

위치: `index.html:3667-3688`

Worker가 없으면 `fetch(webhook, { mode:"no-cors" })`로 전송하고 응답 상태를 확인하지 않습니다. Slack 실패를 성공으로 기록할 수 있는 리스크가 남아 있습니다.

### P2. OCR 공유 토큰 fallback 유지

위치: `index.html:2032-2048`, `index.html:5273-5282`

코호트 전용 토큰이 없을 때 `ocr_salesmap_token` / `ocr_worker_url` fallback이 남아 있습니다. 앱별 API 설정 분리 원칙을 엄격히 적용하면 아직 미해결입니다.

## 결론

현재 상태는 배포와 브라우저 구동 기준으로는 정상입니다. 다만 비즈니스 기준인 `유입월 코호트에서 딜 완료까지 추적`은 아직 완성되지 않았습니다. 다음 수정의 1순위는 Row1에 `딜 완료`와 완료율을 넣고, 5월 유입 고객이 8월 완료될 때 5월 코호트의 M+3 완료로 누적되는 anchor-set 기반 계산으로 바꾸는 것입니다.

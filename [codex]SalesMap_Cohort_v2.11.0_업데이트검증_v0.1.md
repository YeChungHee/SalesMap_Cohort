# SalesMap Cohort v2.11.0 업데이트 검증 v0.1

검증일: 2026-05-25 KST

## 검증 대상

- 로컬: `/Users/appler/Documents/Claude/Projects/SalesTeam_Cohort/index.html`
- 배포본: `https://yechunghee.github.io/SalesMap_Cohort/`
- 업데이트 요지: KPI 2행 레이아웃, 유입 코호트(Row1) + 거래 현황(Row2), 자금집행/결제 완료 단계 분리

## 실행 증거

- 배포 반영 확인: `HTTP/2 200`, `last-modified: Mon, 25 May 2026 03:19:17 GMT`
- 로컬/배포본 일치: `415155 bytes`, MD5 `5ec25c8aa99ffed832ccaca301fc8e01`
- 버전: `<title>... v2.11.0</title>`, `CHANGELOG[0].version = "2.11.0"`
- JS 문법: `scripts=1`, `script 1: ok (253844 chars)`
- Chrome headless 초기 렌더: `chrome_status=0`, stderr 0 bytes
- 스크린샷: `/tmp/salesmap-v211-shot.png`

## 판정

배포/구동/초기 렌더는 통과입니다. v2.10.4의 일부 결함은 닫혔지만, 직전 논의한 코호트 기준인 `유입 > 리드전환 > 딜 성사 > 딜 완료`를 대시보드 카드 기준으로 완전히 반영했다고 보기는 어렵습니다.

## 닫힌 항목

### 배포 반영

로컬과 GitHub Pages 파일이 byte/hash 기준으로 완전히 같습니다. 이번 검증 결과는 실제 웹페이지에도 적용됩니다.

### 역할 배지

`renderRoleBadge()`가 `cfg.icon + cfg.label`을 `innerHTML`로 렌더하도록 바뀌었습니다. 이전의 `undefined 운영` 문제는 Chrome 렌더에서 재현되지 않았습니다.

### 파이프라인 단계 분리

기본 매핑에서 `자금집행 완료 = cat:"성사"`, `결제 완료 = cat:"완료"`로 분리되었습니다. `pipelineMetrics`도 `wonDeals`, `completedDeals`, `activeDeals`를 분리해 저장합니다.

### 체류 히트맵 결측 처리

실데이터 모드에서 결측 셀은 mock 값이 아니라 회색 `–`로 표시하도록 수정되었습니다.

## 주요 발견

### P1. 유입 코호트 Row1에 `딜 완료`가 없음

위치: `index.html:2321-2327`, `index.html:5585-5641`

직전 기준은 `유입 > 리드전환 > 딜 성사 > 딜 완료`입니다. 그런데 v2.11.0 Row1은 `총 유입 / 리드 전환 / 딜 전환 / 딜 성사 / 이용 고객`으로 구성되어 있고, 유입월 코호트 기준의 `딜 완료` 카드가 없습니다.

예를 들어 5월 유입 고객이 8월에 결제 완료되면, 현재 구조에서는 Row2의 `거래 현황 — 실거래 일자 기준`에는 잡힐 수 있지만, `5월 유입 코호트의 M+3 딜 완료`로 Row1에 표현되지 않습니다. 코호트 추적 기준으로는 핵심 완료 단계가 빠진 상태입니다.

권장: Row1을 `총 유입 / 리드 전환 / 딜 성사 / 딜 완료 / 완료율 또는 평균 완료기간`으로 재정의하고, `computeCohortKPI()`에 cohort org의 `completedCount`를 추가합니다.

### P1. `리드 전환`이 항상 `총 유입`과 같음

위치: `index.html:5591-5600`

`computeCohortKPI()`가 `STATE.rawLeads`를 곧바로 유입 모집단으로 쓰고, `leadConversion = totalInflow`로 고정합니다. 즉 유입과 리드 전환이 같은 객체 집합이라 전환율이 항상 100%가 됩니다.

고객 여정이 `고객 유입 → 리드 전환`이라면, 유입 모집단은 조직/고객 유입이고 리드 전환은 그중 리드 파이프라인에 올라간 수여야 합니다. 현재는 "리드 생성 = 유입" 모델이라 첫 전환 단계를 측정하지 못합니다.

권장: 조직 유입일 또는 별도 source event를 모집단으로 삼고, 리드 전환은 리드 파이프라인 생성 여부로 계산합니다. 별도 유입 이벤트가 없다면 UI 라벨을 `리드 유입`으로 바꿔 오해를 줄여야 합니다.

### P2. `전체 기간` 선택 시 내부 카드 필터는 여전히 현재 월로 리셋됨

위치: `index.html:1843-1865`

`syncCardDropdownsToPeriod("all")`은 퍼널/구매유형/코호트 내부 필터를 현재 월로 리셋합니다. 상단은 `전체 기간`인데 일부 카드 내부 기간은 현재 월이 되는 구조가 남아 있습니다.

### P2. Slack 전송 성공 검증은 여전히 불가능한 fallback이 남음

위치: `index.html:3533-3554`

Worker가 없으면 `fetch(webhook, { mode:"no-cors" })`로 직접 전송하고 응답 상태를 검증하지 않습니다. 전송 실패를 성공으로 기록할 수 있는 이전 리스크가 남아 있습니다.

### P2. OCR 공유 토큰 fallback이 남음

위치: `index.html:1910-1938`, `index.html:5033-5041`

코호트 전용 토큰이 없으면 `ocr_salesmap_token` / `ocr_worker_url`를 계속 사용합니다. 앱별 API 설정 분리 원칙을 엄격히 적용하면 아직 미해결입니다.

### P3. AppleGothic 기본 폰트 지시 미반영

위치: `index.html:37-38`

기본 폰트 스택은 여전히 `Pretendard` 우선이며 `AppleGothic`이 없습니다.

## 결론

v2.11.0은 배포와 초기 구동은 통과했습니다. 하지만 직전 사용자 기준인 "유입월 코호트에서 딜 완료까지 추적"을 만족하려면 Row1 코호트 카드에 `딜 완료`를 추가하고, `리드 전환=총 유입`으로 고정되는 구조를 먼저 바로잡아야 합니다.

# R2 리스크 완화 구현 계획서

**작성일:** 2026-05-17  
**버전:** v0.2 (리스크 등급 재분류 반영)  
**대상 파일:** `/home/claude/repo/index.html` (1329줄, 단일 파일)

---

## 배경 및 리스크 재정의

OCR Pro v9.58이 SalesMap에 전송하는 17개 커스텀 필드가 SalesMap 계정에 사전 생성되어 있지 않으면
**API/Excel 모두 silent discard**됨. 코호트 대시보드에서 이 상태를 감지하고 경고한다.

### 코호트 추적의 핵심 기준 — R2 범위 밖

> **"언제 유입됐는지(`cohort_month_kst`)"** 는 SalesMap의 네이티브 organization 생성일에서 파생된다.  
> 네이티브 필드이므로 커스텀 필드 유무와 무관하게 항상 안전하게 저장된다 → **R2 위험 없음.**

R2가 영향을 미치는 범위는 커스텀 필드로만 저장되는 정보에 한정:

| 분류 | 필드 | 누락 시 영향 | 등급 |
|---|---|---|---|
| 코호트 진입 조건 | `사업자번호` | 해당 회사 코호트 제외 (오염 아님, 커버리지 감소) | 🟠 FILTER |
| 소스 세그멘테이션 | `유입경로`, `유입경로_상세` | 채널별 분석 불가 (코호트 구조는 유지됨) | 🟡 WARN |
| 연락처 풍부도 | `전화`, `주소`, `웹 주소` | 네이티브 phone/address/website로 부분 보완 | 🔵 FALLBACK |
| 기타 분석 데이터 | 나머지 11개 | 데이터 풍부도 저하 | ⚪ INFO |

> **v0.1 대비 변경:** `유입경로`/`유입경로_상세`의 CRITICAL 분류 해제.  
> `cohort_month_kst`(유입 시점)가 네이티브 필드 기반임을 확인.  
> `사업자번호`는 "오염"이 아닌 "커버리지 필터" 조건으로 재정의.  
> CRITICAL(빨간) 등급 제거 — 최고 심각도는 FILTER/WARN(주황).

---

## 1. 변경 범위

| 항목 | 내용 |
|---|---|
| 변경 파일 | `index.html` 하나만 |
| 신규 localStorage 키 | `cohort_field_snapshot` |
| 신규 상수 | 4개 (`COHORT_EXPECTED_ORG_FIELDS`, `COHORT_FILTER_FIELDS`, `COHORT_WARN_FIELDS`, `COHORT_FALLBACK_FIELDS`) |
| 신규 함수 | 4개 (`salesmapGet`, `captureFieldSnapshot`, `checkFieldDrift`, `renderFieldSnapshotCard`) |
| HTML 추가 | 경고 배너 1개, 필드 스냅샷 카드 1개 |
| 기존 함수 수정 | `renderSettingsView()` — 1줄 추가 |
| 이벤트 바인딩 추가 | `btn-capture-snapshot` click 1개 |

---

## 2. 신규 localStorage 키

### `cohort_field_snapshot`

```json
{
  "ts": 1716000000000,
  "orgFields": ["대표자명", "유입경로", "사업자번호", "..."],
  "missingFilter": [],
  "missingWarn": [],
  "missingFallback": ["FlowScore"],
  "missingInfo": [],
  "sampledCount": 3,
  "noData": false
}
```

| 키 | 타입 | 설명 |
|---|---|---|
| `ts` | number | 캡처 시각 (ms). 30일 초과 시 `stale` 처리 |
| `orgFields` | string[] | GET /v2/organization 샘플에서 추출한 실제 fieldList 이름 목록 |
| `missingFilter` | string[] | `COHORT_FILTER_FIELDS` 중 미발견 — 커버리지 감소 |
| `missingWarn` | string[] | `COHORT_WARN_FIELDS` 중 미발견 — 세그멘테이션 손실 |
| `missingFallback` | string[] | `COHORT_FALLBACK_FIELDS` 중 미발견 — 네이티브 보완 가능 |
| `missingInfo` | string[] | 그 외 누락 — 데이터 풍부도 저하 |
| `sampledCount` | number | 샘플링된 org 레코드 수 (0이면 noData) |
| `noData` | boolean | SalesMap 계정에 org가 없어서 확인 불가 |

---

## 3. 신규 상수

`salesmapConfig()` 함수 바로 아래에 추가.

```javascript
// OCR Pro v9.58 buildSalesMapPayload 기준 — 전부 SalesMap 커스텀 필드 (사전 생성 필요)
const COHORT_EXPECTED_ORG_FIELDS = [
  "대표자명", "담당직원", "담당직함", "사업자번호",
  "전화", "주소", "웹 주소",
  "기업형태", "회원여부", "매출(억)", "설립일자", "부스번호",
  "아이템", "FlowScore", "영업이익", "유입경로", "유입경로_상세"
];

// 코호트 진입 필터 조건 — 없으면 해당 회사는 코호트 추적 제외 (커버리지 감소)
// cohort_month_kst는 SalesMap 네이티브 생성일 기반이므로 여기 포함 안 됨
const COHORT_FILTER_FIELDS = ["사업자번호"];

// 소스 세그멘테이션 필드 — 없으면 채널별 분석 불가 (코호트 구조 자체는 유지)
const COHORT_WARN_FIELDS = ["유입경로", "유입경로_상세"];

// 네이티브 API 필드(phone/address/website)로 부분 보완 가능한 필드
const COHORT_FALLBACK_FIELDS = ["전화", "주소", "웹 주소"];
```

---

## 4. 신규 함수 4개

### 4-1. `salesmapGet(path)` — SalesMap GET 헬퍼

**삽입 위치:** `salesmapConfig()` + 상수 4개 다음  
**용도:** GET 전용 헬퍼. OCR Pro `salesmapFetch` 워커 라우팅과 동일 방식.

```javascript
async function salesmapGet(path) {
  const cfg = salesmapConfig();
  if (!cfg.ready) throw new Error("토큰 미설정");

  const targetUrl = cfg.baseUrl + path;
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${cfg.token}`
  };

  if (cfg.useWorker) {
    const base = cfg.workerUrl.replace(/\/$/, "");
    const payload = JSON.stringify({ url: targetUrl, method: "GET", headers, body: null });
    let lastErr = null;
    for (const ep of [base, `${base}/proxy`]) {
      try {
        const res = await fetch(ep, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload
        });
        if (!res.ok) throw new Error(`Worker ${res.status}`);
        return res.json();
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("Worker 호출 실패");
  }

  const res = await fetch(targetUrl, { method: "GET", headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

**근거:** OCR Pro v9.58 `salesmapFetch` (lines 6180–6213) 워커 라우팅 패턴 동일.  
Worker POST body: `{ url, method, headers, body }` → `base` → `base/proxy` fallback.

---

### 4-2. `captureFieldSnapshot()` — 필드 스냅샷 캡처

**삽입 위치:** `salesmapGet` 다음  
**용도:** SalesMap에서 org 최대 5건 샘플링 → fieldList 이름 union → 4단계 누락 분류 → localStorage 저장

```javascript
async function captureFieldSnapshot() {
  const data = await salesmapGet("/v2/organization?limit=5");

  // SalesMap 페이지네이션 다형성 대응
  const list = data?.data || data?.list || data?.items || data?.organizations ||
               (Array.isArray(data) ? data : []);

  if (!list.length) {
    const snap = {
      ts: Date.now(), orgFields: [],
      missingFilter: [...COHORT_FILTER_FIELDS],
      missingWarn: [...COHORT_WARN_FIELDS],
      missingFallback: [...COHORT_FALLBACK_FIELDS],
      missingInfo: [],
      sampledCount: 0, noData: true
    };
    localStorage.setItem("cohort_field_snapshot", JSON.stringify(snap));
    return snap;
  }

  // 최대 5건 fieldList 이름 union
  const fieldSet = new Set();
  for (const rec of list) {
    const fields = rec.fieldList || rec.fields || rec.customFields || rec.properties || [];
    for (const f of fields) {
      const name = f.name || f.fieldName || f.label || f.key;
      if (name) fieldSet.add(name);
    }
  }

  // 4단계 누락 분류
  const missingFilter   = COHORT_FILTER_FIELDS.filter(f => !fieldSet.has(f));
  const missingWarn     = COHORT_WARN_FIELDS.filter(f => !fieldSet.has(f));
  const missingFallback = COHORT_FALLBACK_FIELDS.filter(f => !fieldSet.has(f));
  const knownFields     = new Set([
    ...COHORT_FILTER_FIELDS, ...COHORT_WARN_FIELDS, ...COHORT_FALLBACK_FIELDS
  ]);
  const missingInfo = COHORT_EXPECTED_ORG_FIELDS
    .filter(f => !knownFields.has(f) && !fieldSet.has(f));

  const snap = {
    ts: Date.now(), orgFields: [...fieldSet],
    missingFilter, missingWarn, missingFallback, missingInfo,
    sampledCount: list.length, noData: false
  };
  localStorage.setItem("cohort_field_snapshot", JSON.stringify(snap));
  return snap;
}
```

**예외 처리:** `salesmapGet` throw 시 그대로 전파 → 호출부 `handleCaptureSnapshot`에서 toast 처리.  
`noData: true` 시 모든 필드를 누락으로 표시 (확인 불가 = 가정 최악).

---

### 4-3. `checkFieldDrift()` — 드리프트 상태 조회

**삽입 위치:** `captureFieldSnapshot` 다음  
**용도:** localStorage 스냅샷 읽어 판정값 반환 (순수 동기)

```javascript
function checkFieldDrift() {
  const raw = localStorage.getItem("cohort_field_snapshot");
  if (!raw) return {
    level: "no_snapshot",
    missingFilter: [], missingWarn: [], missingFallback: [], missingInfo: [],
    stale: false, ts: null, noData: false, sampledCount: 0
  };

  let snap;
  try { snap = JSON.parse(raw); } catch { return { level: "no_snapshot" }; }

  const stale = (Date.now() - (snap.ts || 0)) > 30 * 24 * 60 * 60 * 1000;

  let level = "ok";
  if (snap.noData)                         level = "no_data";
  else if (snap.missingFilter?.length > 0) level = "filter";
  else if (snap.missingWarn?.length > 0)   level = "warn";
  else if (snap.missingFallback?.length > 0 ||
           snap.missingInfo?.length > 0)   level = "info";
  else if (stale)                          level = "stale";

  return {
    level,
    missingFilter:   snap.missingFilter   || [],
    missingWarn:     snap.missingWarn     || [],
    missingFallback: snap.missingFallback || [],
    missingInfo:     snap.missingInfo     || [],
    orgFields:       snap.orgFields       || [],
    stale,
    ts:           snap.ts          || null,
    sampledCount: snap.sampledCount || 0,
    noData:       snap.noData      || false
  };
}
```

**level 정의:**

| level | 의미 | 배너 색상 |
|---|---|---|
| `filter` | `사업자번호` 미존재 → 코호트 추적 대상 회사 커버리지 감소 | 🟠 주황 |
| `no_data` | SalesMap org 0건 → 필드 확인 불가 | 🟠 주황 |
| `warn` | `유입경로`/`유입경로_상세` 미존재 → 소스 세그멘테이션 불가 | 🟡 노란 주황 |
| `info` | fallback/info 필드 누락 → 데이터 풍부도 저하 | ⚪ 회색 (배너 미표시) |
| `stale` | 스냅샷 30일 초과 | 🔵 파란 |
| `no_snapshot` | 한 번도 캡처 안 함 | 🔵 파란 |
| `ok` | 모든 FILTER·WARN 필드 정상 | 숨김 |

> **v0.1 대비 변경:** `critical`(빨간) 등급 제거. 최고 심각도 `filter`(주황)으로 하향.  
> `유입경로` 누락은 구조 파괴가 아닌 세그멘테이션 손실이므로 `warn`으로 분류.

---

### 4-4. `renderFieldSnapshotCard()` — 카드 + 배너 UI 갱신

**삽입 위치:** `renderCohortTokenCard` 다음

```
[ 배너 업데이트 — #field-drift-banner ]

level "filter"  → 주황 배너
  아이콘: ⚠️
  제목: "사업자번호 필드 미존재 — 코호트 커버리지 감소"
  내용: "SalesMap에 '사업자번호' 커스텀 필드가 없습니다.
        코호트 추적 기준(사업자번호 있는 회사만)을 충족하는 레코드가 0건이 됩니다.
        [회사 설정 → 데이터 필드 관리]에서 커스텀 필드를 생성하세요."

level "no_data" → 주황 배너
  제목: "SalesMap 데이터 없음 — 필드 확인 불가"
  내용: "등록된 회사가 없어 커스텀 필드를 확인할 수 없습니다.
        OCR Pro로 회사 1건 이상 등록 후 스냅샷을 갱신하세요."

level "warn"    → 주황 배너 (연한)
  제목: "소스 세그멘테이션 필드 누락 — 채널 분석 제한"
  내용: "{missingWarn} 필드가 없습니다. 채널별 코호트 분석이 불가합니다.
        코호트 추적(언제/누가) 자체는 정상 작동합니다."

level "stale"      → 파란 배너
  제목: "스냅샷이 30일 이상 경과되었습니다"

level "no_snapshot" → 파란 배너
  제목: "SalesMap 필드를 아직 확인하지 않았습니다"
  내용: "스냅샷 갱신 버튼을 눌러 커스텀 필드 존재 여부를 확인하세요."

level "ok" | "info" → 배너 hidden

[ 스냅샷 카드 업데이트 ]

배지 (#snapshot-badge):
  filter/no_data → pill-orange "커버리지 주의"
  warn           → pill-orange "세그멘테이션 주의"
  ok/info        → pill-green  "정상"
  stale          → pill-blue   "갱신 필요"
  no_snapshot    → pill-gray   "미확인"

마지막 확인 (#snapshot-ts): snap.ts → "YYYY-MM-DD HH:mm KST" 또는 "—"
샘플 건수 (#snapshot-sample-count): sampledCount 또는 "—"

필드 칩 (#snapshot-field-chips) — COHORT_EXPECTED_ORG_FIELDS 17개 순서:
  orgFields에 있음       → pill-green  "✓ 필드명"
  missingFilter에 있음   → pill-orange "✗ 필드명" + "(커버리지)"
  missingWarn에 있음     → pill-orange "✗ 필드명" + "(세그)"
  missingFallback에 있음 → pill-blue   "△ 필드명" + "(네이티브 보완)"
  missingInfo에 있음     → pill-gray   "✗ 필드명"
  snap 없음              → pill-gray   "? 필드명"
```

---

## 5. HTML 추가

### 5-1. 경고 배너 — `#view-settings` 첫 번째 자식

기존 토큰 카드 앞에 삽입.

```html
<!-- R2 필드 드리프트 경고 배너 -->
<div id="field-drift-banner" class="hidden"
     style="margin-bottom:12px;padding:11px 16px;border-radius:10px;
            border:1.5px solid;display:flex;align-items:flex-start;gap:10px;font-size:12px">
  <span id="field-drift-icon" style="font-size:16px;flex-shrink:0">⚠️</span>
  <div style="flex:1">
    <div id="field-drift-title" style="font-weight:700;margin-bottom:2px"></div>
    <div id="field-drift-body"  style="line-height:1.6;opacity:.85"></div>
  </div>
  <button id="btn-drift-capture" class="btn"
          style="font-size:11px;height:26px;padding:0 10px;flex-shrink:0">
    스냅샷 갱신
  </button>
</div>
```

색상 — `renderFieldSnapshotCard()`에서 동적 설정:

| level | background | border-color | color |
|---|---|---|---|
| filter / no_data | `#fffbeb` | `#f59e0b` | `#92400e` |
| warn | `#fffbeb` | `#fbbf24` | `#92400e` |
| stale / no_snapshot | `#eff6ff` | `#3b82f6` | `#1d4ed8` |

---

### 5-2. 필드 스냅샷 카드 — `.g.g2` Slack 카드 다음

```html
<!-- SalesMap 필드 스냅샷 카드 -->
<div class="card" style="margin-top:16px">
  <div class="card-header">
    <h3>SalesMap 필드 스냅샷</h3>
    <span id="snapshot-badge" class="pill pill-gray pill-dot">미확인</span>
  </div>
  <div class="card-body">

    <div style="display:flex;justify-content:space-between;align-items:center;
                margin-bottom:10px;font-size:12px;color:var(--muted)">
      <span>마지막 확인: <span id="snapshot-ts">—</span></span>
      <span>샘플 <span id="snapshot-sample-count">—</span>건</span>
    </div>

    <div id="snapshot-field-chips"
         style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">
      <!-- renderFieldSnapshotCard()가 동적으로 생성 -->
    </div>

    <div style="font-size:11px;color:var(--muted);margin-bottom:12px;line-height:1.6">
      OCR Pro v9.58 기준 17개 커스텀 필드 ·
      <span style="color:var(--orange)">주황(커버리지)</span>=사업자번호 ·
      <span style="color:var(--orange)">주황(세그)</span>=유입경로 계열 ·
      <span style="color:var(--green)">초록</span>=정상<br>
      코호트 시작 시점(언제 유입)은 SalesMap 네이티브 생성일 기반 — 이 목록과 무관
    </div>

    <button class="btn" id="btn-capture-snapshot">🔍 스냅샷 갱신</button>
    <span id="snapshot-capture-msg"
          style="font-size:12px;color:var(--muted);margin-left:8px"></span>

  </div>
</div>
```

---

## 6. 기존 함수 수정

### `renderSettingsView()` (line 1177) — 1줄 추가

```javascript
function renderSettingsView() {
  renderCohortTokenCard();
  renderFieldSnapshotCard();   // ← 추가
  renderOcrConnections();
  renderGate();
  ...
}
```

---

## 7. 이벤트 바인딩 추가

기존 토큰 바인딩 블록 (~line 1319) 다음에 추가.

```javascript
async function handleCaptureSnapshot() {
  const btns = ["btn-capture-snapshot", "btn-drift-capture"]
    .map(id => document.getElementById(id)).filter(Boolean);
  const msg = document.getElementById("snapshot-capture-msg");

  btns.forEach(b => { b.disabled = true; b.textContent = "갱신 중..."; });
  if (msg) msg.textContent = "";

  try {
    await captureFieldSnapshot();
    renderFieldSnapshotCard();
    toast("SalesMap 필드 스냅샷이 갱신되었습니다.");
  } catch (e) {
    toast("갱신 실패: " + e.message, 2800);
    if (msg) msg.textContent = "실패: " + e.message;
  } finally {
    btns.forEach(b => {
      b.disabled = false;
      b.textContent = b.id === "btn-drift-capture" ? "스냅샷 갱신" : "🔍 스냅샷 갱신";
    });
  }
}

document.getElementById("btn-capture-snapshot")?.addEventListener("click", handleCaptureSnapshot);
document.getElementById("btn-drift-capture")?.addEventListener("click", handleCaptureSnapshot);
```

---

## 8. 작업 순서

| # | 작업 | 위치 | 비고 |
|---|---|---|---|
| 1 | 상수 4개 추가 | `salesmapConfig()` 아래 (~line 542) | 기존 코드 변경 없음 |
| 2 | `salesmapGet()` 추가 | 상수 다음 | OCR Pro 워커 패턴 동일 |
| 3 | `captureFieldSnapshot()` 추가 | `salesmapGet` 다음 | async, 4단계 분류 |
| 4 | `checkFieldDrift()` 추가 | `captureFieldSnapshot` 다음 | 순수 동기 |
| 5 | HTML 경고 배너 추가 | `#view-settings` 첫 자식 | |
| 6 | HTML 스냅샷 카드 추가 | `.g.g2` Slack 카드 다음 | |
| 7 | `renderFieldSnapshotCard()` 추가 | `renderCohortTokenCard` 다음 | |
| 8 | `renderSettingsView()` 수정 | line 1177 | 1줄 추가 |
| 9 | 이벤트 바인딩 추가 | 바인딩 블록 끝 (~line 1319) | |

---

## 9. API 호출 세부 사양

| 항목 | 내용 |
|---|---|
| 엔드포인트 | `GET /v2/organization?limit=5` |
| 응답 파싱 | `data?.data \|\| data?.list \|\| data?.items \|\| data?.organizations \|\| []` |
| 필드명 추출 | `f.name \|\| f.fieldName \|\| f.label \|\| f.key` |
| 샘플 최대 건수 | 5건 union (레코드별 커스텀 필드 입력이 불완전할 수 있으므로) |
| Worker 라우팅 | POST `{url, method:"GET", headers, body:null}` → `base` → `base/proxy` fallback |
| 0건 케이스 | `noData:true`, 전 필드 누락으로 저장, 배너 주황 |
| 오류 케이스 | throw 전파 → `handleCaptureSnapshot`이 toast 표시 |

---

## 10. 테스트 체크리스트

| 케이스 | 확인 항목 |
|---|---|
| 최초 접속 (스냅샷 없음) | 배너 파란 "아직 확인하지 않았습니다" |
| 갱신 버튼 클릭 (토큰 없음) | toast "토큰 미설정" |
| 갱신 성공 (전 필드 있음) | 배너 숨김, 17개 칩 전부 초록 |
| `사업자번호` 누락 시뮬레이션 | 배너 주황 "커버리지 감소", 해당 칩 주황 "(커버리지)" |
| `유입경로` 누락 시뮬레이션 | 배너 주황(연) "세그멘테이션 주의", 해당 칩 주황 "(세그)" |
| `전화` 누락 시뮬레이션 | 배너 숨김 (info만 → 배너 미표시), 칩 파란 "(네이티브 보완)" |
| `noData` (0건 계정) | 배너 주황 "데이터 없음" |
| 스냅샷 ts를 31일 전으로 조작 | 배너 파란 "30일 경과" |
| Worker URL 있는 경우 | Worker POST 형식으로 요청 전송 확인 |
| 배너의 "스냅샷 갱신" 버튼 | 카드 버튼과 동일 동작 |

---

## 11. 범위 외 (이번 구현에 포함 안 함)

- People 필드 스냅샷 (fieldList 3개뿐, 단순)
- 앱 로드 시 자동 drift 감지 (현재 mock 환경, API 실호출 불필요)
- 30일 자동 재캡처 알림 (수동 트리거만)
- SalesMap 필드 정의 전용 API 활용 (엔드포인트 미확인, org 샘플링으로 대체)

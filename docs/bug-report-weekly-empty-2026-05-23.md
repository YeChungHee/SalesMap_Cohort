# 주간 보고서 "데이터 없음" 오류 분석 보고서

- **발견일**: 2026-05-23
- **대상 버전**: v2.7.1
- **증상**: 매주 금요일 자동 생성된 주간 보고서에 `_이번 주 데이터 없음_` / `_데이터 없음_` 출력
- **SalesMap 실제 데이터**: TODO 15건 (05-18~05-22), 신규 회사 05-17·05-21 생성 확인

---

## 원인 1 (치명) — `STATE.weeklyActivity` Race Condition

### 위치
`index.html` line 3581–3611 (`btn-weekly-save`, `btn-weekly-md` 클릭 핸들러)

### 코드 흐름

```
renderWeeklyReport()  ← async 함수
  └─ await salesmapGetAllTasks()      ← API 호출 (비동기)
  └─ STATE.weeklyActivity = actData   ← 여기서 세팅됨

btn-weekly-md click  ← 동기 실행
  └─ const actData = STATE.weeklyActivity  ← null일 수 있음!
  └─ generateWeeklyMd(cohortData, actData) ← actData = undefined
     └─ if (actData) → false → "_데이터 없음_"
```

### 발생 시나리오
자동화 스케줄 태스크(Chrome)가:
1. 페이지 로드 → 주간 보고서 탭 이동 → `renderWeeklyReport()` 시작 (비동기)
2. **API 응답 대기 전에** 즉시 `btn-weekly-md` 클릭

→ `STATE.weeklyActivity`가 아직 `undefined` → actData 없음 → "데이터 없음"

### 수정 방법
`btn-weekly-save` / `btn-weekly-md` 핸들러를 `async`로 변경, `STATE.weeklyActivity`가 null이면 `renderWeeklyReport()` 먼저 await:

```js
$("btn-weekly-md")?.addEventListener("click", async () => {
  if (!STATE.weeklyActivity) await renderWeeklyReport();
  const cohortData = computeWeeklyCohort();
  const actData = STATE.weeklyActivity;
  // ...
});
```

---

## 원인 2 (높음) — TODO `inRange` 날짜 필드 누락

### 위치
`index.html` line 3232–3237 (`inRange` 헬퍼 함수)

### 현재 코드
```js
const inRange = (item) => {
  const at = item.createdAt || item["created_at"] || item["date"]
           || item["생성 날짜"] || item["시작 날짜"] || null;
  // ...
};
```

### 문제
SalesMap TODO API(`/v2/todo`)가 반환하는 날짜 필드는 다음 중 하나:
- `startDate` (시작일 컬럼)
- `startAt` · `endDate` · `dueDate`

`inRange`가 체크하는 `시작 날짜` (한글·공백)는 일치하지 않음.
→ TODO 전체가 `inRange = false` → `periodTodos = []` → `todo.total = 0`

### 수정 방법
```js
const inRange = (item) => {
  const at = item.createdAt || item["created_at"] || item["date"]
           || item.startDate || item.startAt || item.dueDate
           || item.endDate   || item.endAt
           || item["생성 날짜"] || item["시작 날짜"] || item["시작일"]
           || item["종료일"]  || null;
  // ...
};
```

---

## 원인 3 (중간) — TODO `완료` 상태 타입 불일치

### 위치
`index.html` line 3268 (`computeWeeklyActivity` 내부)

### 현재 코드
```js
const done = periodTodos.filter(t =>
  t["완료"] === true || t.completed === true
).length;
```

### 문제
SalesMap API가 완료 상태를 boolean이 아닌 **문자열**로 반환할 가능성:
- `t.status === "완료"` 또는 `t["완료"] === "완료"` 형태

→ 완료 건수가 0으로 집계됨

### 수정 방법
```js
const done = periodTodos.filter(t =>
  t["완료"] === true || t.completed === true
  || t["완료"] === "완료" || t.status === "완료"
  || t["완료"] === "done"
).length;
```

---

## 원인 4 (별도 조사 필요) — 코호트 딜 진입일 기준 문제

### 위치
`index.html` line 3078–3092 (`computeWeeklyCohort`)

### 현재 코드
```js
const dealEntryKey = "거래 준비(세일즈 파이프라인)로 진입한 날짜";
const filteredDeals = STATE.rawDeals.filter(d => {
  const v = d[dealEntryKey];
  if (!v) return false;
  // ...
```

### 문제
- 코호트는 **딜 파이프라인 진입일** 기준으로 필터링
- 사용자가 확인한 신규 회사(05-17·05-21)는 **회사(조직) 생성** 데이터 — 딜과 별개
- 해당 기간에 딜이 새로 진입하지 않았으면 코호트 행 없음

### 조사 항목
1. 신규 회사에 딜이 연결되어 있는가?
2. `거래 준비(세일즈 파이프라인)로 진입한 날짜` 필드가 실제로 존재하는가?
3. 기간 내 신규 조직 생성(DB 생성) 건수를 코호트 "유입" 기준으로 사용할지 결정 필요

---

## 수정 우선순위 및 작업 계획

| 순위 | 버그 | 파일 | 예상 소요 |
|------|------|------|----------|
| 1 | Race Condition — save/md 버튼 async화 | index.html | 10분 |
| 2 | inRange 날짜 필드 확장 | index.html | 5분 |
| 3 | TODO 완료 상태 타입 추가 | index.html | 5분 |
| 4 | 코호트 기준 검토 (별도 논의) | — | 논의 필요 |

**작업 후 버전**: v2.7.2

---

## 검증 방법

1. 대시보드 > 주간 보고서 탭 이동 (API 로드 완전 전)
2. **즉시** MD 다운로드 버튼 클릭
3. 다운로드된 MD 파일에 TODO 건수 및 활동 데이터 포함 여부 확인
4. 데이터 품질 > 검증 실행 → TODO API 응답에서 실제 날짜 필드명 확인

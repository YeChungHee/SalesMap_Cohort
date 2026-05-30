// ─────────────────────────────────────────────────────────────
// computeRealizationModel — index.html 통합용 (라이브 API 실시간 데이터)
//
// index.html 스코프 안에 추가하면 기존 네이티브 헬퍼를 그대로 재사용합니다:
//   - loadPipelineMapping()  : 단계 카테고리(성사/완료/채권)
//   - detectCurrentStage()   : 직접 단계필드 또는 단계 진입날짜로 현재 단계 판정
//   - parseStageDwells()     : "{단계}({파이프라인})로 진입한 날짜" → enteredTs
//   - STATE.orgMap           : organizationId → 업체명
//
// 날짜 우선순위 (운영 정책): 거래일·결제(예정)일을 1순위로 사용.
//   단계 진입일(…로 진입한 날짜)은 데이터 수정 지연이 잦아 폴백으로만 사용.
// 성사일 = 거래일 → 자금집행 완료일 → 자금집행일 → (폴백)자금집행 완료 진입일
// 완료일 = 결제(예정)일 → 결제예정일 → 결제일 → (폴백)결제 완료 진입일
// 다운로드 엑셀(Deal - … 컬럼) 키도 폴백으로 지원하여 양쪽 모두 동작.
// ─────────────────────────────────────────────────────────────
function computeRealizationModel(deals, opts) {
  opts = opts || {};
  var today = opts.today ? new Date(opts.today) : new Date();
  var graceMonths = opts.graceMonths || 6;

  var mapping = loadPipelineMapping();
  var salesMap = Object.fromEntries(mapping.filter(function (m) { return m.pipe === "세일즈"; }).map(function (m) { return [m.stage, m]; }));
  var wonStages       = Object.values(salesMap).filter(function (m) { return m.cat === "성사"; }).map(function (m) { return m.stage; }); // 자금집행 완료
  var completedStages = Object.values(salesMap).filter(function (m) { return m.cat === "완료"; }).map(function (m) { return m.stage; }); // 결제 완료
  var delayStages     = Object.values(salesMap).filter(function (m) { return m.cat === "채권"; }).map(function (m) { return m.stage; }); // 결제 지연

  function amt(d) {
    var v = d["매입액"] || d["거래금액"] || d["자금집행액"] || d["금액"] || d["Deal - 금액"] || d.amount;
    var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
    return isFinite(n) ? n : 0;
  }
  function orgNm(d) {
    var id = d.organizationId || d.organization_id || null;
    return d["업체명"] || d["Organization - 이름"] || d["organization_name"]
      || (id && STATE.orgMap && STATE.orgMap[String(id)] && STATE.orgMap[String(id)].name) || id || "(미상)";
  }
  function tsFrom(raw) { var t = raw ? new Date(raw).getTime() : NaN; return isNaN(t) ? null : t; }
  function wonTs(d, dw) {
    // 1순위: 거래일 계열 / 폴백: 자금집행 완료 진입일
    var direct = tsFrom(d["거래일"] || d["자금집행 완료일"] || d["자금집행일"] || d["Deal - 거래일"]);
    if (direct) return direct;
    for (var i = 0; i < wonStages.length; i++) if (dw[wonStages[i]] && dw[wonStages[i]].enteredTs) return dw[wonStages[i]].enteredTs;
    return null;
  }
  function compTs(d, dw) {
    // 1순위: 결제(예정)일 계열 / 폴백: 결제 완료 진입일
    var direct = tsFrom(d["결제(예정)일"] || d["결제예정일"] || d["결제일"] || d["Deal - 결제(예정)일"]);
    if (direct) return direct;
    for (var i = 0; i < completedStages.length; i++) if (dw[completedStages[i]] && dw[completedStages[i]].enteredTs) return dw[completedStages[i]].enteredTs;
    return null;
  }
  function ym(ts) { var d = new Date(ts); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
  function monthOffYM(c, ref) { return (ref.getFullYear() - +c.slice(0, 4)) * 12 + (ref.getMonth() + 1 - +c.slice(5)); }
  function monthOffTs(a, b) { var x = new Date(a), y = new Date(b); return (y.getFullYear() - x.getFullYear()) * 12 + (y.getMonth() - x.getMonth()); }
  function dayDiff(a, b) { return Math.round((b - a) / 86400000); }
  function pctile(arr, p) { if (!arr.length) return 0; var s = arr.slice().sort(function (a, b) { return a - b; }); return s[Math.max(0, Math.ceil(s.length * p / 100) - 1)]; }

  var completed = 0, pending = 0, late = 0, compAmt = 0, pendAmt = 0, lateAmt = 0;
  var lags = [], cohortTotal = {}, cohortCompOff = {}, forecast = {}, lateList = [];
  var todayTs = today.getTime();

  function addCohort(wts, isDone, off) {
    if (!wts) return;
    var c = ym(wts);
    cohortTotal[c] = (cohortTotal[c] || 0) + 1;
    if (isDone) { if (!cohortCompOff[c]) cohortCompOff[c] = []; cohortCompOff[c].push(Math.max(0, off)); }
  }

  for (var i = 0; i < deals.length; i++) {
    var d = deals[i];
    var dw = parseStageDwells(d, "세일즈 파이프라인");
    var cur = detectCurrentStage(d, "세일즈 파이프라인") || d["Deal - 파이프라인 단계"] || d["파이프라인 단계"];
    if (!cur) continue;
    var wts = wonTs(d, dw), cts = compTs(d, dw);

    if (completedStages.indexOf(cur) >= 0) {
      completed++; compAmt += amt(d);
      addCohort(wts, true, (wts && cts) ? monthOffTs(wts, cts) : 0);
      if (wts && cts) lags.push(dayDiff(wts, cts));
    } else if (wonStages.indexOf(cur) >= 0) {
      addCohort(wts, false, 0);
      var payTs = cts; // 미완료 딜에서 cts는 결제(예정)일 폴백
      if (payTs && payTs >= todayTs) {
        pending++; pendAmt += amt(d);
        var fk = ym(payTs);
        if (!forecast[fk]) forecast[fk] = { count: 0, amount: 0 };
        forecast[fk].count++; forecast[fk].amount += amt(d);
      } else {
        late++; lateAmt += amt(d);
        lateList.push({ org: orgNm(d), stage: cur, won: wts ? ym(wts) : "?", overdueDays: payTs ? dayDiff(payTs, todayTs) : null, amount: amt(d) });
      }
    } else if (delayStages.indexOf(cur) >= 0) {
      addCohort(wts, false, 0);
      late++; lateAmt += amt(d);
      lateList.push({ org: orgNm(d), stage: cur, won: wts ? ym(wts) : "?", overdueDays: cts ? dayDiff(cts, todayTs) : null, amount: amt(d) });
    }
  }

  var total = completed + pending + late;
  var matureCohorts = Object.keys(cohortTotal).filter(function (c) { return monthOffYM(c, today) >= graceMonths; });
  function baselineAt(n) {
    var tot = 0, done = 0;
    matureCohorts.forEach(function (c) { tot += cohortTotal[c]; (cohortCompOff[c] || []).forEach(function (o) { if (o <= n) done++; }); });
    return tot ? Math.round(done / tot * 100) : 0;
  }
  var baseline = []; for (var n = 0; n <= graceMonths; n++) baseline.push(baselineAt(n));
  function cumRate(c, n) { var tot = cohortTotal[c]; if (!tot) return null; var done = (cohortCompOff[c] || []).filter(function (o) { return o <= n; }).length; return Math.round(done / tot * 100); }
  var matrix = Object.keys(cohortTotal).sort().map(function (c) {
    var age = monthOffYM(c, today), cells = [];
    for (var n = 0; n <= graceMonths; n++) cells.push(n <= age ? cumRate(c, n) : null);
    return { cohort: c, won: cohortTotal[c], age: age, mature: age >= graceMonths, cells: cells };
  });
  var matureWon = matureCohorts.reduce(function (s, c) { return s + cohortTotal[c]; }, 0);
  var matureDone = matureCohorts.reduce(function (s, c) { return s + (cohortCompOff[c] || []).filter(function (o) { return o <= graceMonths; }).length; }, 0);
  lateList.sort(function (a, b) { return (b.overdueDays || 0) - (a.overdueDays || 0); });
  var fcArr = Object.keys(forecast).sort().map(function (k) { return { month: k, count: forecast[k].count, amount: forecast[k].amount }; });

  return {
    today: ym(todayTs), graceMonths: graceMonths,
    states: { completed: completed, completedAmt: compAmt, pending: pending, pendingAmt: pendAmt, late: late, lateAmt: lateAmt, total: total,
      overallRate: total ? Math.round(completed / total * 1000) / 10 : 0, matureRate: matureWon ? Math.round(matureDone / matureWon * 1000) / 10 : 0 },
    cycle: { p50: pctile(lags, 50), p90: pctile(lags, 90), max: lags.length ? Math.max.apply(null, lags) : 0, n: lags.length },
    baseline: baseline, matrix: matrix, forecast: fcArr, lateList: lateList
  };
}

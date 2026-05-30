/**
 * daily-slack.js  (CommonJS — Node.js 내장 https 모듈 사용, 외부 의존성 없음)
 * FlowPay Cohort Dashboard — 일일 Slack 보고 스크립트
 * GitHub Actions cron: "0 0 * * 1-5"  (월~금 09:00 KST)
 *
 * 필요 Secrets:
 *   SALESMAP_TOKEN      — SalesMap API 인증 토큰
 *   SALESMAP_WORKER_URL — CORS Proxy Worker URL (예: https://xxx.workers.dev)
 *   SLACK_WEBHOOK_URL   — Slack Incoming Webhook URL
 */

"use strict";
const https = require("https");
const http  = require("http");
const url   = require("url");

// 줄바꿈·공백 제거 (Secret 붙여넣기 오염 방지)
const TOKEN      = (process.env.SALESMAP_TOKEN      || "").trim().replace(/[\r\n\t]/g, "");
const WORKER_URL = (process.env.SALESMAP_WORKER_URL || "").trim().replace(/[\r\n\t]/g, "").replace(/\/$/, "");
const SLACK_HOOK = (process.env.SLACK_WEBHOOK_URL   || "").trim().replace(/[\r\n\t]/g, "");

if (!TOKEN || !WORKER_URL || !SLACK_HOOK) {
  console.error("❌ 필수 환경변수 누락: SALESMAP_TOKEN / SALESMAP_WORKER_URL / SLACK_WEBHOOK_URL");
  console.error("   Settings → Secrets and variables → Actions 에서 3개 Secret을 등록해주세요.");
  process.exit(1);
}

// ── HTTP 요청 헬퍼 ─────────────────────────────────────────
function request(rawUrl, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new url.URL(rawUrl);
    const lib    = parsed.protocol === "https:" ? https : http;
    const req    = lib.request(parsed, options, res => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── SalesMap API 호출 (index.html salesmapGet과 동일한 워커 프록시 프로토콜) ──
// 워커는 POST { url, method, headers, body } 봉투를 받아 SalesMap으로 포워딩한다.
const SALESMAP_BASE = "https://salesmap.kr/api";
const DIAG = [];           // 진단 로그 (슬랙 메시지에 첨부)
let _dbgSnippet = "";       // 첫 200 응답 본문 스니펫
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function smFetch(path, params = {}) {
  const target = new url.URL(`${SALESMAP_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => target.searchParams.set(k, v));
  const headers  = { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` };
  const envelope = JSON.stringify({ url: target.toString(), method: "GET", headers, body: null });
  const base     = WORKER_URL.replace(/\/$/, "");
  let lastErr = null;
  for (const ep of [base, `${base}/proxy`]) {
    // 429(Too Many Requests) 시 백오프 후 최대 4회 재시도
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await request(ep, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(envelope) },
        }, envelope);
        if (res.status === 429) { lastErr = new Error("Worker 429 (rate limit)"); await sleep(1500 * (attempt + 1)); continue; }
        if (res.status !== 200) { lastErr = new Error(`Worker ${res.status}: ${String(res.body).slice(0,60)}`); break; }
        if (!_dbgSnippet) { _dbgSnippet = String(res.body).slice(0, 200); console.log(`🔎 [debug] ${path}:`, _dbgSnippet); }
        return JSON.parse(res.body);
      } catch (e) { lastErr = e; await sleep(800); }
    }
  }
  throw lastErr || new Error(`워커 호출 실패`);
}

// index.html과 동일: 커서 페이지네이션 + 실제 응답 키(data.data.{listKey})
async function fetchAll(path, listKey) {
  let items  = [];
  let cursor = null;
  for (let i = 0; i < 40; i++) {       // 최대 40페이지 × 100건
    const p = { limit: 100 };
    if (cursor) p.cursor = cursor;
    let data;
    try { data = await smFetch(path, p); }
    catch (e) { console.warn(`  ⚠ ${path} 조회 실패: ${e.message}`); DIAG.push(`${path.replace("/v2/","")} ✗ ${e.message}`); break; }
    const d     = (data && data.data) ? data.data : data;
    const batch = (d && (d[listKey] || d.list)) || (Array.isArray(data) ? data : []);
    if (!batch.length) break;
    items  = items.concat(batch);
    cursor = (d && (d.nextCursor || d.next_cursor)) || data.nextCursor || null;
    if (!cursor) break;
    await sleep(200);   // 페이지 간 지연 — 429 방지
  }
  DIAG.push(`${path.replace("/v2/","")} 전체 ${items.length}`);
  return items;
}

// ── 날짜 헬퍼 ──────────────────────────────────────────────
function toKST(d) { return new Date(d.getTime() + 9 * 3600 * 1000); }
function dateStr(d) { return d.toISOString().slice(0, 10); }

function yesterdayKST() {
  const d = toKST(new Date());
  d.setDate(d.getDate() - 1);
  return d;
}

// ── 어제 활동 집계 ─────────────────────────────────────────
async function computeDailyActivity() {
  const yd = dateStr(yesterdayKST());

  // 전체를 받아 어제(KST) 날짜로 클라이언트 필터 (API가 created_from/to 미지원)
  const inDay = item => {
    const at = item.createdAt || item.created_at || item["생성일"] || item["생성 날짜"]
             || item["시작일"] || item.startDate || item.date || null;
    if (!at) return false;
    const t = new Date(at);
    if (isNaN(t)) return false;
    return dateStr(toKST(t)) === yd;
  };

  // 순차 호출 — 동시 호출 시 워커/SalesMap 레이트리밋(429) 발생하므로 하나씩 처리
  const orgs     = await fetchAll("/v2/organization",  "organizationList");
  const leads    = await fetchAll("/v2/lead",          "leadList");
  const memos    = await fetchAll("/v2/memo",          "memoList");
  const todos    = await fetchAll("/v2/todo",          "todoList");
  const dealActs = await fetchAll("/v2/deal/activity", "dealActivityList");
  const leadActs = await fetchAll("/v2/lead/activity", "leadActivityList");

  const newOrgs  = orgs.filter(inDay);
  const newLeads = leads.filter(inDay);
  const dayMemos = memos.filter(inDay);
  const dayTodos = todos.filter(inDay);
  const acts     = [...dealActs, ...leadActs].filter(inDay);

  const todoDone = dayTodos.filter(t =>
    t["완료"] === true || t.completed === true || t["완료"] === "완료"
    || t.status === "완료" || t.status === "done" || t.is_done === true).length;
  // 활동 피드는 한 통의 이메일에 발송·오픈·클릭 이벤트를 각각 보내므로 emailId/smsId 기준 distinct로 집계(중복 제거)
  const emailIds = new Set(), smsIds = new Set();
  acts.forEach(a => { if (a.emailId) emailIds.add(a.emailId); else if (a.smsId) smsIds.add(a.smsId); });
  const sms = smsIds.size;
  const email = emailIds.size;

  return { date: yd, newOrgs: newOrgs.length, newLeads: newLeads.length,
           memos: dayMemos.length, todoDone, todoTotal: dayTodos.length,
           sms, email, actTotal: acts.length };
}

// ── Slack 메시지 생성 ──────────────────────────────────────
function buildSlackMsg(d) {
  return {
    text: `FlowPay 일일 보고 (${d.date})`,
    blocks: [
      { type: "header",
        text: { type: "plain_text", text: `FlowPay 일일 보고 — ${d.date}`, emoji: true } },
      { type: "divider" },
      { type: "section",
        fields: [
          { type: "mrkdwn", text: `*신규 조직*\n${d.newOrgs}건` },
          { type: "mrkdwn", text: `*신규 리드*\n${d.newLeads}건` },
          { type: "mrkdwn", text: `*노트(메모)*\n${d.memos}건` },
          { type: "mrkdwn", text: `*TODO 완료*\n${d.todoDone} / ${d.todoTotal}건` },
          { type: "mrkdwn", text: `*SMS 발송*\n${d.sms}건` },
          { type: "mrkdwn", text: `*이메일 발송*\n${d.email}건` },
        ] },
      { type: "context",
        elements: [{ type: "mrkdwn",
          text: `발송: ${dateStr(toKST(new Date()))} 09:00 KST · FlowPay Cohort Dashboard 자동 보고` }] },
      // ── 임시 진단 블록 (원인 파악 후 제거) ──
      { type: "context",
        elements: [{ type: "mrkdwn",
          text: `🔎 진단 | ${DIAG.join(" · ") || "수집 없음"}\n응답: ${(_dbgSnippet || "(200 응답 없음)").replace(/\n/g, " ")}` }] },
    ],
  };
}

// ── Slack 전송 ─────────────────────────────────────────────
async function sendSlack(payload) {
  const body = JSON.stringify(payload);
  const res  = await request(SLACK_HOOK, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
  }, body);
  if (res.status !== 200) throw new Error(`Slack 전송 실패: ${res.status} ${res.body}`);
}

// ── 메인 ───────────────────────────────────────────────────
(async () => {
  try {
    console.log("🔄 SalesMap API 데이터 수집 중...");
    const data = await computeDailyActivity();
    console.log("📊 집계 결과:", JSON.stringify(data, null, 2));

    const payload = buildSlackMsg(data);
    console.log("📨 Slack 전송 중...");
    await sendSlack(payload);
    console.log("✅ Slack 일일 보고 전송 완료!");
  } catch (err) {
    console.error("❌ 오류 발생:", err.message);
    process.exit(1);
  }
})();

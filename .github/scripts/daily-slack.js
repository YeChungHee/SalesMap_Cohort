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

// ── SalesMap API 호출 ──────────────────────────────────────
async function smFetch(path, params = {}) {
  const target = new url.URL(`${WORKER_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => target.searchParams.set(k, v));
  const res = await request(target.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  });
  if (res.status !== 200) throw new Error(`API ${path} 오류: ${res.status}`);
  return JSON.parse(res.body);
}

async function fetchAll(path, params = {}) {
  let items  = [];
  let cursor = null;
  do {
    const p = { ...params, limit: 100 };
    if (cursor) p.cursor = cursor;
    const data  = await smFetch(path, p);
    const batch = data.items || data.data || data.results || [];
    items  = items.concat(batch);
    cursor = data.next_cursor || data.nextCursor || null;
  } while (cursor);
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

  const [orgs, leads, memos, todos, dealActs] = await Promise.all([
    fetchAll("/v2/organization", { created_from: yd, created_to: yd }),
    fetchAll("/v2/lead",         { created_from: yd, created_to: yd }),
    fetchAll("/v2/memo",         { created_from: yd, created_to: yd }),
    fetchAll("/v2/todo",         { created_from: yd, created_to: yd }),
    fetchAll("/v2/deal/activity",{ created_from: yd, created_to: yd }),
  ]);

  const todoDone = todos.filter(t => t.status === "done" || t.is_done === true).length;
  const sms      = dealActs.filter(a => a.type === "sms"   || a.activity_type === "sms").length;
  const email    = dealActs.filter(a => a.type === "email" || a.activity_type === "email").length;

  return { date: yd, newOrgs: orgs.length, newLeads: leads.length,
           memos: memos.length, todoDone, todoTotal: todos.length,
           sms, email, actTotal: dealActs.length };
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

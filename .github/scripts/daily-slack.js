/**
 * daily-slack.js
 * FlowPay Cohort Dashboard — 일일 Slack 보고 스크립트
 * GitHub Actions cron: "0 0 * * 1-5"  (월~금 09:00 KST)
 *
 * 필요 Secrets:
 *   SALESMAP_TOKEN      — SalesMap API 인증 토큰
 *   SALESMAP_WORKER_URL — CORS Proxy Worker URL (예: https://xxx.workers.dev)
 *   SLACK_WEBHOOK_URL   — Slack Incoming Webhook URL
 */

import fetch from "node-fetch";

const TOKEN        = process.env.SALESMAP_TOKEN;
const WORKER_URL   = (process.env.SALESMAP_WORKER_URL || "").replace(/\/$/, "");
const SLACK_HOOK   = process.env.SLACK_WEBHOOK_URL;

if (!TOKEN || !WORKER_URL || !SLACK_HOOK) {
  console.error("❌ 필수 환경변수 누락: SALESMAP_TOKEN / SALESMAP_WORKER_URL / SLACK_WEBHOOK_URL");
  process.exit(1);
}

// ── 날짜 헬퍼 ──────────────────────────────────────────────
function toKST(d) {
  // UTC → KST (+9)
  return new Date(d.getTime() + 9 * 3600 * 1000);
}

function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

function todayKST() {
  return toKST(new Date());
}

function yesterdayKST() {
  const d = toKST(new Date());
  d.setDate(d.getDate() - 1);
  return d;
}

// ── SalesMap API 호출 ──────────────────────────────────────
async function smFetch(path, params = {}) {
  const url = new URL(`${WORKER_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`API ${path} 오류: ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchAll(path, params = {}) {
  let items = [];
  let cursor = null;
  do {
    const p = { ...params, limit: 100 };
    if (cursor) p.cursor = cursor;
    const data = await smFetch(path, p);
    const batch = data.items || data.data || data.results || [];
    items = items.concat(batch);
    cursor = data.next_cursor || data.nextCursor || null;
  } while (cursor);
  return items;
}

// ── 어제 활동 집계 ─────────────────────────────────────────
async function computeDailyActivity() {
  const yd = dateStr(yesterdayKST());

  // 신규 조직 / 리드
  const [orgs, leads] = await Promise.all([
    fetchAll("/v2/organization", { created_from: yd, created_to: yd }),
    fetchAll("/v2/lead",         { created_from: yd, created_to: yd }),
  ]);

  // 메모 (노트)
  const memos = await fetchAll("/v2/memo", { created_from: yd, created_to: yd });

  // TODO
  const todos   = await fetchAll("/v2/todo", { created_from: yd, created_to: yd });
  const todoDone = todos.filter(t => t.status === "done" || t.is_done === true).length;

  // Deal 활동 (SMS/이메일)
  const dealActs = await fetchAll("/v2/deal/activity", { created_from: yd, created_to: yd });
  const sms   = dealActs.filter(a => a.type === "sms"   || a.activity_type === "sms").length;
  const email = dealActs.filter(a => a.type === "email" || a.activity_type === "email").length;

  return {
    date: yd,
    newOrgs:  orgs.length,
    newLeads: leads.length,
    memos:    memos.length,
    todoDone,
    todoTotal: todos.length,
    sms,
    email,
    actTotal: dealActs.length,
  };
}

// ── Slack 메시지 생성 ──────────────────────────────────────
function buildSlackMsg(d) {
  const today = dateStr(todayKST());
  return {
    text: `*FlowPay 일일 보고 (${d.date})*`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `📋 FlowPay 일일 보고 — ${d.date}`, emoji: true },
      },
      { type: "divider" },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*신규 조직*\n${d.newOrgs}건` },
          { type: "mrkdwn", text: `*신규 리드*\n${d.newLeads}건` },
          { type: "mrkdwn", text: `*노트(메모)*\n${d.memos}건` },
          { type: "mrkdwn", text: `*TODO 완료*\n${d.todoDone} / ${d.todoTotal}건` },
          { type: "mrkdwn", text: `*SMS 발송*\n${d.sms}건` },
          { type: "mrkdwn", text: `*이메일 발송*\n${d.email}건` },
        ],
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `발송일시: ${today} 09:00 KST · FlowPay Cohort Dashboard 자동 보고` },
        ],
      },
    ],
  };
}

// ── Slack 전송 ─────────────────────────────────────────────
async function sendSlack(payload) {
  const res = await fetch(SLACK_HOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Slack 전송 실패: ${res.status} ${body}`);
  }
}

// ── 메인 ───────────────────────────────────────────────────
(async () => {
  try {
    console.log("🔄 SalesMap API 데이터 수집 중...");
    const data = await computeDailyActivity();
    console.log("📊 집계 결과:", data);

    const payload = buildSlackMsg(data);
    console.log("📨 Slack 전송 중...");
    await sendSlack(payload);
    console.log("✅ Slack 일일 보고 전송 완료!");
  } catch (err) {
    console.error("❌ 오류 발생:", err.message);
    process.exit(1);
  }
})();

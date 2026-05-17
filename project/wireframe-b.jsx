/* global React, Sidebar, Topbar, Spark */

// ═══════════════════════════════════════════════════════════════
//  B — Cohort cards / storyboard (narrative, ops-friendly)
// ═══════════════════════════════════════════════════════════════

function CohortCard({ data }) {
  return (
    <div className="box" style={{ display: "grid", gridTemplateColumns: "180px 1fr 280px 110px", alignItems: "stretch" }}>
      {/* identifier */}
      <div style={{ padding: "12px 14px", borderRight: "1.5px dashed var(--line-soft)" }}>
        <div className="lbl" style={{ fontFamily: "var(--hand-2)", fontSize: 11, color: "var(--ink-3)" }}>코호트</div>
        <div style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em" }}>{data.name}</div>
        <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 2 }}>
          가입 <strong>{data.size.toLocaleString()}명</strong>
        </div>
        <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
          {data.tags.map(t => <span key={t} className="tag gray">{t}</span>)}
        </div>
      </div>

      {/* metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", padding: "10px 6px", borderRight: "1.5px dashed var(--line-soft)" }}>
        {data.metrics.map((m, mi) => (
          <div key={mi} style={{ padding: "0 10px" }}>
            <div style={{ fontFamily: "var(--hand-2)", fontSize: 11, color: "var(--ink-3)" }}>{m.label}</div>
            <div style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em", marginTop: 1 }}>
              {m.value}
            </div>
            <div style={{ fontFamily: "var(--hand)", fontSize: 13, color: m.dir === "down" ? "var(--red)" : "var(--green)" }}>
              {m.dir === "down" ? "▼" : "▲"} {m.delta}
            </div>
          </div>
        ))}
      </div>

      {/* sparkline */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "8px 14px", borderRight: "1.5px dashed var(--line-soft)" }}>
        <div style={{ fontFamily: "var(--hand-2)", fontSize: 11, color: "var(--ink-3)", display: "flex", justifyContent: "space-between" }}>
          <span>잔존 곡선</span><span>M+{data.curve.length - 1}</span>
        </div>
        <Spark data={data.curve} w={252} h={50} color={data.dir === "down" ? "#d97706" : "#2D54D6"}/>
      </div>

      {/* status + cta */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <span className={`tag ${data.statusColor}`} style={{ alignSelf: "flex-start", fontFamily: "var(--hand-2)", fontSize: 11 }}>
          {data.status}
        </span>
        <div style={{ fontFamily: "var(--hand)", fontSize: 14, color: "var(--ink-2)", lineHeight: 1.25 }}>
          {data.note}
        </div>
        <span style={{ marginTop: "auto", fontFamily: "var(--hand)", color: "var(--blue-deep)", fontSize: 14, fontWeight: 600 }}>
          드릴다운 →
        </span>
      </div>
    </div>
  );
}

function WireframeB() {
  const cohorts = [
    {
      name: "2026-04", size: 882, tags: ["KR", "Direct", "신규"],
      metrics: [
        { label: "M1 잔존율", value: "79%", delta: "5.2pt", dir: "up" },
        { label: "ARPU", value: "₩42K", delta: "8.1%", dir: "up" },
        { label: "거래 전환", value: "61%", delta: "2.3pt", dir: "up" },
        { label: "활성률", value: "84%", delta: "1.1pt", dir: "up" },
      ],
      curve: [100, 79, 67, 58, 52, 48],
      status: "🌟 우수 코호트", statusColor: "green",
      note: "이번 분기 최상위. 캠페인 \"봄맞이\" 유입.",
      dir: "up",
    },
    {
      name: "2026-03", size: 698, tags: ["KR", "Paid", "리텐션"],
      metrics: [
        { label: "M1 잔존율", value: "74%", delta: "1.4pt", dir: "down" },
        { label: "ARPU", value: "₩38K", delta: "3.0%", dir: "down" },
        { label: "거래 전환", value: "55%", delta: "0.8pt", dir: "up" },
        { label: "활성률", value: "79%", delta: "0.2pt", dir: "down" },
      ],
      curve: [100, 74, 62, 56, 51, 47, 43],
      status: "관찰 중", statusColor: "blue",
      note: "Paid 비중 ↑ 한 코호트 — CAC 동향 점검 필요.",
      dir: "down",
    },
    {
      name: "2026-02", size: 754, tags: ["KR", "Direct", "조정"],
      metrics: [
        { label: "M1 잔존율", value: "76%", delta: "1.0pt", dir: "up" },
        { label: "ARPU", value: "₩40K", delta: "1.2%", dir: "up" },
        { label: "거래 전환", value: "58%", delta: "1.1pt", dir: "up" },
        { label: "활성률", value: "80%", delta: "0.5pt", dir: "up" },
      ],
      curve: [100, 76, 65, 58, 53, 49, 45, 42],
      status: "안정", statusColor: "gray",
      note: "리테션 곡선이 평탄해지는 시점. M+6 추적.",
      dir: "up",
    },
    {
      name: "2026-01", size: 812, tags: ["KR", "Direct"],
      metrics: [
        { label: "M1 잔존율", value: "78%", delta: "3.2pt", dir: "up" },
        { label: "ARPU", value: "₩41K", delta: "4.1%", dir: "up" },
        { label: "거래 전환", value: "60%", delta: "2.7pt", dir: "up" },
        { label: "활성률", value: "82%", delta: "0.7pt", dir: "up" },
      ],
      curve: [100, 78, 67, 60, 55, 51, 47, 44, 41],
      status: "🏆 모범", statusColor: "green",
      note: "M+8까지 평균 +6.2pt. 모범 사례.",
      dir: "up",
    },
  ];

  return (
    <div className="wf">
      <Sidebar />
      <Topbar
        right={
          <>
            <span className="pill">정렬: M1 잔존율 ▾</span>
            <span className="pill">최근 6개월</span>
            <span className="pill solid">코호트 추가</span>
          </>
        }
      />
      <main className="wf-main" style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 12, alignItems: "stretch" }}>
        {/* LEFT: story timeline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontFamily: "var(--hand)", fontSize: 24, fontWeight: 600 }}>이번 달 흐름</div>
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>최신순 · 4개</span>
            <span style={{ flex: 1 }}></span>
            <span className="note">신규 코호트 1개가 평균을 끌어올렸어요.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, overflow: "auto" }}>
            {cohorts.map(c => <CohortCard key={c.name} data={c} />)}
          </div>
        </div>

        {/* RIGHT: anomaly feed + saved views */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="box" style={{ flex: 1 }}>
            <div className="box-title">🔔 이상 신호 <small>최근 7일</small></div>
            <div className="box-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <FeedItem
                color="red"
                title="M+2 이탈 +12pt"
                cohort="2026-03 · Paid"
                time="오늘 09:14"
                body="유입 채널 KR-Paid에서 두 달 연속 이탈 증가."
              />
              <FeedItem
                color="yellow"
                title="평균 ARPU 하락"
                cohort="2026-03"
                time="어제"
                body="₩38K → 전월 대비 -3.0%. 펀드 A 비중 ↓."
              />
              <FeedItem
                color="green"
                title="신규 코호트 성과 우수"
                cohort="2026-04"
                time="2일 전"
                body="모든 핵심 지표가 상위 1분위."
              />
            </div>
          </div>

          <div className="box">
            <div className="box-title">📌 저장된 뷰</div>
            <div className="box-body" style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
              <SavedView name="Q2 KR 신규 추적" sub="필터 3 · 5개 코호트" pinned/>
              <SavedView name="Paid 채널만" sub="필터 1 · 4개 코호트"/>
              <SavedView name="펀드 A 가입자" sub="필터 2 · 8개 코호트"/>
              <span className="chip ghost" style={{ alignSelf: "flex-start", marginTop: 4 }}>+ 새 뷰 저장</span>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function FeedItem({ color, title, cohort, time, body }) {
  const colorMap = {
    red:    "#d64545",
    yellow: "#d97706",
    green:  "#2f8f5b",
  };
  return (
    <div style={{ paddingLeft: 10, borderLeft: `3px solid ${colorMap[color]}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <strong style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 700 }}>{title}</strong>
        <span style={{ fontSize: 10, color: "var(--ink-3)" }}>{time}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 1 }}>{cohort}</div>
      <div style={{ fontFamily: "var(--hand)", fontSize: 14, color: "var(--ink)", marginTop: 4, lineHeight: 1.25 }}>{body}</div>
    </div>
  );
}

function SavedView({ name, sub, pinned }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontFamily: "var(--hand)", fontSize: 14, color: pinned ? "var(--blue-deep)" : "var(--ink)" }}>
        {pinned ? "📍 " : ""}{name}
      </span>
      <span style={{ flex: 1 }}></span>
      <span style={{ fontSize: 10, color: "var(--ink-3)" }}>{sub}</span>
    </div>
  );
}

window.WireframeB = WireframeB;

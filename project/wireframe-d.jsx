/* global React, Sidebar, Topbar */

// ═══════════════════════════════════════════════════════════════
//  D — Funnel + drilldown drawer (ops investigative)
// ═══════════════════════════════════════════════════════════════

function FunnelStage({ idx, label, total, dropRate, split, selected, onClick }) {
  const total0 = 10000; // top-of-funnel reference
  const width = Math.max(38, (total / total0) * 100);
  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        cursor: "pointer",
        background: selected ? "#fff9d6" : "var(--paper)",
        border: selected ? "1.8px solid var(--ink)" : "1.5px solid var(--line)",
        boxShadow: selected ? "3px 3px 0 var(--ink)" : "none",
        padding: "14px 16px",
        display: "grid",
        gridTemplateColumns: "32px 1fr 280px 110px",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span style={{ fontFamily: "var(--hand)", fontSize: 26, color: "var(--ink-3)", fontWeight: 700 }}>{idx}</span>
      <div>
        <div style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 16, letterSpacing: "-0.01em" }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--ink-2)" }}>
          단계 진입 <strong>{total.toLocaleString()}명</strong>
          <span style={{ marginLeft: 10, color: dropRate >= 25 ? "var(--red)" : "var(--ink-3)" }}>
            ↓ 이탈 <strong>{dropRate}%</strong>
          </span>
        </div>
      </div>

      {/* Composition bar: cohort-by-cohort split within this stage */}
      <div style={{ display: "flex", gap: 1, height: 22, border: "1px solid var(--line)", borderRadius: 3, overflow: "hidden", width: `${width}%`, justifySelf: "stretch" }}>
        {split.map((s, i) => (
          <div key={i} title={`${s.name} · ${s.v}%`} style={{ flex: s.v, background: s.c, position: "relative" }}>
            {s.v > 12 && (
              <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 10, color: s.dark ? "#fff" : "var(--ink)", fontWeight: 700 }}>
                {s.v}%
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "var(--hand)", fontSize: 14, color: "var(--blue-deep)", fontWeight: 600 }}>
          {selected ? "선택됨 ▸" : "드릴다운 →"}
        </div>
      </div>
    </div>
  );
}

function WireframeD() {
  // Cohort colors
  const cohortColors = {
    "2026-04": { c: "#2D54D6", dark: true  },
    "2026-03": { c: "#7a93e3", dark: false },
    "2026-02": { c: "#bdcaf2", dark: false },
    "2026-01": { c: "#e6ecfb", dark: false },
  };

  const stages = [
    {
      label: "방문 → 가입", total: 10000, dropRate: 0,
      split: [
        { name: "2026-04", v: 38, ...cohortColors["2026-04"] },
        { name: "2026-03", v: 28, ...cohortColors["2026-03"] },
        { name: "2026-02", v: 20, ...cohortColors["2026-02"] },
        { name: "2026-01", v: 14, ...cohortColors["2026-01"] },
      ],
    },
    {
      label: "가입 → 본인인증", total: 7240, dropRate: 28,
      split: [
        { name: "2026-04", v: 41, ...cohortColors["2026-04"] },
        { name: "2026-03", v: 27, ...cohortColors["2026-03"] },
        { name: "2026-02", v: 20, ...cohortColors["2026-02"] },
        { name: "2026-01", v: 12, ...cohortColors["2026-01"] },
      ],
    },
    {
      label: "본인인증 → 계좌 연결", total: 5100, dropRate: 30,
      split: [
        { name: "2026-04", v: 44, ...cohortColors["2026-04"] },
        { name: "2026-03", v: 26, ...cohortColors["2026-03"] },
        { name: "2026-02", v: 19, ...cohortColors["2026-02"] },
        { name: "2026-01", v: 11, ...cohortColors["2026-01"] },
      ],
    },
    {
      label: "계좌 연결 → 첫 거래", total: 2960, dropRate: 42,
      split: [
        { name: "2026-04", v: 49, ...cohortColors["2026-04"] },
        { name: "2026-03", v: 24, ...cohortColors["2026-03"] },
        { name: "2026-02", v: 18, ...cohortColors["2026-02"] },
        { name: "2026-01", v: 9,  ...cohortColors["2026-01"] },
      ],
      hot: true,
    },
    {
      label: "첫 거래 → 재거래", total: 1842, dropRate: 38,
      split: [
        { name: "2026-04", v: 51, ...cohortColors["2026-04"] },
        { name: "2026-03", v: 23, ...cohortColors["2026-03"] },
        { name: "2026-02", v: 18, ...cohortColors["2026-02"] },
        { name: "2026-01", v: 8,  ...cohortColors["2026-01"] },
      ],
    },
  ];

  const selectedIdx = 3; // 계좌→첫거래
  const selected = stages[selectedIdx];

  return (
    <div className="wf">
      <Sidebar activeName="퍼널"/>
      <Topbar
        title="코호트 × 퍼널"
        sub="Funnel breakdown by cohort"
        right={
          <>
            <span className="pill">최근 4개 코호트</span>
            <span className="pill">전체 지역</span>
            <span className="pill solid">이탈 알럿 추가</span>
          </>
        }
      />
      <main className="wf-main" style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 12 }}>
        {/* LEFT: funnel */}
        <section style={{ display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontFamily: "var(--hand)", fontSize: 22, fontWeight: 600 }}>가입 → 재거래 퍼널</div>
            <span className="note">총 5단계 · 최종 전환율 <strong style={{color:"var(--ink)"}}>18.4%</strong></span>
            <span style={{ flex: 1 }}></span>
            <div className="toggle">
              <span className="on">코호트별 분할</span><span>전체</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative", flex: 1 }}>
            {stages.map((s, i) => (
              <React.Fragment key={i}>
                <FunnelStage
                  idx={i + 1}
                  {...s}
                  selected={i === selectedIdx}
                />
                {i < stages.length - 1 && (
                  <div style={{ height: 8, display: "flex", justifyContent: "center", color: s.hot ? "var(--red)" : "var(--ink-3)", fontFamily: "var(--hand)", fontSize: 13 }}>
                    ↓
                  </div>
                )}
              </React.Fragment>
            ))}
            {/* hot stage annotation */}
            <div style={{ position: "absolute", right: -8, top: 230, fontFamily: "var(--hand)", color: "var(--red)", fontSize: 15, fontWeight: 700, transform: "rotate(-4deg)" }}>
              가장 큰 이탈 ⬅
            </div>
          </div>

          {/* legend */}
          <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--ink-2)", padding: "6px 4px" }}>
            <span style={{ fontFamily: "var(--hand-2)" }}>코호트:</span>
            {Object.entries(cohortColors).map(([k, v]) => (
              <span key={k}><span style={{ display: "inline-block", width: 10, height: 10, background: v.c, marginRight: 4, borderRadius: 2, verticalAlign: "middle" }}></span>{k}</span>
            ))}
          </div>
        </section>

        {/* RIGHT: drilldown drawer */}
        <aside className="box" style={{ background: "#fffef7", borderColor: "var(--ink)", borderWidth: 2, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px 8px", borderBottom: "1.5px dashed var(--line-soft)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ background: "var(--ink)", color: "var(--paper)", fontFamily: "var(--sans)", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 3 }}>
                단계 {selectedIdx + 1}
              </span>
              <span className="tag red" style={{ fontFamily: "var(--hand-2)" }}>이탈률 42%</span>
              <span style={{ flex: 1 }}></span>
              <span className="icobtn" style={{ fontFamily: "var(--hand)" }}>×</span>
            </div>
            <div style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 19, letterSpacing: "-0.02em", marginTop: 6 }}>
              {selected.label}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 1 }}>
              <strong>2,140명</strong> 이탈 · 평균 체류 <strong>3분 12초</strong>
            </div>
          </div>

          {/* per-cohort breakdown */}
          <div style={{ padding: "10px 16px" }}>
            <div style={{ fontFamily: "var(--hand-2)", fontSize: 11, color: "var(--ink-3)", marginBottom: 6 }}>코호트별 이탈률</div>
            {[
              { name: "2026-04", n: 670, drop: 35, color: "#2D54D6" },
              { name: "2026-03", n: 510, drop: 44, color: "#7a93e3" },
              { name: "2026-02", n: 380, drop: 47, color: "#bdcaf2" },
              { name: "2026-01", n: 280, drop: 49, color: "#e6ecfb" },
            ].map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "70px 1fr 50px", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{r.name}</span>
                <div style={{ height: 16, background: "#f0eee5", borderRadius: 3, position: "relative", border: "1px solid var(--line-soft)" }}>
                  <div style={{ position: "absolute", inset: 0, width: `${r.drop * 1.8}%`, background: r.color, borderRadius: "3px 0 0 3px" }}></div>
                  <span style={{ position: "absolute", left: 6, top: 0, fontSize: 10, color: r.drop > 40 ? "#fff" : "var(--ink)", fontWeight: 700, lineHeight: "16px" }}>{r.drop}% 이탈</span>
                </div>
                <span style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "right" }}>n={r.n}</span>
              </div>
            ))}
          </div>

          {/* hypothesis / suspects */}
          <div style={{ padding: "0 16px 10px" }}>
            <div style={{ fontFamily: "var(--hand-2)", fontSize: 11, color: "var(--ink-3)", marginBottom: 6 }}>의심 원인</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <SuspectRow tag="UX" title="계좌 연결 화면 약관 길이" weight={0.62}/>
              <SuspectRow tag="기술" title="2026-03 출시된 OAuth 흐름 오류" weight={0.41}/>
              <SuspectRow tag="시장" title="ETF 시장 변동성" weight={0.18}/>
            </div>
          </div>

          {/* actions */}
          <div style={{ marginTop: "auto", padding: "12px 16px", borderTop: "1.5px dashed var(--line-soft)", display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="note">이 단계로 액션 만들기</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <span className="chip">📩 이메일 캠페인</span>
              <span className="chip">🔔 알럿 규칙</span>
              <span className="chip">🧪 A/B 테스트</span>
              <span className="chip blue">→ 작업 티켓</span>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function SuspectRow({ tag, title, weight }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 44px", alignItems: "center", gap: 8 }}>
      <span className="tag gray" style={{ justifySelf: "start" }}>{tag}</span>
      <span style={{ fontSize: 12 }}>{title}</span>
      <span style={{ fontFamily: "var(--hand)", color: "var(--ink-2)", fontWeight: 600, fontSize: 14, textAlign: "right" }}>
        {Math.round(weight * 100)}%
      </span>
    </div>
  );
}

window.WireframeD = WireframeD;

/* global React, Sidebar, Topbar, FilterRow, Spark, KPI, hmColor */

// ═══════════════════════════════════════════════════════════════
//  A — Retention heatmap-first (data-dense, analyst-oriented)
// ═══════════════════════════════════════════════════════════════

function WireframeA() {
  const cohorts = [
    { name: "2025-06", size: 482, row: [100, 64, 51, 44, 39, 36, 33, 31, 29, 27, 25, 24] },
    { name: "2025-07", size: 521, row: [100, 66, 53, 46, 41, 38, 35, 33, 30, 28, 26, null] },
    { name: "2025-08", size: 498, row: [100, 62, 49, 42, 37, 34, 31, 28, 26, 24, null, null] },
    { name: "2025-09", size: 612, row: [100, 71, 58, 51, 46, 42, 39, 36, 33, null, null, null] },
    { name: "2025-10", size: 588, row: [100, 68, 54, 47, 42, 38, 35, 32, null, null, null, null] },
    { name: "2025-11", size: 645, row: [100, 73, 61, 54, 49, 45, 42, null, null, null, null, null] },
    { name: "2025-12", size: 701, row: [100, 75, 64, 57, 52, 48, null, null, null, null, null, null] },
    { name: "2026-01", size: 812, row: [100, 78, 67, 60, 55, null, null, null, null, null, null, null] },
    { name: "2026-02", size: 754, row: [100, 76, 65, 58, null, null, null, null, null, null, null, null] },
    { name: "2026-03", size: 698, row: [100, 74, 62, null, null, null, null, null, null, null, null, null] },
    { name: "2026-04", size: 882, row: [100, 79, null, null, null, null, null, null, null, null, null, null] },
    { name: "2026-05", size: 412, row: [100, null, null, null, null, null, null, null, null, null, null, null] },
  ];

  const monthSpark = [62, 65, 61, 71, 68, 73, 75, 78, 76, 74, 79];
  const sizeSpark = [482, 521, 498, 612, 588, 645, 701, 812, 754, 698, 882, 412];

  return (
    <div className="wf">
      <Sidebar />
      <Topbar
        right={
          <>
            <span className="pill">이번 분기 ▾</span>
            <span className="pill">전체 채널</span>
            <span className="pill solid">코호트 추가</span>
          </>
        }
      />
      <main className="wf-main">
        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          <KPI label="추적 중인 코호트" value="12" />
          <KPI label="평균 M1 잔존율" value={<>71<small style={{fontSize:14, fontWeight:600}}>%</small></>} delta="+2.4pt" spark={monthSpark}/>
          <KPI label="활성 사용자 (MAU)" value="8,124" delta="+5.1%" spark={sizeSpark}/>
          <KPI label="누적 거래액" value={<>₩12.4<small style={{fontSize:14, fontWeight:600}}>억</small></>} delta="-1.2%" deltaDir="down" spark={[1,1.1,1.05,1.2,1.15,1.3,1.25,1.4,1.35,1.5,1.45,1.4]}/>
        </div>

        {/* HEATMAP */}
        <div className="box" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div className="box-title">
            잔존율 코호트 매트릭스 <small>가입 월 × 경과 개월</small>
            <span style={{ flex: 1 }}></span>
            <div className="toggle" style={{ marginRight: 14 }}>
              <span className="on">잔존율</span><span>거래액</span><span>ARPU</span>
            </div>
          </div>
          <div className="box-body" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "118px repeat(12, 1fr)", gap: 2, fontSize: 10, color: "var(--ink-3)", marginBottom: 4, paddingLeft: 4 }}>
              <div></div>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} style={{ textAlign: "center", fontFamily: "var(--hand-2)", fontWeight: 700 }}>M+{i}</div>
              ))}
            </div>
            {/* Rows */}
            <div style={{ flex: 1, display: "grid", gridTemplateRows: `repeat(${cohorts.length}, 1fr)`, gap: 2 }}>
              {cohorts.map((c, ri) => (
                <div key={ri} style={{ display: "grid", gridTemplateColumns: "118px repeat(12, 1fr)", gap: 2, alignItems: "stretch" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 4, fontSize: 11 }}>
                    <strong style={{ fontFamily: "var(--sans)", fontWeight: 700 }}>{c.name}</strong>
                    <span style={{ color: "var(--ink-3)", fontSize: 10 }}>n={c.size}</span>
                  </div>
                  {c.row.map((v, ci) => (
                    <div
                      key={ci}
                      className="cell"
                      style={{
                        background: v == null ? "repeating-linear-gradient(45deg, #f4f1e8 0 4px, #fff 4px 8px)" : hmColor(v),
                        color: v != null && v > 50 ? "#fff" : "var(--ink)",
                        fontSize: 10,
                        border: v == null ? "1px dashed var(--line-soft)" : "none",
                        minHeight: 22,
                        display: "grid", placeItems: "center",
                      }}
                    >
                      {v != null && v}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* legend + callout */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 14px 12px", fontSize: 11, color: "var(--ink-2)" }}>
            <span>잔존율</span>
            <div style={{ display: "flex", gap: 2 }}>
              {[10,30,50,70,90].map(v => (
                <div key={v} style={{ width: 24, height: 12, background: hmColor(v) }}></div>
              ))}
            </div>
            <span style={{ color: "var(--ink-3)" }}>0% ─ 100%</span>
            <span style={{ flex: 1 }}></span>
            <span className="note hl">2026-01 코호트가 가장 우수한 M+4 잔존율 보임</span>
          </div>
        </div>

        {/* Bottom row: comparison + segment */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
          <div className="box" style={{ height: 142 }}>
            <div className="box-title">
              잔존 곡선 비교 <small>최근 3개 코호트</small>
            </div>
            <div className="box-body" style={{ padding: "0 14px 12px" }}>
              <CurvesCompare/>
            </div>
          </div>
          <div className="box" style={{ height: 142, display: "flex", flexDirection: "column" }}>
            <div className="box-title">세그먼트 필터 <small>적용 중 3</small></div>
            <div className="box-body" style={{ display: "flex", flexWrap: "wrap", gap: 6, alignContent: "flex-start" }}>
              <span className="chip on">채널 = Direct <span className="x">×</span></span>
              <span className="chip on">국가 = KR <span className="x">×</span></span>
              <span className="chip on">상품 = 펀드 A <span className="x">×</span></span>
              <span className="chip ghost">+ 추가</span>
              <div style={{ width: "100%" }}></div>
              <span className="chip-hand chip" style={{ background: "var(--yellow)", borderColor: "var(--ink)" }}>저장된 뷰: "Q2 KR 신규"</span>
              <span className="chip ghost">전체 저장 뷰 4 ▸</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function CurvesCompare() {
  const curves = [
    { name: "2026-01", color: "#2D54D6", data: [100, 78, 67, 60, 55, 51, 47, 44, 41, 39, 37, 35] },
    { name: "2026-02", color: "#d97706", data: [100, 76, 65, 58, 53, 49, 45, 42, 39, 37, 35, 33] },
    { name: "2026-03", color: "#2f8f5b", data: [100, 74, 62, 56, 51, 47, 43, 40, 38, 36, 34, 32] },
  ];
  const W = 540, H = 88, P = 18;
  const ys = v => H - P - (v / 100) * (H - P * 2);
  const xs = i => P + (i / 11) * (W - P * 2);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
        <line x1={P} y1={H-P} x2={W-P} y2={H-P} stroke="#1a1d24" strokeWidth="1.5"/>
        <line x1={P} y1={P}   x2={P}   y2={H-P} stroke="#1a1d24" strokeWidth="1.5"/>
        {[25,50,75,100].map(v => (
          <line key={v} x1={P} x2={W-P} y1={ys(v)} y2={ys(v)} stroke="#c8c4b8" strokeDasharray="3 3" strokeWidth="1"/>
        ))}
        {curves.map((c, ci) => {
          const d = c.data.map((v, i) => `${i ? "L" : "M"}${xs(i)},${ys(v)}`).join(" ");
          return <path key={ci} d={d} fill="none" stroke={c.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>;
        })}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
        {curves.map(c => (
          <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 3, background: c.color, borderRadius: 2 }}></span>
            <strong style={{ fontFamily: "var(--sans)", fontWeight: 700 }}>{c.name}</strong>
            <span style={{ color: "var(--ink-3)" }}>{c.data[c.data.length - 1]}% @M+11</span>
          </div>
        ))}
      </div>
    </div>
  );
}

window.WireframeA = WireframeA;

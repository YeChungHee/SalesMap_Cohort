/* global React, Sidebar, Topbar */

// ═══════════════════════════════════════════════════════════════
//  C — Compare mode (side-by-side, exec-friendly)
// ═══════════════════════════════════════════════════════════════

function MiniCurve({ data, color = "#2D54D6", h = 60, w = 260 }) {
  const P = 8;
  const ys = v => h - P - (v / 100) * (h - P * 2);
  const xs = i => P + (i / (data.length - 1)) * (w - P * 2);
  const d = data.map((v, i) => `${i ? "L" : "M"}${xs(i)},${ys(v)}`).join(" ");
  const dArea = d + ` L${w-P},${h-P} L${P},${h-P} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
      <line x1={P} y1={h-P} x2={w-P} y2={h-P} stroke="#1a1d24" strokeWidth="1.2"/>
      {[25,50,75].map(v => (
        <line key={v} x1={P} x2={w-P} y1={ys(v)} y2={ys(v)} stroke="#c8c4b8" strokeDasharray="2 3" strokeWidth="1"/>
      ))}
      <path d={dArea} fill={color} opacity="0.12"/>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      {data.map((v, i) => (
        <circle key={i} cx={xs(i)} cy={ys(v)} r="2.5" fill="#fff" stroke={color} strokeWidth="1.5"/>
      ))}
    </svg>
  );
}

function MiniBars({ data, color = "#2D54D6", h = 60 }) {
  const W = 260, P = 8;
  const max = Math.max(...data);
  const bw = (W - P * 2) / data.length - 4;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%" height={h}>
      <line x1={P} y1={h-P} x2={W-P} y2={h-P} stroke="#1a1d24" strokeWidth="1.2"/>
      {data.map((v, i) => {
        const bh = (v / max) * (h - P * 2);
        const x = P + i * (bw + 4) + 2;
        return <rect key={i} x={x} y={h - P - bh} width={bw} height={bh} fill={color} opacity={0.85}/>;
      })}
    </svg>
  );
}

function CompareCol({ accent, name, sub, role, metrics, curve, bars, donut, color }) {
  return (
    <div className="box" style={{ flex: 1, display: "flex", flexDirection: "column", borderColor: accent ? color : "var(--line)", borderWidth: accent ? 2 : 1.5 }}>
      {/* header */}
      <div style={{ padding: "12px 16px 10px", borderBottom: `1.5px ${accent ? "solid" : "dashed"} ${accent ? color : "var(--line-soft)"}`, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 16, height: 16, background: color, borderRadius: 4 }}></span>
        <div>
          <div style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>{name}</div>
          <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{sub}</div>
        </div>
        <span style={{ flex: 1 }}></span>
        <span className="chip ghost">변경 ▾</span>
      </div>

      {/* metric grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 1, background: "var(--line-soft)", borderBottom: "1.5px dashed var(--line-soft)" }}>
        {metrics.map((m, mi) => (
          <div key={mi} style={{ background: "var(--paper)", padding: "10px 14px" }}>
            <div style={{ fontFamily: "var(--hand-2)", fontSize: 11, color: "var(--ink-3)" }}>{m.label}</div>
            <div style={{ fontFamily: "var(--sans)", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>{m.value}</div>
            <div style={{ fontFamily: "var(--hand)", fontSize: 13, color: m.dir === "down" ? "var(--red)" : "var(--green)" }}>
              {m.dir === "down" ? "▼" : "▲"} {m.delta}
            </div>
          </div>
        ))}
      </div>

      {/* curve */}
      <div style={{ padding: "10px 14px 6px" }}>
        <div className="lbl" style={{ fontFamily: "var(--hand-2)", fontSize: 11, color: "var(--ink-3)", marginBottom: 2 }}>잔존율 곡선 (M0 → M+8)</div>
        <MiniCurve data={curve} color={color} h={72}/>
      </div>

      {/* bars */}
      <div style={{ padding: "0 14px 6px" }}>
        <div className="lbl" style={{ fontFamily: "var(--hand-2)", fontSize: 11, color: "var(--ink-3)", marginBottom: 2 }}>월별 거래량 (M0~M+5)</div>
        <MiniBars data={bars} color={color} h={64}/>
      </div>

      {/* donut/composition */}
      <div style={{ padding: "0 14px 12px", display: "flex", gap: 14, alignItems: "center", marginTop: "auto" }}>
        <Donut data={donut} color={color}/>
        <div style={{ fontSize: 11, flex: 1 }}>
          <div className="lbl" style={{ fontFamily: "var(--hand-2)", color: "var(--ink-3)", marginBottom: 4 }}>채널 구성</div>
          {donut.map((d, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", lineHeight: 1.5 }}>
              <span><span style={{ display: "inline-block", width: 8, height: 8, background: d.c, marginRight: 5, borderRadius: 2 }}></span>{d.l}</span>
              <strong>{d.v}%</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Donut({ data, color }) {
  const cx = 36, cy = 36, r = 26;
  let a = -Math.PI / 2;
  const total = data.reduce((s, d) => s + d.v, 0);
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      {data.map((d, i) => {
        const sweep = (d.v / total) * Math.PI * 2;
        const x1 = cx + r * Math.cos(a), y1 = cy + r * Math.sin(a);
        a += sweep;
        const x2 = cx + r * Math.cos(a), y2 = cy + r * Math.sin(a);
        const large = sweep > Math.PI ? 1 : 0;
        const path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`;
        return <path key={i} d={path} fill={d.c}/>;
      })}
      <circle cx={cx} cy={cy} r={14} fill="var(--paper)"/>
    </svg>
  );
}

function WireframeC() {
  const A = {
    name: "Cohort 2026-03",
    sub: "n=698 · KR · 가입월",
    metrics: [
      { label: "M1 잔존율", value: "74%",  delta: "-1.4pt", dir: "down" },
      { label: "ARPU",      value: "₩38K", delta: "-3.0%",  dir: "down" },
      { label: "거래 전환", value: "55%",  delta: "+0.8pt", dir: "up"   },
      { label: "M3 잔존율", value: "62%",  delta: "-2.1pt", dir: "down" },
    ],
    curve: [100, 74, 62, 56, 51, 47, 43, 40, 38],
    bars: [698, 512, 432, 388, 354, 326],
    donut: [
      { l: "Direct", v: 42, c: "#2D54D6" },
      { l: "Paid",   v: 38, c: "#9bb0e9" },
      { l: "Refer",  v: 14, c: "#d7dff5" },
      { l: "Other",  v: 6,  c: "#e8e6dd" },
    ],
    color: "#2D54D6",
  };

  const B = {
    name: "Cohort 2026-04",
    sub: "n=882 · KR · 가입월",
    metrics: [
      { label: "M1 잔존율", value: "79%",  delta: "+5.2pt", dir: "up" },
      { label: "ARPU",      value: "₩42K", delta: "+8.1%",  dir: "up" },
      { label: "거래 전환", value: "61%",  delta: "+2.3pt", dir: "up" },
      { label: "M3 잔존율", value: "67%",  delta: "+4.8pt", dir: "up" },
    ],
    curve: [100, 79, 67, 58, 52, 48, 45, 42, 40],
    bars: [882, 697, 591, 511, 459, 423],
    donut: [
      { l: "Direct", v: 56, c: "#d97706" },
      { l: "Paid",   v: 26, c: "#f0bb6e" },
      { l: "Refer",  v: 12, c: "#fde7c4" },
      { l: "Other",  v: 6,  c: "#e8e6dd" },
    ],
    color: "#d97706",
  };

  // delta callouts (B vs A)
  const deltas = [
    { label: "M1 잔존율", delta: "+5.2pt", dir: "up",   reason: "Direct 채널 비중 ↑" },
    { label: "ARPU",       delta: "+₩4K",  dir: "up",   reason: "펀드 A 신규 가입자 ↑"  },
    { label: "거래 전환",  delta: "+6.0pt",dir: "up",   reason: "온보딩 개선 효과로 추정" },
    { label: "코호트 크기",delta: "+184명", dir: "up",   reason: "봄맞이 캠페인" },
  ];

  return (
    <div className="wf">
      <Sidebar />
      <Topbar
        title="코호트 비교"
        sub="Compare two cohorts side-by-side"
        right={
          <>
            <span className="pill">M+8까지</span>
            <span className="pill">잔존율 ▾</span>
            <span className="pill solid">리포트 내보내기</span>
          </>
        }
      />
      <main className="wf-main" style={{ display: "grid", gridTemplateRows: "auto 1fr auto", gap: 12 }}>
        {/* selectors row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 14 }}>
          <Selector color="#2D54D6" label="A" name="Cohort 2026-03" sub="n = 698"/>
          <div style={{ fontFamily: "var(--hand)", fontSize: 36, color: "var(--ink-3)" }}>vs</div>
          <Selector color="#d97706" label="B" name="Cohort 2026-04" sub="n = 882"/>
        </div>

        {/* compare columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <CompareCol {...A} role="A"/>
          <CompareCol {...B} role="B" accent/>
        </div>

        {/* delta summary */}
        <div className="box" style={{ background: "#fff9d6", borderColor: "var(--ink)" }}>
          <div className="box-title" style={{ paddingTop: 10 }}>
            <span style={{ background: "var(--ink)", color: "var(--paper)", padding: "2px 8px", borderRadius: 4, fontFamily: "var(--sans)", fontSize: 11, fontWeight: 700 }}>요약</span>
            B가 A보다 우위
            <small>Δ가 의미있는 지표 4개</small>
          </div>
          <div className="box-body" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            {deltas.map((d, di) => (
              <div key={di} style={{ display: "flex", gap: 8 }}>
                <span style={{ fontFamily: "var(--hand)", fontSize: 22, fontWeight: 700, color: d.dir === "down" ? "var(--red)" : "var(--green)" }}>
                  {d.dir === "down" ? "▼" : "▲"} {d.delta}
                </span>
                <div>
                  <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 700 }}>{d.label}</div>
                  <div style={{ fontFamily: "var(--hand)", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.2 }}>{d.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function Selector({ color, label, name, sub }) {
  return (
    <div className="box" style={{ padding: "10px 14px", borderColor: color, borderWidth: 2, display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 32, height: 32, background: color, color: "#fff", borderRadius: 6, display: "grid", placeItems: "center", fontFamily: "var(--hand)", fontWeight: 700, fontSize: 22 }}>{label}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 18 }}>{name}</div>
        <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{sub}</div>
      </div>
      <span className="chip ghost">변경</span>
    </div>
  );
}

window.WireframeC = WireframeC;

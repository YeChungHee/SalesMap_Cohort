/* global React */

// ── Shared Shell (Sidebar + Topbar) used by every wireframe ──

const NAV_GROUPS = [
  { label: "MAIN", items: [
    { name: "대시보드", on: false, ico: "□" },
    { name: "코호트 분석", on: true,  ico: "▦" },
    { name: "퍼널",       on: false, ico: "▽" },
  ]},
  { label: "RUN", items: [
    { name: "캠페인",     on: false, ico: "◉" },
    { name: "세그먼트",   on: false, ico: "◇" },
    { name: "알럿",       on: false, ico: "△" },
  ]},
  { label: "ADMIN", items: [
    { name: "데이터 소스", on: false, ico: "▤" },
    { name: "사용자",      on: false, ico: "◯" },
    { name: "설정",        on: false, ico: "✕" },
  ]},
];

function Sidebar({ activeName = "코호트 분석" }) {
  return (
    <aside className="wf-side">
      <div className="brand">
        <div className="mark"></div>
        <div className="name">
          SalesMap
          <small>v1.0 · 코호트</small>
        </div>
      </div>
      {NAV_GROUPS.map((g, gi) => (
        <div key={gi}>
          <div className="sec">{g.label}</div>
          <div className="nav">
            {g.items.map((it, ii) => (
              <a key={ii} href="#" className={it.name === activeName ? "on" : ""}>
                <span className="ico"></span>
                {it.name}
              </a>
            ))}
          </div>
        </div>
      ))}
      <div className="foot">
        <div><span className="dot"></span>BigQuery · 동기화 OK</div>
        <div style={{ marginTop: 4, color: "#8b8f99" }}>05/17 14:22 KST</div>
      </div>
    </aside>
  );
}

function Topbar({ title = "코호트 분석", sub = "Cohort dashboard", right, role = "ops" }) {
  return (
    <header className="wf-top">
      <div className="crumb">
        {title}
        <small>{sub}</small>
      </div>
      <span className={`role ${role === "admin" ? "admin" : "ops"}`}>
        {role === "admin" ? "Admin" : "Operations"}
      </span>
      <div className="grow"></div>
      {right}
    </header>
  );
}

function FilterRow({ items = [], rightSlot }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      {items.map((it, i) =>
        typeof it === "string" ? (
          <span key={i} className="pill">{it} <span className="cv"></span></span>
        ) : (
          <span key={i} className={`pill ${it.solid ? "solid" : ""}`}>
            {it.label}{!it.solid && <span className="cv"></span>}
          </span>
        )
      )}
      <span style={{ flex: 1 }}></span>
      {rightSlot}
    </div>
  );
}

// Mini sketched sparkline (SVG)
function Spark({ data, w = 64, h = 24, color = "#2D54D6", area = true }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / Math.max(0.001, max - min)) * (h - 4) - 2;
    return [x, y];
  });
  const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const dArea = d + ` L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
      {area && <path d={dArea} fill={color} opacity="0.15" />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function KPI({ label, value, delta, deltaDir = "up", spark, color = "#2D54D6" }) {
  return (
    <div className="kpi">
      <div className="lbl">{label}</div>
      <div className="val">
        {value}
        {delta && <span className={`delta ${deltaDir === "down" ? "down" : ""}`}>{deltaDir === "down" ? "▼ " : "▲ "}{delta}</span>}
      </div>
      {spark && <div className="spark"><Spark data={spark} color={color}/></div>}
    </div>
  );
}

// Heatmap cell value → opacity (retention)
function hmColor(v) {
  if (v == null) return "rgba(0,0,0,0)";
  const o = Math.min(1, Math.max(0.06, v / 100));
  return `rgba(45,84,214,${o.toFixed(2)})`;
}

window.Sidebar = Sidebar;
window.Topbar = Topbar;
window.FilterRow = FilterRow;
window.Spark = Spark;
window.KPI = KPI;
window.hmColor = hmColor;

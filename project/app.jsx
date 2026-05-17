/* global React, ReactDOM, DesignCanvas, DCSection, DCArtboard,
   WireframeA, WireframeB, WireframeC, WireframeD,
   TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakToggle, TweakColor */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "fidelity": "low",
  "accent": "#2D54D6",
  "grid": true,
  "highlights": true
}/*EDITMODE-END*/;

function applyTweaks(t) {
  const r = document.documentElement;
  r.style.setProperty("--blue", t.accent);
  // Recompute tint
  const tint = t.accent + "1f"; // 12% via hex alpha
  r.style.setProperty("--blue-tint", tint);
  r.style.setProperty("--hand-display", t.fidelity === "low" ? "var(--hand)" : "var(--sans)");
  r.classList.toggle("no-grid", !t.grid);
  r.classList.toggle("no-hl",   !t.highlights);
  r.classList.toggle("fi-mid",  t.fidelity === "mid");
}

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  React.useEffect(() => { applyTweaks(tweaks); }, [tweaks]);

  return (
    <>
      <DesignCanvas
        title="세일즈맵 코호트 대시보드 · 와이어프레임"
        subtitle="v1.0을 토대로 한 4가지 IA 방향성 — sketchy / low-fi"
      >
        <DCSection id="main" title="코호트 대시보드 — 메인 화면" subtitle="동일한 데이터를 4가지 정보구조로">
          <DCArtboard id="a" label="A · 잔존 히트맵 우선" width={1280} height={820}>
            <WireframeA/>
          </DCArtboard>
          <DCArtboard id="b" label="B · 코호트 카드 / 스토리보드" width={1280} height={820}>
            <WireframeB/>
          </DCArtboard>
          <DCArtboard id="c" label="C · 비교 모드 (A vs B)" width={1280} height={820}>
            <WireframeC/>
          </DCArtboard>
          <DCArtboard id="d" label="D · 퍼널 + 드릴다운 드로어" width={1280} height={820}>
            <WireframeD/>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="충실도">
          <TweakRadio
            label="Fidelity"
            value={tweaks.fidelity}
            options={[
              { value: "low", label: "Low-fi" },
              { value: "mid", label: "Mid-fi" },
            ]}
            onChange={(v) => setTweak("fidelity", v)}
          />
        </TweakSection>

        <TweakSection label="스타일">
          <TweakColor
            label="Accent"
            value={tweaks.accent}
            options={["#2D54D6", "#043EC4", "#d97706", "#2f8f5b"]}
            onChange={(v) => setTweak("accent", v)}
          />
          <TweakToggle
            label="도트 그리드"
            value={tweaks.grid}
            onChange={(v) => setTweak("grid", v)}
          />
          <TweakToggle
            label="형광펜 강조"
            value={tweaks.highlights}
            onChange={(v) => setTweak("highlights", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App/>);

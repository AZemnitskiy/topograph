'use client';

import React from 'react';
import { useStore, useDisplayValues, type Mode, type TutorialData } from '../store/state';
import {
  ACCENT, ACCENT2, TEXT, TEXT_DIM, BG_CARD, GREEN, RED_COL, ORANGE, LIME,
  UI_TEXT, fmtVal, esc,
} from '../lib/topograph-render';
import { Q as Qeval, discriminant, classify, areEquivalent, reduceForm } from '../lib/topograph-math';

// ---------------------------------------------------------------------------
// Primitive controls
// ---------------------------------------------------------------------------

function SliderInt({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ color: UI_TEXT, fontSize: '0.8125rem', fontWeight: 600 }}>{label}</span>
          <span style={{ color: ACCENT, fontSize: '0.8125rem', fontWeight: 600 }}>{value}</span>
        </div>
      )}
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: ACCENT, cursor: 'pointer' }}
      />
    </div>
  );
}

function Checkbox({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                    color: UI_TEXT, fontSize: '0.9375rem',
                    marginBottom: 6 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
             style={{ accentColor: ACCENT, width: 14, height: 14, cursor: 'pointer' }} />
      {label}
    </label>
  );
}

function Divider() {
  return <hr style={{ border: 'none', borderTop: `1px solid #2a2a5a`, margin: '14px 0' }} />;
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: '0.75rem', color: UI_TEXT,
                  fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, marginTop: 6, ...style }}>
      {children}
    </div>
  );
}

function ResultCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: BG_CARD, border: '1px solid #1e1e3a', borderRadius: 7,
                  padding: '7px 10px', marginTop: 4, fontSize: '0.75rem',
                  fontFamily: 'JetBrains Mono, monospace' }}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tutorial file selector
// ---------------------------------------------------------------------------

function TutorialSelect({ options, value, onChange }: {
  options: { fname: string; label: string }[];
  value: string | null;
  onChange: (fname: string) => void;
}) {
  const curLabel = options.find(o => o.fname === value)?.label ?? '— Select tutorial —';
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', background: '#0d0d20', color: UI_TEXT,
        border: '1px solid #2a2a5a', borderRadius: 6, padding: '6px 8px',
        fontSize: '0.875rem', cursor: 'pointer',
      }}
    >
      <option value="">— Select tutorial —</option>
      {options.filter(o => o.fname).map(o => (
        <option key={o.fname} value={o.fname}>{o.label}</option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Main Sidebar component
// ---------------------------------------------------------------------------

export default function Sidebar({
  tutorialOptions,
  onFileSelect,
  onCogClick,
}: {
  tutorialOptions: { fname: string; label: string }[];
  onFileSelect: (fname: string) => void;
  onCogClick: () => void;
}) {
  const {
    coeffA, coeffB, coeffC, depth,
    showSigns, showVectors, highlightHome,
    mode, tutOverride, tutorialFile,
    eqA2, eqB2, eqC2,
    setCoeffA, setCoeffB, setCoeffC, setDepth,
    setShowSigns, setShowVectors, setHighlightHome,
    setMode, setStepSelected,
    setEqA2, setEqB2, setEqC2,
    patchTutOverride,
  } = useStore();

  const { a, b, c, dep, ssg, sv, md, hlHome } = useDisplayValues();
  const ov = tutOverride;

  function onA(v: number) {
    setStepSelected(null);
    if (ov) patchTutOverride({ a: Math.round(v) }); else setCoeffA(v);
  }
  function onB(v: number) {
    setStepSelected(null);
    if (ov) patchTutOverride({ b: Math.round(v) }); else setCoeffB(v);
  }
  function onC(v: number) {
    setStepSelected(null);
    if (ov) patchTutOverride({ c: Math.round(v) }); else setCoeffC(v);
  }
  function onDepth(v: number) {
    if (ov) patchTutOverride({ depth: Math.round(v) }); else setDepth(v);
  }
  function onSigns(v: boolean) {
    if (ov) patchTutOverride({ show_signs: v }); else setShowSigns(v);
  }
  function onVectors(v: boolean) {
    if (ov) patchTutOverride({ show_vectors: v }); else setShowVectors(v);
  }
  function onHighlightHome(v: boolean) {
    if (ov) patchTutOverride({ highlight_home: v }); else setHighlightHome(v);
  }

  const disc    = discriminant(a, b, c);
  const cls     = classify(a, b, c);
  const dCol    = disc < 0 ? GREEN : disc > 0 ? ORANGE : TEXT_DIM;
  const clsName = cls.replace(/_/g, '-');

  const v10 = Qeval(a, b, c, 1, 0);
  const v01 = Qeval(a, b, c, 0, 1);
  const v11 = Qeval(a, b, c, 1, 1);

  // Equivalence
  const eqResult = md === 'equiv'
    ? areEquivalent(Math.round(a), Math.round(b), Math.round(c), eqA2, eqB2, eqC2)
    : null;

  // Cog button SVG
  const cogSvg = (
    <button
      onClick={onCogClick}
      style={{
        width: 34, height: 34, flexShrink: 0, borderRadius: 7,
        border: '1px solid #2a2a5a', background: '#1a1a3a', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
      }}
      title="Animation controls"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={ACCENT}>
        <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
      </svg>
    </button>
  );

  return (
    <div
      className="sidebar"
      style={{
        minWidth: 320, maxWidth: 320, width: 320,
        background: '#06060f', height: '100vh', overflowY: 'auto',
        padding: '16px 14px', boxSizing: 'border-box',
        borderRight: '1px solid #1a1a3a', flexShrink: 0,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.5rem', fontWeight: 600,
                        color: ACCENT, letterSpacing: 2, marginBottom: 2 }}>TOPOGRAPH</div>
          <div style={{ fontSize: '0.875rem', color: UI_TEXT,
                        letterSpacing: 1 }}>Binary Quadratic Form Explorer</div>
        </div>
        {cogSvg}
      </div>

      <Divider />
      <SectionLabel>Tutorials</SectionLabel>
      <TutorialSelect options={tutorialOptions} value={tutorialFile} onChange={onFileSelect} />

      <Divider />
      <SectionLabel>Depth</SectionLabel>
      <SliderInt label="" value={dep} min={1} max={7} onChange={onDepth} />

      <Divider />
      <SectionLabel>Form Q(x,y) = ax² + bxy + cy²</SectionLabel>
      <SliderInt label="A" value={a} min={-9} max={9} onChange={onA} />
      <SliderInt label="B" value={b} min={-9} max={9} onChange={onB} />
      <SliderInt label="C" value={c} min={-9} max={9} onChange={onC} />

      <Divider />
      <Checkbox label="Sign map (+ green / − red)" checked={ssg} onChange={onSigns} />
      <Checkbox label="Show vectors (p,q)" checked={sv} onChange={onVectors} />
      <Checkbox label="Highlight home triad" checked={hlHome} onChange={onHighlightHome} />

      <Divider />

      {/* Discriminant card */}
      <ResultCard>
        <span style={{ color: TEXT_DIM }}>D = b²−4ac = </span>
        <span style={{ color: dCol, fontSize: '0.8125rem', fontWeight: 600 }}>{Math.round(disc)}</span>
        <span style={{ color: TEXT_DIM }}> ({clsName})</span>
      </ResultCard>

      {/* Home triad */}
      <ResultCard>
        <span style={{ color: TEXT_DIM }}>Home triad:&nbsp;</span>
        <span style={{ color: ACCENT, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
          Q(1,0)={fmtVal(v10)}&nbsp; Q(0,1)={fmtVal(v01)}&nbsp; Q(1,1)={fmtVal(v11)}
        </span>
      </ResultCard>

      {/* Reduced form */}
      {cls.includes('definite') && cls !== 'degenerate' && (() => {
        try {
          const [ra, rb, rc] = reduceForm(Math.round(a), Math.round(b), Math.round(c));
          const isReduced = ra === Math.round(a) && rb === Math.round(b) && rc === Math.round(c);
          const redStr = `${ra}x² + ${rb}xy + ${rc}y²`;
          return (
            <ResultCard>
              <span style={{ color: TEXT_DIM }}>Reduced form: </span>
              <span style={{ color: LIME, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>{redStr}</span>
              {isReduced && <span style={{ color: '#8899cc', fontSize: '0.625rem' }}> (already reduced)</span>}
            </ResultCard>
          );
        } catch { return null; }
      })()}

      {/* Equivalence controls */}
      {md === 'equiv' && (
        <>
          <Divider />
          <SectionLabel>Form 2 (Equivalence)</SectionLabel>
          <SliderInt label="a₂" value={eqA2} min={-9} max={9} onChange={v => setEqA2(v)} />
          <SliderInt label="b₂" value={eqB2} min={-9} max={9} onChange={v => setEqB2(v)} />
          <SliderInt label="c₂" value={eqC2} min={-9} max={9} onChange={v => setEqC2(v)} />
          {eqResult && (
            <ResultCard>
              <span style={{ color: eqResult.ok ? GREEN : RED_COL, fontWeight: 600, fontSize: '0.8125rem' }}>
                {eqResult.ok ? 'EQUIVALENT' : 'NOT equivalent'}
              </span>
              <br />
              <span style={{ color: TEXT_DIM }}>{eqResult.reason}</span>
            </ResultCard>
          )}
        </>
      )}
    </div>
  );
}

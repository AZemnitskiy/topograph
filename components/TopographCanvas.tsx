'use client';

import React, { useEffect, useCallback } from 'react';
import { useStore, useDisplayValues } from '../store/state';
import { drawTopographSvg, fmtVal } from '../lib/topograph-render';
import { areEquivalent } from '../lib/topograph-math';
import {
  ACCENT, ACCENT2, TEXT, TEXT_DIM, BG_DEEP, BG_CARD, GREEN, RED_COL,
} from '../lib/topograph-render';

const MODE_OPTS: [string, string][] = [
  ['default', 'Topograph'],
  ['equiv',   'Equivalence'],
];

const DEFAULT_SUBTABS: [string, string][] = [
  ['default', 'Plain'],
  ['river',   'River trace'],
  ['pell',    'Pell solutions'],
];

const LAYOUT_BTNS: [string, string, string][] = [
  ['default',  '⊕', 'Tree layout'],
  ['circular', '◉', 'Radial layout'],
  ['poincare', '◎', 'Poincaré disc'],
];

function polyTerm(coeff: number, varStr: string, first: boolean): string {
  if (coeff === 0) return '';
  const sign  = coeff > 0 ? (first ? '' : '+ ') : (first ? '−' : '− ');
  const num   = Math.abs(coeff) === 1 ? '' : String(Math.abs(coeff));
  return sign + num + varStr;
}

function formatForm(a: number, b: number, c: number): string {
  const terms: string[] = [];
  for (const [coeff, v] of [[a, 'x²'], [b, 'xy'], [c, 'y²']] as [number, string][]) {
    const t = polyTerm(coeff, v, terms.length === 0);
    if (t) terms.push(t);
  }
  return 'Q(x,y) = ' + (terms.join(' ') || '0');
}

export default function TopographCanvas() {
  const {
    mode, setMode, layoutMode, setLayoutMode,
    stepSelected, setStepSelected, topoFullscreen, setTopoFullscreen,
    animParticles, animPulses, showNodeLabels,
    eqA2, eqB2, eqC2,
    tutOverride,
  } = useStore();

  const { a, b, c, dep, ssg, sv, md, hlHome } = useDisplayValues();

  const circular = layoutMode === 'circular';
  const poincare = layoutMode === 'poincare';
  const mainTab  = (md === 'river' || md === 'pell') ? 'default' : md;

  function onMode(v: string) {
    setStepSelected(null);
    if (tutOverride) useStore.getState().patchTutOverride({ mode: v as any });
    else setMode(v as any);
  }

  // Cell click — delegate from SVG data-key attribute
  const handleSvgClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    let el = e.target as HTMLElement | null;
    while (el && el.tagName?.toLowerCase() !== 'svg') {
      const key = el.getAttribute?.('data-key');
      if (key) {
        const [p, q] = key.split(',').map(Number);
        setStepSelected([p, q]);
        return;
      }
      el = el.parentElement;
    }
    setStepSelected(null);
  }, [setStepSelected]);

  // Render SVG(s)
  let svgContent: React.ReactNode = null;
  let svgStr: string | null = null;
  const ar = poincare ? '1 / 1' : '660 / 600';

  const commonParams = {
    a, b, c, depth: dep,
    showSigns: ssg, showVectors: sv,
    stepSel: stepSelected,
    highlightHome: hlHome,
    particles: animParticles, pulses: animPulses,
    showNodeLabels,
    circular, poincare,
  };

  if (md === 'equiv') {
    const svg1 = drawTopographSvg({ ...commonParams, mode: md, stepSel: null, particles: animParticles, pulses: false, W: 380, H: 400 });
    const svg2 = drawTopographSvg({ ...commonParams, a: eqA2, b: eqB2, c: eqC2, mode: 'default', highlightHome: false, stepSel: null, particles: animParticles, pulses: false, W: 380, H: 400 });
    const { ok, reason } = areEquivalent(Math.round(a), Math.round(b), Math.round(c), eqA2, eqB2, eqC2);
    const eqCol = ok ? GREEN : RED_COL;
    const eqWord = ok ? 'EQUIVALENT ✓' : 'NOT EQUIVALENT ✗';

    function fmtFormStr(fa: number, fb: number, fc: number) {
      const terms: string[] = [];
      for (const [coeff, v] of [[fa, 'x²'], [fb, 'xy'], [fc, 'y²']] as [number, string][]) {
        if (coeff === 0) continue;
        const av = Math.abs(coeff);
        const vstr = av === 1 ? v : `${av}${v}`;
        terms.length === 0 ? terms.push(coeff < 0 ? `−${vstr}` : vstr)
                           : terms.push(coeff < 0 ? ` − ${vstr}` : ` + ${vstr}`);
      }
      return terms.join('') || '0';
    }

    svgContent = (
      <>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 600, color: ACCENT, marginBottom: 8, textAlign: 'center' }}>
              Q₁(x, y) = {fmtFormStr(a, b, c)}
            </div>
            <div dangerouslySetInnerHTML={{ __html: svg1 }} onClick={handleSvgClick} style={{ cursor: 'crosshair' }} />
          </div>
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 600, color: ACCENT2, marginBottom: 8, textAlign: 'center' }}>
              Q₂(x, y) = {fmtFormStr(eqA2, eqB2, eqC2)}
            </div>
            <div dangerouslySetInnerHTML={{ __html: svg2 }} />
          </div>
        </div>
        <div style={{ marginTop: 12, padding: '10px 16px', background: BG_CARD,
                      borderRadius: 8, border: '1px solid #1e1e3a',
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: eqCol }}>
          {eqWord} — {reason}
        </div>
      </>
    );
  } else {
    svgStr = drawTopographSvg({ ...commonParams, mode: md });
    svgContent = (
      <div
        dangerouslySetInnerHTML={{ __html: svgStr }}
        onClick={handleSvgClick}
        style={{ cursor: 'crosshair', aspectRatio: ar, width: '100%', height: '100%' }}
      />
    );
  }

  const btnStyleActive = {
    background: ACCENT, color: '#0d0d1a', fontFamily: 'JetBrains Mono, monospace',
    fontSize: 11, fontWeight: 700, letterSpacing: 1, border: `1px solid ${ACCENT}`,
    borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
  } as React.CSSProperties;
  const btnStyleIdle = {
    background: BG_CARD, color: TEXT_DIM, fontFamily: 'JetBrains Mono, monospace',
    fontSize: 11, fontWeight: 600, letterSpacing: 1, border: '1px solid #2a2a5a',
    borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
  } as React.CSSProperties;
  const btnSubActive = {
    background: 'transparent', color: ACCENT, fontFamily: 'JetBrains Mono, monospace',
    fontSize: 11, fontWeight: 700, border: 'none', borderBottom: `2px solid ${ACCENT}`,
    borderRadius: 0, padding: '4px 16px', cursor: 'pointer',
  } as React.CSSProperties;
  const btnSubIdle = {
    background: 'transparent', color: TEXT_DIM, fontFamily: 'JetBrains Mono, monospace',
    fontSize: 11, fontWeight: 600, border: 'none', borderBottom: '2px solid transparent',
    borderRadius: 0, padding: '4px 16px', cursor: 'pointer',
  } as React.CSSProperties;

  const formEq = formatForm(Math.round(a), Math.round(b), Math.round(c));

  return (
    <div style={{ flex: 1, padding: 24, minWidth: 0, overflow: 'hidden',
                  height: '100vh', position: 'sticky', top: 0, background: BG_DEEP,
                  display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      {/* Mode toggle row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 4, justifyContent: 'center' }}>
        {MODE_OPTS.map(([mval, mlbl]) => (
          <button key={mval} onClick={() => onMode(mval)}
                  style={mainTab === mval ? btnStyleActive : btnStyleIdle}>
            {mlbl}
          </button>
        ))}
      </div>

      {/* Sub-tabs */}
      {mainTab === 'default' ? (
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, justifyContent: 'center',
                      borderBottom: '1px solid #2a2a5a' }}>
          {DEFAULT_SUBTABS.map(([sval, slbl]) => (
            <button key={sval} onClick={() => onMode(sval)}
                    style={md === sval ? btnSubActive : btnSubIdle}>
              {slbl}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ marginBottom: 16 }} />
      )}

      {/* Equation title row */}
      {md !== 'equiv' && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16,
                          fontWeight: 'bold', color: ACCENT }}>
            {formEq}
          </span>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
            {LAYOUT_BTNS.map(([lval, lbl, hint]) => (
              <button key={lval} title={hint}
                      onClick={() => setLayoutMode(lval as any)}
                      style={{ minWidth: 32, height: 32, padding: '0 6px', fontSize: 15,
                               background: BG_CARD, cursor: 'pointer', border: 'none', borderRadius: 4,
                               color: layoutMode === lval ? ACCENT : TEXT_DIM }}>
                {lbl}
              </button>
            ))}
            <button title={topoFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    onClick={() => setTopoFullscreen(!topoFullscreen)}
                    style={{ minWidth: 32, height: 32, padding: '0 6px', fontSize: 15,
                             background: BG_CARD, cursor: 'pointer', border: 'none', borderRadius: 4,
                             color: topoFullscreen ? ACCENT : TEXT_DIM }}>
              {topoFullscreen ? '✕' : '⛶'}
            </button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="topo-svg-wrap" style={{ flex: 1, minHeight: 0, display: 'flex',
                                               alignItems: 'center', justifyContent: 'center',
                                               overflow: 'hidden' }}>
        {svgContent}
      </div>

      {/* Fullscreen overlay */}
      {topoFullscreen && svgStr && (
        <div style={{ position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh',
                      zIndex: 9999, background: BG_DEEP, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <div style={{ maxWidth: '100vw', maxHeight: '100vh', aspectRatio: ar, width: '100vw' }}
               dangerouslySetInnerHTML={{ __html: svgStr }}
               onClick={handleSvgClick} />
          <button onClick={() => setTopoFullscreen(false)}
                  style={{ position: 'fixed', top: 12, right: 16, zIndex: 10000,
                           minWidth: 36, height: 36, padding: '0 8px', fontSize: 15,
                           background: BG_CARD, color: ACCENT, border: 'none',
                           borderRadius: 6, cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

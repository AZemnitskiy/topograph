'use client';

import React, { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useStore } from '../store/state';
import {
  ACCENT, TEXT, TEXT_DIM, BG_CARD, GREEN, RED_COL, UI_TEXT,
} from '../lib/topograph-render';

// ---------------------------------------------------------------------------
// Markdown renderer
// ---------------------------------------------------------------------------

function TutText({ text }: { text: string }) {
  // Add hard line-breaks (two spaces before \n in non-list paragraphs)
  function mdHardBreaks(t: string): string {
    const paras = t.split('\n\n');
    return paras.map(para => {
      const lines = para.split('\n');
      if (lines.length <= 1) return para;
      const isList = lines.some(l => /^\s*[-*+]/.test(l) || /^\s*\d+\./.test(l));
      return isList ? para : lines.join('  \n');
    }).join('\n\n');
  }

  return (
    <div className="tut-view-text" style={{
      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem', lineHeight: 1.75,
      color: '#c0c8e8',
    }}>
      <ReactMarkdown>{mdHardBreaks(text)}</ReactMarkdown>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Tutorial Panel
// ---------------------------------------------------------------------------

export default function TutorialPanel({
  tutorialNames,
}: {
  tutorialNames: string[];
}) {
  const [panelWidth, setPanelWidth] = useState(420);
  const dragState = useRef<{ startX: number; startW: number } | null>(null);

  function onResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startW: panelWidth };

    function onMove(ev: MouseEvent) {
      if (!dragState.current) return;
      const delta = dragState.current.startX - ev.clientX;
      setPanelWidth(Math.max(280, Math.min(700, dragState.current.startW + delta)));
    }
    function onUp() {
      dragState.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const {
    tutorialData, tutorialIdx, tutorialFile,
    quizMode, quizAnswer, readingMode,
    setQuizMode, setQuizAnswer, setReadingMode,
    setTutorialIdx, applyView,
    tutOverride,
  } = useStore();

  if (!tutorialData) return null;

  const views   = tutorialData.views ?? [];
  const nViews  = views.length;
  const tidx    = Math.min(tutorialIdx, nViews - 1);
  const view    = views[tidx] ?? {};
  const tfile   = tutorialFile;
  const qm      = quizMode;

  function loadTutorial(fname: string, startAtEnd = false) {
    useStore.getState().setTutorialFile(fname);
    useStore.getState().setQuizAnswer(null);
    useStore.getState().setQuizMode(false);
    // The actual JSON loading happens in the parent page component via effect
    // Here we just trigger a file change which the page listens to
    window.dispatchEvent(new CustomEvent('tut-load', { detail: { fname, startAtEnd } }));
  }

  function goPrev() {
    if (qm) {
      setQuizMode(false);
    } else if (tidx > 0) {
      const newIdx = tidx - 1;
      const prev = views[newIdx];
      setQuizAnswer(null);
      setQuizMode(Boolean(prev.quiz || prev.activity));
      setTutorialIdx(newIdx);
      applyView(views[newIdx]);
    } else {
      const cur = tutorialNames.indexOf(tfile ?? '');
      if (cur > 0) loadTutorial(tutorialNames[cur - 1], true);
    }
  }

  function goNext() {
    if (!qm && (view.quiz || view.activity)) {
      setQuizMode(true);
    } else if (tidx < nViews - 1) {
      setQuizMode(false);
      setQuizAnswer(null);
      const newIdx = tidx + 1;
      setTutorialIdx(newIdx);
      applyView(views[newIdx]);
    } else {
      const cur = tutorialNames.indexOf(tfile ?? '');
      if (cur >= 0 && cur < tutorialNames.length - 1)
        loadTutorial(tutorialNames[cur + 1]);
    }
  }

  const isFirstTut = !tfile || tutorialNames.indexOf(tfile) === 0;
  const isLastTut  = !tfile || tutorialNames.indexOf(tfile) === tutorialNames.length - 1;
  const prevDisabled = tidx === 0 && !qm && isFirstTut;
  const nextDisabled = isLastTut && tidx === nViews - 1 && !qm;
  const tutNum = tfile ? tutorialNames.indexOf(tfile) + 1 : '';
  const counter = `${tidx + 1} / ${nViews} · ${qm ? 'practice' : 'theory'}`;

  const LETTERS = 'ABCD';
  const quiz      = view.quiz;
  const qAns      = quizAnswer;
  const qCorr     = quiz?.correct ?? 0;
  const qExpl     = quiz?.explanation ?? '';
  const answered  = qAns !== null;

  const boxStyle: React.CSSProperties = {
    background: '#111128', border: '1px solid #1e1e3a',
    borderRadius: 8, padding: '14px 16px',
  };

  const panelStyle: React.CSSProperties = readingMode
    ? { position: 'fixed', zIndex: 9999, top: 0, left: 0, width: '100vw', height: '100vh',
        background: '#06060f', padding: '24px 32px', boxSizing: 'border-box', overflowY: 'auto' }
    : { position: 'relative', minWidth: 280, width: panelWidth, height: '100vh', background: '#06060f',
        borderLeft: '1px solid #1a1a3a', overflowY: 'auto', padding: '16px 16px',
        boxSizing: 'border-box', flexShrink: 0 };

  return (
    <div className="tutorial-panel" style={panelStyle}>
      {/* Drag-to-resize handle on left edge */}
      {!readingMode && (
        <div
          onMouseDown={onResizeStart}
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 5,
            cursor: 'col-resize', zIndex: 10, background: 'transparent',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#3a3a7a'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        />
      )}
      {/* Tutorial title */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.125rem',
                      color: ACCENT, letterSpacing: 1, marginBottom: 2 }}>
          {tutNum ? `${tutNum}. ` : ''}{tutorialData.title}
        </div>
        {tutorialData.book && (
          <div style={{ fontSize: '0.875rem', color: UI_TEXT }}>
            {tutorialData.book}
          </div>
        )}
      </div>
      {/* Nav row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: '0.6875rem', color: UI_TEXT, flex: 1 }}>
          {counter}
        </div>
        <button onClick={goPrev} disabled={prevDisabled} title="Previous"
                style={{ minWidth: 36, height: 36, padding: '0 8px', fontSize: '1rem',
                         background: BG_CARD, border: 'none', borderRadius: 6, cursor: 'pointer',
                         color: prevDisabled ? TEXT_DIM : UI_TEXT }}>◀</button>
        <button onClick={goNext} disabled={nextDisabled} title="Next"
                style={{ minWidth: 36, height: 36, padding: '0 8px', fontSize: '1rem',
                         background: BG_CARD, border: 'none', borderRadius: 6, cursor: 'pointer',
                         color: nextDisabled ? TEXT_DIM : UI_TEXT }}>▶</button>
        <button onClick={() => setReadingMode(!readingMode)}
                title={readingMode ? 'Exit focus' : 'Focus mode'}
                style={{ minWidth: 36, height: 36, padding: '0 8px', fontSize: '0.9375rem',
                         background: BG_CARD, border: 'none', borderRadius: 6, cursor: 'pointer',
                         color: readingMode ? ACCENT : UI_TEXT }}>
          {readingMode ? '✕' : '⛶'}
        </button>
      </div>

      <hr style={{ borderColor: '#2a2a5a', margin: '10px 0' }} />

      {/* View title */}
      {view.title && (
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.1875rem',
                      color: '#ffffff', marginBottom: 10, paddingBottom: 10,
                      borderBottom: '1px solid #2a2a5a' }}>
          {view.title}
        </div>
      )}

      {/* Content */}
      {qm ? (
        /* Practice / Quiz slide */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {view.activity && (
            <div style={boxStyle}>
              <div style={{ fontSize: '0.8125rem',
                            letterSpacing: 1.5, color: ACCENT,
                            textTransform: 'uppercase', marginBottom: 8 }}>
                ▸ Activity
              </div>
              <TutText text={view.activity} />
            </div>
          )}
          {quiz && (
            <div style={boxStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.8125rem',
                               letterSpacing: 1.5, color: '#7986cb',
                               textTransform: 'uppercase' }}>▸ Quiz</span>
                {answered && (
                  <span style={{ fontSize: 16,
                                 color: qAns === qCorr ? GREEN : RED_COL }}>
                    {qAns === qCorr ? '✓' : '✗'}
                  </span>
                )}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.844rem',
                            color: '#c0c8e8', lineHeight: 1.7, marginBottom: 10 }}>
                {quiz.question}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.844rem',
                            color: '#c0c8e8', lineHeight: 1.8, marginBottom: 20 }}>
                {quiz.options.map((opt, i) => (
                  <div key={i} style={{ margin: '3px 0' }}>
                    <span style={{ color: '#7986cb' }}>{LETTERS[i]})</span> {opt}
                  </div>
                ))}
              </div>
              {answered && qExpl && (
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.844rem',
                              color: qAns === qCorr ? GREEN : '#ef9a9a',
                              marginTop: 10, marginBottom: 20, lineHeight: 1.6 }}>
                  {qExpl}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                {quiz.options.map((opt, qi) => {
                  let bg: string, col: string, bdr: string;
                  if (!answered) { bg = BG_CARD; col = TEXT; bdr = '#2a2a5a'; }
                  else if (qi === qCorr) { bg = '#0d2a1a'; col = GREEN; bdr = '#00c853'; }
                  else if (qi === qAns)  { bg = '#2a0d0d'; col = '#ef9a9a'; bdr = '#c62828'; }
                  else { bg = '#0d0d1a'; col = '#3a3a5a'; bdr = '#1a1a3a'; }
                  return (
                    <button key={qi} disabled={answered}
                            onClick={() => setQuizAnswer(qi)}
                            style={{ background: bg, color: col, border: `1px solid ${bdr}`,
                                     fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem',
                                     padding: '6px 14px', minWidth: 40,
                                     cursor: answered ? 'default' : 'pointer', borderRadius: 4 }}>
                      {LETTERS[qi]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Theory text */
        <div style={{ background: '#111128', border: '1px solid #1e1e3a',
                      borderRadius: 8, padding: 16, overflowY: 'auto' }}>
          {view.text && <TutText text={view.text} />}
        </div>
      )}
    </div>
  );
}

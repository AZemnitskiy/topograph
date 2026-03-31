'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/state';
import Sidebar from '../components/Sidebar';
import TopographCanvas from '../components/TopographCanvas';
import TutorialPanel from '../components/TutorialPanel';
import { BG_DEEP, BG_CARD, ACCENT, TEXT, TEXT_DIM, UI_TEXT } from '../lib/topograph-render';

// ---------------------------------------------------------------------------
// Tutorial file manifest — must match public/tutorials/
// ---------------------------------------------------------------------------

const TUTORIAL_FILES = [
  '01_home_triad.json',
  '02_arithmetic_progression.json',
  '03_sign_map_river.json',
  '04_discriminant.json',
  '05_definite_forms.json',
  '06_indefinite_pell.json',
  '07_equivalence.json',
  '08_poincare_disc.json',
];

// ---------------------------------------------------------------------------
// AnimationDialog
// ---------------------------------------------------------------------------

function AnimationDialog({ onClose }: { onClose: () => void }) {
  const {
    animParticles, animPulses, showNodeLabels,
    setAnimParticles, setAnimPulses, setShowNodeLabels,
  } = useStore();

  return (
    <div className="anim-dialog-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="anim-dialog">
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1rem',
                      fontWeight: 600, color: ACCENT, marginBottom: 16 }}>
          Animation Controls
        </div>
        <div style={{ fontSize: '0.6875rem', color: UI_TEXT, marginBottom: 14, lineHeight: 1.6 }}>
          Toggle individual animation layers in the topograph.
        </div>
        {[
          ['Particle streams', animParticles, setAnimParticles, 'Glowing dots flowing along tree arrows'],
          ['Node pulse rings', animPulses, setAnimPulses, 'Expanding glow rings on selected node'],
          ['Junction node indices', showNodeLabels, setShowNodeLabels, 'Ordinal labels at each junction vertex'],
        ].map(([label, value, setter, hint]) => (
          <div key={label as string} style={{ marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                            color: UI_TEXT, fontSize: '0.8125rem' }}>
              <input type="checkbox" checked={value as boolean}
                     onChange={e => (setter as (v: boolean) => void)(e.target.checked)}
                     style={{ accentColor: ACCENT, width: 14, height: 14 }} />
              {label as string}
            </label>
            <div style={{ fontSize: '0.625rem', color: UI_TEXT, marginLeft: 22, marginTop: 2 }}>
              {hint as string}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose}
                  style={{ background: ACCENT, color: '#0d0d1a', border: 'none',
                           borderRadius: 6, padding: '6px 18px', cursor: 'pointer',
                           fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.75rem' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Page() {
  const {
    tutorialData, tutorialFile, tutorialIdx,
    setTutorialData, setTutorialFile, setTutorialIdx,
    setQuizAnswer, setQuizMode, applyView,
    showAnimDialog, setShowAnimDialog,
  } = useStore();

  const [tutOptions, setTutOptions] = useState<{ fname: string; label: string }[]>([]);
  const didAutoLoad = useRef(false);

  // Fetch tutorial metadata for the dropdown
  useEffect(() => {
    Promise.all(
      TUTORIAL_FILES.map(async fname => {
        try {
          const res = await fetch(`/tutorials/${fname}`);
          const data = await res.json();
          return { fname, label: data.title ?? fname };
        } catch {
          return { fname, label: fname };
        }
      })
    ).then(opts => {
      setTutOptions(opts.map((o, i) => ({ fname: o.fname, label: `${i + 1}. ${o.label}` })));
    });
  }, []);

  // Load a tutorial JSON file
  async function loadTutorial(fname: string, startAtEnd = false) {
    try {
      const res = await fetch(`/tutorials/${fname}`);
      const data = await res.json();
      const views = data.views ?? [];
      const idx = startAtEnd && views.length ? views.length - 1 : 0;
      setTutorialData(data);
      setTutorialIdx(idx);
      setTutorialFile(fname);
      setQuizAnswer(null);
      setQuizMode(false);
      if (views.length > 0) applyView(views[idx]);
    } catch (e) {
      console.error('Failed to load tutorial', fname, e);
    }
  }

  // Auto-load first tutorial
  useEffect(() => {
    if (!didAutoLoad.current && TUTORIAL_FILES.length > 0) {
      didAutoLoad.current = true;
      loadTutorial(TUTORIAL_FILES[0]);
    }
  }, []);

  // Listen for tut-load events dispatched by TutorialPanel navigation
  useEffect(() => {
    function onTutLoad(e: Event) {
      const { fname, startAtEnd } = (e as CustomEvent).detail;
      loadTutorial(fname, startAtEnd);
    }
    window.addEventListener('tut-load', onTutLoad);
    return () => window.removeEventListener('tut-load', onTutLoad);
  }, []);

  function onFileSelect(fname: string) {
    if (fname) loadTutorial(fname);
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'row',
      background: BG_DEEP, minHeight: '100vh',
      alignItems: 'flex-start', gap: 0, margin: 0, padding: 0,
    }}>
      <Sidebar
        tutorialOptions={tutOptions}
        onFileSelect={onFileSelect}
        onCogClick={() => setShowAnimDialog(true)}
      />
      <TopographCanvas />
      {tutorialData && <TutorialPanel tutorialNames={TUTORIAL_FILES} />}
      {showAnimDialog && <AnimationDialog onClose={() => setShowAnimDialog(false)} />}
    </div>
  );
}

'use client';
/**
 * store/state.ts
 * Global Zustand store — mirrors all solara.reactive globals from app.py.
 *
 * The tut_override pattern is preserved: when tutorial navigation calls
 * applyView(), all affected fields are updated in a single set() call
 * (atomic w.r.t. React render cycle).
 */

import { create } from 'zustand';

export type Mode       = 'default' | 'step' | 'river' | 'pell' | 'equiv';
export type LayoutMode = 'default' | 'circular' | 'poincare';

export interface TutorialView {
  title?: string;
  text?: string;
  activity?: string;
  form?: { a?: number; b?: number; c?: number };
  state?: {
    depth?: number;
    show_signs?: boolean;
    show_vectors?: boolean;
    highlight_home?: boolean;
    mode?: string;
  };
  quiz?: {
    question: string;
    options: string[];
    correct: number;
    explanation?: string;
  };
}

export interface TutorialData {
  title: string;
  book?: string;
  views: TutorialView[];
}

/** The tut_override bundle — when set, these values shadow user sliders. */
export interface TutOverride {
  a: number; b: number; c: number;
  depth: number;
  show_signs: boolean;
  show_vectors: boolean;
  highlight_home: boolean;
  mode: Mode;
}

export interface AppState {
  // Form coefficients
  coeffA: number;
  coeffB: number;
  coeffC: number;

  // Visualisation controls
  depth: number;
  showSigns: boolean;
  showVectors: boolean;
  mode: Mode;
  layoutMode: LayoutMode;

  // Step mode
  stepSelected: [number, number] | null;
  highlightHome: boolean;

  // Equivalence explorer
  eqA2: number;
  eqB2: number;
  eqC2: number;

  // Tutorial state
  tutorialData: TutorialData | null;
  tutorialIdx: number;
  tutorialFile: string | null;
  tutOverride: TutOverride | null;
  quizAnswer: number | null;
  quizMode: boolean;
  readingMode: boolean;

  // Animation controls
  animParticles: boolean;
  animPulses: boolean;
  showAnimDialog: boolean;
  showNodeLabels: boolean;
  topoFullscreen: boolean;

  // Actions
  setCoeffA: (v: number) => void;
  setCoeffB: (v: number) => void;
  setCoeffC: (v: number) => void;
  setDepth: (v: number) => void;
  setShowSigns: (v: boolean) => void;
  setShowVectors: (v: boolean) => void;
  setMode: (v: Mode) => void;
  setLayoutMode: (v: LayoutMode) => void;
  setStepSelected: (v: [number, number] | null) => void;
  setHighlightHome: (v: boolean) => void;
  setEqA2: (v: number) => void;
  setEqB2: (v: number) => void;
  setEqC2: (v: number) => void;
  setTutorialData: (v: TutorialData | null) => void;
  setTutorialIdx: (v: number) => void;
  setTutorialFile: (v: string | null) => void;
  /** Atomically apply a tut_override bundle (mirrors the Python atomic dict pattern). */
  setTutOverride: (v: TutOverride | null) => void;
  /** Update a single field inside an existing tut_override (e.g. when user adjusts slider during tutorial). */
  patchTutOverride: (patch: Partial<TutOverride>) => void;
  setQuizAnswer: (v: number | null) => void;
  setQuizMode: (v: boolean) => void;
  setReadingMode: (v: boolean) => void;
  setAnimParticles: (v: boolean) => void;
  setAnimPulses: (v: boolean) => void;
  setShowAnimDialog: (v: boolean) => void;
  setShowNodeLabels: (v: boolean) => void;
  setTopoFullscreen: (v: boolean) => void;

  /** Apply a tutorial view atomically (mirrors apply_view() in app.py). */
  applyView: (view: TutorialView) => void;
}

export const useStore = create<AppState>((set, get) => ({
  coeffA: 1, coeffB: 0, coeffC: 1,
  depth: 3,
  showSigns: false, showVectors: true,
  mode: 'default', layoutMode: 'default',
  stepSelected: null, highlightHome: false,
  eqA2: 2, eqB2: 2, eqC2: 3,
  tutorialData: null, tutorialIdx: 0, tutorialFile: null,
  tutOverride: null, quizAnswer: null, quizMode: false, readingMode: false,
  animParticles: true, animPulses: true,
  showAnimDialog: false, showNodeLabels: false, topoFullscreen: false,

  setCoeffA:        v => set({ coeffA: Math.round(v) }),
  setCoeffB:        v => set({ coeffB: Math.round(v) }),
  setCoeffC:        v => set({ coeffC: Math.round(v) }),
  setDepth:         v => set({ depth: Math.round(v) }),
  setShowSigns:     v => set({ showSigns: v }),
  setShowVectors:   v => set({ showVectors: v }),
  setMode:          v => set({ mode: v }),
  setLayoutMode:    v => set({ layoutMode: v }),
  setStepSelected:  v => set({ stepSelected: v }),
  setHighlightHome: v => set({ highlightHome: v }),
  setEqA2:          v => set({ eqA2: Math.round(v) }),
  setEqB2:          v => set({ eqB2: Math.round(v) }),
  setEqC2:          v => set({ eqC2: Math.round(v) }),
  setTutorialData:  v => set({ tutorialData: v }),
  setTutorialIdx:   v => set({ tutorialIdx: v }),
  setTutorialFile:  v => set({ tutorialFile: v }),
  setTutOverride:   v => set({ tutOverride: v }),
  patchTutOverride: patch => {
    const cur = get().tutOverride;
    if (cur) set({ tutOverride: { ...cur, ...patch } });
  },
  setQuizAnswer:    v => set({ quizAnswer: v }),
  setQuizMode:      v => set({ quizMode: v }),
  setReadingMode:   v => set({ readingMode: v }),
  setAnimParticles: v => set({ animParticles: v }),
  setAnimPulses:    v => set({ animPulses: v }),
  setShowAnimDialog:v => set({ showAnimDialog: v }),
  setShowNodeLabels:v => set({ showNodeLabels: v }),
  setTopoFullscreen:v => set({ topoFullscreen: v }),

  applyView: (view) => {
    const { coeffA, coeffB, coeffC, depth, showSigns, showVectors, highlightHome, mode } = get();
    const f  = view.form  ?? {};
    const st = view.state ?? {};
    const rawMode = String(st.mode ?? mode);
    const safeMode = (['default', 'river', 'pell', 'equiv'] as Mode[]).includes(rawMode as Mode)
      ? (rawMode as Mode) : 'default';
    set({
      tutOverride: {
        a:             Math.round(f.a  ?? coeffA),
        b:             Math.round(f.b  ?? coeffB),
        c:             Math.round(f.c  ?? coeffC),
        depth:         Math.round(st.depth ?? depth),
        show_signs:    Boolean(st.show_signs  ?? showSigns),
        show_vectors:  Boolean(st.show_vectors ?? showVectors),
        highlight_home:Boolean(st.highlight_home ?? highlightHome),
        mode:          safeMode,
      },
    });
  },
}));

/** Derived display values: resolve tut_override or fall back to user state. */
export function useDisplayValues() {
  const {
    coeffA, coeffB, coeffC, depth, showSigns, showVectors, mode, highlightHome,
    tutOverride,
  } = useStore();

  const ov = tutOverride;
  return {
    a:             ov ? ov.a             : coeffA,
    b:             ov ? ov.b             : coeffB,
    c:             ov ? ov.c             : coeffC,
    dep:           ov ? ov.depth         : depth,
    ssg:           ov ? ov.show_signs    : showSigns,
    sv:            ov ? ov.show_vectors  : showVectors,
    md:            ov ? ov.mode          : mode,
    hlHome:        ov ? ov.highlight_home: highlightHome,
  };
}

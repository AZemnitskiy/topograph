/**
 * topograph-render.ts
 * Port of topograph_render.py — SVG layout and rendering.
 *
 * Public API:
 *   drawTopographSvg(params) -> string (SVG markup)
 */

import { buildGraph, buildTopograph, classifyFaces, normFace, edgeKey, type FVec } from './topograph-core';
import { discriminant, classify } from './topograph-math';

// ---------------------------------------------------------------------------
// Colour palette (matches the Python original exactly)
// ---------------------------------------------------------------------------

export const UI_TEXT   = '#acbbe5';   // UI label / button text
export const BG_DEEP   = '#0d0d1a';
export const BG_PANEL  = '#13132b';
export const BG_CARD   = '#1a1a3a';
export const ACCENT    = '#26c6da';
export const ACCENT2   = '#ec407a';
export const TEXT      = '#e0e0ff';
export const TEXT_DIM  = '#6b7db3';
export const GREEN     = '#69f0ae';
export const ORANGE    = '#ffa726';
export const RED_COL   = '#ef5350';
export const LIME      = '#c6ff00';
export const WHITE     = '#f0f4ff';
export const CELL_POS  = '#004b1c';
export const CELL_NEG  = '#770a16';
export const CELL_ZERO = '#37474f';
export const CELL_DEF  = '#1a1a3a';
export const CELL_HOME = '#1a3a5a';
export const RIVER_COL = '#ffd54f';
export const PELL_COL  = '#ffca28';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function esc(s: unknown): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function fmtVal(v: number): string {
  const iv = Math.round(v);
  return Math.abs(v - iv) < 0.5 ? String(iv) : v.toFixed(1);
}

function signAccent(val: number): [string, string] {
  if (Math.abs(val) < 1e-9) return [CELL_ZERO, '#64b5f6'];
  return val > 0 ? [CELL_POS, GREEN] : [CELL_NEG, ACCENT2];
}

function cellRing(val: number, showSigns: boolean, isHome: boolean, isSel: boolean, isPell = false): string {
  if (isSel) return signAccent(val)[1];
  if (isPell) return PELL_COL;
  if (showSigns) {
    if (Math.abs(val) < 1e-9) return '#64b5f6';
    return val > 0 ? '#69f0ae' : ACCENT2;
  }
  if (isHome) return ACCENT;
  return '#3a3a6a';
}

// ---------------------------------------------------------------------------
// Layout functions
// ---------------------------------------------------------------------------

interface LayoutResult {
  nodes: Set<number>;
  treeEdges: [number, number][];
  faces: Map<string, FVec>;
  nodePos: Map<number, [number, number]>;
  nodeDepth: Map<number, number>;
  nodeDir: Map<number, number>;
}

function topoLayout(maxDepth: number, circular: boolean): LayoutResult {
  const { nodes, edges: treeEdges, faces } = buildGraph(maxDepth);

  const adj = new Map<number, Set<number>>();
  for (const [la, lb] of treeEdges) {
    if (!adj.has(la)) adj.set(la, new Set());
    adj.get(la)!.add(lb);
  }

  if (!circular) {
    const STEP = 5.5, DECAY = 0.88;
    const nodePos   = new Map<number, [number, number]>([[0, [0, 0]]]);
    const nodeDepth = new Map<number, number>([[0, 0]]);
    const nodeDir   = new Map<number, number>([[0, 0]]);
    const visited   = new Set<number>([0]);

    const rootChildren = [...(adj.get(0) ?? [])].sort((a, b) => a - b);
    for (let i = 0; i < rootChildren.length; i++) {
      const child = rootChildren[i];
      const ang = Math.PI / 2 + i * 2 * Math.PI / 3;
      nodePos.set(child, [Math.cos(ang) * STEP, Math.sin(ang) * STEP]);
      nodeDepth.set(child, 1);
      nodeDir.set(child, ang);
      visited.add(child);
    }

    const queue = [...rootChildren];
    for (let qi = 0; qi < queue.length; qi++) {
      const v = queue[qi];
      const d = nodeDepth.get(v)!;
      const step = STEP * Math.pow(DECAY, d);
      const chList = [...(adj.get(v) ?? [])].filter(n => !visited.has(n)).sort((a, b) => a - b);
      const angIn  = nodeDir.get(v)!;
      const spread = 50 * Math.PI / 180;
      const [vx, vy] = nodePos.get(v)!;
      for (let i = 0; i < chList.length; i++) {
        const child = chList[i];
        const ang = angIn + (i - (chList.length - 1) / 2) * spread;
        nodePos.set(child, [vx + Math.cos(ang) * step, vy + Math.sin(ang) * step]);
        nodeDepth.set(child, d + 1);
        nodeDir.set(child, ang);
        visited.add(child);
        queue.push(child);
      }
    }
    return { nodes, treeEdges, faces, nodePos, nodeDepth, nodeDir };
  }

  // Circular (leaf-proportional wedge) layout
  const parent   = new Map<number, number | null>([[0, null]]);
  const children = new Map<number, number[]>();
  const order    = [0];
  const visited  = new Set<number>([0]);
  const queue    = [0];
  for (let qi = 0; qi < queue.length; qi++) {
    const n = queue[qi];
    for (const nb of [...(adj.get(n) ?? [])].sort((a, b) => a - b)) {
      if (!visited.has(nb)) {
        visited.add(nb);
        parent.set(nb, n);
        if (!children.has(n)) children.set(n, []);
        children.get(n)!.push(nb);
        order.push(nb);
        queue.push(nb);
      }
    }
  }

  const size = new Map<number, number>();
  for (const n of nodes) size.set(n, children.has(n) ? 0 : 1);
  for (let i = order.length - 1; i >= 0; i--) {
    const n = order[i];
    for (const ch of (children.get(n) ?? [])) size.set(n, (size.get(n) ?? 0) + (size.get(ch) ?? 0));
  }

  const STEP = 5.5;
  const nodePos   = new Map<number, [number, number]>([[0, [0, 0]]]);
  const nodeDepth = new Map<number, number>([[0, 0]]);
  const nodeDir   = new Map<number, number>([[0, 0]]);
  const span      = new Map<number, [number, number]>([[0, [0, 2 * Math.PI]]]);

  for (const n of order) {
    const chs = children.get(n) ?? [];
    if (!chs.length) continue;
    const [start, end] = span.get(n)!;
    const arc = end - start;
    const totalLeaves = chs.reduce((s, ch) => s + (size.get(ch) ?? 0), 0);
    let cursor = start;
    const d = (nodeDepth.get(n) ?? 0) + 1;
    for (const ch of chs) {
      const chArc = arc * (size.get(ch) ?? 0) / totalLeaves;
      const mid = cursor + chArc / 2;
      nodePos.set(ch, [d * STEP * Math.cos(mid), d * STEP * Math.sin(mid)]);
      nodeDepth.set(ch, d);
      nodeDir.set(ch, mid);
      span.set(ch, [cursor, cursor + chArc]);
      cursor += chArc;
    }
  }

  return { nodes, treeEdges, faces, nodePos, nodeDepth, nodeDir };
}

function poincareLayout(maxDepth: number): LayoutResult {
  function cayley(re: number, im: number): [number, number] {
    // z -> (z - i) / (z + i)
    const numRe = re, numIm = im - 1;
    const denRe = re, denIm = im + 1;
    const d = denRe * denRe + denIm * denIm;
    return [(numRe * denRe + numIm * denIm) / d, (numIm * denRe - numRe * denIm) / d];
  }

  const { points, edges: treeEdges, faces } = buildTopograph(Math.min(maxDepth, 7));
  const nodePos = new Map<number, [number, number]>();
  for (const [label, z] of points) nodePos.set(label, cayley(z.re, z.im));

  const adj = new Map<number, Set<number>>();
  for (const [la, lb] of treeEdges) {
    if (!adj.has(la)) adj.set(la, new Set());
    adj.get(la)!.add(lb);
  }

  const nodeDepth = new Map<number, number>([[0, 0]]);
  const nodeDir   = new Map<number, number>([[0, 0]]);
  const visited   = new Set<number>([0]);
  const queue     = [0];
  for (let qi = 0; qi < queue.length; qi++) {
    const n = queue[qi];
    for (const nb of [...(adj.get(n) ?? [])].sort((a, b) => a - b)) {
      if (!visited.has(nb)) {
        visited.add(nb);
        nodeDepth.set(nb, (nodeDepth.get(n) ?? 0) + 1);
        const [x, y] = nodePos.get(nb) ?? [0, 0];
        nodeDir.set(nb, Math.atan2(y, x));
        queue.push(nb);
      }
    }
  }

  return { nodes: new Set(points.keys()), treeEdges, faces, nodePos, nodeDepth, nodeDir };
}

// ---------------------------------------------------------------------------
// Face data from layout
// ---------------------------------------------------------------------------

interface FaceDataResult {
  facePos:   Map<string, [number, number]>;
  faceVal:   Map<string, number>;
  faceDepth: Map<string, number>;
}

function faceData(
  treeEdges: [number, number][],
  faces: Map<string, FVec>,
  nodePos: Map<number, [number, number]>,
  nodeDepth: Map<number, number>,
  a: number, b: number, c: number
): FaceDataResult {
  function nk(f: FVec): string { const nf = normFace(f); return `${nf[0]},${nf[1]}`; }

  const faceNodes = new Map<string, [number, number][]>();
  const faceNdep  = new Map<string, number[]>();

  for (const [la, lb] of treeEdges) {
    const f = faces.get(edgeKey(la, lb));
    if (!f) continue;
    const k = nk(f);
    if (k === '0,0') continue;
    for (const v of [la, lb]) {
      if (nodePos.has(v)) {
        if (!faceNodes.has(k)) faceNodes.set(k, []);
        if (!faceNdep.has(k))  faceNdep.set(k, []);
        faceNodes.get(k)!.push(nodePos.get(v)!);
        faceNdep.get(k)!.push(nodeDepth.get(v) ?? 0);
      }
    }
  }

  const facePos   = new Map<string, [number, number]>();
  const faceVal   = new Map<string, number>();
  const faceDepth = new Map<string, number>();

  for (const [k, pts] of faceNodes) {
    if (pts.length < 2) continue;
    const [p, q] = k.split(',').map(Number);
    facePos.set(k, [pts.reduce((s, p) => s + p[0], 0) / pts.length,
                    pts.reduce((s, p) => s + p[1], 0) / pts.length]);
    faceVal.set(k, a * p * p + b * p * q + c * q * q);
    faceDepth.set(k, Math.min(...faceNdep.get(k)!));
  }

  return { facePos, faceVal, faceDepth };
}

// ---------------------------------------------------------------------------
// Convex hull
// ---------------------------------------------------------------------------

function convexHull2d(pts: [number, number][]): [number, number][] {
  const sorted = [...new Set(pts.map(p => `${p[0]},${p[1]}`))].map(s => s.split(',').map(Number) as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  function cross(O: [number,number], A: [number,number], B: [number,number]): number {
    return (A[0]-O[0])*(B[1]-O[1]) - (A[1]-O[1])*(B[0]-O[0]);
  }
  const lower: [number,number][] = [];
  for (const p of sorted) { while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0) lower.pop(); lower.push(p); }
  const upper: [number,number][] = [];
  for (const p of [...sorted].reverse()) { while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], p) <= 0) upper.pop(); upper.push(p); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// ---------------------------------------------------------------------------
// Wavy path for river edges
// ---------------------------------------------------------------------------

function wavyPath(x1: number, y1: number, x2: number, y2: number, nHalf = 10): string {
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-9) return `M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`;
  const vx = -dy / dist, vy = dx / dist;
  const amp = Math.min(dist * 0.04, 4);
  let path = `M${x1.toFixed(1)},${y1.toFixed(1)}`;
  for (let i = 0; i < nHalf; i++) {
    const tEnd = (i + 1) / nHalf, tMid = (i + 0.5) / nHalf;
    const s = i % 2 === 0 ? 1 : -1;
    const cpx = x1 + tMid * dx + vx * amp * s;
    const cpy = y1 + tMid * dy + vy * amp * s;
    const ex = x1 + tEnd * dx, ey = y1 + tEnd * dy;
    path += ` Q${cpx.toFixed(1)},${cpy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`;
  }
  return path;
}

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

export interface DrawParams {
  a: number; b: number; c: number;
  depth: number;
  showSigns: boolean;
  showVectors: boolean;
  mode: string;
  stepSel: [number, number] | null;
  highlightHome?: boolean;
  W?: number; H?: number;
  particles?: boolean;
  pulses?: boolean;
  showNodeLabels?: boolean;
  circular?: boolean;
  poincare?: boolean;
}

export function drawTopographSvg(params: DrawParams): string {
  const {
    a, b, c, depth,
    showSigns, showVectors, mode, stepSel,
    highlightHome = false,
    W = 660, H = 600,
    particles = true,
    pulses = true,
    showNodeLabels = false,
    circular = false,
    poincare = false,
  } = params;

  const maxD = Math.min(depth, 7);
  const { nodes, treeEdges, faces, nodePos, nodeDepth, nodeDir } =
    poincare ? poincareLayout(maxD) : topoLayout(maxD, circular);
  const { facePos, faceVal, faceDepth } = faceData(treeEdges, faces, nodePos, nodeDepth, a, b, c);
  const { riverEdges: rivTreeEdges, lakeFaces: lakeFaceSet } = classifyFaces(faces, a, b, c);

  function nk(f: FVec): string { const nf = normFace(f); return `${nf[0]},${nf[1]}`; }

  if (!facePos.size) {
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" style="background:${BG_DEEP};border-radius:12px;display:block;"><text x="${W/2}" y="${H/2}" fill="${TEXT}" text-anchor="middle">No cells</text></svg>`;
  }

  const rivTreeSet = new Set<string>(rivTreeEdges.map(([la, lb]) => `${Math.min(la,lb)},${Math.max(la,lb)}`));
  const lakeCells  = new Set<string>([...lakeFaceSet].filter(k => facePos.has(k)));
  const riverCells = new Set<string>();
  for (const [la, lb] of rivTreeEdges) {
    const fa = nk(faces.get(edgeKey(la, lb)) ?? [0, 0]);
    const fb = nk(faces.get(edgeKey(lb, la)) ?? [0, 0]);
    if (facePos.has(fa)) riverCells.add(fa);
    if (facePos.has(fb)) riverCells.add(fb);
  }

  const homeKeys = new Set(['1,0', '0,1', '1,1']);

  // Coordinate transform
  let discR = 0;
  let px: (x: number, y: number) => [number, number];

  if (poincare) {
    discR = Math.min(W, H) * 0.45;
    px = (x, y) => [W / 2 + x * discR, H / 2 + y * discR];
  } else if (circular) {
    const allPts = [...facePos.values(), ...nodePos.values()];
    const maxR = Math.max(...allPts.map(([x, y]) => Math.hypot(x, y)), 0.001) + 0.5;
    const circScale = (Math.min(W, H) / 2 - 30) / maxR;
    px = (x, y) => [W / 2 + x * circScale, H / 2 + y * circScale];
  } else {
    const allPts = [...facePos.values(), ...nodePos.values()];
    const allX = allPts.map(p => p[0]), allY = allPts.map(p => p[1]);
    const pad = 0.8;
    const xmin = Math.min(...allX) - pad, xmax = Math.max(...allX) + pad;
    const ymin = Math.min(...allY) - pad, ymax = Math.max(...allY) + pad;
    const sx = (W - 40) / Math.max(xmax - xmin, 1e-9);
    const sy = (H - 40) / Math.max(ymax - ymin, 1e-9);
    const scale = Math.min(sx, sy);
    const ox = 20 + (W - 40 - (xmax - xmin) * scale) / 2 - xmin * scale;
    const oy = 20 + (H - 40 - (ymax - ymin) * scale) / 2 - ymin * scale;
    px = (x, y) => [x * scale + ox, y * scale + oy];
  }

  // Face → node sets (for polygon shading)
  const faceNodeSets = new Map<string, Set<number>>();
  for (const [ekey, f] of faces) {
    const k = nk(f);
    if (k === '0,0') continue;
    const [la, lb] = ekey.split(',').map(Number);
    for (const v of [la, lb]) {
      if (nodePos.has(v)) {
        if (!faceNodeSets.has(k)) faceNodeSets.set(k, new Set());
        faceNodeSets.get(k)!.add(v);
      }
    }
  }

  const LINE_COL = '#5E75B7';
  const o: string[] = [];

  o.push(`<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background:${BG_DEEP};border-radius:12px;display:block;">`);
  o.push('<defs>');
  o.push('<filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>');
  o.push('<filter id="glow2" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>');
  if (poincare) o.push(`<clipPath id="disc-clip"><circle cx="${(W/2).toFixed(1)}" cy="${(H/2).toFixed(1)}" r="${discR.toFixed(1)}"/></clipPath>`);
  o.push('</defs>');
  o.push('<style>@keyframes topo-fadein{from{opacity:0}to{opacity:1}}#topo-cell-popup{animation:topo-fadein 0.18s ease-out forwards}g[data-key]{cursor:pointer}@keyframes topo-fadeout{from{opacity:1}to{opacity:0}}</style>');

  if (poincare) {
    o.push(`<circle cx="${(W/2).toFixed(1)}" cy="${(H/2).toFixed(1)}" r="${discR.toFixed(1)}" fill="${BG_PANEL}" stroke="${ACCENT}" stroke-width="1.5"/>`);
    o.push('<g clip-path="url(#disc-clip)">');
  }

  // Face polygon shading
  for (const [k, snodes] of faceNodeSets) {
    if (!faceVal.has(k)) continue;
    const sval = faceVal.get(k)!;
    let sfill: string, sstroke: string;
    if (lakeCells.has(k)) {
      sfill = '#1976d2'; sstroke = ACCENT;
    } else if (showSigns && sval > 0) {
      sfill = CELL_POS; sstroke = GREEN;
    } else if (showSigns && sval < 0) {
      sfill = CELL_NEG; sstroke = RED_COL;
    } else {
      continue;
    }
    const lpts: [number, number][] = [...snodes].filter(v => nodePos.has(v)).map(v => px(...nodePos.get(v)!));
    const hull = convexHull2d(lpts);
    if (hull.length < 3) continue;
    o.push(`<polygon points="${hull.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}" fill="${sfill}" stroke="${sstroke}" stroke-width="0.5" stroke-linejoin="round" pointer-events="none"/>`);
  }

  // Tree edges
  const edgePaths: [string, string, number, boolean][] = [];
  const drawnPairs = new Set<string>();
  let eidx = 0;
  for (const [la, lb] of treeEdges) {
    if (!nodePos.has(la) || !nodePos.has(lb)) continue;
    const key = `${Math.min(la,lb)},${Math.max(la,lb)}`;
    if (drawnPairs.has(key)) continue;
    drawnPairs.add(key);
    const [x1, y1] = px(...nodePos.get(la)!);
    const [x2, y2] = px(...nodePos.get(lb)!);
    const pid = `te-${eidx}`;
    eidx++;
    const edepth = Math.min(nodeDepth.get(la) ?? 0, nodeDepth.get(lb) ?? 0);
    const isRiv = rivTreeSet.has(key) && (mode === 'river' || mode === 'pell');
    let spid: string;
    if (isRiv) {
      const wd = wavyPath(x1, y1, x2, y2);
      o.push(`<path id="${pid}" d="${wd}" fill="none" stroke="${RIVER_COL}" stroke-width="2.0" stroke-linecap="round"/>`);
      spid = `te-s-${eidx}`;
      o.push(`<path id="${spid}" d="M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}" fill="none" stroke="none"/>`);
    } else {
      o.push(`<path id="${pid}" d="M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}" fill="none" stroke="${LINE_COL}" stroke-width="1.2" stroke-linecap="round"/>`);
      spid = pid;
    }
    edgePaths.push([pid, spid, edepth, isRiv]);
  }

  // Particle animations
  if (particles) {
    for (const [pid, spid, edepth, isRiv] of edgePaths) {
      const dur   = isRiv ? 4.0 : Math.max(6.0, 12.0 - edepth);
      const col   = isRiv ? '#ffe082' : ACCENT;
      const phase = (hashStr(pid) % 100) / 100 * dur;
      o.push(`<path d="M6,0 L-4,-3.5 L-4,3.5 Z" fill="${col}" filter="url(#glow)" opacity="0"><animateMotion dur="${dur.toFixed(1)}s" repeatCount="indefinite" begin="${phase.toFixed(1)}s" rotate="auto"><mpath href="#${spid}"/></animateMotion><animate attributeName="opacity" values="0;1;1;0" dur="${dur.toFixed(1)}s" repeatCount="indefinite" begin="${phase.toFixed(1)}s"/></path>`);
    }
  }

  // Tree node dots
  for (const [v, [vx, vy]] of nodePos) {
    const [x, y] = px(vx, vy);
    o.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="#8888b0" stroke="${BG_DEEP}" stroke-width="0.5"/>`);
  }

  // Neighbour map
  const nbrMap = new Map<string, string[]>();
  for (const [la, lb] of treeEdges) {
    const fa = nk(faces.get(edgeKey(la, lb)) ?? [0, 0]);
    const fb = nk(faces.get(edgeKey(lb, la)) ?? [0, 0]);
    if (facePos.has(fa) && facePos.has(fb) && fa !== fb) {
      if (!nbrMap.has(fa)) nbrMap.set(fa, []);
      if (!nbrMap.has(fb)) nbrMap.set(fb, []);
      if (!nbrMap.get(fa)!.includes(fb)) nbrMap.get(fa)!.push(fb);
      if (!nbrMap.get(fb)!.includes(fa)) nbrMap.get(fb)!.push(fa);
    }
  }

  // Face labels
  const pellScreenPts: [number, number, string][] = [];
  const selKey = stepSel ? `${stepSel[0]},${stepSel[1]}` : null;

  for (const [nf, [fx, fy]] of facePos) {
    const [cx_, cy_] = px(fx, fy);
    const val   = faceVal.get(nf)!;
    const fdep  = faceDepth.get(nf) ?? 0;
    const isHome = highlightHome && homeKeys.has(nf);
    const isSel  = selKey === nf;
    const isLake = lakeCells.has(nf);
    const isPell = mode === 'pell' && Math.abs(val - 1) < 0.5 && nf !== '1,0';

    let ring = cellRing(val, showSigns, isHome, isSel, isPell);
    if (isLake) ring = '#4fc3f7';

    const txt    = fmtVal(val);
    const fsize  = Math.max(8, Math.min(18, Math.floor(20 - fdep * 2.5)));
    const vfsize = Math.max(6, fsize - 3);
    const weight = (isHome || isSel || isPell) ? '700' : '500';
    const glowAttr = (isSel || isPell) ? ' filter="url(#glow)"' : '';

    let tcol: string;
    if (isSel) tcol = isPell ? PELL_COL : signAccent(val)[1];
    else if (isPell) tcol = PELL_COL;
    else if (showSigns) tcol = Math.abs(val) < 1e-9 ? WHITE : (val > 0 ? GREEN : RED_COL);
    else if (isHome) tcol = ACCENT;
    else tcol = TEXT;

    const [p, q] = nf.split(',').map(Number);
    const vecTxt = `(${p},${q})`;
    const nbrVals = (nbrMap.get(nf) ?? []).filter(n => faceVal.has(n)).map(n => faceVal.get(n)!);
    const nbrsAttr = nbrVals.map(fmtVal).join(',');

    o.push(`<g data-key="${p},${q}" data-val="${val}" data-nbrs="${nbrsAttr}">`);
    o.push(`<circle cx="${cx_.toFixed(1)}" cy="${cy_.toFixed(1)}" r="${fsize + 6}" fill="transparent" pointer-events="all"/>`);

    const valY = showVectors ? cy_ - (vfsize * 0.5 + 2) : cy_;
    o.push(`<text x="${cx_.toFixed(1)}" y="${valY.toFixed(1)}" dominant-baseline="central" text-anchor="middle" fill="${tcol}" font-family="JetBrains Mono,monospace" font-size="${fsize}" font-weight="${weight}"${glowAttr} pointer-events="none">${esc(txt)}</text>`);

    if (showVectors) {
      o.push(`<text x="${cx_.toFixed(1)}" y="${(cy_ + fsize * 0.5 + 2).toFixed(1)}" dominant-baseline="central" text-anchor="middle" fill="${WHITE}" font-family="JetBrains Mono,monospace" font-size="${vfsize}" pointer-events="none">${esc(vecTxt)}</text>`);
    }

    if (isHome) {
      o.push(`<circle cx="${cx_.toFixed(1)}" cy="${cy_.toFixed(1)}" r="${fsize + 10}" fill="none" stroke="${ACCENT}" stroke-width="1.5" stroke-dasharray="4,3" pointer-events="none"/>`);
    }

    if (isPell) {
      o.push(`<circle cx="${cx_.toFixed(1)}" cy="${cy_.toFixed(1)}" r="${fsize + 5}" fill="none" stroke="${PELL_COL}" stroke-width="1.8" opacity="0.9" filter="url(#glow)" pointer-events="none"/>`);
      const sro = 5.0, sri = 2.0, scy = cy_ - fsize - 10;
      const starPts = Array.from({ length: 8 }, (_, si) => {
        const r = si % 2 === 0 ? sro : sri;
        return `${(cx_ + r * Math.cos(Math.PI / 4 * si - Math.PI / 2)).toFixed(1)},${(scy + r * Math.sin(Math.PI / 4 * si - Math.PI / 2)).toFixed(1)}`;
      });
      o.push(`<polygon points="${starPts.join(' ')}" fill="${PELL_COL}" filter="url(#glow)" pointer-events="none"/>`);
      pellScreenPts.push([cx_, cy_, nf]);
    }

    if (isSel) {
      const selCol = isPell ? PELL_COL : signAccent(val)[1];
      const rRing = fsize + 10;
      o.push(`<circle cx="${cx_.toFixed(1)}" cy="${cy_.toFixed(1)}" r="${rRing}" fill="none" stroke="${selCol}" stroke-width="2" stroke-dasharray="5,3" pointer-events="none"/>`);
      if (pulses) {
        const r2 = rRing + 18;
        for (let pk = 0; pk < 2; pk++) {
          const delay = pk * 0.9;
          o.push(`<circle cx="${cx_.toFixed(1)}" cy="${cy_.toFixed(1)}" r="${rRing}" fill="none" stroke="${selCol}" stroke-width="1.5" opacity="0" filter="url(#glow2)" pointer-events="none"><animate attributeName="r" values="${rRing};${r2}" dur="1.8s" repeatCount="indefinite" begin="${delay.toFixed(1)}s"/><animate attributeName="opacity" values="0.8;0" dur="1.8s" repeatCount="indefinite" begin="${delay.toFixed(1)}s"/></circle>`);
        }
      }
    }
    o.push('</g>');
  }

  // Pell period arcs
  if (mode === 'pell' && pellScreenPts.length >= 2) {
    pellScreenPts.sort((a, b) => a[0] - b[0]);
    for (let pi = 0; pi < pellScreenPts.length - 1; pi++) {
      const [px1, py1] = pellScreenPts[pi];
      const [px2, py2] = pellScreenPts[pi + 1];
      const pmx = (px1 + px2) / 2, pmy = Math.min(py1, py2) - 30;
      o.push(`<path d="M${px1.toFixed(1)},${py1.toFixed(1)} Q${pmx.toFixed(1)},${pmy.toFixed(1)} ${px2.toFixed(1)},${py2.toFixed(1)}" fill="none" stroke="${PELL_COL}" stroke-width="1.3" stroke-dasharray="5,3" opacity="0.5" pointer-events="none"/>`);
    }
  }

  // Selected-cell popup — collected separately so it always renders on top
  const popupParts: string[] = [];
  if (selKey && facePos.has(selKey)) {
    const [sp, sq] = selKey.split(',').map(Number);
    const sv = faceVal.get(selKey)!;
    const [scx, scy] = px(...facePos.get(selKey)!);
    const nbvs = (nbrMap.get(selKey) ?? []).filter(n => faceVal.has(n)).map(n => faceVal.get(n)!);

    const popupCol = (mode === 'pell' && Math.abs(sv - 1) < 0.5 && selKey !== '1,0') ? PELL_COL : signAccent(sv)[1];
    const lh = 17, padx = 10, pady = 8, pw = 178;
    const rows: [string, string, number, string][] = [[`Q(${sp},${sq}) = ${fmtVal(sv)}`, popupCol, 13, '700']];
    if (nbvs.length) {
      const maxCh = Math.floor((pw - 2 * padx) / (11 * 0.62));
      const parts: string[] = [];
      for (const nv of nbvs) {
        const ns = fmtVal(nv);
        if (`Nbrs: ${[...parts, ns].join(', ')}`.length <= maxCh) parts.push(ns);
        else { parts.push('…'); break; }
      }
      rows.push([`Nbrs: ${parts.join(', ')}`, TEXT_DIM, 11, '400']);
    }
    if (nbvs.length >= 2) {
      const [u, v] = nbvs;
      rows.push([`${fmtVal(u)} + ${fmtVal(v)} − ${fmtVal(sv)} = ${fmtVal(u + v - sv)}`, LIME, 11, '400']);
    }
    const ph = rows.length * lh + pady * 2;
    let bx = scx + 34;
    const by = Math.max(6, Math.min(scy - ph / 2, H - ph - 6));
    if (bx + pw > W - 6) bx = scx - pw - 34;

    popupParts.push('<g id="topo-cell-popup">');
    popupParts.push(`<rect x="${bx.toFixed(0)}" y="${by.toFixed(0)}" width="${pw}" height="${ph.toFixed(0)}" rx="7" fill="#13132b" stroke="${popupCol}" stroke-width="1.5" opacity="0.97"/>`);
    for (let i = 0; i < rows.length; i++) {
      const [rtxt, rcol, rfz, rfw] = rows[i];
      const ty = by + pady + i * lh + rfz * 0.85;
      popupParts.push(`<text x="${(bx + padx).toFixed(0)}" y="${ty.toFixed(1)}" font-family="JetBrains Mono,monospace" font-size="${rfz}" font-weight="${rfw}" fill="${rcol}">${esc(rtxt)}</text>`);
    }
    popupParts.push('</g>');
  }

  if (poincare) {
    o.push('</g>');
    // Boundary circle rendered before popup so popup is always on top
    o.push(`<circle cx="${(W/2).toFixed(1)}" cy="${(H/2).toFixed(1)}" r="${discR.toFixed(1)}" fill="none" stroke="${ACCENT}" stroke-width="1.5"/>`);
  }

  // River/lake legend
  if (mode === 'river' || mode === 'pell') {
    const lgFs = 11, lgPx = 10, lgPy = 6;
    const lgSwR = 26, lgSwL = 14, lgGap = 5, lgItGap = 18;
    const cw = lgFs * 0.63;
    const labels = ['River', 'Lake (zero face)'];
    const swWidths = [lgSwR, lgSwL];
    const itemsW = swWidths.map((sw, i) => sw + lgGap + Math.floor(labels[i].length * cw));
    const totalW = 2 * lgPx + itemsW[0] + lgItGap + itemsW[1];
    const lgH = lgFs + 2 * lgPy;
    const lgX = (W - totalW) / 2, lgY = 5;
    o.push(`<rect x="${lgX.toFixed(1)}" y="${lgY}" width="${totalW.toFixed(1)}" height="${lgH}" rx="4" fill="${BG_DEEP}" fill-opacity="0.85" stroke="${TEXT_DIM}" stroke-width="0.6" stroke-opacity="0.4"/>`);
    const lgMidY = lgY + lgH / 2, lgTextY = lgY + lgPy + lgFs - 2;
    let ix = lgX + lgPx;
    const wy = lgMidY;
    const wp = `M${ix.toFixed(1)},${wy.toFixed(1)} Q${(ix+4).toFixed(1)},${(wy-3).toFixed(1)} ${(ix+9).toFixed(1)},${wy.toFixed(1)} Q${(ix+14).toFixed(1)},${(wy+3).toFixed(1)} ${(ix+19).toFixed(1)},${wy.toFixed(1)} Q${(ix+23).toFixed(1)},${(wy-2).toFixed(1)} ${(ix+26).toFixed(1)},${wy.toFixed(1)}`;
    o.push(`<path d="${wp}" fill="none" stroke="${RIVER_COL}" stroke-width="1.8" stroke-linecap="round" pointer-events="none"/>`);
    ix += lgSwR + lgGap;
    o.push(`<text x="${ix.toFixed(1)}" y="${lgTextY.toFixed(1)}" fill="${TEXT}" font-family="JetBrains Mono,monospace" font-size="${lgFs}" pointer-events="none">${esc(labels[0])}</text>`);
    ix += itemsW[0] - lgSwR - lgGap + lgItGap;
    const cr = lgSwL >> 1;
    o.push(`<circle cx="${(ix+cr).toFixed(1)}" cy="${lgMidY.toFixed(1)}" r="${cr}" fill="#1976d2" stroke="${ACCENT}" stroke-width="1" pointer-events="none"/>`);
    ix += lgSwL + lgGap;
    o.push(`<text x="${ix.toFixed(1)}" y="${lgTextY.toFixed(1)}" fill="${TEXT}" font-family="JetBrains Mono,monospace" font-size="${lgFs}" pointer-events="none">${esc(labels[1])}</text>`);
  }

  // Pell overlay
  if (mode === 'pell' && pellScreenPts.length) {
    const olKeys = pellScreenPts.map(pt => pt[2]);
    const olLines = olKeys.map(k => `(${k.replace(',', ',')})`);
    const olLabel = 'Pell (val=1):';
    const olFs = 11, olLh = 15, olPad = 6;
    const olW = Math.max(olLabel.length, Math.max(...olLines.map(l => l.length))) * Math.floor(olFs * 0.63) + 2 * olPad + 3;
    const olTotalH = olPad + olLh + olLines.length * olLh + olPad;
    const olX = 12, olY = H - 40 - olTotalH;
    o.push(`<rect x="${olX}" y="${olY}" width="${olW}" height="${olTotalH}" rx="5" fill="${BG_DEEP}" fill-opacity="0.85" stroke="${PELL_COL}" stroke-width="0.8" stroke-opacity="0.5"/>`);
    let ty = olY + olPad + olLh - 3;
    o.push(`<text x="${olX + olPad}" y="${ty}" fill="${GREEN}" font-family="JetBrains Mono,monospace" font-size="${olFs}" font-weight="600" pointer-events="none">${esc(olLabel)}</text>`);
    for (const line of olLines) {
      ty += olLh;
      o.push(`<text x="${olX + olPad}" y="${ty}" fill="${PELL_COL}" font-family="JetBrains Mono,monospace" font-size="${olFs}" font-weight="400" pointer-events="none">${esc(line)}</text>`);
    }
  }

  // D / classification label
  const discVal = discriminant(a, b, c);
  const discCls = classify(a, b, c);
  const discShort: Record<string, string> = {
    positive_definite: 'def+', negative_definite: 'def−', indefinite: 'indef', degenerate: 'degen'
  };
  const discColMap: Record<string, string> = {
    positive_definite: GREEN, negative_definite: RED_COL, indefinite: ORANGE, degenerate: TEXT_DIM
  };
  const dlabel = `D=${fmtVal(discVal)} ${discShort[discCls] ?? discCls}`;
  const dcol   = discColMap[discCls] ?? TEXT_DIM;
  const dfs = 11, dpx = 7, dpy = 5;
  const dlw = dlabel.length * Math.floor(dfs * 0.63) + 2 * dpx + 3, dlh = dfs + 2 * dpy;
  o.push(`<rect x="12" y="5" width="${dlw}" height="${dlh}" rx="4" fill="${BG_DEEP}" fill-opacity="0.85" stroke="${dcol}" stroke-width="0.8" stroke-opacity="0.7"/>`);
  o.push(`<text x="${12 + dpx}" y="${5 + dpy + dfs - 2}" fill="${dcol}" font-family="JetBrains Mono,monospace" font-size="${dfs}" font-weight="600" pointer-events="none">${esc(dlabel)}</text>`);

  // Node index labels (debug)
  if (showNodeLabels) {
    for (const jnode of [...nodePos.keys()].sort((a, b) => a - b)) {
      const [jx, jy] = px(...nodePos.get(jnode)!);
      o.push(`<rect x="${(jx-6).toFixed(1)}" y="${(jy-6).toFixed(1)}" width="12" height="12" rx="3" fill="#1a1a3a" opacity="0.75" pointer-events="none"/>`);
      o.push(`<text x="${jx.toFixed(1)}" y="${jy.toFixed(1)}" dominant-baseline="central" text-anchor="middle" fill="#ffb300" font-family="JetBrains Mono,monospace" font-size="9" font-weight="700" pointer-events="none">${jnode}</text>`);
    }
  }

  // Popup always on top of everything (including Poincaré boundary circle)
  for (const part of popupParts) o.push(part);

  o.push('</svg>');
  return o.join('');
}

// ---------------------------------------------------------------------------
// Simple hash for particle phase determinism
// ---------------------------------------------------------------------------

function hashStr(s: string): number {
  let h = 0;
  for (const c of s) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

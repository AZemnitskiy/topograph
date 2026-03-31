/**
 * topograph-math.ts
 * Port of helpers.py — form arithmetic, topograph building, river/lake detection,
 * superbase layout, Gaussian reduction, equivalence checking.
 */

import { buildGraph, normFace, type FVec } from './topograph-core';

// ---------------------------------------------------------------------------
// Basic form evaluation
// ---------------------------------------------------------------------------

export function Q(a: number, b: number, c: number, x: number, y: number): number {
  return a * x * x + b * x * y + c * y * y;
}

export function discriminant(a: number, b: number, c: number): number {
  return b * b - 4 * a * c;
}

export function classify(a: number, b: number, c: number): string {
  const d = discriminant(a, b, c);
  if (Math.abs(d) < 1e-12) return 'degenerate';
  if (d < 0) return a > 0 ? 'positive_definite' : 'negative_definite';
  return 'indefinite';
}

export function B(a: number, bCoeff: number, c: number, ex: number, ey: number, fx: number, fy: number): number {
  return 2 * a * ex * fx + bCoeff * (ex * fy + ey * fx) + 2 * c * ey * fy;
}

// ---------------------------------------------------------------------------
// Canonical vector
// ---------------------------------------------------------------------------

export function canon(p: number, q: number): [number, number] {
  if (p < 0 || (p === 0 && q < 0)) return [-p, -q];
  return [p, q];
}

function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = b; b = a % b; a = t; }
  return a;
}

function isPrimitive(p: number, q: number): boolean {
  return gcd(Math.abs(p), Math.abs(q)) === 1;
}

export function vecKey(p: number, q: number): string { return `${p},${q}`; }
export function parseKey(k: string): [number, number] {
  const [p, q] = k.split(',').map(Number);
  return [p, q];
}

// ---------------------------------------------------------------------------
// Cell data type
// ---------------------------------------------------------------------------

export interface CellData {
  vec: [number, number];
  val: number;
  x: number;
  y: number;
  depth: number;
}

// ---------------------------------------------------------------------------
// Topograph generation (delegates to buildGraph from topograph-core)
// ---------------------------------------------------------------------------

export interface TopoResult {
  cells: Map<string, CellData>;
  edges: [string, string][];
}

export function buildTopographCells(a: number, b: number, c: number, maxDepth = 5): TopoResult {
  const { edges: coreEdges, faces } = buildGraph(maxDepth);

  const cells = new Map<string, CellData>();
  const edgeSet = new Set<string>();
  const edges: [string, string][] = [];

  for (const f of faces.values()) {
    const [p, q] = normFace(f);
    if (p === 0 && q === 0) continue;
    const k = vecKey(p, q);
    if (!cells.has(k)) {
      cells.set(k, { vec: [p, q], val: a * p * p + b * p * q + c * q * q, x: 0, y: 0, depth: 0 });
    }
  }

  for (const [la, lb] of coreEdges) {
    const fa = normFace(faces.get(`${la},${lb}`) ?? [0, 0]);
    const fb = normFace(faces.get(`${lb},${la}`) ?? [0, 0]);
    if ((fa[0] === 0 && fa[1] === 0) || (fb[0] === 0 && fb[1] === 0)) continue;
    const ka = vecKey(...fa), kb = vecKey(...fb);
    if (ka === kb) continue;
    const ek = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    if (!edgeSet.has(ek)) {
      edgeSet.add(ek);
      edges.push([ka, kb]);
    }
  }

  return { cells, edges };
}

// ---------------------------------------------------------------------------
// River edges
// ---------------------------------------------------------------------------

export function riverEdges(cells: Map<string, CellData>, edges: [string, string][]): [string, string][] {
  return edges.filter(([k1, k2]) => {
    const v1 = cells.get(k1)?.val ?? 0;
    const v2 = cells.get(k2)?.val ?? 0;
    return v1 * v2 < 0;
  });
}

// ---------------------------------------------------------------------------
// Superbase graph
// ---------------------------------------------------------------------------

export type TriKey = string;

export interface SuperbaseGraph {
  triList: TriKey[];
  edgeToTri: Map<string, TriKey[]>;
  triAdj: Map<TriKey, Set<TriKey>>;
}

export function buildSuperbaseGraph(
  cells: Map<string, CellData>,
  edges: [string, string][]
): SuperbaseGraph {
  const adj = new Map<string, Set<string>>();
  for (const [k1, k2] of edges) {
    if (!adj.has(k1)) adj.set(k1, new Set());
    if (!adj.has(k2)) adj.set(k2, new Set());
    adj.get(k1)!.add(k2);
    adj.get(k2)!.add(k1);
  }

  const seen = new Set<TriKey>();
  const triList: TriKey[] = [];
  for (const [k1, k2] of edges) {
    const n1 = adj.get(k1) ?? new Set<string>();
    const n2 = adj.get(k2) ?? new Set<string>();
    for (const k3 of n1) {
      if (!n2.has(k3)) continue;
      const t = [k1, k2, k3].sort().join('|');
      if (!seen.has(t)) { seen.add(t); triList.push(t); }
    }
  }

  const e2t = new Map<string, TriKey[]>();
  for (const tri of triList) {
    const [a, b, c] = tri.split('|');
    for (const [ea, eb] of [[a, b], [a, c], [b, c]] as [string, string][]) {
      const ek = ea < eb ? `${ea}|${eb}` : `${eb}|${ea}`;
      if (!e2t.has(ek)) e2t.set(ek, []);
      e2t.get(ek)!.push(tri);
    }
  }

  const triAdj = new Map<TriKey, Set<TriKey>>();
  for (const ts of e2t.values()) {
    if (ts.length === 2) {
      if (!triAdj.has(ts[0])) triAdj.set(ts[0], new Set());
      if (!triAdj.has(ts[1])) triAdj.set(ts[1], new Set());
      triAdj.get(ts[0])!.add(ts[1]);
      triAdj.get(ts[1])!.add(ts[0]);
    }
  }

  return { triList, edgeToTri: e2t, triAdj };
}

// ---------------------------------------------------------------------------
// Superbase layout (BFS)
// ---------------------------------------------------------------------------

export interface LayoutResult {
  triPos: Map<TriKey, [number, number]>;
  parentTri: Map<TriKey, TriKey | null>;
  triDir: Map<TriKey, number>;
  triDepth: Map<TriKey, number>;
}

export function layoutSuperbases(
  triAdj: Map<TriKey, Set<TriKey>>,
  homeTri: TriKey,
  step = 5.5,
  decay = 0.88
): LayoutResult {
  const triPos   = new Map<TriKey, [number, number]>([[homeTri, [0, 0]]]);
  const triDir   = new Map<TriKey, number>([[homeTri, Math.PI / 2]]);
  const triDepth = new Map<TriKey, number>([[homeTri, 0]]);
  const parentTri = new Map<TriKey, TriKey | null>([[homeTri, null]]);
  const queue: TriKey[] = [homeTri];

  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    const [cx, cy] = triPos.get(cur)!;
    const curDir   = triDir.get(cur)!;
    const curDepth = triDepth.get(cur)!;
    const par      = parentTri.get(cur)!;
    const nbrs     = [...(triAdj.get(cur) ?? [])].filter(n => n !== par);

    let baseDirs: number[];
    if (par === null) {
      baseDirs = [Math.PI / 2, -Math.PI / 6, 7 * Math.PI / 6].slice(0, nbrs.length);
    } else if (nbrs.length === 1) {
      baseDirs = [curDir];
    } else if (nbrs.length === 2) {
      baseDirs = [curDir + Math.PI / 6, curDir - Math.PI / 6];
    } else {
      baseDirs = [curDir, curDir + Math.PI / 4, curDir - Math.PI / 4].slice(0, nbrs.length);
    }

    const stepLen = step * Math.pow(decay, curDepth);
    for (let i = 0; i < nbrs.length; i++) {
      const nb = nbrs[i];
      if (triPos.has(nb)) continue;
      const ang = baseDirs[i] ?? curDir;
      triPos.set(nb, [cx + Math.cos(ang) * stepLen, cy + Math.sin(ang) * stepLen]);
      triDir.set(nb, ang);
      triDepth.set(nb, curDepth + 1);
      parentTri.set(nb, cur);
      queue.push(nb);
    }
  }

  return { triPos, parentTri, triDir, triDepth };
}

// ---------------------------------------------------------------------------
// Gaussian reduction (for positive-definite forms)
// ---------------------------------------------------------------------------

export function reduceForm(a: number, b: number, c: number): [number, number, number] {
  if (a < 0) { a = -a; b = -b; c = -c; }
  for (let iter = 0; iter < 200; iter++) {
    if (a === 0) break;
    const k = Math.round((b + a) / (2 * a)) - 1 + (Math.floor((b + a) / (2 * a)) !== Math.round((b + a) / (2 * a)) - 1 + 1 ? 0 : 0);
    // Reduce b into (-a, a]
    const kk = a !== 0 ? Math.floor((b + a) / (2 * a)) : 0;
    const bNew = b - 2 * a * kk;
    const cNew = c - b * kk + a * kk * kk;
    if (bNew === b && cNew === c) {
      // Step 2: swap if a > c
      if (a > c) { [a, b, c] = [c, -b, a]; continue; }
      // Step 3: normalise b sign when a===c
      if (b < 0 && a === c) b = -b;
      if (b < 0 && a === Math.abs(b)) b = -b;
      break;
    }
    b = bNew; c = cNew;
    if (a > c) { [a, b, c] = [c, -b, a]; }
  }
  if (a > c) { [a, b, c] = [c, -b, a]; }
  return [a, b, c];
}

// ---------------------------------------------------------------------------
// Equivalence check
// ---------------------------------------------------------------------------

export function areEquivalent(
  a1: number, b1: number, c1: number,
  a2: number, b2: number, c2: number
): { ok: boolean; reason: string } {
  const d1 = discriminant(a1, b1, c1);
  const d2 = discriminant(a2, b2, c2);
  if (Math.abs(d1 - d2) > 0.5)
    return { ok: false, reason: `Different discriminants: ${Math.round(d1)} ≠ ${Math.round(d2)}` };

  const cls1 = classify(a1, b1, c1);
  const cls2 = classify(a2, b2, c2);
  if (cls1 !== cls2)
    return { ok: false, reason: `Different classifications: ${cls1} vs ${cls2}` };

  if (cls1.includes('definite')) {
    const r1 = reduceForm(Math.round(a1), Math.round(b1), Math.round(c1));
    const r2 = reduceForm(Math.round(a2), Math.round(b2), Math.round(c2));
    if (r1[0] === r2[0] && r1[1] === r2[1] && r1[2] === r2[2])
      return { ok: true, reason: `Both reduce to ${r1[0]}x² + ${r1[1]}xy + ${r1[2]}y²` };
    return { ok: false, reason: `Reduce to different forms: (${r1}) vs (${r2})` };
  }

  // Indefinite: compare small value sets
  const cells1 = buildTopographCells(a1, b1, c1, 4).cells;
  const cells2 = buildTopographCells(a2, b2, c2, 4).cells;
  const vals1 = [...new Set([...cells1.values()].map(v => Math.round(v.val)))].sort((x, y) => x - y).slice(0, 12);
  const vals2 = [...new Set([...cells2.values()].map(v => Math.round(v.val)))].sort((x, y) => x - y).slice(0, 12);
  const match = vals1.length === vals2.length && vals1.every((v, i) => v === vals2[i]);
  if (match) return { ok: true, reason: `Same value set in topograph: [${vals1.slice(0, 6)}]…` };
  return { ok: false, reason: `Different value sets: [${vals1.slice(0, 4)}] vs [${vals2.slice(0, 4)}]` };
}

// ---------------------------------------------------------------------------
// Poincaré disc helpers
// ---------------------------------------------------------------------------

export function vecToBoundaryAngle(p: number, q: number): number {
  return Math.atan2(p, q);
}

export function poincareCellCentre(
  v1: [number, number], v2: [number, number], v3: [number, number]
): [number, number] {
  const angles = [v1, v2, v3].map(([p, q]) => vecToBoundaryAngle(p, q));
  const pts = angles.map(a => [Math.cos(a), Math.sin(a)] as [number, number]);
  let cx = pts.reduce((s, p) => s + p[0], 0) / 3;
  let cy = pts.reduce((s, p) => s + p[1], 0) / 3;
  const r = Math.sqrt(cx * cx + cy * cy);
  if (r > 0.01) { const s = Math.min(0.85, r); cx = cx / r * s; cy = cy / r * s; }
  return [cx, cy];
}

/**
 * topograph-core.ts
 * Port of topograph_core.py — Conway's Topograph computation layer.
 *
 * Computes vertices, edges and face labels of the topograph in the
 * upper half-plane model of hyperbolic geometry.
 *
 * Public API:
 *   buildGraph(maxDepth)      — pure label-arithmetic BFS (no geometry)
 *   buildTopograph(maxDepth)  — Möbius-geometry version
 *   classifyFaces(faces, a,b,c)
 */

const EPS = 1e-14;

// ---------------------------------------------------------------------------
// Complex number arithmetic (inline, no dependency)
// ---------------------------------------------------------------------------

export interface Complex { re: number; im: number; }

export function cx(re: number, im = 0): Complex { return { re, im }; }
function cAdd(a: Complex, b: Complex): Complex { return { re: a.re + b.re, im: a.im + b.im }; }
function cSub(a: Complex, b: Complex): Complex { return { re: a.re - b.re, im: a.im - b.im }; }
function cMul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}
function cDiv(a: Complex, b: Complex): Complex {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}
function cAbs(a: Complex): number { return Math.sqrt(a.re * a.re + a.im * a.im); }
function cNeg(a: Complex): Complex { return { re: -a.re, im: -a.im }; }

// ---------------------------------------------------------------------------
// CP1Point — a point in the upper half-plane
// ---------------------------------------------------------------------------

class CP1Point {
  private coord: Complex;
  constructor(re = 0, im = 0) { this.coord = { re, im }; }
  static fromComplex(z: Complex): CP1Point {
    const p = new CP1Point(); p.coord = z; return p;
  }
  planeCoord(): Complex { return this.coord; }
  equals(other: CP1Point): boolean { return cAbs(cSub(this.coord, other.coord)) < EPS; }
}

// ---------------------------------------------------------------------------
// Möbius transformation  z -> (az + b) / (cz + d)
// ---------------------------------------------------------------------------

class Mobius {
  _a: Complex; _b: Complex; _c: Complex; _d: Complex;
  constructor(
    a: number | Complex = 1, b: number | Complex = 0,
    c: number | Complex = 0, d: number | Complex = 1
  ) {
    this._a = typeof a === 'number' ? cx(a) : a;
    this._b = typeof b === 'number' ? cx(b) : b;
    this._c = typeof c === 'number' ? cx(c) : c;
    this._d = typeof d === 'number' ? cx(d) : d;
  }
  transformPoint(z: CP1Point): CP1Point {
    const w = z.planeCoord();
    return CP1Point.fromComplex(cDiv(cAdd(cMul(this._a, w), this._b), cAdd(cMul(this._c, w), this._d)));
  }
  getInverse(): Mobius { return new Mobius(this._d, cNeg(this._b), cNeg(this._c), this._a); }
}

function dot(m1: Mobius, m2: Mobius): Mobius {
  const { _a: a1, _b: b1, _c: c1, _d: d1 } = m1;
  const { _a: a2, _b: b2, _c: c2, _d: d2 } = m2;
  return new Mobius(
    cAdd(cMul(a1, a2), cMul(b1, c2)),
    cAdd(cMul(a1, b2), cMul(b1, d2)),
    cAdd(cMul(c1, a2), cMul(d1, c2)),
    cAdd(cMul(c1, b2), cMul(d1, d2)),
  );
}

// Constants
const CENTER = new CP1Point(0.5, Math.sqrt(3) / 2);
const TINV = new Mobius(1, -1, 0, 1);
const T    = new Mobius(1,  1, 0, 1);
const TST  = new Mobius(1,  0, 1, 1);

// ---------------------------------------------------------------------------
// Shared types and key helpers
// ---------------------------------------------------------------------------

export type FVec = [number, number];

export function edgeKey(la: number, lb: number): string { return `${la},${lb}`; }
export function normFace(f: FVec): FVec { return f[0] < 0 ? [-f[0], -f[1]] : f; }

function sameVector(a: FVec, b: FVec): boolean {
  const a0 = a[0] < 0 ? -a[0] : a[0], a1 = a[0] < 0 ? -a[1] : a[1];
  const b0 = b[0] < 0 ? -b[0] : b[0], b1 = b[0] < 0 ? -b[1] : b[1];
  return a0 === b0 && a1 === b1;
}

function round14(x: number): number { return Math.floor(x * 1e14) / 1e14; }

function getShape(cpt: CP1Point): number { return cpt.planeCoord().im > 0.5 ? 0 : 1; }

function customSorted(cpt: CP1Point, adjPts: CP1Point[]): CP1Point[] {
  const yRef = round14(cpt.planeCoord().im);
  const out = [...adjPts];
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const ax = round14(out[i].planeCoord().re), ay = round14(out[i].planeCoord().im);
      const bx = round14(out[j].planeCoord().re), by = round14(out[j].planeCoord().im);
      const sameSide = (ay < yRef) === (by < yRef);
      if (sameSide) {
        if (ax > bx) [out[i], out[j]] = [out[j], out[i]];
      } else if (ay < yRef) {
        [out[i], out[j]] = [out[j], out[i]];
      }
    }
  }
  return out;
}

function getAdjPtms(mob: Mobius): Mobius[] {
  return [dot(mob, TINV), dot(mob, TST), dot(mob, T)];
}

function faceAssigned(f: FVec | undefined): boolean {
  return f !== undefined && (f[0] !== 0 || f[1] !== 0);
}

function isRight(parent: number, clabel: number, label: number): boolean {
  if (parent < clabel) return label === 2 * clabel + 2;
  if (parent === 2 * clabel + 2) return label === 2 * clabel + 3;
  return label === (clabel - 2) >> 1;
}

// ---------------------------------------------------------------------------
// _generate — recursive Möbius-based tree expansion
// ---------------------------------------------------------------------------

function _generate(
  cptm: Mobius, clabel: number, parentLabel: number, oppFace: FVec,
  maxDepth: number,
  ptms: Map<number, Mobius>, points: Map<number, CP1Point>,
  edges: [number, number][], faces: Map<string, FVec>,
  minImag: number
): void {
  const cpt = cptm.transformPoint(CENTER);
  if (cpt.planeCoord().im < minImag || maxDepth <= 0) return;

  const adjPtms = getAdjPtms(cptm);
  const adjPts  = adjPtms.map(m => m.transformPoint(CENTER));
  const adjPtsSorted  = customSorted(cpt, adjPts);
  const adjPtmsSorted = adjPtsSorted.map(q => adjPtms[adjPts.findIndex(p => p.equals(q))]);

  const shape = getShape(cpt);
  let adjLabels: number[];
  if (clabel === 0) {
    adjLabels = [1, 3, 2];
  } else if (clabel === 1) {
    adjLabels = [4, 0, 5];
  } else if (shape === 1) {
    adjLabels = [(clabel - 2) >> 1, 2 * clabel + 2, 2 * clabel + 3];
  } else {
    if (cpt.planeCoord().re > 0) {
      adjLabels = [(clabel - 2) >> 1, 2 * clabel + 3, 2 * clabel + 2];
    } else {
      adjLabels = [2 * clabel + 2, (clabel - 2) >> 1, 2 * clabel + 3];
    }
  }

  const parentPt = points.get(parentLabel)!;
  const newLabels: number[] = [], newPtms: Mobius[] = [], newPts: CP1Point[] = [];
  for (let i = 0; i < adjLabels.length; i++) {
    if (!adjPtsSorted[i].equals(parentPt)) {
      newLabels.push(adjLabels[i]);
      newPtms.push(adjPtmsSorted[i]);
      newPts.push(adjPtsSorted[i]);
    }
  }

  let newFace: FVec = [0, 0];
  let parentFace: FVec = [0, 0], parentFaceRev: FVec = [0, 0];
  if (parentLabel !== clabel) {
    parentFace    = faces.get(edgeKey(parentLabel, clabel)) ?? [0, 0];
    parentFaceRev = faces.get(edgeKey(clabel, parentLabel)) ?? [0, 0];
    newFace = [parentFace[0] + parentFaceRev[0], parentFace[1] + parentFaceRev[1]];
    if (sameVector(oppFace, newFace))
      newFace = [parentFace[0] - parentFaceRev[0], parentFace[1] - parentFaceRev[1]];
    if (newFace[0] < 0) newFace = [-newFace[0], -newFace[1]];
  }

  for (let i = 0; i < newLabels.length; i++) {
    const label = newLabels[i];
    points.set(label, newPts[i]);
    ptms.set(label, newPtms[i]);
    edges.push([clabel, label], [label, clabel]);
    if (parentLabel !== clabel) {
      const ek = edgeKey(clabel, label), ekr = edgeKey(label, clabel);
      if (faceAssigned(faces.get(ek)) || faceAssigned(faces.get(ekr))) continue;
      const right = isRight(parentLabel, clabel, label);
      if (right) { faces.set(ek, [...parentFace] as FVec); faces.set(ekr, [...newFace] as FVec); }
      else        { faces.set(ek, [...newFace] as FVec);   faces.set(ekr, [...parentFaceRev] as FVec); }
    }
  }

  if (newLabels.length === 3) {
    const [x, y, z] = shape === 0 ? [1, 2, 0] : [2, 0, 1];
    const refs = [x, y, z];
    for (let i = 0; i < newPtms.length; i++) {
      const tf = faces.get(edgeKey(clabel, newLabels[refs[i]])) ?? [0, 0] as FVec;
      _generate(newPtms[i], newLabels[i], clabel, tf, maxDepth - 1, ptms, points, edges, faces, minImag);
    }
  } else if (newLabels.length === 2) {
    for (let i = 0; i < newPtms.length; i++) {
      const right = isRight(parentLabel, clabel, newLabels[i]);
      const tempEdge = right ? edgeKey(clabel, parentLabel) : edgeKey(parentLabel, clabel);
      const tf = faces.get(tempEdge) ?? [0, 0] as FVec;
      _generate(newPtms[i], newLabels[i], clabel, tf, maxDepth - 1, ptms, points, edges, faces, minImag);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GraphResult {
  nodes: Set<number>;
  edges: [number, number][];
  faces: Map<string, FVec>;
}

/** Build graph topology using pure label arithmetic (no geometry). */
export function buildGraph(maxDepth = 7): GraphResult {
  function neighbours(n: number): number[] {
    if (n === 0) return [1, 2, 3];
    if (n === 1) return [0, 4, 5];
    return [(n - 2) >> 1, 2 * n + 2, 2 * n + 3];
  }

  const nodes = new Set<number>([0, 1, 2, 3]);
  const edges: [number, number][] = [];
  const faces = new Map<string, FVec>([
    ['0,1', [1, 0]], ['1,0', [0, 1]],
    ['0,2', [0, 1]], ['2,0', [1, 1]],
    ['0,3', [1, 1]], ['3,0', [1, 0]],
  ]);
  for (const child of [1, 2, 3]) edges.push([0, child], [child, 0]);

  const rootOpposites: Record<number, FVec> = { 1: [1, 1], 3: [0, 1], 2: [1, 0] };
  const visited = new Set<number>([0, 1, 2, 3]);
  const queue: [number, number, FVec, number][] = [
    [1, 0, rootOpposites[1], 1],
    [2, 0, rootOpposites[2], 1],
    [3, 0, rootOpposites[3], 1],
  ];

  for (let qi = 0; qi < queue.length; qi++) {
    const [clabel, parentLabel, oppFace, depth] = queue[qi];
    if (depth >= maxDepth) continue;

    const pe = edgeKey(parentLabel, clabel), per = edgeKey(clabel, parentLabel);
    const parentFace    = faces.get(pe)!;
    const parentFaceRev = faces.get(per)!;

    let newFace: FVec = [parentFace[0] + parentFaceRev[0], parentFace[1] + parentFaceRev[1]];
    if (sameVector(oppFace, newFace))
      newFace = [parentFace[0] - parentFaceRev[0], parentFace[1] - parentFaceRev[1]];
    if (newFace[0] < 0) newFace = [-newFace[0], -newFace[1]];

    const children = neighbours(clabel).filter(n => n !== parentLabel);

    for (const label of children) {
      nodes.add(label);
      const ek = edgeKey(clabel, label), ekr = edgeKey(label, clabel);
      edges.push([clabel, label], [label, clabel]);
      if (!faces.has(ek) && !faces.has(ekr)) {
        const right = isRight(parentLabel, clabel, label);
        if (right) { faces.set(ek, [...parentFace] as FVec); faces.set(ekr, [...newFace] as FVec); }
        else        { faces.set(ek, [...newFace] as FVec);   faces.set(ekr, [...parentFaceRev] as FVec); }
      }
    }

    for (const label of children) {
      if (!visited.has(label)) {
        visited.add(label);
        const right = isRight(parentLabel, clabel, label);
        const opp = right ? [...faces.get(per)!] as FVec : [...faces.get(pe)!] as FVec;
        queue.push([label, clabel, opp, depth + 1]);
      }
    }
  }

  return { nodes, edges, faces };
}

/** Build graph using Möbius geometry — returns upper-half-plane positions. */
export function buildTopograph(maxDepth = 7, minImag = 1e-6): { points: Map<number, Complex>; edges: [number, number][]; faces: Map<string, FVec> } {
  const ptms   = new Map<number, Mobius>();
  const points = new Map<number, CP1Point>();
  const edges: [number, number][] = [];
  const faces = new Map<string, FVec>([
    ['0,1', [1, 0]], ['1,0', [0, 1]],
    ['0,2', [0, 1]], ['2,0', [1, 1]],
    ['0,3', [1, 1]], ['3,0', [1, 0]],
  ]);

  const rootPtm = new Mobius();
  ptms.set(0, rootPtm);
  points.set(0, rootPtm.transformPoint(CENTER));
  _generate(rootPtm, 0, 0, [-999, -999], maxDepth, ptms, points, edges, faces, minImag);

  // Convert CP1Point map to Complex map for callers
  const complexPoints = new Map<number, Complex>();
  for (const [k, v] of points) complexPoints.set(k, v.planeCoord());

  return { points: complexPoints, edges, faces };
}

export interface ClassifyFacesResult {
  values: Map<string, number>;           // normFaceKey -> form value
  riverEdges: [number, number][];        // undirected river edges
  lakeFaces: Set<string>;               // normFaceKeys with value = 0
}

export function classifyFaces(faces: Map<string, FVec>, a: number, b: number, c: number): ClassifyFacesResult {
  function norm(f: FVec): FVec { return f[0] < 0 ? [-f[0], -f[1]] : f; }
  function faceKey(f: FVec): string { const nf = norm(f); return `${nf[0]},${nf[1]}`; }
  function formVal(f: FVec): number { const [p, q] = norm(f); return a * p * p + b * p * q + c * q * q; }

  const values = new Map<string, number>();
  for (const f of faces.values()) {
    if (f[0] === 0 && f[1] === 0) continue;
    const k = faceKey(f);
    if (!values.has(k)) values.set(k, formVal(f));
  }

  const riverEdges: [number, number][] = [];
  const seen = new Set<string>();
  for (const [ekey, faceLeft] of faces) {
    const [la, lb] = ekey.split(',').map(Number);
    const uk = `${Math.min(la, lb)},${Math.max(la, lb)}`;
    if (seen.has(uk)) continue;
    seen.add(uk);
    const faceRight = faces.get(edgeKey(lb, la));
    if (!faceRight) continue;
    const vl = formVal(faceLeft), vr = formVal(faceRight);
    if ((vl > 0 && vr < 0) || (vl < 0 && vr > 0)) riverEdges.push([la, lb]);
  }

  const lakeFaces = new Set<string>();
  for (const [k, v] of values) { if (v === 0) lakeFaces.add(k); }

  return { values, riverEdges, lakeFaces };
}

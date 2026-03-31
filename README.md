# Binary Quadratic Form Topograph Explorer

An interactive visualizer for binary quadratic forms built with [Next.js](https://nextjs.org) and React. Explore the Conway topograph, the river, Pell solutions, equivalence of forms, and the Poincaré disc — with a built-in tutorial system covering the theory from the ground up.

This is a full port of the original [Solara/Python explorer](../topograph_explorer) to a modern TypeScript/React stack.

## Quick Start

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` in your browser.

## Features

### Topograph View
- **SVG topograph** — BFS-grown trivalent tree with lax vectors placed at superbase barycentres
- **Sign map** — faces colored green (positive), red (negative), grey (zero) with live updates as you drag the a, b, c sliders
- **Home triad** — the three seed values Q(1,0), Q(0,1), Q(−1,−1) highlighted at the root
- **Vector labels** — toggle (p, q) coordinates on every face
- **Depth slider** — grow or shrink the tree from depth 1 to 7
- **Animations** — directional particles along tree edges and pulse rings on selected nodes (toggle via ⚙ button)

### Modes

Two top-level tabs:

| Tab | Description |
|-----|-------------|
| **Topograph** | Main view with three sub-tabs and layout controls |
| **Equivalence** | Side-by-side comparison of two forms with a live equivalence check |

Sub-tabs within **Topograph**:

| Sub-tab | Description |
|---------|-------------|
| **Plain** | Standard topograph with optional sign coloring |
| **River trace** | Gold wavy edges mark the river (sign-change boundary); blue gradient lakes highlight zero-value faces |
| **Pell solutions** | River trace plus amber star glyphs on cells with value 1; dashed arcs connect consecutive solutions; solution list overlaid in the graph corner |

Layout buttons (available in all Topograph sub-tabs):

| Layout | Description |
|--------|-------------|
| **Tree ⊕** | Standard trivalent tree layout |
| **Radial ◉** | Circular/radial arrangement of the tree |
| **Poincaré disc ◎** | Renders the form within the hyperbolic disc model |

### Tutorial System
- 8 pre-built JSON tutorials covering the Conway topograph from first principles
- Each tutorial step auto-configures the form, depth, mode, and display options
- Reading mode (full-screen text), activity prompts, and multiple-choice quizzes per step

## Things to Try

- Set **a=1, b=0, c=−1** (discriminant 4 > 0) → switch to **River trace**: a single straight river separates all positive from all negative faces
- Set **a=1, b=2, c=−1** → switch to **Pell solutions**: find the repeating pattern of cells with value 1; these are solutions to the associated Pell equation x² + 2xy − y² = 1
- Set **a=1, b=0, c=1** (discriminant −4 < 0) → the form is positive-definite: no river, all faces positive
- Set **a=2, b=2, c=−1** → **Equivalence** mode: compare with **a=1, b=0, c=−2**; both have discriminant 12 and reduce to the same form
- Switch to **Poincaré disc** for any indefinite form and watch the river become a geodesic

## Tutorial Files

Tutorials live in `public/tutorials/` as JSON files and load automatically on startup. Use the dropdown in the sidebar to switch between them.

| File | Title | Views | Topics |
|------|-------|-------|--------|
| `01_home_triad.json` | The Home Triad | 4 | Seed values, Q(1,0)/Q(0,1)/Q(−1,−1), the root superbase |
| `02_arithmetic_progression.json` | The Arithmetic Progression Rule | 4 | How each face is determined by its two parents: f = u + v − e |
| `03_sign_map_river.json` | Sign Map and the River | 4 | Positive/negative/zero faces; the river as the sign-change boundary |
| `04_discriminant.json` | The Discriminant | 4 | D = b²−4ac; definite vs indefinite forms; how D controls the river |
| `05_definite_forms.json` | Positive-Definite Forms | 4 | D < 0 forms, no river, minimum value, reduced forms |
| `06_indefinite_pell.json` | Indefinite Forms and Pell's Equation | 4 | D > 0 forms, periodic river, Pell solutions as value-1 cells |
| `07_equivalence.json` | Equivalence of Forms | 4 | SL₂(ℤ) action, reduced forms, same discriminant ↔ equivalent |
| `08_poincare_disc.json` | The Poincaré Disc View | 3 | Hyperbolic geometry, geodesics, the river as a hyperbolic line |

### Writing Your Own Tutorials

Add a `.json` file to `public/tutorials/` with this structure:

```json
{
  "title": "Tutorial Title",
  "views": [
    {
      "title": "Step Title",
      "text": "Explanatory text...",
      "activity": "Something for the reader to try...",
      "form": { "a": 1, "b": 0, "c": -1 },
      "state": {
        "depth": 4,
        "show_signs": true,
        "mode": "river",
        "highlight_home": true
      },
      "quiz": {
        "question": "Question text?",
        "options": ["A", "B", "C", "D"],
        "correct": 0,
        "explanation": "Because..."
      }
    }
  ]
}
```

**`form`** sets the a, b, c coefficients for that step.

**`state.mode`** values: `"default"` · `"river"` · `"pell"` · `"equiv"`.

**`quiz`** is optional; omit the key to skip the quiz for that step.

## Project Structure

```
app/                — Next.js app router (layout, page, globals.css)
components/         — React UI components (Sidebar, TopographCanvas, TutorialPanel)
lib/                — Core math and rendering (topograph-math.ts, topograph-render.ts, topograph-core.ts)
store/              — Zustand global state (state.ts)
public/tutorials/   — JSON tutorial files (01–08)
```

## Dependencies

- [Next.js](https://nextjs.org) 16 — React framework with App Router
- [React](https://react.dev) 19 — UI library
- [Zustand](https://zustand-demo.pmnd.rs) 5 — lightweight global state
- [react-markdown](https://github.com/remarkjs/react-markdown) — tutorial text rendering
- [Tailwind CSS](https://tailwindcss.com) 4 — utility CSS

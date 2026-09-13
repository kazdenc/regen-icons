# Drawing Lino Icons

Updated: 2026-09-09. This is the canonical authoring guide. The build embeds it in
`dist/icons.md` and the npm package includes it as its README. Edit this guide, not those generated copies.
The numeric contract lives in the `spec` export of [build-icons.mjs](../.dev/scripts/build-icons.mjs)
and is also included in the generated instructions. Update the prose if it changes.

Each icon is a small JSON source on a 24 grid. The compiler standardizes the stroke,
caps, and default geometry and rejects invalid construction. Visual consistency also
requires comparison with existing icons: validation alone does not establish it.

Authoring requires this repository checkout and `pnpm install`; installing the
SVG or React package alone does not install the compiler. Commands below run from
the repository root unless stated otherwise.

## How to add an icon

Work one icon at a time and look at the result. An icon that passes every rule and still
reads wrong is the normal case, not the exception.

1. **Check the set first.** `dist/icons.json` lists every name and keyword. Most
   requests are an existing icon under another word.
2. **Pick the name by shape, not meaning.** `square-check`, not `approve`. The meaning
   goes in `keywords`, so a reader coming from Lucide or Tabler still finds it.
3. **Find a neighbour to copy the construction from.** A badged icon reuses
   `{ "use": "circle-frame" }`. A framed mark follows `square-check`. Composition is why
   the family holds together; a new construction should be a deliberate choice.
4. **Write `src/<name>.icon.json`** with the fewest shapes that name the thing.
5. **Validate it alone**, which writes nothing:
   ```
   node .dev/scripts/build-icons.mjs --check src/tool.icon.json
   ```
   An error names the icon, the shape index, and the rule it broke.
6. **Build and look at it**, large and at 16, beside its neighbours:
   ```
   node .dev/scripts/build-icons.mjs
   node .dev/scripts/preview.mjs tool eye layers      # dist/preview.png
   ```
   Add `--grid` to inspect joins. Use the same neighbours in the review matrix:
   ```
   node .dev/scripts/preview.mjs tool eye layers --matrix
   ```
   This shows 16, 20, 24, and 32px at every supported weight, outline and available
   tonal forms, light/dark, plus 32px and 36px controls and text rows. Use
   `--html-only` to write the review page without launching a browser, then open it
   with the available browser tool. Run with no names for the entire set.
7. **Read the balance notes** the build prints. They flag ink far from the set's median
   and glyphs off centre. They are advice, not errors: a chevron is light by nature.
8. **Judge it at 16, not at 96.** Almost every icon that needed redrawing looked fine
   large. If a counter closes or two strokes merge, fix it now.
9. **Rebuild and test** so the catalog and the package pick it up:
   ```
   pnpm test
   ```

## Canvas

24 by 24. Safe area 2 to 22. Every point on the integer or half grid. Stroke 2, round
caps. Weights 1.5 and 1.75 render from the same geometry at runtime.

Key shapes, so icons carry even optical weight: circle r 9 at 12,12; square 18 at
inset 3; landscape 20 by 16; portrait 16 by 20. Match one.

## Source file

`src/<name>.icon.json`, relative to the repository root. `name` is kebab-case and matches the file. `title` is the human
name. `categories` from the fixed list. `keywords` for search. `shapes` in draw order.
`fill` is `auto` (default) or `none`; a `filled` shape list overrides the tint's shape.

## Primitives

| Primitive | Form | Notes |
|---|---|---|
| `line` | `[x1, y1, x2, y2]` | |
| `polyline` | `[[x, y], ...]`, `close: true`, `corner` | Corners rounded by arc; `join: "miter"` for sharp. A point may be `{ "to": [x, y], "r": n, "large", "flip" }` for an arc segment ending there, which is how a closed outline with round parts is drawn; corners are not rounded where an arc meets a line. A closed polyline may end on its first point |
| `rect` | `[x, y, w, h]`, `radius` | Radius defaults to 2, or 1 when the shorter side is under 8 |
| `circle` | `[cx, cy, r]` | Radius on the half grid |
| `ellipse` | `[cx, cy, rx, ry]` | |
| `arc` | `[cx, cy, r, from, to]` | Degrees in multiples of 45, clockwise from east |
| `bend` | `[x1, y1, x2, y2, r]`, `large`, `flip` | Arc between two grid points; bulges left of travel unless flipped |
| `quad` | `[x1, y1, cx, cy, x2, y2]` | Quadratic curve; control point on the grid |
| `dot` | `[x, y]` | A round-capped terminal that scales with weight. For a dot that *is* the glyph, use a circle of radius 1 |
| `arrow` | `[x1, y1, x2, y2]`, `head` | Legs 6 by 6 on axis shafts, 8 axis-aligned on diagonals |
| `use` | `"name"`, `offset: [dx, dy]`, `scale: 1 or 0.5` | Inlines another icon's shapes |
| `path` | raw data | Last resort; flagged in `dist/report.json` |

## Corners

Every polyline vertex and every arrowhead tip is rounded with an arc of radius 2 cut into
the geometry, so corners read as round at any stroke weight rather than only to the
stroke's own radius. An arrow's shaft ends on the rounded tip. A corner takes at most 40%
of its shorter segment, so a small mark keeps straight runs between its corners.
`corner` on a shape overrides the radius (0 to 4); `join: "miter"` makes it sharp.

## Modifiers

`mirror: "x" | "y"` flips across the canvas centre. `rotate` in multiples of 90.
`nudge: [dx, dy]` up to 0.5 per axis, for optical centring only; listed in the report.

## Style, learned from the first sixty-five

Each of these came from looking at a rendered set and finding something wrong. They are
the difference between "passes the build" and "belongs to the family".

- **No faces, no ornament.** A glyph is the fewest strokes that name the thing. The bot
  is a head with two eye slits and an antenna, not a smiling face.
- **Counters at 16.** Any opening a reader must see, a slot, a pupil, the gap between
  stacked layers, should have about 4 units of clear space where practical. This is an optical
  recommendation, not a validator threshold or a promise about raster pixels.
  Dense symbols may need smaller openings; judge them at 16px in every weight.
  Simplify or move geometry before adding detail.
- **Marks inside frames** span about 55 to 60% of the frame. Smaller and the mark turns
  to a blob at 16; the corner cap exists for this, so do not fight it with a tiny `corner`.
- **Sharp direction marks take `corner: 1`.** A chevron, caret, or arrowhead at the
  default radius 2 loses its point and reads as a curve. Frames and containers keep the
  default. Chevrons also want arms of about 7 units, not 6.
- **Dots that stand alone** (ellipsis, list bullets) are circles of radius 1, which match
  the weight of a line at stroke 2. The `dot` primitive is for a terminal inside a glyph.
- **Toothed or spoked shapes** are one closed polyline snapped to the half grid with
  `corner: 1`. A circle with spokes reads as a sun or a ship's wheel, not a gear.
- **Shapes with round parts are one closed outline**, drawn with arc segments inside a
  polyline. A wrench built from separate strokes reads as a magnifier.
- **Optical weight over geometric truth.** Curves and diagonals carry less ink than the
  same span of straight stroke. Fix a heavy or light glyph by moving mass, never by
  changing its stroke.
- **Open shapes never end on another stroke's edge.** Stop 2 short or cross clean; a
  stroke landing on a line makes a blob at 16.
- **Names by shape, meaning by keyword.** `square-check`, not `approve`.

## Growing the set

The first sixty-five covered what the components and chrome draw. Two later batches took
the set to 115: the everyday words a UI needs (external-link, link, filter, arrows-sort,
calendar, clock, mail, star, bookmark, share, upload, code, terminal, photo, table,
cursor, grip, sun, moon, message, send, tag, book, key) and this brand's own subjects
(accessibility, contrast, letter-a, ruler, sitemap, route, git-branch, sidebar, columns,
shield, clipboard, globe, pin, flag, bug, undo, redo, play, pause, square, maximize,
zoom-in, zoom-out, mic, camera, hash). Neither needed anything new in the language. What
they taught:

Two practical expansion batches then took the set to 139, covering devices, commerce,
storage, audio, attachments, shapes, connectivity, navigation, and system controls. A
third family-completion batch took it to 154 with the missing diagonal arrows, framed
plus/minus/x states, open and muted variants, file and folder creation, laptop, server,
and repeat. These additions reused the existing constructions; they did not add a new
primitive or global drawing rule.

- **An axis arrowhead is 6 wide, so two do not fit side by side.** `arrows-sort` sets
  `head: 4`; at the default its heads left the canvas. Pair an arrow with anything and
  the head, not the gap, is what has to give.
- **An arc's flip decides which icon you drew.** The first `link` bulged inward and made
  a bowtie; the first `pin` bulged downward and made a kite. Render an arc before
  trusting the sign, and prefer two `arc` shapes to arc segments inside a polyline when
  the two halves face away from each other.
- **Two lines make a panel; three make a table.** One rule and one column read as
  `sidebar`. The line that distinguishes an icon from its neighbour is the one to keep.
- **Ink crowds faster than frames.** `bug` lost a pair of legs and `globe` two latitudes;
  both were called heavy or read as a blob at 16, and both say the same thing with less.
- **`use` does not carry the modifiers.** `{ "use": "undo", "mirror": "x" }` renders
  `undo` unchanged, so `redo` is written out mirrored by hand. Check any twin you build
  this way against its source.
- **Spokes on a ring say lifeboat, not target.** `target` was a ring, an inner circle,
  and four ticks crossing it, and read as a support badge. Concentric rings and a centre
  dot, nothing crossing, is the bullseye. Compare a new icon against what else its
  construction could mean, not only against what you meant.
- **A glyph that touches its frame closes up at 16.** `photo`'s ridge ran within 1.5 of
  the bottom edge and its dot sat on the first peak; both needed 3 of clear ground. The
  same fix made `moon` a semicircle against a radius 18 inner arc and gave `pin` a head
  wide enough to hold its counter.
- **A curve's depth must match its neighbours'.** `database` drew its top as an ellipse
  3 deep and its bands as circular bends 4 deep, and the cylinder looked wrong without
  looking broken. A `bend` of radius 9.5 across a chord of 14 is 3.08 deep; match the
  depth, then check the number.
- **An elbow into a node distorts; a straight run into it does not.** `git-branch` ran
  right and then turned up into its third node, and `route` turned a hard corner between
  two. The branch is now a T, and the route is two `bend`s meeting mid-canvas as an S.
- **A figure inside a ring needs 3 of clear ground from it, so the figure shrinks.**
  `accessibility` first touched the ring, then lost the ring entirely and became a plain
  stick figure. Head at radius 1, arms at 11, legs ending at 17.5: inside the ring, and
  every counter still open at 16.
- **A two-tone glyph needs a `filled` list.** `contrast` is a circle and a half-disc; the
  default union tints the whole circle and says nothing.

- **Round contours need smooth joins.** Check the tangent where an arc meets a line;
  round stroke caps cannot repair a kink in the centreline. Heart lobes turn through
  rounded arcs, pin sides leave the head below its widest point, and bulb shoulders
  use paired quadratic curves. Compare these at 16px and enlarged before accepting
  a contour; do not round intentional arrow, tool, or polygon corners away.

## Construction references for new icons

Use these current sources as neighbours, not as fixed templates for every symbol:

| Construction | Sources to compare | Decision to preserve |
|---|---|---|
| Badges | `circle-check`, `square-check`, `circle-alert` | Consistent frame and apparent internal mark size |
| Attached shapes | `clipboard` | Break the board outline behind the clip; explicit `filled` shapes retain the board tint |
| Small details | `photo`, `tag`, `adjustments` | Photo uses a terminal dot; tag keeps an inward, larger hole; slider rails stop at their enlarged rings |
| Repeated narrow shapes | `chart-bar` | 4.5-unit bars keep 3 units between stroke centers; smaller counters are a reviewed exception, not a new global default |
| Prompt symbols | `terminal`, `tool-call` | `corner: 1` on the chevron, with a gap before the cursor; frame proportions may differ |
| Measurement | `ruler` | A shorter middle tick distinguishes measurement without adding strokes |
| Directional pairs | `undo`, `redo`, `upload`, `download` | Matched apparent reach; inspect mirrored pairs because modifiers on `use` are not applied |

Keep a baseline before refining an existing source. Compare new geometry with it in
the matrix and with its neighbours in controls; a half-unit change is a trial, not an
improvement by definition. Preserve the original when the comparison is inconclusive.
Use the existing `nudge` allowance only for a demonstrated optical issue. Simple
icons such as minus and chevrons naturally have less ink; do not thicken them to
silence an advisory note.

## Checks the build enforces

Off-grid point, point outside the safe area, unknown primitive or category, radius larger
than half the shorter side, zero-length line, parallel axis-aligned strokes closer than 3
centre to centre (rectangle edges and polyline segments included), `use` of an unknown
icon or a cycle, duplicate names, a file name not matching `name`, an arc angle off 45,
a rotate off 90, a nudge over 0.5. Every error names the icon, the shape index, and the
rule.

The gap is measured centre to centre because at stroke 2 a gap of 2 leaves no light
between two strokes. Curves and diagonals are not covered; judge those by eye.

## Optical balance

The build measures each icon's ink (stroke length times width) and the centre of its
bounding box, and writes notes to `dist/report.json` and the console: heavy or
light against the set's median by more than a factor of 2.2, more than 1.25 off centre,
or a bounding box under 12. `.dev/scripts/preview.mjs` prints the notes for the icons it renders.

## Filled twins

Icons with a closed shape get a filled form automatically. It is tonal, not solid: the
union of the closed shapes is tinted with the current colour at `--lino-icon-tone` (0.2)
under the same outline, so the drawing stays legible and the icon reads as active. A
solid silhouette loses the glyph. Set `"fill": "none"` to opt out, or give a `"filled"`
shape list when the union is not the right reading.

## Commands

| Command, from the `generator/` folder | What it does |
|---|---|
| `node .dev/scripts/build-icons.mjs --check src/<name>.icon.json` | Validates one source, prints its SVG, writes nothing |
| `node .dev/scripts/build-icons.mjs` | Builds the set into `dist/icons` |
| `node .dev/scripts/preview.mjs [names…] [--grid]` | Builds `../svg/`, opens `dist/preview.html`, and renders `dist/preview.png` for review |
| `node .dev/scripts/preview.mjs [names…] --matrix` | All sizes and weights, both themes and forms, controls and text rows |
| `node .dev/scripts/preview.mjs [names…] --matrix --html-only` | Same matrix in `dist/preview.html`, no browser launch |
| `pnpm build:package` | Builds the npm package into `dist/package` |
| `pnpm test` | Builds the package and runs the workflow tests |

## Outputs, `dist/`

`../svg/outline/<name>.svg` and `../svg/filled/<name>.svg`; `icons.tsx` with one named export per icon plus
a name-driven `Icon`; `sprite.svg`; `icons.json` catalog with sources and file URLs;
`icons.md` agent rules; `report.json` for flagged paths, nudges, and balance notes;
`package/` the npm package; `preview.png` the review render.

## Where an icon shows up once built

The npm package (React components, raw SVGs, sprite, catalog, and this guide as README).
All from this one source file.

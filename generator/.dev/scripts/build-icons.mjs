// Icon generator. Compiles src/*.icon.json, written in the drawing language
// in docs/spec.md, into ../svg plus dist: React, sprite, catalog, and agent instructions.
// Numeric construction rules are enforced here; optical guidance still needs review.
import fs from "node:fs";
import path from "node:path";
import { fillPath, balance } from "./fill.mjs";

export const root = path.resolve(new URL("../..", import.meta.url).pathname);
export const projectRoot = path.resolve(root, "..");
const srcDir = path.join(root, "src");
const outDir = path.join(root, "dist");
const svgDir = path.join(projectRoot, "svg");
const outlineDir = path.join(svgDir, "outline");
const filledDir = path.join(svgDir, "filled");

export const spec = {
  canvas: 24,
  safe: [2, 22],
  stroke: 2,
  weights: [1.5, 1.75, 2],
  radius: { container: 2, small: 1, smallBelow: 8 },
  corner: 2,
  arrowHead: { axis: 6, diagonal: 8 },
  minGap: 3,
  nudgeMax: 0.5,
  // Optical balance: ink within this factor of the set's median, centre within this
  // distance of the canvas centre. Outside either, the report names the icon.
  balance: { inkFactor: 2.2, centreDrift: 1.25, minBox: 12 },
  categories: ["navigation", "actions", "status", "content", "entry-types", "agent", "controls", "shapes"],
};

const fmt = (n) => (Math.round(n * 100) / 100).toString().replace(/^(-?)0\./, "$1.");
const onGrid = (n) => Number.isFinite(n) && Math.abs(n * 2 - Math.round(n * 2)) < 1e-9;
const primitives = ["line", "polyline", "rect", "circle", "arc", "bend", "quad", "ellipse", "dot", "arrow", "path", "use"];

export function loadSources() {
  return fs
    .readdirSync(srcDir)
    .filter((f) => f.endsWith(".icon.json"))
    .sort()
    .map((f) => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(srcDir, f), "utf8")) }));
}

class IconError extends Error {
  constructor(icon, index, rule) {
    super(index == null ? `${icon}: ${rule}` : `${icon}: shape ${index}: ${rule}`);
  }
}

// Transforms declared on a shape. Rotation is limited to quarter turns so every point
// stays on the half grid; mirror flips across the canvas centre.
function transformPoint([x, y], shape) {
  const c = spec.canvas / 2;
  if (shape.mirror === "x") x = spec.canvas - x;
  if (shape.mirror === "y") y = spec.canvas - y;
  const turns = ((shape.rotate ?? 0) / 90) % 4;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) [x, y] = [c - (y - c), c + (x - c)];
  if (shape.nudge) [x, y] = [x + shape.nudge[0], y + shape.nudge[1]];
  return [x, y];
}

// Resolve every shape to a list of {d, join?, cap?, points, flagged} geometry records.
// `use` inlines another icon's shapes with an offset and scale.
export function resolve(icon, byName, seen = []) {
  if (seen.includes(icon.name)) throw new IconError(icon.name, null, `use cycle through ${seen.join(" > ")}`);
  const out = [];
  icon.shapes.forEach((shape, i) => {
    const kind = primitives.find((p) => p in shape);
    if (!kind) throw new IconError(icon.name, i, `unknown primitive; expected one of ${primitives.join(", ")}`);
    if (shape.rotate != null && shape.rotate % 90 !== 0) throw new IconError(icon.name, i, "rotate must be a multiple of 90");
    if (shape.nudge && (shape.nudge.length !== 2 || shape.nudge.some((n) => Math.abs(n) > spec.nudgeMax)))
      throw new IconError(icon.name, i, `nudge is limited to ${spec.nudgeMax} in each axis`);
    if (shape.join && !["round", "miter"].includes(shape.join)) throw new IconError(icon.name, i, "join must be round or miter");
    if (kind === "use") {
      const target = byName.get(shape.use);
      if (!target) throw new IconError(icon.name, i, `use of unknown icon "${shape.use}"`);
      const scale = shape.scale ?? 1;
      if (![0.5, 1].includes(scale)) throw new IconError(icon.name, i, "use scale must be 0.5 or 1");
      const [dx, dy] = shape.offset ?? [0, 0];
      const c = spec.canvas / 2;
      const map = ([x, y]) => [c + (x - c) * scale + dx, c + (y - c) * scale + dy];
      for (const g of resolve(target, byName, [...seen, icon.name])) out.push({ ...g, index: i, points: g.points.map(map), scale: (g.scale ?? 1) * scale, offset: [dx, dy] });
      return;
    }
    const t = (p) => transformPoint(p, shape);
    if (shape.corner != null && (shape.corner < 0 || shape.corner > 4)) throw new IconError(icon.name, i, "corner must be between 0 and 4");
    const rec = { index: i, kind, join: shape.join ?? "round", corner: shape.join === "miter" ? 0 : shape.corner ?? spec.corner, flagged: kind === "path" };
    switch (kind) {
      case "line": {
        const [x1, y1, x2, y2] = shape.line;
        rec.points = [t([x1, y1]), t([x2, y2])];
        break;
      }
      case "polyline": {
        // A point is [x, y] for a straight segment, or { to: [x, y], r, large, flip } for
        // an arc that ends there. Corners are rounded only where two straight segments meet.
        if (shape.polyline.length < 2) throw new IconError(icon.name, i, "polyline needs two or more points");
        rec.points = shape.polyline.map((p) => t(Array.isArray(p) ? p : p.to));
        rec.segs = shape.polyline.map((p) => (Array.isArray(p) ? null : { r: p.r, large: !!p.large, flip: (!!p.flip) !== (!!shape.mirror) }));
        for (const [k, seg] of rec.segs.entries()) if (seg && !(seg.r > 0)) throw new IconError(icon.name, i, `polyline point ${k} arc needs a positive radius`);
        rec.close = !!shape.close;
        // A closed polyline may end on its first point; that last segment is the closing one.
        const [f, l] = [rec.points[0], rec.points.at(-1)];
        if (rec.close && rec.points.length > 2 && f[0] === l[0] && f[1] === l[1]) {
          rec.points.pop();
          rec.segs[0] = rec.segs.pop();
        }
        break;
      }
      case "rect": {
        const [x, y, w, h] = shape.rect;
        if (w <= 0 || h <= 0) throw new IconError(icon.name, i, "rect needs positive width and height");
        const r = shape.radius ?? (Math.min(w, h) < spec.radius.smallBelow ? spec.radius.small : spec.radius.container);
        if (r * 2 > Math.min(w, h)) throw new IconError(icon.name, i, `radius ${r} exceeds half the shorter side`);
        rec.points = [t([x, y]), t([x + w, y + h])];
        rec.radius = r;
        break;
      }
      case "circle": {
        const [cx, cy, r] = shape.circle;
        if (r <= 0) throw new IconError(icon.name, i, "circle needs a positive radius");
        rec.points = [t([cx, cy])];
        rec.r = r;
        break;
      }
      case "ellipse": {
        const [cx, cy, rx, ry] = shape.ellipse;
        rec.points = [t([cx, cy])];
        rec.rx = rx;
        rec.ry = ry;
        break;
      }
      case "arc": {
        const [cx, cy, r, from, to] = shape.arc;
        if (from % 45 !== 0 || to % 45 !== 0) throw new IconError(icon.name, i, "arc angles must be multiples of 45 degrees");
        rec.points = [t([cx, cy])];
        rec.r = r;
        rec.from = from;
        rec.to = to;
        break;
      }
      case "bend": {
        // An arc between two grid points with a radius; the bulge lands wherever the
        // geometry puts it. `large` takes the long way round, `flip` mirrors the bulge.
        const [x1, y1, x2, y2, r] = shape.bend;
        const chord = Math.hypot(x2 - x1, y2 - y1);
        if (r <= 0) throw new IconError(icon.name, i, "bend needs a positive radius");
        if (r * 2 < chord - 1e-9) throw new IconError(icon.name, i, `bend radius ${r} is under half the chord (${fmt(chord / 2)})`);
        rec.points = [t([x1, y1]), t([x2, y2])];
        rec.r = r;
        rec.large = !!shape.large;
        rec.flip = (!!shape.flip) !== (!!shape.mirror);
        break;
      }
      case "quad": {
        // A quadratic curve; the control point sits on the grid like every other point.
        const [x1, y1, cx, cy, x2, y2] = shape.quad;
        rec.points = [t([x1, y1]), t([cx, cy]), t([x2, y2])];
        break;
      }
      case "dot": {
        rec.points = [t(shape.dot)];
        break;
      }
      case "arrow": {
        const [x1, y1, x2, y2] = shape.arrow;
        rec.points = [t([x1, y1]), t([x2, y2])];
        rec.head = shape.head;
        break;
      }
      case "path": {
        rec.d = shape.path;
        rec.points = [...shape.path.matchAll(/-?\d+(?:\.\d+)?/g)].map(Number).reduce((acc, n, k, arr) => (k % 2 ? acc : [...acc, [n, arr[k + 1]]]), []);
        break;
      }
    }
    out.push(rec);
  });
  return out;
}

// Arrowhead: two legs at 45 degrees from the shaft, pointing back from the tip. Axis
// shafts get legs of 6 by 6; diagonal shafts get axis-aligned legs of 8. Both land on
// the grid, which the validator then confirms.
function arrowLegs([x1, y1], [x2, y2], head) {
  const dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1);
  if (dx && dy) {
    const h = head ?? spec.arrowHead.diagonal;
    return [[x2 - dx * h, y2], [x2, y2 - dy * h]];
  }
  const h = head ?? spec.arrowHead.axis;
  return dx ? [[x2 - dx * h, y2 - h], [x2 - dx * h, y2 + h]] : [[x2 - h, y2 - dy * h], [x2 + h, y2 - dy * h]];
}

const polar = (cx, cy, r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];

// Corner rounding as geometry: at each vertex the two segments are cut back and joined
// by an arc of the corner radius, so a chevron or a triangle is visibly round at any
// weight. The radius shrinks when a segment is too short to hold it. Returns the cut
// points and the arc so the arrow can end its shaft on the rounded tip.
function roundedCorner(a, v, b, r) {
  const [ax, ay] = [a[0] - v[0], a[1] - v[1]], [bx, by] = [b[0] - v[0], b[1] - v[1]];
  const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
  const cos = (ax * bx + ay * by) / (la * lb);
  const theta = Math.acos(Math.max(-1, Math.min(1, cos)));
  if (!r || theta > Math.PI - 1e-6 || theta < 1e-6) return null;
  let t = r / Math.tan(theta / 2);
  // A corner may take at most 40% of its shorter segment, so a small mark keeps
  // straight runs between its corners instead of turning into one curve.
  const max = Math.min(la, lb) * 0.4;
  if (t > max) { t = max; r = t * Math.tan(theta / 2); }
  const p1 = [v[0] + (ax / la) * t, v[1] + (ay / la) * t];
  const p2 = [v[0] + (bx / lb) * t, v[1] + (by / lb) * t];
  const sweep = ax * by - ay * bx < 0 ? 1 : 0;
  const bis = [ax / la + bx / lb, ay / la + by / lb], lbis = Math.hypot(...bis);
  const apex = [v[0] + (bis[0] / lbis) * (r / Math.sin(theta / 2) - r), v[1] + (bis[1] / lbis) * (r / Math.sin(theta / 2) - r)];
  return { p1, p2, r, sweep, apex };
}

function polylinePath(points, close, corner, segs = []) {
  const P = (p) => p.map(fmt).join(" ");
  const n = points.length;
  const arcInto = (i) => segs[((i % n) + n) % n];
  const cornerAt = (i) => {
    if (!close && (i === 0 || i === n - 1)) return null;
    // No rounding where an arc arrives at or leaves this vertex; the arc is the curve.
    if (arcInto(i) || arcInto(i + 1)) return null;
    return roundedCorner(points[(i - 1 + n) % n], points[i], points[(i + 1) % n], corner);
  };
  const corners = points.map((_, i) => cornerAt(i));
  const seg = (c, i) => {
    const a = arcInto(i);
    if (a) return `A${fmt(a.r)} ${fmt(a.r)} 0 ${a.large ? 1 : 0} ${a.flip ? 0 : 1} ${P(points[i % n])}`;
    return c ? `L${P(c.p1)}A${fmt(c.r)} ${fmt(c.r)} 0 0 ${c.sweep} ${P(c.p2)}` : `L${P(points[i % n])}`;
  };
  if (!close) return `M${P(points[0])}` + points.slice(1).map((_, k) => seg(corners[k + 1], k + 1)).join("");
  const start = corners[0] ? corners[0].p2 : points[0];
  let d = `M${P(start)}`;
  for (let i = 1; i < n; i++) d += seg(corners[i], i);
  d += seg(corners[0], n);
  return d + "Z";
}

function toPath(g) {
  const P = (p) => p.map(fmt).join(" ");
  switch (g.kind) {
    case "line":
      return `M${P(g.points[0])}L${P(g.points[1])}`;
    case "polyline":
      return polylinePath(g.points, g.close, g.corner, g.segs);
    case "rect": {
      const [[x1, y1], [x2, y2]] = [[Math.min(g.points[0][0], g.points[1][0]), Math.min(g.points[0][1], g.points[1][1])], [Math.max(g.points[0][0], g.points[1][0]), Math.max(g.points[0][1], g.points[1][1])]];
      const r = g.radius * (g.scale ?? 1);
      if (!r) return `M${fmt(x1)} ${fmt(y1)}H${fmt(x2)}V${fmt(y2)}H${fmt(x1)}Z`;
      const a = (x, y) => `A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x)} ${fmt(y)}`;
      return `M${fmt(x1 + r)} ${fmt(y1)}H${fmt(x2 - r)}${a(x2, y1 + r)}V${fmt(y2 - r)}${a(x2 - r, y2)}H${fmt(x1 + r)}${a(x1, y2 - r)}V${fmt(y1 + r)}${a(x1 + r, y1)}Z`;
    }
    case "circle": {
      const [cx, cy] = g.points[0], r = g.r * (g.scale ?? 1);
      return `M${fmt(cx - r)} ${fmt(cy)}a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(2 * r)} 0a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-2 * r)} 0Z`;
    }
    case "ellipse": {
      const [cx, cy] = g.points[0], rx = g.rx * (g.scale ?? 1), ry = g.ry * (g.scale ?? 1);
      return `M${fmt(cx - rx)} ${fmt(cy)}a${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(2 * rx)} 0a${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(-2 * rx)} 0Z`;
    }
    case "arc": {
      const [cx, cy] = g.points[0], r = g.r * (g.scale ?? 1);
      const sweep = ((g.to - g.from) % 360 + 360) % 360 || 360;
      const [sx, sy] = polar(cx, cy, r, g.from), [ex, ey] = polar(cx, cy, r, g.to);
      return `M${fmt(sx)} ${fmt(sy)}A${fmt(r)} ${fmt(r)} 0 ${sweep > 180 ? 1 : 0} 1 ${fmt(ex)} ${fmt(ey)}`;
    }
    case "bend": {
      const r = g.r * (g.scale ?? 1);
      return `M${P(g.points[0])}A${fmt(r)} ${fmt(r)} 0 ${g.large ? 1 : 0} ${g.flip ? 0 : 1} ${P(g.points[1])}`;
    }
    case "quad":
      return `M${P(g.points[0])}Q${P(g.points[1])} ${P(g.points[2])}`;
    case "dot":
      return `M${P(g.points[0])}v.01`;
    case "arrow": {
      const [a, b] = g.points, [l1, l2] = arrowLegs(a, b, g.head);
      const c = roundedCorner(l1, b, l2, g.corner);
      const end = c ? c.apex : b;
      return `M${P(a)}L${P(end)}${polylinePath([l1, b, l2], false, g.corner)}`;
    }
    case "path":
      return g.d;
  }
}

// Every point a shape touches, for the grid and safe-area checks.
function extents(g) {
  const s = g.scale ?? 1;
  switch (g.kind) {
    case "circle": {
      const [cx, cy] = g.points[0], r = g.r * s;
      return [[cx - r, cy - r], [cx + r, cy + r]];
    }
    case "arc": {
      // Only the swept part counts: both ends plus any axis extreme inside the sweep.
      const [cx, cy] = g.points[0], r = g.r * s;
      const sweep = ((g.to - g.from) % 360 + 360) % 360 || 360;
      const pts = [polar(cx, cy, r, g.from), polar(cx, cy, r, g.to)];
      for (const a of [0, 90, 180, 270]) if (((a - g.from) % 360 + 360) % 360 <= sweep) pts.push(polar(cx, cy, r, a));
      return pts.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
    }
    case "ellipse": {
      const [cx, cy] = g.points[0];
      return [[cx - g.rx * s, cy - g.ry * s], [cx + g.rx * s, cy + g.ry * s]];
    }
    case "arrow":
      return [...g.points, ...arrowLegs(g.points[0], g.points[1], g.head)];
    case "bend":
      return [...g.points, bendApex(g)];
    default:
      return g.points;
  }
}

// The point on a bend farthest from its chord, so the safe-area check sees the bulge.
function bendApex(g) {
  const [[x1, y1], [x2, y2]] = g.points, r = g.r * (g.scale ?? 1);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, half = Math.hypot(x2 - x1, y2 - y1) / 2;
  const h = Math.sqrt(Math.max(0, r * r - half * half));
  const nx = -(y2 - y1) / (2 * half), ny = (x2 - x1) / (2 * half);
  // SVG sweep 1 is clockwise on screen: the centre sits to the right of travel and the
  // small arc bulges left. flip and large each turn that around.
  const side = (g.flip ? -1 : 1) * (g.large ? -1 : 1);
  const cx = mx + nx * h * side, cy = my + ny * h * side;
  return [cx - nx * r * side, cy - ny * r * side];
}

export function validate(icon, geometry, byName) {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(icon.name)) throw new IconError(icon.name, null, "name must be kebab-case");
  if (icon.file && icon.file !== `${icon.name}.icon.json`) throw new IconError(icon.name, null, `file ${icon.file} does not match name`);
  if (!icon.title) throw new IconError(icon.name, null, "title is required");
  if (!Array.isArray(icon.categories) || !icon.categories.length) throw new IconError(icon.name, null, "at least one category is required");
  for (const c of icon.categories) if (!spec.categories.includes(c)) throw new IconError(icon.name, null, `unknown category "${c}"; expected one of ${spec.categories.join(", ")}`);
  if (!Array.isArray(icon.keywords)) throw new IconError(icon.name, null, "keywords must be a list");
  if (icon.fill && !["auto", "none"].includes(icon.fill)) throw new IconError(icon.name, null, "fill must be auto or none");
  if (!icon.shapes?.length) throw new IconError(icon.name, null, "at least one shape is required");
  const lines = [];
  for (const g of geometry) {
    for (const [x, y] of g.points) if (!g.flagged && !(onGrid(x) && onGrid(y))) throw new IconError(icon.name, g.index, `point ${fmt(x)},${fmt(y)} is off the half grid`);
    for (const [x, y] of extents(g)) {
      if (x < spec.safe[0] || x > spec.safe[1] || y < spec.safe[0] || y > spec.safe[1])
        throw new IconError(icon.name, g.index, `point ${fmt(x)},${fmt(y)} is outside the safe area (${spec.safe[0]} to ${spec.safe[1]})`);
    }
    if (g.kind === "circle" || g.kind === "arc" || g.kind === "bend") if (!onGrid(g.r * (g.scale ?? 1))) throw new IconError(icon.name, g.index, "radius must land on the half grid");
    const segment = ([x1, y1], [x2, y2]) => {
      if (x1 === x2) lines.push({ axis: "v", at: x1, index: g.index, lo: Math.min(y1, y2), hi: Math.max(y1, y2) });
      if (y1 === y2) lines.push({ axis: "h", at: y1, index: g.index, lo: Math.min(x1, x2), hi: Math.max(x1, x2) });
    };
    if (g.kind === "line" || g.kind === "arrow") {
      const [[x1, y1], [x2, y2]] = g.points;
      if (x1 === x2 && y1 === y2) throw new IconError(icon.name, g.index, "line has zero length");
      segment(g.points[0], g.points[1]);
    }
    if (g.kind === "polyline") for (let k = 1; k < g.points.length; k++) segment(g.points[k - 1], g.points[k]);
    if (g.kind === "rect") {
      const [[x1, y1], [x2, y2]] = g.points;
      segment([x1, y1], [x2, y1]); segment([x1, y2], [x2, y2]); segment([x1, y1], [x1, y2]); segment([x2, y1], [x2, y2]);
    }
  }
  // Minimum centre-to-centre gap between parallel axis-aligned strokes that overlap in
  // extent, including rectangle edges and polyline segments: at stroke 2 a gap of 3
  // leaves one unit of light. Curves are reviewed by eye.
  for (let a = 0; a < lines.length; a++)
    for (let b = a + 1; b < lines.length; b++) {
      const p = lines[a], q = lines[b];
      if (p.axis !== q.axis || p.at === q.at) continue;
      const overlap = Math.min(p.hi, q.hi) - Math.max(p.lo, q.lo);
      if (overlap > 0 && Math.abs(p.at - q.at) < spec.minGap)
        throw new IconError(icon.name, q.index, `parallel stroke ${Math.abs(p.at - q.at)} from shape ${p.index}; minimum gap is ${spec.minGap}`);
    }
}

// The tint under a filled icon: current colour at the tone token, 0.2 by default.
const tonePath = (d) => `<path fill="currentColor" stroke="none" style="opacity:var(--lino-icon-tone,.2)" d="${d}"/>`;
// Finder's SVG renderer does not reliably resolve CSS variables. Raw asset files use
// a literal opacity so their thumbnails match their intended tonal appearance.
const rawTonePath = (d) => `<path fill="currentColor" stroke="none" opacity=".2" d="${d}"/>`;
const attrs = (weight) => `xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round"`;

export function compile(sources = loadSources()) {
  const byName = new Map(sources.map((s) => [s.name, s]));
  const dupes = sources.map((s) => s.name).filter((n, i, a) => a.indexOf(n) !== i);
  if (dupes.length) throw new Error(`icons: duplicate names ${dupes.join(", ")}`);
  const report = { flagged: [], nudged: [], balance: [] };
  const icons = sources.map((icon) => {
    const geometry = resolve(icon, byName);
    validate(icon, geometry, byName);
    const groups = [];
    for (const g of geometry) {
      const d = toPath(g);
      if (g.flagged) report.flagged.push(`${icon.name}: shape ${g.index} is a raw path`);
      const last = groups.at(-1);
      if (last && last.join === g.join) last.d += d;
      else groups.push({ join: g.join, d });
    }
    for (const s of icon.shapes) if (s.nudge) report.nudged.push(`${icon.name}: nudge ${s.nudge.join(",")}`);
    const paths = groups.map((gr) => (gr.join === "round" ? `<path d="${gr.d}"/>` : `<path stroke-linejoin="${gr.join}" d="${gr.d}"/>`));
    const svg = (weight) => `<svg ${attrs(weight)} aria-hidden="true">${paths.join("")}</svg>\n`;
    // The filled twin: a tint of the union of the closed shapes under the outline, or of
    // an explicit `filled` shape list when that union is not the right reading. Icons
    // with no closed shape have no twin unless they say otherwise.
    let filled = null;
    if (icon.fill !== "none") {
      const fillGeometry = icon.filled ? resolve({ ...icon, shapes: icon.filled }, byName) : geometry;
      if (icon.filled) validate(icon, fillGeometry, byName);
      filled = fillPath(fillGeometry, toPath, spec.stroke);
      if (icon.filled && !filled) throw new IconError(icon.name, null, "filled shapes contain no closed shape");
    }
    const filledSvg = filled ? `<svg ${attrs(spec.stroke)} aria-hidden="true">${tonePath(filled)}${paths.join("")}</svg>\n` : null;
    const { file, ...meta } = icon;
    return { ...meta, fill: icon.fill ?? "auto", paths, svg, filled, filledSvg, source: meta, balance: balance(paths, spec.stroke) };
  });
  // Optical balance across the set: ink against the median, centre against 12,12.
  const inks = icons.map((i) => i.balance.ink).sort((a, b) => a - b);
  const median = inks[Math.floor(inks.length / 2)] ?? 0;
  for (const i of icons) {
    const { ink, box, boxCentre } = i.balance;
    const drift = Math.hypot(boxCentre[0] - spec.canvas / 2, boxCentre[1] - spec.canvas / 2);
    if (ink > median * spec.balance.inkFactor) report.balance.push(`${i.name}: heavy, ink ${ink} against a median of ${median}`);
    if (ink < median / spec.balance.inkFactor) report.balance.push(`${i.name}: light, ink ${ink} against a median of ${median}`);
    if (drift > spec.balance.centreDrift) report.balance.push(`${i.name}: sits ${Math.round(drift * 100) / 100} off centre (box centre ${boxCentre.join(",")})`);
    if (Math.max(...box) < spec.balance.minBox) report.balance.push(`${i.name}: small, ${box[0]} by ${box[1]} against key shapes of 18 to 20`);
  }
  return { icons, report };
}

const pascal = (n) => n.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());
const jsx = (p) => p.replace(/stroke-linejoin=/g, "strokeLinejoin=");

export function emit({ icons, report }) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.rmSync(svgDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(outlineDir, { recursive: true });
  fs.mkdirSync(filledDir, { recursive: true });
  for (const icon of icons) {
    fs.writeFileSync(path.join(outlineDir, `${icon.name}.svg`), icon.svg(spec.stroke));
    if (icon.filled) fs.writeFileSync(path.join(filledDir, `${icon.name}.svg`), `<svg ${attrs(spec.stroke)} aria-hidden="true">${rawTonePath(icon.filled)}${icon.paths.join("")}</svg>\n`);
  }

  const tsx = [
    "// Generated by build-icons.mjs from src/. Do not edit.",
    '// One named export per icon so bundlers keep only what a page uses. `Icon` looks an',
    "// icon up by name for chrome and previews; components import the named exports.",
    'import * as React from "react";',
    "",
    'export type IconSize = "xs" | "sm" | "md" | "lg" | number;',
    "export type IconWeight = 1.5 | 1.75 | 2;",
    "export type IconProps = Omit<React.SVGProps<SVGSVGElement>, \"width\" | \"height\"> & {",
    "  /** Token name or a pixel number. Default sm (16px). */",
    "  size?: IconSize;",
    "  /** Stroke width on the 24 grid. Default follows size: 2 up to 20px, 1.75 at 24px and above. */",
    "  weight?: IconWeight;",
    "  /** Accessible name. Without it the icon is decorative and hidden from assistive technology. */",
    "  label?: string;",
    "};",
    "",
    "const px: Record<string, number> = { xs: 12, sm: 16, md: 20, lg: 24 };",
    "",
    "export function Svg({ size = \"sm\", weight, label, children, ...rest }: IconProps & { children: React.ReactNode }) {",
    "  const n = typeof size === \"number\" ? size : px[size];",
    "  const dim = typeof size === \"number\" ? size : `var(--lino-icon-${size}, ${n}px)`;",
    "  const paint = { fill: \"none\", stroke: \"currentColor\", strokeWidth: weight ?? (n >= 24 ? 1.75 : 2), strokeLinecap: \"round\" as const, strokeLinejoin: \"round\" as const };",
    "  return (",
    "    <svg",
    "      xmlns=\"http://www.w3.org/2000/svg\"",
    "      width={dim}",
    "      height={dim}",
    "      viewBox=\"0 0 24 24\"",
    "      {...paint}",
    "      {...(label ? { role: \"img\" } : { \"aria-hidden\": true })}",
    "      {...rest}",
    "    >",
    "      {label ? <title>{label}</title> : null}",
    "      {children}",
    "    </svg>",
    "  );",
    "}",
    "",
    ...icons.map((i) => `export const Icon${pascal(i.name)} = (p: IconProps) => <Svg {...p}>${jsx(i.paths.join(""))}</Svg>;`),
    "",
    "// Filled twins: the enclosed shape tinted at --lino-icon-tone (0.2) under the outline.",
    "const Tone = ({ d }: { d: string }) => <path fill=\"currentColor\" stroke=\"none\" style={{ opacity: \"var(--lino-icon-tone, .2)\" }} d={d} />;",
    ...icons.filter((i) => i.filled).map((i) => `export const Icon${pascal(i.name)}Filled = (p: IconProps) => <Svg {...p}><Tone d="${i.filled}" />${jsx(i.paths.join(""))}</Svg>;`),
    "",
    "export const icons = {",
    ...icons.map((i) => `  "${i.name}": Icon${pascal(i.name)},`),
    ...icons.filter((i) => i.filled).map((i) => `  "${i.name}-filled": Icon${pascal(i.name)}Filled,`),
    "} as const;",
    "",
    "export type IconName = keyof typeof icons;",
    "export const iconNames = Object.keys(icons) as IconName[];",
    "",
    "/** Name-driven lookup for chrome and previews. Components import the named exports instead. */",
    "export function Icon({ name, ...props }: IconProps & { name: IconName }) {",
    "  const C = icons[name];",
    "  return <C {...props} />;",
    "}",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "icons.tsx"), tsx);

  const sprite = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${icons
    .map((i) => `<symbol id="${i.name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${i.paths.join("")}</symbol>` + (i.filled ? `<symbol id="${i.name}-filled" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${tonePath(i.filled)}${i.paths.join("")}</symbol>` : ""))
    .join("")}</svg>\n`;
  fs.writeFileSync(path.join(outDir, "sprite.svg"), sprite);

  const catalog = {
    spec,
    count: icons.length,
    icons: icons.map((i) => ({
      name: i.name,
      title: i.title,
      categories: i.categories,
      keywords: i.keywords,
      filled: !!i.filled,
      export: `Icon${pascal(i.name)}`,
      files: { svg: `svg/outline/${i.name}.svg`, ...(i.filled ? { filledSvg: `svg/filled/${i.name}.svg` } : {}), source: `src/${i.name}.icon.json` },
      source: i.source,
    })),
  };
  fs.writeFileSync(path.join(outDir, "icons.json"), JSON.stringify(catalog, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, "icons.md"), rules(icons));
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, "index.html"), previewPage(icons));
  return catalog;
}

// A plain contact sheet for checking the set before publishing:
// every icon at 16, 20, and 24 in light and dark, with a size and weight control.
function previewPage(icons) {
  const at = (i, px, w) => i.svg(w ?? (px >= 24 ? 1.75 : 2)).replace(/width="24" height="24"/, `width="${px}" height="${px}"`).trim();
  const cell = (i) => `<figure><div class="row">${[16, 20, 24].map((px) => at(i, px)).join("")}</div><figcaption>${i.name}</figcaption></figure>`;
  return `<!doctype html><meta charset="utf-8"><title>Icons preview</title>
<style>
body{margin:0;font:13px/1.4 system-ui,sans-serif;color:#1a1a1a;background:#fff}
main{padding:24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:24px}
figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:8px}
.row{display:flex;gap:12px;align-items:flex-end;height:28px}
figcaption{color:#666}
.dark{background:#111;color:#f2f2f2}.dark figcaption{color:#aaa}
header{padding:16px 24px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
label{display:flex;gap:6px;align-items:center}
.strip{padding:16px 24px;display:flex;gap:16px;flex-wrap:wrap}
svg{stroke-width:var(--w,2)}
</style>
<header><strong>${icons.length} icons</strong>
<label>weight <select id="w"><option>1.5</option><option>1.75</option><option selected>2</option></select></label>
<label>size <select id="s"><option>16</option><option>20</option><option selected>24</option></select></label>
<label><input type="checkbox" id="grid"> pixel grid at 24</label></header>
<main>${icons.map(cell).join("")}</main>
<div class="dark"><main>${icons.map(cell).join("")}</main></div>
<div class="strip" id="strip">${icons.map((i) => at(i, 24)).join("")}</div>
<div class="strip dark">${icons.map((i) => at(i, 24)).join("")}</div>
<script>
const strip=document.getElementById("strip"),w=document.getElementById("w"),s=document.getElementById("s"),g=document.getElementById("grid");
const apply=()=>{document.body.style.setProperty("--w",w.value);for(const el of document.querySelectorAll(".strip svg")){el.setAttribute("width",s.value);el.setAttribute("height",s.value);el.style.background=g.checked&&s.value==="24"?"repeating-linear-gradient(90deg,#0001 0 1px,transparent 1px 100%) 0 0/24px 24px, repeating-linear-gradient(0deg,#0001 0 1px,transparent 1px 100%) 0 0/24px 24px":""}};
for(const el of [w,s,g])el.addEventListener("input",apply);
</script>`;
}

// Embed the maintained authoring guide instead of keeping a second prose template.
// Repo-relative links become readable source paths in the standalone/npm document.
export function drawingGuide() {
  return fs.readFileSync(path.join(root, "docs", "spec.md"), "utf8")
    .replace(/^## /gm, "### ")
    .replace(/^# .+$/m, "## Drawing a new icon")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (link, label, target) => {
      if (/^(?:[a-z]+:|#|\/)/i.test(target)) return link;
      const source = path.posix.normalize(path.posix.join("system/icons", target));
      return `${label} (\`${source}\`)`;
    }).trim();
}

function rules(icons) {
  const byCat = spec.categories.map((c) => [c, icons.filter((i) => i.categories.includes(c)).map((i) => i.name)]).filter(([, n]) => n.length);
  return `# Icons

${icons.length} outline icons on a 24 grid, stroke ${spec.stroke}, round caps and joins. Every icon is
generated from a source file in a small drawing language. The compiler enforces the
construction contract; the authoring guide also describes optical decisions to review.

## Use

Import the icon you need by name. Each is its own export, so a bundler keeps only the
icons a page uses.

Install it first:

\`\`\`sh
npm install lino-icons
\`\`\`

Use \`pnpm add lino-icons\` or \`yarn add lino-icons\` when appropriate. The package has
TypeScript types and supports React 18 or later.

\`\`\`tsx
import { IconCheck, IconChevronDown } from "lino-icons";

<IconCheck />                       // 16px, decorative, hidden from assistive technology
<IconCheck size="md" />             // 20px; sizes: xs 12, sm 16, md 20, lg 24, or a number
<IconCheck label="Completed" />     // announced; renders role="img" with a title
<IconChevronDown weight={1.5} />    // stroke 1.5; default is 2 up to 20px and 1.75 at 24px
\`\`\`

Sizes map to the \`--lino-icon-*\` tokens when they are present and fall back to pixels.
Width and height are always set, so an icon never shifts layout while it loads.

- An icon beside a text label is decorative: leave \`label\` off.
- An icon that stands alone (an icon-only button, a status glyph) needs a \`label\`, or
  the control that contains it needs an \`aria-label\`. Never both.
- Do not scale with CSS; pick a size. Do not animate an icon; animate a wrapper, and
  respect \`prefers-reduced-motion\`.
- Colour comes from \`currentColor\`. Set colour on the parent text, not on the icon.

## Getting the set

The npm package includes React components, raw SVG files, a sprite, and a searchable
catalog. Use the SVG files or sprite in any stack; they do not need React.

## Without React

Outline SVG files live at \`lino-icons/svg/outline/<name>.svg\`. The sprite at
\`lino-icons/sprite.svg\` exposes every icon as a symbol for
\`<use href="sprite.svg#check">\`; it is a second request and does not cross origins,
so prefer inline SVG when you can.

The catalog at \`lino-icons/icons.json\` lists every icon with keywords,
categories, and file URLs. Search it before drawing a new icon.

## Filled twins

Icons with a closed shape also ship a filled form: \`IconCircleCheckFilled\`,
\`svg/filled/circle-check.svg\`, sprite id \`circle-check-filled\`. It is tonal: the
enclosed shape is tinted with the current colour at \`--lino-icon-tone\` (0.2 by default)
under the same outline, so the drawing stays legible and the icon reads as active or
selected. Set the token on a container to tune the tint; keep it under 0.35 so the
outline stays the figure. Icons made only of open strokes (arrows, chevrons, check)
have no filled form. A source can set \`"fill": "none"\` to opt out, or give a
\`"filled"\` shape list whose closed shapes define the tint when the union is not the
right reading.

## Names

kebab-case, object first then modifier: \`file-text\`, \`arrow-up-right\`, \`circle-check\`.
No sizes in names. Filled twins, when present, end in \`-filled\`.

${byCat.map(([c, names]) => `- ${c}: ${names.join(", ")}`).join("\n")}

${drawingGuide()}

## Compiler contract

This JSON comes directly from the compiler's \`spec\` export. It describes numeric
validation and defaults; the optical recommendations above still require review.

\`\`\`json
${JSON.stringify(spec, null, 2)}
\`\`\`

`;
}

if (process.argv[1] === new URL(import.meta.url).pathname && process.argv[2] === "--check") {
  // Validate one source against the whole set without writing anything, and print its SVG.
  const file = process.argv[3];
  if (!file) { console.error("usage: node .dev/scripts/build-icons.mjs --check <file.icon.json>"); process.exit(2); }
  const icon = { ...JSON.parse(fs.readFileSync(file, "utf8")), file: path.basename(file) };
  const others = loadSources().filter((s) => s.name !== icon.name);
  try {
    const { icons } = compile([...others, icon]);
    process.stdout.write(icons.find((i) => i.name === icon.name).svg(spec.stroke));
    console.error(`${icon.name}: ok`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
} else if (process.argv[1] === new URL(import.meta.url).pathname) {
  const compiled = compile();
  const catalog = emit(compiled);
  for (const line of [...compiled.report.flagged, ...compiled.report.nudged, ...compiled.report.balance]) console.log(`icons: note: ${line}`);
  console.log(`icons: ${catalog.count} icon(s) written to dist`);
}

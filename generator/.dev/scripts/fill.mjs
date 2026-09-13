// Filled forms by union. The filled form is tonal: the closed shapes of an icon are
// united into one solid that sits under the outline as a tint of the current colour,
// so the drawing stays legible and the shape reads as active. `fillPath` builds that
// solid.
//
// Closed regions come straight from the outline path data. Open strokes become
// regions of their own: a line is a capsule, an arc an annular sector with round
// ends, and anything else is flattened and covered with capsules. paper.js does the
// boolean work headless; only its SVG exporter needs a DOM, so path data is read
// from `pathData`.
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const paper = require("paper/dist/paper-core.js");
paper.setup(new paper.Size(24, 24));

const closedKinds = new Set(["circle", "ellipse", "rect"]);
const isClosed = (g) => closedKinds.has(g.kind) || (g.kind === "polyline" && g.close);

function capsule([x1, y1], [x2, y2], h) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const cap = new paper.Path.Rectangle({ rectangle: new paper.Rectangle(-h, -h, len + 2 * h, 2 * h), radius: h });
  cap.rotate((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI, new paper.Point(0, 0));
  cap.translate(new paper.Point(x1, y1));
  return cap;
}

function unite(regions) {
  let out = null;
  for (const r of regions) out = out ? out.unite(r, { insert: false }) : r;
  return out;
}

// Cover an open path with capsules along its flattened segments.
function coverPath(d, h) {
  const p = new paper.CompoundPath(d);
  const regions = [];
  for (const child of p.children.length ? p.children : [p]) {
    child.flatten(0.02);
    const pts = child.segments.map((s) => [s.point.x, s.point.y]);
    for (let i = 1; i < pts.length; i++) regions.push(capsule(pts[i - 1], pts[i], h));
    if (pts.length === 1) regions.push(new paper.Path.Circle({ center: pts[0], radius: h }));
  }
  return unite(regions);
}

function region(g, d, h) {
  if (isClosed(g)) return new paper.CompoundPath(d);
  switch (g.kind) {
    case "line":
      return capsule(g.points[0], g.points[1], h);
    case "dot":
      return new paper.Path.Circle({ center: g.points[0], radius: h * 1.25 });
    case "circle": {
      const [cx, cy] = g.points[0], r = g.r * (g.scale ?? 1);
      return new paper.Path.Circle({ center: [cx, cy], radius: r + h }).subtract(new paper.Path.Circle({ center: [cx, cy], radius: r - h }), { insert: false });
    }
    default:
      return coverPath(d, h);
  }
}

const round = (d) => d.replace(/-?\d+\.\d+/g, (n) => (Math.round(Number(n) * 100) / 100).toString());

/** The union of an icon's closed shapes as one solid, or null when nothing is closed. */
export function fillPath(geometry, pathOf, stroke) {
  const h = stroke / 2;
  const closed = geometry.filter(isClosed);
  if (!closed.length) return null;
  const solid = unite(closed.map((g) => region(g, pathOf(g), h)));
  const d = round(solid.pathData);
  paper.project.clear();
  return d;
}

/** Ink (stroke length times width) and the ink-weighted centre of an outline. */
export function balance(paths, stroke) {
  const p = new paper.CompoundPath(paths.map((s) => s.match(/ d="([^"]+)"/)[1]).join(""));
  const items = p.children.length ? p.children : [p];
  let length = 0, sx = 0, sy = 0;
  for (const c of items) {
    const n = Math.max(2, Math.ceil(c.length / 0.25));
    for (let i = 0; i <= n; i++) {
      const pt = c.getPointAt((c.length * i) / n);
      if (!pt) continue;
      sx += pt.x; sy += pt.y; length += 1;
    }
  }
  const ink = items.reduce((a, c) => a + c.length, 0) * stroke;
  const b = p.bounds;
  paper.project.clear();
  return {
    ink: Math.round(ink * 10) / 10,
    centre: [Math.round((sx / length) * 100) / 100, Math.round((sy / length) * 100) / 100],
    box: [Math.round(b.width * 100) / 100 + stroke, Math.round(b.height * 100) / 100 + stroke],
    boxCentre: [Math.round(b.center.x * 100) / 100, Math.round(b.center.y * 100) / 100],
  };
}

// Renders icons to a PNG so they can be judged before they ship. Drawing an icon that
// passes every rule and still reads wrong is the normal case, so looking at the result
// is part of the loop, not a final check.
//
//   node .dev/scripts/preview.mjs                 the whole set: light, dark, filled, in a control
//   node .dev/scripts/preview.mjs tool eye         those icons large and at 16, with their balance notes
//   node .dev/scripts/preview.mjs --grid tool      the same, over the 24 grid
//
//   node .dev/scripts/preview.mjs tool eye --matrix  all sizes, weights, themes and forms
//   node .dev/scripts/preview.mjs tool --matrix --html-only  browser-tool friendly page
// Compiles current sources directly; writes dist/preview.html and optionally PNG.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { compile, emit, root, spec } from "./build-icons.mjs";

const out = path.join(root, "dist");
const at = (svg, px, weight) =>
  svg.replace(/width="24" height="24"/, `width="${px}" height="${px}"`).replace(/stroke-width="[\d.]+"/, `stroke-width="${weight ?? (px >= 24 ? 1.75 : 2)}"`);

const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const page = (body) => `<!doctype html><meta charset="utf-8">
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 32px; font: 12px/1.4 system-ui, sans-serif; color: #1a1a1a; background: #fff; transition: background .15s, color .15s; }
  .catalog { max-width: 1600px; margin: 0 auto; }
  header { margin-bottom: 28px; display: flex; gap: 24px; align-items: end; justify-content: space-between; }
  h1 { margin: 0; font-size: 24px; letter-spacing: -.03em; }
  .tools { display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
  .toggle { display: inline-flex; padding: 3px; gap: 2px; border: 1px solid #d5d5d5; border-radius: 8px; background: #f7f7f7; }
  button { appearance: none; border: 0; border-radius: 5px; padding: 5px 8px; color: #666; background: transparent; font: inherit; cursor: pointer; }
  button[aria-pressed="true"] { color: #111; background: #fff; box-shadow: 0 1px 2px #0002; }
  input { box-sizing: border-box; width: 180px; padding: 8px 10px; border: 1px solid #bbb; border-radius: 7px; background: #fff; color: inherit; font: inherit; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 22px 10px; }
  figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .sample { display: none; align-items: center; justify-content: center; height: 32px; }
  body[data-size="16"][data-form="outline"] .sample[data-size="16"][data-form="outline"],
  body[data-size="20"][data-form="outline"] .sample[data-size="20"][data-form="outline"],
  body[data-size="24"][data-form="outline"] .sample[data-size="24"][data-form="outline"],
  body[data-size="32"][data-form="outline"] .sample[data-size="32"][data-form="outline"],
  body[data-size="16"][data-form="filled"] .sample[data-size="16"][data-form="filled"],
  body[data-size="20"][data-form="filled"] .sample[data-size="20"][data-form="filled"],
  body[data-size="24"][data-form="filled"] .sample[data-size="24"][data-form="filled"],
  body[data-size="32"][data-form="filled"] .sample[data-size="32"][data-form="filled"] { display: flex; }
  figcaption { color: #888; font-size: 11px; text-align: center; }
  body[data-form="filled"] figure:not([data-filled="true"]) { display: none; }
  body.theme-dark { color: #f2f2f2; background: #111; color-scheme: dark; }
  body.theme-dark figcaption { color: #aaa; }
  body.theme-dark .toggle { border-color: #444; background: #1d1d1d; }
  body.theme-dark button { color: #aaa; }
  body.theme-dark button[aria-pressed="true"] { color: #fff; background: #333; box-shadow: none; }
  body.theme-dark input { border-color: #555; background: #222; color: #fff; }
  @media (max-width: 760px) { body { padding: 20px; } header { align-items: start; flex-direction: column; } .tools { justify-content: start; } }
  .dark { background: #111; color: #f2f2f2; border-radius: 10px; padding: 20px; }
  .dark figcaption { color: #999; }
  .strip { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; }
  .ctl { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px;
         border: 1px solid #d8d8d8; border-radius: 8px; font-size: 14px; background: #fff; }
  .note { color: #a15c00; font-size: 11px; }
  .big svg { background: var(--bg, none); }
  .matrix { padding: 16px; margin-bottom: 24px; }
  .matrix-card { padding: 12px 0 20px; border-bottom: 1px solid #8885; }
  .matrix-weights { display: flex; gap: 24px; flex-wrap: wrap; }
  .matrix-weight { min-width: 260px; }
  .matrix-samples { display: flex; align-items: center; gap: 18px; margin: 8px 0; }
  .matrix-samples figure { gap: 4px; min-width: 40px; }
  .matrix-control { display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid #888; border-radius: 6px; box-sizing: border-box; }
  .matrix-context { display: flex; gap: 12px; align-items: center; margin-top: 12px; }
  .dark h2, .dark h3, .dark figcaption { color: #ddd; }
</style>${body}`;

const gridBg = `--bg: repeating-linear-gradient(90deg,#0000000d 0 1px,transparent 1px 4px), repeating-linear-gradient(0deg,#0000000d 0 1px,transparent 1px 4px)`;

function setSheet(icons) {
  const sizes = [16, 20, 24, 32];
  const cell = (i) => `<figure data-icon="${i.name}" data-filled="${Boolean(i.filledSvg)}">
    ${sizes.map((px) => `<span class="sample" data-size="${px}" data-form="outline">${at(i.svg(2), px)}</span>`).join("")}
    ${i.filledSvg ? sizes.map((px) => `<span class="sample" data-size="${px}" data-form="filled">${at(i.filledSvg, px)}</span>`).join("") : ""}
    <figcaption>${i.name}</figcaption>
  </figure>`;
  const toggle = (kind, values, selected) => `<div class="toggle">${values.map(([value, label]) => `<button type="button" data-toggle="${kind}" data-value="${value}" aria-pressed="${value === selected}">${label}</button>`).join("")}</div>`;
  return page(`<body data-size="24" data-theme="light" data-form="outline">
    <main class="catalog">
      <header><h1>Lino Icons</h1>
        <div class="tools">${toggle("size", sizes.map((size) => [size, `${size}px`]), 24)}${toggle("theme", [["light", "Light"], ["dark", "Dark"]], "light")}${toggle("form", [["outline", "Outline"], ["filled", "Filled"]], "outline")}<input id="search" type="search" placeholder="Filter by name" autofocus></div>
      </header>
      <div class="grid" id="icons">${icons.map(cell).join("")}</div>
    </main>
    <script>
      const search=document.getElementById("search"),cards=[...document.querySelectorAll("#icons [data-icon]")];
      const apply=()=>{const q=search.value.trim().toLowerCase(),form=document.body.dataset.form;for(const card of cards)card.hidden=!(card.dataset.icon.includes(q)&&(form!=="filled"||card.dataset.filled==="true"));};
      for(const button of document.querySelectorAll("[data-toggle]"))button.addEventListener("click",()=>{const kind=button.dataset.toggle;document.body.dataset[kind]=button.dataset.value;if(kind==="theme")document.body.classList.toggle("theme-dark",button.dataset.value==="dark");for(const peer of document.querySelectorAll('[data-toggle="'+kind+'"]'))peer.setAttribute("aria-pressed",String(peer===button));apply()});
      search.addEventListener("input",apply);
    </script>
  </body>`);
}

function zoomSheet(icons, notes, showGrid) {
  const cell = (i) => {
    const mine = notes.filter((n) => n.startsWith(`${i.name}:`)).map((n) => n.slice(i.name.length + 2));
    return `<figure class="big" ${showGrid ? `style="${gridBg}"` : ""}>
      <div class="row" style="align-items:flex-end;gap:16px">${at(i.svg(2), 96)}${at(i.svg(2), 24)}${at(i.svg(2), 16)}</div>
      ${i.filledSvg ? `<div class="row">${at(i.filledSvg, 48)}${at(i.filledSvg, 16)}</div>` : ""}
      <figcaption>${i.name}${mine.length ? `<br><span class="note">${mine.join("<br>")}</span>` : ""}</figcaption>
    </figure>`;
  };
  return page(`<body><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:28px;align-items:start">${icons.map(cell).join("")}</div></body>`);
}

// Same geometry at every supported weight; explicit weights avoid size defaults
// hiding a density problem. Open icons never acquire a pretend filled specimen.
export function matrixSheet(icons) {
  const sizes = [16, 20, 24, 32];
  const samples = (i, weight, form) => `<div class="matrix-samples" data-form="${form}">${sizes.map((size) =>
    `<figure data-size="${size}">${at(form === "filled" ? i.filledSvg : i.svg(weight), size, weight)}<figcaption>${size}</figcaption></figure>`
  ).join("")}</div>`;
  return page(`<body>${["light", "dark"].map((theme) => `<section class="matrix ${theme}" data-theme="${theme}">
    <h2>${theme}: 16, 20, 24, 32px · outline and available tonal forms</h2>
    ${icons.map((i) => `<article class="matrix-card" data-icon="${i.name}"><h3>${escape(i.name)}</h3>
      <div class="matrix-weights">${spec.weights.map((weight) => `<div class="matrix-weight" data-weight="${weight}">
        <div>Stroke ${weight}</div>${samples(i, weight, "outline")}${i.filledSvg ? samples(i, weight, "filled") : "<p>No filled form</p>"}
      </div>`).join("")}</div>
      <div class="matrix-context">${[32, 36].map((size) => `<span class="matrix-control" style="width:${size}px;height:${size}px">${at(i.svg(2), size === 32 ? 16 : 20, 2)}</span>`).join("")}
        <span class="matrix-context" style="margin:0">${at(i.svg(2), 16, 2)} ${escape(i.title)}</span>
      </div>
    </article>`).join("")}</section>`).join("")}</body>`);
}

export async function preview(names = [], { showGrid = false, matrix = false, htmlOnly = false, open = false } = {}) {
  const compiled = compile();
  emit(compiled);
  const { icons, report } = compiled;
  const chosen = names.length ? names.map((n) => icons.find((i) => i.name === n)) : icons;
  const missing = names.filter((n, k) => !chosen[k]);
  if (missing.length) throw new Error(`icons: no such icon: ${missing.join(", ")}`);
  if (matrix && showGrid) throw new Error("icons: use --grid for enlarged joins or --matrix for actual-size review, separately");
  const html = matrix ? matrixSheet(chosen) : names.length ? zoomSheet(chosen, report.balance, showGrid) : setSheet(chosen);
  fs.mkdirSync(out, { recursive: true });
  const htmlPath = path.join(out, "preview.html");
  fs.writeFileSync(htmlPath, html);
  if (open) openPreview(htmlPath);
  if (htmlOnly) return { html: htmlPath, png: null, count: chosen.length, notes: report.balance };

  const { chromium } = createRequire(import.meta.url)("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const width = matrix ? 1080 : names.length ? Math.min(1080, 270 * Math.max(1, chosen.length)) : 1080;
    const p = await browser.newPage({ viewport: { width, height: 200 }, deviceScaleFactor: matrix ? 1 : 2 });
    await p.goto(pathToFileURL(htmlPath).href);
    await p.screenshot({ path: path.join(out, "preview.png"), fullPage: true });
    return { html: htmlPath, png: path.join(out, "preview.png"), count: chosen.length, notes: report.balance };
  } finally {
    await browser.close();
  }
}

function openPreview(file) {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", file] : [file];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => a.startsWith("--") && !["--grid", "--matrix", "--html-only"].includes(a));
  if (unknown.length) throw new Error(`icons: unknown option ${unknown.join(", ")}`);
  const { html, png, count, notes } = await preview(args.filter((a) => !a.startsWith("--")), {
    showGrid: args.includes("--grid"), matrix: args.includes("--matrix"), htmlOnly: args.includes("--html-only"),
    open: !args.includes("--html-only"),
  });
  const shown = args.filter((a) => !a.startsWith("--"));
  for (const n of notes.filter((n) => !shown.length || shown.some((s) => n.startsWith(`${s}:`)))) console.log(`icons: note: ${n}`);
  console.log(`icons: ${count} icon(s) rendered to ${path.relative(process.cwd(), png ?? html)} (canvas ${spec.canvas}, stroke ${spec.stroke})`);
}

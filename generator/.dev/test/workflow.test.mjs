import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { compile, drawingGuide, root, spec } from "../scripts/build-icons.mjs";
import { matrixSheet } from "../scripts/preview.mjs";

test("authoring guide and compiler contract reach every instruction export", () => {
  const instructions = fs.readFileSync(path.join(root, "dist/icons.md"), "utf8");
  assert.ok(instructions.includes(drawingGuide()), "complete current authoring guide is embedded");
  assert.ok(instructions.includes(JSON.stringify(spec, null, 2)), "numeric contract comes from compiler");
  for (const file of ["dist/package/README.md"]) {
    assert.equal(fs.readFileSync(path.join(root, file), "utf8"), instructions, `${file}: current instructions`);
  }
});

test("review matrix covers all sizes, weights, themes and only available forms", () => {
  const { icons } = compile();
  const closed = icons.find((i) => i.name === "clipboard");
  const open = icons.find((i) => i.name === "check");
  const html = matrixSheet([{ ...closed, title: "<img src=x onerror=alert(1)>" }, open]);
  assert.ok(!html.includes("<img"), "source titles render as text");
  assert.ok(html.includes("&lt;img"));
  assert.equal((html.match(/data-theme=/g) ?? []).length, 2);
  for (const theme of ["light", "dark"]) {
    const section = html.split(`data-theme="${theme}"`)[1].split("</section>")[0];
    for (const [name, forms] of [["clipboard", 2], ["check", 1]]) {
      const article = section.split(`data-icon="${name}"`)[1].split("</article>")[0];
      for (const weight of spec.weights) {
        const column = article.split(`data-weight="${weight}"`)[1].split('<div class="matrix-weight"')[0].split('<div class="matrix-context"')[0];
        for (const size of [16, 20, 24, 32]) assert.equal((column.match(new RegExp(`data-size="${size}"`, "g")) ?? []).length, forms);
        assert.equal((column.match(new RegExp(`stroke-width="${weight}"`, "g")) ?? []).length, forms * 4);
      }
      assert.ok(article.includes("width:32px;height:32px") && article.includes("width:36px;height:36px"));
    }
  }
});

test("single-file validation rejects a filename that the full build would reject", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lino-icon-check-"));
  try {
    const source = fs.readFileSync(path.join(root, "src/check.icon.json"));
    const good = path.join(dir, "check.icon.json"), bad = path.join(dir, "wrong.icon.json");
    fs.writeFileSync(good, source); fs.writeFileSync(bad, source);
    const run = (file) => spawnSync(process.execPath, [path.join(root, ".dev", "scripts", "build-icons.mjs"), "--check", file], { encoding: "utf8" });
    assert.equal(run(good).status, 0);
    const rejected = run(bad);
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /does not match name/);
    assert.equal(rejected.stdout, "");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

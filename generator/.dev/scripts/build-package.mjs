// Builds the publishable npm package from the same generated set, so the three routes
// to an icon (npm, copied file, raw SVG) never drift. Emits ESM plus type
// declarations compiled from dist/icons.tsx, the raw SVGs, the sprite, and the
// catalog. Run `pnpm build:package` to compile and package the set from .dev/scripts/.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { compile, emit, projectRoot, root } from "./build-icons.mjs";

const version = process.env.LINO_ICONS_VERSION ?? "0.1.0";
const out = path.join(root, "dist", "package");
const dist = path.join(root, "dist");

export function buildPackage({ quiet = false } = {}) {
  const { icons } = compile();
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, "src"), { recursive: true });

  // The set source, with the site's path alias resolved away: the package is standalone.
  fs.copyFileSync(path.join(dist, "icons.tsx"), path.join(out, "src", "index.tsx"));
  fs.cpSync(path.join(projectRoot, "svg"), path.join(out, "svg"), { recursive: true });
  for (const f of ["sprite.svg", "icons.json"]) fs.copyFileSync(path.join(dist, f), path.join(out, f));
  fs.copyFileSync(path.join(projectRoot, "LICENSE"), path.join(out, "LICENSE"));
  fs.writeFileSync(path.join(out, "README.md"), fs.readFileSync(path.join(dist, "icons.md"), "utf8"));

  fs.writeFileSync(
    path.join(out, "package.json"),
    JSON.stringify(
      {
        name: "lino-icons",
        version,
        description: `${icons.length} outline icons on a 24 grid, generated from a drawing language so every icon shares one weight, one corner treatment, and one arrow.`,
        keywords: ["icons", "svg", "react", "outline", "design-system", "agent-ux"],
        homepage: "https://linoicons.com",
        license: "MIT",
        author: "Lino Icons contributors",
        type: "module",
        // One named export per icon and no side effects, so a bundler keeps only what
        // a page uses.
        sideEffects: false,
        main: "./index.js",
        module: "./index.js",
        types: "./index.d.ts",
        exports: {
          ".": { types: "./index.d.ts", default: "./index.js" },
          "./sprite.svg": "./sprite.svg",
          "./icons.json": "./icons.json",
          "./svg/*": "./svg/*",
          "./package.json": "./package.json",
        },
        files: ["index.js", "index.d.ts", "svg", "sprite.svg", "icons.json", "README.md", "LICENSE"],
        peerDependencies: { react: ">=18" },
      },
      null,
      2,
    ) + "\n",
  );

  // Compile with the repo's own TypeScript.
  const tsc = path.join(root, "node_modules", ".bin", "tsc");
  execFileSync(
    tsc,
    [
      path.join(out, "src", "index.tsx"),
      "--outDir", out,
      "--declaration",
      "--target", "es2022",
      "--module", "esnext",
      "--moduleResolution", "bundler",
      "--jsx", "react-jsx",
      "--strict",
      "--skipLibCheck",
      "--types", "react",
    ],
    { stdio: "pipe", cwd: root },
  );
  fs.rmSync(path.join(out, "src"), { recursive: true, force: true });

  const exported = (fs.readFileSync(path.join(out, "index.d.ts"), "utf8").match(/declare const Icon\w+/g) ?? []).length;
  if (!quiet) console.log(`icons: package lino-icons ${version} with ${exported} exports written to dist/package`);
  return { out, version, exported, count: icons.length };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  emit(compile());
  buildPackage();
}

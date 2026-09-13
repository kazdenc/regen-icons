---
name: regen-icons
description: Create or refine Regen Icons with its JSON drawing language and SVG compiler, matching the existing family. Use for additions, geometry edits, and icon-generation workflow work in the Regen Icons repository.
---

# Regen Icons

Locate the repository root containing `.dev/scripts/build-icons.mjs` and
`docs/spec.md` from the current checkout. If invoked elsewhere, use the
repository location supplied by the user; do not create a substitute icon system.
Commands below run from the repository root.

Read `docs/spec.md` before drawing. It is the canonical authoring and visual-review
guide; the compiler embeds it in exported `icons.md` and the package README.
Read the `spec` export in `.dev/scripts/build-icons.mjs` when changing validation or numeric
defaults. The guide distinguishes enforced construction rules from optical advice.
Keep style lessons there instead of copying them into this skill or generated files.

Search `src/` for an existing name or keyword. After building, `dist/icons.json` also
provides a compiled catalog for keyword and category search.
Choose a nearby construction from the guide's reference table and inspect its JSON
and rendered appearance. Reuse an existing icon when it already satisfies the task.
Write or edit canonical `src/<name>.icon.json`; preserve names and metadata
when refining. Do not hand-edit generated SVG/React files or import another icon
library's paths into this family.

Validate one source with `node .dev/scripts/build-icons.mjs --check src/<name>.icon.json`.
Then compare it with named neighbours using:

```sh
node .dev/scripts/preview.mjs <name> <neighbour> --matrix --html-only
```

Open `dist/preview.html` with the available browser tool and inspect actual
sizes in both themes, all weights and available forms, controls and text rows.
Omit `--html-only` for the script's Playwright PNG renderer. Use `--grid` separately
for enlarged join inspection. A generated screenshot is not a review: look at it.
For refinements, keep a baseline outside the generated output directory, which the
build replaces. Retain a trial only when the comparison supports it; record visual
limits when browser review is unavailable. Balance notes alone do not justify edits.

After accepting geometry, run `pnpm test` from the repository root; the test
command rebuilds the package and checks the authoring/export workflow. Keep publication and deployment within the user's
requested scope. A successful build is implementation evidence, not recognition
research or customer validation.

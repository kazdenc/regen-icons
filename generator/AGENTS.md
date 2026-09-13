# Lino Icons agent guide

Lino Icons is a source-first icon library. The canonical drawings are
`src/<name>.icon.json`; never edit generated files in `dist/` or `../svg/`.

Before changing icon geometry, read [docs/spec.md](docs/spec.md). It defines the drawing language,
the visual system, and the review standard. Search `src/` for an existing icon before
adding one, then use [dist/icons.json](dist/icons.json) after a build when keyword or
category search is useful.

Work in this order:

1. Edit one source file with valid name, title, categories, and keywords.
2. Run `pnpm check src/<name>.icon.json`.
3. Compare it with related icons using `pnpm preview <name> <neighbour> --matrix`.
4. Run `pnpm test` after accepting the visual result.

Keep geometry on the prescribed grid and reuse established constructions where they fit.
Validation proves the construction is valid; visual review decides whether it belongs in
the family. Do not copy paths from another icon library.

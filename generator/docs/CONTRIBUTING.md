# Contributing

Thanks for helping improve Lino Icons. Contributions can add an icon, refine an
existing drawing, improve documentation, or fix the generator.

## Before you start

Search the catalog and source files first. An existing icon with different keywords
often solves the request without expanding the set. Read [the drawing guide](spec.md) before
changing icon geometry; it defines the drawing language, visual conventions, and
review process.

## Development workflow

1. Fork the repository and create a focused branch.
2. Install dependencies with `pnpm install`.
3. Change the canonical source in `src/`; do not edit generated files in `dist/` or `../svg/`.
4. Validate an icon with `pnpm check src/<name>.icon.json`.
5. Review it beside related icons with `pnpm preview <name> <neighbour> --matrix`.
6. Run `pnpm test` before opening a pull request.

Keep one visual idea per pull request. For an icon addition or geometry change, include
the icon name, the neighbouring icons used for comparison, and a preview image or a
brief note describing the visual review. Add useful search keywords and use the
existing category names.

## Pull requests

Explain the user-facing change, keep generated output out of the diff, and make sure
all checks pass. Maintainers review construction rules, optical consistency at small
sizes, metadata, and the public API before merging.

By contributing, you agree that your work is licensed under this repository's
[MIT License](../../LICENSE).

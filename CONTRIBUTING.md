# Contributing to Regen Icons

Regen Icons is a source-first icon library. The JSON drawings in `generator/src/` are canonical; SVGs, React components, the sprite, and the catalog are generated from them.

## Quick start

```sh
git clone https://github.com/kazdenc/regen-icons.git
cd regen-icons/generator
pnpm install
```

Before adding an icon, search `src/` and the gallery for an existing drawing that already covers the need. Read the [drawing guide](generator/docs/spec.md) before changing geometry.

## Add or refine an icon

1. Create or edit `src/<name>.icon.json` using a kebab-case name, useful keywords, and existing categories.
2. Validate it:

   ```sh
   pnpm check src/<name>.icon.json
   ```

3. Compare it beside related icons at actual sizes:

   ```sh
   pnpm preview <name> <neighbour> --matrix
   ```

4. Run the full check:

   ```sh
   pnpm test
   ```

5. Commit the source file and the regenerated SVGs in `../svg/`. Do not hand-edit `../svg/` or anything in `dist/`; `dist/` stays out of pull requests.

## Open a pull request

Fork the repository, create a focused branch, and open one pull request for one visual idea. Explain the user-facing change, name the icons you compared it with, and describe the visual review or include a preview image. The pull-request check runs the test suite automatically.

For detailed construction rules and the review standard, read the [full contribution guide](generator/docs/CONTRIBUTING.md). By contributing, you agree to license your work under the repository MIT License.

# Regen Icons

Regen Icons is a set of 225 MIT-licensed outline icons for agent-built interfaces. They share a 24px grid, rounded caps and joins, and a consistent two-pixel stroke.

## npm package

The package build is ready for a future npm release. Until it is published, use the
ready-to-use files in [`../svg/`](../svg/) or work from this repository.

```sh
npm install regen-icons
```

After release, the package will support React 18 or later and include TypeScript
types. Use the equivalent `pnpm add regen-icons` or `yarn add regen-icons` command if
that is your package manager.

## Use with React

Import the icon by name. Each icon is a separate export, so modern bundlers only
include the icons your application uses.

```tsx
import { IconCheck, IconChevronDown } from "regen-icons";

// Decorative beside visible text. It is hidden from assistive technology.
<IconCheck />

// Named icon: use this when the icon itself communicates meaning.
<IconCheck label="Completed" />

// Sizes: xs 12, sm 16 (default), md 20, lg 24, or a pixel number.
<IconChevronDown size="md" weight={1.5} />
```

Icons use `currentColor`, so set their colour on the icon or a parent. Named sizes
use `--regen-icon-xs`, `--regen-icon-sm`, `--regen-icon-md`, and `--regen-icon-lg`
when defined; otherwise they fall back to the pixel sizes above. Closed icons may
also have a tonal filled variant, such as `IconCircleCheckFilled`.

For an icon-only button, give either the icon a `label` or the button an
`aria-label`; do not supply both.

## Use without React

The package also includes raw SVG files, a sprite, and a searchable catalog:

```html
<!-- Copy the package's SVG directory to /assets/icons during your build. -->
<img src="/assets/icons/check.svg" alt="Completed">

<svg aria-hidden="true"><use href="/assets/icons/sprite.svg#check" /></svg>
```

Your build tool should copy those assets to a public location. The catalog at
`regen-icons/icons.json` provides each icon's name, keywords, categories, and file
URLs, which is useful for building an icon picker or search.

## Develop or contribute

This repository contains the icon sources and generator. To create or refine an
icon, read [the contribution guide](docs/CONTRIBUTING.md) and [the drawing guide](docs/spec.md), then run:

```sh
pnpm install
pnpm build                 # rebuild ../svg and dist/
pnpm preview               # rebuild ../svg and open the local icon gallery
pnpm check src/<name>.icon.json
pnpm test
```

The source for each icon is a `src/<name>.icon.json` drawing. Generated files in
`dist/` are rebuilt from those sources. The public `../svg/outline/` folder contains
the primary icon set; optional tonal variants live separately in `../svg/filled/`.

Coding agents can use [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), and
[the agent skill](.dev/SKILL.md) as concise entry points to the same authoring workflow.

## Repository layout

- `src/` — icon drawing sources
- `docs/` — drawing, contribution, and community guidance
- `.dev/` — build tools, tests, and agent metadata

## Community

Contributions are welcome. Read [the contribution guide](docs/CONTRIBUTING.md) for the
pull-request workflow and [the code of conduct](docs/CODE_OF_CONDUCT.md) for participation expectations.

# Lino Icons

Lino Icons is a set of 225 MIT-licensed outline icons on a consistent 24px grid.

## Start here

Open [`svg/outline/`](svg/outline/) to browse the main icon set. Every icon is a
separate, plainly named SVG file you can drag into a design tool or copy into a
project. Optional tonal variants are separate in [`svg/filled/`](svg/filled/), so
they never mix with the outline files in Finder.

## Preview the full set

The browser gallery lets you search icons and switch size, theme, and style:

```sh
pnpm install --dir generator
pnpm preview
```

It opens `generator/dist/preview.html`. If it does not open automatically, double
click that file after running the command.

## For contributors

Everything used to create the icon set is in [`generator/`](generator/). Its
[README](generator/README.md) explains the source files, checks, and release build.

## License

[MIT](LICENSE)

# Autumn UI

The components in this directory implement the autumn design made in Figma.

## Usage Guidelines
- Do **not** import code or styles from `design/figma-export/` at runtime. The Figma export there is design reference only.
- Add shared design primitives under `autumn/styles` or `autumn/theme` so they can be versioned with the app.
- When copying snippets from the Figma export, inline them here and adapt them to the local token system.
- New screens and components should live under `autumn/screens` or `autumn/components` to keep concerns separated.
- `styles/figma-utilities.css` is the Tailwind output of the Figma export (Tailwind itself is not installed).
  Utility classes that are not in that file have no effect.

rin# Autumn UI

The components in this directory are the production-ready implementation of the autumn redesign.

## Usage Guidelines
- Do **not** import code or styles from `Figma_UI/**` at runtime. The Figma export is design reference only.
- Add shared design primitives under `autumn/styles` or `autumn/theme` so they can be versioned with the app.
- When copying snippets from the Figma export, inline them here and adapt them to the local token system.
- New screens and components should live under `autumn/screens` or `autumn/components` to keep concerns separated.

# UI / Design Inventory & Cleanup Plan

_Last updated: 2025-10-26_

## 1. Inventory Snapshot

| path | status | reason | imported-by | suggested-action |
| --- | --- | --- | --- | --- |
| apps/web/src/autumn/components/AnimatedBackground.tsx | ACTIVE | Rendered globally for animated gradient backdrop | App.tsx | keep; relocate to `autumn/surfaces/AnimatedBackground.tsx` in restructure |
| apps/web/src/autumn/components/CurrentPlayerIndicator.tsx | ACTIVE | Shown inside GameView when player’s turn | GameView.tsx | keep; move to `autumn/components/game/CurrentPlayerIndicator.tsx`; add header comment |
| apps/web/src/autumn/components/DiceArea.tsx | ACTIVE | Main dice controls | GameView.tsx | keep; move to `autumn/components/game/DiceArea.tsx`; extract dropdown actions subcomponent |
| apps/web/src/autumn/components/Die.tsx | ACTIVE | Individual die UI | DiceArea.tsx | keep; colocate under `game/dice/Die.tsx` |
| apps/web/src/autumn/components/FinishedView.tsx | ACTIVE | End-of-game screen | App.tsx | keep; treat as screen -> `autumn/screens/FinishedView.tsx` |
| apps/web/src/autumn/components/GameHistory.tsx | ACTIVE | History modal | App.tsx | keep; create `autumn/screens/history/GameHistory.tsx` |
| apps/web/src/autumn/components/GameView.tsx | ACTIVE | Primary in-game screen layout | App.tsx | keep; move to `autumn/screens/GameView.tsx`; break down large sections |
| apps/web/src/autumn/components/PlayerSetupNew.tsx | ACTIVE | Setup screen UI | App.tsx | keep; rename to `SetupScreen.tsx`; migrate inline styles to theme tokens |
| apps/web/src/autumn/components/PlayerSetup.tsx | ALIAS | Re-export for backwards compatibility | App.tsx (indirect) | keep alias short-term; remove once imports updated |
| apps/web/src/autumn/components/Scoreboard.tsx | ACTIVE | Score table | GameView.tsx, FinishedView.tsx | keep; add header annotations; split constants |
| apps/web/src/autumn/components/StatusToast.tsx | ACTIVE | Toast overlay | App.tsx | keep; move to `autumn/components/common/StatusToast.tsx` |
| apps/web/src/autumn/components/TopBar.tsx | ACTIVE | Header bar | App.tsx | keep; document dropdown usage |
| apps/web/src/autumn/ui/alert-dialog.tsx | ACTIVE | Radix wrapper | App.tsx | keep; add header comment + align naming |
| apps/web/src/autumn/ui/button.tsx | ACTIVE | Button variants | many (DiceArea, PlayerSetup, TopBar) | keep; convert hard-coded colors to theme tokens |
| apps/web/src/autumn/ui/dialog.tsx | ACTIVE | History modal | GameHistory.tsx | keep; annotate |
| apps/web/src/autumn/ui/dropdown-menu.tsx | ACTIVE | Dice controls & TopBar menu | DiceArea.tsx, TopBar.tsx | keep; annotate |
| apps/web/src/autumn/ui/input.tsx | ACTIVE | Inputs | PlayerSetupNew.tsx | keep; add header comment |
| apps/web/src/autumn/ui/scroll-area.tsx | ACTIVE | History modal scrolling | GameHistory.tsx | keep; annotate |
| apps/web/src/autumn/ui/utils.ts | ACTIVE | Utility (`cn`) | all UI wrappers | keep |
| apps/web/src/autumn.css | ACTIVE | Imports full Figma Tailwind preset | main.tsx | trim; re-export only needed layers to reduce bloat |
| apps/web/src/index.css | MIXED | Contains legacy setup/game styles; some still unused | main.tsx | extract used rules into scoped files; move unused blocks to trash |
| apps/web/src/autumn-probe.css | UNUSED | Empty; never imported | none | move to `__trash__/autumn-probe.css` |
| apps/web/src/theme-autumn.css | UNUSED | Empty placeholder | none | delete or repurpose for tokens |
| apps/web/src/global.css | UNUSED | Empty; not imported | none | remove |
| apps/web/src/components/RoleSelectModal.tsx | ACTIVE | Imported by App for role selection | App.tsx | keep; consider relocating under `autumn/components/legacy/` or integrate |
| apps/web/src/components/** (remaining files) | LEGACY | Old UI implementation (GameScreen, SetupScreen, Scoreboard etc.) no longer referenced | none | move to `__trash__/legacy_components/` pending archival |
| apps/web/src/autumn/components/StatusToast.tsx (styles) | ACTIVE | Inline palette diverges from tokens | App.tsx | align colors to tokens post-tokenization |
| apps/web/src/autumn/ui/utils.ts (cn) | ACTIVE | Shared utility | multiple | keep |

## 2. Observations & Pain Points

1. **Dual UI Trees** – `apps/web/src/components` holds the previous UI. Only `RoleSelectModal` is still referenced. Everything else is dead weight and causes confusion for new contributors.
2. **Style Fragmentation** – Multiple CSS entry points (`autumn.css`, `index.css`, empty `global.css`, unused `theme-autumn.css`) plus heavy imports from `Figma_UI`. No clear layering between design tokens, primitives, and page styles.
3. **Inline Styling** – `PlayerSetupNew.tsx` relies on inline `CSSProperties` with hard-coded hex values; similar patterns exist in `GameView` & `Scoreboard`. Makes re-theming difficult.
4. **Lack of Annotations** – Components don’t indicate their purpose or dependencies, slowing onboarding.
5. **Barrel Ambiguity** – `PlayerSetup.tsx` re-export is a hidden alias; future refactors may miss the real source file.

## 3. Proposed Folder Hierarchy

```
apps/web/src/autumn/
  screens/
    Setup/SetupScreen.tsx
    Game/GameView.tsx
    Game/FinishedView.tsx
    History/HistoryModal.tsx
  components/
    game/CurrentPlayerIndicator.tsx
    game/dice/DiceArea.tsx
    game/dice/Die.tsx
    common/
      AnimatedBackground.tsx
      StatusToast.tsx
      TopBar.tsx
  ui/
    button.tsx
    input.tsx
    dropdown-menu.tsx
    dialog.tsx
    alert-dialog.tsx
    scroll-area.tsx
    utils.ts
  theme/
    tokens.ts
    surfaces.css (backgrounds)
  styles/
    index.css (Tailwind layers scoped to Autumn)
```

_Migrations_: Move existing files accordingly, update import paths in `App.tsx`, `GameView.tsx`, etc. Introduce `theme/tokens.ts` exporting colors (e.g., `autumnColors.primary = "#FF6900"`). Inline styles reference tokens via utility helpers.

## 4. Cleanup Plan

1. **Annotate** – Add header banners to every active UI component and Radix wrapper documenting role, dependencies, and visible sections.
2. **Theme Extraction** – Create `theme/tokens.ts` with palette + radii. Replace hard-coded hex values in buttons, setup screen, scoreboard.
3. **CSS Consolidation** – Replace `autumn.css` imports with curated `styles/autumn-base.css` containing only necessary Tailwind layers. Remove empty files (`global.css`, `theme-autumn.css`, `autumn-probe.css`).
4. **Legacy Isolation** – Move unused legacy components under `apps/web/src/__trash__/legacy/` for safety. Document in README to delete after verification.
5. **Barrel Cleanup** – Replace `PlayerSetup.tsx` alias by updating consumers to import from the renamed `SetupScreen.tsx`, then delete alias.
6. **Import Graph** – After file moves, run `pnpm -F web lint --fix` and `pnpm -F web typecheck` to ensure no dangling imports.

## 5. Next Steps

- Prepare commits in this order:
  1. `chore(ui): add UI audit report and annotate components`
  2. `refactor(ui): consolidate autumn ui folders and update imports`
  3. `chore(ui): remove unused legacy components (safe trash)`
- Provide PR summary with before/after hierarchy tree and validation checklist (build, lint, typecheck, manual smoke of setup/game flow).

```text
Validation Checklist:
  pnpm -F web build
  pnpm -F web lint --fix
  pnpm -F web typecheck
  pnpm -F web dev (visual smoke: Setup, Game, Finished screens)
```

This audit lays out the structural changes needed without altering runtime behavior. Let me know before we start moving files so we can adjust the plan if required.

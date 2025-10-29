# New Start Flow – Architecture and Rollout Plan

## Goals
- Ship the autumn2 start experience alongside the legacy flow without regressions.
- Keep adapters and guards swappable so we can flip features per environment or URL flag.
- Preserve backward compatibility until the whole game session can run on the new stack.

## Architecture Overview
- **Entry point**: `App.tsx` short-circuits when `VITE_NEW_START_FLOW === "1"` or `?new=1` is present and mounts the new React Router tree.
- **Adapters**:
  - `roomAdapter` (mock now, HTTP next) handles create/join/resume operations.
  - `socketAdapter` (planned) encapsulates presence and realtime events; guarded by `VITE_DISABLE_SOCKETS`.
- **Guards**:
  - URL guard accepts only `/` with `room` + `t` query params and rewrites history to keep host share data.
  - Session guard silently re-joins on valid tokens or exposes `resumeRoomId` for manual resume.
  - Feature guard ensures legacy sockets, toasts, and role modal are not mounted while the new flow is active.
- **State**:
  - `useIdentity` persists `playerId` and `displayName` in localStorage.
  - `useRoom` abstracts adapter calls and stores `yahtzee.lastRoomId`.
  - `StartScreen` owns UI state (tabs, player count, invite link) and reconstructs host data from history/URL after reloads.
- **Styling**: `autumn2/theme/tokens.ts` and `autumn2/styles/theme.css` provide CSS variables and background for the new flow only.

## Feature Flags and Defaults
| Flag | Default | Purpose |
| --- | --- | --- |
| `VITE_NEW_START_FLOW` | `0` | Activate the autumn2 router early return and UI. |
| `VITE_ROOM_ADAPTER` | `mock` | Selects `mock` (current) or `http` (upcoming) implementations. |
| `VITE_DISABLE_SOCKETS` | `1` | Hard-disables socket creation while the new flow ships without realtime. |

## Rollout Phases
1. **P0 — Mock Flow Hardening (done)**
   - Host invite state preserved via `history.replaceState` and reload reconstruction.
   - Deep link join/resume works with mock adapter.
2. **P1 — HTTP Room Adapter (next)**
   - Implement `roomAdapter/http` and wire feature switch in `useRoom`.
   - Ensure token + code flows match backend contract.
3. **P2 — Socket Adapter**
   - Introduce `socketAdapter`, gated by `VITE_DISABLE_SOCKETS`.
   - Add minimal reconnect banner inside the new flow.
4. **P3 — Game Handover**
   - Route from `StartScreen` into existing `GameView` using new session payloads.
   - Provide a thin provider bridge so legacy game screens can run with new adapters.
5. **P4 — Polish**
   - Finalize spacing, token usage, and re-enable animated background for the autumn2 surface only.
   - Add accessibility passes.
6. **P5 — Legacy Cleanup**
   - Remove role modal and duplicate socket flow once game handover is proven.
   - Collapse unused imports and delete deprecated code paths.

## Environment Matrix
| Environment | Flags | Notes |
| --- | --- | --- |
| Local dev (default) | `VITE_NEW_START_FLOW=0`, `VITE_ROOM_ADAPTER=mock`, `VITE_DISABLE_SOCKETS=1` | Legacy flow remains default; new flow available via `?new=1`. |
| Local new flow | `VITE_NEW_START_FLOW=1`, `VITE_ROOM_ADAPTER=mock`, `VITE_DISABLE_SOCKETS=1` | New flow becomes default; sockets stay disabled. |
| Staging target | `VITE_NEW_START_FLOW=1`, `VITE_ROOM_ADAPTER=http`, `VITE_DISABLE_SOCKETS=0` | Planned once HTTP + socket adapters are ready. |
| Production GA | `VITE_NEW_START_FLOW=1`, `VITE_ROOM_ADAPTER=http`, `VITE_DISABLE_SOCKETS=0` | Final goal after full migration. |

## Test Checklist per Phase
- `pnpm -F web typecheck`
- `pnpm -F web build`
- Manual smoke walkthrough: create host → copy link → open in private window → join → reload host → resume via guard.
- Regression check: load legacy flow without flags to confirm sockets, status toast, and role modal still work.
- Optional: Add Playwright regression for create/join/deep-link scenarios once HTTP adapter lands.

## Open Risks and Mitigations
- **Duplicate hook instances**: `useSessionGuard` uses its own `useRoom` instance; keep adapter stateless so repeated calls stay safe.
- **URL tampering**: Session guard validates `token` prefix; enforce stricter validation when HTTP adapter arrives.
- **History state**: Browser may strip custom state on cross-origin navigations; fallback to URL reconstruction is in place.
- **Flag drift**: Document defaults in `.env.example` and CI workflows to avoid misconfigured deployments.

## Next Steps
1. Implement HTTP adapter (`roomAdapter/http.ts`) and integrate switch in `useRoom` (Phase P1).
2. Define socket adapter surface and feature-flagged wiring (Phase P2).
3. Map start flow session payload to legacy `GameView` entry point (Phase P3).
4. Track polish tasks and animated background re-introduction (Phase P4).
5. Prepare legacy removal checklist once new flow reaches parity (Phase P5).

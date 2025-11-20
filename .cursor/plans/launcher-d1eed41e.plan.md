<!-- d1eed41e-d960-4661-9fef-955f9b5e5e92 8d688bbd-a9ba-4262-8e02-1e07a114145b -->
# Remediation Plan

## 1. Audio System Hardening

- Refactor `src/hooks/useAudio.ts`, `src/stores/audioStore.ts`, and `src/App.tsx` so all playback/downloading logic lives inside the hook and store (no ad-hoc refs/effects in `App`).
- Introduce env-driven audio URL configuration (e.g., `VITE_AUDIO_SERVER_URL`) and remove hard-coded domains from the hook.
- Expose pause/resume helpers in `useAudio`/`useAudioStore` and update `src/hooks/useGameLauncher.ts` to call them instead of querying DOM audio tags.
- Ensure `SettingsScreen` volume slider and mute button route through the store so persistence and state reflect UI; surface download/progress/error state for future UI feedback.
- Stabilize `ChristmasBackground.tsx` pop-sound handling by pooling/reusing audio objects and cleaning them up on unmount.

## 2. Fix Skin Viewer Output

- **Clarification:** The user flagged the "inside of a section, above the play button" location as the one showing the full body. This corresponds to `AuthenticationCard.tsx` using `SecureAvatar`. However, `SecureAvatar` renders a 2D image, not 3D. The 3D viewer (`SkinViewerWithSuspense`) in `LauncherHome.tsx` is positioned absolute: `absolute left-[calc(50%+380px)] top-[-80px]`.
- **Action:** Verify if `SkinViewer` is *also* being used unexpectedly, or if the user mistakes `SecureAvatar` (2D face) for the 3D one, OR if the 3D one is visually overlapping incorrectly.
- **Correction:** The user explicitly said "player's head is being displayed... inside of a section, above the play button" and "Rendering the complete 3D model". The `SkinViewerWithSuspense` in `LauncherHome` is the only 3D component. It might be that the "absolute" positioning places it visually "above" the play button in the layout flow, or the user considers the whole right side "above" it. I will proceed with fixing `SkinViewer.tsx` to strictly render the head only, as requested.
- Update `src/components/SkinViewer.tsx` to use the proper `skin3d`/`skinview3d` APIs (or a head-only mesh) so only the head renders (camera framing + body-part visibility toggles).
- Guard against asynchronous playerObject creation (await ready callbacks instead of `setTimeout` loops) to avoid the “full body” flashes noted in verification.

## 3. Repair the Test Harness

- Rework `vitest.config.ts` + `src/__tests__/setup.ts` so Vitest always loads the manual mocks under `src/__mocks__/@tauri-apps/api/*`; provide a single helper to seed default command responses and reset Zustand stores between tests.
- Update the security/manifest tests (and any others touching Tauri) to use those helpers instead of duplicating mock wiring, eliminating the “Unhandled command” rejections that caused 38 failures.
- Add targeted tests for the audio hook and skin viewer behavior to prevent regressions once the fixes land.

## 4. Integrate the Type System

- Replace the current boolean/error soup in the stores with the discriminated unions defined in `src/types/state.ts` (e.g., represent modpack install lifecycle as `ModpackState` rather than separate flags) and adjust selectors/components accordingly.
- Expand Zod validation in `src/hooks/useTauriCommands.ts` so every `invoke` response (launcher updates, BlueMap status, audio downloads, etc.) is parsed before entering the app state, surfacing typed `LauncherError`s on failure.
- Remove lingering `string | null` error fields in stores/components in favor of `LauncherError` to get consistent error handling.

## 5. Runtime Bug Fixes & Deployment Cleanup

- **Fix Updater Spam:** Modify `src-tauri/src/modules/launcher_updater.rs` to check the platform *once* and return early silently (or with a single debug log) instead of `eprintln!` on every poll loop.
- Fix the event-listener cleanup race in `src/hooks/useGameLauncher.ts` by awaiting `listen` calls, storing the returned `UnlistenFn`s, and tearing them down synchronously.
- Address the install/validation race in `src/hooks/useModpack.ts` by sequencing state transitions (block UI, validate, only then update `installedVersion`), and remove the temporary debug logging noted in `DEPLOYMENT_CHECKLIST`.
- Delete the debug panel entirely (`src/components/DebugPanel.tsx` + import/usage in `LauncherHome.tsx`) and remove the redundant installed-version `useEffect` from `App.tsx` now that `useModpack` guarantees persistence.
- Replace remaining `console.*` statements (SkinViewer, CatModel, LogViewer, etc.) with the structured `logger` utility so production builds stay quiet.
- Improve the launcher-update check flow in `App.tsx` so failures surface via toast/log, and successes always display the modal; add tests covering this logic.

## Validation

- Run `npm run test` (Vitest) after the harness fixes to confirm the suite is green.
- Run `npm run build` to ensure the React bundle still builds cleanly.
- Manually verify: audio fallback→main transition, mute/volume persistence, skin viewer head-only view, modpack install/update flow, and launcher update modal behavior.

### To-dos

- [ ] Centralize audio logic + pause/resume helpers
- [ ] limit SkinViewer to head rendering
- [ ] stabilize Vitest mocks & failing suites
- [ ] apply discriminated unions + Zod to stores
- [ ] fix listeners, race, logs, debug panel
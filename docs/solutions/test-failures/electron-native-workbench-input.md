---
module: Electron workbench verification
date: 2026-10-05
problem_type: test_failure
component: testing_framework
severity: medium
symptoms:
  - "CDP keyboard input did not reach the main-process prefix handler."
  - "Renderer screenshots omitted visible native browser views."
root_cause: wrong_api
resolution_type: test_fix
tags: [electron, playwright, keyboard, webcontentsview, native-capture]
---

# Verify Electron workbench behavior through native surfaces

## Problem

The workbench intercepts Herdr prefix keys in Electron's `before-input-event`,
including keys entered in embedded WebContentsViews. Playwright's page keyboard
dispatch did not exercise that hook in the tested Windows Electron environment.
A renderer-only screenshot also left the native browser and app rectangles blank.

## Symptoms and investigation

The real browser page accepted text, but Ctrl+B followed by h did not focus the
terminal. Temporary logging around `before-input-event` showed no event from the
CDP keyboard dispatch. Sending the same input with the target WebContents'
`sendInputEvent` reached the handler and passed the focus assertion.

An unrelated drag assertion initially failed because the exact center of the
vertical divider overlapped a horizontal divider. Pointer event instrumentation
identified the horizontal target. Moving the test coordinate to the first quarter
of the vertical divider exercised the intended control. The instrumentation was
removed after diagnosis.

## Solution

- Show and focus the isolated Electron test window.
- Find the intended WebContents, focus it, and send native keyDown/keyUp pairs.
  Include separate modifier down/up events around shifted actions. Supplying only
  the action's modifier flag missed a real bug: Shift keydown canceled the prefix.
  The strengthened test failed against the prior package, then passed once
  modifier-only events preserved the prefix state.
  Keep ordinary text entry through Playwright; only native interception assertions
  require this transport. See the `nativeKey` and `prefix` helpers in
  [workbench.e2e.ts](../../../tests/desktop/workbench.e2e.ts).
- Assert observable effects: focus moves to xterm, native views hide during zoom
  and dialogs, tabs stay independent, and existing PTYs retain their output.
- Capture the whole native window with `desktopCapturer`, matched to the window's
  media source ID. The existing [capture helper](../../../tests/desktop/launch.ts)
  does this for packaged runs. Inspect the image; a successful write is insufficient.
- Choose splitter coordinates away from intersections and assert both the changed
  proportion and restored visibility after pointer release.

## Why this works

The input transport now enters the Electron interception path used by the
[prefix controller](../../../src/main/workbench/controller.ts). Native window
capture includes the separately composited child views. Renderer DOM assertions
remain useful for controls but cannot establish native composition by themselves.

## Prevention

Keep native interception tests separate from ordinary page input assertions.
Never replace them with direct calls to the renderer command dispatcher. Retain
the remote-page isolation assertions and use isolated test data and loopback
fixtures. Private captures belong in ignored `test-results/`, not public Git.

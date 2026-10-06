---
module: TerminalView
problem_type: integration_issue
tags: [electron, xterm, clipboard, windows, keyboard]
---

# Explicit clipboard shortcuts in a sandboxed terminal

The terminal forwarded xterm input to its PTY but did not assign Ctrl+Shift+C/V.
On Windows, native paste could work through Electron's default menu while copying
an xterm selection with Ctrl+Shift+C left the previous clipboard unchanged.

Use xterm's custom key handler and the existing authorized desktop IPC binding.
Copy `getSelection()` only when nonempty. For paste, await main-process
`clipboard.readText()` and call `terminal.paste()`, which preserves newline
normalization and bracketed paste. Electron 44 returned a Promise in the actual
runtime; treating the result as a string failed boundary validation despite compiling.

Consume default behavior on both key phases, handle keydown only once, and leave
plain Ctrl+C untouched. Discard pending reads after blur, disposal or process exit.
Bound paste to 65,524 characters so xterm's twelve bracket marker characters stay
inside the PTY's 65,536-character input boundary. Never grant remote pages clipboard
permissions or expose the desktop preload to them.

The desktop regression test failed before the fix with the old clipboard content.
It uses native Electron key events and real Windows clipboard content; a mouse
double click selects output at screen coordinates because xterm overlays its spans.
It verifies selection copy, empty-selection preservation, paste without Enter,
ordinary interrupt, Unicode multiline bracket bytes, and late-paste focus isolation.

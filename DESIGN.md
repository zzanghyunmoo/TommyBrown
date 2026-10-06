# TommyBrown design system

## 0. Research Log

- User reference: Orca's compact sidebar, workspace tabs and uninterrupted work surface.
  Inspected the [official terminal screenshot](https://www.onorca.dev/whats-new/posters/ghostty-style-terminal.jpg)
  linked from [Orca](https://www.onorca.dev/). This is an original adaptation; no logos,
  upstream assets or application code are copied.
- Linear supplies luminance hierarchy and precise controls; minimalist execution keeps
  native typography, Radix icons and quiet neutral rules. The desktop gets a copper
  accent that belongs to TommyBrown. No marketing hero or fabricated activity.
- [StyleGallery panel-layout](https://github.com/changeroa/StyleGallery/blob/main/patterns/viewport-shell/panel-layout.md)
  informs intrinsic minimums and primary/support containment. Native panes add explicit
  scroll ownership instead of adopting the example's document scrolling.
- Existing Herdr-style pane shortcuts, tab retention and native browser splitting remain
  product behavior. This redesign changes chrome and visual hierarchy.
- Native screenshots and actual interaction results live in the verification checkpoint.
  No generated mockup is used as evidence of the implementation.

## 1. Atmosphere & Identity

Graphite studio in Dark, cool porcelain in Bright. A small copper TB mark anchors the
rail. One compact header combines selected workspace tabs and the theme choice.
An inset working surface gives the terminal, editor and browser a clear boundary.
Settings use the full available width; setup guidance is optional inline disclosure.

## 2. Color

| Token | Bright | Dark |
| --- | --- | --- |
| --canvas | #f1f2f4 | #17191d |
| --paper | #f9fafb | #1d2025 |
| --surface | #ffffff | #252930 |
| --wash | #e9ebef | #303640 |
| --ink | #24272e | #edf0f5 |
| --muted | #626873 | #a7afbd |
| --line | #dce0e6 | #373e49 |
| --accent | #775239 | #e4b68d |
| --accent-hover | #5f402b | #f0c7a1 |
| --on-accent | #ffffff | #252018 |
| --accent-wash | #f0e7df | #3a3028 |
| --success / --success-wash | #286044 / #e6f2eb | #9cdbb4 / #21392d |
| --warning / --warning-wash | #795610 / #faf0d5 | #e5c783 / #3a3323 |
| --danger / --danger-wash | #a2333d / #fbe9ec | #ffacb5 / #41282e |
| --terminal / --terminal-ink | #fcfcfd / #30353f | #14171c / #e0e5ee |
| --selection | #cbd9ef | #3b506b |
| --backdrop | #24272e66 | #080b10aa |
| --rim | #ffffff | #ffffff08 |
| --shadow | #24272e08 | #080b1033 |

Terminal ANSI normal colors (black, red, green, yellow, blue, magenta, cyan, white):
Bright `#30353f #b42338 #247047 #866000 #245eac #87459c #1c6b78 #626873`;
Dark `#566071 #ef8795 #9cdbb4 #e5c783 #8fbcf2 #cca9eb #8ed0d7 #e0e5ee`.
Bright variants share these swatches; xterm additionally enforces minimum contrast 4.5.
Monaco uses paper/ink/wash/muted/selection and its inherited light/dark syntax theme.
Native window background equals canvas. Remote web pages retain their own styles.

Selection uses a wash and stronger type, never an accent stripe. Status includes text.
The first launch follows the OS appearance; explicit Bright/Dark choices persist in the
app profile. Apply before renderer content appears. Theme changes update mounted
editors and terminals without recreating their models or processes.

## 3. Typography

Native `Segoe UI, system-ui, sans-serif`; mono `Cascadia Code, Consolas, monospace`.
No remote fonts. Scale: metadata 12px, UI/body 14px, emphasized body 16px, section 20px,
page title 28px. Weights 400, 500, 600. Body line-height 1.5, headings 1.2.
Terminal and Monaco text use 13px Consolas. Numbers use tabular figures where relevant.

## 4. Spacing & Layout

4px base: s1=4, s2=8, s3=12, s4=16, s5=20, s6=24, s8=32, s10=40, s12=48.
Sidebar 216px; unified header 52px; status bar 24px. Work surface inset 8px,
outer radius 12px, neutral 1px boundary. Workspace buttons are 36px high and cap
at 280px with ellipsis for long names. Theme control stays visible with sidebar hidden.
Settings cap at 1120px, with 24px padding (20px below 1100px), 20px vertical rhythm
and compact provider rows. The guide is a bottom disclosure.

Root is 100dvh. Sidebar, settings content, file tree and each working pane own bounded
scroll regions. Grid/flex children use min-width/min-height zero. Native minimum is
960x640; the sidebar can be hidden. The component showcase also exercises 768/375px.

The main workbench has Terminal, Code/Documents and Connectors tabs. Browser/app
launch opens a right support split (60% working, 40% support). Browser and app are
peer tabs with one native surface visible at a time. Closing support restores width.
Inactive content remains mounted to retain PTYs, drafts and web state. Position changes
invalidate native bounds; hidden DOM alone is insufficient for native child views.

A stable split tree supports extra terminals, zoom, swap and resize. Each leaf owns
scrolling; toolbars stay fixed. Splitter hit area is 8px with a neutral center rule,
limits 20-80%, minimum leaf 240x160. At pane heights <=240px controls compact to 28px,
redundant visual labels hide while accessible names stay, and tab padding decreases.
Browser controls use bounded horizontal overflow at extreme widths. PTY geometry
always clamps to the IPC contract.

## 5. Components

- **Button**: primary/secondary/quiet; icon, text, disabled/busy/hover/pressed/focus.
  36px minimum, 6px radius. Toolbar compact variants follow the pane contract.
- **Theme choice**: native select labelled 화면 테마, visible Bright/Dark labels,
  disabled while saving. Retain keyboard focus after save; errors remain visible until
  a successful retry. Persistence errors do not claim that the requested theme was saved.
- **Workspace navigation**: semantic navigation with aria-current, selected surface
  and neutral border. Stronger selected text, long names with titles and ellipsis.
- **Nav row**: icon, name, optional real count/status; selected surface, 36px height.
  Session state comes from live PTYs, never fabricated metrics.
- **Status**: neutral/success/pending/error, text and small dot. Live state uses polite
  announcements; repeated polling does not repeatedly announce unchanged data.
- **Panel**: title, optional description/action, body, 8px radius, neutral border.
  Empty/loading/error states retain the panel's purpose and recovery action.
- **Field**: associated label, native input/select, description or inline error.
- **Model mapping**: existing editable table; purpose leads the row name and model
  option label. An unregistered ID gets a muted text explanation as a request alias.
  Presets preserve existing IDs and routes; missing families never imply availability.
- **Provider row**: provider, account type, actual connection state and login action.
  Pending login has cancel/reopen and a deadline; callbacks alone do not prove success.
- **Tab**: role tab, selected background and label; independently labelled close button.
  Arrow/Home/End navigation within pane groups. Dirty documents show an unsaved marker.
- **Notice**: wrapping inline information/failure with a recovery action when applicable.
- **Guide disclosure**: native details/summary keeps setup help available on demand.
- **Workbench pane**: 36px tabs, focused wash, zoom/close controls, bounded body.
  Closing a split preserves the primary document host and its unsaved changes.
- **Splitter**: pointer capture, keyboard arrows in 5% steps, Home/End bounds, labelled
  separator with size. Follow the pointer without animating geometry.
- **Shortcut help**: searchable rows, keyboard dismiss, focus return. Hide native views
  while the dialog owns input.

The development showcase exercises shared states in both themes before final desktop QA.

## 6. Motion & Interaction

100ms opacity/transform feedback only. No animated theme crossfade or layout animation.
Reduced motion removes button transitions and press movement. Busy labels respond
immediately; failures remain until retry or dismissal. Native controls retain OS behavior.

Ctrl+B prefixes workbench commands across local and remote content. Show prefix/resize
mode as text, Escape cancels, and focus/splitter movement is immediate. Theme changes do
not interrupt editor undo history, terminal input or browser navigation.
Terminal Ctrl+Shift+C copies selected text; an empty selection keeps the clipboard.
Ctrl+Shift+V pastes text, retaining bracketed paste and adding no Enter. Ctrl+C remains
interrupt. Discard asynchronous paste after terminal focus changes or the session exits.

## 7. Depth & Surface

The outer surface uses `0 1px 4px var(--shadow)` plus a 1px inset rim. Depth comes
chiefly from four neutral surface tones. Selected workspace tabs use surface and a
neutral border. No decorative gradients, heavy shadows or animated layout.
Radii: metadata 4px, controls 6px, panels 8px, outer work surface 12px.

## 8. Accessibility & Validation

Target normal text contrast >=4.5:1, visible 2px focus rings, semantic headings, labelled
controls, reduced motion and readable Korean labels. Disabled controls remain legible.
Long URLs/account labels wrap or intentionally truncate. Auth failures preserve cancel
and back navigation. Theme controls remain reachable when the sidebar is hidden.

Actual native screenshots and keyboard interactions, not a DOM-only screenshot, prove
the desktop composition. No screen-reader study or mobile Lighthouse/SEO pass is
implied by the desktop checks. Unverified behavior must be stated in the checkpoint.

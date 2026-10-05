# TommyBrown design system

## 0. Research Log

- User reference: Herdr's spaces/agents and top tabs; VS Code-style code workspace.
  These define the spatial contract, not a pixel-for-pixel clone.
- Reference shortlist: Linear (dense workspace hierarchy), Notion (document reading),
  Claude (warm neutrals). Selected minimalist execution with Linear's compact control
  anatomy, adapted to TommyBrown's warm, light desktop chrome. No upstream assets copied.
- StyleGallery: [panel-layout](https://github.com/changeroa/StyleGallery/blob/main/patterns/viewport-shell/panel-layout.md)
  informs primary/support pane containment. Each bounded workspace pane owns its scroll.
- External screenshot/concept lanes: no screenshots or generated mockups used as fidelity
  evidence. The supplied application layout and this explicit token contract guide the build.
- Actual rendered desktop evidence will be recorded in `docs/verification/`.

## 1. Atmosphere & Identity

A quiet workbench: warm paper, dark ink, brown controls, and compact workspace rails.
The signature is the small brown TB monogram beside a persistent workspace structure.
Dense terminals and code retain their own dark surfaces; settings stay readable on paper.
No decorative charts, fabricated usage statistics, marketing hero, or sample agents.

## 2. Color

| Token | Value | Role |
| --- | --- | --- |
| --canvas | #f7f6f3 | Sidebar and app frame |
| --paper | #fdfcf9 | Main working surface |
| --surface | #ffffff | Controls and selected tabs |
| --wash | #eeece6 | Hover and selected rows |
| --ink | #292825 | Primary text |
| --backdrop | #29282566 | Modal backdrop |
| --muted | #6b6a64 | Secondary text |
| --line | #e2dfd7 | Structural dividers |
| --accent | #805035 | Primary action background |
| --accent-hover | #693e28 | Primary action hover |
| --on-accent | #ffffff | Action labels |
| --success | #346538 | Ready status |
| --success-wash | #edf3ec | Ready background |
| --warning | #805d1a | Pending status |
| --warning-wash | #fbf3db | Pending background |
| --danger | #9f2f2d | Error text |
| --danger-wash | #fdebec | Error background |
| --terminal | #20211f | Terminal/editor canvas |
| --terminal-ink | #e5e4dd | Terminal/editor foreground |

Selection uses a background wash and glyph, not an accent stripe. Status always includes
text, not color alone. Provider identities are text labels rather than copied logos.

## 3. Typography

Native `Segoe UI, system-ui, sans-serif`; mono `Cascadia Code, Consolas, monospace`.
No remote fonts. Scale: metadata 12px, UI/body 14px, emphasized body 16px, section 20px,
page title 28px. Weights 400, 500, 600. Body line-height 1.5, headings 1.2.

## 4. Spacing & Layout

4px base. Tokens --s1=4px, --s2=8px, --s3=12px, --s4=16px, --s5=20px,
--s6=24px, --s8=32px, --s10=40px, --s12=48px. Sidebar 232px; header 60px;
tab row 44px; status bar 28px; support pane 288px. Controls at least 36px tall.
Compact desktop 960px; roomy desktop 1280px. Main settings content maximum 1040px.

Root is 100dvh with fixed chrome. Sidebar list, main content, terminal, and right document
pane have independent bounded scroll jobs. Grid children use min-width/min-height zero.
Below 1100px, supporting content stacks after primary content. Below 700px, the sidebar
becomes a top navigation band for small-window inspection; main content never overflows.

The simultaneous workbench replaces that support-pane stacking rule: terminal on the
left (48%), browser above app on the right (50/50). A bounded split tree places stable
pane elements without remounting their contents. Each leaf owns its scroll; the canvas,
pane title, toolbar, and splitter stay fixed. Splitter hit area is 8px with a neutral
1px center rule. Splits clamp to 20-80%; pane creation also respects a usable minimum
of 240px by 160px. At the native 960px minimum window, the sidebar can be hidden.
Zoom temporarily fills the canvas without deleting other panes or stopping sessions.
When a pane body is at most 240px tall, its controls use a 28px compact height,
hide redundant visual field labels (accessible names remain), and reduce tab padding.
Browser controls stay on one row with bounded horizontal overflow at extreme widths.
Terminal fitting clamps its grid to the IPC contract even during a tiny resize.

## 5. Components

- **Button**: primary/secondary/quiet; optional icon; disabled/busy/hover/pressed/focus.
  Native button with visible text or aria-label. 36px minimum height, 6px radius.
- **Status**: neutral/success/pending/error, text with a small dot. Live status uses a polite
  status region; no rapidly repeating announcements.
- **Panel**: section title, optional description/action, body. 8px radius and neutral border.
  Empty, loading, populated, and error states retain the panel's purpose and recovery action.
- **Field**: associated visible label plus input/select, description or inline error.
- **Nav row**: icon, text, optional count; selected wash, keyboard focus; long names truncate
  with a title; 36px height. Navigation is separate from status.
- **Provider row**: provider name, supported account type, real connection state, login action.
  Pending login has cancel/reopen actions and a deadline. Never claim connected on callback alone.
- **Tab**: role tab, selected background, label and close button with independent accessible
  name. Arrow keys move between peers. Dirty documents have an explicit unsaved indicator.
- **Notice**: inline failure or explanatory message; wrapping text and a recovery action.
- **Workbench pane**: compact 36px title row, kind label, focused glyph and wash,
  zoom/close actions, and a bounded body. Browser and application tab groups are independent.
- **Splitter**: pointer drag with capture, keyboard arrows in 5% steps, Home/End limits,
  and a labelled separator with current size. Continuous resize follows input without motion.
- **Shortcut help**: searchable key/action rows in a keyboard-dismissable dialog. Native
  web views hide while the dialog is open and return when it closes; focus returns to the pane.

A development component showcase exercises shared states before composing product screens.

## 6. Motion & Interaction

100ms opacity/transform feedback only. Buttons visibly react on press; disabled state retains
legibility. Asynchronous actions show a busy label immediately. No layout animation under
the pointer. Reduced motion removes positional motion. Errors remain visible until retry
or dismissal; confirmation comes from changed data rather than arbitrary success toasts.

Herdr's Ctrl+B prefix governs workbench commands across local and remote content.
Prefix/resize mode is shown as text in the workbench bar. Escape cancels. Splitter
gestures and focus movement are immediate; reduced motion requires no alternate layout.
This is a desktop-specific keyboard/splitter mechanism, not a decorative animation.

## 7. Depth & Surface

Borders-only with paper/canvas differentiation. No decorative shadows or gradients.
Radius 4px small metadata, 6px controls, 8px panels; structural panes have square edges.
One-pixel neutral rules establish containment. Terminal/code contrasts are intentional.

## 8. Accessibility Constraints & Accepted Debt

Target WCAG 2.2 AA: normal text contrast at least 4.5:1, all controls keyboard reachable,
visible 2px focus-visible ring, semantic headings, labels, reduced motion, and readable zoom.
Long account labels and URLs wrap or truncate intentionally. Loading and auth failure
cannot remove cancel/back navigation. Native window controls retain OS behavior.

No accessibility debt has been accepted. Desktop authentication, keyboard flow, clipping,
and component states require observed QA before completion; untested behavior stays open.

# HexDraft Design System

## Direction

**Quiet Arcana** is a dark, premium product interface for League of Legends draft analysis. It borrows Syndra's sense of controlled violet energy, but expresses it through restraint: neutral-first surfaces, precise typography, calm hierarchy, and one clear action at a time.

The product should feel like a finished Apple utility: quiet, legible, deliberate, and confident. It must not feel like a cyberpunk HUD, a neon gaming dashboard, a tactical command center, or a decorative fantasy skin.

## Palette

### Surfaces

- `--ink-950` `#07060d` — application background
- `--ink-900` `#0c0a12` — shell, navigation, and primary panel
- `--ink-850` `#110e1a` — elevated panel
- `--ink-800` `#171225` — field and selected surface
- `--ink-700` `#211a35` — control and separator
- `--ink-600` `#37264e` — border and hover boundary
- `--ink-500` `#4f376b` — strong boundary

### Text

- `--text-strong` `#f3f0f8` — titles and critical values
- `--text-primary` `#d8d4df` — body text
- `--text-secondary` `#b5b0bf` — secondary explanation
- `--text-muted` `#898493` — metadata
- `--text-faint` `#625f6b` — low-priority labels

### Accent and status

- `--violet-deep` `#30085e` — selected/pressed tint
- `--violet-solid` `#6c14d5` — saturated action and active rail accent
- `--violet-muted` `#8134c7` — restrained secondary accent
- `--violet` `#9b4de6` — primary text accent and focus
- `--violet-hover` `#b465f4` — hover state
- `--violet-active` `#d2a9ff` — active/selected text
- `--violet-wash` `rgba(108, 20, 213, 0.18)` — quiet background tint
- `--success` `#62c998`, `--warning` `#ddbb70`, `--danger` `#db7886` — semantic states

Black is the dominant visual field; violet is reserved for intent. Use it on borders, focus, selected states, progress, and one primary action per region. The shell uses an abyssal black-violet surface with several low-opacity radial fields distributed across the canvas to create depth without looking like a neon effect. The dashboard hero may use a slightly more expressive field and a larger transparent brand mark. Do not introduce hot magenta, electric blue, glow halos, gradient text, or decorative grid lines without an explicit product decision.

## Typography

- **DM Sans** is the interface face. Use it for navigation, headings, labels, values, and explanatory copy.
- **IBM Plex Mono** is reserved for patch numbers, technical metadata, timestamps, and compact data identifiers.
- Use sentence case. Avoid all-caps labels except for genuinely technical identifiers.
- The hierarchy should come from size, weight, spacing, and contrast—not from glow, italics, or oversized tracking.

## Layout and components

- Use generous page padding: `1.25rem` on compact screens and `2rem` on desktop.
- Prefer `0.75rem` to `1rem` radii. Small controls may use `0.5rem`.
- Use near-black panels with a subtle violet cast, a quiet border, and restrained tonal layering. Avoid glassmorphism, heavy blur, and high-contrast ambient gradients.
- Interactive controls should be at least `44px` high where practical.
- Keep one primary action per region. Secondary actions should be quieter in outline or neutral treatments.
- Use violet for intent: selection, focus, primary action, progress, and meaningful state. Do not color every card or statistic.
- Primary buttons may be opaque violet or semantic green; secondary and utility buttons use a near-black fill with a thin violet border. Translucent violet is reserved for selection surfaces, not actions.
- Keep the sidebar calm and legible; active navigation is a violet wash with an inset boundary, not a bright rail or dashboard tab.
- The sidebar has two stable faces—expanded and compact—crossfaded inside one shell so the controls themselves do not collapse or drift during the transition.
- Brand marks are transparent SVGs without a surrounding tile. The entry hero is spacious and asymmetric, using scale and atmospheric depth instead of a boxed logo.

## UX principles

1. Show connection and data freshness before analysis claims.
2. Make the next action obvious in the first viewport.
3. Explain recommendations in plain language before exposing dense data.
4. Use semantic status colors sparingly and consistently.
5. Empty, loading, error, and disconnected states must be useful—not merely decorative.
6. Preserve keyboard focus visibility and respect `prefers-reduced-motion`.

## Motion

Motion is functional and short: state changes, view transitions, and feedback may use approximately `160–220ms` ease-out transitions. Avoid infinite ornamental loops, pulsing status indicators, and animated gradients. Reduced-motion users receive an effectively static experience.

## Product surfaces

- **Dashboard:** account state, draft entry, mastery, and recent activity in a calm summary hierarchy.
- **Draft:** decisions first; bans, picks, and recommendations remain readable without turning the surface into a command console.
- **Champions:** comparison and filtering should feel like a product data view, not a game inventory wall.
- **Settings:** clear preferences, explicit connection state, and restrained controls.

This file is the visual contract for future UI work. When a new component needs an exception, document the reason in the component or in the relevant product decision before adding another visual language.

# Design system

otherbloc uses a sharp, monochrome editorial system derived from the official brand and interface references.

## Visual direction

The interface is typography-first and reading-focused. Scale, spacing, image proportion, and thin rules establish hierarchy. Shadows, rounded cards, decorative gradients, and dashboard patterns are intentionally excluded from public reading surfaces.

The design is configured at:

- design variance: 6
- motion intensity: 4 (short, task-driven transitions)
- visual density: 3

This preserves asymmetric desktop compositions, restrained state changes, generous whitespace, and direct single-column mobile layouts. It is an editorial aesthetic implemented with the existing CSS, not a replacement Material component theme.

## Color

| Token | Value | Use |
| --- | --- | --- |
| Ink | `#000000` | Primary text, marks, and controls |
| Graphite | `#373735` | Supporting text and strong rules |
| Grey | `#7F7F7B` | Muted hierarchy |
| Line | `#CFCFCE` | Borders and dividers |
| Paper grey | `#EAE9E6` | Quiet supporting surfaces |
| Paper | `#F6F5F3` | Page background |
| White | `#FEFEFE` | Fields and raised reading surfaces |

These are the supplied light-brand values. The runtime strengthens muted text from `#7F7F7B` to `#646460` for readable contrast. Light, dark and system preferences apply to the entire page and persist as a theme preference only. Dark surfaces use paper `#171716`, white `#20201E`, paper grey `#292927`, ink `#F6F5F3`, graphite `#D0D0CB`, muted text `#A9A9A3` and line `#575752`. Existing original photographs remain in color; CSS desaturates list images until hover/focus, while touch layouts show color directly.

## Typography

- Prumo Display Bold carries titles and display hierarchy.
- Adelle Sans Regular and ExtraBold carry navigation, controls, descriptions, and metadata.
- Georgia carries article text and longer editorial descriptions.

All font files are hosted locally with `font-display: swap`. Responsive display sizes use `clamp()` so hierarchy scales without fixed breakpoints.

## Layout and shape

The maximum content width is 1536 pixels with fluid page gutters. Desktop layouts use asymmetric CSS Grid tracks; layouts collapse to one column below 768 pixels. All surfaces and controls use sharp corners. Depth comes from composition, cropping, borders, and tonal contrast rather than shadows.

## Motion and states

Hover, focus and press feedback stay short. Theme changes use the existing 380 ms circular transition. Mobile navigation overlays the reading without shifting its layout; menu and modal surfaces enter and exit in 160 ms using opacity and a small transform. Native dialog close releases focus immediately, while the outgoing visual finishes and becomes non-interactive. Backdrops also honor reduced motion. Unsupported transition features fall back to immediate native behavior.

This applies the appearance/disappearance purpose of [Material's fade pattern](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md) to existing editorial surfaces, without importing Android components or changing the site's design system. CSS `@starting-style` and discrete display/overlay transitions follow [the native dialog animation model](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog#animating_dialogs).

Public collection → reading and its return share the selected photographic cover for 320 ms, retaining the original images and editorial grid. Only explicit parent-child account/editor/review journeys use a restrained 16 px lateral movement, reversing on return. Other destinations use a fade-through: outgoing content disappears in 90 ms, then incoming content appears over 160 ms, avoiding two superimposed titles. Data is loaded before the route transition, not while the browser holds a snapshot. An image decode budget prevents a slow photograph from blocking access; missing/unready covers use the fade alternative. Theme owns its own root snapshot and disables route-specific names. Reduced motion removes route animations, including history transitions.

Loading skeletons represent actual requests, not fixed animation delays. Empty/error/retry views remain explicit. Forms retain native labels, visible focus and readable helper text. History restoration waits for real content and fonts and stops if the user starts another interaction, so a late response does not steal focus.

The original measured reference profile is stored in `frontend/src/styles/design-dna.json`; this document records subsequent implemented behavior and accessible theme adjustments.

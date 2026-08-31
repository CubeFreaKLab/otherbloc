# Design system

otherbloc uses a sharp, monochrome editorial system derived from the official brand and interface references.

## Visual direction

The interface is typography-first and reading-focused. Scale, spacing, image proportion, and thin rules establish hierarchy. Shadows, rounded cards, decorative gradients, and dashboard patterns are intentionally excluded from public reading surfaces.

The design is configured at:

- design variance: 6
- motion intensity: 3
- visual density: 3

This produces asymmetric desktop compositions, restrained hover feedback, generous whitespace, and direct single-column mobile layouts.

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

The interface uses a locked light, print-emulating theme. Text and interactive controls maintain high contrast against paper surfaces.

## Typography

- Prumo Display Bold carries titles and display hierarchy.
- Adelle Sans Regular and ExtraBold carry navigation, controls, descriptions, and metadata.
- Georgia carries article text and longer editorial descriptions.

All font files are hosted locally with `font-display: swap`. Responsive display sizes use `clamp()` so hierarchy scales without fixed breakpoints.

## Layout and shape

The maximum content width is 1536 pixels with fluid page gutters. Desktop layouts use asymmetric CSS Grid tracks; layouts collapse to one column below 768 pixels. All surfaces and controls use sharp corners. Depth comes from composition, cropping, borders, and tonal contrast rather than shadows.

## Motion and states

Motion is limited to short hover, focus, and press feedback. Reduced-motion preferences disable nonessential transitions. Loading, empty, and error foundations are available through `ContentState`, and forms use explicit labels, visible focus styles, and readable helper text.

The complete measured profile is stored in `frontend/src/styles/design-dna.json`.

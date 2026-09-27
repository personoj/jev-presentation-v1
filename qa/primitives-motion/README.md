# Sixth-slide motion verification

Rollback tag: `primitives-motion-before-20260928` (commit `974c017`).

- Choice draws all three routes, pulses A/B/C, sends one signal to B and holds the selected route.
- Noul uses a single SVG group for the probability point and its italic p label. It moves right/left/right, reaches p=0.5 at 1850 ms, holds for 500 ms and remains stationary. The user explicitly selected one pass, not a loop.
- Score follows 0 → 1 → 2 → 1. Each arrow begins near the moving ball and targets the next landing; the last hop points left. Arrows fade on landing. Final ball bottoms align with the opaque stair surfaces measured at y=637/591/537 in the existing raster artwork.
- Each column starts when its normal deck step appears. Previously revealed columns keep their state. Brief reversal resumes from the same pose; a hidden column can replay after its fade finishes.
- Clicking the 06 / 11 page counter remounts this page's animations, including Choice when already at step zero.

## Checks

Build and all 115 tests pass. New tests check probability bounds, the final 500 ms hold, all three Score landings, stair clearance across sampled frames, continuous jump boundaries, arrow direction, and stable Choice selection.

Browser checks: 1280×720 and 1920×1080; no scrolling; final resting clocks stop. Reduced-motion mode immediately shows B / p=0.5 / Score=1 with zero running animations. Normal replay resets Choice to its beginning and Noul/Score to zero. A quick Noul hide/reveal preserves time 1200 ms and point transform translate(728,591); p shares that transform throughout.

Screenshots at 800 / 1575 / 2385 / 3200 ms show rightward probability, upward hop, leftward return and final rest. `final-1920.png` records the full-screen resting layout. Media and viewport overrides are reset after QA. No additional generated media, network calls or dependencies are required.

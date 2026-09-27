# Fourth-slide comparison overlay

Approved reference: `production/comparison-overlay/source/approved-reference.png`.
Checkpoint before implementation: `acad5d8`.

## Result and controls

Slide four preserves its first three states. Its next click opens the paper overlay (`#comparison/3`); the following click advances to training. Arrow keys, Space, the close button, Esc, and the continue button share the deck's state. Tab is contained within the dialog and focus returns on close.

The native 3.2-second timeline opens the sheet, branches the shared input, runs two clocks at the same accelerated rate, reveals costs, and settles the ratios. Both 9-second axes have identical width. Their bars stop at exactly 8.566 and 0.114 seconds; no minimum-length correction exaggerates the short bar. Figures are the official demo, not measurements of the order-message example or a live API call.

## Evidence

- `final-1920.png`: clean 1920×1080 resting state, no scroll overflow.
- `final-1280.png`: default 1280×720 resting state.
- `frame-200.png`, `frame-900.png`, `frame-1800.png`, `frame-3200.png`: entrance, input split, concurrent timing and final result.
- `reversal.json`: interrupt closing at presence 0.6087 / content time 1800 ms; reopening starts at the same two values.
- `asset-fallback.png`: actual request blocked, image naturalWidth 0 and display none; paper fallback, typography and controls remain available.
- Reduced motion: presence 1, content time 3200, zero running animations immediately. Normal resting state also has zero running animations.
- Focus enters the dialog after it becomes visible; Tab goes to close, Shift+Tab wraps to continue; Esc returns to comparison step 2 without opening the contents panel.
- Continuing from the popup reaches training step 0. Rapid reverse/reopen does not restart content or snap geometry.
- Temporary viewport, reduced-motion, cache and network blocking overrides were reset after testing.

Build passes. All 111 tests passed; after final visual adjustments the 3 focused motion/navigation tests passed again. Console in final normal run: no errors.

## Sources and material

- https://typesafe.ai/ — paired time and per-call cost figures.
- https://typesafe.ai/blog/introducing-system-one-models-and-jev — short-input demo and GPT-5.6 Terra default reasoning.
- https://docs.typesafe.ai/models — input-token price and free output.

Generated paper material: `public/reference-art/comparison-paper.png`, built-in Image Gen, exact prompt archived in `production/comparison-overlay/source/asset-prompt.txt`. Original alpha PNG is 1672×941, RGBA; all four corners have alpha 0. Native text and SVG stay sharp at presentation scale; CSS paper fallback covers image failures. No video or extra remote generation dependency is used at runtime.

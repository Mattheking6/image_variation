# Two-layout responsive design with always-visible views

Status: accepted

The game must be playable outdoors on a phone and on a PC, and the map view and the
result view must always be visible together. We decided on exactly two layouts,
chosen by one rule: the **flank layout** (three columns — four portrait cards per
side, map view and result view stacked in the middle) when the viewport has an
aspect ratio of at least 1:1 *and* is at least 900px wide; the **compact layout**
(map view and result view side by side at 1fr:1fr, filmstrip of the eight portrait
cards below) everywhere else. The page never scrolls vertically in either layout;
the filmstrip scrolls horizontally, and the flank side columns scroll internally
as a fallback on short screens.

## Considered options

- **Width-only breakpoint** (the previous `max-width: 1400px` single column with a
  map/canvas tab): rejected — most laptops got the phone layout, it could not
  express "wide but short" windows, and the tab split the two views, violating the
  always-visible requirement. The tab toggle is deleted entirely.
- **Aspect ratio only** (wider than tall → flank): rejected — a landscape phone
  (844×390) would receive the desktop layout squeezed, with the stacked views at
  ~160px tall. The 900px minimum width is what keeps landscape phones on the
  compact layout, where the side-by-side views stay large.
- **CSS-only card rows** (two stacked rows of four cards) for the compact layout:
  rejected in favour of a single 1→8 filmstrip. That required a small JS reparent
  (`matchMedia` listener moving the card nodes between the flank asides and the
  filmstrip), which the team accepted over a zero-JS two-row fallback.

## Consequences

- JS owns card placement and per-layout ordering: the flank asides read 1 2 / 3 4
  (column-major), the filmstrip reads 1→8. CSS alone cannot merge the two flank
  asides into one scroller.
- The win state does not reflow the page: the old `.won` single-column collapse
  and the `setTab("map")` call are gone; the victory dialog and its fly-in
  animation are layout-agnostic (fixed-position coordinate based).
- Detail screens must stay `position: fixed` — they cover the viewport, not the
  document. The page no longer scrolls, but fixed remains the documented pattern.
- Help text is inline in the flank layout (header paragraph) and lives in the
  help detail screen (header “?” button) in the compact layout.

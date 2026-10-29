# Enigmes d'automne

Single-page web game: eight family portraits are adjusted with eight deterministic
parameters to reconstitute the winning image, along a physical trail whose locations
provide the hints.

## Language

**Detail screen**:
A modal overlay shown over the game. Four detail screens exist: the hint popup
(a puzzle location's photo and progressive hints), the portrait zoom (one portrait
enlarged), the victory dialog, and the help detail screen.
_Avoid_: modal, popup, dialog (each used alone to name a specific detail screen is
fine; the umbrella term is "detail screen")

**Variation**:
The deterministic result of applying the eight parameters to one image; the same
image with the same code is always the same variation. This is the engine's core
concept; the game is built on top of it.

**Code**:
The eight-digit identity of a variation, one digit per parameter, in fixed parameter
order. Short enough to share and type.

**Portrait card**:
The tappable card for one parameter: the current portrait with its number badge and
name, and previous/next chevrons overlaid on the portrait. Tapping the portrait
opens the portrait zoom detail screen.
_Avoid_: control, param tile

**Map view**:
The Leaflet map of the trail: track and the eight puzzle locations.

**Result view**:
The canvas showing the current variation of the target image.

**Flank layout**:
The wide layout (aspect ratio at least 1:1 and width at least 900px): map view and
result view stacked in the middle column, with four portrait cards flanking each side.

**Compact layout**:
The narrow/portrait layout: map view and result view side by side, both always
visible, with the filmstrip of portrait cards below.
_Avoid_: mobile layout, two-column layout

**Filmstrip**:
The single horizontally scrolling row of all eight portrait cards in the compact
layout.
_Avoid_: carousel, card row, scroller

**Help detail screen**:
The detail screen showing how to play; opened from the “?” button in the header
(compact layout only, where the help text is not shown inline).

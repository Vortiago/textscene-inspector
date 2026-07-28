# Viewport navigation mirrors Godot's editor, and the browser's one wheel event goes to zoom

- Status: Accepted (2026-07-28)
- Related: ADR-0006 (viewport-mode seam), ADR-0024 (DOM overlays need the second
  browser harness), `GodotEditorControls.tsx` + `godotEditorCursor.ts`,
  `components/ViewportControlsHelp/bindings.ts`.

## Context

The viewport used to navigate like drei's `OrbitControls` — left-drag orbits, wheel zooms —
which is the web convention and nothing like the editor this tool previews files for. It now
reproduces Godot's own 3D editor navigation instead, cursor model and constants included.

That swap is right but it is not free. Left-drag became **deliberately inert** (it belongs to
selection, as in Godot), orbit moved to the middle button, and the app said none of this
anywhere — the bindings existed only in `docs/user-guide-web.md`. A viewport that does nothing
when you drag it reads as broken.

It also exposed two gaps Godot's editor does not have to think about, because it is a native
application receiving native input events:

- **Godot has two different bindings for what a browser reports as one event.**
  `MouseButton::WHEEL_UP`/`WHEEL_DOWN` zoom unconditionally, while `InputEventPanGesture` — a
  trackpad two-finger scroll — resolves by modifier (`node_3d_editor_plugin.cpp`, 4.6:
  orbit modifier `Key::NONE`, pan `Key::SHIFT`, zoom `Key::CTRL`, first match wins sorted by
  modifier count). A browser delivers both as `wheel`, with no reliable way to tell the
  devices apart. Godot on X11 has the same collision, from the other side: two-finger scroll
  arrives as wheel events there, so Godot-on-Linux zooms on it too (godotengine/godot#73371).
- **Godot's editor has no touch scheme at all**, so there is nothing to mirror for tablets.

## Decision

**The mouse and keyboard bindings are Godot 4.6's, exactly, and are not tuned by feel.** The
constants in `godotEditorCursor.ts` are Godot's own; where a browser number has to be mapped
onto one, the mapping is chosen to *reproduce* Godot's constant, never to replace it.

**The unmodified wheel zooms.** Where Godot's two input paths collide, the mouse wheel's own
binding takes the unmodified slot — a mouse must not orbit on scroll — and the pan-gesture
bindings take the modified ones:

| Wheel event | Action | Godot 4.6 binding it comes from |
| --- | --- | --- |
| unmodified | zoom | `WHEEL_UP`/`WHEEL_DOWN` |
| Shift + wheel | pan | pan gesture, `viewport_pan_modifier_1 = SHIFT` |
| Ctrl + wheel | zoom | pan gesture, `viewport_zoom_modifier_1 = CTRL` |

Every row is a real Godot binding. The one Godot binding that cannot be honoured is
*unmodified two-finger scroll orbits*, because in Godot that slot is already the wheel's and
the wheel's meaning is zoom. Shift+wheel is what gives a trackpad a pan gesture at all.

**Ctrl+wheel zooms the viewport, not the page.** Browsers report a trackpad pinch as a `wheel`
event with `ctrlKey` set, indistinguishable from a real Ctrl+wheel, and a pinch must zoom. So
the canvas calls `preventDefault()` and browser page-zoom does not happen over it. This is a
consequence of the pinch decision, not an independent one.

**Touch is designed for the device, and is explicitly outside the parity norm** — one-finger
drag orbits, a one-finger tap selects, two fingers pan, pinch zooms, and there is no freelook
(it needs a held button plus WASD). This is the 3D-viewer convention rather than anything
Godot does, because Godot does nothing here.

**The wheel zooms toward the pointer, not the focus point.** This is the one place the
previewer deliberately parts company with Godot; the reasoning is in the amendment below.

**A stylus navigates as one finger does**, not as a mouse. It reports
`pointerType: 'pen'`, and the mouse path would leave it inert on exactly the device class
touch was added for: a pen drag is `button: 0` with no modifiers, which navigation declines in
favour of selection, and a detached tablet has no middle button or Alt key to reach the
fallbacks with. `isGesturePointer` is the one place that decision lives. The cost is that on a
tablet-plus-mouse setup a pen drag orbits rather than selecting; a tap still selects.

**The bindings are surfaced in the app**, by `<ViewportControlsHelp>`: a summary pill always
visible over the viewport, and a panel behind it grouping every binding by device. The rows
live in `bindings.ts` as data, and each row a resolver governs carries the input that produces
it, so `bindings.test.ts` can feed every one to the real resolver and fail when the table and
the code disagree.

That guard covers the app's own table only. `docs/user-guide-web.md`, this ADR's wheel table
and `apps/textscene-vscode/README.md` are still hand-written prose and can still drift —
generating them from `bindings.ts` (the marker-block pattern `scripts/compare-docs` already
uses, with `--check` in `pnpm validate`) is the obvious next step and is not done here.

## Considered options

**A "trackpad mode" toggle**, with the gesture table behind it. Rejected: it asks the user to
answer a question the app created, and it would still have to pick a default. The modifier
split needs no toggle and regresses nobody.

**Sniff the device from the wheel event's shape** (non-zero `deltaX`, fractional `deltaY`,
event bursts) and apply Godot's gesture table when it looks like a trackpad. Rejected as
genuinely unreliable — high-resolution mice emit fractional deltas too, and the failure mode
is a mouse wheel that orbits.

**One-finger drag selects on touch, orbit on two fingers** (the Godot-faithful reading, where
one finger is the left mouse button). Rejected: it leaves pan needing three fingers or a
modifier a tablet cannot supply, and pan is the gesture most wanted.

**Centre zoom, as Godot does it.** Reverted — see the amendment below.

## Consequences

- The two viewports still disagree about what zoom *is* — a CSS scale factor in 2D, an orbit
  radius in 3D — but no longer about where a WHEEL zoom goes: both anchor to the pointer (see
  the amendment). Recorded in CONTEXT.md's flagged ambiguities rather than papered over. What
  still differs is touch **pinch** — 2D anchors it to the fingers' midpoint, 3D scales about
  the focus point.
- Wheel deltas must be normalised before use — by zoom, by pan, and in **both** viewports:
  one notch is 100px in Chrome but 3 lines in Firefox. `wheelDeltaPixels` / `wheelNotches` are
  the single normalisation every path calls; skipping it produces a ~33x cross-browser
  divergence, and scaling per EVENT rather than per notch zooms a trackpad roughly an order of
  magnitude faster than a mouse for the same physical gesture.
- Browser input geometry — touch gestures AND wheel-delta normalisation — lives in
  `pointerGesture.ts`, not `godotEditorCursor.ts`. Godot's editor has no touch scheme, and its
  native input events carry no `deltaMode`, so putting either in the module whose contract is
  "constants are Godot's own" would make that claim false. Of the wheel path,
  `godotEditorCursor.ts` keeps what IS Godot's — `WHEEL_ZOOM_MULTIPLIER` and the modifier
  split in `resolveWheelMode` — and calls into `pointerGesture.ts` for the notch
  normalisation, which is a browser fact rather than a Godot one. It also lets the 2D stage —
  which has no editor cursor — share the lot without importing the 3D navigation module.
  A third module, `zoomToPointer.ts`, holds deliberate departures from Godot's cursor maths;
  the split is by provenance, and each module's header states which it is.
- Zoom scales exponentially in notches (`1.08 ** notches`), not linearly, so a trackpad's
  stream of small events zooms exactly as far as one large event over the same distance.
- `touch-action: none` on the 3D canvas container is load-bearing — r3f sets none of its own,
  and without it the browser claims the gesture before any `pointermove` fires.
- The controls pill is a DOM overlay over the viewport, so it falls under ADR-0024: the WebGL
  goldens cannot see it and happy-dom has no layout. It is painted out of every capture by
  testid, and its load-bearing CSS is asserted against the module source.

## Amendment (2026-07-28): the wheel zooms toward the pointer

Godot's `scale_cursor_distance` edits `cursor.distance` and nothing else, so zooming always
flies at the focus point — which load-time framing put at the centre of the **whole scene**.
Shipping that verbatim made close inspection of large scenes genuinely tedious, which is how it
was reported: *"some scenes got very difficult to navigate around in when I had zoomed in."*

The speeds were not the problem, and are unchanged: pan is `distance / 600` units per pixel,
zoom is multiplicative, and orbit's on-screen sweep is proportional to distance — all three
already scale with how far out you are. Two things did not:

- **Zoom pulls toward the scene centre.** Zoom in on anything off-centre and it slides away,
  and recovering costs a stack of pan drags precisely because pan has correctly gone slow.
- **The zoom floor is proportional to the whole scene.** `frameSceneBounds` sets
  `near = D/200` for a scene framed at `D`, and the clamp is `min = near * 4` — so the closest
  approach is `D/50`, a fixed 50x from the opening view however small the detail. Godot has the
  identical floor and considers it painful enough to show *"To zoom further, change the
  camera's clipping planes"* after fifteen stuck attempts.

**Decision:** `zoomCursorToPointer` keeps the point under the pointer, on the focus plane,
under the pointer — shifting the target by the difference the shrinking plane leaves behind.
No raycast, so it behaves the same over empty space as over a mesh, and orthographic works
unchanged since its frustum derives from the same distance and fov. A clamped zoom moves the
eye nowhere and therefore the target nowhere, so hitting the floor stops dead rather than
creeping sideways. It lives in `zoomToPointer.ts`, not `godotEditorCursor.ts`, because that
module's contract is that everything in it is Godot's.

**Consequence:** this does not raise the zoom floor — it only makes the range you have land
where you are looking. `F` on a selected node still reframes on that node's bounds, which
recomputes `near` from its size and lowers the floor proportionally; that remains the answer
for inspecting something small inside something large, and the controls legend now says so.

This covers the **wheel**, which is also how a trackpad pinch arrives (ctrl+wheel), so that
anchors too. Touch pinch still scales about the focus point: it is measured from the gesture's
own anchor rather than per-event, so reusing this would mean threading that anchor through.
Left deliberately — fingers physically holding the screen make the drift far less noticeable
than a wheel does.

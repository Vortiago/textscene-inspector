# Viewport navigation mirrors Godot's editor, and the browser's one wheel event goes to zoom

- Status: Accepted
- Related: ADR-0006 (viewport-mode seam), ADR-0024 (DOM overlays need the second
  browser harness), `GodotEditorControls.tsx` + `godotEditorCursor.ts`,
  `components/ViewportControlsHelp/bindings.ts`.

## Context

The viewport reproduces Godot's own 3D editor navigation, cursor model and constants
included, not the web convention of drei's `OrbitControls` (left-drag orbits, wheel
zooms). Left-drag is therefore inert on purpose (it belongs to selection, as in Godot),
and orbit is on the middle button. A viewport that does nothing when you drag it reads as
broken unless the app shows its bindings.

A browser also has two gaps that Godot's editor, a native application with native input
events, does not have:

- **Godot has two bindings for what a browser reports as one event.**
  `MouseButton::WHEEL_UP`/`WHEEL_DOWN` zoom unconditionally. `InputEventPanGesture`, a
  trackpad two-finger scroll, resolves by modifier (`node_3d_editor_plugin.cpp`, 4.6:
  orbit modifier `Key::NONE`, pan `Key::SHIFT`, zoom `Key::CTRL`, first match wins, sorted
  by modifier count). A browser delivers both as `wheel`, with no reliable way to tell the
  devices apart. Godot on X11 has the same collision from the other side: two-finger
  scroll arrives as wheel events, so Godot on Linux zooms on it too
  (godotengine/godot#73371).
- **Godot's editor has no touch scheme**, so there is nothing to mirror for tablets.

## Decision

**The mouse and keyboard bindings are Godot 4.6's, exactly, and are not tuned by feel.**
The constants in `godotEditorCursor.ts` are Godot's own. Where a browser number maps onto
one, the mapping reproduces Godot's constant and does not replace it.

**The unmodified wheel zooms.** Where Godot's two input paths collide, the mouse wheel's
own binding takes the unmodified slot (a mouse must not orbit on scroll), and the
pan-gesture bindings take the modified ones:

| Wheel event | Action | Godot 4.6 binding it comes from |
| --- | --- | --- |
| unmodified | zoom | `WHEEL_UP`/`WHEEL_DOWN` |
| Shift + wheel | pan | pan gesture, `viewport_pan_modifier_1 = SHIFT` |
| Ctrl + wheel | zoom | pan gesture, `viewport_zoom_modifier_1 = CTRL` |

Each row is a real Godot binding. The one Godot binding the previewer cannot honour is
"unmodified two-finger scroll orbits", because in Godot that slot is the wheel's, and the
wheel's meaning is zoom. Shift+wheel gives a trackpad its pan gesture.

**Ctrl+wheel zooms the viewport, not the page.** A browser reports a trackpad pinch as a
`wheel` event with `ctrlKey` set, the same as a real Ctrl+wheel, and a pinch must zoom.
So the canvas calls `preventDefault()`, and browser page-zoom does not happen over it.
This follows from the pinch decision.

**Touch is designed for the device, and is outside the parity norm.** One-finger drag
orbits, a one-finger tap selects, two fingers pan, pinch zooms, and there is no freelook
(it needs a mouse to look and a keyboard to move). This is the 3D-viewer convention, because Godot does
nothing here.

**The wheel zooms toward the pointer, not the focus point.** This is the one place the
previewer departs from Godot on purpose. See the amendment below.

**A stylus navigates as one finger does**, not as a mouse. It reports
`pointerType: 'pen'`, and the mouse path would leave it inert on the device class touch
exists for. A pen drag is `button: 0` with no modifiers, which navigation declines in
favour of selection, and a detached tablet has no middle button or Alt key for the
fallbacks. `isGesturePointer` is the one place that decision lives. The cost: on a
tablet-plus-mouse setup a pen drag orbits and does not select. A tap still selects.

**The app shows the bindings**, through `<ViewportControlsHelp>`: a summary pill always
visible over the viewport, and a panel behind it that groups each binding by device. The
rows live in `bindings.ts` as data. Each row that a resolver governs carries the input
that produces it, so `bindings.test.ts` feeds each one to the real resolver and fails
when the table and the code disagree.

That guard covers the app's own table only. `docs/user-guide-web.md`, this ADR's wheel
table and `apps/textscene-vscode/README.md` are hand-written prose and can drift.

## Considered options

**A "trackpad mode" toggle**, with the gesture table behind it. Rejected. It asks the
user a question the app created, and it still needs a default. The modifier split needs
no toggle and regresses nobody.

**Sniff the device from the wheel event's shape** (non-zero `deltaX`, fractional
`deltaY`, event bursts), and apply Godot's gesture table when it looks like a trackpad.
Rejected as unreliable. High-resolution mice emit fractional deltas too, and the failure
is a mouse wheel that orbits.

**One-finger drag selects on touch, orbit on two fingers** (the Godot-faithful reading,
where one finger is the left mouse button). Rejected. Pan then needs three fingers or a
modifier a tablet cannot supply, and pan is the gesture users want most.

**Centre zoom, as Godot does it.** Rejected. See the amendment below.

## Consequences

- The two viewports disagree about what zoom is: a CSS scale factor in 2D, an orbit
  radius in 3D. They agree about where a wheel zoom goes: both anchor to the pointer (see
  the amendment). GLOSSARY.md lists this in its flagged ambiguities. Touch **pinch**
  differs: 2D anchors it to the fingers' midpoint, and 3D scales about the focus point.
- Wheel deltas must be normalised before use, by zoom and by pan, in **both** viewports.
  One notch is 100px in Chrome but 3 lines in Firefox. `wheelDeltaPixels` /
  `wheelNotches` are the single normalisation each path calls. Without it, the browsers
  diverge by about 33 times. Scaling per event, not per notch, zooms a trackpad about an
  order of magnitude faster than a mouse for the same physical gesture.
- Browser input geometry, touch gestures and wheel-delta normalisation, lives in
  `pointerGesture.ts`, not `godotEditorCursor.ts`. Godot's editor has no touch scheme,
  and its native input events carry no `deltaMode`, so either one in the module whose
  contract is "constants are Godot's own" would make that claim false. Of the wheel path,
  `godotEditorCursor.ts` keeps what is Godot's: `WHEEL_ZOOM_MULTIPLIER` and the modifier
  split in `resolveWheelMode`. It calls into `pointerGesture.ts` for the notch
  normalisation, which is a browser fact. The 2D stage, which has no editor cursor, then
  shares all of it without importing the 3D navigation module. A third module,
  `zoomToPointer.ts`, holds deliberate departures from Godot's cursor maths. The split is
  by provenance, and each module's header states which it is.
- Zoom scales exponentially in notches (`1.08 ** notches`), not linearly, so a
  trackpad's stream of small events zooms as far as one large event over the same
  distance.
- The 3D canvas container needs `touch-action: none`. r3f sets none of its own, and
  without it the browser claims the gesture before any `pointermove` fires.
- The controls pill is a DOM overlay over the viewport, so it falls under ADR-0024. The
  WebGL goldens cannot see it, and happy-dom has no layout. Each capture paints it out by
  testid, and a test asserts its load-bearing CSS against the module source.

## Amendment: the wheel zooms toward the pointer

Godot's `scale_cursor_distance` edits `cursor.distance` and nothing else, so zoom always
flies at the focus point, which load-time framing puts at the centre of the **whole
scene**. That makes close inspection of a large scene tedious.

The speeds are correct. Pan is `distance / 600` units per pixel, zoom is multiplicative,
and orbit's on-screen sweep is proportional to distance. All three scale with how far
out you are. Two things do not:

- **Zoom pulls toward the scene centre.** Zoom in on anything off-centre and it slides
  away, and recovery costs many pan drags, because pan has correctly gone slow.
- **The zoom floor is proportional to the whole scene.** `frameSceneBounds` sets
  `near = D/200` for a scene framed at `D`, and the clamp is `min = near * 4`. So the
  closest approach is `D/50`, a fixed 50 times from the opening view, however small the
  detail. Godot has the same floor, and shows "To zoom further, change the camera's
  clipping planes" after fifteen stuck attempts.

**Decision:** `zoomCursorToPointer` keeps the point under the pointer, on the focus
plane, under the pointer. It shifts the target by the difference the shrinking plane
leaves behind. There is no raycast, so it behaves the same over empty space as over a
mesh. Orthographic works unchanged, because its frustum derives from the same distance
and fov. A clamped zoom moves the eye nowhere and so the target nowhere, so the floor
stops dead and does not creep sideways. It lives in `zoomToPointer.ts`, not
`godotEditorCursor.ts`, because that module's contract is that everything in it is
Godot's.

**Consequence:** this does not raise the zoom floor. It only makes the range you have
land where you look. `F` on a selected node reframes on that node's bounds, which
recomputes `near` from its size and lowers the floor proportionally. That is the answer
for inspecting something small inside something large, and the controls legend says so.

This covers the **wheel**, which is also how a trackpad pinch arrives (ctrl+wheel), so a
trackpad pinch anchors too. Touch pinch scales about the focus point. It is measured from
the gesture's own anchor, not per event, so reuse would mean threading that anchor
through. It stays so on purpose: fingers that hold the screen make the drift far less
noticeable than a wheel does.

## Amendment: navigation is off during a camera preview

Godot's editor ignores every navigation input while it previews a Camera3D
(`node_3d_editor_plugin.cpp:1826-1829`), and keeps its editor camera apart from the
previewed one. The previewer does the same: `useEditorNavigation` drops each input while
R3F draws through a camera other than the **Editor camera**. A gesture never moves an
authored Camera3D, so its next preview shows the pose the scene file gives it.

Godot has no Reset Camera. The previewer's Reset Camera ends a preview and then poses the
**Editor camera**, so the pose it sets is the one on screen.

## Amendment: freelook has a toggle, and three keys of the previewer's own

Godot's freelook has two ways in: the held right button, and the `Shift+F` toggle
(`node_3d_editor_plugin.cpp:9962`, `2741-2746`). Both run one state, `r3f/freelook.ts`: whether it
is on, the held flight keys and the speed. The rules are Godot's:

- The wheel changes the flight speed while freelook is on, and does not zoom (`:1880-1888`). The
  speed holds to the zoom range (`:3034-3041`) and lasts for the life of the canvas.
- Shift flies 3 times faster and Alt 3 times slower (`:3122-3127`).
- Freelook does not exist in orthographic view, where the right button pans (`:2375-2383`,
  `:2741-2742`), or in a camera preview (`:1826-1829`).
- Every key event is accepted while freelook is on (`:2768-2772`), so no other shortcut fires.
- It ends on Escape, on `Shift+F` and when the window loses focus (`:2545-2546`, `:3579-3581`).

**The toggle is the pointer lock.** Godot captures the mouse (`:2985`), and the browser's
equivalent is Pointer Lock. "Freelook is toggled on" and "the canvas holds the lock" are one
fact, read from `pointerlockchange`, so the two cannot disagree. The browser ends a lock on Escape
by itself, so no page code can break the exit. A locked pointer has no position, so the canvas
picks nothing while it is toggled.

**The arrow keys and Space fly too. This departs from Godot.** The arrows fly as W A S D do, and
Space flies up, as E does. Godot's viewport binds no arrow key, and its Space maximises the
viewport, which the previewer cannot do. The keys sit in a table of their own in
`editorKeyBindings.ts`, apart from Godot's.

**No Ctrl key flies.** A held Ctrl turns each flight key into a chord, and Ctrl+W closes a browser
tab, which no page can prevent. In VS Code the webview forwards the chord to the workbench, where
Ctrl+W closes the preview and Ctrl+Shift+W closes the window. Down stays on Q, Godot's key.

**The toolbar has a Freelook button**, for a user who does not know the shortcut. It reaches the
canvas through `ViewportActionsContext`, as Reset Camera does, so `@textscene/renderer`, which
ships no toolbar, gains no export: its canvas has the `Shift+F` toggle alone.

### Considered options

**A fly control from drei** (`FlyControls`, `PointerLockControls`). Rejected. Each owns the camera,
and every gesture here edits the **Editor cursor**, so framing, zoom and orbit stay correct after
a flight.

**A toggle with no pointer lock**, where the mouse turns the camera only while a button is held.
Rejected. The pointer stops at the screen edge, and so does the turn.

**A flight speed that follows the scene's size.** Rejected. Godot has the setting,
`freelook_speed_zoom_link`, and it is off by default (`editor_settings.cpp:963`). The wheel gives
the control, with the speed on screen.

### Consequences

- `TscnCanvas` takes every key while freelook is on, through one capture-phase listener on
  `window`. A page that embeds `@textscene/renderer` loses `Shift+F` to it at all times.
- The toggle moves keyboard focus to the canvas. Space would otherwise press the toolbar button
  that started it.
- The test DOM has no Pointer Lock. `r3f/testing/fakePointerLock.ts` stands in for the browser,
  and `scripts/visual` cannot reach the lock, so no golden covers freelook.

## Amendment: the Editor camera opens with Godot's clip planes

The canvas sets `near = 0.05` and `far = 4000`, Godot's `editors/3d/default_z_near` and
`default_z_far` (`editor_settings.cpp:931-932`). It used three's defaults, 0.1 and 1000, so the
zoom floor of an unframed scene was 0.4 units where Godot's is 0.2. Reset Camera restores the two
planes, since a framing narrows them to its node.

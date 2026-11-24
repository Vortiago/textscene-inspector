# @textscene/renderer

`@textscene/renderer` draws a Godot `.tscn` scene in the browser. You open the scene, change its
nodes from your code, and mount a view of it, with React or with no React code of your own. It is
the renderer of the [TextScene Inspector](https://github.com/Vortiago/textscene-inspector), whose
VS Code extension and web previewer use this same surface. The package is one ES module. React and
three.js are peer dependencies, so your app keeps one copy of each.

The package is not a 1:1 copy of Godot. Each node type has a comparison sheet that lists what the
renderer supports and where it differs from Godot 4.6. The
[index of the sheets](https://github.com/Vortiago/textscene-inspector/blob/main/docs/comparison/README.md)
links every one of them.

## Install

```bash
npm install @textscene/renderer react react-dom three @react-three/fiber
```

The renderer takes the text of a scene and parses it itself. The peer dependencies are
`react`, `react-dom`, `three` and `@react-three/fiber`.
`package.json` names the supported versions. The renderer patches three.js shaders, so a `three`
version outside that range can draw wrongly.

## Use

`openScene` opens the text of a scene. `<TscnCanvas scene={scene} mode="in-game" />` draws it as
the game draws it when it starts.

```tsx
import { TscnCanvas, openScene, type ResourceProvider } from '@textscene/renderer';

// Loads a scene's `res://` files: text for a text file, bytes for any other file, null for a miss.
const provider: ResourceProvider = {
  async loadResource(path) {
    const response = await fetch(`/game/${path.slice('res://'.length)}`);
    if (!response.ok) return null;
    return /\.(tscn|tres|godot)$/.test(path) ? response.text() : response.arrayBuffer();
  },
};

// `source` is the text of a `.tscn` file.
const scene = openScene({ source, provider });

export function GameView() {
  return (
    <div style={{ width: 640, height: 360 }}>
      <TscnCanvas scene={scene} mode="in-game" />
    </div>
  );
}
```

`<TscnCanvas>` fills its parent, so give the parent a size.

### Open the scene in a component

A component that opens its own scene disposes it when it unmounts, so the scene stops loading its
files.

```tsx
import { useEffect, useState } from 'react';
import { TscnCanvas, openScene, type Scene } from '@textscene/renderer';

export function SceneView({ source }: { source: string }) {
  const [scene, setScene] = useState<Scene | null>(null);
  useEffect(() => {
    const opened = openScene({ source, provider });
    setScene(opened);
    return () => opened.dispose();
  }, [source]);
  return scene && <TscnCanvas scene={scene} mode="in-game" />;
}
```

A new `source` opens a new scene here. To keep one scene and change its text, see "Change the scene
from your code".

### The In-game mode

The In-game mode draws the root viewport of the scene as the game starts it:

- The scene's own cameras. Of two current Camera3D nodes, the last one in the tree wins, and with
  none current the first one wins. A 3D scene with no Camera3D shows the clear colour. A 2D scene
  draws through its Camera2D. A call from your code moves the camera: see "Set the camera".
- The 3D world first, then the canvas items, the Controls and each CanvasLayer over it.
- The lighting of the game: the camera's Environment, else the scene's WorldEnvironment, else the
  project's default Environment, else none. No preview sun and no preview sky.
- No editor element: no gizmo, icon, grid, collision shape, path or navigation overlay. A light
  with `editor_only` gives no light.
- No camera navigation and no input: a click selects nothing.

Scripts do not run. The view shows the scene as Godot loads it, before any script changes it.

The provider serves `res://project.godot` when the project has one. The mode reads the window size,
the stretch settings, the clear colour, the transparent background and the default Environment from
it. The window is the size `display/window/size/*` gives it, also under a fullscreen window mode.
`display/window/stretch/*` maps the scene into the window as the game does, with black bars where
the aspect is kept. The window fits into the element at one scale. A resize of the element changes
that fit, not the window size.

Draw one view per page. The Decal atlas and the area light atlas are shared by every view on a
page, and #1005 gives each view its own.

### Change the scene from your code

The scene is the interface a script would use. Find a node, then read and write its properties, and
every view of the scene draws the change.

```tsx
import { openScene, variant } from '@textscene/renderer';

const scene = openScene({ source, provider });

await scene.getNode('HUD/Score').set('text', 'Score: 10');
await scene.getNode('%Player').set('position', variant('Vector3(4, 0, 2)'));
const visible = await scene.getNode('Enemy').get('visible');
```

- **Find.** `scene.getNode(path)` follows a NodePath as Godot's `get_node` does: from the root node
  of the scene, with `..`, `%Name`, and `/root` for the root window. A miss throws Godot's
  `Node not found` message, and `getNodeOrNull` answers `null`. A node inside a sub-scene is found
  once that sub-scene loads. `scene.observe(null, listener)` tells you when the tree changes.
- **Node handles.** A handle has `path`, `name`, `type` (the Godot class), `getNode`,
  `getNodeOrNull`, `getParent`, `getChildren` and `isInsideTree`. Two lookups of one node give the
  same handle. `scene.setSource(text)` frees every node: an old handle answers
  `isInsideTree() === false`, and a write to it throws.
- **Read and write.** `get(property)` and `set(property, value)` take every property of the class
  and its bases. They return promises, since the class table loads on the first call. `get` answers
  the last write, else the value in the file, else the class default. `set` answers `true` where
  Godot reports the write valid. A name the class does not have answers `false` and warns once.
- **Values.** A boolean, a number and a string pass as they are, and convert to the type of the
  property as Godot converts them. A whole number is an `int`. Any other type is `variant(text)`,
  with the text as a `.tscn` file spells it. `get` answers in the same forms.
- **Resources.** `await scene.load('res://icon.png')` gives a value that a property of a resource
  type takes, so you can swap a texture, a mesh, a material or a theme. A missing file draws as a
  missing resource.
- **Resources the scene file holds.** Name a `[sub_resource]` by its path, as Godot's `load` does:
  `scene.load('res://main.tscn::SphereMesh_1')` or `variant('Resource("res://main.tscn::SphereMesh_1")')`,
  with the path the scene opens under. `SubResource("…")` has a meaning only inside a file: Godot
  reads `variant('SubResource("SphereMesh_1")')` as the file `res://SphereMesh_1`.
- **The class of a resource.** A resource of a class the property does not take writes `null`, and
  `set` answers `false`, as in Godot.
- **Redraw.** The writes of one task draw one frame. A write before any view mounts shows on the
  first frame. `scene.observe(path, listener)` tells you when that node is written.

### Set the camera

A host's code moves the camera of a viewport as a script does, with `call`:

```tsx
await scene.getNode('Cameras/Close').call('make_current');
await scene.getNode('Cameras/Close').call('clear_current', false);
const current = await scene.getNode('/root').call('get_camera_3d');
```

- **Camera3D.** `make_current`, `clear_current(enableNext = true)` and `is_current`.
  `set('current', value)` runs `set_current`, and `get('current')` runs `is_current`. With
  `enableNext`, the next camera of the viewport takes over. Without it, the viewport draws the clear
  colour.
- **Camera2D.** `make_current` and `is_current`. `make_current` on a camera that is not enabled
  changes nothing and warns. `set('enabled', false)` on the current camera passes the view to the
  first enabled camera in the tree.
- **Viewport.** `get_camera_3d` and `get_camera_2d` give the handle of the current camera, or `null`.
  The root window is `/root`. Each SubViewport keeps its own camera.
- **Setters and getters.** `call('set_<property>', value)` and `call('get_<property>')` reach `set`
  and `get`, by the names Godot gives them. Any other method throws with the class and the method.
- **Errors.** Where Godot's `call` prints an error, `call` throws with the same text: a wrong count
  of arguments, or an argument it cannot convert, such as a string for a bool. `set('current', value)`
  converts the value as Godot's `set` does, and answers `false` when the conversion is not exact.

`scene.cameras()` lists every camera inside the tree by its live path, with its viewport (`null` for the
root window), `isCurrent`, and `canBeCurrent`, which is false for a Camera2D that is not enabled. A
camera list in your page reads it, and `scene.subscribe` tells you when a call or a load moves it.

The In-game mode draws through the current camera. The 3D mode keeps its editor camera, until the
`camera` option looks it through a Camera3D: see "Look through a camera in the 3D mode".

The limits of this release:

- No node is added, removed, moved or renamed. `set` of `script`, `instance` or `name` throws.
- A write replaces a whole property. A write inside a resource, such as the colour of a material,
  is not possible: swap the whole resource.
- A property that Godot computes from the layout, such as the `size` and `position` of a `Control`,
  throws with the name of the property. So do a running property, such as `playing`, and the global
  transform of a `Node2D` under a `Control` (#2003).
- Most setters store the value as Godot casts it, and run none of their own checks. The global
  transforms, the anchors of a `Control`, `frame_coords` and `volume_linear` run Godot's setter
  (#2002).
- `get` of a property that a scene pass drives, such as the target of a `RemoteTransform3D`, answers
  the value under the pass.
- Scripts do not run, no signal reaches your code, and no input reaches the scene.

### Know when the scene is whole

A view is settled when a frame shows the scene whole: the frame drew the latest change to the scene,
no file, texture or font of the scene was still loading, and in the 3D mode the frame drew through
the Camera3D that `camera` names. This holds in every mode. A write or a
camera call from your code, or a new text, makes it pending again until a frame shows the change.

`view.settled` resolves to `{ scriptedNodeCount, hasCurrentCamera }`: the count of nodes that hold
a script, which do not run, and whether the root viewport has a current Camera3D or Camera2D. Both
are facts of the game's start, so the 3D and 2D modes give the same value. Which files load is a
fact of the scene, not of the view: see "Know which files are missing".

`mountScene` returns the view. In React, the `ref` of `<TscnCanvas>` gives its `settled`,
`captureImage` and `status`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { TscnCanvas, type View } from '@textscene/renderer';

export function GameView() {
  const view = useRef<Pick<View, 'settled' | 'captureImage' | 'status'>>(null);
  const [status, setStatus] = useState('Loading…');
  useEffect(() => {
    view.current?.settled.then(
      ({ scriptedNodeCount }) =>
        setStatus(`${scriptedNodeCount} nodes hold a script, and scripts do not run.`),
      () => {} // The view unmounted before it settled.
    );
  }, []);
  return (
    <>
      <div style={{ width: 640, height: 360 }}>
        <TscnCanvas ref={view} scene={scene} mode="in-game" />
      </div>
      <p>{status}</p>
    </>
  );
}
```

Each read of `settled` gives a new promise, which rejects once the view unmounts.

### Read the view's status

`view.status()` gives what the view reports of itself now, as one object:

- `settled`: the settled value, or `null` while the view is pending.
- `pending`: `{ textures, fonts }`, the textures and fonts still building on the page. Two views
  on one page count each other's. The files that still load are in `scene.files()`.
- `frame`: the last window of frame numbers, or `null` before the first window. A window lands
  twice a second and holds `fps`, `frameMs`, `cpuMs`, `drawCallsPerFrame`, `objectsPerFrame` and
  `primitivesPerFrame`. The objects and primitives are those of Godot's editor monitor: each
  surface the view draws is one object, and so is each draw of its shadow passes. While
  `show.performance` is on, `timings` holds the GPU time and the time of each render step too.
  A GPU time costs a timer query per step, so without `show.performance` there is no `timings`.
  The performance panel shows the same numbers.
- `undrawn`: each node the view holds and does not draw, sorted by path. An entry has the node's
  absolute `path`, as a node handle gives it, its `meshTypes` that no part of the view draws, and
  `isEmptyShape` for a CSG shape whose brush is empty. Godot warns of an empty shape too.
- `isSoftwareRendering`: the browser draws the view's WebGL on the CPU, so every frame is slow.
- `freelook`: the 3D editor camera's freelook, `{ isToggled, isAvailable }`, or `null` outside the
  3D mode. See "Move the editor camera".

`status()` gives the same object while nothing in it changes. The option `onStatusChange` calls
your function with the new status on each change, but not for the frame numbers, which change
twice a second. Read `status()` for them. A host hears a settled view turn pending again, for
example after a write or a file that changed:

```ts
const view = mountScene(element, scene, {
  onStatusChange: (status) => {
    badge.textContent = status.settled ? 'Ready' : 'Loading…';
  },
});
```

### Know which files are missing

`scene.files()` gives one entry for each `res://` file the scene loads, sorted by path:

- `path`, and `type`: the type the `[ext_resource]` heading gives, or null.
- `state`: `loading`, `loaded` or `missing`. `missing` is a file the game would fail to load.
- `owners`: the files that read it. The project settings name `res://project.godot` as owner.
- `reason`: for a missing file, `{ chain, cause, addresses }`. `chain` holds the file, each text
  file through which it fails, and the file that failed first. `cause` is `missing`, `unparsed`
  or `unimported`. `addresses` holds each sub-resource address the file does not declare, where
  the file loads but these addresses fail. Godot's dialog gives each of them a row. Null for a
  file that is not missing.
- `addresses`: each sub-resource address inside the file that the scene reads, such as
  `res://wood.tres::Material_1`.

The list follows each file the scene's values read, as Godot's Load Errors dialog does: a
sub-scene and a `.tres` add the files that they read. A file that a heading declares and no value
reads is not in the list, as it is in no Godot list. The engine reads `res://project.godot`, which
is in the list when the project has one, with the environment, theme and font that it names.

The list does not wait for a view. It follows the scene with your writes: a write that stops the
last value that reads a file takes the file off, and a file that `scene.load` gives joins the list.
`scene.subscribe` tells you when the list changes, and `files()` gives the same array while nothing
changes.

### Mount the view with no React code

`mountScene(element, scene, { mode, visible, camera, show })` mounts the view in a page element, for a page with
no React code of its own. React stays a peer dependency. `mode` is the mode of `TscnCanvas`, and
here it is `'in-game'` by default. The page changes the scene through the same `scene`, as a React app does.

A whole page, with a button that saves the window as a PNG file:

```html
<!doctype html>
<html>
  <body>
    <div id="game" style="width: 640px; height: 360px"></div>
    <p id="status">Loading…</p>
    <p id="missing"></p>
    <button id="save" disabled>Save PNG</button>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

```ts
// main.ts
import { mountScene, openScene } from '@textscene/renderer';

// Every res:// path of the scene loads from the folder of the project on this site.
const provider = {
  async loadResource(path: string) {
    const response = await fetch(`/project/${path.slice('res://'.length)}`);
    if (!response.ok) return null;
    return /\.(tscn|tres|godot|gd|gdshader)$/.test(path) ? response.text() : response.arrayBuffer();
  },
};

const source = await (await fetch('/project/main.tscn')).text();
const scene = openScene({ source, provider, rootScenePath: 'res://main.tscn' });
const view = mountScene(document.getElementById('game')!, scene);

const { scriptedNodeCount, hasCurrentCamera } = await view.settled;
document.getElementById('status')!.textContent = hasCurrentCamera
  ? `Settled. ${scriptedNodeCount} nodes hold a script, and scripts do not run.`
  : 'Settled, with no current camera.';

// The list follows the scene: a write that stops reading a file takes it off.
const showMissing = () =>
  (document.getElementById('missing')!.textContent = scene
    .files()
    .filter((file) => file.state === 'missing')
    .map((file) => file.path)
    .join(', '));
showMissing();
scene.subscribe(showMissing);

const save = document.getElementById('save') as HTMLButtonElement;
save.disabled = false;
save.onclick = async () => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await view.captureImage());
  link.download = 'scene.png';
  link.click();
  URL.revokeObjectURL(link.href);
};
```

`mountScene` returns a `View` with five members:

- `settled`: a promise of the settled value, in every mode. Each read gives a new promise, which
  waits again after the scene changes. It rejects once the view is disposed.
- `status()`: what the view reports of itself now. See "Read the view's status".
- `captureImage()`: a PNG `Blob` of what the view draws. It rejects before the view is settled, and
  the message names the pending work.
  - In-game, it is the game window at the window's size, whatever the size of the element: 1152 x
    648 for a project that sets no size. It has the black bars of the window. Where the project has
    a transparent background, the clear colour has alpha 0 and the bars stay opaque, as in Godot.
  - In the 3D and 2D modes, it is the canvas at its own size: the element's size times the device
    pixel ratio. The 2D mode's rulers, axes and zoom buttons are not part of it.
- `update(options)`: changes the mounted view. It takes the options of `mountScene` and changes
  only the keys it gives a value. See "Change a mounted view".
- `dispose()`: unmounts the view and loses its WebGL context, since a browser keeps few contexts
  alive. The scene stays open, so another view can mount it.

### Change a mounted view

`update` switches the mode, and stops or starts the frames, of a view that is mounted:

```ts
const view = mountScene(document.getElementById('game')!, scene);

// The editor's 3D view of the same scene. Every write to the scene stays.
view.update({ mode: '3D' });

// A hidden panel draws no frame. A load, a settle and a capture still draw the frames they need.
view.update({ visible: false });
view.update({ visible: true });
```

A change of mode replaces the canvas and loses the WebGL context of the old one. A `settled`
promise read before a switch resolves once the new mode settles. `update` throws once the view is disposed. A
view that failed to mount stays failed: dispose it and mount again.
`visible` is `true` by default. While it is `false`, the view draws only the frames a load, a settle or a capture needs: a write to a
hidden view draws until the view settles again.
`<TscnCanvas visible={false} />` does the same in React.

### Look through a camera in the 3D mode

`camera` looks the 3D mode through a Camera3D of the scene, as the Preview check box of a Camera3D
does in the Godot editor. The view draws what the game draws through that camera: its projection,
`fov` or `size`, `near` and `far`, `keep_aspect` and the offsets. `null`, the default, gives the
editor camera, at the pose it had before the look, as in Godot:

```ts
const view = mountScene(element, scene, { mode: '3D', camera: 'Rig/TopCamera' });

view.update({ camera: 'Player/Camera3D' });
view.update({ camera: null });
```

The path is from the scene's root, as `scene.getNode` takes it. A node there that is not a
Camera3D throws, with the type found. A path that names no node yet does not throw, since a
sub-scene can still be loading: the view draws through the camera once the load brings it in,
and through the editor camera until then. If the path still names no Camera3D once the loads end,
`settled` rejects with the path in the message. A camera that leaves the scene ends the look, as in Godot, also when a node comes back at the path:
set `camera` to `null` and then to the path to look again. The option does not make the camera
current, and the In-game mode keeps the current camera: use `call('make_current')` for that.
`<TscnCanvas camera="Rig/TopCamera" />` does the same in React. As with `update`, a prop left out,
or `undefined`, keeps what the view looks through now, and `null` gives the editor camera.

### Move the editor camera

`view.editorCamera` is the editor camera of the mode the view is in: a `Camera3D` in the 3D mode
and a `Camera2D` in the 2D mode, as a node handle. It is `null` in the In-game mode, which draws
through the game's own camera. The view owns it: it is not in the scene, so `scene.getNode`,
`getChildren` and `scene.cameras()` never give it. Each mode keeps one camera for the life of the
view. A read or a write waits for its mode to draw, and rejects once the view ends. A switch to
another mode and back finds the camera of a scene where it was left, as in Godot.

```ts
const view = mountScene(element, scene, { mode: '3D' });

await view.editorCamera?.call('focus', '/root/Main/Player');
await view.editorCamera?.set('fov', 50);
await view.editorCamera?.call('reset');
```

- **3D.** `get` gives `transform`, `position`, `fov`, `near`, `far` and `projection` (`0`
  perspective, `1` orthogonal, the two that Godot's editor viewport has). `set` takes `transform`,
  `position`, `fov`, `projection` and `freelook`. A new `transform` puts the eye at its origin,
  looking along its basis, and keeps the orbit distance. A new `position` moves the eye, and the
  camera keeps looking at its focus point. A `fov` outside 1 to 179 keeps the old one, as Godot
  does. `call('focus', path)` frames the node at an absolute path, as F does, and `call('focus')`
  frames the whole scene. Both do nothing while the view looks through a scene camera.
  `call('reset')` returns the camera to Godot's opening pose and ends freelook.
- **2D.** `position` is the canvas point at the centre of the view, and `zoom` its magnification,
  a `Vector2` with the same value on both axes, as the 2D editor has one zoom. `call('focus',
  path)` frames the node as Shift+F does, and `call('center', path)` centres it as F does. With no
  path, both go to the origin, as Godot does with nothing selected. `call('frame_camera_view',
  path)` shows what the Camera2D at that path shows on the project's screen: its centre after the
  anchor, the limits and the offset, at its zoom. Godot answers that centre only for the current
  camera, so this call frames any Camera2D. `call('reset')` returns the view to the one the scene
  opened at.

To keep a pose per scene, as Godot does in its editor settings, read `transform` and `projection`,
or `position` and `zoom`, and write them back when the scene opens again.

`view.status().freelook` gives `{ isToggled, isAvailable }` in the 3D mode and `null` in the
others, and `onStatusChange` tells you when it changes, as on Shift+F or Escape. It is the one read
of freelook: the camera node takes the write. `isAvailable` is `false` in the orthogonal
projection, which has no freelook. The `TscnCanvas` ref gives `editorCamera` too.

### Learn which node a click picked

`onSelect` hears the node a click picks in the 3D mode, and `selected` sets the node the view
outlines:

```ts
const view = mountScene(document.getElementById('game')!, scene, {
  mode: '3D',
  onSelect(node) {
    console.log(node ? node.path : 'a click on nothing');
  },
});

view.update({ selected: scene.getNode('Player') });
view.update({ selected: null });
```

The view picks a node as the Godot editor's 3D view does. A click on a mesh of an instanced scene
picks the instance, or the mesh's own node when the instance is editable. A click on nothing gives
`null` and clears the outline. Only the left button picks, and a drag that moves the camera picks
nothing. `onSelect: null` stops the calls.

With no `selected`, a click also outlines the node it picks. Once the page gives `selected`, the
page owns the outline: a click calls `onSelect` and leaves the outline as it is, as a controlled
input does. `onSelect` hears no click in the In-game mode, which takes no pointer, or in the 2D
mode, which picks no node yet. `<TscnCanvas selected={node} onSelect={setNode} />` does the same
in React.

### Turn the editor helpers on and off

`show` turns on and off the helpers the 3D and 2D modes draw over the scene. Each key is a
boolean, and a key that `show` leaves out keeps its value:

```ts
const view = mountScene(element, scene, { mode: '3D', show: { gizmos: false } });

view.update({ show: { grid: true, collisions: true } });
```

| Key                  | Default | What it draws                                                                 | Godot                             |
| -------------------- | ------- | ----------------------------------------------------------------------------- | --------------------------------- |
| `grid`               | `false` | A ground-plane grid in 3D                                                     | View Grid, on by default in Godot |
| `gizmos`             | `true`  | The editor gizmos and node icons. Collision shapes follow `collisions` alone. | View Gizmos                       |
| `collisions`         | `false` | The CollisionShape3D, CollisionShape2D and TouchScreenButton shapes           | Debug > Visible Collision Shapes  |
| `labels`             | `true`  | The Label3D text                                                              | none, Godot always draws it       |
| `navigation`         | `true`  | The NavigationRegion3D and NavigationRegion2D meshes                          | Debug > Visible Navigation        |
| `previewSun`         | `true`  | The editor preview sun, while the scene has no DirectionalLight3D             | The preview sunlight button       |
| `previewEnvironment` | `true`  | The editor preview sky, while the scene has no WorldEnvironment               | The preview environment button    |
| `fog`                | `true`  | The Environment's depth and volumetric fog                                    | none, Godot always draws it       |
| `performance`        | `false` | A panel over the view with the frame numbers and the time of each render step | View Frame Time                   |

The In-game mode draws as the game does: no helper, every Label3D and the fog, whatever `show`
holds. Only `performance` works there too. `<TscnCanvas show={{ grid: true }} />` does the same in
React, where a key left out has its default.

A key `show` does not have, or a value that is not a boolean, throws from `mountScene` and `update`.

### Save a PNG from headless Chromium

A browser draws the view: the renderer needs WebGL 2, and Node has no WebGL 2. Build a page that
mounts the scene, then drive the page with [Playwright](https://playwright.dev):

```ts
// page.ts, built into the page at http://localhost:5173/
import { mountScene, openScene } from '@textscene/renderer';

declare global {
  interface Window {
    capturePng(): Promise<string>;
  }
}

window.capturePng = async () => {
  const scene = openScene({ source, provider });
  const view = mountScene(document.getElementById('game')!, scene);
  await view.settled;
  const png = new Uint8Array(await (await view.captureImage()).arrayBuffer());
  view.dispose();
  let binary = '';
  for (const byte of png) binary += String.fromCharCode(byte);
  return btoa(binary);
};
```

```ts
// capture.mjs, run with Node
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

// A machine with no GPU draws WebGL only through SwiftShader, which Chromium enables on request.
const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'],
});
const page = await browser.newPage();
await page.goto('http://localhost:5173/');
const base64 = await page.evaluate(() => window.capturePng());
writeFileSync('scene.png', Buffer.from(base64, 'base64'));
await browser.close();
```

SwiftShader draws in software, so a large scene can take seconds for its first frames.

### The 3D mode

With no `mode`, or `mode="3D"`, the view draws the scene as the Godot editor's 3D view does: an
orbit camera, the preview sun and sky, and the gizmos. It draws 3D content. A scene of 2D nodes,
such as `Control` or `Node2D`, draws nothing in it: use the 2D mode.

```tsx
<TscnCanvas scene={scene} mode="3D" />
```

### The 2D mode

With `mode="2D"`, the view draws the scene as the Godot editor's 2D view does: the canvas items and
the Controls inside the frame of the project's window, with the gizmos. A drag pans the view, the
wheel zooms it, and the buttons in the corner zoom it and fit the frame. It draws no 3D content.

```tsx
<TscnCanvas scene={scene} mode="2D" />
```

## API

The package exports these names.

- `openScene({ source, provider, rootScenePath? })`: opens the text of a scene and returns a
  `Scene`. It parses the text once, the first time a view reads it.
- `Scene` (a type): an open scene. `setSource(text)` replaces its text, and every view of it draws
  the new text. `revision()` gives a number that changes with each change a view draws: a new text,
  a write or a load that changes the tree. `files()` gives the files it loads and the state of
  each, see "Know which files are missing". `getNode`, `getNodeOrNull`, `load` and `observe`
  are in "Change the scene from your code". `dispose()` closes it.
- `NodeHandle` (a type): a node of a scene, which `getNode` gives. Its `call` is in "Set the
  camera".
- `variant(text)`: a value of any Godot type, as a `.tscn` file spells it. It throws for a text
  Godot cannot read.
- `Variant` and `SceneValue` (types): what `variant` gives, and what `get` and `set` take.
- `SceneFile`, `SceneFileState` and `SceneFileFailure` (types): an entry of `scene.files()`, its
  `state` and its `reason`.
- `CameraState` (a type): an entry of `scene.cameras()`.
- `ViewStatus` (a type): what `status()` gives. See "Read the view's status".
- `TscnCanvas`: the view in React. Its props are `scene` (a `Scene`), the options of `mountScene`
  (`mode`, default `'3D'`, `visible`, `camera`, `selected`, `onSelect`, `show` and
  `onStatusChange`), and `className`. `scene` is required. Its `ref` gives the view's `settled`,
  `captureImage`, `status` and `editorCamera`. Its unmount ends the view.
- `ResourceProvider` (a type): `loadResource(path, type?)` returns the file as a string or an
  `ArrayBuffer`, or `null` when the file is missing. The optional `watch(listener)` is in "Load a
  file again when it changes".
- `mountScene(element, scene, options?)`: mounts the view with no React code of the page's own,
  and returns a `View`: `settled`, `captureImage`, `status`, `editorCamera`, `update` and
  `dispose`. See "Mount the view with no React code" and "Move the editor camera".
- `View` and `ViewOptions` (types): what `mountScene` returns, and the options of `mountScene` and
  `update`: `mode` (default `'in-game'`), `visible` (default `true`), `camera` (default `null`),
  `selected`, `onSelect`, `show` and `onStatusChange`. See "Learn which node a click picked", "Turn
  the editor helpers on and off" and "Read the view's status".

Version 0.6.0 exported `TscnSceneProvider`, `useSelection` and `useGameViewSettled`, and later
versions do not. Pass `scene` to `TscnCanvas`, use `selected` and `onSelect`, and read `settled`
from the canvas's `ref`.

## Styles and workers

The bundle adds one `<style>` element to the page when it loads. Your app needs no CSS-module
support and no stylesheet import. A page with a strict `style-src` policy must allow that element.

The renderer builds procedural textures, such as `NoiseTexture2D`, in a Web Worker that it starts
from a `blob:` URL. The worker script is inside the bundle, so nothing loads from another host. A
page with a `worker-src` policy must allow `blob:`. When the worker cannot start, the renderer builds
the same pixels on the main thread.

## Load a file again when it changes

Give the provider a `watch` method. The renderer calls it once for each scene that a view shows, and
calls the function it returns when the last view of that scene goes. Call the listener with the
`res://` path of a file that changed, appeared or went away, and every view of the scene draws the
new file, with no new mount.

```ts
const listeners = new Set<(path: string) => void>();
const provider: ResourceProvider = {
  loadResource: (path) => readProjectFile(path), // the page's own read of a project file
  watch(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

// When your file watcher sees res://textures/wood.png change:
for (const listener of listeners) listener('res://textures/wood.png');
```

## Licence

MIT. The package ships `LICENSE` and `THIRD-PARTY-NOTICES.md`. The build writes the notices from the
modules it bundles: the Godot Engine MIT notice covers the Godot code in the renderer, and the file
names the other third-party code it holds.

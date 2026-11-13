# @textscene/three-godot-shaders

`@textscene/three-godot-shaders` is Godot's scene shader as TSL node materials for a three.js
`WebGLRenderer`. It is the shader module of the
[TextScene Inspector](https://github.com/Vortiago/textscene-inspector), bundled into one ES module
with no React. three.js is its only peer dependency.

The package is at 0.0.0 and has no release. The port of Godot's lit surface adds the node materials
slice by slice ([#1451](https://github.com/Vortiago/textscene-inspector/issues/1451)), and the first
release is 0.1.0.

## Use

```ts
import * as THREE from 'three';
import { installNodesHandler } from '@textscene/three-godot-shaders';

const renderer = new THREE.WebGLRenderer();
installNodesHandler(renderer);
```

`installNodesHandler` gives the renderer three's `WebGLNodesHandler`, so a TSL node material draws
on it. By default a node material writes the renderer's tone mapping and `outputColorSpace`. Pass
`'linear'` when your app tone maps and encodes the frame itself.

## Licence

MIT. The package ships `LICENSE` and `THIRD-PARTY-NOTICES.md`. The build writes the notices from the
modules it bundles.

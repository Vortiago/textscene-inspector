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
import { installGodotShading } from '@textscene/three-godot-shaders';

const renderer = new THREE.WebGLRenderer();
const shading = installGodotShading(renderer);
const material = shading.surfaceMaterial({ diffuseMode: 0, specularMode: 0, hasClearcoat: false });
material.color.set(0.8, 0.8, 0.8);
material.roughness = 0.4;
```

`installGodotShading` gives the renderer three's `WebGLNodesHandler`, so a TSL node material draws
on it, and shades every `THREE.DirectionalLight` as Godot's directional light. `surfaceMaterial`
makes a lit material with Godot's light: `diffuseMode` and `specularMode` take Godot's
`BaseMaterial3D` enum values. The material's fields are those of a `MeshStandardMaterial`, plus
Godot's `specular`.

By default a node material writes the renderer's tone mapping and `outputColorSpace`. Pass
`{ output: 'linear' }` when your app tone maps and encodes the frame itself.

`shading.inputs` takes what your pipeline draws: Godot's sky radiance layers and Godot's directional
shadow atlas. Each input is optional. Without one, the surface draws what Godot draws without that
feature.

## Licence

MIT. The package ships `LICENSE` and `THIRD-PARTY-NOTICES.md`. The build writes the notices from the
modules it bundles.

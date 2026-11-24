import type * as THREE from 'three';

/** The part of `WEBGL_polygon_mode` a draw calls. */
interface PolygonModeExtension {
  readonly LINE_WEBGL: number;
  readonly FILL_WEBGL: number;
  polygonModeWEBGL(face: number, mode: number): void;
}

/** Written only by `drawAsLines` and `copyPolygonMode`. An entry goes with its material. */
const lineMaterials = new WeakSet<THREE.Material>();

/** Draws `material`'s triangles as their edges after the cull, as `VK_POLYGON_MODE_LINE` does. */
export function drawAsLines(material: THREE.Material): void {
  lineMaterials.add(material);
}

/** Draws `to` in the polygon mode of `from`. */
export function copyPolygonMode(from: THREE.Material, to: THREE.Material): void {
  if (lineMaterials.has(from)) lineMaterials.add(to);
}

/** Written only by `installGodotPolygonMode`. An entry goes with its renderer. */
const installedRenderers = new WeakSet<THREE.WebGLRenderer>();

/** Sets the polygon mode around each draw of a line material, its colour draw and its prepass draw alike. */
export function installGodotPolygonMode(renderer: THREE.WebGLRenderer): void {
  if (installedRenderers.has(renderer)) return;
  installedRenderers.add(renderer);
  const draw = renderer.renderBufferDirect.bind(renderer);
  // Asked for at the first line draw: WebKit logs a warning for each context that turns the extension on.
  let extension: PolygonModeExtension | null | undefined;
  renderer.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
    if (!lineMaterials.has(material)) return draw(camera, scene, geometry, material, object, group);
    const gl = renderer.getContext();
    extension ??= gl.getExtension('WEBGL_polygon_mode') as PolygonModeExtension | null;
    // Firefox has no polygon mode: three reads any material's `wireframe` (`WebGLRenderer.js:1215`).
    if (!extension) {
      Object.assign(material, { wireframe: true });
      return draw(camera, scene, geometry, material, object, group);
    }
    extension.polygonModeWEBGL(gl.FRONT_AND_BACK, extension.LINE_WEBGL);
    try {
      draw(camera, scene, geometry, material, object, group);
    } finally {
      extension.polygonModeWEBGL(gl.FRONT_AND_BACK, extension.FILL_WEBGL);
    }
  };
}

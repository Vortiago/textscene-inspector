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
  const extension = polygonModeExtension(renderer);
  renderer.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
    if (!drawsTriangleLines(material, object)) return draw(camera, scene, geometry, material, object, group);
    const polygonMode = extension();
    const lines = () => draw(camera, scene, geometry, material, object, group);
    if (polygonMode) drawInLineMode(renderer.getContext(), polygonMode, lines);
    else drawAsGlLines(material, lines);
  };
}

/** The polygon mode leaves a points or lines primitive as it is. */
const drawsTriangleLines = (material: THREE.Material, object: THREE.Object3D): boolean =>
  lineMaterials.has(material) && (object as THREE.Mesh).isMesh === true;

/** The extension of `renderer`'s context, asked for again after a restore, which drops the old object. */
function polygonModeExtension(renderer: THREE.WebGLRenderer): () => PolygonModeExtension | null {
  // Asked for at the first line draw: WebKit logs a warning for each context that turns the extension on.
  let extension: PolygonModeExtension | null | undefined;
  return () => {
    if (extension === undefined) {
      extension = renderer.getContext().getExtension('WEBGL_polygon_mode') as PolygonModeExtension | null;
      renderer.domElement.addEventListener('webglcontextrestored', () => (extension = undefined), {
        once: true,
      });
    }
    return extension;
  };
}

function drawInLineMode(
  gl: WebGLRenderingContext,
  polygonMode: PolygonModeExtension,
  draw: () => void
): void {
  polygonMode.polygonModeWEBGL(gl.FRONT_AND_BACK, polygonMode.LINE_WEBGL);
  try {
    draw();
  } finally {
    polygonMode.polygonModeWEBGL(gl.FRONT_AND_BACK, polygonMode.FILL_WEBGL);
  }
}

/** Firefox has no polygon mode. three reads any material's `wireframe` (`WebGLRenderer.js:1215`). */
function drawAsGlLines(material: THREE.Material, draw: () => void): void {
  const withWireframe = material as THREE.Material & { wireframe?: boolean };
  const wasWireframe = withWireframe.wireframe;
  withWireframe.wireframe = true;
  try {
    draw();
  } finally {
    withWireframe.wireframe = wasWireframe;
  }
}

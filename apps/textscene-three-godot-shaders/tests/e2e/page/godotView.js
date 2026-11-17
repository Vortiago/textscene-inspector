import * as THREE from 'three';
import { installNodesHandler, ShaderClock } from '@textscene/three-godot-shaders';

/** The renderer of a Godot viewport's display: sRGB output and no tone mapping. */
export const displayRenderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
installNodesHandler(displayRenderer, 'display');
displayRenderer.outputColorSpace = THREE.SRGBColorSpace;
displayRenderer.toneMapping = THREE.NoToneMapping;

/** Godot's rotation in degrees, in Godot's order of axes: Y, then X, then Z. */
export const euler = ([x, y, z]) => new THREE.Euler(...[x, y, z].map(THREE.MathUtils.degToRad), 'YXZ');

/** A colour Godot holds in sRGB, linear, as Godot's C++ converts it. */
export const linear = ([r, g, b]) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

/** Camera3D's default near and far planes. */
const NEAR = 0.05;
const FAR = 4000;

/** The Camera3D of `spec` with Godot's projection of its kind (`projection.cpp:356-402`), height kept. */
export function godotCamera(spec) {
  const { fov, size, offset = [0, 0], projection = 'perspective', near = NEAR, far = FAR } = spec.camera;
  const aspect = spec.width / spec.height;
  const camera =
    projection === 'orthogonal'
      ? new THREE.OrthographicCamera(
          -(size * aspect) / 2,
          (size * aspect) / 2,
          size / 2,
          -size / 2,
          near,
          far
        )
      : new THREE.PerspectiveCamera(fov, aspect, near, far);
  if (projection === 'frustum') {
    const [x, y] = offset;
    const halfWidth = (size * aspect) / 2;
    camera.projectionMatrix.makePerspective(
      x - halfWidth,
      x + halfWidth,
      y + size / 2,
      y - size / 2,
      near,
      far
    );
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  camera.rotation.copy(euler(spec.camera.rotation));
  if (spec.camera.position) camera.position.fromArray(spec.camera.position);
  camera.updateMatrixWorld();
  return camera;
}

/** `TIME` after the frames of `clock`, or 0 for a scene of no clock. */
export function shaderTime(clock) {
  if (!clock) return 0;
  const shaderClock = new ShaderClock(clock.rolloverSeconds);
  for (let frame = 0; frame < clock.frames; frame++) shaderClock.advance(1 / clock.fixedFps);
  return shaderClock.time;
}

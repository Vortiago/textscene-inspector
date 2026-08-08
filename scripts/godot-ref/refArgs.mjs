/**
 * `ref:godot`'s command line. Every value is validated here rather than at the
 * point of use, because the engine's response to a malformed one is silence:
 * see `positiveNumber` on what NaN costs.
 */

import { DEFAULT_HEIGHT, DEFAULT_WIDTH, EDITOR_FOV, RENDER_MODES } from './refConstants.mjs';

/** Reject NaN early: it reaches Godot as `viewport_width=NaN`, which does not
 * fail — the engine produces nothing and never exits, so both 300s spawn
 * timeouts elapse before the harness reports an unrelated "produced no image".
 */
function positiveNumber(flag, raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${flag} needs a positive number, got "${raw}"`);
  }
  return value;
}

function vec2(flag, raw) {
  const parts = String(raw).split(',').map((n) => Number(n.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isInteger(n))) {
    throw new Error(`${flag} needs two comma-separated integers, got "${raw}"`);
  }
  return parts;
}

function vec3(flag, raw) {
  const parts = String(raw).split(',').map((n) => Number(n.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`${flag} needs three comma-separated numbers, got "${raw}"`);
  }
  return parts;
}

export function parseArgs(argv) {
  const args = {
    scene: null,
    out: null,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    previews: true,
    // Godot's EDITOR viewport fov (`editors/3d/default_fov`), which is NOT the
    // 75 a bare Camera3D node defaults to. Rendering the reference at 75 while
    // the previewer draws at 70 is a silent zoom difference in every frame.
    fov: EDITOR_FOV,
    fovExplicit: false,
    emitBounds: false,
    frame: false,
    sceneCamera: false,
    sceneCameraPath: null,
    // 2D or 3D is a property of the SCENE, not of the invocation, so the
    // engine itself decides by default (`_is_canvas_scene`) — a JS copy of
    // Godot's class hierarchy would be one more pair of constants to keep in
    // sync, and this one cannot be checked by looking at the picture.
    mode: 'auto',
    camera: null,
    lookAt: null,
    probes: [],
    patch: 1,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--out':
        args.out = argv[++i];
        break;
      case '--width':
        args.width = positiveNumber('--width', argv[++i]);
        break;
      case '--height':
        args.height = positiveNumber('--height', argv[++i]);
        break;
      case '--no-previews':
        args.previews = false;
        break;
      case '--emit-bounds':
        args.emitBounds = true;
        break;
      case '--frame':
        args.frame = true;
        break;
      case '--scene-camera':
        args.sceneCamera = true;
        // Optional node path: a scene may hold several Camera3Ds and "the first
        // one in tree order" is not a choice anyone made. Naming it is how both
        // harnesses provably look through the SAME camera.
        if (argv[i + 1] && !String(argv[i + 1]).startsWith('--')) {
          args.sceneCameraPath = argv[++i];
        }
        break;
      case '--mode': {
        const mode = String(argv[++i]).toLowerCase();
        if (!RENDER_MODES.includes(mode)) {
          throw new Error(`--mode takes one of ${RENDER_MODES.join('|')}, got "${mode}"`);
        }
        args.mode = mode;
        break;
      }
      case '--fov':
        args.fov = positiveNumber('--fov', argv[++i]);
        args.fovExplicit = true;
        break;
      case '--camera':
        args.camera = vec3('--camera', argv[++i]);
        break;
      case '--look-at':
        args.lookAt = vec3('--look-at', argv[++i]);
        break;
      case '--probe':
        args.probes.push(vec2('--probe', argv[++i]));
        break;
      case '--patch':
        args.patch = positiveNumber('--patch', argv[++i]);
        break;
      default:
        if (arg.startsWith('--')) throw new Error(`Unknown flag ${arg}`);
        args.scene = arg;
    }
  }

  return args;
}

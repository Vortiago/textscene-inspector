/**
 * `ref:godot`'s command line, validated here, not at the point of use: the
 * engine answers a malformed value with silence.
 */

import { DEFAULT_HEIGHT, DEFAULT_WIDTH, EDITOR_FOV, RENDER_MODES } from './refConstants.mjs';

/**
 * Rejects NaN early: `viewport_width=NaN` makes the engine produce nothing and
 * never exit, so both 300s spawn timeouts elapse before "produced no image".
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
    // The editor viewport fov (`editors/3d/default_fov`), not the 75 a bare
    // Camera3D defaults to, which would silently zoom every frame.
    fov: EDITOR_FOV,
    fovExplicit: false,
    emitBounds: false,
    frame: false,
    sceneCamera: false,
    sceneCameraPath: null,
    // 2D or 3D is a property of the scene, so the engine decides by default
    // (`_is_canvas_scene`), not a JS copy of Godot's class hierarchy.
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
        // An optional node path, so both harnesses look through the same one of
        // several Camera3Ds. The peek cannot tell an omitted value from the
        // positional, so `--scene-camera <scene.tscn>` eats the scene, and the
        // check after the loop reports it.
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

  // `--scene-camera` swallowed the one positional. A `null` scene would render
  // nothing until both 300s spawn timeouts elapse.
  if (args.sceneCameraPath !== null && args.scene === null) {
    throw new Error(
      `--scene-camera took "${args.sceneCameraPath}" as its node path, leaving no scene. ` +
        `Put the scene first: ref:godot <scene.tscn> --scene-camera [NodePath]`
    );
  }

  return args;
}

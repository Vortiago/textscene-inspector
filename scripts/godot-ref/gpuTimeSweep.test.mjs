import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasHostDisplay, parseGpuTime } from './gpuTime.mjs';
import {
  godotSpawnPlan,
  gpuTimeSizeMessage,
  missingGpuTimeMessage,
  parseArgs,
  parsedGpuTime,
  projectConfig,
  projectSize,
  requestedRenderingMethod,
  untimedMethodMessage,
} from './run.mjs';

const OK = null;

describe('--gpu-time flags', () => {
  it.each([
    [['--gpu-time'], OK],
    [['--gpu-time', '120'], OK],
    [['--gpu-time', '1.5'], '--gpu-time needs a whole number, got "1.5"'],
    [['--gpu-time', '0'], '--gpu-time needs a positive number, got "0"'],
    [['--gpu-time', '--probe', '1,2'], '--gpu-time cannot take --probe'],
    [['--gpu-time', '--mode', 'auto'], OK],
    [['--gpu-time', '--mode', '3d'], OK],
    [['--gpu-time', '--mode', '2d'], '--gpu-time cannot take --mode 2d'],
    [['--gpu-time', '--mode', '2d-root'], '--gpu-time cannot take --mode 2d-root'],
    [['--gpu-time', '--mode', 'in-game'], 'cannot take --gpu-time'],
    [['--gpu-time', '--rendering-driver', 'vulkan'], OK],
    [['--gpu-time', '--rendering-driver', 'd3d12'], OK],
    [['--gpu-time', '--rendering-driver', 'metal'], OK],
    [['--gpu-time', '--rendering-driver', 'opengl3'], '--gpu-time cannot take --rendering-driver opengl3'],
    [['--gpu-time', '--rendering-driver', 'opengl3_angle'], 'cannot take --rendering-driver opengl3_angle'],
    [['--gpu-time', '--rendering-driver', 'opengl3_es'], 'cannot take --rendering-driver opengl3_es'],
    [['--probe', '1,2'], OK],
  ])('a.tscn %j: %s', (flags, refusal) => {
    const parse = () => parseArgs(['a.tscn', ...flags]);
    if (refusal === OK) expect(parse).not.toThrow();
    else expect(parse).toThrow(refusal);
  });
});

describe('--gpu-time render outcome', () => {
  it.each([
    ['3d', 'Godot quit before it ended. A window that is hidden'],
    ['2d', 'times only a 3D render, got a "2d" render'],
    ['2d-root', 'times only a 3D render, got a "2d-root" render'],
    [null, 'Godot wrote no render mode'],
  ])('no recording after a %s render', (rendered, message) => {
    expect(missingGpuTimeMessage(rendered)).toContain(message);
  });

  it('names the engine timeout when the render pass stalled', () => {
    expect(missingGpuTimeMessage('3d', 'did not finish within 300s')).toBe(
      '--gpu-time expected a recording, but the engine did not finish within 300s'
    );
  });

  it.each([
    ['{', null, 'could not read the recording'],
    ['{', 'did not finish within 300s', 'The engine did not finish within 300s'],
    ['{"frames":[],"passFrames":[]}', null, 'got 0 frames'],
  ])('a recording %j after a stall %s is refused', async (text, stall, refusal) => {
    const file = join(await mkdtemp(join(tmpdir(), 'gpu-time-')), 'gpu.json');
    await writeFile(file, text);
    const refuse = async (message) => {
      throw new Error(message);
    };
    await expect(parsedGpuTime(file, { refuse, stall })).rejects.toThrow(refusal);
  });

  it.each([
    ['', null, OK],
    ['[rendering]\nrenderer/rendering_method="forward_plus"', null, OK],
    ['[rendering]\nrenderer/rendering_method="mobile"', null, OK],
    [
      '[rendering]\nrenderer/rendering_method="gl_compatibility"',
      null,
      'cannot time the gl_compatibility method',
    ],
    ['[rendering]\nrenderer/rendering_method="gl_compatibility"', 'vulkan', OK],
  ])('untimed method for project %j and driver %s', (ini, driver, refusal) => {
    const message = untimedMethodMessage(requestedRenderingMethod(ini, driver));
    if (refusal === OK) expect(message).toBeNull();
    else expect(message).toContain(refusal);
  });

  it.each([
    [[955, 756], { width: 955, height: 756 }, OK],
    [[955, 540], { width: 955, height: 756 }, 'asked for 955 x 756, but Godot drew 955 x 540'],
    [[800, 756], { width: 955, height: 756 }, 'asked for 955 x 756, but Godot drew 800 x 756'],
    [[1920, 1080], { width: 955, height: 756 }, 'asked for 955 x 756, but Godot drew 1920 x 1080'],
  ])('drawn %j against asked %j', (drawn, asked, refusal) => {
    const message = gpuTimeSizeMessage(drawn, asked);
    if (refusal === OK) expect(message).toBeNull();
    else expect(message).toContain(refusal);
  });
});

describe('--gpu-time window', () => {
  const STRETCHED = [
    '[display]',
    'window/size/viewport_width=640',
    'window/size/viewport_height=360',
    'window/size/window_width_override=1280',
    'window/size/window_height_override=720',
    'window/size/mode=2',
    'window/stretch/mode="viewport"',
    'window/stretch/scale=2.0',
  ].join('\n');
  const timed = (onHostGpu) =>
    projectConfig(
      STRETCHED,
      projectSize({ rootWindow: false, inGame: false, onHostGpu, width: 955, height: 756 })
    );

  it.each([
    ['window_width_override', true],
    ['window_height_override', true],
    ['window/size/mode', true],
    ['window/stretch/mode', true],
    ['window/stretch/scale', true],
    ['window/stretch/mode', false],
    ['window_width_override', false],
    ['window/size/mode', false],
  ])('%s with a timed run %s', (key, isTimed) => {
    expect(timed(isTimed).includes(key)).toBe(!isTimed);
  });

  it('asks a timed run for the frame size given', () => {
    expect(timed(true)).toContain('window/size/viewport_width=955');
    expect(timed(true)).toContain('window/size/viewport_height=756');
  });

  it.each([
    [{}, 'linux', false],
    [{ DISPLAY: ':0' }, 'linux', true],
    [{ WAYLAND_DISPLAY: 'wayland-0' }, 'linux', false],
    [{ DISPLAY: ':0', WAYLAND_DISPLAY: 'wayland-0' }, 'linux', true],
    [{}, 'win32', true],
    [{}, 'darwin', true],
  ])('display %j on %s', (env, platform, isHost) => {
    expect(hasHostDisplay(env, platform)).toBe(isHost);
  });

  it.each([
    [{ onHostGpu: true, hasDisplay: true }, false],
    [{ onHostGpu: true, hasDisplay: false }, true],
    [{ onHostGpu: false, hasDisplay: true }, true],
  ])('spawn %j under a virtual X server: %s', (options, isVirtual) => {
    const plan = godotSpawnPlan(['--path', '/tmp/work'], { display: true, ...options });
    expect(plan.argv.includes('xvfb-run')).toBe(isVirtual);
  });
});

describe('--gpu-time pass times', () => {
  const recorded = (passFrames) =>
    JSON.stringify({ adapter: 'GPU', driver: 'vulkan', size: [955, 756], frames: [1, 2, 3], passFrames });
  const medianOf = (passFrames, name) =>
    parseGpuTime(recorded(passFrames)).passes.find((pass) => pass.name === name).spread.medianMs;

  it.each([
    ['once a frame', [[['Shadows', 2]], [['Shadows', 2]], [['Shadows', 2]]], 2],
    [
      'twice a frame',
      [
        [
          ['Shadows', 1],
          ['Shadows', 2],
        ],
        [
          ['Shadows', 1],
          ['Shadows', 2],
        ],
        [['Shadows', 3]],
      ],
      3,
    ],
    ['in one frame of three', [[['Shadows', 6]], [['Other', 1]], [['Other', 1]]], 0],
    ['in two frames of three', [[['Shadows', 6]], [['Shadows', 6]], [['Other', 1]]], 6],
  ])('a pass stamped %s', (_, passFrames, median) => {
    expect(medianOf(passFrames, 'Shadows')).toBe(median);
  });

  it('refuses a recording with no pass times (error case)', () => {
    expect(() => parseGpuTime(recorded([]))).toThrow('expected pass times from a RenderingDevice');
  });
});

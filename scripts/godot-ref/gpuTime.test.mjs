import { describe, expect, it } from 'vitest';
import {
  GPU_TIME_DEFAULT_FRAMES,
  GPU_TIME_WARMUP_FRAMES,
  formatGpuTime,
  GPU_TIME_ARGV,
  gpuTimeScript,
  hasHostDisplay,
  readGpuTime,
} from './gpuTime.mjs';

describe('GPU_TIME_ARGV', () => {
  it("turns on Godot's pass timestamps and takes the display's vsync away", () => {
    expect(GPU_TIME_ARGV).toEqual(['--gpu-profile', '--disable-vsync']);
  });
});

describe('hasHostDisplay', () => {
  it('finds a display on Windows and macOS with no X variables', () => {
    expect(hasHostDisplay({}, 'win32')).toBe(true);
    expect(hasHostDisplay({}, 'darwin')).toBe(true);
  });

  it('finds one on Linux only through DISPLAY or WAYLAND_DISPLAY', () => {
    expect(hasHostDisplay({}, 'linux')).toBe(false);
    expect(hasHostDisplay({ DISPLAY: ':0' }, 'linux')).toBe(true);
    expect(hasHostDisplay({ WAYLAND_DISPLAY: 'wayland-0' }, 'linux')).toBe(true);
  });
});

describe('readGpuTime', () => {
  const recorded = {
    adapter: 'Intel(R) UHD Graphics 630',
    driver: 'vulkan',
    size: [1073, 1830],
    frames: [5, 1, 4, 2, 3, 10, 6, 7, 8, 9, 11],
    passFrames: [
      [
        ['Render Shadows', 2],
        ['Render Opaque Pass', 4],
        ['Frame Begin', 0.01],
      ],
      [
        ['Render Shadows', 2],
        ['Render Opaque Pass', 6],
      ],
      [
        ['Render Shadows', 2],
        ['Render Opaque Pass', 5],
      ],
    ],
  };

  it('gives the frame the median and the 10th and 90th percentiles, as textscene.profile does', () => {
    expect(readGpuTime(JSON.stringify(recorded)).frame).toEqual({ medianMs: 6, lowMs: 2, highMs: 10 });
  });

  it('lists the passes by median, the dearest first', () => {
    const { passes } = readGpuTime(JSON.stringify(recorded));
    expect(passes.map((pass) => pass.name)).toEqual(['Render Opaque Pass', 'Render Shadows', 'Frame Begin']);
    expect(passes[0].spread).toEqual({ medianMs: 5, lowMs: 4, highMs: 6 });
  });

  it('keeps the adapter, the driver and the drawn size', () => {
    const read = readGpuTime(JSON.stringify(recorded));
    expect(read.device).toEqual({
      adapter: 'Intel(R) UHD Graphics 630',
      driver: 'vulkan',
      size: [1073, 1830],
    });
  });

  it('adds up a pass name stamped twice in one frame, as Godot’s own print does', () => {
    const twice = {
      ...recorded,
      passFrames: [
        [
          ['Render Shadows', 1],
          ['Render Shadows', 2],
        ],
      ],
    };
    expect(readGpuTime(JSON.stringify(twice)).passes[0].spread.medianMs).toBe(3);
  });

  it('refuses a recording with no pass times, as a driver with no RenderingDevice gives (error case)', () => {
    expect(() => readGpuTime(JSON.stringify({ ...recorded, driver: 'opengl3', passFrames: [] }))).toThrow(
      'expected pass times from a RenderingDevice, got none on the "opengl3" driver'
    );
  });

  it('refuses a recording with no frames, naming what it found', () => {
    expect(() => readGpuTime(JSON.stringify({ ...recorded, frames: [] }))).toThrow(
      'expected GPU frame times from Godot, got 0 frames'
    );
  });
});

describe('formatGpuTime', () => {
  it("prints the device, the frame and each pass over the threshold of Godot's own print", () => {
    const text = formatGpuTime({
      device: { adapter: 'llvmpipe', driver: 'vulkan', size: [955, 756] },
      frame: { medianMs: 32.2, lowMs: 31, highMs: 34 },
      passes: [
        { name: 'Render Opaque Pass', spread: { medianMs: 9.04, lowMs: 8.9, highMs: 9.3 } },
        { name: 'Cull 3D Scene', spread: { medianMs: 0.004, lowMs: 0, highMs: 0.01 } },
      ],
    });
    expect(text).toBe(
      [
        'Godot GPU time on llvmpipe (vulkan), 955 x 756',
        '  frame: median 32.20 ms (10th 31.00, 90th 34.00)',
        '  Render Opaque Pass: median 9.04 ms (10th 8.90, 90th 9.30)',
      ].join('\n')
    );
  });
});

describe('gpuTimeScript', () => {
  const script = gpuTimeScript({ frames: 200, out: '/tmp/gpu.json' });

  it('records the asked frames after the warm-up frames', () => {
    expect(script).toContain('const GPU_TIME_FRAMES := 200');
    expect(script).toContain(`const GPU_TIME_WARMUP_FRAMES := ${GPU_TIME_WARMUP_FRAMES}`);
  });

  it('times the viewport through the renderer and reads each pass from the device timestamps', () => {
    expect(script).toContain('viewport_set_measure_render_time');
    expect(script).toContain('viewport_get_measured_render_time_gpu');
    expect(script).toContain('get_captured_timestamp_gpu_time');
  });

  it("skips the bracket timestamps, as Godot's own --gpu-profile print does", () => {
    // rendering_server_default.cpp:169: a name that starts with < or > opens or closes a group.
    expect(script).toMatch(/begins_with\("<"\) or pass_name\.begins_with\(">"\)/);
  });

  it('adds no recorder when no frames are asked for', () => {
    expect(gpuTimeScript({ frames: 0, out: '' })).toBe('');
  });

  it('defaults to enough frames for a stable median on a noisy GPU', () => {
    expect(GPU_TIME_DEFAULT_FRAMES).toBeGreaterThanOrEqual(300);
  });
});

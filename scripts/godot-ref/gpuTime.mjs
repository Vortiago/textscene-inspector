import { spreadOfMs } from '../../packages/textscene-core/src/r3f/frameProfile/gpuSpread.ts';

/** Frames recorded: a laptop GPU's frame swings by several ms, so the median needs many. */
export const GPU_TIME_DEFAULT_FRAMES = 300;

/** Frames drawn before the recording, while the GPU clock and the pipeline caches settle. */
export const GPU_TIME_WARMUP_FRAMES = 120;

/** `--gpu-profile` turns on pass timestamps (rendering_server_default.cpp:356). Vsync adds a wait. */
export const GPU_TIME_ARGV = ['--gpu-profile', '--disable-vsync'];

/** True when the host has an X screen to open the window on. Godot 4.6 opens on X11 unless told Wayland. */
export function hasHostDisplay(env, platform) {
  if (platform !== 'linux') return true;
  return Boolean(env.DISPLAY);
}

/** Reads the file the bootstrap writes into the frame and pass spreads, the dearest pass first. */
export function parseGpuTime(text) {
  const recorded = JSON.parse(text);
  if (recorded.frames.length === 0) {
    throw new Error(`expected GPU frame times from Godot, got ${recorded.frames.length} frames`);
  }
  if (recorded.passFrames.length === 0) {
    throw new Error(
      `expected pass times from a RenderingDevice, got none on the "${recorded.driver}" driver`
    );
  }
  const passes = [...timesPerPass(recorded.passFrames)]
    .map(([name, times]) => ({ name, spread: spreadOfMs(times) }))
    .sort((a, b) => b.spread.medianMs - a.spread.medianMs);
  return {
    device: { adapter: recorded.adapter, driver: recorded.driver, size: recorded.size },
    frame: spreadOfMs(recorded.frames),
    passes,
  };
}

/** One time per pass and frame. Two stamps add up, none counts 0 (`rendering_server_default.cpp:176-193`). */
function timesPerPass(passFrames) {
  const names = new Set(passFrames.flatMap((stamps) => stamps.map(([name]) => name)));
  const times = new Map([...names].map((name) => [name, []]));
  for (const stamps of passFrames) {
    const frame = new Map([...names].map((name) => [name, 0]));
    for (const [name, ms] of stamps) frame.set(name, frame.get(name) + ms);
    for (const [name, ms] of frame) times.get(name).push(ms);
  }
  return times;
}

/** The pass time `--gpu-profile`'s own print leaves out (`rendering_server_default.cpp:191`). */
const PRINTED_PASS_MIN_MS = 0.01;

export function formatGpuTime({ device, frame, passes }) {
  const line = (name, { medianMs, lowMs, highMs }) =>
    `  ${name}: median ${medianMs.toFixed(2)} ms (10th ${lowMs.toFixed(2)}, 90th ${highMs.toFixed(2)})`;
  return [
    `Godot GPU time on ${device.adapter} (${device.driver}), ${device.size[0]} x ${device.size[1]}`,
    line('frame', frame),
    ...passes
      .filter((pass) => pass.spread.medianMs > PRINTED_PASS_MIN_MS)
      .map((pass) => line(pass.name, pass.spread)),
  ].join('\n');
}

/** The bootstrap's recording, run after the capture with the picture settled. Untimed, it is empty. */
export function gpuTimeScript({ frames, out }) {
  if (frames === 0) return '';
  return `const GPU_TIME_FRAMES := ${frames}
const GPU_TIME_WARMUP_FRAMES := ${GPU_TIME_WARMUP_FRAMES}
const GPU_TIME_OUT := ${JSON.stringify(out)}

func _record_gpu_time(source: Viewport) -> void:
	var viewport := source.get_viewport_rid()
	RenderingServer.viewport_set_measure_render_time(viewport, true)
	var device := RenderingServer.get_rendering_device()
	for _i in GPU_TIME_WARMUP_FRAMES:
		await RenderingServer.frame_post_draw
	var frames: Array[float] = []
	var pass_frames := []
	var last_captured := -1
	while frames.size() < GPU_TIME_FRAMES:
		await RenderingServer.frame_post_draw
		frames.append(RenderingServer.viewport_get_measured_render_time_gpu(viewport))
		# The device keeps one frame's timestamps, so a frame it has not replaced is not read twice.
		if device != null and device.get_captured_timestamps_frame() != last_captured:
			last_captured = device.get_captured_timestamps_frame()
			pass_frames.append(_pass_stamps(device))
	var file := FileAccess.open(GPU_TIME_OUT, FileAccess.WRITE)
	file.store_string(JSON.stringify({
		"adapter": RenderingServer.get_video_adapter_name(),
		"driver": RenderingServer.get_current_rendering_driver_name(),
		"size": [source.get_texture().get_size().x, source.get_texture().get_size().y],
		"frames": frames,
		"passFrames": pass_frames,
	}))
	file.close()

# Each pass lasts from its timestamp to the next one, as Godot's own --gpu-profile print reads them.
func _pass_stamps(device: RenderingDevice) -> Array:
	var stamps := []
	for i in device.get_captured_timestamps_count() - 1:
		var pass_name := device.get_captured_timestamp_name(i)
		if pass_name.begins_with("<") or pass_name.begins_with(">"):
			continue
		var ms := (device.get_captured_timestamp_gpu_time(i + 1) - device.get_captured_timestamp_gpu_time(i)) / 1000000.0
		stamps.append([pass_name, ms])
	return stamps
`;
}

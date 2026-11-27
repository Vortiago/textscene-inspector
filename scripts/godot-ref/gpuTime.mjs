/** Frames recorded: a laptop GPU's frame swings by several ms, so the median needs many. */
export const GPU_TIME_DEFAULT_FRAMES = 300;

/** Frames drawn before the recording, while the GPU clock and the pipeline caches settle. */
export const GPU_TIME_WARMUP_FRAMES = 120;

/** `--gpu-profile` turns on pass timestamps (rendering_server_default.cpp:356); vsync adds a wait. */
export function gpuTimeArgv() {
  return ['--gpu-profile', '--disable-vsync'];
}

/** True when the host has a screen to open the window on, so no virtual X server is needed. */
export function hasHostDisplay(env, platform) {
  if (platform !== 'linux') return true;
  return Boolean(env.DISPLAY || env.WAYLAND_DISPLAY);
}

/** Reads the file the bootstrap writes into the frame and pass spreads, the dearest pass first. */
export function readGpuTime(text) {
  const recorded = JSON.parse(text);
  if (recorded.frames.length === 0) {
    throw new Error(`expected GPU frame times from Godot, got ${recorded.frames.length} frames`);
  }
  const passes = Object.entries(recorded.passes)
    .map(([name, times]) => ({ name, spread: spreadOf(times) }))
    .sort((a, b) => b.spread.medianMs - a.spread.medianMs);
  return {
    device: { adapter: recorded.adapter, driver: recorded.driver, size: recorded.size },
    frame: spreadOf(recorded.frames),
    passes,
  };
}

/** The median and the 10th and 90th percentiles of `ms`, as `frameRecording.ts` picks them. */
function spreadOf(ms) {
  const sorted = [...ms].sort((a, b) => a - b);
  const at = (fraction) => sorted[Math.round(fraction * (sorted.length - 1))];
  return { medianMs: at(0.5), lowMs: at(0.1), highMs: at(0.9) };
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

/** The bootstrap's recording, run after the capture with the picture settled. */
export function gpuTimeScript({ frames, out }) {
  return `const GPU_TIME_FRAMES := ${frames}
const GPU_TIME_WARMUP_FRAMES := ${GPU_TIME_WARMUP_FRAMES}
const GPU_TIME_OUT := ${JSON.stringify(out)}

func _record_gpu_time(source: Viewport) -> void:
	if GPU_TIME_FRAMES == 0:
		return
	var viewport := source.get_viewport_rid()
	RenderingServer.viewport_set_measure_render_time(viewport, true)
	var device := RenderingServer.get_rendering_device()
	for _i in GPU_TIME_WARMUP_FRAMES:
		await RenderingServer.frame_post_draw
	var frames: Array[float] = []
	var passes := {}
	var last_captured := -1
	while frames.size() < GPU_TIME_FRAMES:
		await RenderingServer.frame_post_draw
		frames.append(RenderingServer.viewport_get_measured_render_time_gpu(viewport))
		# The device keeps one frame's timestamps, so a frame it has not replaced is not read twice.
		if device != null and device.get_captured_timestamps_frame() != last_captured:
			last_captured = device.get_captured_timestamps_frame()
			_add_pass_times(device, passes)
	var file := FileAccess.open(GPU_TIME_OUT, FileAccess.WRITE)
	file.store_string(JSON.stringify({
		"adapter": RenderingServer.get_video_adapter_name(),
		"driver": RenderingServer.get_current_rendering_driver_name(),
		"size": [source.get_visible_rect().size.x, source.get_visible_rect().size.y],
		"frames": frames,
		"passes": passes,
	}))
	file.close()

# Each pass lasts from its timestamp to the next one, as Godot's own --gpu-profile print reads them.
func _add_pass_times(device: RenderingDevice, passes: Dictionary) -> void:
	for i in device.get_captured_timestamps_count() - 1:
		var name := device.get_captured_timestamp_name(i)
		if name.begins_with("<") or name.begins_with(">"):
			continue
		var ms := (device.get_captured_timestamp_gpu_time(i + 1) - device.get_captured_timestamp_gpu_time(i)) / 1000000.0
		if not passes.has(name):
			passes[name] = []
		passes[name].append(ms)
`;
}

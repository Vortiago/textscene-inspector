import { mountScene, openScene, type ViewStatus } from '@textscene/renderer';
import { elementOf, NO_FILES } from './capture';

/** A frame window lands twice a second, so this holds a few windows: an `onStatusChange` per frame shows. */
const IDLE_MS = 2000;

/** Software GL draws its first measured window slowly, so a window still missing this long is a failure. */
const FRAME_WAIT_MS = 10_000;

/** A box textured by a NoiseTexture2D the view builds, and a node whose mesh type no slice draws. */
const STATUS_SCENE = `[gd_scene format=3]

[sub_resource type="FastNoiseLite" id="FastNoise_1"]

[sub_resource type="NoiseTexture2D" id="Noise_1"]
width = 64
height = 64
noise = SubResource("FastNoise_1")

[sub_resource type="StandardMaterial3D" id="Material_1"]
albedo_texture = SubResource("Noise_1")

[sub_resource type="BoxMesh" id="Box_1"]
material = SubResource("Material_1")

[sub_resource type="FutureMesh" id="Future_1"]

[node name="Root" type="Node3D"]

[node name="Box" type="MeshInstance3D" parent="."]
mesh = SubResource("Box_1")

[node name="Sign" type="MeshInstance3D" parent="."]
mesh = SubResource("Future_1")
`;

export interface StatusCheckResults {
  /** `view.status().settled` once `settled` resolves, beside the value it resolved to. */
  statusSettled: unknown;
  settled: unknown;
  /** `view.status().undrawn` once settled. */
  undrawn: ViewStatus['undrawn'];
  /** Whether an `onStatusChange` call counted a texture still building. */
  heardTextureBuild: boolean;
  /** The settled value of each call after the view first settled, null for a pending one. */
  settledAfterWrite: (object | null)[];
  /** The calls in `IDLE_MS` of a settled view that measures its frames. */
  idleCalls: number;
  /** The FPS of `status().frame` with `show.performance` on, or null with no window measured. */
  fps: number | null;
}

/** Polls, as a host reads frame numbers: `onStatusChange` does not call for them. */
function measuredFps(view: { status(): ViewStatus }): Promise<number | null> {
  const startedAt = performance.now();
  return new Promise((resolve) => {
    const poll = () => {
      const frame = view.status().frame;
      if (frame || performance.now() - startedAt > FRAME_WAIT_MS) resolve(frame?.fps ?? null);
      else setTimeout(poll, 100);
    };
    poll();
  });
}

export async function runStatusChecks(): Promise<StatusCheckResults> {
  const scene = openScene({ source: STATUS_SCENE, provider: NO_FILES });
  const heard: ViewStatus[] = [];
  const view = mountScene(elementOf(320, 240), scene, {
    mode: '3D',
    show: { performance: true },
    onStatusChange: (status) => heard.push(status),
  });
  try {
    const settled = await view.settled;
    const { settled: statusSettled, undrawn } = view.status();
    const heardTextureBuild = heard.some((status) => status.pending.textures > 0);
    const fps = await measuredFps(view);
    const beforeIdle = heard.length;
    await new Promise((resolve) => setTimeout(resolve, IDLE_MS));
    const idleCalls = heard.length - beforeIdle;
    const beforeWrite = heard.length;
    await scene.getNode('Box').set('visible', false);
    await view.settled;
    const settledAfterWrite = heard.slice(beforeWrite).map((status) => status.settled);
    return { statusSettled, settled, undrawn, heardTextureBuild, settledAfterWrite, idleCalls, fps };
  } finally {
    view.dispose();
    scene.dispose();
  }
}

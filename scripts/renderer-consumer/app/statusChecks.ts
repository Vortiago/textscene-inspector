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

/** Godot 4.6.3's scratch scene for its editor monitor: three surfaces in view, one behind the camera. */
function countedScene(isShadowed: boolean): string {
  return `[gd_scene format=3]

[sub_resource type="BoxMesh" id="Box_1"]

[sub_resource type="SphereMesh" id="Sphere_1"]

[sub_resource type="StandardMaterial3D" id="Glass_1"]
transparency = 1
albedo_color = Color(1, 1, 1, 0.5)

[node name="Root" type="Node3D"]

[node name="Box" type="MeshInstance3D" parent="."]
mesh = SubResource("Box_1")

[node name="Sphere" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)
mesh = SubResource("Sphere_1")

[node name="Glass" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -2, 0, 0)
mesh = SubResource("Box_1")
surface_material_override/0 = SubResource("Glass_1")

[node name="Behind" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 20)
mesh = SubResource("Box_1")

[node name="Sun" type="DirectionalLight3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 0.7, 0.7, 0, -0.7, 0.7, 0, 3, 0)
shadow_enabled = ${isShadowed}

[node name="Camera3D" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 6)
current = true
`;
}

export interface CountedFrame {
  objects: number;
  primitives: number;
  /** Whether the window carried the GPU and step timings, which only `show.performance` turns on. */
  hasTimings: boolean;
}

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
  /** The FPS of `status().frame` with `show.performance` off, or null with no window measured. */
  fps: number | null;
  /** The frame numbers of the counted scene in the game view, without shadows and with them. */
  plain: CountedFrame | null;
  shadowed: CountedFrame | null;
}

/** Polls for a window other than `previous`, as a host reads them: `onStatusChange` never calls for them. */
function measuredFrame(
  view: { status(): ViewStatus },
  previous: ViewStatus['frame'] = null
): Promise<ViewStatus['frame']> {
  const startedAt = performance.now();
  return new Promise((resolve) => {
    const poll = () => {
      const { frame } = view.status();
      if ((frame && frame !== previous) || performance.now() - startedAt > FRAME_WAIT_MS) resolve(frame);
      else setTimeout(poll, 100);
    };
    poll();
  });
}

/** The second window after the counted scene settles, so every frame of it draws the settled scene. */
async function countedFrame(isShadowed: boolean): Promise<CountedFrame | null> {
  const scene = openScene({ source: countedScene(isShadowed), provider: NO_FILES });
  const view = mountScene(elementOf(320, 240), scene, { mode: 'in-game' });
  try {
    await view.settled;
    const frame = await measuredFrame(view, await measuredFrame(view));
    if (!frame) return null;
    return {
      objects: frame.objectsPerFrame,
      primitives: frame.primitivesPerFrame,
      hasTimings: 'timings' in frame,
    };
  } finally {
    view.dispose();
    scene.dispose();
  }
}

async function viewChecks(): Promise<Omit<StatusCheckResults, 'plain' | 'shadowed'>> {
  const scene = openScene({ source: STATUS_SCENE, provider: NO_FILES });
  const heard: ViewStatus[] = [];
  const view = mountScene(elementOf(320, 240), scene, {
    mode: '3D',
    onStatusChange: (status) => heard.push(status),
  });
  try {
    const settled = await view.settled;
    const { settled: statusSettled, undrawn } = view.status();
    const heardTextureBuild = heard.some((status) => status.pending.textures > 0);
    const fps = (await measuredFrame(view))?.fps ?? null;
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

export async function runStatusChecks(): Promise<StatusCheckResults> {
  return { ...(await viewChecks()), plain: await countedFrame(false), shadowed: await countedFrame(true) };
}

import { mountScene, openScene, type ResourceProvider } from '@textscene/renderer';
import { base64Of, capturePng, elementOf, NO_FILES } from './capture';

/** A Camera3D, one light, one mesh and a Control over the world, in a window of the default size. */
const CONSUMER_SCENE = `[gd_scene format=3]

[sub_resource type="StandardMaterial3D" id="Material_1"]
albedo_color = Color(0.2, 0.6, 1, 1)

[sub_resource type="BoxMesh" id="BoxMesh_1"]
material = SubResource("Material_1")

[node name="Root" type="Node3D"]

[node name="Camera3D" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 3)
current = true

[node name="Sun" type="DirectionalLight3D" parent="."]
transform = Transform3D(0.866025, -0.25, 0.433013, 0, 0.866025, 0.5, -0.5, -0.433013, 0.75, 0, 2, 0)

[node name="Cube" type="MeshInstance3D" parent="."]
transform = Transform3D(0.707107, 0, 0.707107, 0, 1, 0, -0.707107, 0, 0.707107, 0, 0, 0)
mesh = SubResource("BoxMesh_1")

[node name="Hud" type="CanvasLayer" parent="."]

[node name="Score" type="ColorRect" parent="Hud"]
offset_left = 16.0
offset_top = 16.0
offset_right = 176.0
offset_bottom = 56.0
color = Color(0.9, 0.7, 0.1, 1)
`;

/** A project file that sets no window size, so the window opens at Godot's 1152 x 648. */
const DEFAULT_PROJECT = `[application]

config/name="Consumer"
`;

/** A red square in a 320 x 240 game, in a 640 x 240 window that keeps its aspect with bars. */
const TRANSPARENT_SCENE = `[gd_scene format=3]

[node name="Menu" type="Control"]
layout_mode = 3
anchors_preset = 0

[node name="Square" type="ColorRect" parent="."]
offset_left = 140.0
offset_top = 100.0
offset_right = 180.0
offset_bottom = 140.0
color = Color(1, 0, 0, 1)
`;

const TRANSPARENT_PROJECT = `[display]

window/size/viewport_width=320
window/size/viewport_height=240
window/size/window_width_override=640
window/size/window_height_override=240
window/stretch/mode="canvas_items"

[rendering]

viewport/transparent_background=true
`;

export function projectOf(project: string): ResourceProvider {
  return { loadResource: async (path) => (path === 'res://project.godot' ? project : null) };
}

export interface MountCheckResults {
  earlyCaptureError: string;
  settledValue: unknown;
  smallElementPng: string;
  largeElementPng: string;
  noProjectSize: { width: number; height: number };
  editorSettledValue: unknown;
  editorCaptureSize: { width: number; height: number };
  canvasesAfterDispose: number;
  isContextLostAfterDispose: boolean;
  transparentPng: string;
}

const errorOf = (promise: Promise<unknown>): Promise<string> =>
  promise.then(
    () => 'resolved',
    (error: Error) => error.message
  );

async function sizeOf(png: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(png);
  return { width: bitmap.width, height: bitmap.height };
}

/** Disposes a view, then mounts the same scene again: the scene outlives its views. */
async function disposeChecks(scene: ReturnType<typeof openScene>) {
  const element = elementOf(320, 240);
  const view = mountScene(element, scene);
  await view.settled;
  const context = element.querySelector('canvas')!.getContext('webgl2')!;
  view.dispose();
  const canvasesAfterDispose = element.querySelectorAll('canvas').length;
  const isContextLostAfterDispose = context.isContextLost();
  const again = mountScene(elementOf(320, 240), scene);
  // A second mount that never settles fails the run on its timeout.
  await again.settled;
  again.dispose();
  return { canvasesAfterDispose, isContextLostAfterDispose };
}

/** One view at a time: the area light and decal atlases hold one WebGL context's textures. */
export async function runMountChecks(): Promise<MountCheckResults> {
  const consumer = openScene({ source: CONSUMER_SCENE, provider: projectOf(DEFAULT_PROJECT) });

  const early = mountScene(elementOf(320, 240), consumer);
  const earlyCaptureError = await errorOf(early.captureImage());
  const settledValue = await early.settled;
  early.dispose();

  const smallElementPng = await base64Of(await capturePng(consumer, 320, 240));
  const largeElementPng = await base64Of(await capturePng(consumer, 1920, 1080));

  const noProject = openScene({ source: CONSUMER_SCENE, provider: NO_FILES });
  const noProjectSize = await sizeOf(await capturePng(noProject, 320, 240));

  const editor = mountScene(elementOf(320, 240), consumer, { mode: '3D' });
  const editorSettledValue = await editor.settled;
  const editorCaptureSize = await sizeOf(await editor.captureImage());
  editor.dispose();

  const disposed = await disposeChecks(consumer);

  const transparent = openScene({ source: TRANSPARENT_SCENE, provider: projectOf(TRANSPARENT_PROJECT) });
  const transparentPng = await base64Of(await capturePng(transparent, 320, 240));

  return {
    earlyCaptureError,
    settledValue,
    smallElementPng,
    largeElementPng,
    noProjectSize,
    editorSettledValue,
    editorCaptureSize,
    ...disposed,
    transparentPng,
  };
}

import { mountScene, openScene, type ResourceProvider } from '@textscene/renderer';
import { base64Of, capturePng, elementOf } from './capture';
import { WINDOW_320_PROJECT } from './switchView';

/** A quad that fills the camera, unshaded, so its pixels are the texture's. */
function quadScene(textureResource: string, texture: string): string {
  return `[gd_scene format=3]

${textureResource}

[sub_resource type="StandardMaterial3D" id="Material_1"]
shading_mode = 0
albedo_texture = ${texture}

[sub_resource type="QuadMesh" id="QuadMesh_1"]
material = SubResource("Material_1")
size = Vector2(2, 2)

[node name="Root" type="Node3D"]

[node name="Camera3D" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1.5)
current = true

[node name="Quad" type="MeshInstance3D" parent="."]
mesh = SubResource("QuadMesh_1")
`;
}

const NOISE_SCENE = quadScene(
  `[sub_resource type="FastNoiseLite" id="Noise_1"]
frequency = 0.05

[sub_resource type="NoiseTexture2D" id="NoiseTexture_1"]
width = 512
height = 512
noise = SubResource("Noise_1")`,
  'SubResource("NoiseTexture_1")'
);

const UNTEXTURED_SCENE = quadScene('', 'null');

const SWATCH_PATH = 'res://swatch.png';
const SWATCH_SCENE = quadScene(
  `[ext_resource type="Texture2D" path="${SWATCH_PATH}" id="1"]`,
  'ExtResource("1")'
);

/** How many views the poll captures before it gives up on a change. */
const MAX_POLLS = 50;
const POLL_INTERVAL_MS = 100;

/** A one-colour PNG, drawn by the page's own canvas. */
async function swatchPng(colour: string): Promise<ArrayBuffer> {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 4;
  const context = canvas.getContext('2d')!;
  context.fillStyle = colour;
  context.fillRect(0, 0, 4, 4);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('expected the canvas to encode a PNG, got none');
  return blob.arrayBuffer();
}

/** The host's files: the project, and a swatch it can repaint and announce through `watch`. */
class SwatchProvider implements ResourceProvider {
  private swatch: ArrayBuffer | null = null;
  private readonly watchers = new Set<(path: string) => void>();

  async loadResource(path: string): Promise<string | ArrayBuffer | null> {
    if (path === 'res://project.godot') return WINDOW_320_PROJECT;
    return path === SWATCH_PATH ? this.swatch : null;
  }

  watch(listener: (path: string) => void): () => void {
    this.watchers.add(listener);
    return () => this.watchers.delete(listener);
  }

  paint(swatch: ArrayBuffer): void {
    this.swatch = swatch;
    for (const listener of this.watchers) listener(SWATCH_PATH);
  }
}

/** The worker constructor the page had, wrapped to count what the package starts. */
function countWorkers(): () => number {
  const PageWorker = window.Worker;
  let started = 0;
  window.Worker = class extends PageWorker {
    constructor(url: string | URL, options?: WorkerOptions) {
      super(url, options);
      started += 1;
    }
  };
  return () => started;
}

async function capturePlain(source: string): Promise<string> {
  const scene = openScene({ source, provider: new SwatchProvider() });
  try {
    return await base64Of(await capturePng(scene, 320, 240));
  } finally {
    scene.dispose();
  }
}

/** The noise the package's worker builds, and the quad with no texture, which the noise must change. */
async function noiseChecks() {
  const started = countWorkers();
  const noisePng = await capturePlain(NOISE_SCENE);
  return { workersStarted: started(), noisePng, untexturedPng: await capturePlain(UNTEXTURED_SCENE) };
}

/** A view of the swatch, repainted through `watch`: the same canvas draws the new colour. */
async function watchChecks() {
  const provider = new SwatchProvider();
  provider.paint(await swatchPng('#ff0000'));
  const scene = openScene({ source: SWATCH_SCENE, provider });
  const element = elementOf(320, 240);
  const view = mountScene(element, scene, { mode: 'in-game' });
  try {
    await view.settled;
    const canvas = element.querySelector('canvas');
    const redPng = await base64Of(await view.captureImage());
    provider.paint(await swatchPng('#0000ff'));
    let repaintedPng = redPng;
    for (let poll = 0; poll < MAX_POLLS && repaintedPng === redPng; poll += 1) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      await view.settled;
      repaintedPng = await base64Of(await view.captureImage());
    }
    return { redPng, repaintedPng, isSameCanvas: element.querySelector('canvas') === canvas };
  } finally {
    view.dispose();
    element.remove();
    scene.dispose();
  }
}

/** A fresh view of the swatch painted blue, the picture the repainted view must match. */
async function freshBluePng(): Promise<string> {
  const provider = new SwatchProvider();
  provider.paint(await swatchPng('#0000ff'));
  const scene = openScene({ source: SWATCH_SCENE, provider });
  const element = elementOf(320, 240);
  const view = mountScene(element, scene, { mode: 'in-game' });
  try {
    await view.settled;
    return await base64Of(await view.captureImage());
  } finally {
    view.dispose();
    element.remove();
    scene.dispose();
  }
}

export interface LoadCheckResults {
  /** Workers the package started for a NoiseTexture2D. */
  workersStarted: number;
  noisePng: string;
  untexturedPng: string;
  redPng: string;
  repaintedPng: string;
  freshBluePng: string;
  /** Whether the view kept its canvas through the repaint. */
  isSameCanvas: boolean;
}

/** One view at a time, as the mount checks draw them. */
export async function runLoadChecks(): Promise<LoadCheckResults> {
  const noise = await noiseChecks();
  const watched = await watchChecks();
  return { ...noise, ...watched, freshBluePng: await freshBluePng() };
}

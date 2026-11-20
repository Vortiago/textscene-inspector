import { mountScene, openScene, variant, type Scene, type SceneFile } from '@textscene/renderer';
import { elementOf, NO_FILES } from './capture';

const MISSING_PATH = 'res://missing.png';

/** The notice of a change comes in a frame after the change, which can be after `settled` resolves. */
const NOTICE_WAIT_MS = 1000;

/** A sprite whose texture no file answers, so the scene asks for a file and does not get it. */
const MISSING_TEXTURE_SCENE = `[gd_scene format=3]

[ext_resource type="Texture2D" path="${MISSING_PATH}" id="1"]

[node name="Root" type="Node2D"]

[node name="Sprite" type="Sprite2D" parent="."]
position = Vector2(160, 120)
texture = ExtResource("1")
`;

export interface MissingFileCheckResults {
  /** `scene.files()` once none is loading, before any view mounts. */
  beforeView: readonly SceneFile[];
  /** The keys of the first `settled` value. */
  settledKeys: string[];
  /** The missing paths of `scene.files()` at each `subscribe` notice, in order. */
  heard: string[][];
  /** The missing paths of `scene.files()` after the host writes `texture = null`. */
  afterWrite: string[];
}

const missingPathsOf = (scene: Scene) =>
  scene
    .files()
    .filter((file) => file.state === 'missing')
    .map((file) => file.path);

/** `scene.files()` once no entry is loading. */
function loadedFiles(scene: Scene): Promise<readonly SceneFile[]> {
  return new Promise((resolve) => {
    const check = () => {
      if (scene.files().some((file) => file.state === 'loading')) return;
      stop();
      resolve(scene.files());
    };
    const stop = scene.subscribe(check);
    check();
  });
}

export async function runMissingFileChecks(): Promise<MissingFileCheckResults> {
  const scene = openScene({
    source: MISSING_TEXTURE_SCENE,
    provider: NO_FILES,
    rootScenePath: 'res://main.tscn',
  });
  const heard: string[][] = [];
  const stopHearing = scene.subscribe(() => heard.push(missingPathsOf(scene)));
  const beforeView = await loadedFiles(scene);
  const view = mountScene(elementOf(320, 240), scene);
  try {
    const settledKeys = Object.keys(await view.settled);
    await scene.getNode('Sprite').set('texture', variant('null'));
    await view.settled;
    await new Promise((resolve) => setTimeout(resolve, NOTICE_WAIT_MS));
    return { beforeView, settledKeys, heard, afterWrite: missingPathsOf(scene) };
  } finally {
    view.dispose();
    stopHearing();
    scene.dispose();
  }
}

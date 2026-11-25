import {
  mountScene,
  openScene,
  variant,
  type Scene,
  type SceneFailure,
  type SceneFile,
} from '@textscene/renderer';
import { elementOf, NO_FILES } from './capture';

const MISSING_PATH = 'res://missing.png';

/** The notice of a change comes in a frame after the change, which can be after `settled` resolves. */
const NOTICE_WAIT_MS = 1000;

/** A file still loading after this long is a failure to report, not a run to hang. */
const LOAD_WAIT_MS = 10_000;

/** A sprite whose texture no file answers, so the scene asks for a file and does not get it. */
const MISSING_TEXTURE_SCENE = `[gd_scene format=3]

[ext_resource type="Texture2D" path="${MISSING_PATH}" id="1"]

[node name="Root" type="Node2D"]

[node name="Sprite" type="Sprite2D" parent="."]
position = Vector2(160, 120)
texture = ExtResource("1")
`;

/** A section that reads the missing file, so the game refuses the whole scene. */
const REFUSED_SCENE = `[gd_scene format=3]

[ext_resource type="Texture2D" path="${MISSING_PATH}" id="1"]

[sub_resource type="AtlasTexture" id="a"]
atlas = ExtResource("1")

[node name="Root" type="Node2D"]
`;

/** A section that names an id no `[ext_resource]` declares, so the game refuses the scene at no file. */
const UNPARSED_SCENE = `[gd_scene format=3]

[sub_resource type="Resource" id="a"]
metadata/x = ExtResource("99")

[node name="Root" type="Node2D"]
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
  /** `scene.sceneFailure()` of a scene the game refuses through the missing file, once none is loading. */
  refused: SceneFailure | null;
  /** `scene.sceneFailure()` of a scene the game refuses at an undeclared id. */
  unparsed: SceneFailure | null;
}

const missingPathsOf = (scene: Scene) =>
  scene
    .files()
    .filter((file) => file.state === 'missing')
    .map((file) => file.path);

/** `scene.files()` once no entry is loading, or as they stand after `LOAD_WAIT_MS`. */
function loadedFiles(scene: Scene): Promise<readonly SceneFile[]> {
  return new Promise((resolve) => {
    const settle = () => {
      clearTimeout(timer);
      stop();
      resolve(scene.files());
    };
    const check = () => {
      if (!scene.files().some((file) => file.state === 'loading')) settle();
    };
    const timer = setTimeout(settle, LOAD_WAIT_MS);
    const stop = scene.subscribe(check);
    check();
  });
}

async function sceneFailureOf(source: string): Promise<SceneFailure | null> {
  const scene = openScene({ source, provider: NO_FILES, rootScenePath: 'res://main.tscn' });
  try {
    await loadedFiles(scene);
    return scene.sceneFailure();
  } finally {
    scene.dispose();
  }
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
    const afterWrite = missingPathsOf(scene);
    const refused = await sceneFailureOf(REFUSED_SCENE);
    return {
      beforeView,
      settledKeys,
      heard,
      afterWrite,
      refused,
      unparsed: await sceneFailureOf(UNPARSED_SCENE),
    };
  } finally {
    view.dispose();
    stopHearing();
    scene.dispose();
  }
}

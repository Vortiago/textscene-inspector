import { mountScene, openScene, variant } from '@textscene/renderer';
import { elementOf, NO_FILES } from './capture';

const MISSING_PATH = 'res://missing.png';

/** A sprite whose texture no file answers, so the scene asks for a file and does not get it. */
const MISSING_TEXTURE_SCENE = `[gd_scene format=3]

[ext_resource type="Texture2D" path="${MISSING_PATH}" id="1"]

[node name="Root" type="Node2D"]

[node name="Sprite" type="Sprite2D" parent="."]
position = Vector2(160, 120)
texture = ExtResource("1")
`;

export interface MissingFileCheckResults {
  /** `missingFiles` of the first `settled`. */
  atSettled: string[];
  /** `scene.missingFiles()` after that `settled`. */
  ofScene: string[];
  /** `scene.missingFiles()` at each `subscribe` notice, in order. */
  heard: string[][];
  /** `missingFiles` of the `settled` after the host writes `texture = null`. */
  afterWrite: string[];
}

export async function runMissingFileChecks(): Promise<MissingFileCheckResults> {
  const scene = openScene({ source: MISSING_TEXTURE_SCENE, provider: NO_FILES });
  const heard: string[][] = [];
  const stopHearing = scene.subscribe(() => heard.push([...scene.missingFiles()]));
  const view = mountScene(elementOf(320, 240), scene);
  try {
    const atSettled = [...(await view.settled).missingFiles];
    const ofScene = [...scene.missingFiles()];
    await scene.getNode('Sprite').set('texture', variant('null'));
    const afterWrite = [...(await view.settled).missingFiles];
    return { atSettled, ofScene, heard, afterWrite };
  } finally {
    view.dispose();
    stopHearing();
    scene.dispose();
  }
}

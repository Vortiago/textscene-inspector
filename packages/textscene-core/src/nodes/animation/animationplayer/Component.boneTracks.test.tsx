/**
 * A transform track on `Skeleton3D:<bone>` writes the pose of the bone, so the mesh bound to the
 * skeleton moves with the transport (`animation_mixer.cpp:791-803`, `:1878-1891`). The skin
 * matrices of a bound mesh are the observable.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import * as logger from '../../../logger';
import { mountWithPlayer, play, select, stop } from '../../../r3f/testing/animationPlayback';
import { ribbonBonesText, ribbonScene } from '../../3d/testing/skinnedRibbon.testkit';
import { instanceAs } from '../../3d/testing/reactThreeTestInstance';

const PLAYER = 'Root/AnimationPlayer';

/** The turn the issue measures against Godot: -60 degrees about Z, on bone b4. */
const BEND = 'Quaternion(0, 0, -0.5, 0.866025)';

/** One clip, "bend", whose `tracks` are written one after the other. */
function clip(...tracks: string[]): string {
  const body = tracks
    .map(
      (track, i) => `tracks/${i}/enabled = true
tracks/${i}/interp = 1
tracks/${i}/loop_wrap = true
${track}`
    )
    .join('');
  return `[sub_resource type="Animation" id="Bend"]
resource_name = "bend"
length = 1.0
${body}
[sub_resource type="AnimationLibrary" id="Lib"]
_data = {
"bend": SubResource("Bend")
}
`;
}

const rotationTrack = (path: string, ...keys: string[]) =>
  `tracks/0/type = "rotation_3d"
tracks/0/path = NodePath("${path}")
tracks/0/keys = PackedFloat32Array(${keys.join(', ')})
`;

/** The ribbon scene with a player of `animation`, and the Skeleton3D `bones`. */
function playedScene(animation: string, bones = ribbonBonesText()): string {
  return ribbonScene({
    bones,
    extra: animation,
    extraNodes: `[node name="AnimationPlayer" type="AnimationPlayer" parent="."]
libraries/ = SubResource("Lib")
`,
  });
}

const BEND_AT_ONCE = clip(
  rotationTrack('Skeleton3D:b4', '0', '1', '0, 0, -0.5, 0.866025', '1', '1', '0, 0, -0.5, 0.866025')
);

type Mounted = Awaited<ReturnType<typeof mountWithPlayer>>['renderer'];

/** The bone matrices of the one skinned mesh `renderer` draws. */
function boneMatrices(renderer: Mounted): number[] {
  const skinned = instanceAs<THREE.SkinnedMesh>(renderer.scene.findByType('SkinnedMesh'));
  return Array.from(skinned.skeleton.boneMatrices!);
}

function expectMatrices(actual: number[], expected: number[]): void {
  expect(actual).toEqual(expected.map((value) => expect.closeTo(value, 5)));
}

async function mounted(tscn: string): Promise<Mounted> {
  return (await mountWithPlayer(tscn, PLAYER)).renderer;
}

/** The skin of the scene whose file pose is the pose the clip makes at time 0, which Godot draws. */
async function staticTwin(): Promise<number[]> {
  const twin = ribbonScene({ bones: ribbonBonesText(6, { 4: BEND }) });
  return boneMatrices(await mounted(twin));
}

/** The bend clip playing half a second in, and the skin of the same skeleton before it played. */
async function bentAfterHalfSecond(): Promise<{ renderer: Mounted; filePose: number[] }> {
  // The transport `play` drives is the one of the scene mounted last.
  const filePose = boneMatrices(await mounted(ribbonScene()));
  const renderer = await mounted(playedScene(BEND_AT_ONCE));
  await play();
  await renderer.advanceFrames(1, 0.5);
  return { renderer, filePose };
}

const warnings = vi.spyOn(logger, 'warn');
afterEach(() => warnings.mockClear());

describe('an AnimationPlayer track on Skeleton3D:<bone>', () => {
  it('leaves the file pose while the player does not play', async () => {
    const renderer = await mounted(playedScene(BEND_AT_ONCE));

    expectMatrices(boneMatrices(renderer), boneMatrices(await mounted(ribbonScene())));
  });

  it('gives the bound mesh the skin of the static twin, as Godot draws the clip at time 0', async () => {
    const renderer = await mounted(playedScene(BEND_AT_ONCE));

    await play();
    await renderer.advanceFrames(1, 0.5);

    expectMatrices(boneMatrices(renderer), await staticTwin());
    expect(boneMatrices(renderer)).not.toEqual(boneMatrices(await mounted(ribbonScene())));
  });

  it('moves the skin in place, never building the skeleton again', async () => {
    const filePose = boneMatrices(await mounted(ribbonScene()));
    const renderer = await mounted(playedScene(BEND_AT_ONCE));
    const skeleton = instanceAs<THREE.SkinnedMesh>(renderer.scene.findByType('SkinnedMesh')).skeleton;

    await play();
    await renderer.advanceFrames(3, 0.1);

    expect(instanceAs<THREE.SkinnedMesh>(renderer.scene.findByType('SkinnedMesh')).skeleton).toBe(skeleton);
    expect(boneMatrices(renderer)).not.toEqual(filePose);
  });

  it('restores the file pose on stop', async () => {
    const { renderer, filePose } = await bentAfterHalfSecond();
    expect(boneMatrices(renderer)).not.toEqual(filePose);

    await stop();
    await renderer.advanceFrames(1, 0.1);

    expectMatrices(boneMatrices(renderer), filePose);
  });

  it('restores the file pose at the stop itself, before another frame runs', async () => {
    const { renderer, filePose } = await bentAfterHalfSecond();

    await stop();

    expectMatrices(boneMatrices(renderer), filePose);
  });

  it('restores the file pose when the selection leaves the player, as ADR-0012 stops it', async () => {
    const { renderer, filePose } = await bentAfterHalfSecond();
    expect(boneMatrices(renderer)).not.toEqual(filePose);

    await select('Root/Mesh');
    await renderer.advanceFrames(1, 0.1);

    expectMatrices(boneMatrices(renderer), filePose);
  });

  it('writes nothing for a bone the skeleton lacks, and warns once however long it plays', async () => {
    const ghost = clip(
      rotationTrack('Skeleton3D:ghost', '0', '1', BEND.slice(11, -1), '1', '1', BEND.slice(11, -1))
    );
    const renderer = await mounted(playedScene(ghost));

    await play();
    await renderer.advanceFrames(4, 0.1);

    expectMatrices(boneMatrices(renderer), boneMatrices(await mounted(ribbonScene())));
    expect(warnings.mock.calls.filter(([message]) => String(message).includes('ghost'))).toHaveLength(1);
  });
});

describe('an AnimationPlayer bone track reads the keys as Godot does', () => {
  it('slerps a rotation between two keys of one track', async () => {
    const half = clip(
      rotationTrack('Skeleton3D:b4', '0', '1', '0, 0, 0, 1', '1', '1', '0, 0, -0.5, 0.866025')
    );
    const renderer = await mounted(playedScene(half));

    await play();
    await renderer.advanceFrames(1, 0.5);

    // Halfway between no turn and -60 degrees: -30 degrees, or (0, 0, -0.258819, 0.965926).
    const halfway = ribbonBonesText(6, { 4: 'Quaternion(0, 0, -0.258819, 0.965926)' });
    expectMatrices(boneMatrices(renderer), boneMatrices(await mounted(ribbonScene({ bones: halfway }))));
  });
});

describe('an AnimationPlayer track with one subname on a node that is not a Skeleton3D', () => {
  it('turns the node, as Godot binds it as a transform track of the node (animation_mixer.cpp:795)', async () => {
    const onMesh = clip(
      rotationTrack('Mesh:b4', '0', '1', '0, 0, -0.5, 0.866025', '1', '1', '0, 0, -0.5, 0.866025')
    );
    const renderer = await mounted(playedScene(onMesh));
    const mesh = instanceAs<THREE.SkinnedMesh>(renderer.scene.findByType('SkinnedMesh'));
    const turnedBefore = mesh.getWorldQuaternion(new THREE.Quaternion()).z;

    await play();
    await renderer.advanceFrames(1, 0.5);

    expect(mesh.getWorldQuaternion(new THREE.Quaternion()).z).not.toBeCloseTo(turnedBefore, 2);
    expectMatrices(boneMatrices(renderer), boneMatrices(await mounted(ribbonScene())));
  });
});

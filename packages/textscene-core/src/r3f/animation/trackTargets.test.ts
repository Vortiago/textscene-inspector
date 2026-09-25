import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { AnimationClip, NumberKeyframeTrack, VectorKeyframeTrack } from 'three';
import * as logger from '../../logger';
import { bindClip, findTrackTarget, mixerRootOf, trackTargetPaths } from './trackTargets';

/** The dispatcher's shape: an unnamed wrapper registered by path, around the node's named group. */
function mountNode(parent: THREE.Object3D, name: string): { wrapper: THREE.Object3D; group: THREE.Object3D } {
  const wrapper = new THREE.Group();
  const group = new THREE.Group();
  group.name = name;
  wrapper.add(group);
  parent.add(wrapper);
  return { wrapper, group };
}

describe('findTrackTarget', () => {
  it('finds the named group inside the wrapper the path registers', () => {
    const scene = new THREE.Scene();
    const arm = mountNode(scene, 'Arm');
    const objects = new Map([['Root/Right/Arm', arm.wrapper]]);
    expect(findTrackTarget('Root/Right/Arm', objects)).toBe(arm.group);
  });

  it('tells two same-named nodes apart by their paths', () => {
    const scene = new THREE.Scene();
    const left = mountNode(scene, 'Arm');
    const right = mountNode(scene, 'Arm');
    const objects = new Map([
      ['Root/Left/Arm', left.wrapper],
      ['Root/Right/Arm', right.wrapper],
    ]);
    expect(findTrackTarget('Root/Right/Arm', objects)).toBe(right.group);
  });

  it('prefers the node’s own group to a same-named descendant', () => {
    const scene = new THREE.Scene();
    const outer = mountNode(scene, 'Arm');
    mountNode(outer.group, 'Arm');
    expect(findTrackTarget('Root/Arm', new Map([['Root/Arm', outer.wrapper]]))).toBe(outer.group);
  });

  it('walks by name into content no path registers, such as a glTF scene', () => {
    const scene = new THREE.Scene();
    const robot = mountNode(scene, 'Robot');
    const armature = new THREE.Object3D();
    armature.name = 'Armature';
    const hip = new THREE.Bone();
    hip.name = 'Hip';
    armature.add(hip);
    robot.group.add(armature);
    const objects = new Map([['Root/Robot', robot.wrapper]]);
    expect(findTrackTarget('Root/Robot/Armature/Hip', objects)).toBe(hip);
  });

  it('finds nothing for a path whose ancestor does not exist', () => {
    const scene = new THREE.Scene();
    const arm = mountNode(scene, 'Arm');
    const objects = new Map([['Root/Right/Arm', arm.wrapper]]);
    expect(findTrackTarget('Root/Nope/Arm', objects)).toBeNull();
  });

  it('never walks into another node’s subtree for a node that is not mounted', () => {
    const scene = new THREE.Scene();
    const root = mountNode(scene, 'Root');
    const other = mountNode(root.group, 'Other');
    const deeper = mountNode(other.group, 'Sprite');
    const objects = new Map([
      ['Root', root.wrapper],
      ['Root/Other', other.wrapper],
      ['Root/Other/Sprite', deeper.wrapper],
    ]);
    expect(findTrackTarget('Root/Sprite', objects)).toBeNull();
  });

  it('finds nothing for a path no registered prefix covers', () => {
    expect(findTrackTarget('Root/Arm', new Map())).toBeNull();
  });
});

describe('trackTargetPaths', () => {
  it('lists each scene path a clip’s tracks name, once', () => {
    const clip = new AnimationClip('a', 1, [
      new NumberKeyframeTrack('Root/A.rotation[x]', [0], [0]),
      new NumberKeyframeTrack('Root/A.rotation[y]', [0], [0]),
      new VectorKeyframeTrack('Root/B.position', [0], [0, 0, 0]),
    ]);
    expect(trackTargetPaths([clip])).toEqual(['Root/A', 'Root/B']);
  });
});

describe('bindClip', () => {
  it('renames each track to its target’s uuid, which PropertyBinding matches exactly', () => {
    const target = new THREE.Object3D();
    const clip = new AnimationClip('slide', 1, [new VectorKeyframeTrack('Root/A.position', [0, 1], [0, 0, 0, 1, 0, 0])]);
    const bound = bindClip(clip, new Map([['Root/A', target]]));
    expect(bound.tracks.map((t) => t.name)).toEqual([`${target.uuid}.position`]);
  });

  it('keeps the clip’s name and duration', () => {
    const clip = new AnimationClip('slide', 2.5, []);
    const bound = bindClip(clip, new Map());
    expect([bound.name, bound.duration]).toEqual(['slide', 2.5]);
  });

  it('drops a track whose target is not in the scene, with a warning, and keeps its siblings', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const target = new THREE.Object3D();
    const clip = new AnimationClip('a', 1, [
      new VectorKeyframeTrack('Root/Gone.position', [0], [0, 0, 0]),
      new VectorKeyframeTrack('Root/A.position', [0], [0, 0, 0]),
    ]);
    const bound = bindClip(clip, new Map([['Root/A', target]]));
    expect(bound.tracks.map((t) => t.name)).toEqual([`${target.uuid}.position`]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Root/Gone'));
    warn.mockRestore();
  });

  it('drives the exact target through a mixer rooted above it', () => {
    const scene = new THREE.Scene();
    const left = mountNode(scene, 'Arm');
    const right = mountNode(scene, 'Arm');
    const clip = new AnimationClip('reach', 1, [new VectorKeyframeTrack('Root/Right/Arm.position', [0, 1], [5, 0, 0, 5, 0, 0])]);
    const bound = bindClip(clip, new Map([['Root/Right/Arm', right.group]]));
    const mixer = new THREE.AnimationMixer(scene);
    mixer.clipAction(bound).play();
    mixer.update(0.5);
    expect([left.group.position.x, right.group.position.x]).toEqual([0, 5]);
  });
});

describe('mixerRootOf', () => {
  it('is the scene the object hangs in, above every node a track can name', () => {
    const scene = new THREE.Scene();
    const outer = mountNode(scene, 'Root');
    const player = mountNode(outer.group, 'AnimationPlayer');
    expect(mixerRootOf(player.group)).toBe(scene);
  });

  it('is the object itself when nothing holds it', () => {
    const lone = new THREE.Object3D();
    expect(mixerRootOf(lone)).toBe(lone);
  });
});

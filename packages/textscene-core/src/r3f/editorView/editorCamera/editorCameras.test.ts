import { describe, expect, it } from 'vitest';
import { createEditorCameras, type EditorCameraBacking } from './editorCameras';

function stage(pose: unknown, scene = 'res://main.tscn'): EditorCameraBacking & { given: unknown[] } {
  const given: unknown[] = [];
  return {
    given,
    scene: () => scene,
    get: () => null,
    set: () => false,
    call: () => null,
    pose: () => pose,
    setPose: (next) => void given.push(next),
  };
}

describe('createEditorCameras', () => {
  it('gives the next stage of a mode the pose the last one left', () => {
    const slot = createEditorCameras().slot('Camera3D');
    const unbind = slot.bind(stage('orbit after a drag'));
    unbind();

    const next = stage(null);
    slot.bind(next);

    expect(next.given).toEqual(['orbit after a drag']);
  });

  it('gives a stage of another scene no pose', () => {
    const slot = createEditorCameras().slot('Camera3D');
    slot.bind(stage('orbit of main'))();

    const next = stage(null, 'res://other.tscn');
    slot.bind(next);

    expect(next.given).toEqual([]);
  });

  it('gives the first stage of a mode no pose', () => {
    const first = stage(null);
    createEditorCameras().slot('Camera3D').bind(first);

    expect(first.given).toEqual([]);
  });

  it('keeps the pose of one mode from the other', () => {
    const cameras = createEditorCameras();
    cameras.slot('Camera3D').bind(stage('3D orbit'))();

    const stage2D = stage(null);
    cameras.slot('Camera2D').bind(stage2D);

    expect(stage2D.given).toEqual([]);
  });

  it('keeps the pose of a stage an older removal no longer holds', () => {
    const slot = createEditorCameras().slot('Camera2D');
    const unbindOld = slot.bind(stage('old'));
    slot.bind(stage('new'));
    unbindOld();

    const next = stage(null);
    slot.bind(next);

    expect(next.given).toEqual([]);
  });

  it('rejects a read once the view ends', async () => {
    const cameras = createEditorCameras();
    cameras.end(new Error('expected a mounted view, got a disposed one'));

    await expect(cameras.of('2D')!.get('zoom')).rejects.toThrow('got a disposed one');
    expect(cameras.hasEnded()).toBe(true);
  });
});

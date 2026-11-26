import { describe, expect, it, vi } from 'vitest';
import { createSceneFileWalk, type WalkInput } from './sceneFileWalk';
import { ResourceEventBus, type ResourceType } from '../ResourceEventBus';
import type { ResourceLoader } from '../ResourceLoader';

const MAIN = 'res://main.tscn';
const GLB = 'res://model.glb';
const MATERIAL = 'res://blue.tres';

/** A processor that loads nothing, so each request stays in flight. */
function pendingProcessor() {
  return {
    getCached: () => undefined,
    isLoading: () => false,
    pin: vi.fn(),
    unpin: vi.fn(),
    request: vi.fn(),
  };
}

function pendingLoader() {
  const loader = {
    eventBus: new ResourceEventBus(),
    scenes: pendingProcessor(),
    resources: pendingProcessor(),
    glbMeshes: pendingProcessor(),
    loadOutcomes: pendingProcessor(),
  };
  return { loader, walk: createSceneFileWalk(loader as unknown as ResourceLoader, () => {}) };
}

const readOf = (path: string, type: string): WalkInput => ({
  starts: [{ owner: MAIN, reads: [{ path, type }] }],
  failing: null,
});

describe('createSceneFileWalk', () => {
  it.each<[string, ResourceType, keyof ReturnType<typeof pendingLoader>['loader'], string, string]>([
    ['a glTF', 'glb', 'glbMeshes', GLB, 'PackedScene'],
    ['a text resource', 'resource', 'resources', MATERIAL, 'Material'],
  ])('requests %s again when its load in flight is invalidated', (_what, busType, processor, path, type) => {
    const { loader, walk } = pendingLoader();
    walk.files(readOf(path, type));

    loader.eventBus.emit(busType, 'invalidated', path);

    expect((loader[processor] as ReturnType<typeof pendingProcessor>).request).toHaveBeenCalledTimes(2);
  });
});

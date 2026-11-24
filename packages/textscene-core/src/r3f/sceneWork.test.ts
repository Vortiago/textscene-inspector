import { describe, expect, it } from 'vitest';
import { describePendingWork, hasPendingWork, pendingSceneWork, totalPendingWork } from './sceneWork';
import { memoisedImport } from '../resources/memoisedImport';

const NO_WORK = { resources: 0, textures: 0, fonts: 0, modules: 0 };

describe('pending scene work', () => {
  it('sums every kind of work', () => {
    expect(totalPendingWork({ resources: 2, textures: 1, fonts: 3, modules: 0 })).toBe(6);
  });

  it('has work while any kind is pending, and none at zero', () => {
    expect(hasPendingWork({ ...NO_WORK, fonts: 1 })).toBe(true);
    expect(hasPendingWork(NO_WORK)).toBe(false);
  });

  it('names each pending kind with its count, joined with "and"', () => {
    expect(describePendingWork({ resources: 2, textures: 1, fonts: 0, modules: 0 })).toBe(
      '2 resources and 1 texture'
    );
    expect(describePendingWork({ resources: 1, textures: 2, fonts: 1, modules: 0 })).toBe(
      '1 resource, 2 textures and 1 font'
    );
  });

  it('counts a code import in flight, so a sky shader that still loads keeps the view pending', async () => {
    let land!: (module: object) => void;
    const load = memoisedImport(() => new Promise<object>((resolve) => (land = resolve)));
    const landed = load();
    expect(pendingSceneWork(null).modules).toBe(1);
    land({});
    await landed;
    expect(pendingSceneWork(null).modules).toBe(0);
  });

  it('names a pending module', () => {
    expect(describePendingWork({ ...NO_WORK, modules: 2 })).toBe('2 modules');
  });

  it('describes no work as an empty text', () => {
    expect(describePendingWork(NO_WORK)).toBe('');
  });
});

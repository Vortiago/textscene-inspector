import { describe, expect, it } from 'vitest';
import { createViewWork } from '../resources/viewWork';
import {
  describePendingWork,
  hasPendingWork,
  isSamePendingWork,
  isViewWorking,
  subscribeSceneWork,
  totalPendingWork,
} from './sceneWork';

const NO_WORK = { resources: 0, textures: 0, fonts: 0 };

describe('pending scene work', () => {
  it('sums every kind of work', () => {
    expect(totalPendingWork({ resources: 2, textures: 1, fonts: 3 })).toBe(6);
  });

  it('has work while any kind is pending, and none at zero', () => {
    expect(hasPendingWork({ ...NO_WORK, fonts: 1 })).toBe(true);
    expect(hasPendingWork(NO_WORK)).toBe(false);
  });

  it('names each pending kind with its count, joined with "and"', () => {
    expect(describePendingWork({ resources: 2, textures: 1, fonts: 0 })).toBe('2 resources and 1 texture');
    expect(describePendingWork({ resources: 1, textures: 2, fonts: 1 })).toBe(
      '1 resource, 2 textures and 1 font'
    );
  });

  it('is the same work only where every kind has the same count', () => {
    expect(isSamePendingWork({ ...NO_WORK }, NO_WORK)).toBe(true);
    expect(isSamePendingWork({ ...NO_WORK, resources: 1 }, NO_WORK)).toBe(false);
  });

  it('describes no work as an empty text', () => {
    expect(describePendingWork(NO_WORK)).toBe('');
  });
});

describe('the work of a view', () => {
  it('is working while any kind of its work is in flight', () => {
    const work = createViewWork();
    const endWork = work.textures.begin();
    expect(isViewWorking(work)).toBe(true);

    endWork();

    expect(isViewWorking(work)).toBe(false);
  });

  it('is never working outside a view (error case)', () => {
    expect(isViewWorking(null)).toBe(false);
  });

  it('tells a subscriber of a change of each kind of work', async () => {
    const work = createViewWork();
    const heard: string[] = [];
    subscribeSceneWork(work, () => heard.push('change'));
    work.resources.begin();
    work.textures.begin();
    work.fonts.begin();
    await Promise.resolve();

    expect(heard).toHaveLength(3);
  });

  it('tells a subscriber nothing once it unsubscribes', async () => {
    const work = createViewWork();
    const heard: string[] = [];
    subscribeSceneWork(work, () => heard.push('change'))();
    work.resources.begin();
    work.fonts.begin();
    await Promise.resolve();

    expect(heard).toEqual([]);
  });

  it('counts no work of another view', () => {
    const working = createViewWork();
    working.fonts.begin();

    expect(isViewWorking(createViewWork())).toBe(false);
  });
});

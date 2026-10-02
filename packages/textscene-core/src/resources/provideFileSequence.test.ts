import { describe, expect, it, vi } from 'vitest';
import type { ResourceType } from './ResourceEventBus';
import { DependencyGraph } from './dependencyGraph';
import { runProvideFileSequence } from './provideFileSequence';

/** A processor that holds exactly `held`, and records what it is asked to clear. */
function processorHolding(...held: string[]) {
  return {
    clearCache: vi.fn(),
    isCached: (key: string) => held.includes(key),
    isLoading: () => false,
  };
}

describe('runProvideFileSequence', () => {
  it('clears a dependent its cache still holds', () => {
    const themes = processorHolding('res://ui.tres');
    const dependencies = new DependencyGraph();
    dependencies.record({ busType: 'theme', key: 'res://ui.tres' }, 'res://body.tres');

    runProvideFileSequence({
      path: 'res://body.tres',
      processors: new Map<ResourceType, typeof themes>([['theme', themes]]),
      dependencies,
    });

    expect(themes.clearCache).toHaveBeenCalledWith('res://ui.tres');
  });

  it('skips a dependent its cache evicted, and forgets it', () => {
    const themes = processorHolding();
    const dependencies = new DependencyGraph();
    dependencies.record({ busType: 'theme', key: 'res://ui.tres' }, 'res://body.tres');

    runProvideFileSequence({
      path: 'res://body.tres',
      processors: new Map<ResourceType, typeof themes>([['theme', themes]]),
      dependencies,
    });

    expect(themes.clearCache.mock.calls).toEqual([['res://body.tres']]);
    expect(dependencies.release('res://body.tres')).toEqual([]);
  });
});

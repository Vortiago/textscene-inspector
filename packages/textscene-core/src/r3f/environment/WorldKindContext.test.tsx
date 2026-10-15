import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { WorldKindProvider, useWorldKind, type WorldKind } from './WorldKindContext';

function worldKindUnder(...worlds: WorldKind[]): WorldKind {
  const wrapper = ({ children }: { children: ReactNode }) =>
    worlds.reduceRight<ReactNode>(
      (inner, world) => <WorldKindProvider world={world}>{inner}</WorldKindProvider>,
      children
    );
  return renderHook(() => useWorldKind(), { wrapper }).result.current;
}

describe('useWorldKind', () => {
  it('reads the world its provider names', () => {
    expect(worldKindUnder('subViewport')).toBe('subViewport');
  });

  it('reads the root world with no provider, as the canvas draws the root viewport', () => {
    expect(worldKindUnder()).toBe('root');
  });

  it('reads the nearest provider under nested worlds (edge case)', () => {
    expect([worldKindUnder('subViewport', 'root'), worldKindUnder('root', 'subViewport')]).toEqual([
      'root',
      'subViewport',
    ]);
  });
});

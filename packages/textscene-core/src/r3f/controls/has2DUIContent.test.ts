import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../parser/types';
import { has2DUIContent } from './has2DUIContent';

function node(type: string, children: TscnNode[] = []): TscnNode {
  return { name: type, type, children, properties: {} } as TscnNode;
}

describe('has2DUIContent', () => {
  it('detects a top-level Control node', () => {
    expect(has2DUIContent([node('Control')])).toBe(true);
  });

  it('detects 2D UI nested under 3D nodes (mixed scene)', () => {
    expect(has2DUIContent([node('Node3D', [node('CanvasLayer', [node('Button')])])])).toBe(true);
  });

  it('returns false for a pure-3D tree', () => {
    expect(has2DUIContent([node('Node3D', [node('MeshInstance3D'), node('Camera3D')])])).toBe(false);
  });

  it('returns false for an empty tree', () => {
    expect(has2DUIContent([])).toBe(false);
  });
});

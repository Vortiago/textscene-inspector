import { describe, expect, it } from 'vitest';
import { nodeHeadingErrors, type NodeHeadingContext } from './nodeHeadingChecks.js';
import { parseHeading } from '../../parser/utils.js';

const owner = { nodeName: 'N', nodeType: 'Node3D' };

function errorsOf(line: string, context: Partial<NodeHeadingContext> = {}) {
  return nodeHeadingErrors(parseHeading(line)!, {
    line: 3,
    isRoot: false,
    owner,
    hasInstancedAncestor: () => false,
    ...context,
  });
}

const codes = (line: string, context?: Partial<NodeHeadingContext>) =>
  errorsOf(line, context).map((e) => e.code);

describe('nodeHeadingErrors', () => {
  it('passes a heading that states its name and type', () => {
    expect(errorsOf('[node name="A" type="Node3D" parent="."]')).toEqual([]);
  });

  it('refuses a heading with no name, on its line and owner', () => {
    expect(errorsOf('[node type="Node3D" parent="."]')).toEqual([
      expect.objectContaining({ code: 'MISSING_NODE_NAME', severity: 'error', line: 3, column: 1, ...owner }),
    ]);
  });

  it('refuses an InstancePlaceholder root', () => {
    expect(codes('[node name="R" instance_placeholder="res://a.tscn"]', { isRoot: true })).toEqual([
      'INSTANCE_PLACEHOLDER_ROOT',
    ]);
  });

  it('refuses a root that states no type and no instance', () => {
    expect(errorsOf('[node name="R"]', { isRoot: true })).toEqual([
      expect.objectContaining({ code: 'MISSING_NODE_IDENTIFIER', severity: 'error' }),
    ]);
  });

  it('warns on an override heading that no instance encloses', () => {
    expect(errorsOf('[node name="A" parent="B"]')).toEqual([
      expect.objectContaining({ code: 'MISSING_NODE_IDENTIFIER', severity: 'warning' }),
    ]);
  });

  it('passes an override heading inside instanced content', () => {
    expect(errorsOf('[node name="A" parent="B"]', { hasInstancedAncestor: () => true })).toEqual([]);
  });
});

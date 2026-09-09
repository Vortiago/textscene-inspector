/**
 * A `renderIntent: 'pending'` type mounts a base component, so
 * `GenericNodeFallback`, the only other place the placeholder marker is set,
 * never runs for it. The marker must survive that: `PlainNode` publishes it on
 * the wrapper group, which is the Object3D `registerNodeObject` resolves for
 * the node's path.
 *
 * DERIVED, not listed: the subject types come from the registry's own
 * `isPending` claim, so a new pending slice joins this contract when it
 * registers rather than when someone remembers to extend a literal.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../parser/types';
import { TscnParser } from '../parser/TscnParser';
import { NodeDispatcher } from './NodeDispatcher';
import { nodeComponentRegistry } from './NodeComponentRegistry';
import { SelectionProvider } from './contexts/SelectionContext';
import { CanvasWorkspaceProvider } from './contexts/CanvasWorkspaceContext';

// All node-type components self-register on import. Pull in the barrel.
import './nodes/index';

const PENDING_TYPES = nodeComponentRegistry
  .getAllTypeNames()
  .filter((type) => nodeComponentRegistry.isPending(type))
  .sort();

/**
 * Parsed rather than hand-built: a 2D component reads defaulted keys
 * (`position`, `scale`, …) that only the registered parser fills in, and a bare
 * `properties: {}` makes it throw into the ErrorBoundary instead of rendering.
 */
function subject(type: string): TscnNode {
  const scene = new TscnParser().parse(
    `[gd_scene format=3]\n\n[node name="Subject" type="${type}"]\n`
  );
  return scene.nodes[0]!;
}

/** The canvas that draws this type, so the workspace split never skips the subject. */
async function renderNode(node: TscnNode) {
  const workspace = nodeComponentRegistry.isCanvasItem(node.type) ? '2d' : '3d';
  return ReactThreeTestRenderer.create(
    <SelectionProvider>
      <CanvasWorkspaceProvider workspace={workspace}>
        <NodeDispatcher nodes={[node]} />
      </CanvasWorkspaceProvider>
    </SelectionProvider>
  );
}

function markedGroups(renderer: Awaited<ReturnType<typeof renderNode>>) {
  return renderer.scene
    .findAllByType('Group')
    .filter((g) => (g.instance.userData as { isPlaceholder?: boolean }).isPlaceholder === true);
}

describe('pending registrations keep the placeholder marker', () => {
  it('derives a non-trivial set, so an empty filter cannot vacuously pass', () => {
    expect(PENDING_TYPES.length).toBeGreaterThanOrEqual(8);
    expect(PENDING_TYPES).toContain('Window');
  });

  it.each([...PENDING_TYPES])('%s carries userData.isPlaceholder with its type and name', async (type) => {
    const renderer = await renderNode(subject(type));
    const marked = markedGroups(renderer);

    expect(marked).toHaveLength(1);
    expect(marked[0]!.instance.userData).toMatchObject({
      isPlaceholder: true,
      nodeType: type,
      nodeName: 'Subject',
    });
  });

  it('leaves a drawing type unmarked', async () => {
    const renderer = await renderNode(subject('Node3D'));
    expect(markedGroups(renderer)).toHaveLength(0);
  });
});

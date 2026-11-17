import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ReactNode } from 'react';
import { useLayoutEffect } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../parser/types';
import { NodeDispatcher } from '../NodeDispatcher';
import { SelectionProvider, useSelection } from '../contexts/SelectionContext';
import { CanvasWorkspaceProvider } from '../contexts/CanvasWorkspaceContext';
import { ViewportModeProvider } from '../contexts/ViewportModeContext';
import { RunningGameScope } from '../contexts/EditorHintContext';
import { nodeComponentRegistry } from '../NodeComponentRegistry';
import { descendsFromClass } from '../../godot/classdb/classBaseTypes.js';
import { GEOMETRY_INSTANCE_DEFAULTS } from '../../nodes/3d/geometryinstance3d/types';
import { nodeRegistry } from '../../core/NodeRegistry';
import { heading } from '../../parser/testing/parserKit';
import { isEditorHelper } from '../editorHelpers';

// Side-effect imports: every node component (the barrel the apps use) and every node parser.
import './index';
import '../../parser/TscnParser';

const TYPES = nodeComponentRegistry.getAllTypeNames().sort();

const SUBJECT = 'Subject';

function subjectOf(type: string): TscnNode {
  const parsed = nodeRegistry.getRegistration(type)?.parser(heading(type, { name: SUBJECT }), {}) ?? {};
  // A GeometryInstance3D parse carries its instance state, which every other type ignores.
  const properties = descendsFromClass(type, 'Node3D')
    ? { ...GEOMETRY_INSTANCE_DEFAULTS, ...parsed }
    : parsed;
  return {
    rawProperties: {},
    name: SUBJECT,
    type,
    children: [],
    properties: { ...properties, name: SUBJECT },
  };
}

function Selects({ path }: { path: string }) {
  const { setSelectedNodePath } = useSelection();
  useLayoutEffect(() => setSelectedNodePath(path), [path, setSelectedNodePath]);
  return null;
}

/** The game, under a toolbar with every editor overlay and preview on, with the subject selected. */
function inGame(tree: ReactNode) {
  return (
    <ViewportModeProvider
      initialShowCollisions
      initialShowNavigation
      initialShowGizmos
      initialShowGrid
      initialShowPreviewSun
      initialShowPreviewEnvironment
    >
      <RunningGameScope>
        <Selects path={SUBJECT} />
        {tree}
      </RunningGameScope>
    </ViewportModeProvider>
  );
}

/** The editor with every editor overlay and preview off and nothing selected. */
function inBareEditor(tree: ReactNode) {
  return (
    <ViewportModeProvider
      initialShowCollisions={false}
      initialShowNavigation={false}
      initialShowGizmos={false}
      initialShowGrid={false}
      initialShowPreviewSun={false}
      initialShowPreviewEnvironment={false}
    >
      {tree}
    </ViewportModeProvider>
  );
}

async function render(type: string, around: (tree: ReactNode) => ReactNode) {
  const workspace = descendsFromClass(type, 'Node2D') || descendsFromClass(type, 'Control') ? '2d' : '3d';
  return ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace={workspace}>
      <SelectionProvider>{around(<NodeDispatcher nodes={[subjectOf(type)]} />)}</SelectionProvider>
    </CanvasWorkspaceProvider>
  );
}

type Rendered = Awaited<ReturnType<typeof render>>;

/** What the frame shows: each visible drawable or light by its THREE type and name, in tree order. */
function shown(renderer: Rendered): string[] {
  const drawn: string[] = [];
  (renderer.scene.instance as THREE.Object3D).traverseVisible((object) => {
    const draws =
      object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points;
    if (draws || object instanceof THREE.Light || object instanceof THREE.Sprite) {
      drawn.push(`${object.type}:${object.name}`);
    }
  });
  return drawn;
}

function visibleEditorHelpers(renderer: Rendered): THREE.Object3D[] {
  const helpers: THREE.Object3D[] = [];
  (renderer.scene.instance as THREE.Object3D).traverseVisible((object) => {
    if (isEditorHelper(object)) helpers.push(object);
  });
  return helpers;
}

describe('where the game runs, no node draws an editor element', () => {
  it('covers every registered type, so an empty list cannot vacuously pass', () => {
    expect(TYPES.length).toBeGreaterThanOrEqual(180);
    expect(TYPES).toEqual(
      expect.arrayContaining(['Camera3D', 'Marker2D', 'ReferenceRect', 'CollisionShape3D'])
    );
  });

  it.each(TYPES)('%s draws no editor helper', async (type) => {
    expect(visibleEditorHelpers(await render(type, inGame))).toEqual([]);
  });

  it.each(TYPES)('%s draws as the editor draws it with every overlay off', async (type) => {
    expect(shown(await render(type, inGame))).toEqual(shown(await render(type, inBareEditor)));
  });
});

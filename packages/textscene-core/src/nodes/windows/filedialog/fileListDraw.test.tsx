/** The dialog's painter draws a row for each entry the file list holds, with its label, in the list the dialog solves. */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../parser/types';
import { heading } from '../../../parser/testing/parserKit';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme';
import { painterEnv } from '../../../r3f/controls/native/testing/painterProps';
import { solveNode } from '../../../r3f/controls/native/testing/solveNode';
import { measureText } from '../../../r3f/controls/native/text/measurer';
import '../../../parser/TscnParser';
import '../../../r3f/controls/index';
import { wrappedWindowSize } from '../window/wrapControls';
import { DialogChrome } from '../acceptdialog/DialogChrome';
import { parseFileDialog } from './parser';
import { resolveFileDialog } from './resolve';

const THEME = nativeTheme(1);
const EMBEDDER = { x: 1152, y: 648 };

const ENTRIES = [
  { name: 'Alpha', isDirectory: true },
  { name: 'a.png', isDirectory: false },
  { name: 'b.png', isDirectory: false },
];

async function textMeshCount(entries: typeof ENTRIES) {
  const lines = { filters: 'PackedStringArray("*.png ; PNG Image")' };
  const raw = {
    name: 'Dialog',
    type: 'FileDialog',
    children: [],
    rawProperties: lines,
    properties: parseFileDialog(heading('FileDialog', { name: 'Dialog' }), lines),
  } as unknown as TscnNode;
  const node = resolveFileDialog(raw, { 'res://': { kind: 'listed', entries } });
  const window = { ...solveNode(), path: 'Dialog', node };
  const size = wrappedWindowSize(window, THEME, measureText, EMBEDDER);
  const renderer = await ReactThreeTestRenderer.create(
    <DialogChrome
      {...painterEnv()}
      measureText={measureText}
      solveNode={window}
      rect={{ x: 0, y: 0, w: size.x, h: size.y }}
      renderOrder={0}
    />
  );
  return renderer.scene
    .findAllByType('Mesh')
    .map((mesh) => mesh.instance as THREE.Mesh)
    .filter((mesh) => (mesh.material as THREE.ShaderMaterial).uniforms?.uColor !== undefined).length;
}

describe('FileDialog file list drawing', () => {
  it('draws one more label for each row of the list', async () => {
    expect((await textMeshCount(ENTRIES)) - (await textMeshCount([]))).toBe(3);
  });
});

/**
 * The one solve over an AcceptDialog and a ConfirmationDialog places their internal Controls as Godot
 * 4.6.3 does (`nodes/windows/acceptdialog/testing/dialogGeometry/`, scenes `A` and a plain
 * ConfirmationDialog, measured with the row's children added to `sceneOracle.gd`).
 */
import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../parser/types';
import { heading } from '../../../parser/testing/parserKit';
import { parseDialog } from '../../../nodes/windows/acceptdialog/parser';
import { parseConfirmationDialog } from '../../../nodes/windows/confirmationdialog/parser';
import { wrappedWindowSize } from '../../../nodes/windows/window/wrapControls';
import { controlProps } from '../../../nodes/2d/ui/control/testing/controlProps';
import { createSolveContext, solveControlTree } from './controlRectSolver';
import { controlSolverRegistry } from './solverRegistry';
import type { SolveNode } from './solveTree';
import { nativeTheme } from './nativeTheme';
import { measureText } from './text/measurer';
import { controlNode, solveNode, withThemeItems } from './testing/solveNode';
import { registerInternalControls } from './internalControls';
import { defineChannel } from './solveHandoff';
import './../../controls/index';

const THEME = nativeTheme(1);
const EMBEDDER = { x: 1152, y: 648 };
const LONG_TEXT = 'This is a rather long message that should wrap across several lines inside the dialog';
const rect = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

function solvedRects(type: 'AcceptDialog' | 'ConfirmationDialog', lines: Record<string, string>) {
  const parse = type === 'AcceptDialog' ? parseDialog : parseConfirmationDialog;
  const properties = parse(heading(type, { name: 'Dialog' }), lines);
  const node = { name: 'Dialog', type, children: [], properties } as unknown as TscnNode;
  const dialog = withThemeItems({ ...solveNode(), path: 'Dialog', node });
  const size = wrappedWindowSize(dialog, THEME, measureText, EMBEDDER);
  const solved = solveControlTree(
    [dialog],
    rect(0, 0, size.x, size.y),
    createSolveContext(THEME, measureText)
  );
  return (path: string) => solved.get(`Dialog/${path}`)?.rect;
}

describe('the solve of an AcceptDialog (scene A)', () => {
  const rectOf = solvedRects('AcceptDialog', {
    visible: 'true',
    dialog_text: JSON.stringify(LONG_TEXT),
    dialog_autowrap: 'true',
  });

  it('places the message label in the content rect', () => {
    expect(rectOf('@WrappingMessageLabel')).toEqual(rect(8, 8, 645, 43));
  });

  it('places the button row on the bottom edge', () => {
    expect(rectOf('@ButtonsHBox')).toEqual(rect(8, 61, 645, 31));
  });

  it('lays the row out as a spacer, the OK button and a spacer', () => {
    expect(rectOf('@ButtonsHBox/@Spacer0')).toEqual(rect(0, 0, 303, 31));
    expect(rectOf('@ButtonsHBox/@OkButton')).toEqual(rect(307, 0, 31, 31));
    expect(rectOf('@ButtonsHBox/@Spacer1')).toEqual(rect(342, 0, 303, 31));
  });
});

describe('the solve of a ConfirmationDialog', () => {
  const rectOf = solvedRects('ConfirmationDialog', { dialog_text: '"Delete this file?"' });

  it('puts Cancel before OK, with a spacer on each side of each', () => {
    expect(rectOf('@ButtonsHBox')).toEqual(rect(8, 61, 184, 31));
    expect(rectOf('@ButtonsHBox/@Spacer0')).toEqual(rect(0, 0, 25, 31));
    expect(rectOf('@ButtonsHBox/@CancelButton')).toEqual(rect(29, 0, 60, 31));
    expect(rectOf('@ButtonsHBox/@Spacer1')).toEqual(rect(93, 0, 26, 31));
    expect(rectOf('@ButtonsHBox/@OkButton')).toEqual(rect(123, 0, 31, 31));
    expect(rectOf('@ButtonsHBox/@Spacer2')).toEqual(rect(158, 0, 26, 31));
  });
});

/** Calls of the probe's minimum size. A solve context computes each minimum once, so this counts passes. */
let probeMinimumCalls = 0;
controlSolverRegistry.registerMinimumSize('PassCountProbe', () => {
  probeMinimumCalls += 1;
  return { x: 0, y: 0 };
});

function passesOverDialog(lines: Record<string, string>): number {
  const properties = parseDialog(heading('AcceptDialog', { name: 'Dialog' }), lines);
  const node = { name: 'Dialog', type: 'AcceptDialog', children: [], properties } as unknown as TscnNode;
  const probeNode = {
    name: 'Probe',
    type: 'PassCountProbe',
    children: [],
    properties: controlProps({ name: 'Probe' }),
  };
  const probe = { ...solveNode(), path: 'Dialog/Probe', node: probeNode as unknown as TscnNode } as SolveNode;
  const dialog = withThemeItems({ ...solveNode(), path: 'Dialog', node, children: [probe] });
  probeMinimumCalls = 0;
  solveControlTree([dialog], rect(0, 0, 320, 200), createSolveContext(THEME, measureText));
  return probeMinimumCalls;
}

describe('the passes of a dialog solve', () => {
  it('solves a dialog whose message does not wrap in one pass', () => {
    expect(passesOverDialog({ dialog_text: '"Delete?"' })).toBe(1);
  });

  it('solves a dialog whose message wraps in a second pass, at the width the first gave', () => {
    expect(passesOverDialog({ dialog_text: '"Delete?"', dialog_autowrap: 'true' })).toBe(2);
  });
});

const placedAt = defineChannel<string>('placedAt');

registerInternalControls(
  'HostThatSeals',
  () => [{ mode: 'front', spec: { type: 'Control', name: 'Inner', properties: { name: 'Inner' } } }],
  (host, [inner]) => ({
    rects: new Map([[inner!.node.path, rect(1, 2, 3, 4)]]),
    meta: new Map([[inner!.node.path, placedAt.seal(host.path)]]),
  })
);

describe('the solve of an internal Control its class hands a value', () => {
  it('records the value its class seals on its solved entry', () => {
    const host = { ...solveNode(), path: 'Host', node: controlNode('Host', 'HostThatSeals') };
    const solved = solveControlTree([host], rect(0, 0, 100, 100), createSolveContext(THEME, measureText));
    expect(placedAt.open(solved.get('Host/@Inner')?.meta)).toBe('Host');
  });
});

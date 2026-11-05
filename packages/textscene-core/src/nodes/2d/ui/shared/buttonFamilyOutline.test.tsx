/**
 * The theme text outline of Button, CheckBox, CheckButton, OptionButton and MenuButton
 * (`button.cpp:458-462`). `<TextRunMesh>` is stubbed to read the props each painter hands it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { ComponentType } from 'react';
import type { TscnNode } from '../../../../parser/types';
import type { Rgba } from '../../../../godot/math/math';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { controlNode, solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { TEST_SCENE_FONT_METRICS } from '../../../../r3f/controls/native/testing/sceneFontMetrics';
import * as sceneFontLoader from '../../../../r3f/controls/native/text/sceneFontLoader';
import { outlineStrokeWidthPx } from '../../../../r3f/controls/native/text/textOutline';
import { Button } from '../button/Component';
import { CheckBox } from '../checkbox/Component';
import { CheckButton } from '../checkbutton/Component';
import { MenuButton } from '../menubutton/Component';
import { OptionButton } from '../optionbutton/Component';

interface RunProps {
  layout: { fontMetrics: { kind: string } };
  strokeWidthPx?: number;
  renderOrder?: number;
}

const scene = vi.hoisted(() => ({ runs: [] as RunProps[] }));

vi.mock('../../../../r3f/controls/native/text/TextRunMesh', () => ({
  TextRunMesh: (props: RunProps) => {
    scene.runs.push(props);
    return null;
  },
}));

vi.mock('../../../../r3f/controls/native/text/bundledFontLoader', () => ({
  peekBundledCanvasFontMetrics: () => TEST_SCENE_FONT_METRICS,
}));

const RECT = { x: 0, y: 0, w: 160, h: 40 };
const RED: Rgba = { r: 1, g: 0, b: 0, a: 1 };
const OUTLINE_SIZE = 8;

const CONTROLS: ReadonlyArray<readonly [string, ComponentType<NativeControlComponentProps>]> = [
  ['Button', Button],
  ['CheckBox', CheckBox],
  ['CheckButton', CheckButton],
  ['OptionButton', OptionButton],
  ['MenuButton', MenuButton],
];

function outlined(type: string, colors: SolveNode['colors'], constants: SolveNode['constants']): SolveNode {
  // OptionButton draws its selected item's text, not a `text` property.
  const properties = { name: 'N', text: 'Hi', items: [{ text: 'Hi' }], selected: 0 };
  const node: TscnNode = controlNode('N', type, properties);
  return { ...emptySolveNode(), path: 'N', node, colors, constants };
}

async function render(Control: ComponentType<NativeControlComponentProps>, solveNode: SolveNode) {
  scene.runs = [];
  await ReactThreeTestRenderer.create(
    <Control {...painterEnv()} solveNode={solveNode} rect={RECT} renderOrder={0} />
  );
}

const strokeRuns = () => scene.runs.filter((run) => run.strokeWidthPx);
const fillRun = () => scene.runs.find((run) => !run.strokeWidthPx)!;

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(CONTROLS)('<%s> theme text outline', (type, Control) => {
  describe('on a scene font', () => {
    beforeEach(() => {
      vi.spyOn(sceneFontLoader, 'peekSceneFontMetrics').mockReturnValue(TEST_SCENE_FONT_METRICS);
    });

    it('strokes a ring below the fill', async () => {
      await render(Control, outlined(type, { font_outline_color: RED }, { outline_size: OUTLINE_SIZE }));

      expect(strokeRuns()).toHaveLength(1);
      expect(strokeRuns()[0]!.strokeWidthPx).toBe(outlineStrokeWidthPx(OUTLINE_SIZE));
      expect(strokeRuns()[0]!.renderOrder).toBeLessThan(fillRun().renderOrder!);
    });

    it('draws no ring at outline_size 0', async () => {
      await render(Control, outlined(type, { font_outline_color: RED }, { outline_size: 0 }));

      expect(strokeRuns()).toHaveLength(0);
    });

    it('draws no ring at a zero alpha', async () => {
      await render(
        Control,
        outlined(type, { font_outline_color: { ...RED, a: 0 } }, { outline_size: OUTLINE_SIZE })
      );

      expect(strokeRuns()).toHaveLength(0);
    });

    it('draws no ring by default', async () => {
      await render(Control, outlined(type, {}, {}));

      expect(strokeRuns()).toHaveLength(0);
    });
  });

  describe('on the bundled font', () => {
    it('strokes the ring and fills the text on the canvas face, as FreeType draws both', async () => {
      await render(Control, outlined(type, { font_outline_color: RED }, { outline_size: OUTLINE_SIZE }));

      await vi.waitFor(() => expect(strokeRuns()).toHaveLength(1));
      expect(strokeRuns()[0]!.strokeWidthPx).toBe(outlineStrokeWidthPx(OUTLINE_SIZE));
      expect(strokeRuns()[0]!.layout.fontMetrics.kind).toBe('canvas');
      expect(strokeRuns()[0]!.renderOrder).toBeLessThan(fillRun().renderOrder!);
      expect(fillRun().layout.fontMetrics.kind).toBe('canvas');
    });

    it('draws no ring at outline_size 0', async () => {
      await render(Control, outlined(type, { font_outline_color: RED }, { outline_size: 0 }));

      expect(strokeRuns()).toHaveLength(0);
    });
  });
});

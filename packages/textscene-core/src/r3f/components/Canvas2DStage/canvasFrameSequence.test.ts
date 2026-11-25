/**
 * One canvas frame runs Godot's order (`renderer_viewport.cpp:556`, `:642`, `:688`): every shadow
 * sampler, then the light pass, then the item draw.
 */
import { describe, expect, it } from 'vitest';
import { createCanvasFrameSteps, runCanvasFrame } from './canvasFrameSequence';

describe('runCanvasFrame', () => {
  it('samples every shadow input, then runs the light pass, then draws the items', () => {
    const calls: string[] = [];
    const steps = createCanvasFrameSteps();
    steps.shadowSamplers.add(() => calls.push('casters'));
    steps.shadowSamplers.add(() => calls.push('light pose'));
    steps.lightPass = () => calls.push('light pass');

    runCanvasFrame(steps, () => calls.push('items'));

    expect(calls).toEqual(['casters', 'light pose', 'light pass', 'items']);
  });

  it('writes the translated items\' records after the light pass and before the draw', () => {
    const calls: string[] = [];
    const steps = createCanvasFrameSteps();
    steps.lightPass = () => calls.push('light pass');
    steps.recordWriters.add(() => calls.push('records'));

    runCanvasFrame(steps, () => calls.push('items'));

    expect(calls).toEqual(['light pass', 'records', 'items']);
  });

  it('skips the light pass on a canvas with none', () => {
    const calls: string[] = [];
    const steps = createCanvasFrameSteps();
    steps.shadowSamplers.add(() => calls.push('casters'));

    runCanvasFrame(steps, () => calls.push('items'));

    expect(calls).toEqual(['casters', 'items']);
  });
});

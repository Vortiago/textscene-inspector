/**
 * Holds the binding table to the code that resolves it. Each row with a
 * `trigger` goes to the real resolver, and its label must name the outcome, so
 * a resolver change without a table change fails, and the reverse too.
 */
import { describe, expect, it } from 'vitest';
import { resolveNavMode, resolveWheelMode } from '../../godotEditorCursor';
import { resolveTouchMode } from '../../pointerGesture';
import { controlsFor, type Binding, type BindingOutcome } from './bindings';

/** What each outcome must be called in a row's prose. */
const OUTCOME_LABEL: Record<string, string> = {
  orbit: 'Orbit',
  pan: 'Pan',
  zoom: 'Zoom',
  freelook: 'Freelook',
  null: 'Select',
};

/** What the row's input does, from the resolver that owns it. */
function resolve(binding: Binding): BindingOutcome {
  const trigger = binding.trigger;
  if (!trigger) throw new Error('no trigger');
  if (trigger.kind === 'drag') return resolveNavMode(trigger.button, trigger.mods ?? {});
  if (trigger.kind === 'wheel') return resolveWheelMode(trigger.mods ?? {});
  return resolveTouchMode(trigger.pointers);
}

const TRIGGERED = (['2D', '3D'] as const).flatMap((mode) =>
  controlsFor(mode).groups.flatMap((group) =>
    group.bindings
      .filter((binding) => binding.trigger)
      .map((binding) => ({ mode, device: group.device, binding }))
  )
);

describe('the advertised bindings match the resolvers', () => {
  it.each(TRIGGERED)('$mode $device — $binding.input', ({ binding }) => {
    expect(resolve(binding)).toBe(binding.resolvesTo);
  });

  it.each(TRIGGERED)('$mode $device — $binding.input is labelled for what it does', ({ binding }) => {
    // A row can resolve to 'pan' and still say "Orbit", so the prose must name the outcome.
    expect(binding.action).toContain(OUTCOME_LABEL[String(binding.resolvesTo)]);
  });

  it('covers every row a resolver owns, so none can quietly opt out', () => {
    // A row with a trigger declares its outcome. The mouse table, governed wholly
    // by resolveNavMode and resolveWheelMode, is covered in full.
    for (const { binding } of TRIGGERED) {
      expect(binding.resolvesTo === null || typeof binding.resolvesTo === 'string').toBe(true);
    }
    const mouse = controlsFor('3D').groups.find((group) => group.device === 'Mouse');
    expect(mouse?.bindings.every((binding) => binding.trigger)).toBe(true);
  });
});

/**
 * Holds the advertised binding table to the code that actually resolves it.
 *
 * The help panel is the only place most users will ever learn the bindings
 * from, so a row that says "Orbit" for an input that pans is worse than no row
 * at all. Every row carrying a `trigger` is fed to the real resolver here, and
 * the label is checked against what came back — so changing a resolver without
 * changing the table fails, and vice versa.
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

/** Ask the resolver that owns this row what its input really does. */
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
    // The resolver agreeing is not enough: the row could resolve to 'pan' and
    // still be captioned "Orbit". The prose has to name the outcome too.
    expect(binding.action).toContain(OUTCOME_LABEL[String(binding.resolvesTo)]);
  });

  it('covers every row a resolver owns, so none can quietly opt out', () => {
    // A row with a trigger must declare what it resolves to, and the mouse
    // table — the one wholly governed by resolveNavMode/resolveWheelMode —
    // must be fully covered rather than partially annotated.
    for (const { binding } of TRIGGERED) {
      expect(binding.resolvesTo === null || typeof binding.resolvesTo === 'string').toBe(true);
    }
    const mouse = controlsFor('3D').groups.find((group) => group.device === 'Mouse');
    expect(mouse?.bindings.every((binding) => binding.trigger)).toBe(true);
  });
});

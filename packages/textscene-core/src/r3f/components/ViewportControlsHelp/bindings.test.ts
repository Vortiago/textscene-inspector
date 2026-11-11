/**
 * Holds the binding table to the code that resolves it. Each row with a
 * `trigger` goes to the real resolver, and its label must name the outcome, so
 * a resolver change without a table change fails, and the reverse too.
 */
import { describe, expect, it } from 'vitest';
import { freelookDirectionOf } from '../../editorKeyBindings';
import { resolveNavMode, resolveWheelMode } from '../../godotEditorCursor';
import { resolveTouchMode } from '../../pointerGesture';
import { controlsFor, type Binding, type BindingOutcome } from './bindings';

/** What a row's prose calls each navigation mode. A flight direction goes by its own name. */
const MODE_LABEL: Record<string, string> = {
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
  if (trigger.kind === 'drag') {
    return resolveNavMode(trigger.button, trigger.mods ?? {}, trigger.projection ?? 'perspective');
  }
  if (trigger.kind === 'flightKeys') return theOneDirectionOf(trigger.codes);
  if (trigger.kind === 'wheel') return resolveWheelMode(trigger.mods ?? {});
  return resolveTouchMode(trigger.pointers);
}

/** Every key of a flight row must fly the same way, or the row's one label is wrong for some key. */
function theOneDirectionOf(codes: readonly string[]): BindingOutcome {
  const directions = new Set(codes.map((code) => freelookDirectionOf(code) ?? null));
  if (directions.size !== 1)
    throw new Error(`expected one direction for ${codes.join(', ')}, got ${directions.size}`);
  return [...directions][0]!;
}

/** Every key code a flight key could plausibly sit on: letters, arrows, Space and the modifiers. */
const ALL_KEY_CODES = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => `Key${letter}`),
  ...['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Tab'],
  ...['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight'],
];

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
    const outcome = String(binding.resolvesTo);
    expect(binding.action).toContain(MODE_LABEL[outcome] ?? outcome);
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

  it('lists every flight key, so a new key cannot fly unadvertised', () => {
    const advertised = TRIGGERED.flatMap(({ binding }) =>
      binding.trigger?.kind === 'flightKeys' ? binding.trigger.codes : []
    );
    const flying = ALL_KEY_CODES.filter((code) => freelookDirectionOf(code) !== undefined);
    expect([...advertised].sort()).toEqual(flying.sort());
  });
});

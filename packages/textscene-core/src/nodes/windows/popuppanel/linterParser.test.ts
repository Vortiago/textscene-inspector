/**
 * PopupPanel strict validators: none of its own, the base-walk carries the rest.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing. Rule-level behaviour belongs in linter.test.ts,
 * through `Linter`, which this file deliberately never imports.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import './linterParser';

describe('PopupPanel strict validators', () => {
  it('declares no validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('PopupPanel')).toEqual([]);
  });

  describe('inherited Window properties a scene author can genuinely set on a PopupPanel', () => {
    it('resolves title, size, visible, and transient through the base-walk', () => {
      for (const property of ['title', 'size', 'visible', 'transient']) {
        expect(
          validatorRegistry.findValidator('PopupPanel', property),
          `no validator resolved for PopupPanel.${property}`
        ).not.toBeNull();
      }
    });

    it('accepts a valid title', () => {
      const validator = validatorRegistry.findValidator('PopupPanel', 'title');
      expect(validator?.('title', '"Sample Popup"', 1)).toBeNull();
    });

    it('accepts a valid non-negative size', () => {
      const validator = validatorRegistry.findValidator('PopupPanel', 'size');
      expect(validator?.('size', 'Vector2i(320, 240)', 1)).toBeNull();
    });

    it('accepts a valid boolean visible and transient', () => {
      const visible = validatorRegistry.findValidator('PopupPanel', 'visible');
      expect(visible?.('visible', 'true', 1)).toBeNull();

      const transient = validatorRegistry.findValidator('PopupPanel', 'transient');
      expect(transient?.('transient', 'true', 1)).toBeNull();
    });

    it('still rejects a malformed size, proving the base-walk is a real validator and not a pass-through', () => {
      // Called unconditionally: `validator?.(…)` yields `undefined` when the
      // lookup misses, and `undefined` satisfies `not.toBeNull()` — the
      // rejection claim would hold precisely when no validator resolves.
      const validator = validatorRegistry.findValidator('PopupPanel', 'size');
      if (!validator) throw new Error('no validator resolved for PopupPanel.size');
      expect(validator('size', 'Vector2i(-1, 600)', 1)).not.toBeNull();
    });
  });

  it('resolves the dynamic theme_override_styles/panel key through Window\'s wildcard, not a PopupPanel-specific rule', () => {
    // popup.cpp:428 binds a "panel" stylebox theme item on PopupPanel alone, and
    // default_theme.cpp:726 registers it under the literal class name
    // "PopupPanel", so Window's inherited `_get_property_list` (window.cpp:224)
    // only ever produces `theme_override_styles/panel` for this type. It still
    // resolves here through Window's generic `theme_override_styles/*` wildcard
    // (themeOverrides.ts), confirming PopupPanel needs no entry of its own for it.
    const validator = validatorRegistry.findValidator('PopupPanel', 'theme_override_styles/panel');
    if (!validator) throw new Error('no validator resolved for PopupPanel.theme_override_styles/panel');
    expect(validator('theme_override_styles/panel', 'SubResource("StyleBoxFlat_1")', 1)).toBeNull();
    expect(validator('theme_override_styles/panel', 'not-a-resource', 1)).not.toBeNull();
  });

  describe('the fixture, property by property', () => {
    // The fixture is the deliverable's "zero errors and zero warnings" claim,
    // made checkable without running the full `lint:tscn` pipeline (off limits
    // to this slice, see AGENTS.md): every `key = value` line under the
    // MyPopupPanel node must resolve through the same `findValidator` walk
    // this file already exercises, and return null.
    const fixturePath = join(import.meta.dirname, '../../../../../../scenes/fixtures/unit-popup-panel.tscn');
    const fixture = readFileSync(fixturePath, 'utf8');
    const nodeStart = fixture.indexOf('[node name="MyPopupPanel"');
    const nodeBody = fixture.slice(fixture.indexOf('\n', nodeStart) + 1);
    const nextHeading = nodeBody.indexOf('\n[');
    const propertyLines = (nextHeading === -1 ? nodeBody : nodeBody.slice(0, nextHeading))
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.includes('='));

    it('finds the MyPopupPanel node and at least one property line', () => {
      expect(nodeStart).toBeGreaterThan(-1);
      expect(propertyLines.length).toBeGreaterThan(0);
    });

    for (const line of propertyLines) {
      const eq = line.indexOf('=');
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim();
      it(`accepts fixture line \`${line}\` with no error or warning`, () => {
        const validator = validatorRegistry.findValidator('PopupPanel', key);
        expect(validator, `no validator resolves for PopupPanel.${key}`).not.toBeNull();
        expect(validator?.(key, value, 1)).toBeNull();
      });
    }
  });
});

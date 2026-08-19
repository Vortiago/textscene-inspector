/**
 * A header older than the format these rules are written against.
 *
 * The linter's subject is the text format Godot writes today. Version 3 gave
 * ext/subresources their string ids (resource_format_text.h:44), so on a
 * `format=2` file every reference rule reads integer ids as dangling and every
 * bound is judged against a grammar the file predates. The engine does not draw
 * this line — it has no less-than comparison at all — so the diagnostic reports
 * OUR scope and says so, rather than claiming the file is invalid.
 */

import { describe, expect, it } from 'vitest';
// The BARREL, not `./Linter.js`: the slices self-register their validators and
// rules on import, so a direct import lints every scene into silence and the
// suppression assertions below would pass against nothing.
import { Linter } from './index.js';

/** A scene that lints loudly: an unknown property and a dangling resource id. */
const BODY = `
[node name="Root" type="Node3D"]

[node name="Cam" type="Camera3D" parent="."]
fov = 900
cull_mask = "not a number"
`;

const linter = new Linter();

describe('a legacy format header', () => {
  it('is the ONLY diagnostic reported for the file', () => {
    const noisy = linter.lint(`[gd_scene format=3]\n${BODY}`);
    expect(noisy.length).toBeGreaterThan(1);

    const diagnostics = linter.lint(`[gd_scene format=2]\n${BODY}`);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.severity).toBe('warning');
    expect(diagnostics[0]?.ruleName).toBe('legacy-format-version');
    expect(diagnostics[0]?.location?.line).toBe(1);
    expect(diagnostics[0]?.message).toContain('format=2');
  });

  it('names the observed version and never a single current one', () => {
    const message = linter.lint(`[gd_scene format=1]\n${BODY}`)[0]?.message ?? '';
    expect(message).toContain('format=1');
    // Godot 4.6.3 writes BOTH 3 and 4 from one saver, so the text must not
    // enshrine either as "the" current format.
    expect(message).toContain('3 or 4');
  });

  it('points at the header wherever a comment block pushed it', () => {
    const diagnostics = linter.lint(`; vendored\n\n[gd_scene format=2]\n${BODY}`);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.location?.line).toBe(3);
  });

  it('also covers a .tres header, which shares the version constant', () => {
    const diagnostics = linter.lint('[gd_resource type="Curve" format=2]\n\n[resource]\n');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.ruleName).toBe('legacy-format-version');
  });

  it('suppresses the [resource] body a standalone .tres validates', () => {
    // The body is validated against the header's type, so a legacy `.tres`
    // has diagnostics of its own to withhold — an empty `[resource]` would
    // pass this whether the suppression worked or not.
    const body = '\n[resource]\nbackground_mode = 99\n';
    expect(linter.lint(`[gd_resource type="Environment" format=3]\n${body}`)).toHaveLength(1);

    const diagnostics = linter.lint(`[gd_resource type="Environment" format=2]\n${body}`);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.ruleName).toBe('legacy-format-version');
  });
});

describe('a current format header', () => {
  it.each([3, 4])('lints format=%i normally, both being 4.6.3 output', (format) => {
    const diagnostics = linter.lint(`[gd_scene format=${format}]\n${BODY}`);
    expect(diagnostics.length).toBeGreaterThan(1);
    expect(diagnostics.some((d) => d.ruleName === 'legacy-format-version')).toBe(false);
  });

  it('lints a header declaring no format, which the engine reads as current', () => {
    // `} else { format_version = FORMAT_VERSION; }` (resource_format_text.cpp:1147-1148).
    const diagnostics = linter.lint(`[gd_scene]\n${BODY}`);
    expect(diagnostics.some((d) => d.ruleName === 'legacy-format-version')).toBe(false);
  });

  it('lints a version no integer grammar reads, rather than assuming the worst', () => {
    const diagnostics = linter.lint(`[gd_scene format=abc]\n${BODY}`);
    expect(diagnostics.some((d) => d.ruleName === 'legacy-format-version')).toBe(false);
  });

  it('leaves a file whose header cannot be parsed to the strict parser', () => {
    const diagnostics = linter.lint(`[gd_scene format=2\n${BODY}`);
    expect(diagnostics.some((d) => d.ruleName === 'legacy-format-version')).toBe(false);
    expect(diagnostics.length).toBeGreaterThan(0);
  });
});

/**
 * Turning one target's stats into its list of failures. Every check names what
 * it expected, so a failing gate reads as a measurement rather than a verdict.
 */

/** Godot quantises before the sRGB curve; the 8-bit linear target quantises after. */
const PROBE_TOLERANCE = 2;

export function collectFailures({ overlay, stats, surface, expect, errors }) {
  const failures = [];
  if (!overlay) failures.push('overlay never mounted');
  if (stats.controls < (expect.minControls ?? 1)) {
    failures.push(`controls ${stats.controls} < expected ${expect.minControls ?? 1}`);
  }
  for (const name of expect.hiddenNodes ?? []) {
    if (stats.laidOutNodes.includes(name)) {
      failures.push(`node "${name}" has visible = false but is still laid out`);
    }
  }
  for (const [name, prop, predicate, label] of expect.computed ?? []) {
    const value = stats.computed[name]?.[prop];
    if (value === undefined) failures.push(`node "${name}" not rendered (no ${prop})`);
    else if (!predicate(value)) failures.push(`${name}.${prop} = ${value} — expected ${label}`);
  }
  if (expect.loadedIcons !== undefined) {
    const loaded = stats.icons.filter((i) => i === 'loaded').length;
    if (loaded !== expect.loadedIcons) {
      failures.push(`expected ${expect.loadedIcons} loaded button icon(s), found ${loaded}`);
    }
  }
  for (const [state, style, count] of expect.indicators ?? []) {
    const found = stats.checkIndicators.filter(
      (i) => i.state === state && i.style === style
    ).length;
    if (found !== count) {
      failures.push(`expected ${count} ${state} ${style} indicator(s), found ${found}`);
    }
  }
  for (const type of expect.types ?? []) {
    if (!stats.types.includes(type)) failures.push(`missing control type ${type}`);
  }
  for (const text of expect.texts ?? []) {
    if (!stats.texts.some((t) => t.includes(text))) failures.push(`missing text "${text}"`);
  }
  // The inverse assertion: a string the overlay must NOT paint. A LineEdit
  // with `secret` echoing its plaintext still satisfies every count-based
  // check, so only naming the forbidden string catches it.
  for (const text of expect.absentTexts ?? []) {
    if (stats.texts.some((t) => t.includes(text))) failures.push(`text "${text}" must not be drawn`);
  }
  for (const [target, prop, predicate, label] of expect.grabbers ?? []) {
    const grabber = stats.sliderGrabbers[target];
    if (!grabber) failures.push(`node "${target}" rendered no slider grabber`);
    else if (!predicate(grabber[prop], grabber)) {
      failures.push(`${target}.grabber.${prop} = ${grabber[prop]} — expected ${label}`);
    }
  }
  const maxFallbacks = expect.maxFallbacks ?? 0;
  if (stats.fallbacks > maxFallbacks) {
    failures.push(`${stats.fallbacks} unresolved-texture fallback(s) > allowed ${maxFallbacks}`);
  }
  if (expect.surface) {
    if (!surface || surface.reason) {
      failures.push(`surface: ${surface?.reason ?? 'not read'}`);
    } else {
      const [w, h] = expect.surface.size;
      if (surface.size[0] !== w || surface.size[1] !== h) {
        failures.push(
          `surface canvas is ${surface.size.join('x')}, expected ${w}x${h} (the target's size)`
        );
      }
      expect.surface.probes.forEach(([x, y, wantRgb, label], i) => {
        const got = surface.samples[i];
        if (got.some((c, ch) => Math.abs(c - wantRgb[ch]) > PROBE_TOLERANCE)) {
          failures.push(
            `surface (${x}, ${y}) [${label}] is rgb(${got.join(', ')}), ` +
              `expected rgb(${wantRgb.join(', ')}) ±${PROBE_TOLERANCE}`
          );
        }
      });
    }
  }
  if (errors.length > 0) failures.push(`${errors.length} console error(s)`);
  return failures;
}

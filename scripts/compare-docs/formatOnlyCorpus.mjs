/**
 * Proves what a validator that cites no grounding claims: it refuses only text
 * the tokenizer cannot read, or a type the setter never takes. So it must take
 * every literal Godot reads and stores, from a hand-cited corpus
 * (`formatOnlyCorpus.data.mjs`) keyed by the Variant type the ClassDB capture
 * records for each property.
 */

/**
 * Whether `entry` holds for a slot with this hint. An entry without `slot`
 * holds for every slot of its type. `'untyped'` holds only where the capture
 * names no hint, since an element hint narrows what the setter keeps. A `slot`
 * without `hint_string` holds for every hint string of that hint.
 */
function holdsFor(entry, row) {
  if (entry.slot === undefined) return true;
  if (entry.slot === 'untyped') return row.hint === 0;
  if (entry.slot.hint !== row.hint) return false;
  return entry.slot.hint_string === undefined || entry.slot.hint_string === row.hint_string;
}

/** The corpus entries a property of this Variant type and hint must accept. */
export function applicableEntries(row, corpus) {
  return corpus.filter((entry) => entry.type === row.type && holdsFor(entry, row));
}

/**
 * Whether the validator's report on `entry` is a refusal. A converted literal
 * may draw the `convertedSpelling` warning, since the stored form differs from
 * the written one. Anything else on a stored literal is uncited.
 */
function refuses(report, entry) {
  if (report === null) return false;
  return entry.stores !== 'converted' || report.severity === 'error';
}

/**
 * One line per corpus literal a validator refuses while it cites no grounding.
 * A grounded validator cites its refusals, so it is not this check's subject.
 *
 * @param rows - `{ label, type, hint, hint_string }` per captured property.
 * @param validatorFor - the registered validator for a row, or `undefined`.
 */
export function corpusRefusals(rows, validatorFor, corpus) {
  const refusals = [];
  for (const row of rows) {
    const validator = validatorFor(row);
    if (validator === undefined || validator.grounding) continue;
    for (const entry of applicableEntries(row, corpus)) {
      if (refuses(validator(row.label, entry.literal, 1), entry)) {
        refusals.push(`${row.label} refuses ${entry.literal} (${entry.cite})`);
      }
    }
  }
  return refusals;
}

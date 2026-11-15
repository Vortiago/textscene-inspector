/** The names Godot's `_build_variant_code` defines in every variant, so a set never defines them. */
const ALWAYS_DEFINED = new Set([
  'RENDER_DRIVER_VULKAN',
  'samplerExternalOES',
  'textureExternalOES',
  'defined',
]);

/** With these names (`_build_variant_code`), a variant needs the material's text in the slots. */
export const isMaterialName = (name) => name === 'MATERIAL_UNIFORMS_USED' || name.endsWith('_CODE_USED');

/** How many names one set may hold: the deepest nesting of `#ifdef` in Godot's templates is 4. */
const MAX_NAMES = 5;

/** A name the stage defines under a condition stays: a mode defines it too, with the same empty body. */
export function testedNames(lines, skipped) {
  const tested = new Set();
  for (const { text } of lines) {
    const directive = /^\s*#\s*(?:ifdef|ifndef|if|elif)\b(.*)$/.exec(text);
    for (const name of directive?.[1].replace(/\/\/.*$/, '').match(/[A-Za-z_]\w*/g) ?? []) tested.add(name);
  }
  return [...tested]
    .filter((name) => !skipped.has(name) && !ALWAYS_DEFINED.has(name) && !isMaterialName(name))
    .sort();
}

/** The text of the variant defines of a set, as Godot's C++ writes one mode. */
export const variantText = (names) =>
  names.length === 0 ? '' : `\n${names.map((name) => `#define ${name}\n`).join('')}`;

/** `takenBranches(names)` gives a variant's taken branches, or nothing when the preprocessor refuses it. */
export function coveringSets(names, takenBranches) {
  const covered = new Set();
  const sets = [];
  const tryAdd = (set) => {
    const taken = takenBranches(set);
    if (!taken) return false;
    const fresh = taken.filter((key) => !covered.has(key));
    if (fresh.length === 0 && sets.length > 0) return false;
    for (const key of fresh) covered.add(key);
    sets.push(set);
    return true;
  };
  tryAdd([]);
  for (let index = 0; index < sets.length; index += 1) {
    const base = sets[index];
    if (base.length >= MAX_NAMES) continue;
    for (const name of names) if (!base.includes(name)) tryAdd([...base, name].sort());
  }
  return sets;
}

/** The names of the defines `general` holds. */
export const definedNames = (general) =>
  new Set([...general.matchAll(/#define (\w+)/g)].map((match) => match[1]));

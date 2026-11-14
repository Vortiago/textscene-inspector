/**
 * The define sets that take every `#if` branch of a template stage. A set is a list of names the
 * variant defines, empty, as Godot's C++ writes its modes (`"\n#define MODE_SMART\n"`). The search
 * starts from no names and adds one name at a time while that takes a branch no set has taken.
 */

/** The names Godot's `_build_variant_code` defines in every variant, so a set never defines them. */
const ALWAYS_DEFINED = new Set([
  'RENDER_DRIVER_VULKAN',
  'samplerExternalOES',
  'textureExternalOES',
  'defined',
]);

/**
 * The names Godot defines for what a material holds (`_build_variant_code`): a variant with them
 * needs the material's text in the slots, so the link step's tests take their branches.
 */
export const isMaterialName = (name) => name === 'MATERIAL_UNIFORMS_USED' || name.endsWith('_CODE_USED');

/** How many names one set may hold: the deepest nesting of `#ifdef` in Godot's templates is 4. */
const MAX_NAMES = 5;

/** The names the conditions of `lines` test, without those the stage defines itself or `skipped`. */
export function testedNames(lines, skipped) {
  const tested = new Set();
  const own = new Set();
  for (const { text } of lines) {
    const directive = /^\s*#\s*(ifdef|ifndef|if|elif|define)\b(.*)$/.exec(text);
    if (!directive) continue;
    const [, word, rest] = directive;
    const names = rest.replace(/\/\/.*$/, '').match(/[A-Za-z_]\w*/g) ?? [];
    if (word === 'define') own.add(names[0]);
    else for (const name of names) tested.add(name);
  }
  return [...tested]
    .filter(
      (name) => !own.has(name) && !skipped.has(name) && !ALWAYS_DEFINED.has(name) && !isMaterialName(name)
    )
    .sort();
}

/** The text of the variant defines of a set, as Godot's C++ writes one mode. */
export const variantText = (names) =>
  names.length === 0 ? '' : `\n${names.map((name) => `#define ${name}\n`).join('')}`;

/**
 * The sets that between them take each branch `takenBranches` reports for some set, in the order
 * found. `takenBranches(names)` gives the keys of the branches a variant with `names` takes, or
 * nothing when the preprocessor refuses that variant.
 */
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

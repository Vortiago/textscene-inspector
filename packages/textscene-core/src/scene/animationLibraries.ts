import { VARIANT_TYPE as T } from '../godot/variant/variantType.js';
import { strToVar } from '../godot/variant/strToVar.js';
import type { VariantValue } from '../godot/variant/variantValue.js';
import type { LoadedResource } from './listed/listedProperties.js';

/** One library an AnimationMixer holds: its name and the resource, or an object `anims/` builds in place. */
export interface AnimationLibraryEntry {
  readonly name: string;
  readonly library: VariantValue;
}

/** What the replay reads: the node's texts in file order, and the class of a resource by path. */
export interface LibraryTexts {
  readonly texts: readonly (readonly [property: string, value: VariantValue])[];
  resourceClass(path: string): Promise<string | null>;
}

// animation_mixer.cpp:307, under DEBUG_ENABLED, which the editor and a debug export build define.
const REFUSED_NAME_CHARACTERS = /[/:,[]/;

/** The library a 3.x `anims/` key adds to, built once and kept by name `""` (animation_mixer.cpp:59-71). */
const BUILT_LIBRARY: VariantValue = Object.freeze({ type: T.OBJECT, className: 'AnimationLibrary' });

/** The libraries `AnimationMixer::_set` leaves after the node's texts, in Godot's order (:55-90). */
export async function animationLibrariesOf({
  texts,
  resourceClass,
}: LibraryTexts): Promise<AnimationLibraryEntry[]> {
  const libraries: AnimationLibraryEntry[] = [];
  const add = async (name: string, library: VariantValue) => {
    if (await isAddable(libraries, name, library, resourceClass)) insertSorted(libraries, { name, library });
  };
  for (const [property, value] of texts) {
    if (property === 'libraries') {
      libraries.length = 0;
      for (const [key, library] of value.type === T.DICTIONARY ? value.entries : [])
        await add(nameOf(key), library);
    } else if (property.startsWith('libraries/')) {
      const name = property.split('/')[1]!;
      libraries.splice(0, libraries.length, ...libraries.filter((entry) => entry.name !== name));
      await add(name, value);
    } else if (property.startsWith('anims/') && !libraries.some((entry) => entry.name === '')) {
      insertSorted(libraries, { name: '', library: BUILT_LIBRARY });
    }
  }
  return libraries;
}

function nameOf(key: VariantValue): string {
  return key.type === T.STRING || key.type === T.STRING_NAME ? key.value : '';
}

/** `add_animation_library` refuses a null library, a separator in the name, or one it holds (:305-314). */
async function isAddable(
  libraries: readonly AnimationLibraryEntry[],
  name: string,
  library: VariantValue,
  resourceClass: LibraryTexts['resourceClass']
): Promise<boolean> {
  if (library.type !== T.OBJECT || REFUSED_NAME_CHARACTERS.test(name)) return false;
  // `Ref<AnimationLibrary>` of another class is null.
  const className =
    library.className ?? (library.resource ? await resourceClass(library.resource.path) : null);
  if (className !== 'AnimationLibrary') return false;
  // The insert loop of animation_mixer.cpp:310-321 checks each entry up to its insert position only.
  for (const entry of libraries) {
    if (entry.name === name || isSameResource(entry.library, library)) return false;
    if (entry.name >= name) break;
  }
  return true;
}

function isSameResource(a: VariantValue, b: VariantValue): boolean {
  if (a.type !== T.OBJECT || b.type !== T.OBJECT) return false;
  return a === b || (!!a.resource && a.resource.path === b.resource?.path);
}

/** The insert stops before the first name at or above it, by String order (:310-321). */
function insertSorted(libraries: AnimationLibraryEntry[], entry: AnimationLibraryEntry): void {
  const at = libraries.findIndex((held) => held.name >= entry.name);
  libraries.splice(at === -1 ? libraries.length : at, 0, entry);
}

/** The names `animation_set` keys: `anim` in the library named `""`, else `library/anim` (:192-215). */
export async function animationNamesOf(
  libraries: readonly AnimationLibraryEntry[],
  texts: LibraryTexts['texts'],
  resource: (path: string) => Promise<LoadedResource | null>
): Promise<string[]> {
  const names: string[] = [];
  for (const { name, library } of libraries) {
    const prefix = name === '' ? '' : `${name}/`;
    for (const animation of await libraryAnimations(library, texts, resource)) names.push(prefix + animation);
  }
  return names;
}

/** The keys of a library's `_data`. The library a 3.x file builds holds each `anims/<name>` text. */
async function libraryAnimations(
  library: VariantValue,
  texts: LibraryTexts['texts'],
  resource: (path: string) => Promise<LoadedResource | null>
): Promise<string[]> {
  if (library === BUILT_LIBRARY) {
    return texts.flatMap(([property]) =>
      property.startsWith('anims/') ? [property.slice('anims/'.length)] : []
    );
  }
  const path = library.type === T.OBJECT ? library.resource?.path : undefined;
  const data = path ? (await resource(path))?.properties._data : undefined;
  const dictionary = data === undefined ? null : strToVar(data);
  return dictionary?.type === T.DICTIONARY ? dictionary.entries.map(([key]) => nameOf(key)) : [];
}

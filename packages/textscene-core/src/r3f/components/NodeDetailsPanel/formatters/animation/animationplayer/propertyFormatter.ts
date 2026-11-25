import {
  ANIMATION_CALLBACK_MODE_METHOD_HINT_NAMES,
  ANIMATION_CALLBACK_MODE_PROCESS_HINT_NAMES,
} from '../../../../../../godot/scene/animation';
import type { CallResult } from '../../../../../../scene/nodeMethods';
import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { resourceText } from '../../valueText';
import { arrayElementsOf, variantValueOf } from '../../callResult';
import { VARIANT_TYPE as T } from '../../../../../../godot/variant/variantType';

/** The names of `get_animation_library_list`'s `Array[StringName]`, in its order. */
function libraryNames(list: CallResult): string[] {
  return arrayElementsOf(list).flatMap((name) => (name.type === T.STRING_NAME ? [name.value] : []));
}

/** The file of an `AnimationLibrary`, null for one built in the scene's file. */
function resourcePathOf(library: CallResult): string | null {
  const value = variantValueOf(library);
  return value?.type === T.OBJECT ? (value.resource?.path ?? null) : null;
}

export async function formatAnimationPlayerProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read([
    'speed_scale',
    'active',
    'autoplay',
    'current_animation',
    'playback_default_blend_time',
    'callback_mode_process',
    'callback_mode_method',
  ]);
  const autoplay = values.string('autoplay');
  const current = values.string('current_animation');
  return [
    {
      title: 'Playback',
      items: [
        { label: 'Speed Scale', value: values.number('speed_scale').toFixed(3) },
        { label: 'Active', value: String(values.boolean('active')) },
        { label: 'Autoplay', value: autoplay.length > 0 ? autoplay : '(none)' },
        { label: 'Current Animation', value: current.length > 0 ? current : '(none)' },
        { label: 'Blend Time (s)', value: values.number('playback_default_blend_time').toFixed(3) },
        {
          label: 'Process Mode',
          value:
            ANIMATION_CALLBACK_MODE_PROCESS_HINT_NAMES[values.number('callback_mode_process')] ?? 'Unknown',
        },
        {
          label: 'Method Call Mode',
          value:
            ANIMATION_CALLBACK_MODE_METHOD_HINT_NAMES[values.number('callback_mode_method')] ?? 'Unknown',
        },
      ],
    },
    await librariesSection(node),
  ];
}

async function librariesSection(node: InspectedNode): Promise<PropertySection> {
  const names = libraryNames(await node.call('get_animation_library_list'));
  if (names.length === 0) {
    return { title: 'Animation Libraries', items: [{ label: 'Count', value: '0 — no libraries defined' }] };
  }
  const libraries = await Promise.all(names.map((name) => node.call('get_animation_library', name)));
  return {
    title: `Animation Libraries (${names.length})`,
    items: names.map((name, index) => ({
      label: name.length > 0 ? name : '(default)',
      value: resourceText(resourcePathOf(libraries[index]!)),
    })),
  };
}

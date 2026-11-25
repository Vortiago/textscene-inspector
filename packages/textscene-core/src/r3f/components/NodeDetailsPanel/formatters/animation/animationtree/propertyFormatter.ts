import {
  ANIMATION_CALLBACK_MODE_DISCRETE_HINT_NAMES,
  ANIMATION_CALLBACK_MODE_METHOD_HINT_NAMES,
  ANIMATION_CALLBACK_MODE_PROCESS_HINT_NAMES,
} from '../../../../../../godot/scene/animation';
import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { resourceText } from '../../valueText';

const ANIMATION_TREE_PROPERTIES = [
  'active',
  'tree_root',
  'anim_player',
  'root_motion_track',
  'root_motion_local',
  'callback_mode_process',
  'callback_mode_method',
  'callback_mode_discrete',
  'audio_max_polyphony',
  'deterministic',
  'reset_on_save',
] as const;

export async function formatAnimationTreeProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(ANIMATION_TREE_PROPERTIES);
  const processName =
    ANIMATION_CALLBACK_MODE_PROCESS_HINT_NAMES[values.number('callback_mode_process')] ?? 'Unknown';
  const sections: PropertySection[] = [
    {
      title: 'AnimationTree',
      items: [
        { label: 'Active', value: String(values.boolean('active')) },
        { label: 'Tree Root', value: resourceText(values.resource('tree_root')) },
        { label: 'AnimationPlayer', value: values.string('anim_player') },
        { label: 'Process Callback', value: processName },
      ],
    },
  ];
  const rootMotionTrack = values.string('root_motion_track');
  if (rootMotionTrack.length > 0) {
    sections.push({
      title: 'Root Motion',
      items: [
        { label: 'Track', value: rootMotionTrack },
        { label: 'Local Space', value: String(values.boolean('root_motion_local')) },
      ],
    });
  }
  sections.push({
    title: 'Advanced',
    items: [
      { label: 'Callback Mode Process', value: processName },
      {
        label: 'Callback Mode Method',
        value: ANIMATION_CALLBACK_MODE_METHOD_HINT_NAMES[values.number('callback_mode_method')] ?? 'Unknown',
      },
      {
        label: 'Callback Mode Discrete',
        value:
          ANIMATION_CALLBACK_MODE_DISCRETE_HINT_NAMES[values.number('callback_mode_discrete')] ?? 'Unknown',
      },
      { label: 'Audio Max Polyphony', value: values.number('audio_max_polyphony').toString() },
      { label: 'Deterministic', value: String(values.boolean('deterministic')) },
      { label: 'Reset On Save', value: String(values.boolean('reset_on_save')) },
    ],
  });
  return sections;
}

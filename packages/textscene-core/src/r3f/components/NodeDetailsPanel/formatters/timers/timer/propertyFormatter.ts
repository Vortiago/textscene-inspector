import type { InspectedNode, PropertySection } from '../../inspectedNode';

function processCallbackName(value: number): string {
  return value === 0 ? 'Physics' : 'Idle';
}

export async function formatTimerProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read([
    'wait_time',
    'autostart',
    'one_shot',
    'paused',
    'process_callback',
    'ignore_time_scale',
  ]);
  return [
    {
      title: 'Timer',
      items: [
        { label: 'Wait Time (s)', value: values.number('wait_time').toFixed(2) },
        { label: 'Autostart', value: String(values.boolean('autostart')) },
        { label: 'One Shot', value: String(values.boolean('one_shot')) },
        { label: 'Paused', value: String(values.boolean('paused')) },
        { label: 'Process Callback', value: processCallbackName(values.number('process_callback')) },
        { label: 'Ignore Time Scale', value: String(values.boolean('ignore_time_scale')) },
      ],
    },
  ];
}

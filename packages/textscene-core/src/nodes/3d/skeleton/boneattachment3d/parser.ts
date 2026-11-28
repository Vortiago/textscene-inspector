import type { OverrideLayer } from '../../../../core/NodeRegistry';
import type { ParsedHeading } from '../../../../parser/utils';
import { boolOr, intOr } from '../../../../parser/valueParsers';
import { propertyWrites } from '../../../../parser/overridePropertyWrites';
import { literalText } from '../../../../godot/string/string';
import { parseNode3D } from '../../../base/node3d/parser';
import type { AttachmentSettings, AttachmentWrite, BoneAttachment3DProperties } from './types';

function bindingWrite(key: string, value: string): AttachmentWrite | undefined {
  switch (key) {
    case 'transform':
      return { key: 'transform' };
    case 'bone_name':
      return { key: 'boneName', value: literalText(value) };
    case 'bone_idx':
      return { key: 'boneIdx', value: intOr(value, -1, 'BoneAttachment3D bone_idx') };
    case 'override_pose':
      return { key: 'overridePose', value: boolOr(value, false, 'BoneAttachment3D override_pose') };
    case 'use_external_skeleton':
      return {
        key: 'useExternalSkeleton',
        value: boolOr(value, false, 'BoneAttachment3D use_external_skeleton'),
      };
    case 'external_skeleton':
      return { key: 'externalSkeleton', value };
    default:
      return undefined;
  }
}

const defaults: AttachmentSettings = {
  boneName: '',
  boneIdx: -1,
  overridePose: false,
  useExternalSkeleton: false,
};

export function parseBoneAttachment3D(
  heading: ParsedHeading,
  properties: Record<string, string>,
  override?: OverrideLayer<BoneAttachment3DProperties>
): BoneAttachment3DProperties {
  const settings: BoneAttachment3DProperties = {
    ...(override?.held ?? defaults),
    ...parseNode3D(heading, properties),
  };
  const writes: AttachmentWrite[] = [];
  for (const [key, value] of propertyWrites(override?.written ?? properties)) {
    const write = bindingWrite(key, value);
    if (!write) continue;
    if (write.key !== 'transform') Object.assign(settings, { [write.key]: write.value });
    writes.push(write);
  }
  if (override && writes.length) {
    settings.bindingOverrides = {
      base: override.held.bindingOverrides?.base ?? override.held,
      layers: [
        ...(override.held.bindingOverrides?.layers ?? []),
        {
          writes,
          beforeParenting: override.beforeParenting === true,
          writerScene: override.writerScene,
          line: override.line ?? Infinity,
        },
      ],
    };
  }
  return settings;
}

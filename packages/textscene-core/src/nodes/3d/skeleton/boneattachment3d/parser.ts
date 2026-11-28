import type { OverrideLayer } from '../../../../core/NodeRegistry';
import type { ParsedHeading } from '../../../../parser/utils';
import { boolOr, intOr } from '../../../../parser/valueParsers';
import { propertyWrites } from '../../../../parser/overridePropertyWrites';
import { literalText } from '../../../../godot/string/string';
import { parseNode3D } from '../../../base/node3d/parser';
import type { AttachmentSettings, AttachmentWrite, BoneAttachment3DProperties } from './types';

function storedAttachment(properties: Record<string, string>): AttachmentSettings {
  return {
    boneName: literalText(properties.bone_name ?? ''),
    boneIdx: indexValue(properties.bone_idx),
    overridePose: poseValue(properties.override_pose),
    useExternalSkeleton: externalValue(properties.use_external_skeleton),
    externalSkeleton: properties.external_skeleton,
  };
}

function indexValue(value: string | undefined): number {
  return intOr(value, -1, 'BoneAttachment3D bone_idx');
}

function poseValue(value: string | undefined): boolean {
  return boolOr(value, false, 'BoneAttachment3D override_pose');
}

function externalValue(value: string | undefined): boolean {
  return boolOr(value, false, 'BoneAttachment3D use_external_skeleton');
}

function bindingWrite(key: string, value: string): AttachmentWrite | undefined {
  switch (key) {
    case 'transform':
      return { key: 'transform' };
    case 'bone_name':
      return { key: 'boneName', value: literalText(value) };
    case 'bone_idx':
      return { key: 'boneIdx', value: indexValue(value) };
    case 'override_pose':
      return { key: 'overridePose', value: poseValue(value) };
    case 'use_external_skeleton':
      return { key: 'useExternalSkeleton', value: externalValue(value) };
    case 'external_skeleton':
      return { key: 'externalSkeleton', value };
    default:
      return undefined;
  }
}

export function parseBoneAttachment3D(
  heading: ParsedHeading,
  properties: Record<string, string>,
  override?: OverrideLayer<BoneAttachment3DProperties>
): BoneAttachment3DProperties {
  const node = parseNode3D(heading, properties);
  if (!override) return { ...node, ...storedAttachment(properties) };
  const settings: BoneAttachment3DProperties = {
    ...override.held,
    ...node,
  };
  const writes: AttachmentWrite[] = [];
  for (const [key, value] of propertyWrites(override.written)) {
    const write = bindingWrite(key, value);
    if (!write) continue;
    if (write.key !== 'transform') Object.assign(settings, { [write.key]: write.value });
    writes.push(write);
  }
  if (writes.length) {
    settings.bindingOverrides = {
      base: override.held.bindingOverrides?.base ?? override.held,
      layers: [
        ...(override.held.bindingOverrides?.layers ?? []),
        {
          writes,
          beforeParenting: override.beforeParenting === true,
          file: override.file,
          line: override.line ?? Infinity,
        },
      ],
    };
  }
  return settings;
}

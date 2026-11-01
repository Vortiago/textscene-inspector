/**
 * The BoneAttachment3D parse: the Node3D base parse plus the five own properties, each read the
 * way the loader stores it (`bone_attachment_3d.cpp:375-380`). The seat pass in
 * `boneAttachmentSeats.ts` reads the same fields.
 */

import { describe, expect, it, vi } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { parseBoneAttachment3D } from './parser';
import * as logger from '../../../../logger';

describe('parseBoneAttachment3D', () => {
  it('parses the base transform and name (happy path)', () => {
    const result = parseBoneAttachment3D(heading('BoneAttachment3D', { name: 'Grip', parent: '.' }), {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)',
    });
    expect(result.name).toBe('Grip');
    expect(result.parent).toBe('.');
    expect(result.transform?.origin).toEqual({ x: 2, y: 3, z: 4 });
  });

  it('reads the five own properties (happy path)', () => {
    const result = parseBoneAttachment3D(heading('BoneAttachment3D'), {
      bone_name: '"Head"',
      bone_idx: '1',
      override_pose: 'true',
      use_external_skeleton: 'false',
      external_skeleton: 'NodePath("../Skeleton3D")',
    });
    expect(result.boneName).toBe('Head');
    expect(result.boneIdx).toBe(1);
    expect(result.overridePose).toBe(true);
    expect(result.useExternalSkeleton).toBe(false);
    expect(result.externalSkeleton).toBe('NodePath("../Skeleton3D")');
  });

  it('reads the bare and StringName spellings of bone_name', () => {
    const quoted = parseBoneAttachment3D(heading('BoneAttachment3D'), { bone_name: '"Arm"' });
    const stringName = parseBoneAttachment3D(heading('BoneAttachment3D'), { bone_name: '&"Arm"' });

    expect(quoted.boneName).toBe('Arm');
    expect(stringName.boneName).toBe('Arm');
  });

  it('warns and keeps the defaults for a malformed value (error path)', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const bad = parseBoneAttachment3D(heading('BoneAttachment3D'), {
      bone_idx: 'not-an-int',
      override_pose: 'maybe',
    });

    expect(bad.boneIdx).toBe(-1);
    expect(bad.overridePose).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('keeps the written defaults when the file names no own property (edge case)', () => {
    const result = parseBoneAttachment3D(heading('BoneAttachment3D'), {});
    expect(result.boneName).toBe('');
    expect(result.boneIdx).toBe(-1);
    expect(result.overridePose).toBe(false);
    expect(result.useExternalSkeleton).toBe(false);
    expect(result.externalSkeleton).toBeUndefined();
  });

  it('keeps an empty external_skeleton literal, which the seat reads as unset', () => {
    const result = parseBoneAttachment3D(heading('BoneAttachment3D'), {
      external_skeleton: 'NodePath("")',
    });
    expect(result.externalSkeleton).toBe('NodePath("")');
  });
});

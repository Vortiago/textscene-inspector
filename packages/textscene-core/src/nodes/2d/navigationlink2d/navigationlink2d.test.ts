/**
 * NavigationLink2D registration — it is parsed, and it draws nothing on purpose
 * (ADR-0008) rather than for want of an implementation.
 */

import { describe, expect, it, vi } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { TscnParser } from '../../../parser/TscnParser';
import * as logger from '../../../logger';
import { parseNode2D } from '../../base/node2d/parser';
import { Node2D } from '../../base/node2d/Component';
import './index';
import './index.r3f';

describe('NavigationLink2D registration', () => {
  it('registers the parseNode2D parse it reuses', () => {
    const registration = nodeRegistry.getRegistration('NavigationLink2D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode2D);
  });

  it('reuses the Node2D component so children keep their transform space', () => {
    expect(nodeComponentRegistry.get('NavigationLink2D')).toBe(Node2D);
  });

  it('declares drawing nothing, so the sheet may claim linter-only', () => {
    expect(nodeComponentRegistry.isTransformOnly('NavigationLink2D')).toBe(true);
  });

  it('lands in the lenient parser tree with its type preserved and no fallback warning', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const scene = new TscnParser().parse(
      '[gd_scene format=3]\n\n[node name="Root" type="Node2D"]\n\n' +
        '[node name="MyNavigationLink2D" type="NavigationLink2D" parent="."]\n'
    );

    const node = scene.nodes[0]?.children[0];
    expect(node?.type).toBe('NavigationLink2D');
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Unsupported node type'));

    warnSpy.mockRestore();
  });
});

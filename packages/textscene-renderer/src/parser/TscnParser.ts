/**
 * Parses Godot TSCN text files into a structured format.
 */

import type { TscnScene, TscnNode, TscnExternalResource, TscnInternalResource } from './types';
import { parseHeading, parseProperty, isHeading, isComment, isEmpty } from './utils';
import { parseNodeWithRegistry } from '../core/NodeRegistry';
import { parseExternalResource, parseInternalResource } from './resourceParsers';
import { buildSceneTree } from './sceneTreeBuilder';
import { ResourceRegistry } from '../resources/ResourceRegistry';
import * as logger from '../logger';
import '../nodes/node';
import '../nodes/node3d';
import '../nodes/meshinstance3d';
import '../nodes/spotlight3d';
import '../nodes/directionallight3d';
import '../nodes/omnilight3d';

type SectionType = 'none' | 'node' | 'ext_resource' | 'sub_resource';

export class TscnParser {
  parse(content: string): TscnScene {
    logger.info('Starting TSCN parsing');
    const lines = content.split('\n');

    const nodes: TscnNode[] = [];
    const externalResources: TscnExternalResource[] = [];
    const internalResources: TscnInternalResource[] = [];

    let currentSection: SectionType = 'none';
    let currentHeading: ReturnType<typeof parseHeading> = null;
    let currentProperties: Record<string, string> = {};

    const finalizeSection = () => {
      if (!currentHeading) return;

      if (currentSection === 'node') {
        const node = this.parseNodeSection(currentHeading, currentProperties);
        if (node) {
          nodes.push(node);
        }
      } else if (currentSection === 'ext_resource') {
        const resource = parseExternalResource(currentHeading);
        if (resource) {
          externalResources.push(resource);
        }
      } else if (currentSection === 'sub_resource') {
        const resource = parseInternalResource(currentHeading, currentProperties);
        if (resource) {
          internalResources.push(resource);
        }
      }

      currentHeading = null;
      currentProperties = {};
    };

    for (const line of lines) {
      if (isEmpty(line) || isComment(line)) {
        continue;
      }

      if (isHeading(line)) {
        finalizeSection();

        currentHeading = parseHeading(line);
        if (currentHeading) {
          currentSection = this.identifySection(currentHeading);
        }
      } else {
        const property = parseProperty(line);
        if (property && currentHeading) {
          currentProperties[property.key] = property.value;
        }
      }
    }

    finalizeSection();

    const sceneTree = buildSceneTree(nodes);

    // Create and populate resource registry
    const resourceRegistry = new ResourceRegistry();
    for (const resource of externalResources) {
      resourceRegistry.register(resource);
    }

    logger.info(`Parsing complete: ${nodes.length} nodes, ${externalResources.length} external resources, ${internalResources.length} internal resources`);

    return {
      nodes: sceneTree,
      externalResources,
      internalResources,
      resourceRegistry,
    };
  }

  private identifySection(heading: ReturnType<typeof parseHeading>): SectionType {
    if (!heading) return 'none';

    if (heading.type === 'node') return 'node';
    if (heading.type === 'ext_resource') return 'ext_resource';
    if (heading.type === 'sub_resource') return 'sub_resource';

    return 'none';
  }

  private parseNodeSection(heading: ReturnType<typeof parseHeading>, properties: Record<string, string>): TscnNode | null {
    if (!heading) return null;
    return parseNodeWithRegistry(heading, properties);
  }

}

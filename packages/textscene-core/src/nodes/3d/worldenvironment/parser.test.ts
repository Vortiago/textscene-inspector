/**
 * WorldEnvironment parser tests
 */

import { describe, it, expect } from 'vitest';
import { parseWorldEnvironment } from './parser';
import { heading } from '../../../parser/testing/parserKit';

describe('WorldEnvironment Parser', () => {
  describe('parseWorldEnvironment', () => {
    it('should parse basic WorldEnvironment with environment reference', () => {
      const props = parseWorldEnvironment(heading('WorldEnvironment'), {
        environment: 'SubResource("Environment_1")',
      });

      expect(props.name).toBe('WorldEnvironment');
      expect(props.environment).toBe('SubResource("Environment_1")');
      expect(props.camera_attributes).toBeUndefined();
    });

    it('should parse WorldEnvironment with camera_attributes', () => {
      const props = parseWorldEnvironment(heading('WorldEnvironment'), {
        environment: 'SubResource("Environment_1")',
        camera_attributes: 'SubResource("CameraAttributes_1")',
      });

      expect(props.environment).toBe('SubResource("Environment_1")');
      expect(props.camera_attributes).toBe('SubResource("CameraAttributes_1")');
    });

    it('should handle missing environment reference with empty string', () => {
      const props = parseWorldEnvironment(heading('WorldEnvironment'), {});

      expect(props.environment).toBe('');
      expect(props.camera_attributes).toBeUndefined();
    });

    it('should extract environment reference correctly', () => {
      const props = parseWorldEnvironment(heading('WorldEnvironment'), {
        environment: 'SubResource("Environment_12345")',
      });

      expect(props.environment).toBe('SubResource("Environment_12345")');
    });

    it('keeps the heading attributes and the transform the Node base parser reads', () => {
      const props = parseWorldEnvironment(
        heading('WorldEnvironment', { name: 'MyEnvironment', parent: 'Root' }),
        {
          environment: 'SubResource("Environment_1")',
          transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
        }
      );

      expect(props.name).toBe('MyEnvironment');
      expect(props.parent).toBe('Root');
      expect(props.transform).toBeDefined();
      expect(props.environment).toBe('SubResource("Environment_1")');
    });

    it('reads no Node3D field: a WorldEnvironment is a Node (node_3d.cpp:150)', () => {
      const props = parseWorldEnvironment(heading('WorldEnvironment'), {
        visible: 'false',
        position: 'Vector3(1, 2, 3)',
      });
      expect('visible' in props).toBe(false);
      expect('position' in props).toBe(false);
    });
  });
});

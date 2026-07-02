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

    it('should inherit Node3D properties', () => {
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
  });
});

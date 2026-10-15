import { describe, expect, it } from 'vitest';
import { NODE_CLASS_PROPERTIES, RESOURCE_CLASS_PROPERTIES } from './classProperties.generated.js';
import { UNCATALOGUED_BASE_TYPES } from './nodeBaseTypes.js';
import { UNCATALOGUED_PROPERTIES } from './uncataloguedProperties.js';

const handClasses = Object.keys(UNCATALOGUED_PROPERTIES);

describe('UNCATALOGUED_PROPERTIES', () => {
  it.each(handClasses)('holds %s, a class whose base UNCATALOGUED supplies', (className) => {
    expect(Object.hasOwn(UNCATALOGUED_BASE_TYPES, className)).toBe(true);
  });

  it.each(handClasses)(
    'holds %s only while the captures lack it, since a capture row shadows a hand row',
    (className) => {
      expect(Object.hasOwn(NODE_CLASS_PROPERTIES, className)).toBe(false);
      expect(Object.hasOwn(RESOURCE_CLASS_PROPERTIES, className)).toBe(false);
    }
  );
});

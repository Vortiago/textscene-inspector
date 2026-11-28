import { memoisedImport } from '../resources/memoisedImport.js';
import type { SceneProperties } from './sceneProperties.js';

/** The class tables, stored values and write replay load together on the first property access. */
export type PropertyAccess = typeof import('./propertyAccess.js');

export const loadPropertyAccess = memoisedImport(() => import('./propertyAccess.js'));

/** The properties of one scene. A view can read its current writes before a host asks for a property. */
export interface ScenePropertyState {
  current: SceneProperties | null;
  forAccess(access: PropertyAccess): SceneProperties;
}

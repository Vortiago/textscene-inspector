import { resourceFilePath } from '../resources/subResourcePath.js';
import { CountedReports } from '../utils/countedReports.js';
import { perObject } from '../utils/perObject.js';
import type { Scene } from './openScene.js';

/** The **Missing resources** the views of `scene` report: each address they asked for and did not get. */
export const missingResourcesOf = perObject((_scene: Scene) => new CountedReports());

/** The files of reported addresses: a sub-resource's address names its file. One set per reported set. */
export const filesOf = perObject(
  (addresses: ReadonlySet<string>): ReadonlySet<string> => new Set([...addresses].map(resourceFilePath))
);

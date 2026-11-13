/** The `IMAGE` kind passes the table test every kind passes (ADR-0071). */
import { describeKindFromEveryOrigin } from '../../reading/everyOrigin.testkit';
import { IMAGE } from './kind';

const DICTIONARY = `{
"data": PackedByteArray(255, 0, 0, 255),
"format": "RGBA8",
"height": 1,
"mipmaps": false,
"width": 1
}`;

describeKindFromEveryOrigin([
  { kind: IMAGE, className: 'Image', body: `data = ${DICTIONARY}`, expected: { dictionary: DICTIONARY } },
]);

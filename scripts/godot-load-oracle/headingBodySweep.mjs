import { fileWithField, HEADING_KINDS, writeCases } from './headingSweepScene.mjs';

/** A body line after each kind of heading, after its `]` or on the next line. The `;` hides the old `]`. */
const PLACES = { same_line: '] x = 1 ;', next_line: ']\nx = 1 ;' };

const cases = HEADING_KINDS.flatMap((kind) =>
  Object.entries(PLACES).map(([place, field]) => ({
    name: `${kind}__${place}`,
    ...fileWithField(kind, field),
  }))
);
console.log(writeCases(process.argv[2], cases));

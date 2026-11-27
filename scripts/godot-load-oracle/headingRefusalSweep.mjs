import { fileWithField, HEADING_KINDS, writeCases } from './headingSweepScene.mjs';

/** A refusal at each token kind, on the heading's own line and on a later line of the heading. */
const REFUSALS = {
  array_own: '[1 2]',
  array_later: '[1,\n2 3]',
  dictionary_own: '{"k" 2}',
  dictionary_later: '{"k": 1,\n"j" 2}',
  string_own: '"a\\uZZZZ"',
  string_later: '"a\nb\\uZZZZ"',
  constructor_own: 'Vector2(1 2)',
  constructor_later: 'Vector2(1,\n2 3)',
  after_equals_own: ')',
  after_equals_later: '\n)',
  after_comma_own: '[1, )]',
  after_comma_later: '[1,\n)]',
};

const cases = HEADING_KINDS.flatMap((kind) =>
  Object.entries(REFUSALS).map(([refusal, text]) => ({
    name: `${kind}__${refusal}`,
    ...fileWithField(kind, `x=${text}`),
  }))
);
console.log(writeCases(process.argv[2], cases));

import { describe, expect, it } from 'vitest';
import { strictConversions } from './readConversions.mjs';

const source = (
  cases
) => `bool Variant::can_convert_strict(Variant::Type p_type_from, Variant::Type p_type_to) {
	const Type *valid_types = nullptr;

	switch (p_type_to) {
${cases}
		default: {
		}
	}

	return false;
}
`;

describe('strictConversions', () => {
  it('reads the types each target takes, up to the NIL that ends the list', () => {
    const table = strictConversions(
      source(`		case BOOL: {
			static const Type valid[] = {
				INT,
				//STRING,
				NIL,
				FLOAT,
			};

			valid_types = valid;
		} break;`)
    );
    expect(table).toEqual({ BOOL: ['INT'] });
  });

  it('refuses a case with no list, so no target drops in silence', () => {
    expect(() => strictConversions(source('\t\tcase BOOL: {\n\t\t\treturn true;\n\t\t} break;'))).toThrow(
      /BOOL/
    );
  });
});

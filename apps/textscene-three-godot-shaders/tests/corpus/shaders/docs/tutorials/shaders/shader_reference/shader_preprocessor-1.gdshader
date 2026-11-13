shader_type spatial;

// Notice the lack of semicolon at the end of the line, as the replacement text
// shouldn't insert a semicolon on its own.
// If the directive ends with a semicolon, the semicolon is inserted in every usage
// of the directive, even when this causes a syntax error.
#define USE_MY_COLOR
#define MY_COLOR vec3(1, 0, 0)

// Replacement with arguments.
// All arguments are required (no default values can be provided).
#define BRIGHTEN_COLOR(r, g, b) vec3(r + 0.5, g + 0.5, b + 0.5)

// Multiline replacement using backslashes for continuation:
#define SAMPLE(param1, param2, param3, param4) long_function_call( \
        param1, \
        param2, \
        param3, \
        param4 \
)

void fragment() {
#ifdef USE_MY_COLOR
    ALBEDO = MY_COLOR;
#endif
}

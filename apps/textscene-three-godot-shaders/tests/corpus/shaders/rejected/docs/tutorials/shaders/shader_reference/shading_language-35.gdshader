shader_type spatial;

varying float test;

void foo() {
	not_defined();
    test = 0.0; // Error.
}

void vertex() {
    test = 0.0;
}

void light() {
    test = 0.0; // Error too.
}

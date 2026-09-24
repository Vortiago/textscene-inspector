# Removals

A removal is a key a type takes away from its base chain. A validator cannot
express it, because the base-walk only widens what a type accepts.

`HBoxContainer`'s `set_vertical` is `ERR_FAIL_COND_MSG(is_fixed, …)`. That setter
guard is what makes `vertical` a removal. A removal keeps the key out of
`getOwnKeys`, out of "Accepts" on the generated sheet, and out of the shadow
allowlist.

`_validate_property` alone does not make a removal. It hides a key while the
setter still accepts it, so the value is inert and the key stays inherited.
`SpinBox.exp_edit` (spin_box.cpp:648, against `Range::set_exp_ratio` at
range.cpp:433) and `FileDialog.dialog_text` are not removals.

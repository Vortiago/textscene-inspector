extends SceneTree

# Each input line is a case name, a tab and a text; each output line is the name and what str_to_var reads.
func _init() -> void:
	var text := FileAccess.get_file_as_string(OS.get_cmdline_user_args()[0])
	for line in text.split("\n", false):
		var parts := line.split("\t", true, 1)
		print("READ:", parts[0], "\t", _described(str_to_var(parts[1])))
	quit()

# A string as its code points in hex, so no output encoding blurs one; any other value as its type.
func _described(value: Variant) -> String:
	if not value is String:
		return type_string(typeof(value))
	var codes := PackedStringArray()
	for i in value.length():
		codes.append("%X" % value.unicode_at(i))
	return "String " + " ".join(codes)

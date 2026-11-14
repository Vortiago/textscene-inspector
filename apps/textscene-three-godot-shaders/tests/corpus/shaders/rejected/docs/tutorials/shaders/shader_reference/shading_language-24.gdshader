shader_type spatial;

...

struct Scene {
    PointLight lights[2];
};

const Scene scene = Scene(PointLight[2](PointLight(vec3(0.0, 0.0, 0.0), vec3(1.0, 0.0, 0.0), 1.0), PointLight(vec3(0.0, 0.0, 0.0), vec3(1.0, 0.0, 0.0), 1.0)));

void fragment()
{
    ALBEDO = scene.lights[0].color
}

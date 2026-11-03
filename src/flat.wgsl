// Values the CPU sets for a whole draw, the same for every vertex. Group 0,
// binding 0 is the bind group main.ts attaches with setBindGroup(0, ...).
struct Uniforms {
  modelToClip: mat4x4f,
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

// Each run of the vertex shader receives one vertex, fetched from the vertex
// buffer by the pipeline's layout (main.ts): @location(0) is its position.
@vertex
fn vs(@location(0) position: vec3f) -> @builtin(position) vec4f {
  return uniforms.modelToClip * vec4f(position, 1.0);
}

// Shaded by depth until step 5's lighting: in the fragment stage, position.z
// is this fragment's depth, 0 at the near end of the model and 1 at the far end.
@fragment
fn fs(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let shade = 1.0 - position.z;
  return vec4f(vec3f(0.95, 0.55, 0.2) * shade, 1.0);
}

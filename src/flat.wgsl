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

@fragment
fn fs() -> @location(0) vec4f {
  return vec4f(0.95, 0.55, 0.2, 1.0);
}

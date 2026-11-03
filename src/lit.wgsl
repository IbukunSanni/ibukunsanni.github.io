// Values the CPU sets for a whole draw, the same for every vertex. Group 0,
// binding 0 is the bind group main.ts attaches with setBindGroup(0, ...).
struct Uniforms {
  modelToClip: mat4x4f,
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

// What the vertex shader hands on. The GPU interpolates each @location value
// across the triangle, so every fragment gets a normal blended from its
// three corners'.
struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
}

// Each run of the vertex shader receives one vertex, fetched from the vertex
// buffers by the pipeline's layout (main.ts): @location(0) is its position,
// @location(1) its normal.
@vertex
fn vs(@location(0) position: vec3f, @location(1) normal: vec3f) -> VertexOut {
  var out: VertexOut;
  out.position = uniforms.modelToClip * vec4f(position, 1.0);
  // Lit in model space, which is also the world: orbiting moves the camera
  // around the dragon, not the light, so the normal is passed on as it is.
  out.normal = normal;
  return out;
}

// The direction towards the light, in model space (x right, y up, z towards
// the camera's starting place): above, to the left and in front.
const toLight = normalize(vec3f(-0.5, 0.6, 0.6));

// Light reaching every surface whatever way it faces, a stand-in for light
// bounced off everything else. Without it, the 13% of the dragon facing away
// from the light is pure black and merges into the background.
const ambient = 0.15;

// Lambert's cosine law: a surface facing the light gets all of it, one edge-on
// or facing away gets none, and in between the cosine of the angle, which for
// two unit vectors is their dot product.
@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
  let n = normalize(in.normal); // blending shortens it
  let lambert = max(dot(n, toLight), 0.0);
  let light = ambient + (1.0 - ambient) * lambert;
  return vec4f(vec3f(0.95, 0.55, 0.2) * light, 1.0);
}

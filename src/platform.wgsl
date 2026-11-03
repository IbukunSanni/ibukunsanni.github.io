// The platform the dragon stands on. Piece 2b, step 1: a plain disc, one
// colour. Its own space is the disc of radius 1 in the y = 0 plane; main.ts
// places it under the dragon with the matrix.
struct Uniforms {
  platformToClip: mat4x4f,
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) xz: vec2f, // where on the platform, interpolated for each pixel
}

// No vertex buffer: the draw asks for 6 vertices, and each run of the shader
// makes its corner of the square's two triangles from its index, 0 to 5.
@vertex
fn vs(@builtin(vertex_index) i: u32) -> VertexOut {
  let corners = array(
    vec2f(-1, -1), vec2f(1, -1), vec2f(1, 1),
    vec2f(-1, -1), vec2f(1, 1), vec2f(-1, 1),
  );
  var out: VertexOut;
  out.xz = corners[i];
  out.position = uniforms.platformToClip * vec4f(out.xz.x, 0.0, out.xz.y, 1.0);
  return out;
}

// The square's corners are cut away pixel by pixel, which leaves a disc whose
// edge stays round however close the camera comes. A discarded pixel writes
// neither colour nor depth.
@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
  if (length(in.xz) > 1.0) {
    discard;
  }
  return vec4f(0.15, 0.25, 0.5, 1.0);
}

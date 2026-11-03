// Each run of the vertex shader receives one corner, fetched from the vertex
// buffer by the pipeline's layout (main.ts): @location(0) is its position.
@vertex
fn vs(@location(0) position: vec2f) -> @builtin(position) vec4f {
  return vec4f(position, 0.0, 1.0);
}

@fragment
fn fs() -> @location(0) vec4f {
  return vec4f(0.95, 0.55, 0.2, 1.0);
}

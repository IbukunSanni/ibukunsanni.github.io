// The platform the dragon stands on. Piece 2b, step 2: a disc of glass panes,
// each one flat colour. Its own space is the disc of radius 1 in the y = 0
// plane; main.ts places it under the dragon with the matrix.
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

// The panes are a Voronoi pattern: scatter points over the disc, and colour
// each pixel like the point nearest to it.
//   for each pixel at p:
//     nearest = the point closest to p
//     colour  = that point's colour
// The points: one per cell of a square grid, somewhere random inside its
// cell, so they are spread evenly but not in rows (a jittered grid).
const cellsAcross = 8.0; // across the disc's diameter
const cellSize = 2.0 / cellsAcross; // in the platform's units

// The same cell always gets the same two random-looking 32-bit numbers, so
// its point and colour never change between pixels or frames. pcg2d, from
// Jarzynski and Olano, "Hash Functions for GPU Rendering" (2020). Integer
// arithmetic wraps, and gives the same bits on every GPU.
fn hash(cell: vec2i) -> vec2u {
  var v = bitcast<vec2u>(cell) * 1664525u + 1013904223u;
  v.x += v.y * 1664525u;
  v.y += v.x * 1664525u;
  v ^= v >> vec2u(16u);
  v.x += v.y * 1664525u;
  v.y += v.x * 1664525u;
  v ^= v >> vec2u(16u);
  return v;
}

// The cell's point: somewhere random in the middle 60% of the cell each way.
// Kept off the edges so the 3×3 search below is never wrong: from anywhere in
// a cell, its own point is at most 0.8 × √2 = 1.13 cells away, and a point two
// cells over is at least 1.2 cells away.
fn point(cell: vec2i) -> vec2f {
  let random = vec2f(hash(cell) >> vec2u(8u)) / 16777216.0; // top 24 bits: 0 to just under 1
  return (vec2f(cell) + 0.2 + 0.6 * random) * cellSize;
}

// Stained glass, deep and saturated. The dragon is orange, so no orange.
fn paneColour(cell: vec2i) -> vec3f {
  let glass = array(
    vec3f(0.10, 0.25, 0.70), // blue
    vec3f(0.65, 0.08, 0.15), // ruby
    vec3f(0.05, 0.50, 0.55), // teal
    vec3f(0.40, 0.15, 0.65), // violet
    vec3f(0.10, 0.50, 0.25), // green
  );
  return glass[hash(cell).x % 5u];
}

// Only the points in the 3×3 cells around the pixel's own: 9 tested however
// many panes there are. Every point further away is beaten by the pixel's own
// cell's point (see point() for why). Testing every point gave identical
// frames and slowed with the pane count (docs/ENGINEERING.md, piece 2b).
fn nearestCell(p: vec2f) -> vec2i {
  let own = vec2i(floor(p / cellSize));
  var nearest = own;
  var nearestDistance = 1e9; // squared, like every distance compared here
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let cell = own + vec2i(x, y);
      let d = p - point(cell);
      if (dot(d, d) < nearestDistance) {
        nearestDistance = dot(d, d);
        nearest = cell;
      }
    }
  }
  return nearest;
}

// The square's corners are cut away pixel by pixel, which leaves a disc whose
// edge stays round however close the camera comes. A discarded pixel writes
// neither colour nor depth.
@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
  if (length(in.xz) > 1.0) {
    discard;
  }
  return vec4f(paneColour(nearestCell(in.xz)), 1.0);
}

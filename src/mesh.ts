// Reads the binary mesh written by tools/ply-to-mesh.mjs (the format is
// described there). The arrays are views onto the downloaded bytes: no parsing,
// no copy.

export interface Mesh {
  positions: Float32Array; // x, y, z per vertex
  indices: Uint32Array; // three vertex indices per triangle
  vertexCount: number;
  triangleCount: number;
}

const MAGIC = 0x4853454d; // the bytes 'MESH', read as a little-endian uint32
const HEADER_BYTES = 16;

export async function loadMesh(url: string): Promise<Mesh> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();

  // A wrong path can come back as an HTML page with status 200, so check what arrived.
  if (buffer.byteLength < HEADER_BYTES) throw new Error(`${url} is not a mesh file`);
  const header = new DataView(buffer, 0, HEADER_BYTES);
  if (header.getUint32(0, true) !== MAGIC) throw new Error(`${url} is not a mesh file`);
  const version = header.getUint32(4, true);
  if (version !== 1) throw new Error(`${url}: mesh version ${version}, expected 1`);
  const vertexCount = header.getUint32(8, true);
  const triangleCount = header.getUint32(12, true);
  const expected = HEADER_BYTES + vertexCount * 12 + triangleCount * 12;
  if (buffer.byteLength !== expected) {
    throw new Error(`${url}: ${buffer.byteLength} bytes, expected ${expected}`);
  }

  return {
    positions: new Float32Array(buffer, HEADER_BYTES, vertexCount * 3),
    indices: new Uint32Array(buffer, HEADER_BYTES + vertexCount * 12, triangleCount * 3),
    vertexCount,
    triangleCount,
  };
}

// One normal per vertex, the direction the surface faces there, for lighting.
//   for each triangle (a, b, c):
//     n = (b - a) × (c - a)      perpendicular to the triangle, length 2 × its area
//     add n to the sums at a, b and c
//   normalise every sum
// Adding n before normalising lets big triangles count for more than small
// ones. Triangles wound counter-clockwise seen from outside, as the Stanford
// scans are, give normals pointing outward. A vertex no triangle with any area
// touches keeps (0, 0, 0).
export function vertexNormals({ positions, indices, vertexCount }: Mesh): Float32Array {
  const normals = new Float32Array(vertexCount * 3);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    const e1x = positions[b] - positions[a];
    const e1y = positions[b + 1] - positions[a + 1];
    const e1z = positions[b + 2] - positions[a + 2];
    const e2x = positions[c] - positions[a];
    const e2y = positions[c + 1] - positions[a + 1];
    const e2z = positions[c + 2] - positions[a + 2];
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    for (const v of [a, b, c]) {
      normals[v] += nx;
      normals[v + 1] += ny;
      normals[v + 2] += nz;
    }
  }
  for (let v = 0; v < normals.length; v += 3) {
    const length = Math.sqrt(normals[v] ** 2 + normals[v + 1] ** 2 + normals[v + 2] ** 2);
    if (length > 0) {
      normals[v] /= length;
      normals[v + 1] /= length;
      normals[v + 2] /= length;
    }
  }
  return normals;
}

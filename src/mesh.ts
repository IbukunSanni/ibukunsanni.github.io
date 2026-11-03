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

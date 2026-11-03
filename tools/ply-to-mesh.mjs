// Converts an ASCII PLY triangle mesh into the site's binary mesh format, once,
// offline, so the browser never parses text.
//
//   node tools/ply-to-mesh.mjs <in.ply> <out.bin>
//
// The format, little-endian, read by src/mesh.ts:
//   bytes  0-3   magic 'MESH'
//   bytes  4-7   version, uint32 = 1
//   bytes  8-11  vertex count V, uint32
//   bytes 12-15  triangle count T, uint32
//   then V*3 float32 positions (x, y, z), then T*3 uint32 indices.
//
// It handles what the Stanford files contain (an ascii vertex element with x, y
// and z, then a face element holding one index list); anything else is an
// error, not a guess.
import { readFileSync, writeFileSync } from 'node:fs';

const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error('usage: node tools/ply-to-mesh.mjs <in.ply> <out.bin>');
  process.exit(1);
}

function fail(message) {
  console.error(`${inPath}: ${message}`);
  process.exit(1);
}

// Typed arrays write in the machine's byte order, and the format is little-endian.
if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) fail('this machine is big-endian');

const text = readFileSync(inPath, 'latin1');

// --- Header: the elements, in file order, each with its properties.
const headerEnd = text.indexOf('end_header');
if (!text.startsWith('ply') || headerEnd < 0) fail('not a PLY file');
const elements = [];
for (const line of text.slice(0, headerEnd).split(/\r?\n/)) {
  const words = line.trim().split(/\s+/);
  if (words[0] === 'format' && words[1] !== 'ascii') fail(`format ${words[1]} is not supported, only ascii`);
  if (words[0] === 'element') elements.push({ name: words[1], count: Number(words[2]), props: [] });
  if (words[0] === 'property') {
    const element = elements.at(-1);
    if (!element) fail('a property comes before any element');
    element.props.push(words[1] === 'list' ? { name: words[4], list: true } : { name: words[2], list: false });
  }
}
const [vertex, face] = elements;
if (elements.length !== 2 || vertex.name !== 'vertex' || face.name !== 'face') {
  fail(`expected exactly the elements vertex then face, found ${elements.map((e) => e.name).join(', ')}`);
}
const column = { x: -1, y: -1, z: -1 };
vertex.props.forEach((p, i) => { if (p.name in column) column[p.name] = i; });
if (column.x < 0 || column.y < 0 || column.z < 0) fail('the vertex element lacks x, y or z');
if (vertex.props.some((p) => p.list)) fail('list properties on vertices are not supported');
if (face.props.length !== 1 || !face.props[0].list) fail('the face element must hold exactly one index list');

// --- Body: one stream of whitespace-separated numbers, read in header order.
const bodyStart = text.indexOf('\n', headerEnd) + 1;
const tokens = text.slice(bodyStart).trim().split(/\s+/);
let next = 0;
function number() {
  if (next >= tokens.length) fail('the file ends early');
  const value = Number(tokens[next++]);
  if (Number.isNaN(value)) fail(`"${tokens[next - 1]}" is not a number (token ${next - 1})`);
  return value;
}

const V = vertex.count;
const positions = new Float32Array(V * 3);
for (let v = 0; v < V; v++) {
  for (let p = 0; p < vertex.props.length; p++) {
    const value = number();
    if (p === column.x) positions[3 * v] = value;
    else if (p === column.y) positions[3 * v + 1] = value;
    else if (p === column.z) positions[3 * v + 2] = value;
  }
}

// Faces with more than three corners are split into a fan of triangles.
const indexList = [];
let nonTriangles = 0;
for (let f = 0; f < face.count; f++) {
  const n = number();
  if (n < 3) fail(`face ${f} has ${n} corners`);
  if (n !== 3) nonTriangles++;
  const corners = [];
  for (let k = 0; k < n; k++) {
    const i = number();
    if (!Number.isInteger(i) || i < 0 || i >= V) fail(`face ${f} refers to vertex ${i}, outside 0..${V - 1}`);
    corners.push(i);
  }
  for (let k = 1; k + 1 < n; k++) indexList.push(corners[0], corners[k], corners[k + 1]);
}
if (next !== tokens.length) fail(`${tokens.length - next} numbers left over after the last face`);
const indices = Uint32Array.from(indexList);
const T = indices.length / 3;

// --- Write: header, then the two arrays exactly as they sit in memory.
const HEADER_BYTES = 16;
const out = new ArrayBuffer(HEADER_BYTES + positions.byteLength + indices.byteLength);
new Uint8Array(out, 0, 4).set([...'MESH'].map((c) => c.charCodeAt(0)));
const header = new DataView(out);
header.setUint32(4, 1, true);
header.setUint32(8, V, true);
header.setUint32(12, T, true);
new Float32Array(out, HEADER_BYTES, V * 3).set(positions);
new Uint32Array(out, HEADER_BYTES + positions.byteLength, T * 3).set(indices);
writeFileSync(outPath, new Uint8Array(out));

// --- Round trip: read the file back the way src/mesh.ts does, compare bit for bit.
const back = readFileSync(outPath);
const backBuffer = back.buffer.slice(back.byteOffset, back.byteOffset + back.byteLength);
const backHeader = new DataView(backBuffer);
const backV = backHeader.getUint32(8, true);
const backT = backHeader.getUint32(12, true);
const samePositions = Buffer.compare(
  Buffer.from(new Uint8Array(backBuffer, HEADER_BYTES, backV * 12)),
  Buffer.from(positions.buffer),
) === 0;
const sameIndices = Buffer.compare(
  Buffer.from(new Uint8Array(backBuffer, HEADER_BYTES + backV * 12, backT * 12)),
  Buffer.from(indices.buffer),
) === 0;
if (backV !== V || backT !== T || !samePositions || !sameIndices) fail('round trip differs');

// --- What the data is: counts, bounds, and anything odd about it.
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < positions.length; i++) {
  min[i % 3] = Math.min(min[i % 3], positions[i]);
  max[i % 3] = Math.max(max[i % 3], positions[i]);
}
let degenerate = 0;
const used = new Uint8Array(V);
for (let t = 0; t < T; t++) {
  const [a, b, c] = indices.subarray(3 * t, 3 * t + 3);
  if (a === b || b === c || a === c) degenerate++;
  used[a] = used[b] = used[c] = 1;
}
const unused = V - used.reduce((sum, u) => sum + u, 0);
const fmt = (xs) => xs.map((x) => x.toFixed(4)).join(', ');
console.log(`${inPath} -> ${outPath}`);
console.log(`  vertices ${V}, triangles ${T} (from ${face.count} faces, ${nonTriangles} not triangles)`);
console.log(`  bounds min (${fmt(min)}), max (${fmt(max)}), size (${fmt(max.map((m, i) => m - min[i]))})`);
console.log(`  degenerate triangles ${degenerate}, unreferenced vertices ${unused}`);
console.log(`  ${out.byteLength} bytes (${(out.byteLength / 1e6).toFixed(1)} MB); round trip identical`);

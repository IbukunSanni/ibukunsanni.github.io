import './style.css';
import shader from './lit.wgsl?raw';
import { loadMesh, vertexNormals } from './mesh.ts';

// Piece 2, step 5: the Stanford dragon, 871k triangles read from a binary file,
// drawn from the front through an index buffer, placed on screen by a matrix
// the GPU applies to every vertex, with a depth buffer so the nearest surface
// wins at every pixel, lit by one directional light from normals computed on
// load. See docs/ENGINEERING.md.

const canvas = document.querySelector<HTMLCanvasElement>('#viewer')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;

// Every way the viewer can fail ends here: one message, centred, instead of a
// blank page. Piece 4 replaces this with a pre-rendered image.
function fail(message: string): void {
  status.textContent = message;
  status.classList.add('error');
}

interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

function boundsOf(positions: Float32Array): Bounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    min[i % 3] = Math.min(min[i % 3], positions[i]);
    max[i % 3] = Math.max(max[i % 3], positions[i]);
  }
  return { min, max };
}

// A front view of the model (looking down -z), fitted to the canvas: step 2's
// fit, written as a matrix the GPU applies, so a resize sends 64 bytes instead
// of rewriting every vertex. Row by row:
//   x' = (x - cx) * s / aspect   clip space spans -1..1 whatever the canvas's
//   y' = (y - cy) * s            shape, so x is divided by the aspect ratio
//   z' = 0.5 - (z - cz) * sz     nearer is smaller, inside 0..1 for the depth test
//   w' = 1
// WGSL matrices are column-major: the array lists column 0, then 1, 2, 3, and
// the translation sits in the last column.
function modelToClip({ min, max }: Bounds, aspect: number): Float32Array {
  const [cx, cy, cz] = [0, 1, 2].map((i) => (min[i] + max[i]) / 2);
  const [hx, hy, hz] = [0, 1, 2].map((i) => (max[i] - min[i]) / 2);
  const s = 0.9 * Math.min(aspect / hx, 1 / hy);
  const sz = 0.45 / hz;
  return new Float32Array([
    s / aspect, 0, 0, 0,
    0, s, 0, 0,
    0, 0, -sz, 0,
    (-cx * s) / aspect, -cy * s, 0.5 + cz * sz, 1,
  ]);
}

async function main(): Promise<void> {
  if (!navigator.gpu) {
    fail('This viewer needs WebGPU, which this browser does not have. Try a recent Chrome or Edge.');
    return;
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    fail('WebGPU is available, but no GPU adapter was found.');
    return;
  }
  const device = await adapter.requestDevice();
  void device.lost.then((info) => {
    fail(`GPU device lost: ${info.message}`);
  });

  const context = canvas.getContext('webgpu');
  if (!context) {
    fail('Could not get a WebGPU context for the canvas.');
    return;
  }
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });

  status.textContent = 'Loading the dragon…';
  const mesh = await loadMesh(`${import.meta.env.BASE_URL}models/dragon.bin`);
  status.textContent = '';

  // The triangles, three vertex indices each, copied once. A vertex is shared
  // by about six triangles, so indexing stores it once instead of six times
  // and lets the GPU reuse a vertex it has just transformed. uint32, because
  // 437,645 vertices is more than 16 bits can count.
  const indexBuffer = device.createBuffer({
    size: mesh.indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, mesh.indices);

  // The positions as they are in the file, x, y and z, copied once.
  const vertexBuffer = device.createBuffer({
    size: mesh.positions.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, mesh.positions);

  // A normal per vertex, in a second buffer beside the positions, copied once.
  // Computed here rather than stored in the file: about 20 ms against a
  // download of a second or more.
  const normals = vertexNormals(mesh);
  const normalBuffer = device.createBuffer({
    size: normals.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(normalBuffer, 0, normals);

  // One 4x4 float32 matrix, 64 bytes, rewritten whenever the canvas resizes.
  const uniformBuffer = device.createBuffer({
    size: 16 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const bounds = boundsOf(mesh.positions);

  // One depth value per pixel: how near the surface drawn there so far is. A
  // fragment is kept only if it is nearer ('less') than what its pixel holds,
  // so which surface wins no longer depends on the order triangles arrive in.
  const depthFormat = 'depth24plus';

  const module = device.createShaderModule({ code: shader });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs',
      // How to read the buffers: in each, step 12 bytes per vertex and hand
      // the step's three floats to the shader, slot 0's to @location(0) (the
      // position) and slot 1's to @location(1) (the normal).
      buffers: [
        { arrayStride: 3 * 4, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
        { arrayStride: 3 * 4, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
      ],
    },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    depthStencil: { format: depthFormat, depthWriteEnabled: true, depthCompare: 'less' },
  });

  // Connects the uniform buffer to the shader's @group(0) @binding(0). With
  // layout 'auto', the pipeline worked out that slot's shape from the shader.
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  // An arrow function, not a hoisted declaration, so TypeScript knows the
  // null check on `context` above has already run.
  const draw = (depthView: GPUTextureView): void => {
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.02, g: 0.024, b: 0.04, a: 1 }, // the page background, #05060a
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: depthView,
        depthClearValue: 1.0, // the far end, so the first surface at a pixel always wins
        depthLoadOp: 'clear',
        depthStoreOp: 'discard', // needed only during the pass, never shown
      },
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setVertexBuffer(1, normalBuffer);
    pass.setIndexBuffer(indexBuffer, 'uint32');
    pass.drawIndexed(mesh.triangleCount * 3);
    pass.end();
    device.queue.submit([encoder.finish()]);
  };

  // Keep the drawing buffer at the canvas's real pixel size, so the image
  // stays sharp and undistorted, and refit and redraw whenever that size changes.
  const maxSize = device.limits.maxTextureDimension2D;
  let depthTexture: GPUTexture | null = null;
  new ResizeObserver(() => {
    const dpr = window.devicePixelRatio;
    canvas.width = Math.max(1, Math.min(Math.round(canvas.clientWidth * dpr), maxSize));
    canvas.height = Math.max(1, Math.min(Math.round(canvas.clientHeight * dpr), maxSize));
    device.queue.writeBuffer(uniformBuffer, 0, modelToClip(bounds, canvas.width / canvas.height));
    // The depth buffer must match the canvas pixel for pixel, so it is
    // replaced whenever the canvas changes size.
    depthTexture?.destroy();
    depthTexture = device.createTexture({
      size: [canvas.width, canvas.height],
      format: depthFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    draw(depthTexture.createView());
  }).observe(canvas);
}

main().catch((err: unknown) => {
  fail(`The viewer failed to start: ${err instanceof Error ? err.message : String(err)}`);
});

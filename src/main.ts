import './style.css';
import shader from './flat.wgsl?raw';
import { loadMesh } from './mesh.ts';

// Piece 2, step 2: the Stanford dragon, 871k triangles read from a binary file,
// drawn flat (a front view, no lighting yet) through an index buffer.
// See docs/ENGINEERING.md.

const canvas = document.querySelector<HTMLCanvasElement>('#viewer')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;

// Every way the viewer can fail ends here: one message, centred, instead of a
// blank page. Piece 4 replaces this with a pre-rendered image.
function fail(message: string): void {
  status.textContent = message;
  status.classList.add('error');
}

// Step 2's stopgap: the dragon's x and y (a front view, z ignored) fitted into
// clip space on the CPU, keeping its proportions on a canvas of any shape.
// Rewriting every vertex on each resize is the cost step 3's matrix removes.
function fitToClip(positions: Float32Array, aspect: number): Float32Array {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]);
    maxX = Math.max(maxX, positions[i]);
    minY = Math.min(minY, positions[i + 1]);
    maxY = Math.max(maxY, positions[i + 1]);
  }
  const centreX = (minX + maxX) / 2, halfX = (maxX - minX) / 2;
  const centreY = (minY + maxY) / 2, halfY = (maxY - minY) / 2;
  // Clip space spans -1..1 on both axes whatever the canvas's shape, so x is
  // divided by the aspect ratio to make a unit as many pixels across as up.
  const scale = 0.9 * Math.min(aspect / halfX, 1 / halfY);
  const vertexCount = positions.length / 3;
  const flat = new Float32Array(vertexCount * 2);
  for (let v = 0; v < vertexCount; v++) {
    flat[2 * v] = ((positions[3 * v] - centreX) * scale) / aspect;
    flat[2 * v + 1] = (positions[3 * v + 1] - centreY) * scale;
  }
  return flat;
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

  // Two floats per vertex, rewritten by fitToClip whenever the canvas resizes.
  const vertexBuffer = device.createBuffer({
    size: mesh.vertexCount * 2 * 4,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const module = device.createShaderModule({ code: shader });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs',
      // How to read the buffer: step 8 bytes per vertex, and hand bytes 0-7
      // of each step to the shader's @location(0) as two floats.
      buffers: [{
        arrayStride: 2 * 4,
        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
      }],
    },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
  });

  // An arrow function, not a hoisted declaration, so TypeScript knows the
  // null check on `context` above has already run.
  const draw = (): void => {
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.02, g: 0.024, b: 0.04, a: 1 }, // the page background, #05060a
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setIndexBuffer(indexBuffer, 'uint32');
    pass.drawIndexed(mesh.triangleCount * 3);
    pass.end();
    device.queue.submit([encoder.finish()]);
  };

  // Keep the drawing buffer at the canvas's real pixel size, so the image
  // stays sharp and undistorted, and refit and redraw whenever that size changes.
  const maxSize = device.limits.maxTextureDimension2D;
  new ResizeObserver(() => {
    const dpr = window.devicePixelRatio;
    canvas.width = Math.max(1, Math.min(Math.round(canvas.clientWidth * dpr), maxSize));
    canvas.height = Math.max(1, Math.min(Math.round(canvas.clientHeight * dpr), maxSize));
    device.queue.writeBuffer(vertexBuffer, 0, fitToClip(mesh.positions, canvas.width / canvas.height));
    draw();
  }).observe(canvas);
}

main().catch((err: unknown) => {
  fail(`The viewer failed to start: ${err instanceof Error ? err.message : String(err)}`);
});

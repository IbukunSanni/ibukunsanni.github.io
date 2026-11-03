import './style.css';
import dragonShader from './lit.wgsl?raw';
import platformShader from './platform.wgsl?raw';
import { loadMesh, vertexNormals } from './mesh.ts';
import { multiply, perspective, rotationX, rotationY, scaling, translation, type Mat4 } from './mat4.ts';

// Piece 2b, step 1: the Stanford dragon, 871k triangles read from a binary
// file, drawn through an index buffer with a depth buffer, lit by one
// directional light from normals computed on load, standing on a platform
// drawn in the same pass, redrawn every frame from an orbit camera the visitor
// turns and zooms, with the frame time on screen. See docs/ENGINEERING.md.

const canvas = document.querySelector<HTMLCanvasElement>('#viewer')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const stats = document.querySelector<HTMLParagraphElement>('#stats')!;

// Every way the viewer can fail ends here: one message, centred, instead of a
// blank page. Piece 4 replaces this with a pre-rendered image.
function fail(message: string): void {
  status.textContent = message;
  status.classList.add('error');
}

// Moves the model's centre to the origin and scales it so its farthest vertex
// is 1 away. Every distance after this is in model radii, and the whole model
// stays inside the unit sphere whichever way it is turned. That space is the
// world: the platform and the light are placed in it. Also returns the height
// of the model's lowest point there, where the platform goes.
function fitToUnitSphere(positions: Float32Array): { fit: Mat4; lowest: number } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    min[i % 3] = Math.min(min[i % 3], positions[i]);
    max[i % 3] = Math.max(max[i % 3], positions[i]);
  }
  const [cx, cy, cz] = [0, 1, 2].map((i) => (min[i] + max[i]) / 2);
  let farthest = 0; // squared
  for (let i = 0; i < positions.length; i += 3) {
    const dx = positions[i] - cx;
    const dy = positions[i + 1] - cy;
    const dz = positions[i + 2] - cz;
    farthest = Math.max(farthest, dx * dx + dy * dy + dz * dz);
  }
  const radius = Math.sqrt(farthest);
  return {
    fit: multiply(scaling(1 / radius), translation(-cx, -cy, -cz)),
    lowest: (min[1] - cy) / radius,
  };
}

// The platform's radius in the world. The dragon reaches 0.94 from its
// vertical axis, so 1.2 leaves a margin all round.
const platformRadius = 1.2;

const fovY = Math.PI / 4; // the camera's view, top to bottom: 45 degrees

// How far back the camera sits for the unit sphere to just fit: the sphere
// touches the edges of the view when sin(half the view's angle) = 1 / distance,
// taking the narrower of the vertical and horizontal angles.
function fitDistance(aspect: number): number {
  const halfY = fovY / 2;
  const halfX = Math.atan(aspect * Math.tan(halfY));
  return 1 / Math.sin(Math.min(halfX, halfY));
}

// What the visitor controls: yaw turns the model about the vertical, pitch
// tips it towards or away from the camera (both in radians), and zoom 2 puts
// the camera twice as close as the fit.
const orbit = { yaw: 0, pitch: 0, zoom: 1 };

// World to clip space, the camera, rebuilt every frame and applied right to
// left:
//   turn      yaw, then pitch
//   back off  the camera is at the origin looking down -z, so the world moves
//             `distance` away from it instead
//   project   perspective, depth 0 at the near side of the sphere holding
//             everything drawn (`reach` from the origin) and 1 at its far
//             side, so the depth buffer's precision is spent on the scene
// Each object's matrix is this times its own placement in the world. Zoomed
// in, the camera can be inside that sphere though never inside the dragon,
// so the near side is kept a little in front of the camera.
function worldToClip(aspect: number, reach: number): Mat4 {
  const distance = fitDistance(aspect) / orbit.zoom;
  const turn = multiply(rotationX(orbit.pitch), rotationY(orbit.yaw));
  const view = multiply(translation(0, 0, -distance), turn);
  const projection = perspective(fovY, aspect, Math.max(distance - reach, 0.05), distance + reach);
  return multiply(projection, view);
}

// Drag to turn the model; wheel, or pinch on a trackpad, to zoom. Pointer
// events cover a mouse, a pen and one finger alike.
function listenForOrbit(): void {
  const radiansPerPixel = 0.01;
  let dragging: number | null = null; // the pointer turning the model
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId); // keep the moves even off the canvas
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragging) return;
    orbit.yaw += (e.clientX - lastX) * radiansPerPixel;
    const pitch = orbit.pitch + (e.clientY - lastY) * radiansPerPixel;
    orbit.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const release = (e: PointerEvent): void => {
    if (e.pointerId === dragging) dragging = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  // A trackpad pinch arrives as a wheel event with ctrlKey set, and the
  // browser would zoom the page unless the event is cancelled, which a
  // passive listener cannot do. Zoom stays between 0.5 and 2: at 2 the
  // camera is still outside the unit sphere, so never inside the dragon.
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    orbit.zoom = Math.max(0.5, Math.min(2, orbit.zoom * Math.exp(-e.deltaY * 0.001)));
  }, { passive: false });
}

// The last 300 frame intervals, 5 seconds at 60 Hz, from requestAnimationFrame's
// timestamps: the rate the visitor sees, including any frame that came late.
const intervals: number[] = [];

function showFrameTimes(): void {
  const sorted = [...intervals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const p99 = sorted[Math.ceil(sorted.length * 0.99) - 1];
  stats.textContent = `${Math.round(1000 / median)} fps · ${median.toFixed(1)} ms median · ${p99.toFixed(1)} ms p99`;
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

  // One 4x4 float32 matrix per object, 64 bytes each, rewritten every frame.
  const matrixBuffer = (): GPUBuffer => device.createBuffer({
    size: 16 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const dragonUniforms = matrixBuffer();
  const platformUniforms = matrixBuffer();

  // Where each object sits in the world. The platform's top is level with the
  // dragon's lowest point, and `reach` is the radius of the sphere around the
  // origin that holds them both, for the camera's near and far.
  const { fit, lowest } = fitToUnitSphere(mesh.positions);
  const platform = multiply(translation(0, lowest, 0), scaling(platformRadius));
  const reach = Math.max(1, Math.hypot(platformRadius, lowest));

  // One depth value per pixel: how near the surface drawn there so far is. A
  // fragment is kept only if it is nearer ('less') than what its pixel holds,
  // so which surface wins no longer depends on the order triangles arrive in.
  const depthFormat = 'depth24plus';

  const dragonModule = device.createShaderModule({ code: dragonShader });
  const dragonPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: dragonModule,
      entryPoint: 'vs',
      // How to read the buffers: in each, step 12 bytes per vertex and hand
      // the step's three floats to the shader, slot 0's to @location(0) (the
      // position) and slot 1's to @location(1) (the normal).
      buffers: [
        { arrayStride: 3 * 4, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
        { arrayStride: 3 * 4, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
      ],
    },
    fragment: { module: dragonModule, entryPoint: 'fs', targets: [{ format }] },
    depthStencil: { format: depthFormat, depthWriteEnabled: true, depthCompare: 'less' },
  });

  // The platform's pipeline reads no buffers: its shader makes the corners.
  const platformModule = device.createShaderModule({ code: platformShader });
  const platformPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: platformModule, entryPoint: 'vs' },
    fragment: { module: platformModule, entryPoint: 'fs', targets: [{ format }] },
    depthStencil: { format: depthFormat, depthWriteEnabled: true, depthCompare: 'less' },
  });

  // Connects each object's matrix to its shader's @group(0) @binding(0). With
  // layout 'auto', each pipeline worked out that slot's shape from its shader,
  // so each needs its own bind group.
  const dragonBindGroup = device.createBindGroup({
    layout: dragonPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: dragonUniforms } }],
  });
  const platformBindGroup = device.createBindGroup({
    layout: platformPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: platformUniforms } }],
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
    // Two draws into the same colour and depth buffers, so whichever surface
    // is nearer wins at each pixel, whatever object it belongs to.
    pass.setPipeline(dragonPipeline);
    pass.setBindGroup(0, dragonBindGroup);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setVertexBuffer(1, normalBuffer);
    pass.setIndexBuffer(indexBuffer, 'uint32');
    pass.drawIndexed(mesh.triangleCount * 3);
    pass.setPipeline(platformPipeline);
    pass.setBindGroup(0, platformBindGroup);
    pass.draw(6); // two triangles
    pass.end();
    device.queue.submit([encoder.finish()]);
  };

  // One frame: the camera as it is now, then the draw.
  let depthTexture: GPUTexture | null = null;
  const render = (): void => {
    // The depth buffer must match the canvas pixel for pixel, so it is
    // replaced whenever the canvas changes size.
    if (!depthTexture || depthTexture.width !== canvas.width || depthTexture.height !== canvas.height) {
      depthTexture?.destroy();
      depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: depthFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }
    const camera = worldToClip(canvas.width / canvas.height, reach);
    device.queue.writeBuffer(dragonUniforms, 0, multiply(camera, fit));
    device.queue.writeBuffer(platformUniforms, 0, multiply(camera, platform));
    draw(depthTexture.createView());
  };

  // Keep the drawing buffer at the canvas's real pixel size, so the image
  // stays sharp and undistorted. Resizing clears the canvas, so draw again at
  // once rather than show a blank frame until the next one.
  const maxSize = device.limits.maxTextureDimension2D;
  new ResizeObserver(() => {
    const dpr = window.devicePixelRatio;
    canvas.width = Math.max(1, Math.min(Math.round(canvas.clientWidth * dpr), maxSize));
    canvas.height = Math.max(1, Math.min(Math.round(canvas.clientHeight * dpr), maxSize));
    render();
  }).observe(canvas);

  // The render loop: draw every frame the browser shows, whether or not
  // anything moved, and time the gaps between frames.
  let previous: number | null = null;
  let frames = 0;
  const frame = (now: DOMHighResTimeStamp): void => {
    if (previous !== null) {
      intervals.push(now - previous);
      if (intervals.length > 300) intervals.shift();
    }
    previous = now;
    render();
    if (++frames % 30 === 0) showFrameTimes();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  // A hidden tab gets no frames; the gap until it is shown again is not a slow frame.
  document.addEventListener('visibilitychange', () => {
    previous = null;
  });

  listenForOrbit();
}

main().catch((err: unknown) => {
  fail(`The viewer failed to start: ${err instanceof Error ? err.message : String(err)}`);
});

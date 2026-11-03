# Engineering plan

The plan for this repo: a graphics portfolio whose front page is a live
WebGPU viewer, built piece by piece to show what visualization engineering
roles ask for. Each piece has a check, and a piece is done when its check
passes in the browser, not before.

*Started 3 November*, from the raytracer repo's `docs/ROADMAP.md`
("Portfolio site", "v2, first: the desert terrain") and `docs/ENGINEERING.md`
("Revised 1 November"). From now on this file is the site's plan; those
sections are where it came from.

---

## Who it is for

**Who I am, in one line.** A software developer with 4+ years of production
work (Valsoft, BFN, Qucoon) and a Waterloo Master's in ECE (AI/ML), who built
a C++ path tracer checked against Blender's Cycles and now builds WebGPU
visualization for large data.

**The roles.** Graphics and visualization developer roles, Waterloo region
first.

| Company | Role | Status |
|---|---|---|
| Landmark | Geoscience visualization | Applied 27 October |
| Mappedin | -- | Applied 27 October |
| Maxon | Redshift | Planned for Monday 2 November |
| Christie | -- | Planned for Monday 2 November |

**The test for every piece:** does it show something a posting asks for,
measured, in a form an interviewer can open in a browser?

## What the postings ask for, and where this repo shows it

Only Landmark's posting is recorded in detail so far. **When applying to
the others, paste each posting's must-haves into this table**, so the
plan follows the postings and not a guess at them.

| Asked for | Shown by | Piece | Evidence on the page |
|---|---|---|---|
| WebGL / WebGPU | Raw WebGPU and WGSL, no framework | v1, 1 onward | The source, linked from the page |
| TypeScript | All of it, `strict` on, type-checked in CI | v1, 1 onward | A build that fails on a type error |
| Millions of primitives at interactive rates | The Stanford dragon, ~871k triangles | v1, 2 | Frame time on screen at 60 fps |
| Picking and navigation | Orbit and zoom; a click casts a ray down a BVH | v1, 2 and 3 | The picked point marked; pick time on screen |
| Browser profiling | Frame time, then GPU time from timestamp queries | v1, 2; terrain, 9 | A before/after table with browser, GPU and resolution |
| Level of detail | A terrain quadtree refined by screen-space error | Terrain, 3 | Triangle count flat as the terrain grows |
| Data larger than memory, streamed | Tiles fetched on demand into a fixed-size cache | Terrain, 6 | Memory under its cap across the whole field |
| Culling | Frustum culling of quadtree nodes | Terrain, 5 | Nodes drawn against nodes in view, on screen |
| Raster data (Landmark, preferred) | A real elevation model cut into tiles | Terrain, 0--1 | Source, licence and nodata count on the page |
| GPU programming beyond drawing | A path tracer in WebGPU compute | Weeks 7--8 | GPU image matches the CPU's within noise |

**Why one site and not several demos.** Every row above lands on one URL an
interviewer can open on their own laptop, beside the measured numbers and the
writing. A link in an application is read; a repo that needs building is
mostly not.

---

## The schedule

Two months away from the day job, 22 October to 20 December 2026. Weeks are
numbered from 22 October.

| Week | Build | Alongside | Done when |
|---|---|---|---|
| **3** (2--8 Nov) | v1 pieces 1--3: triangle live on Pages, the dragon at 60 fps, picking. Started 3 November, two days late | Apply to Maxon Redshift and Christie · first deck.gl PR, [below](#open-source-contribution) | A live URL; ~871k triangles at 60 fps with frame time on screen; a click marks the picked point |
| **4** (9--15 Nov) | v1 pieces 2b, 4, 5: the stage, the no-WebGPU fallback, the pages | A post: the WebGPU dragon | **Site v1 live**, linked from the raytracer README and dev.to |
| **5--6** (16--29 Nov) | The desert terrain: real elevation data, LOD, streaming, culling, picking | A post: the desert | Its definition of done, below |
| **7--8** (30 Nov--20 Dec) | A path tracer in WebGPU compute | A post: the same scene on CPU and GPU | The GPU image matches the CPU's within noise; speed-up measured; running live on the site |
| **Every week** | -- | 2--3 applications | The sent list grows every week |

**Friday check-in:** what shipped, what slipped, what moves. A slipped week
moves the later ones; it does not get doubled up. The first is Friday
6 November, and it decides what slips from week 3.

---

## v1: the site (weeks 3--4)

**Done when:** live on GitHub Pages; the dragon holds 60 fps on the
development laptop with orbit, zoom and click-to-pick; a browser without
WebGPU gets a static render instead of an error; every third-party asset is
credited; the raytracer README and the dev.to profile link here.

**The pages:**

1. **Home.** The dragon viewer as the hero, one line on who I am, and three
   result cards: the Cycles match (0.02/255, the SMG gun), the furnace, the
   BVH (304×), each linking to its post.
2. **Raytracer.** What it is, the measured results, a small gallery of
   renders with their credits, links to the repo and the posts.
3. **Writing.** The dev.to posts, newest first.
4. **About.** Résumé (PDF), contact, links.

**The viewer, piece by piece:**

| # | Piece | Check | Status |
|---|---|---|---|
| 1 | WebGPU device, a triangle on screen, Vite + TypeScript, deployed to Pages | Live URL shows it | ✅ Live 3 Nov at [ibukunsanni.github.io](https://ibukunsanni.github.io/) (commit `8cfa9f6`, deploy 41 s), showing step 2's flat dragon, clean console |
| 2 | Load the dragon (converted once to a binary vertex/index file), draw it lit, orbit and zoom | ~871k triangles at 60 fps; frame time on screen | -- |
| 2b | The stage: the dragon on a procedural stained-glass platform in a dark void (Voronoi panes, dark leading between them, light glowing through), all in WGSL | Still 60 fps with the platform in; no texture files, the glass is computed | -- |
| 3 | Picking: a click casts a ray against a BVH over the dragon, on the CPU in TypeScript | The picked point is marked where the cursor was; pick time on screen | -- |
| 4 | Fallback: no WebGPU, show a pre-rendered image from the raytracer | Tested with WebGPU disabled | Interim: a centred message on every failure path (3 Nov) |
| 5 | Pages 2--4, written content, credits | Every link resolves; every asset credited | -- |

**Piece 2, one WebGPU concept per step.** *Decided 3 November:* no primer
read front to back; each step reads one chapter of WebGPU Fundamentals
(webgpufundamentals.org) just before it, and ends in something visible.

| Step | Adds | Read first | Check | Status |
|---|---|---|---|---|
| 1 | **Vertex buffer.** The corners move from the shader into GPU memory | *Fundamentals*, *Vertex Buffers* | The same pixels as before (a refactor) | ✅ 3 Nov: fingerprint `137947c5`, 170,132 lit pixels at 1148×824, before and after |
| 2 | **The data and an index buffer.** The dragon's PLY converted once to a binary file, drawn flat with step 1's pipeline | *Vertex Buffers*, its index-buffer section | Counts read from the PLY header; the binary reads back identical to the parse; the silhouette on screen | ✅ 3 Nov: 437,645 vertices, 871,414 triangles, 15.7 MB; round trip bit-identical, spot-checked independently; silhouette undistorted at desktop and phone shapes, production build, clean console |
| 3 | **Uniform buffer and bind group.** A matrix moves the model | *Uniforms* | The model moves when the matrix changes | ✅ 3 Nov: a resize writes 64 bytes instead of 3,501,160; the frame identical to step 2's (hash `5359e105`, 443,210 lit pixels at 1148×824, 0 differing); re-fits at phone shape |
| 4 | **Depth buffer.** Far triangles painting over near ones, then fixed | *Perspective Projection* | The nearest surface wins at every pixel, from any angle | ✅ 3 Nov, front view: reversing the draw order changed the frame without depth (`f44fe850` → `203c93ed`, mean red 142.4 → 73.4) and not with it (`9f182756` both ways), 443,210 pixels at 1148×824 throughout; production build identical, clean console, phone shape. Other angles re-checked in step 6 |
| 5 | **Normals and Lambert shading** | *Directional Lighting* | The dragon lit, its brightness following the light | -- |
| 6 | **Render loop, orbit, zoom, frame time on screen** | *Cameras* | Piece 2's check: 60 fps, median and 99th-percentile frame time shown; step 4's depth check from orbited angles | -- |

**Piece 2's data, simplest first.** Positions as `float32` and indices as `uint32`
(the dragon has more than 65,535 vertices, so 16-bit indices cannot address
it), normals computed on load from the triangles. `tools/ply-to-mesh.mjs`
writes a 16-byte header (`'MESH'`, version, vertex and triangle counts) and
then the two arrays exactly as they sit in memory, so the browser takes
typed-array views of the download instead of parsing it. Measured 3
November: 5.25 MB of positions and 10.46 MB of indices, 15.7 MB in all
against 33.8 MB of PLY text, converted in 1.3 s. **On Pages, measured
3 November:** Pages gzips it, so it crosses the network as 6.9 MB (44%) and
loaded in 1.05 s over HTTP/2 on the development laptop's connection.
Quantised positions or compressed indices wait until a slower connection
measures as a problem.

**Piece 3 reuses the raytracer's BVH.** The same tree as step 8, written again
in TypeScript: bounds per node, the slab test, nearest hit. The pick time on
screen is the evidence that the tree, not a linear scan, did the work; take
the linear scan's time once as the before-number.

---

## v2: the desert terrain (weeks 5--6)

*Decided 30 October.* The dragon proves one big mesh at 60 fps. It does not
prove what the Landmark posting is mostly about: **a dataset larger than
memory**, drawn at interactive rates through level of detail, streamed in
pieces, culled, and picked. A real desert does, from open elevation data: a
dune field of tens of millions of height samples.

- **Why a desert.** One terrain covers LOD, streaming, raster data and
  picking at once. A heightmap surface is the same kind of object as the
  rock-layer surfaces geoscience viewers draw.
- **Real data, not generated.** Gaps, bad values and odd formats are part of
  the skill being shown.
- **The look of Dune, never its property.** A low sun, warm sand, haze; no
  names, logos or assets.

**Not before:** v1 is live.

| # | Piece | Check |
|---|---|---|
| 0 | **The data.** A real dune field from an open elevation model (for example Copernicus GLO-30, SRTM or USGS 3DEP); **read its licence before downloading anything**; record source, resolution and licence | The licence permits public display with credit, written down beside the data |
| 1 | **Tiles, offline.** A script cuts the raster into a quadtree pyramid of fixed-size tiles (e.g. 256² heights), each level half the resolution of the one below, as binary files Pages can serve. Nodata samples are filled and counted, not hidden | The pyramid rebuilds from the raw file in one command; nodata count logged; total size stated |
| 2 | **One tile drawn.** A grid mesh displaced by the height texture in WGSL, lit, orbit and zoom | One tile at 60 fps; heights match the raw data at five sampled points |
| 3 | **Quadtree LOD.** Each frame, refine nodes whose screen-space error is above a pixel threshold | Triangle count stays flat as the terrain grows; threshold adjustable on screen |
| 4 | **No cracks.** Skirts first; stitching only if skirts show | No visible holes from any angle, checked with a flat-colour debug view |
| 5 | **Frustum culling.** Skip nodes outside the view before refining | Nodes drawn against nodes in view, on screen; turning away drops the count |
| 6 | **Streaming.** Fetch tiles on demand, nearest first, into a fixed-size cache that evicts the least recently used | Memory under the cap across the whole field; the first frame needs only the root tiles |
| 7 | **Picking.** A click casts a ray down the quadtree against the heights, CPU side | Returns latitude, longitude and elevation, marked on the terrain; pick time on screen |
| 8 | **The look.** Sand shading, low sun, distance haze, all in WGSL, no texture files | Still 60 fps with it on |
| 9 | **The numbers.** Frame time, GPU time, tiles resident, MB downloaded; the same flight with LOD and culling off, then on | A before/after table on the page, with browser, GPU and resolution |

**Definition of done**, all of it measured, no partial credit:

1. **Real and credited.** Licence checked before use; source credited on the
   page.
2. **Larger than memory, still smooth.** The full dataset is never loaded at
   once, and a scripted flight across the whole field holds **60 fps** on the
   development laptop with the cache under its stated cap.
3. **Correct.** No cracks from any angle; heights match the raw data at
   sampled points; picking returns the right elevation within one sample.
4. **Measured.** The before/after table for the same flight.
5. **Live.** On the site beside the dragon, with the same fallback and a
   link to the tile script.

If 60 fps is missed, record the measured number and what dominates it (CPU
refinement, upload, or GPU) instead of lowering the target.

---

## Weeks 7--8: a path tracer in WebGPU compute

The raytracer's spheres, quads, BVH traversal and diffuse, metal and glass
materials, on the GPU. Its CPU reference, the raytracer's *Next Week* 10
scene with the top-level BVH, is done (3 November).

**Done when:** the GPU image matches the CPU's within noise; the speed-up is
measured; it runs live on the site.

**The pieces.** *Proposed 3 November, not yet agreed;* settle them before
week 7 starts.

| # | Piece | Check |
|---|---|---|
| 1 | A compute shader writes to a storage texture; a full-screen pass shows it | A gradient on screen, computed per pixel on the GPU |
| 2 | Camera rays against one sphere, normals as colour, no randomness | Matches the CPU's normals image of the same scene to within float tolerance |
| 3 | Accumulation over frames, a GPU random number generator, the diffuse material | The furnace test, ported: a white diffuse sphere in a uniform white environment renders flat |
| 4 | Metal, glass, quads | Mean colour matches the CPU render of the same scene within noise |
| 5 | The BVH, flattened on the CPU into a storage buffer; iterative traversal with a fixed-size stack in WGSL | Hits identical to brute force on a test scene; speed-up against brute force measured |
| 6 | The final scene, CPU and GPU side by side | The definition of done above; time per sample on both |

---

## Open-source contribution

*Decided 3 November:* **deck.gl** ([visgl/deck.gl](https://github.com/visgl/deck.gl)),
alongside the site, never instead of it.

- **Why deck.gl.** Large-data geospatial visualization with picking, in
  TypeScript: the closest open-source match to Landmark's and Mappedin's
  work. Its WebGPU port is under active daily development (WebGPU fixes
  merged 1--3 November), and its contributing guide says it is looking for
  new maintainers. A merged PR in its WebGPU path is evidence an interviewer
  can click.
- **First PR: [issue 9493](https://github.com/visgl/deck.gl/issues/9493).**
  The `BitmapLayer` pixel-picking doc example reads the picked colour with
  `readPixelsToArrayWebGL`, deprecated in luma.gl and WebGL-only. The
  replacement, `Texture.readBuffer` then `Buffer.readAsync` (luma.gl 9.3+,
  per a comment on the issue; to verify against luma.gl's source), works on
  both backends. Small and real, and it teaches GPU-to-CPU readback, which
  this site's picking and GPU timing need. Started 3 November in its own
  session; claiming the issue, pushing and opening the PR are mine to do.
- **Study before piece 3: [issue 11020](https://github.com/visgl/deck.gl/issues/11020)**
  and a maintainer's fixes for it, PRs
  [11018](https://github.com/visgl/deck.gl/pull/11018) and
  [11019](https://github.com/visgl/deck.gl/pull/11019). On WebGPU, views were
  drawn at the mirrored height and picking returned the wrong object, because
  WebGL counts viewport and pixel-readback y from the bottom-left and WebGPU
  from the top-left. Piece 3 turns a click into a ray and meets the same
  convention.
- **Then:** a bug from the WebGPU tracker
  ([issue 9504](https://github.com/visgl/deck.gl/issues/9504)), once the first
  PR has been through review.
- **Timing.** The issue comment the day it is decided; the PR within week 3,
  because review takes days and the clock starts when it opens.

**Considered and not chosen, 3 November:**

| Project | Fit | Why not first |
|---|---|---|
| TypeGPU | TypeScript WebGPU toolkit, 8 open "good first issue"s | A toolkit for shader code, not visualization |
| vtk.js (Kitware) | Scientific visualization, the toolkit family geoscience uses; a WebGPU-WebGL parity tracker is open | JavaScript, slower pace, no beginner issues labelled |
| gpuweb/cts | WebGPU's conformance tests, in TypeScript; the deepest way to learn the API | Least visible to a hiring manager |
| Dawn (Chrome's WebGPU engine) | C++, a strong signal for Maxon and Christie | Steep start (Chromium tooling, Gerrit); one for later |

---

## How numbers are taken in the browser

The raytracer's measurement rules still apply (same-day comparisons, write
the prediction down first, expect the laptop to throttle, record the setup
with every number). The browser adds its own:

| Rule | Why |
|---|---|
| **Frame time is the interval between `requestAnimationFrame` callbacks; GPU time is measured separately** | The display paces the frames. On a 60 Hz panel a frame whose work takes 3 ms still reports 16.7 ms, so frame time shows whether the target is met and GPU time shows the headroom |
| **Report the median and the 99th percentile over a fixed window** (e.g. 300 frames), never a single fps reading | One slow frame is a stutter the eye sees; an average hides it |
| **GPU time from timestamp queries, where the adapter offers `timestamp-query`** | The only direct measure of the GPU's share. Chrome rounds the results (to 100 µs, unless the WebGPU developer features flag is on), which is fine for frames of milliseconds |
| **Record browser and version, GPU adapter, canvas size in device pixels, `devicePixelRatio`, display refresh rate, and power source** | Each changes the number. On 3 November the adapter was Intel `gen-12lp` (Iris Xe graphics), with a 1280×960 canvas at `devicePixelRatio` 1.25 in the Claude app's browser pane |
| **A refactor passes on identical pixels, fingerprinted inside the frame that drew them** | Once a frame is shown, the canvas's drawing buffer is replaced by an empty one, so a later `drawImage` reads blank. Trigger a redraw (nudge the canvas size) and read it from a `ResizeObserver` registered after the viewer's, which runs after the draw and before the frame is shown |
| **Check the console in a fresh tab** | WebGPU reports validation errors as console warnings, not exceptions, and drops the frame. A reused tab keeps warnings from earlier loads and from hot reloads mid-edit |
| **Check the production build, not only the dev server** | Vite's dev server strips types without checking them; on 3 November it ran code that `tsc` then rejected. Pages serves `dist/`, so `npm run build` and `npm run preview` are what count |

---

## Look and feel

*Decided 22 October.* Two influences, kept apart:

- **The layout from [carlosmatecki.com](https://www.carlosmatecki.com/):** a
  one-line identity, a short core-stack list, project cards that link to code
  and measured results, an honest experience timeline. Calm and text-first;
  evidence over claims.
- **The mood from Kingdom Hearts' "Dive to the Heart":** a dark void, the
  dragon on a glowing stained-glass platform, soft light, a slow descending
  camera. The hero carries it; the rest of the site stays clean. **Mood only,
  never the property:** no logos, characters, keyblades, music, menu art or
  the game's font, and the raytracer's `assets/models/keyblade.obj` stays out
  of anything public. It must read as a rendering demo to someone who has
  never played the game.

**Tech.** Raw WebGPU and WGSL in TypeScript, built with Vite. The postings
ask for shaders and GPU programming, and a framework would hide them. Three.js
only if v2 wants effects.

## Guardrails

- **Two weeks for v1, then ship what works.**
- **No custom scroll animations, page transitions or font work** until the
  viewer is at 60 fps and live.
- **Not before applying.** The site makes interviews stronger; it never
  delays an application.
- **Nothing is called working until it has been seen in the browser**, in
  the production build.

## Licences and credits

**The Stanford dragon.** The Stanford 3D Scanning Repository's terms, read
3 November (graphics.stanford.edu/data/3Dscanrep/):

- The models may be used for research and mirrored or redistributed **for
  free**, with the source acknowledged.
- Images of them may be published in scholarly articles or books **with
  credit to the Stanford Computer Graphics Laboratory**.
- **Not for commercial use**, and not in a product for sale, without their
  permission.
- **The dragon is a symbol of Chinese culture**, and the repository asks that
  it be used in good taste: not animated or morphed, no Boolean operations,
  nothing breaking, exploding or melting it.

What that means here:

- The credit goes on the page that shows the dragon, beside the viewer.
- **The camera moves; the dragon never does.** Orbit, zoom and the slow
  descending camera are camera motion. No spinning, deforming, slicing or
  shattering effects on the model, now or in v2. (The bunny and the armadillo
  carry no such request, if an effect ever needs a model.)
- **Open question:** a free personal portfolio is non-commercial and fits the
  free-redistribution clause, but it is not a scholarly article. If in doubt,
  ask the repository (its contact address is on the page) before going live.
- **The triangle count, measured 3 November.** The page lists the dragon's
  vrip reconstruction at 566,098 vertices and 1,132,830 triangles, but the
  file used here, `dragon_vrip.ply` from `dragon_recon.tar.gz` (SHA-256
  `74ac1d90…d02f`), has **437,645 vertices and 871,414 triangles**. Its
  README says it is decimated from a finer original. The archive's
  `_res2`--`_res4` files are cruder decimations, which the README itself calls
  not beautiful. The page quotes 871,414.
- **Credited on the page** since 3 November, beside the viewer.

**The raw download stays out of the repo.** Only the converted binary is
committed, so the page can serve it.

**Terrain data:** piece 0 of the terrain, licence first.

---

## Rules

- **Every piece keeps a check**, and a piece is done when its check passes in
  the browser. When something is not finishing, cut scope, not quality.
- **Simplest first.** The inefficient version works and is measured before
  any optimisation, and an optimisation needs a measured reason.
- **One build focus a week.** Writing and applications run beside it, never
  instead of it.
- **Commit messages are one line.**

## Decisions

**3 November, piece 1.**

- **Every failure path ends in one centred message.** No `navigator.gpu`, no
  adapter, no canvas context, a lost device, or any exception from start-up.
  Before, a `requestDevice` failure was an unhandled promise rejection and a
  blank page. Piece 4 replaces the message with a pre-rendered image.
- **The draw callback is an arrow function, not a `function` declaration.**
  A declaration is hoisted, so TypeScript cannot assume the null check on the
  canvas context ran before it is called; the dev server never complained,
  the build did.
- **`.claude/` is gitignored.** It holds local preview configuration only.

**3 November, priorities.**

- **The dragon's data before the deck.gl PR.** Friday's check-in is judged
  on the dragon at 60 fps, the dragon is the hero of every link sent with an
  application, and the PR runs in its own session needing only short bursts
  (the issue comment, approving the push).
- **The data step moves up, ahead of uniforms.** Converting the dragon is
  CPU work that needs no new WebGPU concept except an index buffer, and
  drawing it flat with step 1's pipeline proves the file is right before
  the camera and lighting steps build on it.

**3 November, step 3.**

- **The prediction was wrong, and that was the finding.** Moving the fit
  from float64 on the CPU to a float32 matrix on the GPU was predicted to
  change a few edge pixels; none changed. The rasteriser snaps each vertex
  to a fixed sub-pixel grid (Direct3D, which Chrome uses on Windows, requires
  at least 1/256 of a pixel) before testing coverage, and the float32
  difference here is about 1/10,000 of a pixel, so both snap to the same
  points.
- **The matrix already maps depth.** z goes to 0.5 - (z - cz)·sz, nearer
  smaller and inside 0..1, unused until step 4's depth test; without a depth
  buffer it only has to stay inside the clip range.

**3 November, step 4.**

- **Without a depth buffer, draw order decides the picture; with one, it
  does not.** The fragment shader shades by depth (nearest brightest) so the
  difference shows. At 1148×824: file order `f44fe850`, reversed order
  `203c93ed` (mean red 142.4 → 73.4, the far side painted over the near),
  and with the depth test `9f182756` in both orders, as predicted. The
  silhouette was the same 443,210 pixels in all four: coverage never depends
  on order, only whose colour lands.
- **The file's own order was nearly right, by luck.** Without depth it
  differed from the depth-tested frame at 72 pixels, every one the same or
  darker (at most 6 of 255): a slightly farther surface drawn after a nearer
  one. Measured by switching `depthCompare` to `'always'`, which reproduced
  the no-depth hash exactly.
- **The depth texture is replaced on every resize and never stored.** It
  must match the canvas pixel for pixel, and nothing reads it after the pass,
  so `depthStoreOp` is `'discard'`.

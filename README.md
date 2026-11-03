# ibukunsanni.github.io

A graphics portfolio whose front page is a demo: the Stanford dragon,
interactive in the browser through raw WebGPU and WGSL. Vite and plain
TypeScript, deployed to GitHub Pages.

    npm install
    npm run dev      # http://localhost:5173
    npm run build    # type-checks, then writes dist/

The Stanford dragon (Stanford Computer Graphics Laboratory) is converted once
from the repository's `dragon_recon.tar.gz` into `public/models/dragon.bin`;
the raw download stays out of git, in `raw/`:

    node tools/ply-to-mesh.mjs raw/dragon/dragon_recon/dragon_vrip.ply public/models/dragon.bin

The plan, piece by piece, is in [`docs/ENGINEERING.md`](docs/ENGINEERING.md).

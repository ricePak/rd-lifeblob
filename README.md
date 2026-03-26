# RD LifeBlob

RD ([Rhombic Dodecahedron](https://en.wikipedia.org/wiki/Rhombic_dodecahedron), a polyhedron with 12 identical diamond faces) LifeBlob is an interactive browser-based cellular automaton built on a face-centered cubic (FCC) lattice of rhombic dodecahedron cells. It combines editable life-like transition rules with real-time 3D blob rendering, letting you explore emergent structures on a 4,000-cell lattice directly in the browser.

Originally created for `Design Challenge 5 of COGS 300`.

## Why rhombic dodecahedron?

I chose rhombic dodecahedrons on an FCC grid to push the simulation toward a more biological-feeling visualization. Conway's original Game of Life effectively works with `8` neighbors on a 2D square grid, while a simple 3D voxel approach only gives `6` face-adjacent neighbors, which felt too limiting. The rhombic dodecahedron tiling gives each cell `12` neighbors instead, opening up a richer space of interactions and more organic-looking emergent forms.

## Highlights

- Interactive 3D visualization powered by Three.js
- Cellular automaton running on an FCC lattice with up to 12 neighbors per cell
- Rule editor for custom birth and survival transitions
- Built-in presets for quickly exploring different behaviors
- Metaball-style blob rendering using marching cubes
- Transition-aware coloring for alive, born, and dying cells
- Adjustable graphics settings for opacity, blob affinity, mesh resolution, boundaries, and shading
- Orbit and zoom camera controls with gentle idle rotation when paused

## Controls

### Simulation

- `Play / Pause` starts or stops the automaton
- `Step` advances one generation while paused
- `Reset` reseeds the simulation
- `Initial cells` controls the random starting population
- `Speed` changes iterations per second while playback is active

### Rules

- Toggle birth and survival chips to define custom transition rules
- Use presets to apply bundled rule sets and starting population together

### Camera and graphics

- `Left mouse drag` orbits the scene
- `Mouse wheel` zooms in and out
- `Nucleus opacity` changes blob transparency
- `Blob affinity` changes how strongly nearby cells merge into a shared surface
- `Render cell boundaries` shows lattice outlines for active and adjacent cells
- `Mesh resolution` trades visual fidelity for performance
- `Enable smooth shading` switches between smoother and more faceted lighting

## Tech Stack

- HTML, CSS, and vanilla JavaScript
- [Three.js](https://threejs.org/) loaded from CDN
- Custom marching cubes implementation for metaball mesh generation

## Next Steps
- Optimize for mobile devices
- Optimize renderer
- Dark/bright colour schemes
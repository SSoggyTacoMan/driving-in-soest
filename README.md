# Driving in Soest — Golden Hour

A 3D taxi game set in a hand-built, low-poly Soest at the end of a warm Dutch afternoon.

Drive the yellow taxi, pick up passengers at the old church, the palace, the station and the dunes, and follow the glowing chevrons through town. There is no timer, no traffic tickets, and no wrong turn that cannot be fixed.

This is a Three.js remake of [leonardran/driving-in-soest](https://github.com/leonardran/driving-in-soest), rebuilt from scratch as a real 3D world.

## Play

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Then open the local URL Vite prints.

For a production build:

```bash
npm run build
npm run preview
```

## Controls

- `W` / `↑` — accelerate
- `S` / `↓` — brake / reverse
- `A` `D` / `←` `→` — steer
- `Space` — handbrake
- `C` — cycle camera
- `T` — golden hour / day / night
- `H` — horn
- `M` — mute
- `P` — photo mode
- `R` — put the taxi back on the road
- `Esc` — pause

Touch controls appear automatically on phones and tablets.

## What is inside

- A stylised Soest with the Oude Kerk, Paleis Soestdijk, the water tower, the windmill, the market square, Station Soest-Zuid, the dunes, sports park, polder and farmland.
- Procedural low-poly architecture, streets, trees, lamps, café terraces, bunting and a very good dog.
- Live traffic, cyclists, walkers, a passing NS train, fountain spray, birds and drifting pollen.
- Arcade taxi handling, collisions, passenger pickup and drop-off, a fare meter and a small persistent career.
- A 3D world with a custom sky, golden-hour lighting, bloom, colour grading and soft shadows.
- A completely procedural soundtrack and engine/ambient audio (Web Audio), so there are no audio assets to load.

## Credits

Original concept and the original 2D game: [leonardran](https://github.com/leonardran). This 3D remake is a fan project for fun.

Built with [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/). Fonts: Instrument Serif and Manrope via Fontsource.

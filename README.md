# AVIARY — 3D Bird Collection

An interactive 3D product-showcase website built with **Three.js** and **GSAP**.
Browse a collection of birds (Scarlet Macaw, Toco Toucan, Hyacinth Macaw) as
fully textured 3D models — drag to rotate, scroll to spin, click to switch.

## Tech
- **Three.js** (WebGL) — real-time 3D rendering, image-based lighting, shadows
- **GSAP + ScrollTrigger** — scroll-driven animation
- **Vite** — dev server & build
- 3D models are `.glb` files in `public/`

## Run it locally
```bash
npm install      # install dependencies (one time)
npm run dev      # start the dev server → http://localhost:5173
```

## Build for production
```bash
npm run build    # outputs to dist/
```

## Project layout
```
index.html        # page markup + text overlay
src/main.js       # all the 3D code (scene, models, controls, scroll)
src/style.css     # styling for the overlay UI
public/*.glb      # the 3D bird models
```

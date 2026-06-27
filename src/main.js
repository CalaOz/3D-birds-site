// ─────────────────────────────────────────────────────────────
//  A 3D COLLECTION: multiple bird models, switchable at runtime,
//  with smooth transitions + scroll-driven rotation.
// ─────────────────────────────────────────────────────────────

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
// Decoders for COMPRESSED models. Many downloaded .glb files are shrunk
// with Draco or Meshopt compression; without these, GLTFLoader fails.
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);
import "./style.css";

// THE COLLECTION -------------------------------------------------
// One entry per bird. `model` + `scale` get filled in once loaded.
const birds = [
  {
    name: "Scarlet Macaw",
    latin: "Ara Macao",
    file: "/parrot.glb",
    fit: 1, // per-bird size multiplier (tune so each fills the frame evenly)
    faceSign: 1, // +1 / -1: which way it turns so its face points at the text
    blurb: "A living splash of color — one of the most vivid birds on Earth.",
    sections: [
      {
        eyebrow: "Plumage",
        heading: "Painted in fire",
        body: "Scarlet head and body melt into bands of gold, green and deep blue across the wings. The colors come from both pigment and the microscopic structure of every feather.",
      },
      {
        eyebrow: "Voice",
        heading: "Loud and clever",
        body: "Macaws greet the rainforest with ear-splitting squawks that carry for miles — and they're sharp enough to mimic sounds and solve simple puzzles.",
      },
      {
        eyebrow: "Life",
        heading: "Bonded for decades",
        body: "Scarlet macaws mate for life and can live fifty years or more, flying in pairs over the forests of Central and South America.",
      },
    ],
    model: null,
    scale: 1,
  },
  {
    name: "Toco Toucan",
    latin: "Ramphastos Toco",
    file: "/toucan.glb",
    fit: 0.8,
    faceSign: -1,
    blurb: "Glossy black, a snow-white throat, and that unmistakable beak.",
    sections: [
      {
        eyebrow: "The beak",
        heading: "Bigger than it needs to be",
        body: "A toco's beak runs nearly a third of its body length — the largest, relative to size, of any bird. It reaches fruit on branches far too thin to climb.",
      },
      {
        eyebrow: "Engineering",
        heading: "Light as foam",
        body: "Despite its size the beak weighs almost nothing — a honeycomb of keratin around hollow air pockets — and it radiates heat to keep the bird cool.",
      },
      {
        eyebrow: "Habitat",
        heading: "Life in the canopy",
        body: "Tocos range across South America's forests and savannas, nesting in tree hollows and feasting on fruit, insects and the occasional egg.",
      },
    ],
    model: null,
    scale: 1,
  },
  {
    name: "Hyacinth Macaw",
    latin: "Anodorhynchus",
    file: "/macaw-blue.glb",
    fit: 0.8,
    faceSign: -1,
    blurb: "The largest flying parrot on Earth, drenched in cobalt blue.",
    sections: [
      {
        eyebrow: "Scale",
        heading: "The blue giant",
        body: "From beak to tail the hyacinth stretches a full metre — bigger than any other parrot that flies — wrapped in deep cobalt with flashes of gold around the eyes.",
      },
      {
        eyebrow: "Power",
        heading: "Built to crack",
        body: "Its beak can crush hard palm nuts and even coconuts: one of the most powerful bites in the entire bird world.",
      },
      {
        eyebrow: "Status",
        heading: "Rare and precious",
        body: "Found mainly in Brazil's Pantanal wetlands, hyacinths are endangered — only a few thousand remain in the wild.",
      },
    ],
    model: null,
    scale: 1,
  },
];
let activeIndex = 0;
let scrollProgress = 0; // 0 at top of page → 1 at bottom; drives slide + turn

// 1. SCENE -------------------------------------------------------
const scene = new THREE.Scene();

// 2. CAMERA ------------------------------------------------------
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.z = 5;

// 3. RENDERER ----------------------------------------------------
const canvas = document.querySelector("#scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// IMAGE-BASED LIGHTING -------------------------------------------
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// CONTROLS -------------------------------------------------------
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotate = false;
controls.enablePan = false;
controls.enableZoom = false; // wheel scrolls the page instead

// On TOUCH devices (phones/tablets), a one-finger drag must SCROLL the page,
// not rotate the model. The 3D controls normally hijack touch, so we disable
// them there and hand touch back to the browser. Desktop keeps drag-to-rotate.
if (window.matchMedia("(pointer: coarse)").matches) {
  controls.enabled = false;
  canvas.style.touchAction = "pan-y"; // allow vertical scrolling over the canvas
}

// LIGHTS + GROUND ------------------------------------------------
const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
keyLight.position.set(3, 6, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.bias = -0.0001;
scene.add(keyLight);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 50),
  new THREE.ShadowMaterial({ opacity: 0.35 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.6;
ground.receiveShadow = true;
scene.add(ground);

// How tall (in 3D units) a bird should be fit to — smaller on narrow
// phone screens so the whole bird stays in frame.
const fitSize = () => (window.innerWidth < 700 ? 2.1 : 3);

// LOAD EVERY BIRD ------------------------------------------------
// We preload all models up front. Each is centered, scaled, and
// shadow-enabled. Only the active one is visible at a time.
const loader = new GLTFLoader();
// Teach the loader how to read compressed models.
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
loader.setDRACOLoader(dracoLoader);
loader.setMeshoptDecoder(MeshoptDecoder);

birds.forEach((bird, i) => {
  loader.load(
    bird.file,
    (gltf) => {
      const m = gltf.scene;
      const box = new THREE.Box3().setFromObject(m);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      m.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = (fitSize() * (bird.fit ?? 1)) / maxDim;
      m.scale.setScalar(scale);
      m.traverse((obj) => {
        if (obj.isMesh) obj.castShadow = true;
      });
      m.visible = i === activeIndex; // hide all but the first
      bird.model = m;
      bird.maxDim = maxDim; // remember raw size so we can re-fit on resize
      bird.scale = scale;
      bird.basePos = m.position.clone(); // its centered "home" position
      scene.add(m);
    },
    undefined,
    (err) => console.error(`Could not load ${bird.file}:`, err)
  );
});

// TEXT + SWITCHING -----------------------------------------------
const eyebrowEl = document.querySelector("#bird-eyebrow");
const titleEl = document.querySelector("#bird-title");
const subtitleEl = document.querySelector("#bird-subtitle");
const buttons = document.querySelectorAll(".switcher-btn");

// Fill every panel's text from a bird's data (hero + 3 fact sections).
function applyBirdText(bird, i) {
  eyebrowEl.textContent = `No. 0${i + 1} — ${bird.latin}`;
  titleEl.textContent = bird.name;
  subtitleEl.textContent = bird.blurb;
  bird.sections.forEach((s, k) => {
    document.querySelector(`#s${k}-eyebrow`).textContent = s.eyebrow;
    document.querySelector(`#s${k}-heading`).textContent = s.heading;
    document.querySelector(`#s${k}-body`).textContent = s.body;
  });
}
applyBirdText(birds[0], 0); // show the first bird's text on load

function showBird(i) {
  if (i === activeIndex) return;
  const prev = birds[activeIndex];
  const next = birds[i];
  activeIndex = i;

  applyBirdText(next, i);
  buttons.forEach((b, bi) => b.classList.toggle("is-active", bi === i));

  // Swap deterministically FIRST: hide the old bird, show the new one
  // at full size. This is the guaranteed-correct end state.
  if (prev.model) {
    prev.model.visible = false;
    prev.model.scale.setScalar(prev.scale);
  }
  if (next.model) {
    next.model.visible = true;
    next.model.scale.setScalar(next.scale);
    // Decorative "pop": animate scale up from small. immediateRender:false
    // means if the animation never runs, the bird simply stays full-size.
    gsap.fromTo(
      next.model.scale,
      { x: next.scale * 0.5, y: next.scale * 0.5, z: next.scale * 0.5 },
      {
        x: next.scale, y: next.scale, z: next.scale,
        duration: 0.5,
        ease: "back.out(1.6)",
        immediateRender: false,
      }
    );
  }
}

buttons.forEach((btn) => {
  btn.addEventListener("click", () => showBird(Number(btn.dataset.index)));
});

// SCROLL-DRIVEN ROTATION -----------------------------------------
// Instead of animating one fixed model, we store the scroll-based
// angle in `scrollRotation` and apply it to whichever bird is active.
ScrollTrigger.create({
  trigger: document.body,
  start: "top top",
  end: "bottom bottom",
  scrub: 1,
  onUpdate: (self) => {
    scrollProgress = self.progress;
  },
});

// PANEL TEXT FADE-INS --------------------------------------------
gsap.utils.toArray(".panel-inner").forEach((el) => {
  gsap.from(el, {
    opacity: 0,
    y: 50,
    scrollTrigger: { trigger: el, start: "top 80%", end: "top 45%", scrub: true },
  });
});

// ANIMATION LOOP -------------------------------------------------
const PANELS = 4; // hero + 3 fact sections
const lerp = (a, b, t) => a + (b - a) * t;
// Which side the bird sits on for panel k: even panels have text on the LEFT
// (bird goes right, +1); odd panels have text on the RIGHT (bird goes left, -1).
const sideOf = (k) => (k % 2 === 0 ? 1 : -1);

function animate() {
  requestAnimationFrame(animate);

  const bird = birds[activeIndex];
  const active = bird.model;
  if (active) {
    // Figure out which panel we're on and how far between panels we are.
    const f = scrollProgress * (PANELS - 1);
    const i0 = Math.floor(f);
    const i1 = Math.min(i0 + 1, PANELS - 1);
    const frac = f - i0;
    // Smoothly blended side: +1 (bird right) ↔ -1 (bird left).
    const side = lerp(sideOf(i0), sideOf(i1), frac);

    // How wide the view is in 3D units, so the slide scales to the screen.
    const halfW =
      Math.tan(((camera.fov / 2) * Math.PI) / 180) *
      camera.position.z *
      camera.aspect;
    const xMag = Math.min(1.8, halfW * 0.38); // moderate — keeps the bird near the text

    // Sit opposite the text. The bird does a FULL 360° turn between each
    // section (f * 2π), but the angle it lands on at every section is a
    // face-on 3/4 view toward the text — so it spins fully yet never comes
    // to rest showing only its back.
    // Each model's "front" points a different way, so faceSign flips the
    // turn direction per bird to make every one look toward the text.
    const sign = bird.faceSign ?? 1;
    const faceAngle = (k) => sideOf(k) * 0.65 * sign;
    active.position.x = bird.basePos.x + side * xMag;
    active.rotation.y = f * Math.PI * 2 + lerp(faceAngle(i0), faceAngle(i1), frac);
    // ZOOM in and out across the scroll: moving the bird toward / away from
    // the camera. ~1.5 in-out cycles over the whole page.
    active.position.z = bird.basePos.z + Math.sin(scrollProgress * Math.PI * 3) * 0.9;
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();

// RESPONSIVE -----------------------------------------------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Re-fit every bird to the new screen size (e.g. phone rotated).
  const target = fitSize();
  birds.forEach((b) => {
    if (b.model) {
      b.scale = (target * (b.fit ?? 1)) / b.maxDim;
      b.model.scale.setScalar(b.scale);
    }
  });
});

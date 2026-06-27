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
    blurb: "A living splash of color, rebuilt in three dimensions.",
    model: null,
    scale: 1,
  },
  {
    name: "Toco Toucan",
    latin: "Ramphastos Toco",
    file: "/toucan.glb",
    blurb: "Glossy black, snow-white throat, and that unmistakable beak.",
    model: null,
    scale: 1,
  },
  {
    name: "Hyacinth Macaw",
    latin: "Anodorhynchus",
    file: "/macaw-blue.glb",
    blurb: "The largest flying parrot — drenched in deep cobalt blue.",
    model: null,
    scale: 1,
  },
];
let activeIndex = 0;
let scrollRotation = 0; // updated by scroll; applied to the active bird each frame
let scrollProgress = 0; // 0 at top of page → 1 at bottom; drives slide + zoom

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
      const scale = 3 / Math.max(size.x, size.y, size.z);
      m.scale.setScalar(scale);
      m.traverse((obj) => {
        if (obj.isMesh) obj.castShadow = true;
      });
      m.visible = i === activeIndex; // hide all but the first
      bird.model = m;
      bird.scale = scale;
      bird.basePos = m.position.clone(); // its centered "home" position
      scene.add(m);
    },
    undefined,
    (err) => console.error(`Could not load ${bird.file}:`, err)
  );
});

// SWITCHING BIRDS ------------------------------------------------
const titleEl = document.querySelector("#bird-title");
const eyebrowEl = document.querySelector("#bird-eyebrow");
const subtitleEl = document.querySelector("#bird-subtitle");
const buttons = document.querySelectorAll(".switcher-btn");

function showBird(i) {
  if (i === activeIndex) return;
  const prev = birds[activeIndex];
  const next = birds[i];
  activeIndex = i;

  // Update the hero text + which button looks active.
  eyebrowEl.textContent = `No. 0${i + 1} — ${next.latin}`;
  titleEl.textContent = next.name;
  subtitleEl.textContent = next.blurb;
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
    scrollRotation = self.progress * Math.PI * 4; // 2 full turns over the page
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
function animate() {
  requestAnimationFrame(animate);

  const bird = birds[activeIndex];
  const active = bird.model;
  if (active) {
    // Spin: open at a 3/4 (45°) view, then turn with scroll.
    active.rotation.y = Math.PI / 4 + scrollRotation;

    // How wide the view is in 3D units, so the slide scales to the screen.
    const halfW =
      Math.tan(((camera.fov / 2) * Math.PI) / 180) *
      camera.position.z *
      camera.aspect;
    const sideMag = Math.min(2.8, halfW * 0.55);

    // Slide to the EMPTY side (opposite the text): right → left → right
    // as you move through the left / right / center panels.
    active.position.x = bird.basePos.x + Math.cos(scrollProgress * Math.PI * 2) * sideMag;
    // Gentle zoom in/out by moving toward / away from the camera.
    active.position.z = bird.basePos.z + Math.sin(scrollProgress * Math.PI * 2) * 0.7;
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
});

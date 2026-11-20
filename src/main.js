import '@fontsource-variable/manrope';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import './style.css';

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createTextures } from './lib/textures.js';
import { createWorld, TIME_PRESET_ORDER } from './world.js';
import { ROADS } from './lib/roads.js';
import { Taxi } from './taxi.js';
import { createRouteGuide, createDestinationMarker, pathLength } from './navigation.js';
import { GameAudio } from './audio.js';
import { UI } from './ui.js';
import { RIDES, LOCATIONS, passengerNames, fullPassengerNames, rideTitle } from './jobs.js';

const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;

// ---------------------------------------------------------------- renderer
const container = $('scene');
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 820 ? 1.45 : 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('aria-label', 'A 3D golden-hour drive through Soest');
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.12, 3000);

const textures = createTextures();
const world = await createWorld(scene, renderer, textures);
const taxi = new Taxi(scene, world);
const routeGuide = createRouteGuide(scene);
const marker = createDestinationMarker(scene);

// ---------------------------------------------------------------- postprocessing
const composer = new EffectComposer(renderer);
if (composer.renderTarget1) composer.renderTarget1.samples = 4;
if (composer.renderTarget2) composer.renderTarget2.samples = 4;
const renderPass = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.48,
  0.7,
  0.8,
);
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignette: { value: 0.44 },
    saturation: { value: 1.055 },
    warmth: { value: 0.018 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float vignette;
    uniform float saturation;
    uniform float warmth;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
      color.rgb = mix(vec3(luma), color.rgb, saturation);
      color.rgb *= vec3(1.0 + warmth, 1.0, 1.0 - warmth * 1.4);
      float d = distance(vUv, vec2(0.5));
      float v = smoothstep(0.88, 0.22, d);
      color.rgb *= mix(1.0 - vignette, 1.0, v);
      gl_FragColor = color;
    }
  `,
};
const gradePass = new ShaderPass(GradeShader);
composer.addPass(renderPass);
composer.addPass(bloomPass);
composer.addPass(gradePass);
composer.addPass(new OutputPass());
composer.bloomPass = bloomPass;
world.composer = composer;

// ---------------------------------------------------------------- minimap
const miniCanvas = document.createElement('canvas');
miniCanvas.width = 340;
miniCanvas.height = 340;
miniCanvas.style.width = '100%';
miniCanvas.style.height = '100%';
$('minimapCanvas').appendChild(miniCanvas);
const mctx = miniCanvas.getContext('2d');
const MINI_SCALE = 1.38;
let miniFrame = 0;

const miniPatches = [
  { type: 'park', x: -232, z: 10, rx: 46, rz: 40 },
  { type: 'park', x: 120, z: 125, rx: 60, rz: 50 },
  { type: 'sand', x: 420, z: 20, rx: 160, rz: 250 },
  { type: 'water', x: -232, z: 10, rx: 28, rz: 19 },
  { type: 'plaza', x: 0, z: 0, rx: 58, rz: 58 },
  { type: 'park', x: -240, z: -232, rx: 60, rz: 55 },
];

function drawMinimap() {
  const w = 340;
  const h = 340;
  const cx = w / 2;
  const cy = h / 2;
  const px = taxi.position.x;
  const pz = taxi.position.z;
  const sx = (x) => cx + (x - px) * MINI_SCALE;
  const sy = (z) => cy + (z - pz) * MINI_SCALE;

  mctx.clearRect(0, 0, w, h);
  mctx.save();
  mctx.beginPath();
  mctx.arc(cx, cy, 168, 0, Math.PI * 2);
  mctx.clip();

  const bg = mctx.createRadialGradient(cx, cy, 30, cx, cy, 175);
  bg.addColorStop(0, '#b5c198');
  bg.addColorStop(1, '#8c9d77');
  mctx.fillStyle = bg;
  mctx.fillRect(0, 0, w, h);

  for (const patch of miniPatches) {
    mctx.beginPath();
    if (patch.type === 'plaza') {
      mctx.fillStyle = 'rgba(218, 200, 166, 0.78)';
      mctx.roundRect(sx(patch.x - patch.rx), sy(patch.z - patch.rz), patch.rx * 2 * MINI_SCALE, patch.rz * 2 * MINI_SCALE, 4);
    } else {
      if (patch.type === 'water') mctx.fillStyle = 'rgba(101, 155, 152, 0.9)';
      else if (patch.type === 'sand') mctx.fillStyle = 'rgba(221, 190, 133, 0.62)';
      else mctx.fillStyle = 'rgba(137, 159, 111, 0.72)';
      mctx.ellipse(sx(patch.x), sy(patch.z), patch.rx * MINI_SCALE, patch.rz * MINI_SCALE, 0, 0, Math.PI * 2);
    }
    mctx.fill();
  }

  mctx.lineCap = 'round';
  mctx.lineJoin = 'round';
  for (const road of ROADS) {
    if (!road.points || road.points.length < 2) continue;
    for (let i = 1; i < road.points.length; i++) {
      const [ax, az] = road.points[i - 1];
      const [bx, bz] = road.points[i];
      // only draw when the segment is anywhere near the visible circle
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      if (Math.abs(mx - px) > 220 && Math.abs(mz - pz) > 220) continue;
      mctx.strokeStyle = 'rgba(119, 108, 84, 0.42)';
      mctx.lineWidth = (road.width + 4.5) * MINI_SCALE;
      mctx.beginPath();
      mctx.moveTo(sx(ax), sy(az));
      mctx.lineTo(sx(bx), sy(bz));
      mctx.stroke();
      mctx.strokeStyle = road.main ? '#f2e3c4' : '#e8d8b9';
      mctx.lineWidth = road.width * MINI_SCALE;
      mctx.beginPath();
      mctx.moveTo(sx(ax), sy(az));
      mctx.lineTo(sx(bx), sy(bz));
      mctx.stroke();
    }
  }

  // route
  const points = routeGuide.points;
  if (points && points.length > 1) {
    mctx.strokeStyle = 'rgba(111, 230, 212, 0.22)';
    mctx.lineWidth = 8;
    mctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) mctx.moveTo(sx(p.x), sy(p.z));
      else mctx.lineTo(sx(p.x), sy(p.z));
    });
    mctx.stroke();
    mctx.strokeStyle = '#79ebd6';
    mctx.lineWidth = 2.6;
    mctx.stroke();
  }

  // destination
  if (state.job && (state.job.stage === 'pickup' || state.job.stage === 'dropoff')) {
    const target = state.job.stage === 'pickup' ? state.job.pickup.pos : state.job.dropoff.pos;
    const tx = sx(target[0]);
    const tz = sy(target[1]);
    mctx.beginPath();
    mctx.arc(tx, tz, 7, 0, Math.PI * 2);
    mctx.fillStyle = 'rgba(243, 199, 107, 0.22)';
    mctx.fill();
    mctx.beginPath();
    mctx.arc(tx, tz, 3.5, 0, Math.PI * 2);
    mctx.fillStyle = state.job.stage === 'pickup' ? '#ffd781' : '#83f0dd';
    mctx.fill();
  }

  // centre ring + player arrow
  mctx.beginPath();
  mctx.arc(cx, cy, 26, 0, Math.PI * 2);
  mctx.strokeStyle = 'rgba(255, 238, 196, 0.12)';
  mctx.lineWidth = 1;
  mctx.stroke();
  mctx.save();
  mctx.translate(cx, cy);
  mctx.rotate(Math.PI - taxi.yaw);
  mctx.beginPath();
  mctx.moveTo(0, -12);
  mctx.lineTo(7.5, 8);
  mctx.lineTo(0, 4.5);
  mctx.lineTo(-7.5, 8);
  mctx.closePath();
  mctx.fillStyle = '#ffdc8b';
  mctx.fill();
  mctx.strokeStyle = 'rgba(27, 40, 34, 0.85)';
  mctx.lineWidth = 1.6;
  mctx.stroke();
  mctx.restore();

  // subtle vignette
  const vignette = mctx.createRadialGradient(cx, cy, 105, cx, cy, 170);
  vignette.addColorStop(0, 'rgba(8, 17, 14, 0)');
  vignette.addColorStop(1, 'rgba(8, 17, 14, 0.44)');
  mctx.fillStyle = vignette;
  mctx.fillRect(0, 0, w, h);

  mctx.restore();
}

// ---------------------------------------------------------------- ui + sound
const ui = new UI();
const audio = new GameAudio();
ui.setMuted(audio.muted);

const SAVE_KEY = 'dis-soest-career-v1';
const state = {
  started: false,
  paused: false,
  photo: false,
  helpOpen: false,
  helpReturnPause: false,
  cameraMode: 0,
  money: 500,
  rides: 0,
  rideIndex: 0,
  stage: 'idle',
  job: null,
  introT: 1,
  introFrom: new THREE.Vector3(),
  introMid: new THREE.Vector3(),
  introTo: new THREE.Vector3(),
  introLookFrom: new THREE.Vector3(),
  introLookTo: new THREE.Vector3(),
  shake: 0,
  nextRideAt: 0,
  routeTimer: 0,
  clockTimer: 0,
  idleTimer: 0,
  waiting: [],
  temporary: [],
  controls: { throttle: 0, brake: 0, steer: 0, handbrake: false },
  cameraFov: 58,
};

try {
  const save = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  if (save && Number.isFinite(save.money)) {
    state.money = Math.max(0, save.money);
    state.rides = Math.max(0, save.rides || 0);
    state.rideIndex = Math.max(0, save.rideIndex || 0);
  }
} catch {}
ui.setMoney(state.money, state.rides);

function saveCareer() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.money,
      rides: state.rides,
      rideIndex: state.rideIndex,
    }));
  } catch {}
}

function setTimeOfDay(name) {
  world.setTimeOfDay(name);
  ui.setTimeLabel(world.presetLabel, world.getClock());
  audio.play('click');
}
function cycleTimeOfDay() {
  const index = TIME_PRESET_ORDER.indexOf(world.timeOfDay);
  const next = TIME_PRESET_ORDER[(index + 1) % TIME_PRESET_ORDER.length];
  setTimeOfDay(next);
  ui.showToast({
    kicker: 'THE LIGHT CHANGES',
    title: world.presetLabel,
    text: next === 'night' ? 'The lamps are on. The town gets quieter.' : next === 'day' ? 'A bright afternoon over the polder.' : 'The last warm light. Just how we like it.',
    duration: 2300,
  });
}

// ---------------------------------------------------------------- camera
const menuCenter = new THREE.Vector3(-25, 0, -10);
const menuTarget = new THREE.Vector3(-58, 4, -28);
let cameraInitialised = false;

function menuCamera(elapsed) {
  const drift = Math.sin(elapsed * 0.028) * 2.2;
  const lift = Math.sin(elapsed * 0.09) * 0.7;
  camera.position.set(18 + drift, 23 + lift, 38 - drift * 0.4);
  camera.lookAt(menuTarget);
  camera.fov = THREE.MathUtils.damp(camera.fov, 55, 2, 0.016);
  camera.updateProjectionMatrix();
}

function chaseTargets() {
  const speedRatio = clamp(taxi.speedKmh / 110, 0, 1);
  const yaw = taxi.yaw;
  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  let distance = 11.2;
  let height = 5.6;
  let fov = 64 + speedRatio * 7;
  if (state.cameraMode === 1) {
    distance = 17.2;
    height = 9.6;
    fov = 57 + speedRatio * 5;
  } else if (state.cameraMode === 2) {
    distance = -0.4;
    height = 1.55;
    fov = 68 + speedRatio * 5;
  }
  const position = taxi.position.clone()
    .addScaledVector(forward, -distance)
    .addScaledVector(right, state.cameraMode === 2 ? 0.1 : 0.75)
    .add(new THREE.Vector3(0, height, 0));
  const lookTarget = taxi.position.clone()
    .addScaledVector(forward, state.cameraMode === 2 ? 14 : 5.2)
    .add(new THREE.Vector3(0, state.cameraMode === 2 ? 1.1 : 1.75, 0));
  return { position, lookTarget, fov };
}

function currentLookTarget() {
  const forward = new THREE.Vector3(Math.sin(taxi.yaw), 0, Math.cos(taxi.yaw));
  return taxi.position.clone().addScaledVector(forward, 5).add(new THREE.Vector3(0, 1.4, 0));
}

function updateCamera(dt, elapsed) {
  if (!state.started) {
    menuCamera(elapsed);
    return;
  }
  const chase = chaseTargets();
  if (state.introT < 1) {
    state.introT = Math.min(1, state.introT + dt / 2.15);
    const t = state.introT;
    const ease = t * t * (3 - 2 * t);
    const a = state.introFrom;
    const b = state.introMid;
    const c = chase.position;
    const one = 1 - ease;
    const pos = new THREE.Vector3(
      one * one * a.x + 2 * one * ease * b.x + ease * ease * c.x,
      one * one * a.y + 2 * one * ease * b.y + ease * ease * c.y,
      one * one * a.z + 2 * one * ease * b.z + ease * ease * c.z,
    );
    camera.position.copy(pos);
    const look = state.introLookFrom.clone().lerp(state.introLookTo, ease);
    camera.lookAt(look);
    camera.fov = THREE.MathUtils.lerp(46, chase.fov, ease);
    camera.updateProjectionMatrix();
    return;
  }

  const damping = 1 - Math.exp(-5.2 * dt);
  camera.position.lerp(chase.position, damping);
  if (state.shake > 0.001) {
    state.shake = Math.max(0, state.shake - dt * 1.8);
    camera.position.x += (Math.random() - 0.5) * state.shake * 0.45;
    camera.position.y += (Math.random() - 0.5) * state.shake * 0.25;
    camera.position.z += (Math.random() - 0.5) * state.shake * 0.45;
  }
  const look = currentLookTarget().lerp(chase.lookTarget, 0.35);
  camera.lookAt(look);
  camera.fov = THREE.MathUtils.damp(camera.fov, chase.fov + (state.shake * 2.4), 3.5, dt);
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- input
const keys = new Set();
const touch = { gas: false, brake: false, left: false, right: false, handbrake: false };

function buildControls() {
  const gas = keys.has('KeyW') || keys.has('ArrowUp') || touch.gas;
  const brake = keys.has('KeyS') || keys.has('ArrowDown') || touch.brake;
  const left = keys.has('KeyA') || keys.has('ArrowLeft') || touch.left;
  const right = keys.has('KeyD') || keys.has('ArrowRight') || touch.right;
  const handbrake = keys.has('Space') || touch.handbrake;
  state.controls.throttle = gas ? 1 : 0;
  state.controls.brake = brake ? 1 : 0;
  state.controls.steer = (right ? 1 : 0) - (left ? 1 : 0);
  state.controls.handbrake = handbrake;
  return state.controls;
}

function resetToRoad() {
  if (!state.started) return;
  const node = world.graph.nearestNode(taxi.position.x, taxi.position.z);
  let yaw = taxi.yaw;
  if (node && node.edges.length) {
    const edge = node.edges[0];
    yaw = Math.atan2(edge.node.x - node.x, edge.node.z - node.z);
    taxi.reset(node.x, node.z, yaw);
  } else {
    taxi.reset(20, 60, -Math.PI / 2);
  }
  state.shake = 0.3;
  ui.showToast({ kicker: 'BACK ON THE ROAD', title: 'Daar gaan we weer.', text: 'Even opnieuw ingesteld, midden in Soest.', duration: 2200 });
}

function setPaused(value) {
  if (!state.started) return;
  state.paused = value;
  ui.setPaused(value);
  if (value) {
    keys.clear();
    Object.keys(touch).forEach((k) => { touch[k] = false; });
    audio.updateEngine(0, 0, false);
  }
}

function togglePhoto() {
  if (!state.started) return;
  state.photo = !state.photo;
  ui.setPhoto(state.photo);
  if (state.photo) {
    ui.hideDialogue();
  }
}

function openHelp(fromPause = false) {
  state.helpReturnPause = fromPause || state.paused;
  state.helpOpen = true;
  if (state.started) {
    state.paused = true;
    ui.setPaused(false);
  }
  ui.setHelp(true);
  keys.clear();
}
function closeHelp() {
  state.helpOpen = false;
  ui.setHelp(false);
  if (state.helpReturnPause && state.started) {
    state.paused = true;
    ui.setPaused(true);
  } else if (state.started) {
    state.paused = false;
    ui.setPaused(false);
  }
  state.helpReturnPause = false;
}

window.addEventListener('keydown', (event) => {
  const code = event.code;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) event.preventDefault();
  keys.add(code);
  if (event.repeat) return;
  if (code === 'Escape') {
    if (state.helpOpen) closeHelp();
    else if (state.started) setPaused(!state.paused);
  } else if (code === 'KeyM') {
    const muted = audio.toggleMuted();
    ui.setMuted(muted);
  } else if (code === 'KeyT') {
    cycleTimeOfDay();
  } else if (code === 'KeyC' && state.started) {
    state.cameraMode = (state.cameraMode + 1) % 3;
    ui.showToast({
      kicker: 'CAMERA',
      title: ['Chase view', 'Postcard view', 'Bonnet view'][state.cameraMode],
      text: ['The classic Soest angle.', 'A little further back, a little more town.', 'Eyes on the road.'][state.cameraMode],
      duration: 1600,
    });
  } else if (code === 'KeyP' && state.started) {
    togglePhoto();
  } else if (code === 'KeyR' && state.started) {
    resetToRoad();
  } else if (code === 'KeyH' && state.started) {
    audio.play('horn');
  }
});
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => {
  keys.clear();
  Object.keys(touch).forEach((k) => { touch[k] = false; });
});

// touch buttons
document.querySelectorAll('[data-touch]').forEach((button) => {
  const action = button.dataset.touch;
  const set = (value) => {
    if (action === 'gas') touch.gas = value;
    if (action === 'brake') touch.brake = value;
    if (action === 'left') touch.left = value;
    if (action === 'right') touch.right = value;
    if (action === 'handbrake') touch.handbrake = value;
  };
  button.addEventListener('pointerdown', (e) => { e.preventDefault(); button.setPointerCapture?.(e.pointerId); set(true); });
  const release = () => set(false);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
});

document.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) audio.play('click');
});

function startGame() {
  if (state.started) return;
  audio.start();
  state.started = true;
  state.paused = false;
  state.introT = 0;
  state.introFrom.copy(camera.position);
  const firstChase = chaseTargets();
  state.introTo.copy(firstChase.position);
  state.introMid.copy(state.introFrom).add(firstChase.position).multiplyScalar(0.5);
  state.introMid.y = Math.max(state.introFrom.y, firstChase.position.y) + 34;
  state.introLookFrom.copy(menuTarget);
  state.introLookTo.copy(firstChase.lookTarget);
  taxi.reset(20, 60, -Math.PI / 2);
  ui.enterGame();
  ui.setMoney(state.money, state.rides);
  ui.setTimeLabel(world.presetLabel, world.getClock());
  ui.setMission({ kicker: 'PICKUP', distance: '—', title: 'Golden hour', passenger: 'Zoeken…', fare: '—', hint: 'Ease up to the kerb', progress: 0 });
  state.stage = 'idle';
  state.nextRideAt = 0;
  setTimeout(() => startNextRide(), 1200);
  setTimeout(() => ui.showDialogue({ name: 'Dispatch', text: 'Welkom terug in Soest. De eerste klant staat al te wachten.', duration: 4600 }), 2400);
}

// ---------------------------------------------------------------- ride logic
const passengerCoats = {};

function makeWaitingPassengers(job) {
  const ride = job.ride;
  const pickup = job.pickup;
  const markerPos = new THREE.Vector3(pickup.pos[0], 0, pickup.pos[1]);
  const waitPos = new THREE.Vector3(pickup.wait[0], 0, pickup.wait[1]);
  const outward = waitPos.clone().sub(markerPos).setY(0);
  if (outward.lengthSq() < 0.01) outward.set(1, 0, 0);
  outward.normalize();
  const tangent = new THREE.Vector3(-outward.z, 0, outward.x);
  state.waiting = [];
  ride.passengers.forEach((passenger, i) => {
    const pos = waitPos.clone().addScaledVector(tangent, (i - (ride.passengers.length - 1) / 2) * 1.1);
    const person = world.makePerson({
      coat: passenger.coat,
      skin: passenger.skin,
      hair: passenger.hair,
      bag: i === 0,
      scale: 0.98 + (i % 2) * 0.04,
    });
    person.position.set(pos.x, 0.02, pos.z);
    person.rotation.y = Math.atan2(markerPos.x - pos.x, markerPos.z - pos.z);
    scene.add(person);
    state.waiting.push({
      group: person,
      origin: person.position.clone(),
      tangent,
      phase: Math.random() * 8,
    });
  });
  state.job.waiting = state.waiting;
}

function clearWaiting() {
  for (const w of state.waiting) scene.remove(w.group);
  state.waiting = [];
  if (state.job) state.job.waiting = [];
}

function spawnExitingPassengers(job) {
  const forward = new THREE.Vector3(Math.sin(taxi.yaw), 0, Math.cos(taxi.yaw));
  const right = new THREE.Vector3(Math.cos(taxi.yaw), 0, -Math.sin(taxi.yaw));
  job.ride.passengers.forEach((passenger, i) => {
    const person = world.makePerson({ coat: passenger.coat, skin: passenger.skin, hair: passenger.hair, scale: 0.98 });
    const start = taxi.position.clone().addScaledVector(right, 1.6).addScaledVector(forward, 0.2 + i * 0.3);
    person.position.set(start.x, 0.02, start.z);
    person.rotation.y = Math.atan2(right.x, right.z);
    scene.add(person);
    state.temporary.push({
      group: person,
      from: new THREE.Vector3(start.x, 0.02, start.z),
      to: start.clone().addScaledVector(right, 4 + i * 1.5).addScaledVector(forward, (i - 0.5) * 3),
      t: 0,
      life: 12,
      speed: 0.65,
    });
  });
}

function updateTemporaryPeople(dt) {
  for (let i = state.temporary.length - 1; i >= 0; i--) {
    const p = state.temporary[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.group);
      state.temporary.splice(i, 1);
      continue;
    }
    if (p.t < 1) {
      p.t = Math.min(1, p.t + dt * p.speed);
      const e = p.t * p.t * (3 - 2 * p.t);
      p.group.position.lerpVectors(p.from, p.to, e);
      p.group.position.y = 0.02 + Math.abs(Math.sin(p.t * 18)) * 0.03;
      p.group.rotation.y = Math.atan2(p.to.x - p.from.x, p.to.z - p.from.z);
      const swing = Math.sin(performance.now() * 0.009) * 0.3;
      p.group.userData.legL.rotation.x = swing;
      p.group.userData.legR.rotation.x = -swing;
      p.group.userData.armL.rotation.x = -swing * 0.7;
      p.group.userData.armR.rotation.x = swing * 0.7;
    }
  }
}

function spawnBoarding(job) {
  const forward = new THREE.Vector3(Math.sin(taxi.yaw), 0, Math.cos(taxi.yaw));
  const right = new THREE.Vector3(Math.cos(taxi.yaw), 0, -Math.sin(taxi.yaw));
  const door = taxi.position.clone().addScaledVector(right, 1.45).addScaledVector(forward, -0.2);
  job.boarding = {
    t: 0,
    entries: job.waiting.map((w, i) => ({
      w,
      from: w.group.position.clone(),
      to: door.clone().addScaledVector(forward, i * 0.35),
    })),
  };
  job.stage = 'boarding';
  marker.hide();
  audio.play('pickup');
  ui.showDialogue({
    name: passengerNames(job.ride),
    text: job.ride.line,
    duration: 5600,
  });
}

function updateBoarding(dt, elapsed) {
  const job = state.job;
  if (!job || job.stage !== 'boarding') return;
  job.boarding.t += dt / 1.15;
  const t = Math.min(1, job.boarding.t);
  const e = t * t * (3 - 2 * t);
  for (const entry of job.boarding.entries) {
    const p = entry.w.group;
    p.position.lerpVectors(entry.from, entry.to, e);
    p.position.y = 0.02 + Math.abs(Math.sin(t * 20)) * 0.035;
    p.rotation.y = Math.atan2(entry.to.x - entry.from.x, entry.to.z - entry.from.z);
    p.userData.legL.rotation.x = Math.sin(t * 26) * 0.45;
    p.userData.legR.rotation.x = -Math.sin(t * 26) * 0.45;
  }
  if (job.boarding.t >= 1) {
    clearWaiting();
    job.stage = 'dropoff';
    job.stageStartDist = Math.max(12, Math.hypot(taxi.position.x - job.dropoff.pos[0], taxi.position.z - job.dropoff.pos[1]));
    marker.setPosition(job.dropoff.pos[0], job.dropoff.pos[1]);
    marker.setColor(0x7de9d4);
    marker.setLabel(job.dropoff.name, 'DROP-OFF');
    marker.show();
    ui.hideRideCard();
    ui.setMission({
      kicker: 'DROPOFF',
      distance: '—',
      title: job.dropoff.name,
      passenger: fullPassengerNames(job.ride),
      fare: `€ ${job.fare}`,
      hint: 'Pull over gently at the glow',
      progress: 0,
    });
    updateRoute(job.dropoff.pos);
  }
}

function updateRoute(target) {
  if (!target) return;
  const points = world.graph.findPath(
    { x: taxi.position.x, z: taxi.position.z },
    { x: target[0], z: target[1] },
  );
  routeGuide.setPath(points);
}

function distanceTo(pos) {
  return Math.hypot(taxi.position.x - pos[0], taxi.position.z - pos[1]);
}

function bearingTo(pos) {
  const dx = pos[0] - taxi.position.x;
  const dz = pos[1] - taxi.position.z;
  const sy = Math.sin(taxi.yaw);
  const cy = Math.cos(taxi.yaw);
  const f = dx * sy + dz * cy;
  const r = dx * cy - dz * sy;
  return Math.atan2(r, f);
}

function formatDistance(m) {
  if (m < 1000) return `${Math.max(0, Math.round(m))} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function startNextRide() {
  if (!state.started) return;
  const ride = RIDES[state.rideIndex % RIDES.length];
  const pickup = LOCATIONS[ride.pickup];
  const dropoff = LOCATIONS[ride.dropoff];
  const dropPath = world.graph.findPath(
    { x: pickup.pos[0], z: pickup.pos[1] },
    { x: dropoff.pos[0], z: dropoff.pos[1] },
  );
  const routeDistance = Math.max(60, pathLength(dropPath));
  const fare = Math.round(ride.base + routeDistance * 0.033 + (ride.passengers.length - 1) * 1.4);
  state.job = {
    ride,
    pickup,
    dropoff,
    stage: 'pickup',
    fare,
    collisions: 0,
    stageStartDist: Math.max(12, distanceTo(pickup.pos)),
    startedAt: performance.now(),
    boarding: null,
  };
  state.stage = 'pickup';
  state.routeTimer = 0;
  clearWaiting();
  makeWaitingPassengers(state.job);
  marker.setPosition(pickup.pos[0], pickup.pos[1]);
  marker.setColor(0xf3c463);
  marker.setLabel(pickup.name, 'PICKUP');
  marker.show();
  updateRoute(pickup.pos);
  ui.setMission({
    kicker: 'PICKUP',
    distance: formatDistance(distanceTo(pickup.pos)),
    title: pickup.name,
    passenger: fullPassengerNames(ride),
    fare: `€ ${fare}`,
    hint: 'Ease up to the kerb to pick up',
    progress: 0,
  });
  ui.hideRideCard();
  audio.play('arrive');
  ui.setMoney(state.money, state.rides);
}

function completeRide() {
  const job = state.job;
  if (!job || job.stage !== 'dropoff') return;
  job.stage = 'complete';
  state.stage = 'complete';
  marker.hide();
  routeGuide.clear();
  const tip = job.collisions === 0 ? 2 + Math.floor(Math.random() * 4) : 0;
  state.money += job.fare + tip;
  state.rides += 1;
  state.rideIndex = (state.rideIndex + 1) % RIDES.length;
  saveCareer();
  ui.setMoney(state.money, state.rides);
  ui.showToast({
    kicker: 'RIDE COMPLETE',
    title: `+ € ${job.fare + tip}`,
    text: `${fullPassengerNames(job.ride)} stepped out at ${job.dropoff.name}.${tip ? ' A little tip for the smooth driving.' : ''}`,
    duration: 5200,
  });
  ui.setMission({
    kicker: 'FREE ROAM',
    distance: '—',
    title: 'Mooi gereden.',
    passenger: fullPassengerNames(job.ride),
    fare: `+ € ${job.fare + tip}`,
    hint: 'Next passenger in a moment',
    progress: 100,
  });
  spawnExitingPassengers(job);
  audio.play('complete');
  setTimeout(() => {
    ui.showDialogue({ name: job.ride.passengers[0].name.split(' ')[0], text: job.ride.dropLine, duration: 4200 });
  }, 900);
  state.nextRideAt = performance.now() + 6200;
}

function updateWaitingPeople(dt, elapsed) {
  for (const w of state.waiting) {
    const g = w.group;
    const d = Math.hypot(g.position.x - taxi.position.x, g.position.z - taxi.position.z);
    g.userData.body.position.y = Math.sin(elapsed * 2.2 + w.phase) * 0.01;
    g.rotation.y = Math.atan2(taxi.position.x - g.position.x, taxi.position.z - g.position.z);
    if (state.job?.stage === 'pickup' && d < 40) {
      g.userData.armR.rotation.z = -2.05 + Math.sin(elapsed * 4 + w.phase) * 0.22;
      g.userData.armR.rotation.x = 0;
    } else {
      g.userData.armR.rotation.z = 0;
      g.userData.armR.rotation.x = Math.sin(elapsed * 2 + w.phase) * 0.12;
    }
  }
}

function updateRide(dt, elapsed) {
  const job = state.job;
  if (!job) return;
  updateWaitingPeople(dt, elapsed);
  updateBoarding(dt, elapsed);
  updateTemporaryPeople(dt);

  if (job.stage === 'pickup' || job.stage === 'dropoff') {
    const target = job.stage === 'pickup' ? job.pickup.pos : job.dropoff.pos;
    const dist = distanceTo(target);
    const speedKmh = taxi.speedKmh;
    const progress = clamp(100 - (dist / Math.max(job.stageStartDist, 10)) * 100, 0, 100);
    let hint = job.stage === 'pickup' ? 'Ease up to the kerb to pick up' : 'Pull over gently at the glow';
    if (dist < 34 && speedKmh > 14) hint = job.stage === 'pickup' ? 'Slow down — they are waving' : 'Nearly there — slow down';
    else if (dist < 34) hint = job.stage === 'pickup' ? 'Stop beside the glow' : 'Stop here to let them out';
    ui.setBearing(bearingTo(target));
    ui.setMission({
      distance: formatDistance(dist),
      hint,
      progress,
    });

    if (dist < 10.5 && speedKmh < 14) {
      if (job.stage === 'pickup') spawnBoarding(job);
      else completeRide();
    }

    state.routeTimer += dt;
    if (state.routeTimer > 3.4) {
      state.routeTimer = 0;
      updateRoute(target);
    }
  } else if (job.stage === 'complete' && performance.now() > state.nextRideAt) {
    startNextRide();
  } else if (job.stage === 'complete') {
    const remaining = Math.max(0, Math.ceil((state.nextRideAt - performance.now()) / 1000));
    ui.setMission({ hint: remaining > 0 ? `Next passenger in ${remaining}s` : 'Next passenger is waiting' });
  }
}

// ---------------------------------------------------------------- button wiring
$('startBtn').addEventListener('click', startGame);
$('helpBtn').addEventListener('click', () => openHelp(false));
$('helpCloseBtn').addEventListener('click', closeHelp);
$('helpDoneBtn').addEventListener('click', closeHelp);
$('pauseHelpBtn').addEventListener('click', () => openHelp(true));
$('resumeBtn').addEventListener('click', () => setPaused(false));
$('pauseBtn').addEventListener('click', () => setPaused(!state.paused));
$('timeBtn').addEventListener('click', cycleTimeOfDay);
$('pauseTimeBtn').addEventListener('click', cycleTimeOfDay);
$('cameraBtn').addEventListener('click', () => {
  state.cameraMode = (state.cameraMode + 1) % 3;
  ui.showToast({ kicker: 'CAMERA', title: ['Chase view', 'Postcard view', 'Bonnet view'][state.cameraMode], text: 'Press C to cycle.', duration: 1300 });
});
$('photoBtn').addEventListener('click', togglePhoto);
$('soundBtn').addEventListener('click', () => { const muted = audio.toggleMuted(); ui.setMuted(muted); });
$('pauseSoundBtn').addEventListener('click', () => { const muted = audio.toggleMuted(); ui.setMuted(muted); });
$('pauseResetBtn').addEventListener('click', () => {
  state.money = 500;
  state.rides = 0;
  state.rideIndex = 0;
  state.stage = 'idle';
  state.job = null;
  clearWaiting();
  routeGuide.clear();
  marker.hide();
  saveCareer();
  ui.setMoney(state.money, state.rides);
  taxi.reset(20, 60, -Math.PI / 2);
  setPaused(false);
  startNextRide();
  ui.showToast({ kicker: 'NEW SHIFT', title: 'A fresh meter.', text: 'The afternoon is yours again.', duration: 3000 });
});
$('pauseModal').addEventListener('pointerdown', (e) => {
  if (e.target === $('pauseModal')) setPaused(false);
});
$('helpModal').addEventListener('pointerdown', (e) => {
  if (e.target === $('helpModal')) closeHelp();
});

// ---------------------------------------------------------------- collision feedback
taxi.onImpact = (speed) => {
  state.shake = Math.min(0.8, 0.15 + speed / 18);
  audio.play('bump');
  if (state.job && (state.job.stage === 'pickup' || state.job.stage === 'dropoff')) state.job.collisions += 1;
  if (speed > 9 && Math.random() < 0.35) {
    ui.showDialogue({ name: 'You', text: 'Easy. Soest is not going anywhere.', duration: 1800 });
  }
};

// ---------------------------------------------------------------- resize
function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, width < 820 ? 1.45 : 1.8);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  composer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  routeGuide.setResolution(width, height);
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- game loop
const clock = new THREE.Clock();
let elapsed = 0;
let firstFrame = true;

function animate() {
  requestAnimationFrame(animate);
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.05);
  elapsed += dt;

  if (!state.paused) {
    const focus = state.started ? taxi.position : menuCenter;
    world.update(dt, elapsed, focus);
    taxi.setHeadlights(world.headlightsOn);
    if (state.started) {
      const controls = buildControls();
      const info = taxi.update(dt, controls, world);
      audio.updateEngine(taxi.speedKmh, controls.throttle, !info.onRoad);
      updateRide(dt, elapsed);
      routeGuide.update(dt);
      marker.update(dt, taxi.position);
      ui.setSpeed(taxi.speedKmh, taxi.speed < -0.5 ? 'R' : taxi.speedKmh < 1 ? 'N' : 'D', info.onRoad ? 'ASPHALT' : 'GRASS');
      state.idleTimer += dt;
      if (state.idleTimer > 18) document.body.classList.add('idle');
      else document.body.classList.remove('idle');
      if (state.idleTimer > 25) state.idleTimer = 0;
    } else {
      routeGuide.update(dt);
      marker.update(dt, taxi.position);
    }
    updateCamera(dt, elapsed);

    state.clockTimer += dt;
    if (state.clockTimer > 0.75) {
      state.clockTimer = 0;
      ui.setTimeLabel(world.presetLabel, world.getClock());
    }
    if (firstFrame) {
      firstFrame = false;
      ui.loadingDone();
    }
  }

  composer.render();

  if (state.started && !state.photo) {
    miniFrame++;
    if (miniFrame % 3 === 0) drawMinimap();
  }
}

// warm the shaders before the first visible frame
window.__DEBUG_SCENE = scene;
window.__DEBUG = { scene, camera, world, taxi, state, routeGuide, marker };
renderer.compile(scene, camera);
ui.setTimeLabel(world.presetLabel, world.getClock());
ui.setMuted(audio.muted);
ui.setMoney(state.money, state.rides);
menuCamera(0);
window.addEventListener('beforeunload', saveCareer);
animate();

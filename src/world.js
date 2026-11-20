import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  mulberry32,
  makeCanvasTexture,
  makeSignTexture,
  makeLabelTexture,
  makeRadialTexture,
  makeBeamTexture,
} from './lib/textures.js';
import {
  ROADS,
  buildRoads,
  addRoadMarkings,
  addCrosswalks,
  isOnRoadNetwork,
} from './lib/roads.js';

const NORTH = -1;

const PRESETS = {
  golden: {
    label: 'GOLDEN HOUR',
    clock: '19:12',
    skyTop: 0x31639c,
    skyHorizon: 0xffc384,
    skyGround: 0x7c6a4f,
    sunColor: 0xffd09a,
    sunIntensity: 4.15,
    sunElevation: 14,
    sunAzimuth: 20,
    hemiSky: 0xbfdbe8,
    hemiGround: 0x7a6a4d,
    hemiIntensity: 1.34,
    fogColor: 0xe1c09c,
    fogNear: 220,
    fogFar: 1400,
    cloudColor: 0xffe3ce,
    exposure: 1.14,
    bloom: 0.38,
    starOpacity: 0,
    moonOpacity: 0,
    windowGlow: 0.13,
    lampGlow: 0.3,
    headlights: false,
    cityGlow: 0.12,
  },
  day: {
    label: 'LATE AFTERNOON',
    clock: '15:46',
    skyTop: 0x4e8fd0,
    skyHorizon: 0xcddfe4,
    skyGround: 0x8b9471,
    sunColor: 0xfff3dc,
    sunIntensity: 3.15,
    sunElevation: 47,
    sunAzimuth: -118,
    hemiSky: 0xc3e1ea,
    hemiGround: 0x7f7c5a,
    hemiIntensity: 0.95,
    fogColor: 0xcfdce0,
    fogNear: 180,
    fogFar: 950,
    cloudColor: 0xfff8ee,
    exposure: 0.93,
    bloom: 0.18,
    starOpacity: 0,
    moonOpacity: 0,
    windowGlow: 0,
    lampGlow: 0,
    headlights: false,
    cityGlow: 0,
  },
  night: {
    label: 'SOEST AFTER DARK',
    clock: '23:08',
    skyTop: 0x060d1d,
    skyHorizon: 0x1b3450,
    skyGround: 0x0b1317,
    sunColor: 0x8ba8dc,
    sunIntensity: 0.52,
    sunElevation: -16,
    sunAzimuth: -70,
    hemiSky: 0x263d60,
    hemiGround: 0x0d1312,
    hemiIntensity: 0.22,
    fogColor: 0x0d1b29,
    fogNear: 90,
    fogFar: 620,
    cloudColor: 0x27344a,
    exposure: 1.12,
    bloom: 0.6,
    starOpacity: 0.95,
    moonOpacity: 1,
    windowGlow: 0.9,
    lampGlow: 1,
    headlights: true,
    cityGlow: 0.3,
  },
};

const SHOP_NAMES = [
  ['BAKKERIJ', 'fresh bread · soest'],
  ['CAFÉ DE BRINK', 'koffie & appeltaart'],
  ['BLOEMEN', 'verse tulpen'],
  ['KAAS & ZO', 'sinds 1924'],
  ['BOEKHANDEL', 'verhalen uit de regio'],
  ['FIETSEN', 'reparatie & verhuur'],
  ['VIS & VLA', 'dagverse waar'],
  ['SOEST TAXI', 'altijd op tijd'],
  ['DE WINDHOND', 'lunch · terras'],
  ['KOFFIEHUIS', 'langzaam opwarmen'],
  ['BAKKERIJ', 'vers uit de oven'],
  ['GALERIE', 'kunst & keramiek'],
];

function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function makeGableRoofGeometry(width, depth, height, overhang = 0.55) {
  const w = width * 0.5 + overhang;
  const d = depth * 0.5 + overhang;
  const positions = [];
  const uvs = [];
  const push = (x, y, z, u, v) => {
    positions.push(x, y, z);
    uvs.push(u, v);
  };

  const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, u0, v0, u1, v1) => {
    push(ax, ay, az, u0, v0);
    push(bx, by, bz, u1, v0);
    push(cx, cy, cz, u1, v1);
    push(ax, ay, az, u0, v0);
    push(cx, cy, cz, u1, v1);
    push(dx, dy, dz, u0, v1);
  };

  quad(-w, 0, d, w, 0, d, w, height, 0, -w, height, 0, 0, 0, 1, 1);
  quad(w, 0, -d, -w, 0, -d, -w, height, 0, w, height, 0, 0, 0, 1, 1);

  push(w, 0, d, 0, 0);
  push(w, 0, -d, 1, 0);
  push(w, height, 0, 0.5, 1);

  push(-w, 0, -d, 0, 0);
  push(-w, 0, d, 1, 0);
  push(-w, height, 0, 0.5, 1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

function makeHipRoofGeometry(width, depth, height, overhang = 0.5) {
  const w = width * 0.5 + overhang;
  const d = depth * 0.5 + overhang;
  const positions = [];
  const uvs = [];
  const v = [
    [-w, 0, d], [w, 0, d], [w, 0, -d], [-w, 0, -d],
    [-w * 0.55, height, 0], [w * 0.55, height, 0],
  ];
  const faces = [
    [0, 1, 5, 4], [2, 3, 4, 5], [1, 2, 5], [3, 0, 4],
  ];
  for (const face of faces) {
    const a = v[face[0]];
    const b = v[face[1]];
    const c = v[face[2]];
    positions.push(...a, ...b, ...c);
    uvs.push(0, 0, 1, 0, 1, 1);
    if (face.length === 4) {
      const dd = v[face[3]];
      positions.push(...a, ...c, ...dd);
      uvs.push(0, 0, 1, 1, 0, 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

function makeClockTexture() {
  return makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f2e9d4';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#26332f';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = '#26332f';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.lineWidth = i % 3 === 0 ? 6 : 3;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(a) * 82, h / 2 + Math.sin(a) * 82);
      ctx.lineTo(w / 2 + Math.cos(a) * 102, h / 2 + Math.sin(a) * 102);
      ctx.stroke();
    }
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2);
    ctx.lineTo(w / 2 - 26, h / 2 - 50);
    ctx.moveTo(w / 2, h / 2);
    ctx.lineTo(w / 2 + 42, h / 2 - 24);
    ctx.stroke();
    ctx.fillStyle = '#c68e35';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 7, 0, Math.PI * 2);
    ctx.fill();
  });
}

export async function createWorld(scene, renderer, textures) {
  const rng = mulberry32(8044);
  const colliders = [];
  const pavedRects = [];
  const updates = [];
  const nightMaterials = [];
  const world = {};

  const rand = (a = 0, b = 1) => a + (b - a) * rng();
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  const addBoxCollider = (x, z, w, d, rot = 0, kind = 'building') => {
    const swap = Math.abs(Math.sin(rot)) > 0.5;
    colliders.push({ type: 'box', x, z, hw: (swap ? d : w) * 0.5, hd: (swap ? w : d) * 0.5, kind });
  };
  const addCircleCollider = (x, z, r, kind = 'prop') => {
    colliders.push({ type: 'circle', x, z, r, kind });
  };

  // ---------------------------------------------------------------- materials
  const wallMats = [
    new THREE.MeshStandardMaterial({ map: textures.brick, color: 0xc98664, roughness: 0.92 }),
    new THREE.MeshStandardMaterial({ map: textures.brick, color: 0xd5a06f, roughness: 0.92 }),
    new THREE.MeshStandardMaterial({ map: textures.brick, color: 0xb36d54, roughness: 0.92 }),
    new THREE.MeshStandardMaterial({ map: textures.plaster, color: 0xf0e6cf, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: textures.plaster, color: 0xdadfc3, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: textures.plaster, color: 0xe7cba4, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: textures.brick, color: 0x9f7c67, roughness: 0.94 }),
    new THREE.MeshStandardMaterial({ map: textures.plaster, color: 0xc9d2bd, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: textures.plaster, color: 0xe1c3ae, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: textures.plaster, color: 0xc9d3d6, roughness: 0.9 }),
  ];
  const roofMats = [
    new THREE.MeshStandardMaterial({ map: textures.roof, color: 0x5e605a, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: textures.roof, color: 0x8b5141, roughness: 0.92 }),
    new THREE.MeshStandardMaterial({ map: textures.roof, color: 0x4e5b52, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: textures.roof, color: 0x6c5c4f, roughness: 0.92 }),
  ];
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf1e6cf, roughness: 0.78 });
  const darkTrimMat = new THREE.MeshStandardMaterial({ color: 0x2e3b36, roughness: 0.8 });
  const brickMat = new THREE.MeshStandardMaterial({ map: textures.brick, color: 0x9b6953, roughness: 0.92 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4c34, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, flatShading: true });
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x4a704c, roughness: 0.98, flatShading: true });
  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x466144, roughness: 1 });
  const pathMat = new THREE.MeshStandardMaterial({ map: textures.paving, color: 0xd3cab6, roughness: 0.95 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xc7beab, roughness: 0.9 });
  const whiteStoneMat = new THREE.MeshStandardMaterial({ color: 0xe8e0cc, roughness: 0.8 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x3e4a46, roughness: 0.55, metalness: 0.45 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a64c, roughness: 0.4, metalness: 0.55 });
  const waterMat = new THREE.MeshStandardMaterial({
    map: textures.water,
    color: 0x6e9d9c,
    roughness: 0.18,
    metalness: 0.12,
    transparent: true,
    opacity: 0.9,
  });
  const grassMat = new THREE.MeshStandardMaterial({ map: textures.grass, color: 0xe4e6c6, roughness: 1 });
  const sandMat = new THREE.MeshStandardMaterial({ map: textures.sand, color: 0xffffff, roughness: 1, flatShading: true });
  const pavingMat = new THREE.MeshStandardMaterial({ map: textures.paving, color: 0xc7beac, roughness: 0.96 });
  const cobbleMat = new THREE.MeshStandardMaterial({ map: textures.cobble, color: 0xc5b9a3, roughness: 0.96 });
  const shopWindowMat = new THREE.MeshBasicMaterial({ map: textures.shopWindow, toneMapped: false });
  const windowMat = new THREE.MeshBasicMaterial({ map: textures.window, toneMapped: false });
  const litWindowMat = new THREE.MeshBasicMaterial({
    map: textures.litWindow,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const doorMat = new THREE.MeshStandardMaterial({ map: textures.door, roughness: 0.8 });
  const awningMat = new THREE.MeshStandardMaterial({ map: textures.awningStripe, roughness: 0.9, side: THREE.DoubleSide });

  // ---------------------------------------------------------------- sky
  const skyUniforms = {
    topColor: { value: new THREE.Color(PRESETS.golden.skyTop) },
    horizonColor: { value: new THREE.Color(PRESETS.golden.skyHorizon) },
    groundColor: { value: new THREE.Color(PRESETS.golden.skyGround) },
    sunColor: { value: new THREE.Color(PRESETS.golden.sunColor) },
    sunDir: { value: new THREE.Vector3(-0.9, 0.18, 0.3) },
    moonDir: { value: new THREE.Vector3(0.5, 0.5, -0.5) },
    sunStrength: { value: 1 },
    starStrength: { value: 0 },
    moonStrength: { value: 0 },
    time: { value: 0 },
  };

  const skyGeo = new THREE.SphereGeometry(2300, 40, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: skyUniforms,
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPosition = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPosition;
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 groundColor;
      uniform vec3 sunColor;
      uniform vec3 sunDir;
      uniform vec3 moonDir;
      uniform float sunStrength;
      uniform float starStrength;
      uniform float moonStrength;
      uniform float time;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 dir = normalize(vWorldPosition);
        float h = clamp(dir.y, 0.0, 1.0);
        float horizon = pow(1.0 - h, 5.2);
        vec3 col = mix(topColor, horizonColor, horizon);
        float lowBand = pow(1.0 - h, 18.0);
        col = mix(col, horizonColor * 1.035 + vec3(0.02, 0.008, 0.0), lowBand * 0.52);
        float below = smoothstep(0.015, -0.18, dir.y);
        col = mix(col, groundColor, below * 0.86);

        float sd = max(dot(dir, sunDir), 0.0);
        float disc = smoothstep(0.99955, 0.99985, sd);
        float glow = pow(sd, 9.0) * 0.28 + pow(sd, 90.0) * 0.55;
        col += sunColor * (glow + disc * 2.4) * sunStrength;

        float md = max(dot(dir, moonDir), 0.0);
        float moonDisc = smoothstep(0.9994, 0.99975, md);
        float moonGlow = pow(md, 80.0) * 0.7;
        col += vec3(0.74, 0.82, 1.0) * (moonDisc * 1.9 + moonGlow) * moonStrength;

        // faint milky stars, only above the horizon
        vec3 s = dir * 520.0;
        float star = smoothstep(0.9955, 1.0, hash(floor(s)));
        star += smoothstep(0.9985, 1.0, hash(floor(s * 1.17 + 7.0))) * 0.7;
        col += vec3(0.72, 0.82, 1.0) * star * starStrength * smoothstep(0.0, 0.25, dir.y) * 1.4;

        // a warm dusty band just above the horizon
        col += vec3(0.13, 0.07, 0.035) * pow(1.0 - h, 12.0) * 0.28;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  const starPositions = [];
  for (let i = 0; i < 900; i++) {
    const theta = rand(0, Math.PI * 2);
    const phi = Math.acos(rand(0.08, 1));
    const r = 2100;
    starPositions.push(
      Math.sin(phi) * Math.cos(theta) * r,
      Math.cos(phi) * r,
      Math.sin(phi) * Math.sin(theta) * r,
    );
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xdfe9ff,
    size: 2.2,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -9;
  scene.add(stars);

  const sunDirVec = new THREE.Vector3();
  const moonDirVec = new THREE.Vector3(0.35, 0.7, -0.55).normalize();

  // ---------------------------------------------------------------- lights
  const hemi = new THREE.HemisphereLight(PRESETS.golden.hemiSky, PRESETS.golden.hemiGround, PRESETS.golden.hemiIntensity);
  scene.add(hemi);

  const fill = new THREE.DirectionalLight(0xb7d3df, 0.42);
  fill.position.set(130, 80, -120);
  scene.add(fill);
  const ambient = new THREE.AmbientLight(0xffe0bd, 0.14);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(PRESETS.golden.sunColor, PRESETS.golden.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(window.innerWidth < 820 ? 1024 : 2048, window.innerWidth < 820 ? 1024 : 2048);
  sun.shadow.camera.left = -105;
  sun.shadow.camera.right = 105;
  sun.shadow.camera.top = 105;
  sun.shadow.camera.bottom = -105;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 310;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.028;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);
  scene.add(sun.target);

  scene.fog = new THREE.Fog(PRESETS.golden.fogColor, PRESETS.golden.fogNear, PRESETS.golden.fogFar);

  // ---------------------------------------------------------------- terrain
  const groundGeo = new THREE.PlaneGeometry(3000, 3000, 1, 1);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, grassMat);
  ground.position.y = -0.055;
  ground.receiveShadow = true;
  scene.add(ground);

  // Dry ditch lines that give the polder some rhythm.
  const ditchMat = new THREE.MeshStandardMaterial({ color: 0x526c5c, roughness: 0.7 });
  for (let i = 0; i < 7; i++) {
    const x = -520 + i * 150;
    const ditch = new THREE.Mesh(new THREE.PlaneGeometry(4, 620), ditchMat);
    ditch.rotation.x = -Math.PI / 2;
    ditch.position.set(x, -0.01, -440);
    ditch.receiveShadow = true;
    scene.add(ditch);
  }

  const roads = buildRoads(scene, textures);
  const graph = roads.graph;
  addRoadMarkings(scene, graph);
  addCrosswalks(scene, [
    [-60, -60, 0], [-60, 60, Math.PI / 2], [60, -60, Math.PI / 2], [60, 60, 0],
    [-180, 60, Math.PI / 2], [180, 60, Math.PI / 2],
  ], textures);

  function addGroundPatch(cx, cz, w, d, material, y = 0.008, uvScale = 1 / 7) {
    const geo = new THREE.PlaneGeometry(w, d);
    geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * w * uvScale, uv.getY(i) * d * uvScale);
    }
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(cx, y, cz);
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  function addPavedRect(x0, z0, x1, z1, material = pavingMat, y = 0.012, uvScale = 1 / 7) {
    const mesh = addGroundPatch((x0 + x1) * 0.5, (z0 + z1) * 0.5, x1 - x0, z1 - z0, material, y, uvScale);
    pavedRects.push({ x0, z0, x1, z1 });
    return mesh;
  }

  // ---------------------------------------------------------------- building queues
  const windowQueue = [];
  const litQueue = [];
  const shopWindowQueue = [];
  const doorQueue = [];
  const pathQueue = [];
  const hedgeQueue = [];
  const chimneyQueue = [];
  const awningQueue = [];
  const bandQueue = [];
  const signSpecs = [];

  const dummy = new THREE.Object3D();

  function localMatrix(x, z, rot, lx, ly, lz, yaw = 0, sx = 1, sy = 1, sz = 1) {
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rot, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(lx, ly, lz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
      new THREE.Vector3(sx, sy, sz),
    );
    return dummy.matrix.clone().multiply(local);
  }

  function queueWindow(house, lx, ly, lz, yaw, sx, sy, litChance = 0.28) {
    const m = localMatrix(house.x, house.z, house.rot, lx, ly, lz, yaw, sx, sy, 1);
    windowQueue.push({ matrix: m, color: new THREE.Color().setHSL(0.53 + rand(-0.03, 0.03), 0.06, 0.85 + rand(-0.08, 0.1)) });
    if (rng() < litChance) {
      const lm = localMatrix(house.x, house.z, house.rot, lx, ly, lz + 0.012, yaw, sx * 0.82, sy * 0.82, 1);
      litQueue.push({ matrix: lm, color: new THREE.Color().setHSL(0.09 + rand(-0.03, 0.03), 0.8, 0.66) });
    }
  }

  function addHouse(opts) {
    const {
      x, z, rot = 0, w = rand(8.5, 11.5), d = rand(7.2, 9.2), h = rand(6.3, 8.1),
      wall = pick(wallMats), roof = pick(roofMats), shop = false, floors = 2, garden = true,
      roofScale = 1, noCollider = false, detail = true,
    } = opts;
    const house = { x, z, rot, w, d, h };
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall);
    body.position.set(x, h * 0.5, z);
    body.rotation.y = rot;
    body.castShadow = true;
    body.receiveShadow = true;
    scene.add(body);

    const roofH = Math.min(4.3, d * 0.38) * roofScale;
    const roofMesh = new THREE.Mesh(makeGableRoofGeometry(w, d, roofH, 0.45), roof);
    roofMesh.position.set(x, h, z);
    roofMesh.rotation.y = rot;
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    scene.add(roofMesh);

    if (!noCollider) addBoxCollider(x, z, w + 0.3, d + 0.3, rot, 'house');

    if (detail) {
      const frontZ = d * 0.5 + 0.026;
      const floorH = (h - 0.5) / floors;
      let doorSide = rng() < 0.5 ? -1 : 1;
      if (shop) {
        const count = Math.max(2, Math.floor(w / 3.1));
        for (let i = 0; i < count; i++) {
          const lx = -w * 0.5 + (w / count) * (i + 0.5);
          const m = localMatrix(x, z, rot, lx, 1.7, frontZ, 0, (w / count) * 0.72, 1.7, 1);
          shopWindowQueue.push({ matrix: m });
          const lm = localMatrix(x, z, rot, lx, 1.7, frontZ + 0.012, 0, (w / count) * 0.6, 1.4, 1);
          litQueue.push({ matrix: lm, color: new THREE.Color(0xffba63) });
        }
        const doorX = w * 0.5 - 1.2;
        doorQueue.push({ matrix: localMatrix(x, z, rot, doorX, 1.05, frontZ, 0, 0.95, 2.05, 1) });
        for (let f = 1; f < floors; f++) {
          for (const off of [-0.27, 0.27]) {
            queueWindow(house, w * off, f * floorH + floorH * 0.46, frontZ, 0, 0.92, 1.36, 0.22);
          }
        }
      } else {
        const doorX = doorSide * w * 0.23;
        doorQueue.push({ matrix: localMatrix(x, z, rot, doorX, 1.05, frontZ, 0, 0.92, 2.05, 1) });
        const windowX = -doorSide * w * 0.22;
        queueWindow(house, windowX, 1.7, frontZ, 0, 1.02, 1.38, 0.23);
        for (let f = 1; f < floors; f++) {
          for (const off of [-0.27, 0.27]) {
            queueWindow(house, w * off, f * floorH + floorH * 0.48, frontZ, 0, 0.92, 1.38, 0.3);
          }
        }
        // one window on each side gives the little houses some depth from an angle
      }

      // side and rear windows keep the town from turning into a row of blank walls
      for (const side of [-1, 1]) {
        const sideYaw = side * Math.PI * 0.5;
        const sideX = side * (w * 0.5 + 0.026);
        for (let f = 0; f < floors; f++) {
          const y = f === 0 ? 1.72 : f * floorH + floorH * 0.47;
          queueWindow(house, sideX, y, 0, sideYaw, shop ? 0.9 : 0.8, shop ? 1.3 : 1.2, shop ? 0.2 : 0.15);
        }
      }
      for (let f = 0; f < floors; f++) {
        const y = f === 0 ? 1.72 : f * floorH + floorH * 0.47;
        const offs = w > 8.5 ? [-0.25, 0.25] : [0];
        for (const off of offs) {
          queueWindow(house, w * off, y, -d * 0.5 - 0.026, Math.PI, 0.84, 1.25, 0.18);
        }
      }
      if (shop) {
        const backWindow = localMatrix(x, z, rot, 0, 1.7, -d * 0.5 - 0.028, Math.PI, w * 0.5, 1.62, 1);
        shopWindowQueue.push({ matrix: backWindow });
        litQueue.push({ matrix: localMatrix(x, z, rot, 0, 1.7, -d * 0.5 - 0.036, Math.PI, w * 0.42, 1.36, 1), color: new THREE.Color(0xffb35c) });
        doorQueue.push({ matrix: localMatrix(x, z, rot, w * 0.3, 1.05, -d * 0.5 - 0.03, Math.PI, 0.92, 2.05, 1) });
      }

      if (shop) {
        for (const side of [-1, 1]) {
          const sideYaw = side * Math.PI * 0.5;
          const sideX = side * (w * 0.5 + 0.03);
          const shopSide = localMatrix(x, z, rot, sideX, 1.7, 0, sideYaw, Math.min(d * 0.58, 4.2), 1.62, 1);
          shopWindowQueue.push({ matrix: shopSide });
          litQueue.push({
            matrix: localMatrix(x, z, rot, sideX + Math.sin(sideYaw) * 0.008, 1.7, 0, sideYaw, Math.min(d * 0.49, 3.5), 1.36, 1),
            color: new THREE.Color(0xffb45d),
          });
        }
      }

      // slim stone bands break up the larger walls and pick up the sunset light
      for (let f = 1; f < floors; f++) {
        bandQueue.push({ matrix: localMatrix(x, z, rot, 0, f * floorH, 0, 0, w + 0.2, 0.1, d + 0.2) });
      }
      bandQueue.push({ matrix: localMatrix(x, z, rot, 0, 0.24, 0, 0, w + 0.18, 0.12, d + 0.18) });
      bandQueue.push({ matrix: localMatrix(x, z, rot, 0, h - 0.2, 0, 0, w + 0.3, 0.16, d + 0.3) });

      if (garden) {
        pathQueue.push({ matrix: localMatrix(x, z, rot, shop ? w * 0.5 - 1.2 : doorSide * w * 0.23, 0.045, d * 0.5 + 2.15, 0, 1.05, 4.2, 1) });
        if (!shop) {
          hedgeQueue.push({ matrix: localMatrix(x, z, rot, -w * 0.22, 0.29, d * 0.5 + 2.2, 0, w * 0.54, 0.52, 0.44) });
          hedgeQueue.push({ matrix: localMatrix(x, z, rot, w * 0.32, 0.29, d * 0.5 + 2.2, 0, w * 0.34, 0.52, 0.44) });
        }
      }

      if (rng() < 0.7) {
        chimneyQueue.push({ matrix: localMatrix(x, z, rot, w * rand(-0.26, 0.26), h + roofH * 0.68, rand(-0.15, 0.15), 0, 0.55, roofH * 1.05, 0.55) });
      }

      if (shop && rng() < 0.56) {
        awningQueue.push({ x, z, rot, width: w * 0.88, front: frontZ });
      }
    }

    return house;
  }

  // ---------------------------------------------------------------- instanced finish helper
  function buildInstances() {
    const makeInstanced = (queue, geometry, material, { shadows = false, colors = true } = {}) => {
      if (!queue.length) return null;
      const mesh = new THREE.InstancedMesh(geometry, material, queue.length);
      queue.forEach((entry, i) => {
        mesh.setMatrixAt(i, entry.matrix);
        if (colors && entry.color) mesh.setColorAt(i, entry.color);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = shadows;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      return mesh;
    };

    const plane = new THREE.PlaneGeometry(1, 1);
    const flatPlane = new THREE.PlaneGeometry(1, 1);
    flatPlane.rotateX(-Math.PI / 2);
    const box = new THREE.BoxGeometry(1, 1, 1);

    makeInstanced(windowQueue, plane, windowMat);
    const lit = makeInstanced(litQueue, plane, litWindowMat);
    makeInstanced(shopWindowQueue, plane, shopWindowMat);
    makeInstanced(doorQueue, plane, doorMat);
    makeInstanced(pathQueue, flatPlane, pathMat);
    makeInstanced(hedgeQueue, box, hedgeMat, { shadows: true, colors: false });
    makeInstanced(chimneyQueue, box, brickMat, { shadows: true, colors: false });
    makeInstanced(bandQueue, box, trimMat, { shadows: false, colors: false });

    // awnings
    for (const a of awningQueue) {
      const geo = new THREE.BoxGeometry(a.width, 0.08, 1.5);
      const mesh = new THREE.Mesh(geo, awningMat);
      mesh.rotation.set(-0.22, a.rot, 0, 'YXZ');
      mesh.position.set(
        a.x + Math.sin(a.rot) * (a.front + 0.65),
        3.05,
        a.z + Math.cos(a.rot) * (a.front + 0.65),
      );
      mesh.castShadow = true;
      scene.add(mesh);
      const valance = new THREE.Mesh(new THREE.BoxGeometry(a.width, 0.22, 0.06), awningMat);
      valance.rotation.y = a.rot;
      valance.position.set(
        a.x + Math.sin(a.rot) * (a.front + 1.35),
        2.82,
        a.z + Math.cos(a.rot) * (a.front + 1.35),
      );
      scene.add(valance);
    }

    world.litWindowMaterial = litWindowMat;
    world.litWindows = lit;
    return { windowMat, litWindowMat };
  }

  // ---------------------------------------------------------------- trees
  const treeQueue = [];
  const trunkQueue = [];
  const bushQueue = [];
  const flowerQueue = [];
  const grassTuftQueue = [];

  function addTree(x, z, scale = 1, opts = {}) {
    const height = scale * rand(2.4, 3.6);
    const hue = opts.hue ?? rand(0.28, 0.36);
    const sat = opts.saturation ?? rand(0.25, 0.4);
    const light = opts.lightness ?? rand(0.24, 0.37);
    const color = new THREE.Color().setHSL(hue, sat, light);
    trunkQueue.push({
      matrix: new THREE.Matrix4().compose(
        new THREE.Vector3(x, height * 0.5, z),
        new THREE.Quaternion(),
        new THREE.Vector3(scale, height, scale),
      ),
    });
    const blobs = opts.blobs || 2;
    for (let i = 0; i < blobs; i++) {
      const bx = x + rand(-0.8, 0.8) * scale;
      const bz = z + rand(-0.8, 0.8) * scale;
      const by = height + scale * rand(0.5, 1.8);
      const s = scale * rand(1.5, 2.5);
      treeQueue.push({
        matrix: new THREE.Matrix4().compose(
          new THREE.Vector3(bx, by, bz),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(0, 0.4), rand(0, Math.PI), rand(0, 0.4))),
          new THREE.Vector3(s, s * rand(0.72, 0.98), s),
        ),
        color,
      });
    }
    if (opts.collide !== false) addCircleCollider(x, z, 0.55 * scale, 'tree');
  }

  function addBush(x, z, scale = 1, color = bushMat.color) {
    bushQueue.push({
      matrix: new THREE.Matrix4().compose(
        new THREE.Vector3(x, scale * 0.5, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(-0.2, 0.2), rand(0, 3), rand(-0.2, 0.2))),
        new THREE.Vector3(scale * rand(0.8, 1.3), scale * rand(0.5, 0.9), scale * rand(0.8, 1.3)),
      ),
      color: new THREE.Color().setHSL(rand(0.25, 0.34), 0.3, rand(0.24, 0.34)),
    });
  }

  function addFlowers(x, z, count = 14, spread = 2.5) {
    for (let i = 0; i < count; i++) {
      const c = new THREE.Color().setHSL(pick([0.11, 0.95, 0.82, 0.0]), rand(0.55, 0.9), rand(0.52, 0.72));
      flowerQueue.push({
        matrix: new THREE.Matrix4().compose(
          new THREE.Vector3(x + rand(-spread, spread), rand(0.12, 0.32), z + rand(-spread, spread)),
          new THREE.Quaternion(),
          new THREE.Vector3(0.12, 0.12, 0.12),
        ),
        color: c,
      });
    }
  }

  function addGrassTuft(x, z, scale = 1) {
    grassTuftQueue.push({
      matrix: new THREE.Matrix4().compose(
        new THREE.Vector3(x, 0.18 * scale, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand(0, Math.PI), 0)),
        new THREE.Vector3(scale, scale, scale),
      ),
    });
  }

  function finaliseTrees() {
    const trunkGeo = new THREE.CylinderGeometry(0.11, 0.17, 1, 5);
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, trunkQueue.length);
    trunkQueue.forEach((entry, i) => trunkMesh.setMatrixAt(i, entry.matrix));
    trunkMesh.instanceMatrix.needsUpdate = true;
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    trunkMesh.frustumCulled = false;
    scene.add(trunkMesh);

    const leafGeo = new THREE.IcosahedronGeometry(1, 1);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, treeQueue.length);
    treeQueue.forEach((entry, i) => {
      leaves.setMatrixAt(i, entry.matrix);
      leaves.setColorAt(i, entry.color);
    });
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    leaves.frustumCulled = false;
    scene.add(leaves);

    const bushGeo = new THREE.IcosahedronGeometry(1, 1);
    const bushes = new THREE.InstancedMesh(bushGeo, bushMat, bushQueue.length);
    bushQueue.forEach((entry, i) => {
      bushes.setMatrixAt(i, entry.matrix);
      bushes.setColorAt(i, entry.color);
    });
    bushes.instanceMatrix.needsUpdate = true;
    if (bushes.instanceColor) bushes.instanceColor.needsUpdate = true;
    bushes.castShadow = true;
    bushes.frustumCulled = false;
    scene.add(bushes);

    if (flowerQueue.length) {
      const flowerGeo = new THREE.IcosahedronGeometry(1, 0);
      const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
      const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerQueue.length);
      flowerQueue.forEach((entry, i) => {
        flowers.setMatrixAt(i, entry.matrix);
        flowers.setColorAt(i, entry.color);
      });
      flowers.instanceMatrix.needsUpdate = true;
      if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
      flowers.frustumCulled = false;
      scene.add(flowers);
    }

    if (grassTuftQueue.length) {
      const tuftGeo = new THREE.ConeGeometry(0.5, 1, 4);
      const tuftMat = new THREE.MeshStandardMaterial({ color: 0x9da36d, roughness: 1, flatShading: true });
      const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, grassTuftQueue.length);
      grassTuftQueue.forEach((entry, i) => tufts.setMatrixAt(i, entry.matrix));
      tufts.instanceMatrix.needsUpdate = true;
      tufts.frustumCulled = false;
      scene.add(tufts);
    }
  }

  // ---------------------------------------------------------------- landmarks
  function createPalace() {
    const gx = -240;
    const gz = -232;
    const group = new THREE.Group();
    group.position.set(gx, 0, gz);
    scene.add(group);

    const palaceWhite = new THREE.MeshStandardMaterial({ color: 0xf0e9d8, roughness: 0.78 });
    const palaceShadow = new THREE.MeshStandardMaterial({ color: 0xd8cdb7, roughness: 0.82 });
    const roofMat = new THREE.MeshStandardMaterial({ map: textures.roof, color: 0x3e4642, roughness: 0.9 });

    const main = new THREE.Mesh(new THREE.BoxGeometry(58, 11, 16), palaceWhite);
    main.position.y = 5.5;
    main.castShadow = true;
    main.receiveShadow = true;
    group.add(main);

    const roof = new THREE.Mesh(makeHipRoofGeometry(60, 18, 3.8, 0.7), roofMat);
    roof.position.y = 11;
    roof.castShadow = true;
    group.add(roof);

    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(13, 9.3, 21), palaceWhite);
      wing.position.set(side * 26, 4.65, 2);
      wing.castShadow = true;
      wing.receiveShadow = true;
      group.add(wing);
      const wingRoof = new THREE.Mesh(makeHipRoofGeometry(14, 22.5, 3.1, 0.55), roofMat);
      wingRoof.position.set(side * 26, 9.3, 2);
      wingRoof.castShadow = true;
      group.add(wingRoof);
    }

    // portico and columns
    const portico = new THREE.Mesh(new THREE.BoxGeometry(22, 1.2, 5.4), palaceWhite);
    portico.position.set(0, 8.1, 9.5);
    portico.castShadow = true;
    group.add(portico);
    for (let i = 0; i < 4; i++) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 7.6, 10), palaceWhite);
      col.position.set(-7.5 + i * 5, 4.4, 11.3);
      col.castShadow = true;
      group.add(col);
    }
    const pediment = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 8.2, 3.4, 3, 1), palaceWhite);
    pediment.rotation.y = Math.PI / 2;
    pediment.scale.z = 0.48;
    pediment.position.set(0, 11.4, 9.6);
    pediment.castShadow = true;
    group.add(pediment);

    // steps
    for (let i = 0; i < 4; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(24, 0.34, 2.2 + i * 0.6), whiteStoneMat);
      step.position.set(0, 0.17 + i * 0.17, 13.5 + i * 0.9);
      step.receiveShadow = true;
      group.add(step);
    }

    // windows and gold trim
    const frontZ = 8.15;
    for (let i = 0; i < 7; i++) {
      const x = -21 + i * 7;
      for (const y of [3.4, 7.0]) {
        const m = localMatrix(gx, gz, 0, x, y, frontZ, 0, 1.2, 2.05, 1);
        windowQueue.push({ matrix: m, color: new THREE.Color(0xf6f1e4) });
        litQueue.push({ matrix: localMatrix(gx, gz, 0, x, y, frontZ + 0.01, 0, 1.05, 1.85, 1), color: new THREE.Color(0xffc06c) });
      }
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        windowQueue.push({
          matrix: localMatrix(gx, gz, 0, side * 32.6, 3.6 + i * 2.5, -4 + i * 4.6, side * Math.PI / 2, 1, 1.7, 1),
          color: new THREE.Color(0xf6f1e4),
        });
      }
    }

    const trim = new THREE.Mesh(new THREE.BoxGeometry(59, 0.38, 16.6), goldMat);
    trim.position.y = 10.5;
    group.add(trim);

    // low gravel forecourt and fountain basin
    addGroundPatch(gx, -200, 70, 46, cobbleMat, 0.014, 1 / 6);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6, 0.6, 24), whiteStoneMat);
    basin.position.set(gx, 0.3, -202);
    basin.receiveShadow = true;
    scene.add(basin);
    const basinWater = new THREE.Mesh(new THREE.CylinderGeometry(4.9, 4.9, 0.14, 24), waterMat);
    basinWater.position.set(gx, 0.55, -202);
    scene.add(basinWater);

    // palace fence and gate posts
    for (let i = 0; i < 15; i++) {
      const x = gx - 56 + i * 8;
      if (x > gx - 13 && x < gx + 13) continue;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.7, 0.28), metalMat);
      post.position.set(x, 0.85, -186);
      post.castShadow = true;
      scene.add(post);
    }
    for (const [center, width] of [[gx - 34.5, 43], [gx + 34.5, 43]]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.11, 0.11), metalMat);
      rail.position.set(center, 1.4, -186);
      rail.castShadow = true;
      scene.add(rail);
    }
    for (const side of [-1, 1]) {
      const gate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.4, 1.1), whiteStoneMat);
      gate.position.set(gx + side * 10, 1.7, -186);
      gate.castShadow = true;
      scene.add(gate);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), goldMat);
      crown.position.set(gx + side * 10, 3.7, -186);
      scene.add(crown);
    }

    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 13, 5), metalMat);
    flagPole.position.set(gx - 20, 6.5, gz + 1);
    scene.add(flagPole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 2.6),
      new THREE.MeshStandardMaterial({ color: 0xd95b48, roughness: 0.85, side: THREE.DoubleSide }),
    );
    flag.position.set(gx - 17.9, 11, gz + 1);
    flag.rotation.y = 0.2;
    scene.add(flag);
    const flagStripe = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.9), new THREE.MeshStandardMaterial({ color: 0xf3efe2, side: THREE.DoubleSide }));
    flagStripe.position.set(gx - 17.9, 10.98, gz + 1.01);
    scene.add(flagStripe);
    const flagBlue = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.9), new THREE.MeshStandardMaterial({ color: 0x315f99, side: THREE.DoubleSide }));
    flagBlue.position.set(gx - 17.9, 9.62, gz + 1.01);
    scene.add(flagBlue);
    updates.push((dt, t) => {
      flag.rotation.y = 0.2 + Math.sin(t * 1.5) * 0.14;
      flagStripe.rotation.y = flag.rotation.y;
      flagBlue.rotation.y = flag.rotation.y;
    });

    addBoxCollider(gx, gz, 62, 19, 0, 'palace');
    addBoxCollider(gx - 26, gz + 2, 14, 22, 0, 'palace');
    addBoxCollider(gx + 26, gz + 2, 14, 22, 0, 'palace');
    addCircleCollider(gx, -202, 6.2, 'fountain');

    // formal hedges and lawn trees
    for (const [x, z] of [[-286, -216], [-194, -216], [-286, -197], [-194, -197]]) addBush(x, z, 2.1);
    for (const [x, z] of [[-280, -250], [-200, -250], [-278, -225], [-202, -225]]) addTree(x, z, 1.1);
    for (let i = 0; i < 6; i++) addFlowers(-265 + i * 10, -196, 10, 1.6);
  }

  function createChurch() {
    const x = -122;
    const z = -122;
    const churchWall = new THREE.MeshStandardMaterial({ map: textures.brick, color: 0xb58a68, roughness: 0.94 });
    const churchTrim = new THREE.MeshStandardMaterial({ color: 0xe7ddc9, roughness: 0.82 });
    const churchRoof = new THREE.MeshStandardMaterial({ map: textures.roof, color: 0x454c49, roughness: 0.92 });
    const spireMat = new THREE.MeshStandardMaterial({ color: 0x374e4b, roughness: 0.75, metalness: 0.15 });

    addGroundPatch(x, z, 78, 88, cobbleMat, 0.011, 1 / 7);

    const nave = new THREE.Mesh(new THREE.BoxGeometry(15, 9.5, 30), churchWall);
    nave.position.set(x, 4.75, z + 2);
    nave.castShadow = true;
    nave.receiveShadow = true;
    scene.add(nave);
    const naveRoof = new THREE.Mesh(makeGableRoofGeometry(31, 16.4, 5.4, 0.6), churchRoof);
    naveRoof.geometry.rotateY(Math.PI / 2);
    naveRoof.position.set(x, 9.5, z + 2);
    naveRoof.castShadow = true;
    scene.add(naveRoof);

    const tower = new THREE.Mesh(new THREE.BoxGeometry(8.2, 21, 8.2), churchWall);
    tower.position.set(x, 10.5, z + 15.5);
    tower.castShadow = true;
    tower.receiveShadow = true;
    scene.add(tower);
    const towerBand = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.6, 8.6), churchTrim);
    towerBand.position.set(x, 17.8, z + 15.5);
    scene.add(towerBand);
    const belfry = new THREE.Mesh(new THREE.BoxGeometry(6.2, 4, 6.2), churchWall);
    belfry.position.set(x, 23.2, z + 15.5);
    belfry.castShadow = true;
    scene.add(belfry);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(4.3, 12, 4), spireMat);
    spire.rotation.y = Math.PI / 4;
    spire.position.set(x, 31.2, z + 15.5);
    spire.castShadow = true;
    scene.add(spire);
    const cross = new THREE.Group();
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.4, 0.18), goldMat);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.18), goldMat);
    cross.add(crossV, crossH);
    cross.position.set(x, 37.7, z + 15.5);
    scene.add(cross);

    // clock faces on all four sides
    const clockTex = makeClockTexture();
    const clockMat = new THREE.MeshBasicMaterial({ map: clockTex, toneMapped: false });
    for (let i = 0; i < 4; i++) {
      const face = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), clockMat);
      const a = i * Math.PI * 0.5;
      face.position.set(x + Math.sin(a) * 4.16, 20.1, z + 15.5 + Math.cos(a) * 4.16);
      face.rotation.y = a;
      scene.add(face);
    }

    // tall windows on the nave sides, plus a welcoming door facing the town
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        windowQueue.push({
          matrix: localMatrix(x, z, 0, side * 7.53, 5.1, -7 + i * 7, side * Math.PI / 2, 1.05, 3.0, 1),
          color: new THREE.Color(0xc8d2cf),
        });
      }
    }
    doorQueue.push({ matrix: localMatrix(x, z, 0, 0, 1.55, 19.62, 0, 2.1, 3.1, 1) });

    const path = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 38), pathMat);
    path.rotation.x = -Math.PI / 2;
    path.position.set(x, 0.02, z + 42);
    path.receiveShadow = true;
    scene.add(path);

    // graveyard headstones to the west of the nave
    const stoneGeo = new THREE.BoxGeometry(0.7, 1.1, 0.22);
    for (let i = 0; i < 15; i++) {
      const sx = x - 30 + (i % 3) * 4.6 + rand(-0.3, 0.3);
      const sz = z - 20 + Math.floor(i / 3) * 6 + rand(-0.3, 0.3);
      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.position.set(sx, 0.55, sz);
      stone.rotation.y = rand(-0.2, 0.2) + Math.PI / 2;
      stone.castShadow = true;
      scene.add(stone);
    }
    for (const [tx, tz] of [[-164, -156], [-170, -104], [-164, -78], [-78, -160], [-76, -84]]) addTree(tx, tz, 1.25);

    // low hedge around the churchyard
    for (const [hx, hz, w, d] of [[x - 34, z - 24, 1, 82], [x + 34, z - 24, 1, 82], [x, z - 65, 70, 1]]) {
      const hedge = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, d), hedgeMat);
      hedge.position.set(hx, 0.4, hz);
      hedge.castShadow = true;
      scene.add(hedge);
    }

    addBoxCollider(x, z + 2, 15.5, 30.5, 0, 'church');
    addBoxCollider(x, z + 15.5, 8.7, 8.7, 0, 'church');
  }

  function createWindmill() {
    const x = -269;
    const z = -22;
    const millMat = new THREE.MeshStandardMaterial({ map: textures.brick, color: 0xb89a78, roughness: 0.95 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x38423c, roughness: 0.8 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b5138, roughness: 0.9 });
    const sailMat = new THREE.MeshStandardMaterial({ color: 0xd8cbb0, roughness: 0.9, side: THREE.DoubleSide });

    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 3.7, 11, 12), millMat);
    tower.position.set(x, 5.5, z);
    tower.castShadow = true;
    tower.receiveShadow = true;
    scene.add(tower);
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.35, 12), woodMat);
    gallery.position.set(x, 7.8, z);
    gallery.castShadow = true;
    scene.add(gallery);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.12), woodMat);
      post.position.set(x + Math.cos(a) * 3.2, 8.35, z + Math.sin(a) * 3.2);
      scene.add(post);
    }
    const cap = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3.4, 12), capMat);
    cap.position.set(x, 12.7, z);
    cap.castShadow = true;
    scene.add(cap);

    const blades = new THREE.Group();
    blades.position.set(x, 10.4, z + 2.55);
    scene.add(blades);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.7, 8), woodMat);
    hub.rotation.x = Math.PI / 2;
    blades.add(hub);
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = (i / 4) * Math.PI * 2;
      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 7.8, 0.16), woodMat);
      spar.position.y = 3.9;
      arm.add(spar);
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 6.8), sailMat);
      sail.position.set(0.92, 4.05, 0.02);
      arm.add(sail);
      for (let j = 0; j < 5; j++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.1), woodMat);
        bar.position.set(0.9, 1.2 + j * 1.3, 0.04);
        arm.add(bar);
      }
      blades.add(arm);
    }
    addCircleCollider(x, z, 4.2, 'windmill');
    addHouse({ x: x + 10.5, z: z + 8, rot: 0, w: 8, d: 7, h: 4.5, wall: wallMats[3], roof: roofMats[1], floors: 1, garden: false });
    addTree(x - 12, z + 8, 1.4);
    addBush(x - 8, z + 2, 1.2);
    updates.push((dt) => {
      blades.rotation.z += dt * 0.24;
    });
  }

  function createWaterTower() {
    const x = 120;
    const z = -236;
    const concrete = new THREE.MeshStandardMaterial({ color: 0xd4cbb9, roughness: 0.9 });
    const concreteDark = new THREE.MeshStandardMaterial({ color: 0xa79f90, roughness: 0.95 });
    addGroundPatch(x, z + 20, 96, 64, pavingMat, 0.012, 1 / 8);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.6, 19, 16), concrete);
    shaft.position.set(x, 9.5, z);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    scene.add(shaft);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 7.2, 6.5, 20), concrete);
    bowl.position.set(x, 21.7, z);
    bowl.castShadow = true;
    bowl.receiveShadow = true;
    scene.add(bowl);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9.5, 0.55, 20), whiteStoneMat);
    lip.position.set(x, 25.1, z);
    scene.add(lip);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(9.6, 3.4, 20), concreteDark);
    roof.position.set(x, 27, z);
    roof.castShadow = true;
    scene.add(roof);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5c4a, toneMapped: false }));
    beacon.position.set(x, 29.1, z);
    scene.add(beacon);
    nightMaterials.push({ material: beacon.material, type: 'beacon' });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1), metalMat);
      post.position.set(x + Math.cos(a) * 9.3, 25.9, z + Math.sin(a) * 9.3);
      scene.add(post);
    }
    addCircleCollider(x, z, 9.6, 'watertower');
    for (const [px, pz] of [[78, -214], [162, -214], [78, -254], [162, -254], [96, -268]]) addTree(px, pz, 1.2);
    for (let i = 0; i < 4; i++) {
      const path = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 12), pathMat);
      path.rotation.x = -Math.PI / 2;
      path.position.set(84 + i * 24, 0.03, -220);
      path.receiveShadow = true;
      scene.add(path);
    }
  }

  function makeBench(x, z, yaw = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    const wood = new THREE.MeshStandardMaterial({ color: 0x795b3e, roughness: 0.9 });
    const legs = new THREE.MeshStandardMaterial({ color: 0x3c4642, roughness: 0.7, metalness: 0.2 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.55), wood);
    seat.position.y = 0.48;
    seat.castShadow = true;
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 0.12), wood);
    back.position.set(0, 0.82, -0.22);
    back.rotation.x = -0.12;
    back.castShadow = true;
    g.add(back);
    for (const sx of [-0.85, 0.85]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.48, 0.45), legs);
      leg.position.set(sx, 0.24, 0);
      g.add(leg);
    }
    scene.add(g);
    return g;
  }

  function createMarketSquare() {
    addPavedRect(-55, -55, 55, 55, cobbleMat, 0.013, 1 / 5);

    // fountain
    const fx = 0;
    const fz = 0;
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(6.7, 7.3, 0.75, 28), whiteStoneMat);
    basin.position.set(fx, 0.38, fz);
    basin.castShadow = true;
    basin.receiveShadow = true;
    scene.add(basin);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(6.1, 6.1, 0.2, 28), waterMat);
    water.position.set(fx, 0.72, fz);
    scene.add(water);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 2.7, 12), whiteStoneMat);
    pedestal.position.set(fx, 1.7, fz);
    scene.add(pedestal);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 1.3, 0.45, 20), whiteStoneMat);
    bowl.position.set(fx, 3.0, fz);
    scene.add(bowl);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.7, 8), goldMat);
    spout.position.set(fx, 4.0, fz);
    scene.add(spout);
    addCircleCollider(fx, fz, 7.5, 'fountain');
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      addFlowers(fx + Math.cos(a) * 9.4, fz + Math.sin(a) * 9.4, 5, 0.7);
    }

    // fountain spray
    const sprayCount = 150;    const sprayPositions = new Float32Array(sprayCount * 3);
    const sprayData = [];
    for (let i = 0; i < sprayCount; i++) {
      sprayData.push({ a: rand(0, Math.PI * 2), t: rand(0, 1), speed: rand(0.35, 0.7), lift: rand(0.8, 1.5) });
    }
    const sprayGeo = new THREE.BufferGeometry();
    sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPositions, 3));
    const sprayMat = new THREE.PointsMaterial({
      color: 0xd8f3ec,
      size: 0.16,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const spray = new THREE.Points(sprayGeo, sprayMat);
    scene.add(spray);
    updates.push((dt, t) => {
      sprayData.forEach((p, i) => {
        p.t += dt * p.speed;
        if (p.t > 1) {
          p.t -= 1;
          p.a = rand(0, Math.PI * 2);
        }
        const r = 0.4 + Math.sqrt(p.t) * 3.1;
        const y = 4.2 + p.t * 2.1 - p.t * p.t * 2.4;
        sprayPositions[i * 3] = Math.cos(p.a) * r;
        sprayPositions[i * 3 + 1] = y;
        sprayPositions[i * 3 + 2] = Math.sin(p.a) * r;
      });
      sprayGeo.attributes.position.needsUpdate = true;
      sprayMat.opacity = 0.55 + Math.sin(t * 2) * 0.1;
    });

    // market stalls
    const canopyColors = [
      new THREE.MeshStandardMaterial({ map: textures.awningStripe, color: 0xd78d4a, roughness: 0.9, side: THREE.DoubleSide }),
      new THREE.MeshStandardMaterial({ map: textures.awningStripe, color: 0x7f9f6f, roughness: 0.9, side: THREE.DoubleSide }),
      new THREE.MeshStandardMaterial({ map: textures.awningStripe, color: 0xb8604c, roughness: 0.9, side: THREE.DoubleSide }),
      new THREE.MeshStandardMaterial({ map: textures.awningStripe, color: 0x6d91a1, roughness: 0.9, side: THREE.DoubleSide }),
    ];
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x9b774d, roughness: 0.92 });
    const produceMats = [0xd67a3f, 0xd8b04a, 0x7f9e58, 0xbd5d4d].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92 }));
    const stallSpots = [[-25, -20, 0], [20, -26, 0.1], [27, 22, 0.2], [-22, 25, -0.15], [-38, 2, 0.45]];
    for (let s = 0; s < stallSpots.length; s++) {
      const [sx, sz, rot] = stallSpots[s];
      const g = new THREE.Group();
      g.position.set(sx, 0, sz);
      g.rotation.y = rot;
      const table = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.18, 2.5), crateMat);
      table.position.y = 1.0;
      table.castShadow = true;
      g.add(table);
      for (const lx of [-2.2, 2.2]) for (const lz of [-0.9, 0.9]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12), metalMat);
        leg.position.set(lx, 0.5, lz);
        g.add(leg);
      }
      for (let i = 0; i < 3; i++) {
        const produce = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.75), produceMats[(s + i) % produceMats.length]);
        produce.position.set(-1.6 + i * 1.6, 1.3, 0);
        produce.castShadow = true;
        g.add(produce);
      }
      for (let i = 0; i < 4; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.6, 0.09), metalMat);
        post.position.set(-2.4 + i * 1.6, 1.3, i % 2 ? -1.4 : 1.4);
        g.add(post);
      }
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.1, 3.2), canopyColors[s % canopyColors.length]);
      canopy.position.y = 2.7;
      canopy.rotation.x = -0.12;
      canopy.castShadow = true;
      g.add(canopy);
      scene.add(g);
      addBoxCollider(sx, sz, 5.8, 3.4, rot, 'stall');
    }

    // string lights
    const lightPts = [];
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x38433f, roughness: 0.8 });
    for (const [sx, sz] of [[-47, -47], [47, -47], [-47, 47], [47, 47], [0, -47], [0, 47]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5.4, 5), poleMat);
      pole.position.set(sx, 2.7, sz);
      scene.add(pole);
    }
    const stringSets = [
      [[-47, -47], [0, -47]], [[0, -47], [47, -47]],
      [[-47, 47], [0, 47]], [[0, 47], [47, 47]],
      [[-47, -47], [-47, 47]], [[47, -47], [47, 47]],
    ];
    const bulbGeo = new THREE.SphereGeometry(0.09, 6, 5);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd896, toneMapped: false });
    for (const [a, b] of stringSets) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(a[0], 5.1, a[1]),
        new THREE.Vector3((a[0] + b[0]) / 2, 4.6, (a[1] + b[1]) / 2),
        new THREE.Vector3(b[0], 5.1, b[1]),
      ]);
      const pts = curve.getPoints(26);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      scene.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x2a302c, transparent: true, opacity: 0.8 })));
      for (let i = 3; i < pts.length - 3; i += 3) {
        const p = pts[i];
        lightPts.push(new THREE.Vector3(p.x, p.y - 0.16, p.z));
      }
    }
    const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lightPts.length);
    lightPts.forEach((p, i) => bulbs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
    bulbs.instanceMatrix.needsUpdate = true;
    scene.add(bulbs);
    nightMaterials.push({ material: bulbMat, type: 'bulb' });

    // A little bunting across the square, the way a market should look.
    const flagGeo = new THREE.BufferGeometry();
    flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.3, 0, 0, 0.3, 0, 0, 0, -0.72, 0,
    ], 3));
    flagGeo.computeVertexNormals();
    const flagMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: true });
    const flagMatrices = [];
    const flagColors = [];
    const buntingPalette = [0xe56c58, 0xf0c04f, 0x4fa597, 0xf0e3c4, 0x7a8fc4, 0xc76a8b];
    const buntingLines = [
      [[-48, 6.5, -24], [0, 5.7, -24], [48, 6.5, -24]],
      [[-48, 6.5, 24], [0, 5.7, 24], [48, 6.5, 24]],
    ];
    for (const coords of buntingLines) {
      const curve = new THREE.CatmullRomCurve3(coords.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
      const pts = curve.getPoints(60);
      const rope = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x39423b, transparent: true, opacity: 0.8 }),
      );
      scene.add(rope);
      for (let i = 3; i < 57; i += 3) {
        const p = pts[i];
        const tangent = curve.getTangent(i / 60);
        const yaw = Math.atan2(-tangent.z, tangent.x);
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(p.x, p.y - 0.04, p.z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
          new THREE.Vector3(0.85, 0.9, 1),
        );
        flagMatrices.push(m);
        flagColors.push(new THREE.Color(buntingPalette[flagColors.length % buntingPalette.length]));
      }
      for (const [x, y, z] of [coords[0], coords[coords.length - 1]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 6.6, 6), poleMat);
        pole.position.set(x, y - 3.3, z);
        scene.add(pole);
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), goldMat);
        ball.position.set(x, y + 0.1, z);
        scene.add(ball);
      }
    }
    const flags = new THREE.InstancedMesh(flagGeo, flagMat, flagMatrices.length);
    flagMatrices.forEach((m, i) => {
      flags.setMatrixAt(i, m);
      flags.setColorAt(i, flagColors[i]);
    });
    flags.instanceMatrix.needsUpdate = true;
    if (flags.instanceColor) flags.instanceColor.needsUpdate = true;
    flags.frustumCulled = false;
    scene.add(flags);

    // café tables under the shop windows
    const cafeTopMat = new THREE.MeshStandardMaterial({ color: 0xe2d6bb, roughness: 0.8 });
    const cafeLegMat = new THREE.MeshStandardMaterial({ color: 0x3f4944, roughness: 0.7, metalness: 0.25 });
    const parasolMats = [0xd76551, 0x789b7a, 0xe6c15f, 0x7d92b8].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, side: THREE.DoubleSide }),
    );
    const cafeSpots = [
      [40, -20, -1.2, 0],
      [40, 2, -1.5, 1],
      [40, 22, -1.7, 2],
      [-39, -14, 1.4, 3],
      [-39, 10, 1.2, 0],
    ];
    for (const [x, z, rot, colorIndex] of cafeSpots) {
      const table = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.1, 14), cafeTopMat);
      table.position.set(x, 1.0, z);
      table.castShadow = true;
      scene.add(table);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1, 8), cafeLegMat);
      stem.position.set(x, 0.5, z);
      scene.add(stem);
      for (const offset of [-1, 1]) {
        const chair = new THREE.Group();
        chair.position.set(x + Math.cos(rot) * 1.8 * offset, 0, z + Math.sin(rot) * 1.8 * offset);
        chair.rotation.y = rot + Math.PI * 0.5;
        const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 10), cafeTopMat);
        seat.position.y = 0.55;
        chair.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.55, 0.08), cafeLegMat);
        back.position.set(0, 0.84, 0.35);
        chair.add(back);
        for (const lx of [-0.3, 0.3]) for (const lz of [-0.3, 0.3]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.52, 5), cafeLegMat);
          leg.position.set(lx, 0.26, lz);
          chair.add(leg);
        }
        scene.add(chair);
      }
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 6), cafeLegMat);
      pole.position.set(x, 1.7, z);
      scene.add(pole);
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.58, 10), parasolMats[colorIndex % parasolMats.length]);
      canopy.position.set(x, 3.4, z);
      canopy.castShadow = true;
      scene.add(canopy);
    }
    for (let i = 0; i < 4; i++) addTree(-36 + i * 24, -36, 1.25);
    for (let i = 0; i < 4; i++) addTree(-36 + i * 24, 36, 1.25);
    for (const [bx, bz, by] of [[-32, 15, 2.1], [36, -10, -0.8], [-12, -36, 1.4], [12, 36, 2.9]]) makeBench(bx, bz, by);
    for (const [px, pz] of [[-42, -25], [42, 25], [-42, 25], [42, -25]]) {
      addFlowers(px, pz, 20, 2.2);
      const planter = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.55, 1.2), stoneMat);
      planter.position.set(px, 0.28, pz);
      planter.receiveShadow = true;
      scene.add(planter);
    }
    // bollards around the square edge
    const bollardGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.8, 6);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const bollard = new THREE.Mesh(bollardGeo, darkTrimMat);
      bollard.position.set(Math.cos(a) * 50, 0.4, Math.sin(a) * 50);
      bollard.castShadow = true;
      scene.add(bollard);
    }
  }

  // ---------------------------------------------------------------- signs helper
  function addShopSign(x, z, rot, w, text, sub, front = 4.6) {
    const tex = makeSignTexture(text, { bg: pick(['#173a36', '#422d24', '#263f3a', '#3c352a']), sub });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.31), new THREE.MeshBasicMaterial({ map: tex, toneMapped: true }));
    mesh.position.set(x + Math.sin(rot) * front, 4.1, z + Math.cos(rot) * front);
    mesh.rotation.y = rot;
    scene.add(mesh);
  }

  // ---------------------------------------------------------------- block fills
  function fillResidential(x0, z0, x1, z1, seed) {
    const localRng = mulberry32(seed);
    const lr = (a, b) => a + (b - a) * localRng();
    const set = (count, along) => Array.from({ length: count }, (_, i) => (i + 0.5) / count).map((f) => along[0] + (along[1] - along[0]) * f + lr(-4, 4));
    const sides = [
      { rot: Math.PI, z: z0 + 15, along: [x0 + 24, x1 - 24], count: 3 },
      { rot: 0, z: z1 - 15, along: [x0 + 24, x1 - 24], count: 3 },
      { rot: -Math.PI / 2, x: x0 + 15, along: [z0 + 26, z1 - 26], count: 2 },
      { rot: Math.PI / 2, x: x1 - 15, along: [z0 + 26, z1 - 26], count: 2 },
    ];
    for (const side of sides) {
      const positions = set(side.count, side.along);
      for (const p of positions) {
        const w = lr(8.2, 11.6);
        const d = lr(7.4, 9.3);
        const h = lr(6.2, 8.2);
        if (side.rot === 0 || side.rot === Math.PI) {
          addHouse({ x: p, z: side.z, rot: side.rot, w, d, h, floors: Math.random() < 0.2 ? 3 : 2 });
        } else {
          addHouse({ x: side.x, z: p, rot: side.rot, w: d, d: w, h, floors: lr(0, 1) < 0.25 ? 3 : 2 });
        }
      }
    }
    // back gardens & street trees
    for (let i = 0; i < 5; i++) addTree(lr(x0 + 36, x1 - 36), lr(z0 + 34, z1 - 34), lr(0.9, 1.4));
    for (let i = 0; i < 4; i++) addBush(lr(x0 + 30, x1 - 30), lr(z0 + 30, z1 - 30), lr(0.8, 1.3));
    addFlowers(x1 - 22, z1 - 22, 12, 2.2);
  }

  function fillShops(x0, z0, x1, z1, seed, extraSigns = true) {
    const localRng = mulberry32(seed);
    const lr = (a, b) => a + (b - a) * localRng();
    let signIndex = 0;
    const sides = [
      { rot: Math.PI, z: z0 + 11.5, along: [x0 + 20, x1 - 20], count: 5 },
      { rot: 0, z: z1 - 11.5, along: [x0 + 20, x1 - 20], count: 5 },
      { rot: -Math.PI / 2, x: x0 + 11.5, along: [z0 + 26, z1 - 26], count: 3 },
      { rot: Math.PI / 2, x: x1 - 11.5, along: [z0 + 26, z1 - 26], count: 3 },
    ];
    for (const side of sides) {
      const count = side.count;
      const span = side.along[1] - side.along[0];
      const width = span / count - 0.4;
      for (let i = 0; i < count; i++) {
        const along = side.along[0] + width * (i + 0.5) + 0.4 * i;
        const depth = lr(8, 9.6);
        const height = lr(8.8, 11.4);
        if (side.rot === 0 || side.rot === Math.PI) {
          addHouse({ x: along, z: side.z, rot: side.rot, w: width, d: depth, h: height, shop: true, floors: 3, garden: false, wall: pick(wallMats), roof: pick(roofMats) });
        } else {
          addHouse({ x: side.x, z: along, rot: side.rot, w: depth, d: width, h: height, shop: true, floors: 3, garden: false, wall: pick(wallMats), roof: pick(roofMats) });
        }
        if (extraSigns && localRng() < 0.6) {
          const [name, sub] = SHOP_NAMES[signIndex++ % SHOP_NAMES.length];
          const horizontal = side.rot === 0 || side.rot === Math.PI;
          const sx = horizontal ? along : side.x;
          const sz = horizontal ? side.z : along;
          const signWidth = horizontal ? Math.min(width * 0.8, 4.4) : Math.min(depth * 0.8, 4.4);
          const front = horizontal ? depth * 0.5 + 0.09 : width * 0.5 + 0.09;
          addShopSign(sx, sz, side.rot, signWidth, name, sub, front);
        }
      }
    }
  }

  function addFields(x0, z0, x1, z1, seed, cropColors = [0xc0a45b, 0x9da65b, 0xb98b52, 0x849c58]) {
    const localRng = mulberry32(seed);
    const rows = 5;
    const cols = 4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (localRng() < 0.16) continue;
        const w = (x1 - x0) / cols - 3;
        const d = (z1 - z0) / rows - 3;
        const cx = x0 + (x1 - x0) * ((c + 0.5) / cols);
        const cz = z0 + (z1 - z0) * ((r + 0.5) / rows);
        const mat = new THREE.MeshStandardMaterial({ color: cropColors[Math.floor(localRng() * cropColors.length)], roughness: 1 });
        const patch = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
        patch.rotation.x = -Math.PI / 2;
        patch.position.set(cx, 0.005, cz);
        patch.receiveShadow = true;
        scene.add(patch);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0x6e7849, transparent: true, opacity: 0.16 });
        for (let i = 0; i < 6; i++) {
          const line = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.09), lineMat);
          line.rotation.x = -Math.PI / 2;
          line.position.set(cx, 0.012, cz - d / 2 + (i + 0.5) * (d / 6));
          scene.add(line);
        }
      }
    }
    for (let i = 0; i < 5; i++) addTree(x0 + 10 + localRng() * (x1 - x0 - 20), z0 + 10 + localRng() * (z1 - z0 - 20), 1.1);
  }

  function fillPondPark() {
    // pond
    const px = -232;
    const pz = 10;
    const pondGeo = new THREE.CircleGeometry(1, 48);
    pondGeo.scale(31, 22, 1);
    pondGeo.rotateX(-Math.PI / 2);
    const pond = new THREE.Mesh(pondGeo, waterMat);
    pond.position.set(px, 0.035, pz);
    pond.receiveShadow = true;
    scene.add(pond);
    addCircleCollider(px, pz, 21, 'pond');
    const bank = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 48), new THREE.MeshStandardMaterial({ color: 0x8f8a76, roughness: 0.95 }));
    bank.rotation.x = -Math.PI / 2;
    bank.scale.set(32.4, 23.4, 1);
    bank.position.set(px, 0.02, pz);
    scene.add(bank);

    // ducks
    const duckBody = new THREE.SphereGeometry(0.35, 8, 5);
    const duckHead = new THREE.SphereGeometry(0.2, 8, 5);
    const duckMat = new THREE.MeshStandardMaterial({ color: 0xf0e8d4, roughness: 0.8 });
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xc58a35, roughness: 0.7 });
    const ducks = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const b = new THREE.Mesh(duckBody, duckMat);
      b.scale.set(1, 0.7, 0.7);
      b.position.y = 0.26;
      g.add(b);
      const h = new THREE.Mesh(duckHead, duckMat);
      h.position.set(0.26, 0.52, 0);
      g.add(h);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 5), beakMat);
      beak.rotation.z = -Math.PI / 2;
      beak.position.set(0.46, 0.5, 0);
      g.add(beak);
      const a = rand(0, Math.PI * 2);
      const r = rand(3, 16);
      g.position.set(px + Math.cos(a) * r, 0.05, pz + Math.sin(a) * r * 0.7);
      scene.add(g);
      ducks.push({ g, a, r, speed: rand(0.08, 0.2), phase: rand(0, 6) });
    }
    updates.push((dt) => {
      for (const duck of ducks) {
        duck.a += dt * duck.speed;
        duck.g.position.set(px + Math.cos(duck.a) * duck.r, 0.05 + Math.sin(duck.a * 4 + duck.phase) * 0.02, pz + Math.sin(duck.a) * duck.r * 0.7);
        duck.g.rotation.y = -duck.a + Math.PI / 2;
      }
      textures.water.offset.x += dt * 0.003;
      textures.water.offset.y += dt * 0.001;
    });

    // reeds
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2;
      const reed = new THREE.Mesh(new THREE.ConeGeometry(0.06, rand(0.8, 1.7), 3), new THREE.MeshStandardMaterial({ color: 0x75824c, roughness: 1 }));
      reed.position.set(px + Math.cos(a) * rand(29, 34), 0.65, pz + Math.sin(a) * rand(20, 24));
      scene.add(reed);
    }
    for (const [x, z] of [[-283, -16], [-290, 24], [-184, -14], [-184, 45], [-212, -42]]) addTree(x, z, 1.4);
    for (const [x, z] of [[-278, 36], [-265, 44], [-198, 42], [-190, 30], [-274, -40]]) addBush(x, z, 1.2);
    for (const [x, z, yaw] of [[-268, 3, 1.4], [-194, 18, -1.6], [-243, 40, 2.4]]) makeBench(x, z, yaw);
    addFlowers(-190, 8, 24, 3.4);
    addFlowers(-274, 18, 16, 2.6);
  }

  function createSportsPark() {
    addPavedRect(70, 65, 176, 105, pavingMat, 0.012, 1 / 8);
    addGroundPatch(120, 135, 74, 48, new THREE.MeshStandardMaterial({ color: 0x5c8b51, roughness: 1 }), 0.012, 1 / 3);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xe8e3ce, transparent: true, opacity: 0.85 });
    const lineY = 0.024;
    for (const [x, z, w, d] of [
      [120, 135, 74, 0.12], [120, 111, 74, 0.12], [120, 135, 0.12, 48],
      [83, 135, 0.12, 48], [157, 135, 0.12, 48],
      [120, 135, 0.12, 20],
    ]) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, lineY, z);
      scene.add(line);
    }
    const goalMat = new THREE.MeshStandardMaterial({ color: 0xeee8d5, roughness: 0.7 });
    for (const gx of [83, 157]) {
      const g = new THREE.Group();
      g.position.set(gx, 0, 135);
      const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.12), goalMat);
      bar1.position.set(0, 1.2, -3.2);
      const bar2 = bar1.clone();
      bar2.position.z = 3.2;
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 6.5), goalMat);
      cross.position.y = 2.4;
      g.add(bar1, bar2, cross);
      scene.add(g);
    }
    const club = new THREE.Mesh(new THREE.BoxGeometry(24, 5.2, 11), new THREE.MeshStandardMaterial({ color: 0xd7c59c, roughness: 0.9 }));
    club.position.set(150, 2.6, 78);
    club.castShadow = true;
    club.receiveShadow = true;
    scene.add(club);
    const clubRoof = new THREE.Mesh(makeGableRoofGeometry(24, 11, 2.6, 0.4), new THREE.MeshStandardMaterial({ color: 0x6d3f34, roughness: 0.9 }));
    clubRoof.position.set(150, 5.2, 78);
    clubRoof.castShadow = true;
    scene.add(clubRoof);
    addBoxCollider(150, 78, 24.5, 11.5, 0, 'clubhouse');
    // floodlights
    for (const [fx, fz] of [[78, 106], [162, 106], [78, 164], [162, 164]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 12, 6), metalMat);
      pole.position.set(fx, 6, fz);
      pole.castShadow = true;
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 0.35), darkTrimMat);
      lamp.position.set(fx, 12, fz);
      scene.add(lamp);
    }
    for (const [tx, tz] of [[70, 70], [176, 70], [70, 172], [176, 172], [110, 72], [140, 70]]) addTree(tx, tz, 1.3);
    addFlowers(78, 72, 18, 2.6);
  }

  function createIndustrial() {
    addPavedRect(-176, 186, -64, 294, new THREE.MeshStandardMaterial({ color: 0x8f8d83, roughness: 1 }), 0.012, 1 / 8);
    const metalLight = new THREE.MeshStandardMaterial({ color: 0xb8b4a4, roughness: 0.7, metalness: 0.25 });
    const metalDark = new THREE.MeshStandardMaterial({ color: 0x58635e, roughness: 0.8, metalness: 0.2 });
    const warehouseMat = new THREE.MeshStandardMaterial({ map: textures.plaster, color: 0x9fa59b, roughness: 0.9 });
    const boxes = [
      [-148, 220, 44, 20, 9],
      [-82, 230, 26, 18, 7],
      [-120, 278, 31, 17, 6.5],
    ];
    for (const [x, z, w, d, h] of boxes) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), warehouseMat);
      b.position.set(x, h / 2, z);
      b.castShadow = true;
      b.receiveShadow = true;
      scene.add(b);
      for (let i = 0; i < 3; i++) {
        const skylight = new THREE.Mesh(new THREE.BoxGeometry(w / 3 - 1, 0.5, 1.2), metalLight);
        skylight.position.set(x - w / 3 + i * (w / 3), h + 0.2, z - d * 0.22);
        scene.add(skylight);
      }
      addBoxCollider(x, z, w, d, 0, 'industrial');
    }
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(rand(4, 7), rand(2.5, 3.2), rand(2.2, 3)), i % 3 === 0 ? metalDark : new THREE.MeshStandardMaterial({ color: pick([0x8a5c46, 0x58746a, 0x786444]), roughness: 0.8 }));
      c.position.set(-152 + (i % 4) * 9, 1.5, 260 + Math.floor(i / 4) * 7);
      c.rotation.y = rand(-0.1, 0.1);
      c.castShadow = true;
      scene.add(c);
      addBoxCollider(c.position.x, c.position.z, 7, 3, 0, 'container');
    }
    const truckBody = new THREE.Mesh(new THREE.BoxGeometry(8.5, 3, 2.6), new THREE.MeshStandardMaterial({ color: 0xdfe2d7, roughness: 0.7 }));
    truckBody.position.set(-100, 2.2, 198);
    truckBody.castShadow = true;
    scene.add(truckBody);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.3, 2.5), new THREE.MeshStandardMaterial({ color: 0xb85a43, roughness: 0.7 }));
    cab.position.set(-94.8, 1.5, 198);
    cab.castShadow = true;
    scene.add(cab);
    addBoxCollider(-100, 198, 8.6, 2.7, 0, 'truck');
    for (const [tx, tz] of [[-174, 190], [-66, 190], [-174, 290], [-66, 290], [-170, 250]]) addTree(tx, tz, 1.15);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.6), new THREE.MeshBasicMaterial({ map: makeSignTexture('NIJVERHEID', { bg: '#3b4c44', sub: 'bedrijventerrein soest' }), toneMapped: true }));
    sign.position.set(-120, 4, 188);
    scene.add(sign);
    addFlowers(-174, 278, 10, 2.2);
  }

  function createStation() {
    const building = new THREE.Group();
    const brick = new THREE.MeshStandardMaterial({ map: textures.brick, color: 0x9c694f, roughness: 0.92 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xeee5d0, roughness: 0.8 });
    const roof = new THREE.MeshStandardMaterial({ map: textures.roof, color: 0x4a4a43, roughness: 0.9 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x6d8a85, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.65 });
    const station = new THREE.Mesh(new THREE.BoxGeometry(20, 7, 9), brick);
    station.position.set(0, 3.5, 321);
    station.castShadow = true;
    station.receiveShadow = true;
    building.add(station);
    const stationRoof = new THREE.Mesh(makeGableRoofGeometry(20, 9, 3.4, 0.5), roof);
    stationRoof.position.set(0, 7, 321);
    stationRoof.castShadow = true;
    building.add(stationRoof);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(23, 0.2, 4.2), cream);
    canopy.position.set(0, 4.8, 327.6);
    canopy.castShadow = true;
    building.add(canopy);
    for (let i = 0; i < 5; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.8, 5), metalMat);
      post.position.set(-10 + i * 5, 2.4, 329);
      building.add(post);
    }
    for (let i = 0; i < 5; i++) {
      const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8), glass);
      glassPane.position.set(-7.8 + i * 3.9, 2.3, 325.55);
      glassPane.rotation.y = Math.PI;
      building.add(glassPane);
    }
    addBoxCollider(0, 321, 20.5, 9.5, 0, 'station');

    // station sign
    const signTex = makeSignTexture('SOEST-ZUID', { bg: '#1b3d5a', fg: '#f5eedb', accent: '#f0be4e', sub: 'spoor 1 · soest' });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.5), new THREE.MeshBasicMaterial({ map: signTex, toneMapped: true }));
    sign.position.set(0, 5.5, 316.4);
    sign.rotation.y = Math.PI;
    scene.add(sign);

    // platform and track
    const platform = new THREE.Mesh(new THREE.BoxGeometry(58, 0.55, 6.6), new THREE.MeshStandardMaterial({ color: 0xb7b1a3, roughness: 0.95 }));
    platform.position.set(0, 0.28, 344.5);
    platform.castShadow = true;
    platform.receiveShadow = true;
    scene.add(platform);
    const platformEdge = new THREE.Mesh(new THREE.BoxGeometry(58, 0.08, 0.24), new THREE.MeshStandardMaterial({ color: 0xe3d7b8, roughness: 0.8 }));
    platformEdge.position.set(0, 0.58, 347.7);
    scene.add(platformEdge);
    const canopyRoof = new THREE.Mesh(new THREE.BoxGeometry(38, 0.16, 5.2), new THREE.MeshStandardMaterial({ color: 0x829b96, roughness: 0.35, metalness: 0.25, transparent: true, opacity: 0.72 }));
    canopyRoof.position.set(0, 4.3, 344.5);
    canopyRoof.castShadow = true;
    scene.add(canopyRoof);
    for (const px of [-15, -5, 5, 15]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.2, 6), metalMat);
      post.position.set(px, 2.1, 344.5);
      scene.add(post);
    }
    for (let i = 0; i < 3; i++) makeBench(-8 + i * 8, 343.2, Math.PI);
    for (let i = 0; i < 7; i++) {
      const bike = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.12), new THREE.MeshStandardMaterial({ color: pick([0x41504d, 0x725b43, 0x3b5c69]), roughness: 0.8 }));
      bike.position.set(-23 + i * 1.1, 0.6, 315);
      bike.rotation.y = rand(-0.2, 0.2);
      scene.add(bike);
    }

    // ballast, sleepers, rails
    const ballast = new THREE.Mesh(new THREE.PlaneGeometry(1100, 4.8), new THREE.MeshStandardMaterial({ color: 0x6d665b, roughness: 1 }));
    ballast.rotation.x = -Math.PI / 2;
    ballast.position.set(0, -0.008, 350);
    ballast.receiveShadow = true;
    scene.add(ballast);
    const sleeperGeo = new THREE.BoxGeometry(0.35, 0.14, 4.2);
    const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x574b3d, roughness: 1 });
    const sleepers = new THREE.InstancedMesh(sleeperGeo, sleeperMat, 280);
    for (let i = 0; i < 280; i++) {
      sleepers.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-560 + i * 4, 0.04, 350));
    }
    sleepers.instanceMatrix.needsUpdate = true;
    sleepers.receiveShadow = true;
    scene.add(sleepers);
    for (const dz of [-0.72, 0.72]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1110, 0.12, 0.13), new THREE.MeshStandardMaterial({ color: 0x8f8a7d, roughness: 0.4, metalness: 0.7 }));
      rail.position.set(0, 0.14, 350 + dz);
      scene.add(rail);
    }
    // catenary masts
    for (let i = 0; i < 20; i++) {
      const mx = -340 + i * 38;
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.12, 6.2, 0.12), metalMat);
      mast.position.set(mx, 3.1, 352.8);
      scene.add(mast);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.1), metalMat);
      arm.position.set(mx + 1.3, 5.9, 352.8);
      scene.add(arm);
    }

    // station forecourt trees and planters
    addPavedRect(-20, 300, 20, 316, pavingMat, 0.013, 1 / 7);
    for (const [tx, tz] of [[-46, 250], [46, 250], [-44, 290], [44, 290], [-50, 316], [50, 316]]) addTree(tx, tz, 1.2);
    for (let i = 0; i < 5; i++) addFlowers(-30 + i * 15, 307, 10, 1.8);
    makeBench(-18, 307, 0);
    makeBench(18, 307, 0);
    scene.add(building);

    // animated train
    const train = new THREE.Group();
    const nsYellow = new THREE.MeshStandardMaterial({ color: 0xf1c735, roughness: 0.6 });
    const nsBlue = new THREE.MeshStandardMaterial({ color: 0x1b3f66, roughness: 0.5 });
    const trainGlass = new THREE.MeshStandardMaterial({ color: 0x273b46, roughness: 0.2, metalness: 0.3, emissive: 0xffbe63, emissiveIntensity: 0.08 });
    const trainRoof = new THREE.MeshStandardMaterial({ color: 0x9e9f96, roughness: 0.6, metalness: 0.3 });
    for (let c = 0; c < 3; c++) {
      const car = new THREE.Group();
      const body = new THREE.Mesh(new RoundedBoxGeometry(23, 3.2, 3, 2, 0.28), nsYellow);
      body.position.y = 2.1;
      body.castShadow = true;
      body.receiveShadow = true;
      car.add(body);
      const roof = new THREE.Mesh(new RoundedBoxGeometry(22.4, 0.7, 2.6, 2, 0.22), trainRoof);
      roof.position.y = 3.85;
      car.add(roof);
      const band = new THREE.Mesh(new THREE.BoxGeometry(23.2, 0.65, 3.04), nsBlue);
      band.position.y = 1.75;
      car.add(band);
      for (let w = 0; w < 9; w++) {
        const window = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.85, 0.08), trainGlass);
        window.position.set(-9 + w * 2.2, 2.75, 1.52);
        car.add(window);
        const window2 = window.clone();
        window2.position.z = -1.52;
        car.add(window2);
      }
      const frontLight = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.18), new THREE.MeshBasicMaterial({ color: 0xffe2a1, toneMapped: false }));
      frontLight.position.set(11.55, 1.4, 1.1);
      car.add(frontLight);
      const frontLight2 = frontLight.clone();
      frontLight2.position.z = -1.1;
      car.add(frontLight2);
      car.position.x = (c - 1) * 24.2;
      train.add(car);
    }
    train.position.set(-560, 0.2, 350);
    scene.add(train);
    const trainState = { x: -560, wait: 4, speed: 0 };
    updates.push((dt) => {
      if (trainState.wait > 0) {
        trainState.wait -= dt;
        return;
      }
      trainState.x += dt * 17;
      if (trainState.x > 600) {
        trainState.x = -620;
        trainState.wait = 18 + rand(0, 10);
      }
      train.position.x = trainState.x;
    });
  }

  function createTownHall() {
    addPavedRect(68, -172, 172, -110, pavingMat, 0.013, 1 / 8);
    const hallMat = new THREE.MeshStandardMaterial({ color: 0xd8cfb8, roughness: 0.85 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x638582, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.72 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x815d3f, roughness: 0.8 });
    const hall = new THREE.Group();
    const main = new THREE.Mesh(new THREE.BoxGeometry(40, 7, 18), hallMat);
    main.position.set(0, 3.5, 0);
    main.castShadow = true;
    main.receiveShadow = true;
    hall.add(main);
    const front = new THREE.Mesh(new THREE.BoxGeometry(37, 4.8, 0.2), glass);
    front.position.set(0, 3, 9.1);
    hall.add(front);
    for (let i = 0; i < 14; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 6.4, 0.4), wood);
      slat.position.set(-17 + i * 2.6, 3.4, 9.3);
      hall.add(slat);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(43, 0.6, 21), new THREE.MeshStandardMaterial({ color: 0x52635a, roughness: 0.8 }));
    roof.position.set(0, 7.3, 0);
    roof.castShadow = true;
    hall.add(roof);
    for (let i = 0; i < 5; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(25 - i * 2, 0.25, 1.2), whiteStoneMat);
      step.position.set(0, 0.12 + i * 0.12, 12 + i * 0.8);
      hall.add(step);
    }
    hall.position.set(120, 0, -136);
    scene.add(hall);
    addBoxCollider(120, -136, 43, 21, 0, 'townhall');
    const flagpole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 8, 6), metalMat);
    flagpole.position.set(87, 4, -120);
    scene.add(flagpole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), new THREE.MeshStandardMaterial({ color: 0xd65a46, roughness: 0.8, side: THREE.DoubleSide }));
    flag.position.set(88.3, 7.2, -120);
    scene.add(flag);
    for (const [tx, tz] of [[70, -160], [168, -160], [70, -116], [168, -116], [100, -160]]) addTree(tx, tz, 1.3);
    for (let i = 0; i < 6; i++) addFlowers(92 + i * 10, -112, 8, 1.5);
    makeBench(88, -114, 0);
    makeBench(145, -114, 0);
  }

  function createDunes() {
    // soft sand field east of the ring road
    const sandField = new THREE.PlaneGeometry(330, 520);
    sandField.rotateX(-Math.PI / 2);
    const uv = sandField.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 14);
    const sandMesh = new THREE.Mesh(sandField, sandMat);
    sandMesh.position.set(470, 0.006, 20);
    sandMesh.receiveShadow = true;
    scene.add(sandMesh);
    addPavedRect(298, 100, 318, 140, pathsOnlyMat(), 0.012, 1 / 5);

    const duneMat = new THREE.MeshStandardMaterial({ map: textures.sand, color: 0xf2ddb0, roughness: 1, flatShading: true });
    const dunes = [
      [346, -44, 34, 8], [410, -92, 48, 10], [500, -45, 60, 12], [350, 205, 32, 6], [430, 230, 50, 9], [520, 180, 58, 13],
      [390, 82, 30, 5], [460, 92, 40, 8], [560, 66, 52, 11], [360, 150, 22, 4], [480, -160, 40, 8], [545, -140, 48, 10],
    ];
    for (const [dx, dz, r, h] of dunes) {
      const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), duneMat);
      mound.scale.set(r, h, r * rand(0.6, 0.9));
      mound.position.set(dx, 0, dz);
      mound.castShadow = true;
      mound.receiveShadow = true;
      scene.add(mound);
      addCircleCollider(dx, dz, r * 0.72, 'dune');
      for (let i = 0; i < 5; i++) {
        const gx = dx + rand(-r * 0.45, r * 0.45);
        const gz = dz + rand(-r * 0.3, r * 0.3);
        addGrassTuft(gx, gz, rand(0.6, 1.3));
      }
    }
    // marram grass and a little viewpoint
    for (let i = 0; i < 120; i++) {
      const x = rand(340, 590);
      const z = rand(-170, 250);
      if (dunes.some(([dx, dz, r]) => Math.hypot(x - dx, z - dz) < r * 0.8)) continue;
      addGrassTuft(x, z, rand(0.5, 1.35));
    }
    addTree(336, 160, 1.1);
    addTree(341, -148, 1.2);
    addTree(330, 120, 0.8);
    const signTex = makeSignTexture('LANGE DUINEN', { bg: '#6e5b3c', fg: '#f5ebd5', accent: '#f0c56a', sub: 'duinreservaat · soest' });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.2), new THREE.MeshBasicMaterial({ map: signTex, toneMapped: true }));
    sign.position.set(310, 2.7, 115);
    sign.rotation.y = -Math.PI / 2;
    scene.add(sign);
    for (let i = 0; i < 2; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.7, 5), darkTrimMat);
      post.position.set(311, 1.35, 111 + i * 8);
      scene.add(post);
    }
    // wooden fence along the road, with a gap at the dune entrance
    const duneWood = new THREE.MeshStandardMaterial({ color: 0x6f5740, roughness: 0.95 });
    for (let i = 0; i < 26; i++) {
      const z = -130 + i * 11;
      if (z > 96 && z < 148) continue;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 0.16), duneWood);
      post.position.set(319, 0.6, z);
      scene.add(post);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 10), duneWood);
      rail.position.set(319, 0.8, z + 5.5);
      scene.add(rail);
    }
    const viewpoint = makeBench(330, 130, -Math.PI / 2);
    addBush(334, 118, 1.1);
    addBush(325, 95, 1.0);
  }

  // A material used above before definition; keep it safe.
  function pathsOnlyMat() {
    return pathMat;
  }

  function createFarm() {
    addFields(-490, 190, -310, 350, 311, [0xb99e55, 0xa9a15b, 0xc5a463, 0x899a58]);
    const farm = new THREE.Group();
    const farmWall = new THREE.MeshStandardMaterial({ map: textures.brick, color: 0xb47757, roughness: 0.95 });
    const farmRoof = new THREE.MeshStandardMaterial({ map: textures.roof, color: 0x5a3f31, roughness: 0.95 });
    const house = new THREE.Mesh(new THREE.BoxGeometry(19, 5.6, 12), farmWall);
    house.position.y = 2.8;
    house.castShadow = true;
    house.receiveShadow = true;
    farm.add(house);
    const houseRoof = new THREE.Mesh(makeGableRoofGeometry(19, 12, 4.6, 0.7), farmRoof);
    houseRoof.position.y = 5.6;
    houseRoof.castShadow = true;
    farm.add(houseRoof);
    const barn = new THREE.Mesh(new THREE.BoxGeometry(24, 4.8, 14), new THREE.MeshStandardMaterial({ color: 0x6f5c45, roughness: 0.95 }));
    barn.position.set(-22, 2.4, 5);
    barn.castShadow = true;
    farm.add(barn);
    const barnRoof = new THREE.Mesh(makeGableRoofGeometry(24, 14, 4, 0.6), farmRoof);
    barnRoof.position.set(-22, 4.8, 5);
    barnRoof.castShadow = true;
    farm.add(barnRoof);
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 10, 12), metalMat);
    silo.position.set(13, 5, 7);
    silo.castShadow = true;
    farm.add(silo);
    farm.position.set(-392, 0, 240);
    scene.add(farm);
    addBoxCollider(-392, 240, 20, 13, 0, 'farm');
    addBoxCollider(-414, 245, 24, 14, 0, 'barn');
    const drive = new THREE.Mesh(new THREE.PlaneGeometry(66, 4.5), pathMat);
    drive.rotation.x = -Math.PI / 2;
    drive.position.set(-330, 0.02, 260);
    drive.rotation.z = 0.05;
    drive.receiveShadow = true;
    scene.add(drive);

    // cows
    for (let i = 0; i < 4; i++) {
      const cow = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.1, 0.9), new THREE.MeshStandardMaterial({ color: 0xe8dfca, roughness: 0.9 }));
      body.position.y = 0.95;
      cow.add(body);
      const patch = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.5, 0.92), new THREE.MeshStandardMaterial({ color: 0x393b35, roughness: 0.9 }));
      patch.position.set(-0.4, 1.05, 0);
      cow.add(patch);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.5), new THREE.MeshStandardMaterial({ color: 0xe8dfca, roughness: 0.9 }));
      head.position.set(1.15, 0.95, 0);
      cow.add(head);
      for (const lx of [-0.65, 0.65]) for (const lz of [-0.28, 0.28]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), darkTrimMat);
        leg.position.set(lx, 0.3, lz);
        cow.add(leg);
      }
      cow.position.set(-425 + rand(0, 22), 0, 284 + rand(-8, 8));
      cow.rotation.y = rand(0, Math.PI * 2);
      cow.castShadow = true;
      scene.add(cow);
    }
    for (const [tx, tz] of [[-320, 195], [-300, 210], [-450, 320], [-500, 250], [-310, 300]]) addTree(tx, tz, 1.3);
    addFlowers(-360, 295, 14, 2);
  }

  function createOrchard() {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        addTree(-282 + c * 20 + rand(-1, 1), -166 + r * 18 + rand(-1, 1), rand(0.75, 1.05), { blobs: 2 });
      }
    }
    for (let i = 0; i < 7; i++) addFlowers(-290 + i * 16, -72, 10, 2.2);
    addGroundPatch(-240, -120, 104, 108, grassMat, 0.009, 1 / 8);
  }

  function createShoppingStreet() {
    // central spine of shops, with a small pedestrian lane and string lights
    addPavedRect(62, -56, 178, 56, cobbleMat, 0.013, 1 / 6);
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(12, 90), pavingMat);
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(120, 0.018, 0);
    lane.receiveShadow = true;
    scene.add(lane);
    for (let i = 0; i < 4; i++) {
      const planter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 2.4), stoneMat);
      planter.position.set(120, 0.23, -36 + i * 24);
      scene.add(planter);
      addFlowers(120, -36 + i * 24, 12, 1.3);
    }
    for (let i = 0; i < 3; i++) makeBench(105 + i * 15, 12, 0);
    addShopSign(120, 45, Math.PI, 4, 'WINKELSTRAAT', 'soest · sinds altijd');
    for (let i = 0; i < 4; i++) addTree(78 + i * 28, -50, 1.2);
    for (let i = 0; i < 3; i++) addTree(80 + i * 30, 50, 1.2);
  }

  function createBlockPlans() {
    const plans = [
      ['palace', -300, -300, -180, -180],
      ['residential', -180, -300, -60, -180],
      ['residential', -60, -300, 60, -180],
      ['watertower', 60, -300, 180, -180],
      ['fields', 180, -300, 300, -180],
      ['orchard', -300, -180, -180, -60],
      ['church', -180, -180, -60, -60],
      ['shops', -60, -180, 60, -60],
      ['townhall', 60, -180, 180, -60],
      ['fields', 180, -180, 300, -60],
      ['pond', -300, -60, -180, 60],
      ['shops2', -180, -60, -60, 60],
      ['market', -60, -60, 60, 60],
      ['shopping', 60, -60, 180, 60],
      ['dunesedge', 180, -60, 300, 60],
      ['residential', -300, 60, -180, 180],
      ['residential', -180, 60, -60, 180],
      ['residential', -60, 60, 60, 180],
      ['sports', 60, 60, 180, 180],
      ['dunes', 180, 60, 300, 180],
      ['farm', -300, 180, -180, 300],
      ['industrial', -180, 180, -60, 300],
      ['station', -60, 180, 60, 300],
      ['residential', 60, 180, 180, 300],
      ['dunes', 180, 180, 300, 300],
    ];
    let seed = 100;
    for (const [type, x0, z0, x1, z1] of plans) {
      seed += 37;
      switch (type) {
        case 'palace':
          createPalace();
          break;
        case 'residential':
          fillResidential(x0, z0, x1, z1, seed);
          break;
        case 'shops':
        case 'shops2':
          fillShops(x0, z0, x1, z1, seed, type === 'shops');
          break;
        case 'church':
          createChurch();
          break;
        case 'watertower':
          createWaterTower();
          break;
        case 'townhall':
          createTownHall();
          break;
        case 'pond':
          fillPondPark();
          createWindmill();
          break;
        case 'market':
          fillShops(x0, z0, x1, z1, seed, false);
          createMarketSquare();
          break;
        case 'shopping':
          fillShops(x0, z0, x1, z1, seed, true);
          createShoppingStreet();
          break;
        case 'sports':
          createSportsPark();
          break;
        case 'industrial':
          createIndustrial();
          break;
        case 'station':
          createStation();
          break;
        case 'farm':
          createFarm();
          break;
        case 'orchard':
          createOrchard();
          break;
        case 'dunesedge':
          for (let i = 0; i < 9; i++) addGrassTuft(rand(188, 296), rand(-54, 54), rand(0.7, 1.4));
          for (let i = 0; i < 5; i++) addTree(rand(190, 290), rand(-50, 50), rand(0.8, 1.2));
          break;
        case 'dunes':
          // the dunes themselves are built as one continuous landscape
          break;
        case 'fields':
          addFields(x0 + 4, z0 + 4, x1 - 4, z1 - 4, seed);
          break;
      }
    }
  }

  createBlockPlans();
  createDunes();

  // The wider polder: fields, hedgerows and tree lines that keep the horizon alive.
  addFields(-470, -680, -120, -400, 551, [0xbca35f, 0x9aa65c, 0xc9a766, 0x879b58]);
  addFields(-760, -350, -390, -90, 552, [0xa9a15b, 0xbfa25f, 0x8e9e57, 0xc2a76a]);
  addFields(-700, 370, -350, 640, 553, [0xb99e55, 0xa9a15b, 0xc5a463, 0x899a58]);
  addFields(120, 430, 530, 700, 554, [0xbfa65f, 0x9da65b, 0xb98b52, 0x849c58]);
  addFields(350, -690, 650, -380, 555, [0xc0a45b, 0xa9a15b, 0xb98b52, 0x98a25e]);
  for (let i = 0; i < 46; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(400, 650);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (x > 300 && z > -220 && z < 320) continue; // keep the dunes open
    for (let j = 0; j < 3; j++) {
      addTree(x + rand(-18, 18), z + rand(-18, 18), rand(1.5, 2.6), { blobs: 2, collide: false });
    }
    if (rand(0, 1) < 0.4) addBush(x + rand(-14, 14), z + rand(-14, 14), rand(1.2, 2.2));
  }

  // Leafy street edges: alternating trees on the sidewalks give the town its green bones.
  for (const road of ROADS) {
    if (!road.main && road.width < 8.5) continue;
    for (let i = 1; i < road.points.length; i++) {
      const [ax, az] = road.points[i - 1];
      const [bx, bz] = road.points[i];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 60) continue;
      const ux = dx / len;
      const uz = dz / len;
      const nx = -uz;
      const nz = ux;
      let flip = 0;
      for (let d = 32; d < len - 28; d += 48) {
        const side = flip++ % 2 === 0 ? 1 : -1;
        const cx = ax + ux * d + nx * (road.width * 0.5 + 1.55) * side;
        const cz = az + uz * d + nz * (road.width * 0.5 + 1.55) * side;
        if (Math.abs(cx) > 350 || Math.abs(cz) > 350) continue;
        if (road.name === 'Paleislaan' || road.name === 'Dalweg') continue;
        const nearest = graph.nearestNode(cx, cz);
        if (nearest && Math.hypot(nearest.x - cx, nearest.z - cz) < 18) continue;
        if (colliders.some((c) => c.type === 'box' && Math.abs(c.x - cx) < c.hw + 1.3 && Math.abs(c.z - cz) < c.hd + 1.3)) continue;
        addTree(cx, cz, rand(0.82, 1.05), { blobs: 2 });
        if (rand(0, 1) < 0.22) addBush(cx + rand(-1, 1), cz + rand(-1, 1), 0.6);
      }
    }
  }

  // Fill remaining green corners with trees and flowers so the town breathes.
  for (let i = 0; i < 40; i++) {
    const x = rand(-330, 330);
    const z = rand(-330, 330);
    if (isOnRoadNetwork(x, z, 6)) continue;
    if (colliders.some((c) => c.type === 'box' && Math.abs(c.x - x) < c.hw + 4 && Math.abs(c.z - z) < c.hd + 4)) continue;
    addTree(x, z, rand(0.8, 1.45));
  }

  // ---------------------------------------------------------------- street lamps
  const lampPoleQueue = [];
  const lampArmQueue = [];
  const lampBulbPositions = [];
  function addLamp(x, z, yaw) {
    const base = new THREE.Matrix4().compose(
      new THREE.Vector3(x, 0, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
      new THREE.Vector3(1, 1, 1),
    );
    lampPoleQueue.push({ matrix: base.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(0, 2.5, 0), new THREE.Quaternion(), new THREE.Vector3(1, 5, 1))) });
    lampArmQueue.push({ matrix: base.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(0, 4.8, 0.45), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0, 0)), new THREE.Vector3(0.16, 0.16, 1.25))) });
    const p = new THREE.Vector3(0, 4.7, 0.95).applyMatrix4(base);
    lampBulbPositions.push(p);
  }
  for (const road of ROADS) {
    if (!road.points || road.points.length < 2) continue;
    for (let i = 1; i < road.points.length; i++) {
      const [ax, az] = road.points[i - 1];
      const [bx, bz] = road.points[i];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 50) continue;
      const ux = dx / len;
      const uz = dz / len;
      const nx = -uz;
      const nz = ux;
      for (let d = 25; d < len - 20; d += 52) {
        const cx = ax + ux * d + nx * (road.width * 0.5 + 2.5);
        const cz = az + uz * d + nz * (road.width * 0.5 + 2.5);
        if (Math.abs(cx) > 360 || Math.abs(cz) > 360) continue;
        if (colliders.some((c) => c.type === 'box' && Math.abs(c.x - cx) < c.hw + 1 && Math.abs(c.z - cz) < c.hd + 1)) continue;
        const yaw = Math.atan2(-nx, -nz);
        addLamp(cx, cz, yaw);
      }
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 1, 6);
  const armGeo = new THREE.BoxGeometry(1, 1, 1);
  const poleMesh = new THREE.InstancedMesh(poleGeo, metalMat, lampPoleQueue.length);
  lampPoleQueue.forEach((entry, i) => poleMesh.setMatrixAt(i, entry.matrix));
  poleMesh.instanceMatrix.needsUpdate = true;
  poleMesh.castShadow = true;
  poleMesh.frustumCulled = false;
  scene.add(poleMesh);
  const armMesh = new THREE.InstancedMesh(armGeo, metalMat, lampArmQueue.length);
  lampArmQueue.forEach((entry, i) => armMesh.setMatrixAt(i, entry.matrix));
  armMesh.instanceMatrix.needsUpdate = true;
  armMesh.castShadow = true;
  armMesh.frustumCulled = false;
  scene.add(armMesh);
  const bulbGeo = new THREE.SphereGeometry(0.19, 7, 5);
  const lampBulbMat = new THREE.MeshBasicMaterial({ color: 0xffd48b, toneMapped: false });
  const lampBulbs = new THREE.InstancedMesh(bulbGeo, lampBulbMat, lampBulbPositions.length);
  lampBulbPositions.forEach((p, i) => lampBulbs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
  lampBulbs.instanceMatrix.needsUpdate = true;
  lampBulbs.frustumCulled = false;
  scene.add(lampBulbs);
  nightMaterials.push({ material: lampBulbMat, type: 'bulb' });

  const glowTex = makeRadialTexture('rgba(255,212,139,0.9)', 'rgba(255,201,120,0)');
  const glowGeo = new THREE.BufferGeometry();
  const glowPositions = [];
  for (const p of lampBulbPositions) glowPositions.push(p.x, p.y, p.z);
  glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(glowPositions, 3));
  const glowMat = new THREE.PointsMaterial({
    map: glowTex,
    color: 0xffd28a,
    size: 1.9,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const glowPoints = new THREE.Points(glowGeo, glowMat);
  scene.add(glowPoints);
  world.lampGlow = glowMat;

  // ---------------------------------------------------------------- clouds
  const cloudMat = new THREE.MeshStandardMaterial({ color: PRESETS.golden.cloudColor, roughness: 1, flatShading: true, emissive: 0x503425, emissiveIntensity: 0.18 });
  const cloudGeo = new THREE.SphereGeometry(1, 8, 6);
  const clouds = [];
  // A clean gradient sky reads better than chunky low-poly clouds at this scale.
  world.cloudMat = cloudMat;

  // ---------------------------------------------------------------- distant wind turbines
  const turbineBlades = [];
  for (const [tx, tz, scale] of [[-720, -180, 1], [-660, 500, 0.9], [620, -520, 0.8], [-880, 340, 0.7]]) {
    const g = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.1, 45, 8), new THREE.MeshStandardMaterial({ color: 0xd8d7c9, roughness: 0.85 }));
    tower.position.y = 22.5;
    g.add(tower);
    const nacelle = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 5), new THREE.MeshStandardMaterial({ color: 0xd8d7c9, roughness: 0.8 }));
    nacelle.position.set(0, 45, 1);
    g.add(nacelle);
    const rotor = new THREE.Group();
    rotor.position.set(0, 45, 4.1);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.3, 19, 0.35), new THREE.MeshStandardMaterial({ color: 0xe2e0d2, roughness: 0.8 }));
      blade.position.y = 9.5;
      const arm = new THREE.Group();
      arm.rotation.z = (b / 3) * Math.PI * 2;
      arm.add(blade);
      rotor.add(arm);
    }
    g.add(rotor);
    g.position.set(tx, 0, tz);
    g.scale.setScalar(scale);
    scene.add(g);
    turbineBlades.push(rotor);
  }
  updates.push((dt) => {
    for (const rotor of turbineBlades) rotor.rotation.z += dt * 0.18;
  });

  // ---------------------------------------------------------------- queued instances
  buildInstances();
  finaliseTrees();

  // ---------------------------------------------------------------- people
  const coatMats = [0xd45d78, 0x368ba1, 0xe9a83a, 0x62a76b, 0xb968a2, 0x8e68ad, 0xc65c55, 0x447b8f].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }),
  );
  const skinMats = [0xe8b995, 0xbb805c, 0xf0c9a7, 0x8d5e46, 0xd6a987].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }),
  );
  const hairMats = [0x3b2b23, 0x6b4a35, 0xd4b06a, 0x281f1b, 0x8b6b4c].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }),
  );
  const trouserMat = new THREE.MeshStandardMaterial({ color: 0x34404b, roughness: 0.95 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x29241f, roughness: 0.9 });
  const bagMat = new THREE.MeshStandardMaterial({ color: 0x7a5237, roughness: 0.85 });

  function makePerson({ coat = pick(coatMats), skin = pick(skinMats), hair = pick(hairMats), bag = false, scale = 1 } = {}) {
    if (typeof coat === 'string' || typeof coat === 'number') {
      coat = new THREE.MeshStandardMaterial({ color: coat, roughness: 0.9 });
    }
    if (typeof skin === 'string' || typeof skin === 'number') {
      skin = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.9 });
    }
    if (typeof hair === 'string' || typeof hair === 'number') {
      hair = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.9 });
    }
    const g = new THREE.Group();
    const body = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.56, 4, 8), coat);
    torso.position.y = 1.0;
    torso.castShadow = true;
    body.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), skin);
    head.position.y = 1.52;
    head.castShadow = true;
    body.add(head);
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    hairCap.position.y = 1.56;
    body.add(hairCap);
    const armGeo = new THREE.CapsuleGeometry(0.06, 0.42, 3, 5);
    const armL = new THREE.Mesh(armGeo, coat);
    armL.position.set(-0.32, 1.05, 0);
    body.add(armL);
    const armR = new THREE.Mesh(armGeo, coat);
    armR.position.set(0.32, 1.05, 0);
    body.add(armR);
    const legGeo = new THREE.CapsuleGeometry(0.075, 0.46, 3, 5);
    const legL = new THREE.Mesh(legGeo, trouserMat);
    legL.position.set(-0.12, 0.46, 0);
    body.add(legL);
    const legR = new THREE.Mesh(legGeo, trouserMat);
    legR.position.set(0.12, 0.46, 0);
    body.add(legR);
    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.3), shoeMat);
    shoeL.position.set(-0.12, 0.08, 0.05);
    body.add(shoeL);
    const shoeR = shoeL.clone();
    shoeR.position.x = 0.12;
    body.add(shoeR);
    if (bag) {
      const bagMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.48, 0.16), bagMat);
      bagMesh.position.set(0.38, 0.58, 0.12);
      bagMesh.castShadow = true;
      body.add(bagMesh);
    }
    body.scale.setScalar(scale);
    g.add(body);
    g.userData = { body, head, armL, armR, legL, legR, torso, coat, skin };
    return g;
  }

  // waiting people and walkers
  const walkers = [];
  const sidewalkPaths = [
    [[-54, -100], [-54, 120]], [[-66, 120], [-66, -100]],
    [[-270, -54], [-80, -54]], [[-80, -66], [-270, -66]],
    [[-54, 150], [-54, 300]], [[66, 90], [66, 300]],
    [[-174, -150], [-174, 40]], [[174, -80], [174, 60]],
    [[-40, 54], [40, 54]], [[-54, 74], [54, 74]],
    [[90, 66], [170, 66]], [[90, 54], [170, 54]],
    [[-270, 120], [-200, 120]], [[-200, 130], [-270, 130]],
  ];
  for (let i = 0; i < 16; i++) {
    const path = sidewalkPaths[i % sidewalkPaths.length];
    const person = makePerson({ bag: i % 4 === 0, scale: rand(0.92, 1.05) });
    const a = rand(0, 1);
    person.position.set(
      path[0][0] + (path[1][0] - path[0][0]) * a,
      0.02,
      path[0][1] + (path[1][1] - path[0][1]) * a,
    );
    scene.add(person);
    walkers.push({
      person,
      from: new THREE.Vector3(path[0][0], 0, path[0][1]),
      to: new THREE.Vector3(path[1][0], 0, path[1][1]),
      t: a,
      dir: rng() < 0.5 ? 1 : -1,
      speed: rand(0.015, 0.034),
      phase: rand(0, 10),
    });
  }
  // people taking a moment in the square
  const squareSpots = [
    [-31, 22, 0.4], [19, 27, -0.6], [28, -19, 1.2], [-24, -29, 0.2],
    [11, -38, -1.1], [-10, 40, 2.2], [37, 8, -1.6], [-38, -7, 0.9],
    [14, 12, 1.7], [-13, 16, -0.3],
  ];
  for (let i = 0; i < squareSpots.length; i++) {
    const person = makePerson({ bag: i === 2 || i === 7, scale: 0.9 + (i % 3) * 0.04 });
    const [x, z, rot] = squareSpots[i];
    person.position.set(x, 0.02, z);
    person.rotation.y = rot;
    scene.add(person);
    walkers.push({
      person,
      from: person.position.clone(),
      to: person.position.clone().add(new THREE.Vector3(rand(-8, 8), 0, rand(-8, 8))),
      t: 0,
      dir: 1,
      speed: 0.003,
      phase: rand(0, 10),
      idle: true,
    });
  }

  // one very good dog
  const dog = new THREE.Group();
  const dogBody = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.35, 0.32), new THREE.MeshStandardMaterial({ color: 0xb98955, roughness: 0.9 }));
  dogBody.position.y = 0.38;
  dog.add(dogBody);
  const dogHead = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.28), new THREE.MeshStandardMaterial({ color: 0xc79861, roughness: 0.9 }));
  dogHead.position.set(0.43, 0.52, 0);
  dog.add(dogHead);
  for (const [lx, lz] of [[-0.24, -0.1], [-0.24, 0.1], [0.24, -0.1], [0.24, 0.1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), new THREE.MeshStandardMaterial({ color: 0x8e663d, roughness: 0.9 }));
    leg.position.set(lx, 0.17, lz);
    dog.add(leg);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: 0xc79861, roughness: 0.9 }));
  tail.position.set(-0.48, 0.47, 0);
  tail.rotation.z = 0.55;
  dog.add(tail);
  dog.position.set(6, 0.02, 26);
  dog.rotation.y = -0.7;
  scene.add(dog);
  updates.push((dt, t) => {
    dog.rotation.y = -0.7 + Math.sin(t * 0.5) * 0.14;
    tail.rotation.z = 0.55 + Math.sin(t * 7) * 0.35;
  });

  updates.push((dt, t) => {
    for (const walker of walkers) {
      const d = walker.from.distanceTo(walker.to);
      if (walker.idle) {
        walker.person.rotation.y += Math.sin(t * 0.3 + walker.phase) * 0.0004;
        walker.person.userData.body.position.y = Math.sin(t * 1.2 + walker.phase) * 0.006;
        continue;
      }
      walker.t += (dt * walker.speed * walker.dir) / Math.max(1, d);
      if (walker.t > 1) { walker.t = 1; walker.dir = -1; }
      if (walker.t < 0) { walker.t = 0; walker.dir = 1; }
      const x = walker.from.x + (walker.to.x - walker.from.x) * walker.t;
      const z = walker.from.z + (walker.to.z - walker.from.z) * walker.t;
      walker.person.position.set(x, 0.02, z);
      walker.person.rotation.y = Math.atan2((walker.to.x - walker.from.x) * walker.dir, (walker.to.z - walker.from.z) * walker.dir);
      const swing = Math.sin(t * 5 + walker.phase) * 0.34;
      walker.person.userData.legL.rotation.x = swing;
      walker.person.userData.legR.rotation.x = -swing;
      walker.person.userData.armL.rotation.x = -swing * 0.75;
      walker.person.userData.armR.rotation.x = swing * 0.75;
      walker.person.userData.body.position.y = Math.abs(Math.sin(t * 5 + walker.phase)) * 0.025;
    }
  });

  // ---------------------------------------------------------------- traffic
  const traffic = [];
  const carColors = [0xe7e2d4, 0x4b8baa, 0xdf6450, 0xedc33f, 0x50885e, 0x7b64a5, 0x253f56, 0xdb8750, 0xc7c9c0];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.22, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.24, 8);
  hubGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1e2324, roughness: 0.9 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x9b9d96, roughness: 0.35, metalness: 0.6 });
  const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffe9c0, emissive: 0x4a3718, emissiveIntensity: 0.25, roughness: 0.3 });
  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xd84135, toneMapped: false });
  const trafficGlassMat = new THREE.MeshStandardMaterial({ color: 0x2a3d42, roughness: 0.16, metalness: 0.25 });

  function makeCar(color, opts = {}) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.22 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(1.85, 0.55, 4.2, 2, 0.2), bodyMat);
    body.position.y = 0.62;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.58, 2.15, 2, 0.2), trafficGlassMat);
    cabin.position.set(0, 1.12, -0.12);
    cabin.castShadow = true;
    g.add(cabin);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1.7), bodyMat);
    roof.position.set(0, 1.43, -0.12);
    g.add(roof);
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.22), new THREE.MeshStandardMaterial({ color: 0x333a38, roughness: 0.8 }));
    bumper.position.set(0, 0.4, 2.09);
    g.add(bumper);
    for (const [wx, wz] of [[-0.9, 1.35], [0.9, 1.35], [-0.9, -1.35], [0.9, -1.35]]) {
      const wheel = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      const hub = new THREE.Mesh(hubGeo, hubMat);
      wheel.add(tire, hub);
      wheel.position.set(wx, 0.36, wz);
      g.add(wheel);
    }
    for (const lx of [-0.62, 0.62]) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.08), headlightMat);
      light.position.set(lx, 0.72, 2.12);
      g.add(light);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.17, 0.08), taillightMat);
      tail.position.set(lx, 0.72, -2.12);
      g.add(tail);
    }
    if (opts.taxi) {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.22, 0.3), new THREE.MeshBasicMaterial({ color: 0xffe0a0, toneMapped: false }));
      sign.position.set(0, 1.6, -0.1);
      g.add(sign);
    }
    if (opts.bus) {
      g.scale.setScalar(1.65);
    }
    g.userData = { body, roof };
    return g;
  }

  function blockLoop(x0, z0, x1, z1, lane = 4.2) {
    const pts = [
      new THREE.Vector3(x0 + lane, 0, z0 + lane),
      new THREE.Vector3(x1 - lane, 0, z0 + lane),
      new THREE.Vector3(x1 - lane, 0, z1 - lane),
      new THREE.Vector3(x0 + lane, 0, z1 - lane),
    ];
    return new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.1);
  }

  const loops = [
    blockLoop(-60, -60, 60, 60, 4.5),
    blockLoop(60, -60, 180, 60, 4.4),
    blockLoop(60, 60, 180, 180, 4.4),
    blockLoop(-180, -180, -60, -60, 4.4),
    blockLoop(-180, 60, -60, 180, 4.4),
  ];
  const loopLengths = loops.map((l) => l.getLength());
  for (let i = 0; i < 11; i++) {
    const loopIndex = i % loops.length;
    const loop = loops[loopIndex];
    const isBus = i === 8;
    const isTaxi = i === 2 || i === 7;
    const car = makeCar(isTaxi ? 0xe9bb3b : pick(carColors), { taxi: isTaxi, bus: isBus });
    car.position.copy(loop.getPointAt(0));
    scene.add(car);
    traffic.push({
      car,
      loop,
      length: loopLengths[loopIndex],
      t: (i / 11 + (loopIndex % 2) * 0.31) % 1,
      speed: isBus ? 9 : rand(8, 13),
      taxi: isTaxi,
    });
  }
  updates.push((dt) => {
    for (const trafficCar of traffic) {
      trafficCar.t = (trafficCar.t + (dt * trafficCar.speed) / trafficCar.length) % 1;
      const p = trafficCar.loop.getPointAt(trafficCar.t);
      const tangent = trafficCar.loop.getTangentAt(trafficCar.t);
      trafficCar.car.position.set(p.x, 0.01, p.z);
      trafficCar.car.rotation.y = Math.atan2(tangent.x, tangent.z);
      trafficCar.car.userData.body.position.y = 0.62 + Math.sin(trafficCar.t * 40) * 0.005;
    }
  });

  // Parked cars give the kerbs a little life and make the streets feel narrower.
  const parkingBlacklist = [
    [20, 60], [-20, 60], [0, 300], [-150, -60], [-240, -180], [120, 60],
    [120, -180], [-240, 60], [-180, 120], [300, 120], [120, 180], [-120, 180], [-300, 260], [120, -60],
  ];
  const nearPickup = (x, z) => parkingBlacklist.some(([bx, bz]) => Math.hypot(x - bx, z - bz) < 10);
  let parkedCount = 0;
  for (const road of ROADS) {
    if (parkedCount >= 22) break;
    for (let i = 1; i < road.points.length; i++) {
      const [ax, az] = road.points[i - 1];
      const [bx, bz] = road.points[i];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 70) continue;
      const ux = dx / len;
      const uz = dz / len;
      const nx = -uz;
      const nz = ux;
      for (let d = 38; d < len - 30; d += 53) {
        if (parkedCount >= 22) break;
        const side = rng() < 0.5 ? 1 : -1;
        const cx = ax + ux * d + nx * (road.width * 0.5 - 1.15) * side;
        const cz = az + uz * d + nz * (road.width * 0.5 - 1.15) * side;
        const nearest = graph.nearestNode(cx, cz);
        if (nearest && Math.hypot(nearest.x - cx, nearest.z - cz) < 20) continue;
        if (Math.abs(cx) > 350 || Math.abs(cz) > 350) continue;
        if (nearPickup(cx, cz)) continue;
        const car = makeCar(pick(carColors));
        car.position.set(cx, 0.01, cz);
        const along = Math.atan2(ux * side, uz * side);
        car.rotation.y = along;
        scene.add(car);
        addCircleCollider(cx, cz, 2.0, 'parkedcar');
        parkedCount++;
      }
    }
  }
  world.parkedCount = parkedCount;

  // cyclists
  const cyclists = [];
  for (const [px, pz, dir, length, rotation] of [[-174, -40, 1, 120, 0], [174, 40, -1, 100, Math.PI], [-66, 20, 1, 120, 0], [-54, 110, -1, 100, Math.PI]]) {
    const g = new THREE.Group();
    const bikeMat = new THREE.MeshStandardMaterial({ color: 0x253b3e, roughness: 0.7, metalness: 0.35 });
    for (const wz of [-0.55, 0.55]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 6, 14), bikeMat);
      wheel.position.set(0, 0.4, wz);
      g.add(wheel);
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.05), bikeMat);
    frame.position.set(0, 0.65, 0);
    g.add(frame);
    const rider = makePerson({ coat: pick(coatMats), scale: 0.82 });
    rider.position.set(0, 0.2, 0);
    rider.rotation.x = -0.1;
    g.add(rider);
    g.position.set(px, 0.02, pz);
    g.rotation.y = rotation;
    scene.add(g);
    cyclists.push({ g, px, pz, dir, length, speed: rand(3.2, 4.6), t: rand(0, 1) });
  }
  updates.push((dt) => {
    for (const c of cyclists) {
      c.t += (dt * c.speed) / c.length;
      if (c.t > 1) c.t -= 1;
      const forward = c.t * c.length - c.length * 0.5;
      c.g.position.set(c.px, 0.02, c.pz + forward * c.dir);
      c.g.position.y = 0.02 + Math.abs(Math.sin(c.t * 90)) * 0.01;
    }
  });

  // ---------------------------------------------------------------- birds
  const birdGeo = new THREE.BufferGeometry();
  birdGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, -0.4, 0.08, -0.18, -0.4, 0.02, 0.2,
    0, 0, 0, 0.4, 0.02, 0.2, 0.4, 0.08, -0.18,
  ], 3));
  birdGeo.computeVertexNormals();
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x292e2c, side: THREE.DoubleSide });
  const birds = [];
  for (let i = 0; i < 14; i++) {
    const bird = new THREE.Mesh(birdGeo, birdMat);
    bird.scale.setScalar(rand(0.8, 1.4));
    scene.add(bird);
    birds.push({ mesh: bird, a: rand(0, Math.PI * 2), r: rand(40, 120), y: rand(22, 46), speed: rand(0.06, 0.15), phase: rand(0, 8) });
  }
  updates.push((dt, t) => {
    for (const b of birds) {
      b.a += dt * b.speed;
      b.mesh.position.set(Math.cos(b.a) * b.r, b.y + Math.sin(t * 0.6 + b.phase) * 2.5, -40 + Math.sin(b.a) * b.r * 0.7);
      b.mesh.rotation.y = -b.a + Math.PI / 2;
      b.mesh.rotation.z = Math.sin(t * 6 + b.phase) * 0.3;
    }
  });

  // slow golden dust motes
  const moteCount = 170;
  const motePositions = new Float32Array(moteCount * 3);
  const moteData = [];
  for (let i = 0; i < moteCount; i++) {
    const x = rand(-230, 280);
    const z = rand(-250, 260);
    const y = rand(0.6, 11);
    motePositions[i * 3] = x;
    motePositions[i * 3 + 1] = y;
    motePositions[i * 3 + 2] = z;
    moteData.push({ x, z, y, phase: rand(0, 10), speed: rand(0.1, 0.35) });
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const moteMat = new THREE.PointsMaterial({
    map: makeRadialTexture('rgba(255,235,185,0.9)', 'rgba(255,221,155,0)'),
    color: 0xffe2ad,
    size: 0.14,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.frustumCulled = false;
  scene.add(motes);
  updates.push((dt, t) => {
    for (let i = 0; i < moteData.length; i++) {
      const m = moteData[i];
      motePositions[i * 3] = m.x + Math.sin(t * 0.11 * m.speed + m.phase) * 5;
      motePositions[i * 3 + 1] = m.y + Math.sin(t * 0.23 + m.phase) * 0.7;
      motePositions[i * 3 + 2] = m.z + Math.cos(t * 0.09 * m.speed + m.phase) * 4;
    }
    moteGeo.attributes.position.needsUpdate = true;
  });
  world.moteMaterial = moteMat;

  // ---------------------------------------------------------------- world clock
  const clockStart = 19 * 60 + 12;
  let worldMinutes = clockStart;
  updates.push((dt) => {
    worldMinutes += dt * 0.32;
  });

  // ---------------------------------------------------------------- lighting state
  const current = {
    top: new THREE.Color(PRESETS.golden.skyTop),
    horizon: new THREE.Color(PRESETS.golden.skyHorizon),
    ground: new THREE.Color(PRESETS.golden.skyGround),
    sunColor: new THREE.Color(PRESETS.golden.sunColor),
    hemiSky: new THREE.Color(PRESETS.golden.hemiSky),
    hemiGround: new THREE.Color(PRESETS.golden.hemiGround),
    fog: new THREE.Color(PRESETS.golden.fogColor),
    cloud: new THREE.Color(PRESETS.golden.cloudColor),
    sunIntensity: PRESETS.golden.sunIntensity,
    sunElevation: PRESETS.golden.sunElevation,
    sunAzimuth: PRESETS.golden.sunAzimuth,
    hemiIntensity: PRESETS.golden.hemiIntensity,
    fogNear: PRESETS.golden.fogNear,
    fogFar: PRESETS.golden.fogFar,
    exposure: PRESETS.golden.exposure,
    bloom: PRESETS.golden.bloom,
    starOpacity: PRESETS.golden.starOpacity,
    moonOpacity: PRESETS.golden.moonOpacity,
    windowGlow: PRESETS.golden.windowGlow,
    lampGlow: PRESETS.golden.lampGlow,
    cityGlow: PRESETS.golden.cityGlow,
  };
  const target = { ...current };
  let currentPreset = 'golden';
  let timeSinceSwitch = 0;

  function applyPreset(name) {
    const p = PRESETS[name] || PRESETS.golden;
    currentPreset = name in PRESETS ? name : 'golden';
    timeSinceSwitch = 0;
    target.top.setHex(p.skyTop);
    target.horizon.setHex(p.skyHorizon);
    target.ground.setHex(p.skyGround);
    target.sunColor.setHex(p.sunColor);
    target.hemiSky.setHex(p.hemiSky);
    target.hemiGround.setHex(p.hemiGround);
    target.fog.setHex(p.fogColor);
    target.cloud.setHex(p.cloudColor);
    target.sunIntensity = p.sunIntensity;
    target.sunElevation = p.sunElevation;
    target.sunAzimuth = p.sunAzimuth;
    target.hemiIntensity = p.hemiIntensity;
    target.fogNear = p.fogNear;
    target.fogFar = p.fogFar;
    target.exposure = p.exposure;
    target.bloom = p.bloom;
    target.starOpacity = p.starOpacity;
    target.moonOpacity = p.moonOpacity;
    target.windowGlow = p.windowGlow;
    target.lampGlow = p.lampGlow;
    target.cityGlow = p.cityGlow;
    world.headlightsOn = p.headlights;
    world.presetLabel = p.label;
    world.presetClock = p.clock;
    world.timeOfDay = currentPreset;
  }

  const sunTmp = new THREE.Vector3();
  world.update = (dt, elapsed, focus) => {
    for (const fn of updates) fn(dt, elapsed);
    timeSinceSwitch += dt;
    const k = 1 - Math.exp(-dt * 1.8);
    for (const key of ['top', 'horizon', 'ground', 'sunColor', 'hemiSky', 'hemiGround', 'fog', 'cloud']) {
      current[key].lerp(target[key], k);
    }
    for (const key of ['sunIntensity', 'sunElevation', 'sunAzimuth', 'hemiIntensity', 'fogNear', 'fogFar', 'exposure', 'bloom', 'starOpacity', 'moonOpacity', 'windowGlow', 'lampGlow', 'cityGlow']) {
      current[key] = damp(current[key], target[key], 1.8, dt);
    }
    skyUniforms.topColor.value.copy(current.top);
    skyUniforms.horizonColor.value.copy(current.horizon);
    skyUniforms.groundColor.value.copy(current.ground);
    skyUniforms.sunColor.value.copy(current.sunColor);
    skyUniforms.sunStrength.value = current.sunIntensity * 0.2;
    skyUniforms.starStrength.value = current.starOpacity;
    skyUniforms.moonStrength.value = current.moonOpacity;
    skyUniforms.time.value = elapsed;

    const elev = THREE.MathUtils.degToRad(current.sunElevation);
    const az = THREE.MathUtils.degToRad(current.sunAzimuth);
    sunDirVec.set(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev)).normalize();
    skyUniforms.sunDir.value.copy(sunDirVec);
    skyUniforms.moonDir.value.copy(moonDirVec);
    starMat.opacity = current.starOpacity;

    const lightDir = currentPreset === 'night' ? moonDirVec : sunDirVec;
    const focusPos = focus || new THREE.Vector3(0, 0, 0);
    sun.position.copy(focusPos).addScaledVector(lightDir, 150);
    sun.target.position.copy(focusPos);
    sun.target.updateMatrixWorld();
    sun.color.copy(current.sunColor);
    sun.intensity = current.sunIntensity;
    hemi.color.copy(current.hemiSky);
    hemi.groundColor.copy(current.hemiGround);
    hemi.intensity = current.hemiIntensity;
    fill.color.set(currentPreset === 'night' ? 0x8fa9cf : currentPreset === 'day' ? 0xe3edf1 : 0xffd6b0);
    fill.intensity = currentPreset === 'night' ? 0.12 : currentPreset === 'day' ? 0.34 : 0.38;
    ambient.color.set(currentPreset === 'night' ? 0x4f6384 : currentPreset === 'day' ? 0xdce8ea : 0xffddb8);
    ambient.intensity = currentPreset === 'night' ? 0.06 : currentPreset === 'day' ? 0.1 : 0.2;
    scene.fog.color.copy(current.fog);
    scene.fog.near = current.fogNear;
    scene.fog.far = current.fogFar;
    renderer.toneMappingExposure = current.exposure;
    if (world.composer) world.composer.bloomPass.strength = current.bloom;
    world.currentLight = current;
    world.currentPreset = currentPreset;
    litWindowMat.opacity = current.windowGlow;
    if (world.litWindows) world.litWindows.visible = current.windowGlow > 0.01;
    lampBulbMat.color.copy(new THREE.Color(0xffd48b).multiplyScalar(0.35 + current.lampGlow * 1.8));
    glowMat.opacity = current.lampGlow * 0.85;
    cloudMat.color.copy(current.cloud);
    cloudMat.emissive.setHex(currentPreset === 'night' ? 0x0c1220 : currentPreset === 'day' ? 0x3a332b : 0x6a3e2c);
    cloudMat.emissiveIntensity = currentPreset === 'night' ? 0.1 : currentPreset === 'day' ? 0.16 : 0.34;
    // gentle cloud drift
    for (const c of clouds) {
      c.g.position.x += c.speed * dt;
      if (c.g.position.x > 1100) c.g.position.x = -1100;
    }
    world.worldMinutes = worldMinutes;
    world.timeSinceSwitch = timeSinceSwitch;
    world.sun = sun;
    world.skyUniforms = skyUniforms;
    world.sky = sky;
    world.stars = stars;
    world.clouds = clouds;
    world.birds = birds;
  };

  world.setTimeOfDay = applyPreset;
  world.timeOfDay = 'golden';
  world.headlightsOn = false;
  world.colliders = colliders;
  world.pavedRects = pavedRects;
  world.graph = graph;
  world.scene = scene;
  world.sunLight = sun;
  world.glowingMaterials = nightMaterials;
  world.isOnRoad = (x, z) => isOnRoadNetwork(x, z, 2.4) || pavedRects.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
  world.makePerson = makePerson;
  world.makeBench = makeBench;
  world.makeCar = makeCar;
  world.landmarks = {};
  world.getClock = () => {
    const total = (worldMinutes + (currentPreset === 'day' ? -240 : currentPreset === 'night' ? 236 : 0)) % (24 * 60);
    const h = Math.floor(total / 60) % 24;
    const m = Math.floor(total % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  world.presetLabel = PRESETS.golden.label;
  world.presetClock = PRESETS.golden.clock;
  applyPreset('golden');
  // run a warm-up update so the first frame is fully lit
  world.update(0.016, 0, new THREE.Vector3(-60, 0, 100));

  return world;
}

export const TIME_PRESET_ORDER = ['golden', 'day', 'night'];
export const WORLD_PRESETS = PRESETS;

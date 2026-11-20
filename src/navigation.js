import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { makeLabelTexture, makeBeamTexture } from './lib/textures.js';

function makeChevronGeometry() {
  const positions = new Float32Array([
    -1.05, 0, -0.6, 0, 0, 1.05, 0, 0, -0.12,
    0, 0, 1.05, 1.05, 0, -0.6, 0, 0, -0.12,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

export function createRouteGuide(scene) {
  const lineMaterial = new LineMaterial({
    color: 0x7de9d4,
    linewidth: 4.2,
    transparent: true,
    opacity: 0.85,
    dashed: true,
    dashSize: 2.8,
    gapSize: 2.4,
    dashScale: 0.7,
    depthWrite: false,
    toneMapped: false,
  });
  const geometry = new LineGeometry();
  geometry.setPositions([0, 0.2, 0, 0, 0.2, 0]);
  const line = new Line2(geometry, lineMaterial);
  line.computeLineDistances();
  line.frustumCulled = false;
  line.visible = false;
  scene.add(line);

  const maxChevrons = 220;
  const chevronMat = new THREE.MeshBasicMaterial({
    color: 0x8df1df,
    transparent: true,
    opacity: 0.62,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const chevrons = new THREE.InstancedMesh(makeChevronGeometry(), chevronMat, maxChevrons);
  chevrons.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  chevrons.frustumCulled = false;
  chevrons.visible = false;
  chevrons.renderOrder = 2;
  scene.add(chevrons);

  const dummy = new THREE.Object3D();
  const state = {
    points: [],
    totalLength: 0,
    dash: 0,
    visible: false,
    width: window.innerWidth,
    height: window.innerHeight,
  };

  function clear() {
    state.points = [];
    state.totalLength = 0;
    state.visible = false;
    line.visible = false;
    chevrons.visible = false;
  }

  function setPath(points) {
    if (!points || points.length < 2) return clear();
    state.points = points.map((p) => new THREE.Vector3(p.x, 0.17, p.z));
    const flat = [];
    const chevronTransforms = [];
    let length = 0;
    for (let i = 0; i < state.points.length; i++) {
      const p = state.points[i];
      flat.push(p.x, p.y, p.z);
      if (i > 0) {
        const prev = state.points[i - 1];
        const dx = p.x - prev.x;
        const dz = p.z - prev.z;
        const segLen = Math.hypot(dx, dz);
        if (segLen > 0.001) {
          const yaw = Math.atan2(dx, dz);
          for (let d = Math.ceil((length + 5) / 10.5) * 10.5; d < length + segLen - 3; d += 10.5) {
            const t = (d - length) / segLen;
            chevronTransforms.push({
              x: prev.x + dx * t,
              z: prev.z + dz * t,
              yaw,
            });
          }
          length += segLen;
        }
      }
    }
    if (flat.length < 6) return clear();
    geometry.setPositions(flat);
    line.computeLineDistances();
    line.visible = true;
    state.totalLength = length;
    state.visible = true;

    const count = Math.min(chevronTransforms.length, maxChevrons);
    for (let i = 0; i < count; i++) {
      const c = chevronTransforms[i];
      dummy.position.set(c.x, 0.14, c.z);
      dummy.rotation.set(0, c.yaw, 0);
      dummy.scale.set(0.72, 1, 0.72);
      dummy.updateMatrix();
      chevrons.setMatrixAt(i, dummy.matrix);
    }
    chevrons.count = count;
    chevrons.instanceMatrix.needsUpdate = true;
    chevrons.visible = count > 0;
  }

  function update(dt) {
    if (!state.visible) return;
    state.dash -= dt * 4.2;
    lineMaterial.dashOffset = state.dash;
    chevronMat.opacity = 0.48 + Math.sin(performance.now() * 0.004) * 0.16;
  }

  function setResolution(width, height) {
    state.width = width;
    state.height = height;
    lineMaterial.resolution.set(width, height);
  }

  setResolution(window.innerWidth, window.innerHeight);

  return {
    line,
    chevrons,
    clear,
    setPath,
    update,
    setResolution,
    get visible() { return state.visible; },
    get points() { return state.points; },
    get totalLength() { return state.totalLength; },
  };
}

export function createDestinationMarker(scene, options = {}) {
  const color = options.color ?? 0xf3c463;
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    toneMapped: true,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.075, 8, 48), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  group.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.04, 6, 40), ringMat);
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = 0.13;
  group.add(ring2);

  const beamTexture = makeBeamTexture();
  const beamMat = new THREE.MeshBasicMaterial({
    map: beamTexture,
    color,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: true,
  });
  for (const rot of [0, Math.PI / 2]) {
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 8), beamMat);
    beam.position.y = 4;
    beam.rotation.y = rot;
    group.add(beam);
  }

  const diamondMat = new THREE.MeshBasicMaterial({ color, toneMapped: true });
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), diamondMat);
  diamond.position.y = 4.2;
  group.add(diamond);

  const labelTexture = makeLabelTexture(options.label || 'PICKUP', options.sub || '', '#fff1d0');
  const labelMat = new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.9 });
  const label = new THREE.Sprite(labelMat);
  label.scale.set(6.4, 1.8, 1);
  label.position.y = 6.3;
  group.add(label);

  let time = 0;
  return {
    group,
    diamond,
    ring,
    ring2,
    setPosition(x, z) { group.position.set(x, 0, z); },
    setColor(newColor) {
      ringMat.color.set(newColor);
      beamMat.color.set(newColor);
      diamondMat.color.set(newColor);
    },
    setLabel(title, sub) {
      const tex = makeLabelTexture(title, sub, '#fff1d0');
      labelMat.map.dispose();
      labelMat.map = tex;
      labelMat.needsUpdate = true;
    },
    show() { group.visible = true; },
    hide() { group.visible = false; },
    update(dt, focus) {
      if (!group.visible) return;
      time += dt;
      if (focus) label.visible = group.position.distanceTo(focus) > 26;
      diamond.position.y = 4.2 + Math.sin(time * 2.1) * 0.16;
      diamond.rotation.y += dt * 1.2;
      ring.rotation.z += dt * 0.22;
      ring2.rotation.z -= dt * 0.4;
      const pulse = 1 + Math.sin(time * 1.7) * 0.065;
      ring.scale.setScalar(pulse);
      ring2.scale.setScalar(2 - pulse * 0.35);
      beamMat.opacity = 0.18 + Math.sin(time * 1.3) * 0.06;
    },
  };
}

export function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  }
  return total;
}

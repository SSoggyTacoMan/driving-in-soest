import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeCanvasTexture } from './lib/textures.js';

function makeCheckerTexture() {
  return makeCanvasTexture(512, 64, (ctx, w, h) => {
    ctx.fillStyle = '#f5c642';
    ctx.fillRect(0, 0, w, h);
    const size = 32;
    for (let y = 0; y < h / size; y++) {
      for (let x = 0; x < w / size; x++) {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = '#1d2524';
          ctx.fillRect(x * size, y * size, size, size);
        }
      }
    }
  });
}

function makeTaxiSignTexture() {
  const texture = makeCanvasTexture(512, 192, (ctx, w, h) => {
    ctx.fillStyle = '#fff6d9';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2b3a33';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, w - 14, h - 14);
    ctx.fillStyle = '#25352f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 92px system-ui, sans-serif';
    ctx.fillText('TAXI', w / 2, h / 2 + 4);
    ctx.fillStyle = '#c8912f';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText('SOEST', w / 2, h - 31);
  });
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function makeDoorTexture() {
  const texture = makeCanvasTexture(512, 160, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(25,44,39,0.86)';
    ctx.beginPath();
    ctx.roundRect(6, 34, w - 12, h - 68, 18);
    ctx.fill();
    ctx.fillStyle = '#f7ecd1';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 36px Georgia, serif';
    ctx.fillText('SOEST TAXI', w / 2, h / 2 - 1);
    ctx.fillStyle = '#e4b34f';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText('SINDS 1924', w / 2, h / 2 + 28);
  });
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function makeSoftParticleTexture() {
  return makeCanvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(233,215,176,0.8)');
    g.addColorStop(0.5, 'rgba(218,196,151,0.28)');
    g.addColorStop(1, 'rgba(218,196,151,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export class Taxi {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.root = new THREE.Group();
    this.root.name = 'playerTaxi';
    scene.add(this.root);

    this.velocity = new THREE.Vector2(0, 0);
    this.yaw = Math.PI;
    this.steer = 0;
    this.accelPitch = 0;
    this.accelRoll = 0;
    this.wheelSpin = 0;
    this.handbrake = 0;
    this.drifting = false;
    this.offroad = false;
    this.impact = 0;
    this.onImpact = null;
    this.lastRoadState = true;
    this.lastPosition = new THREE.Vector3();
    this.airborne = 0;

    const bodyYellow = new THREE.MeshStandardMaterial({ color: 0xf4c33f, roughness: 0.35, metalness: 0.12 });
    const bodyDeep = new THREE.MeshStandardMaterial({ color: 0xc88b22, roughness: 0.48, metalness: 0.1 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1c3033, roughness: 0.08, metalness: 0.42, transparent: true, opacity: 0.9 });
    const blackTrim = new THREE.MeshStandardMaterial({ color: 0x1d2524, roughness: 0.66 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd4d6ce, roughness: 0.2, metalness: 0.8 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x171c1d, roughness: 0.9 });
    const hubMat = new THREE.MeshStandardMaterial({ color: 0xc7c4b8, roughness: 0.25, metalness: 0.8 });
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfff3cf, toneMapped: false });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x8a201d, emissive: 0xff3b2e, emissiveIntensity: 0.1, roughness: 0.35 });
    this.tailMaterial = tailMat;

    const bodyGroup = new THREE.Group();
    this.root.add(bodyGroup);
    this.bodyGroup = bodyGroup;

    const lower = new THREE.Mesh(new RoundedBoxGeometry(1.94, 0.64, 4.5, 3, 0.24), bodyYellow);
    lower.position.y = 0.62;
    lower.castShadow = true;
    lower.receiveShadow = true;
    bodyGroup.add(lower);

    const hood = new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.22, 1.05, 2, 0.14), bodyYellow);
    hood.position.set(0, 0.98, 1.48);
    hood.castShadow = true;
    bodyGroup.add(hood);

    const trunk = new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.18, 0.8, 2, 0.12), bodyYellow);
    trunk.position.set(0, 0.96, -1.66);
    trunk.castShadow = true;
    bodyGroup.add(trunk);

    const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.72, 0.68, 2.22, 3, 0.22), glassMat);
    cabin.position.set(0, 1.23, -0.08);
    cabin.castShadow = true;
    bodyGroup.add(cabin);

    const roof = new THREE.Mesh(new RoundedBoxGeometry(1.62, 0.13, 1.72, 2, 0.12), bodyYellow);
    roof.position.set(0, 1.6, -0.16);
    roof.castShadow = true;
    bodyGroup.add(roof);

    // window pillars
    for (const [px, pz] of [[-0.86, 0.95], [0.86, 0.95], [-0.86, -1.15], [0.86, -1.15]]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.66, 0.09), bodyDeep);
      pillar.position.set(px, 1.21, pz);
      bodyGroup.add(pillar);
    }

    // door seams and handles
    for (const side of [-1, 1]) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 1.7), bodyDeep);
      seam.position.set(side * 0.975, 0.69, 0.15);
      bodyGroup.add(seam);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.3), chrome);
      handle.position.set(side * 0.99, 0.96, -0.35);
      bodyGroup.add(handle);
    }

    // checker strips
    const checkerTex = makeCheckerTexture();
    checkerTex.repeat.set(4, 1);
    const checkerMat = new THREE.MeshBasicMaterial({ map: checkerTex, side: THREE.DoubleSide, toneMapped: false });
    for (const side of [-1, 1]) {
      const checker = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.19), checkerMat);
      checker.position.set(side * 0.981, 0.57, 0);
      checker.rotation.y = side * Math.PI / 2;
      bodyGroup.add(checker);
    }

    // door logos
    const doorTex = makeDoorTexture();
    const doorMat = new THREE.MeshBasicMaterial({ map: doorTex, transparent: true, side: THREE.DoubleSide, toneMapped: true });
    for (const side of [-1, 1]) {
      const logo = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 0.74), doorMat);
      logo.position.set(side * 0.992, 0.72, -0.15);
      logo.rotation.y = side * Math.PI / 2;
      bodyGroup.add(logo);
    }

    // bumpers
    for (const z of [2.28, -2.28]) {
      const bumper = new THREE.Mesh(new RoundedBoxGeometry(1.98, 0.18, 0.22, 2, 0.08), blackTrim);
      bumper.position.set(0, 0.43, z);
      bodyGroup.add(bumper);
    }
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.22, 0.06), blackTrim);
    grille.position.set(0, 0.72, 2.28);
    bodyGroup.add(grille);
    for (let i = 0; i < 5; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.018, 0.03), chrome);
      bar.position.set(0, 0.64 + i * 0.045, 2.315);
      bodyGroup.add(bar);
    }

    // lights
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.08), headlightMat);
      lamp.position.set(side * 0.62, 0.75, 2.27);
      bodyGroup.add(lamp);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.08), tailMat);
      tail.position.set(side * 0.63, 0.75, -2.27);
      bodyGroup.add(tail);
    }

    // mirrors
    for (const side of [-1, 1]) {
      const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.04), blackTrim);
      stalk.position.set(side * 0.9, 1.08, 0.86);
      bodyGroup.add(stalk);
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.09), bodyYellow);
      mirror.position.set(side * 1.0, 1.1, 0.9);
      bodyGroup.add(mirror);
    }

    // roof sign
    const signTex = makeTaxiSignTexture();
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.33, 0.3), signMat);
    sign.position.set(0, 1.83, -0.15);
    sign.castShadow = true;
    bodyGroup.add(sign);
    this.sign = sign;

    // antenna
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4), chrome);
    antenna.position.set(-0.58, 1.86, -1.3);
    bodyGroup.add(antenna);
    const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), tailMat);
    antennaTip.position.set(-0.58, 2.13, -1.3);
    bodyGroup.add(antennaTip);

    // wheels
    const wheelGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.24, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.26, 10);
    hubGeo.rotateZ(Math.PI / 2);
    const spokeGeo = new THREE.BoxGeometry(0.26, 0.05, 0.28);
    this.wheels = [];
    for (const [wx, wz, front] of [[-0.94, 1.42, true], [0.94, 1.42, true], [-0.94, -1.42, false], [0.94, -1.42, false]]) {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(wx, 0.4, wz);
      this.root.add(steerPivot);
      const spin = new THREE.Group();
      steerPivot.add(spin);
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      tire.castShadow = true;
      spin.add(tire);
      const hub = new THREE.Mesh(hubGeo, hubMat);
      spin.add(hub);
      for (let s = 0; s < 4; s++) {
        const spoke = new THREE.Mesh(spokeGeo, chrome);
        spoke.rotation.x = (s / 4) * Math.PI * 2;
        spin.add(spoke);
      }
      this.wheels.push({ steerPivot, spin, front });
    }

    // lights that only wake up when the town goes dark
    this.headlights = [];
    for (const side of [-1, 1]) {
      const spot = new THREE.SpotLight(0xffe4b5, 0, 42, Math.PI * 0.17, 0.55, 1.4);
      spot.position.set(side * 0.6, 0.75, 2.3);
      spot.target.position.set(side * 0.7, 0.1, 22);
      this.root.add(spot, spot.target);
      this.headlights.push(spot);
    }

    // dust
    const dustCount = 80;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustTex = makeSoftParticleTexture();
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      map: dustTex,
      color: 0xd4bf95,
      size: 0.7,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.dust = new THREE.Points(dustGeo, dustMat);
    this.dust.frustumCulled = false;
    this.root.parent?.add(this.dust);
    scene.add(this.dust);
    this.dustData = Array.from({ length: dustCount }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }));
    this.dustIndex = 0;
    this.dustPositions = dustPositions;
    this.dustGeo = dustGeo;

    this.root.position.set(20, 0, 60);
    this.root.rotation.y = -Math.PI / 2;
    this.lastPosition.copy(this.root.position);
    this.onGround = true;
  }

  reset(x = 20, z = 60, yaw = -Math.PI / 2) {
    this.root.position.set(x, 0, z);
    this.yaw = yaw;
    this.root.rotation.y = yaw;
    this.velocity.set(0, 0);
    this.steer = 0;
    this.wheelSpin = 0;
    this.bodyGroup.position.y = 0;
    this.bodyGroup.rotation.set(0, 0, 0);
    this.dustData.forEach((d) => { d.life = 0; });
  }

  get position() {
    return this.root.position;
  }

  get speed() {
    return this.velocity.length();
  }

  get speedKmh() {
    return this.speed * 3.6;
  }

  get forward() {
    return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  get signedSpeed() {
    const f = this.forward;
    return this.velocity.x * f.x + this.velocity.z * f.z;
  }

  setHeadlights(on) {
    for (const light of this.headlights) light.intensity = on ? 34 : 0;
  }

  update(dt, input, world) {
    const throttle = Math.max(0, Math.min(1, input.throttle || 0));
    const brake = Math.max(0, Math.min(1, input.brake || 0));
    const steerInput = Math.max(-1, Math.min(1, input.steer || 0));
    const handbrake = !!input.handbrake;
    const onRoad = world.isOnRoad(this.root.position.x, this.root.position.z);
    const forward = new THREE.Vector2(Math.sin(this.yaw), Math.cos(this.yaw));
    const right = new THREE.Vector2(forward.y, -forward.x);
    const signed = this.velocity.dot(forward);

    this.offroad = !onRoad;
    const maxSpeed = onRoad ? 27 : 11;
    const engineForce = onRoad ? 8.2 : 5.2;

    this.steer = THREE.MathUtils.damp(this.steer, steerInput, 6.5, dt);

    if (throttle > 0) {
      this.velocity.x += forward.x * engineForce * throttle * dt;
      this.velocity.y += forward.y * engineForce * throttle * dt;
    }
    if (brake > 0) {
      if (signed > 0.6) {
        this.velocity.x -= forward.x * 18 * brake * dt;
        this.velocity.y -= forward.y * 18 * brake * dt;
      } else {
        this.velocity.x -= forward.x * 7.5 * brake * dt;
        this.velocity.y -= forward.y * 7.5 * brake * dt;
      }
    }
    if (handbrake) {
      this.velocity.multiplyScalar(Math.exp(-1.6 * dt));
    } else {
      this.velocity.multiplyScalar(Math.exp(-(onRoad ? 0.24 : 0.8) * dt));
    }

    // Lateral grip: enough to feel planted, low enough to let the taxi slide in a handbrake turn.
    const lateral = this.velocity.dot(right);
    const grip = handbrake ? 1.3 : onRoad ? 8.2 : 4.5;
    this.velocity.x -= right.x * lateral * (1 - Math.exp(-grip * dt));
    this.velocity.y -= right.y * lateral * (1 - Math.exp(-grip * dt));

    const speed = this.velocity.length();
    if (speed > maxSpeed) {
      this.velocity.multiplyScalar(THREE.MathUtils.damp(1, maxSpeed / speed, 3, dt));
    }

    // yaw rate falls off a little at speed, but remains playful
    if (speed > 0.15) {
      const dir = signed < -0.2 ? -1 : 1;
      const steerRate = (speed / (1 + speed * 0.07)) * this.steer * (handbrake ? 0.52 : 0.24) * dir;
      this.yaw += steerRate * dt;
    }

    this.root.position.x += this.velocity.x * dt;
    this.root.position.z += this.velocity.y * dt;
    this.root.rotation.y = this.yaw;

    // collisions against the hand-built world
    this.resolveCollisions(world);

    // keep the car in the broad polder
    if (Math.abs(this.root.position.x) > 820) {
      this.root.position.x = THREE.MathUtils.clamp(this.root.position.x, -820, 820);
      this.velocity.x *= -0.2;
    }
    if (Math.abs(this.root.position.z) > 820) {
      this.root.position.z = THREE.MathUtils.clamp(this.root.position.z, -820, 820);
      this.velocity.y *= -0.2;
    }

    const actualSpeed = this.velocity.length();
    const signedNow = this.velocity.dot(forward);
    this.drifting = handbrake && actualSpeed > 5;
    this.handbrake = handbrake ? 1 : 0;

    // wheel spin + steering
    const spinDelta = (actualSpeed * dt) / 0.37;
    this.wheelSpin += spinDelta * (signedNow < -0.2 ? -1 : 1);
    for (const wheel of this.wheels) {
      wheel.spin.rotation.x = this.wheelSpin;
      if (wheel.front) wheel.steerPivot.rotation.y = this.steer * 0.5;
    }

    // body pitch / roll and a tiny idle bounce
    const targetPitch = THREE.MathUtils.clamp(-(throttle * 0.035) + brake * 0.024, -0.04, 0.04);
    const targetRoll = THREE.MathUtils.clamp(this.steer * Math.min(actualSpeed, 24) * 0.0019, -0.035, 0.035);
    this.accelPitch = THREE.MathUtils.damp(this.accelPitch, targetPitch, 4, dt);
    this.accelRoll = THREE.MathUtils.damp(this.accelRoll, targetRoll, 4, dt);
    const roadBob = onRoad ? Math.sin(performance.now() * 0.006 + actualSpeed) * 0.006 * (actualSpeed / 30) : Math.sin(performance.now() * 0.02) * 0.012;
    this.bodyGroup.position.y = roadBob;
    this.bodyGroup.rotation.x = this.accelPitch;
    this.bodyGroup.rotation.z = this.accelRoll;
    this.sign.rotation.z = Math.sin(performance.now() * 0.003) * 0.008;

    // brake lights
    this.tailMaterial.emissiveIntensity = brake > 0.05 ? 2.4 : 0.1;

    // dust kicked up off-road / while drifting
    this.updateDust(dt, onRoad, actualSpeed, forward, handbrake);

    this.lastPosition.copy(this.root.position);
    this.impact = Math.max(0, this.impact - dt * 2);
    return { onRoad, speed: actualSpeed };
  }

  resolveCollisions(world) {
    const halfLength = 1.25;
    const radius = 1.04;
    let hit = false;
    for (let iteration = 0; iteration < 2; iteration++) {
      for (const offset of [-halfLength, halfLength]) {
        const fx = Math.sin(this.yaw);
        const fz = Math.cos(this.yaw);
        let cx = this.root.position.x + fx * offset;
        let cz = this.root.position.z + fz * offset;
        for (const c of world.colliders) {
          if (c.type === 'box') {
            const closestX = Math.max(c.x - c.hw, Math.min(cx, c.x + c.hw));
            const closestZ = Math.max(c.z - c.hd, Math.min(cz, c.z + c.hd));
            let dx = cx - closestX;
            let dz = cz - closestZ;
            let dist = Math.hypot(dx, dz);
            if (dist < radius) {
              if (dist < 0.0001) {
                // centre is inside the footprint: push along the shallowest axis
                const toRight = c.x + c.hw - cx;
                const toLeft = cx - (c.x - c.hw);
                const toFront = c.z + c.hd - cz;
                const toBack = cz - (c.z - c.hd);
                const min = Math.min(toRight, toLeft, toFront, toBack);
                if (min === toRight) cx += radius + 0.01;
                else if (min === toLeft) cx -= radius + 0.01;
                else if (min === toFront) cz += radius + 0.01;
                else cz -= radius + 0.01;
                dx = 0;
                dz = 0;
                dist = 0;
              } else {
                const push = (radius - dist) / dist;
                cx += dx * push;
                cz += dz * push;
              }
              hit = true;
            }
          } else if (c.type === 'circle') {
            const dx = cx - c.x;
            const dz = cz - c.z;
            const dist = Math.hypot(dx, dz);
            const minDist = c.r + radius;
            if (dist < minDist && dist > 0.0001) {
              const push = (minDist - dist) / dist;
              cx += dx * push;
              cz += dz * push;
              hit = true;
            }
          }
        }
        const shiftX = cx - this.root.position.x - Math.sin(this.yaw) * offset;
        const shiftZ = cz - this.root.position.z - Math.cos(this.yaw) * offset;
        this.root.position.x += shiftX;
        this.root.position.z += shiftZ;
      }
    }
    if (hit) {
      const speed = this.velocity.length();
      if (speed > 1.2) {
        this.impact = Math.min(1, this.impact + speed / 20);
        if (this.onImpact) this.onImpact(speed);
        this.velocity.multiplyScalar(-0.16);
      } else {
        this.velocity.multiplyScalar(0.5);
      }
    }
  }

  updateDust(dt, onRoad, speed, forward, handbrake) {
    const wantDust = (!onRoad && speed > 3) || (handbrake && speed > 6);
    for (const d of this.dustData) {
      if (d.life > 0) {
        d.life -= dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.z += d.vz * dt;
        d.vy += dt * 0.35;
        d.vx *= 0.985;
        d.vz *= 0.985;
      }
    }
    if (wantDust) {
      for (let i = 0; i < 2; i++) {
        const d = this.dustData[this.dustIndex];
        this.dustIndex = (this.dustIndex + 1) % this.dustData.length;
        const side = Math.random() < 0.5 ? -1 : 1;
        const rightX = forward.y;
        const rightZ = -forward.x;
        d.x = this.root.position.x - forward.x * 1.55 + rightX * side * 0.8;
        d.y = 0.18;
        d.z = this.root.position.z - forward.y * 1.55 + rightZ * side * 0.8;
        d.vx = -forward.x * 0.8 + (Math.random() - 0.5) * 0.8;
        d.vy = 0.5 + Math.random() * 0.7;
        d.vz = -forward.y * 0.8 + (Math.random() - 0.5) * 0.8;
        d.life = 0.8 + Math.random() * 0.7;
        d.max = d.life;
      }
    }
    for (let i = 0; i < this.dustData.length; i++) {
      const d = this.dustData[i];
      this.dustPositions[i * 3] = d.x;
      this.dustPositions[i * 3 + 1] = d.life > 0 ? d.y : -10;
      this.dustPositions[i * 3 + 2] = d.z;
    }
    this.dustGeo.attributes.position.needsUpdate = true;
    this.dust.material.opacity = wantDust ? 0.34 : 0.22;
  }
}

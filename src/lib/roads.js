import * as THREE from 'three';

/**
 * The road grid is deliberately hand-tuned: Soest is not a perfect chessboard,
 * but the town centre reads best with a clear set of long streets and a few
 * crooked local lanes. Coordinates are metres; -z is north.
 */
export const ROADS = [
  { name: 'Van Weedestraat', width: 12, main: true, points: [[-60, -400], [-60, 380]] },
  { name: 'Burgemeester Grothestraat', width: 11.5, main: true, points: [[-390, -60], [390, -60]] },
  { name: 'Steenstraat', width: 10.5, main: true, points: [[60, -360], [60, 350]] },
  { name: 'Nieuwestraat', width: 10, main: true, points: [[-350, 60], [370, 60]] },
  { name: 'Kerkstraat', width: 9, main: false, points: [[-180, -340], [-180, 350]] },
  { name: 'Rademakerstraat', width: 9.5, main: true, points: [[180, -350], [180, 350]] },
  { name: 'Beetzlaan', width: 9, main: false, points: [[-360, -180], [360, -180]] },
  { name: 'Stationsweg', width: 9.5, main: true, points: [[-350, 180], [360, 180]] },
  { name: 'Dalweg', width: 9, main: false, points: [[-350, 300], [390, 300]] },
  { name: 'Soesterbergsestraat', width: 9, main: false, points: [[-300, -390], [-300, 370]] },
  { name: 'Duinweg', width: 8.5, main: false, points: [[300, -340], [300, 330]] },
  { name: 'Paleislaan', width: 8, main: false, points: [[-360, -300], [360, -300]] },
  { name: 'Stationsplein', width: 7, main: false, points: [[-10, 300], [-10, 316]] },
  { name: 'Paleisoprit', width: 6.5, main: false, points: [[-240, -180], [-240, -198]] },
];

function keyFor(x, z) {
  // Intersection points land within a few centimetres of each other on each
  // road because their parameters are rounded; a half-metre bucket merges them
  // into one graph node without ever touching the 18 m walking nodes.
  return `${Math.round(x * 2) / 2},${Math.round(z * 2) / 2}`;
}

export function buildGraph(roads = ROADS) {
  const segments = [];
  for (const road of roads) {
    for (let i = 1; i < road.points.length; i++) {
      const [x1, z1] = road.points[i - 1];
      const [x2, z2] = road.points[i];
      if (Math.hypot(x2 - x1, z2 - z1) < 0.1) continue;
      segments.push({ road, x1, z1, x2, z2, cuts: [0, 1] });
    }
  }

  const EPS = 1e-7;
  for (let i = 0; i < segments.length; i++) {
    const a = segments[i];
    for (let j = i + 1; j < segments.length; j++) {
      const b = segments[j];
      const den = (a.x1 - a.x2) * (b.z1 - b.z2) - (a.z1 - a.z2) * (b.x1 - b.x2);
      if (Math.abs(den) < EPS) continue;
      const t = ((a.x1 - b.x1) * (b.z1 - b.z2) - (a.z1 - b.z1) * (b.x1 - b.x2)) / den;
      const u = ((a.x1 - b.x1) * (a.z1 - a.z2) - (a.z1 - b.z1) * (a.x1 - a.x2)) / den;
      if (t >= -1e-6 && t <= 1 + 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) {
        a.cuts.push(Math.min(1, Math.max(0, t)));
        b.cuts.push(Math.min(1, Math.max(0, u)));
      }
    }
  }

  const nodes = [];
  const nodeByKey = new Map();
  const nodeAt = (x, z) => {
    const key = keyFor(x, z);
    let node = nodeByKey.get(key);
    if (!node) {
      node = { id: nodes.length, x, z, edges: [] };
      nodes.push(node);
      nodeByKey.set(key, node);
    }
    return node;
  };

  const edges = [];
  for (const segment of segments) {
    const { road, x1, z1, x2, z2 } = segment;
    const cuts = [...new Set(segment.cuts.map((t) => Math.round(t * 10000) / 10000))].sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const t0 = cuts[i];
      const t1 = cuts[i + 1];
      if (t1 - t0 < 0.0005) continue;
      const ax = x1 + (x2 - x1) * t0;
      const az = z1 + (z2 - z1) * t0;
      const bx = x1 + (x2 - x1) * t1;
      const bz = z1 + (z2 - z1) * t1;
      const length = Math.hypot(bx - ax, bz - az);
      if (length < 0.4) continue;
      const pieces = Math.max(1, Math.ceil(length / 18));
      let previous = nodeAt(ax, az);
      for (let piece = 1; piece <= pieces; piece++) {
        const t = piece / pieces;
        const px = ax + (bx - ax) * t;
        const pz = az + (bz - az) * t;
        const current = nodeAt(px, pz);
        if (previous.id !== current.id) {
          const pieceLength = length / pieces;
          const edge = { a: previous, b: current, length: pieceLength, road };
          previous.edges.push({ node: current, length: pieceLength, edge });
          current.edges.push({ node: previous, length: pieceLength, edge });
          edges.push(edge);
        }
        previous = current;
      }
    }
  }

  const nearestNode = (x, z, maxDistance = Infinity) => {
    let best = null;
    let bestD = maxDistance * maxDistance;
    for (const node of nodes) {
      const d = (node.x - x) ** 2 + (node.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = node;
      }
    }
    return best;
  };

  const nearestNodes = (x, z, count = 5, maxDistance = 45) => {
    return nodes
      .map((node) => ({ node, d: Math.hypot(node.x - x, node.z - z) }))
      .filter((entry) => entry.d <= maxDistance)
      .sort((a, b) => a.d - b.d)
      .slice(0, count)
      .map((entry) => entry.node);
  };

  function aStar(start, end) {
    if (!start || !end) return null;
    if (start === end) return { ids: [start.id], cost: 0 };
    const open = new Set([start.id]);
    const cameFrom = new Map();
    const gScore = new Map(nodes.map((n) => [n.id, Infinity]));
    const fScore = new Map(nodes.map((n) => [n.id, Infinity]));
    gScore.set(start.id, 0);
    fScore.set(start.id, Math.hypot(start.x - end.x, start.z - end.z));

    while (open.size) {
      let currentId = null;
      let currentF = Infinity;
      for (const id of open) {
        const value = fScore.get(id);
        if (value < currentF) {
          currentF = value;
          currentId = id;
        }
      }
      if (currentId === end.id) break;
      open.delete(currentId);
      const current = nodes[currentId];
      for (const link of current.edges) {
        const tentative = gScore.get(currentId) + link.length;
        if (tentative < gScore.get(link.node.id)) {
          cameFrom.set(link.node.id, currentId);
          gScore.set(link.node.id, tentative);
          fScore.set(link.node.id, tentative + Math.hypot(link.node.x - end.x, link.node.z - end.z));
          open.add(link.node.id);
        }
      }
    }

    if (!cameFrom.has(end.id) && start !== end) return null;
    const ids = [end.id];
    let cursor = end.id;
    while (cameFrom.has(cursor)) {
      cursor = cameFrom.get(cursor);
      ids.push(cursor);
    }
    ids.reverse();
    return { ids, cost: gScore.get(end.id) };
  }

  function findPath(from, to) {
    const startCandidates = nearestNodes(from.x, from.z, 5, 50);
    const endCandidates = nearestNodes(to.x, to.z, 5, 50);
    if (!startCandidates.length || !endCandidates.length) {
      const fallbackStart = nearestNode(from.x, from.z);
      const fallbackEnd = nearestNode(to.x, to.z);
      if (!fallbackStart || !fallbackEnd) return [];
      const fallback = aStar(fallbackStart, fallbackEnd);
      if (!fallback) return [];
      return [...fallback.ids.map((id) => ({ x: nodes[id].x, z: nodes[id].z })), { x: to.x, z: to.z }];
    }

    let best = null;
    for (const start of startCandidates) {
      for (const end of endCandidates) {
        const result = aStar(start, end);
        if (!result) continue;
        const cost = Math.hypot(from.x - start.x, from.z - start.z)
          + result.cost
          + Math.hypot(end.x - to.x, end.z - to.z);
        if (!best || cost < best.cost) best = { ...result, start, end, cost };
      }
    }
    if (!best) return [];

    const points = best.ids.map((id) => ({ x: nodes[id].x, z: nodes[id].z }));
    if (Math.hypot(points[0].x - from.x, points[0].z - from.z) > 0.6) {
      points.unshift({ x: from.x, z: from.z });
    }
    if (Math.hypot(points[points.length - 1].x - to.x, points[points.length - 1].z - to.z) > 0.6) {
      points.push({ x: to.x, z: to.z });
    }
    return points;
  }

  return { nodes, edges, nearestNode, findPath };
}

export function distanceToRoad(road, x, z) {
  let best = Infinity;
  const pts = road.points;
  for (let i = 1; i < pts.length; i++) {
    const x1 = pts[i - 1][0];
    const z1 = pts[i - 1][1];
    const x2 = pts[i][0];
    const z2 = pts[i][1];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / l2));
    const px = x1 + dx * t;
    const pz = z1 + dz * t;
    best = Math.min(best, Math.hypot(x - px, z - pz));
  }
  return best;
}

function addQuad(positions, uvs, ax, az, bx, bz, width, y, uScale = 1, vScale = 1, offsetStart = 0, offsetEnd = 0) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  const a0x = ax + nx * width * 0.5;
  const a0z = az + nz * width * 0.5;
  const a1x = ax - nx * width * 0.5;
  const a1z = az - nz * width * 0.5;
  const b0x = bx + nx * width * 0.5;
  const b0z = bz + nz * width * 0.5;
  const b1x = bx - nx * width * 0.5;
  const b1z = bz - nz * width * 0.5;
  const v0 = offsetStart * vScale;
  const v1 = (len + offsetStart) * vScale;
  positions.push(
    a0x, y, a0z,
    b0x, y, b0z,
    b1x, y, b1z,
    a0x, y, a0z,
    b1x, y, b1z,
    a1x, y, a1z,
  );
  uvs.push(
    1, v0,
    1, v1,
    0, v1,
    1, v0,
    0, v1,
    0, v0,
  );
}

export function buildRoads(scene, textures) {
  const graph = buildGraph();
  const asphaltPositions = [];
  const asphaltUVs = [];
  const walkPositions = [];
  const walkUVs = [];
  const edgePositions = [];
  const edgeUVs = [];
  const curbPositions = [];
  const curbUVs = [];

  const roadIndex = new Map(ROADS.map((road, index) => [road, index]));

  for (const road of ROADS) {
    const yBase = 0.022 + (roadIndex.get(road) || 0) * 0.0007;
    const pts = road.points;
    let running = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1];
      const [bx, bz] = pts[i];
      const len = Math.hypot(bx - ax, bz - az);
      addQuad(asphaltPositions, asphaltUVs, ax, az, bx, bz, road.width, yBase, 1, 1 / 11, running, running);
      running += len;
    }
  }

  // Sidewalks are built per graph edge so that intersections stay clean.
  for (const edge of graph.edges) {
    const { a, b, road } = edge;
    const walkWidth = Math.max(1.8, Math.min(2.9, road.width * 0.24));
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    const half = road.width * 0.5;
    const inner = half + walkWidth * 0.5 + 0.06;
    const y = 0.058;
    for (const side of [-1, 1]) {
      const ax = a.x + nx * inner * side;
      const az = a.z + nz * inner * side;
      const bx = b.x + nx * inner * side;
      const bz = b.z + nz * inner * side;
      addQuad(walkPositions, walkUVs, ax, az, bx, bz, walkWidth, y, 1, 1 / 2.6, 0, 0);
      const cx = a.x + nx * (inner + walkWidth * 0.5) * side;
      const cz = a.z + nz * (inner + walkWidth * 0.5) * side;
      const dx2 = b.x + nx * (inner + walkWidth * 0.5) * side;
      const dz2 = b.z + nz * (inner + walkWidth * 0.5) * side;
      addQuad(curbPositions, curbUVs, cx, cz, dx2, dz2, 0.16, 0.061, 1, 1, 0, 0);
      if (road.main) {
        const ex = a.x + nx * (half - 0.45) * side;
        const ez = a.z + nz * (half - 0.45) * side;
        const fx = b.x + nx * (half - 0.45) * side;
        const fz = b.z + nz * (half - 0.45) * side;
        addQuad(edgePositions, edgeUVs, ex, ez, fx, fz, 0.11, 0.032, 1, 1, 0, 0);
      }
    }
  }

  const makeMesh = (positions, uvs, material, receiveShadow = true) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = receiveShadow;
    scene.add(mesh);
    return mesh;
  };

  const asphaltTex = textures.asphalt.clone();
  asphaltTex.needsUpdate = true;
  asphaltTex.wrapS = asphaltTex.wrapT = THREE.RepeatWrapping;
  const asphaltMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    color: 0xd6d2c7,
    roughness: 0.95,
    metalness: 0,
  });
  const walkTex = textures.paving.clone();
  walkTex.needsUpdate = true;
  walkTex.wrapS = walkTex.wrapT = THREE.RepeatWrapping;
  const walkMat = new THREE.MeshStandardMaterial({
    map: walkTex,
    color: 0xd8cebb,
    roughness: 0.96,
  });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x9d978c, roughness: 0.95 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xd6cfba, roughness: 0.8 });

  const asphalt = makeMesh(asphaltPositions, asphaltUVs, asphaltMat);
  const walks = makeMesh(walkPositions, walkUVs, walkMat);
  makeMesh(curbPositions, curbUVs, curbMat);
  makeMesh(edgePositions, edgeUVs, edgeMat);

  return { graph, asphalt, walks };
}

/**
 * Dashed centre lines, generated after the graph so we can keep intersections tidy.
 */
export function addRoadMarkings(scene, graph) {
  const dashes = [];
  const geo = new THREE.PlaneGeometry(0.16, 2.6);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xe5dcc4,
    roughness: 0.85,
    emissive: 0x1a160e,
    emissiveIntensity: 0.08,
  });

  for (const edge of graph.edges) {
    if (!edge.road.main) continue;
    const { a, b } = edge;
    const len = edge.length;
    if (len < 16) continue;
    const dx = (b.x - a.x) / len;
    const dz = (b.z - a.z) / len;
    const yaw = Math.atan2(dx, dz);
    const usableStart = 7;
    const usableEnd = len - 7;
    for (let d = usableStart; d < usableEnd; d += 9) {
      const x = a.x + dx * d;
      const z = a.z + dz * d;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, 0.038, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
        new THREE.Vector3(1, 1, 1),
      );
      dashes.push(m);
    }
  }

  const inst = new THREE.InstancedMesh(geo, mat, dashes.length);
  dashes.forEach((matrix, i) => inst.setMatrixAt(i, matrix));
  inst.instanceMatrix.needsUpdate = true;
  inst.receiveShadow = true;
  scene.add(inst);
  return inst;
}

export function addCrosswalks(scene, roadSeeds, textureAtlas) {
  const stripes = [];
  const geo = new THREE.PlaneGeometry(0.55, 3.3);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: 0xe9e1ce, roughness: 0.78 });
  const dummy = new THREE.Object3D();
  for (const [x, z, yaw] of roadSeeds) {
    for (let i = -3; i <= 3; i++) {
      dummy.position.set(x + Math.cos(yaw) * i * 1.15, 0.041, z + Math.sin(yaw) * i * 1.15);
      dummy.rotation.set(0, yaw + Math.PI / 2, 0);
      dummy.updateMatrix();
      stripes.push(dummy.matrix.clone());
    }
  }
  const inst = new THREE.InstancedMesh(geo, mat, stripes.length);
  stripes.forEach((m, i) => inst.setMatrixAt(i, m));
  inst.instanceMatrix.needsUpdate = true;
  inst.receiveShadow = true;
  scene.add(inst);
  return inst;
}

export function isOnRoadNetwork(x, z, padding = 2.2, includeLocal = true) {
  for (const road of ROADS) {
    if (!includeLocal && !road.main) continue;
    if (distanceToRoad(road, x, z) < road.width * 0.5 + padding) return true;
  }
  return false;
}

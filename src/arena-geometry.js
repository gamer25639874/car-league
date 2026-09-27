export const ARENA_SHAPE = Object.freeze({
  // Rocket League standard soccar arena, converted from Unreal centimetres
  // to metres. The playable floor is 81.92 x 102.4 m.
  halfWidth: 40.96,
  halfLength: 51.2,
  centerZ: 51.2,
  cornerRadius: 11.52,
  wallRadius: 2.56,
  ceilingY: 20.44,
  goalHalfWidth: 8.92755,
  goalOpeningHeight: 6.42775
});

function roundedRectangleContour(halfWidth, halfLength, radius, arcSegments = 10, edgeSegments = 8) {
  const r = Math.min(radius, halfWidth, halfLength);
  const points = [[-halfWidth + r, halfLength]];
  const endWallEdges = [];
  const appendLine = (end, segments, isEndWall = false) => {
    const start = points[points.length - 1];
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      points.push([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t]);
      endWallEdges.push(isEndWall);
    }
  };
  const appendArc = (cx, cz, from, to) => {
    for (let i = 1; i <= arcSegments; i++) {
      const angle = from + (to - from) * i / arcSegments;
      points.push([cx + r * Math.cos(angle), cz + r * Math.sin(angle)]);
      endWallEdges.push(false);
    }
  };

  appendLine([halfWidth - r, halfLength], edgeSegments, true);
  appendArc(halfWidth - r, halfLength - r, Math.PI / 2, 0);
  appendLine([halfWidth, -halfLength + r], edgeSegments);
  appendArc(halfWidth - r, -halfLength + r, 0, -Math.PI / 2);
  appendLine([-halfWidth + r, -halfLength], edgeSegments, true);
  appendArc(-halfWidth + r, -halfLength + r, -Math.PI / 2, -Math.PI);
  appendLine([-halfWidth, halfLength - r], edgeSegments);
  appendArc(-halfWidth + r, halfLength - r, Math.PI, Math.PI / 2);
  points.pop();
  return { points, endWallEdges };
}

function clipToDepth(points, boundary, keepGreater) {
  if (!points.length) return [];
  const inside = point => keepGreater ? point[1] >= boundary : point[1] <= boundary;
  const output = [];
  let previous = points[points.length - 1];
  let previousInside = inside(previous);
  for (const current of points) {
    const currentInside = inside(current);
    if (currentInside !== previousInside) {
      const t = (boundary - previous[1]) / (current[1] - previous[1]);
      output.push([previous[0] + (current[0] - previous[0]) * t, boundary]);
    }
    if (currentInside) output.push(current);
    previous = current;
    previousInside = currentInside;
  }
  return output;
}

export function createRoundedFloorMesh(THREE, material, {
  y = 0,
  centerZ = ARENA_SHAPE.centerZ,
  halfWidth = ARENA_SHAPE.halfWidth,
  halfLength = ARENA_SHAPE.halfLength,
  cornerRadius = ARENA_SHAPE.cornerRadius,
  depthStart = -halfLength,
  depthEnd = halfLength
} = {}) {
  const fullContour = roundedRectangleContour(halfWidth, halfLength, cornerRadius, 12, 10).points;
  const clipped = clipToDepth(clipToDepth(fullContour, depthStart, true), depthEnd, false);
  if (clipped.length < 3) return null;

  const shape = new THREE.Shape();
  shape.moveTo(clipped[0][0], -clipped[0][1]);
  for (let i = 1; i < clipped.length; i++) shape.lineTo(clipped[i][0], -clipped[i][1]);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  const positions = geometry.getAttribute('position');
  const uvs = geometry.getAttribute('uv');
  for (let i = 0; i < positions.count; i++) {
    uvs.setXY(i, (positions.getX(i) + halfWidth) / (2 * halfWidth), (-positions.getY(i) + halfLength) / (2 * halfLength));
  }
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, y, centerZ);
  mesh.receiveShadow = true;
  return mesh;
}

function roundedOffset(height, radius) {
  const h = Math.max(0, Math.min(radius, height));
  return Math.sqrt(Math.max(0, radius * radius - (radius - h) * (radius - h)));
}

function goalOpeningHalfWidthAt(height, shape) {
  const radius = Math.min(1.25, shape.goalHalfWidth * .12, shape.goalOpeningHeight * .18);
  const startRound = shape.goalOpeningHeight - radius;
  if (height <= startRound) return shape.goalHalfWidth;
  const rise = Math.min(radius, height - startRound);
  return shape.goalHalfWidth - radius + Math.sqrt(Math.max(0, radius * radius - (radius - rise) ** 2));
}

function ringAtHeight(height, shape = ARENA_SHAPE) {
  const radius = shape.wallRadius;
  const topDepth = shape.ceilingY - height;
  const offset = height < radius
    ? roundedOffset(height, radius)
    : topDepth < radius ? roundedOffset(topDepth, radius) : radius;
  return {
    height,
    halfWidth: shape.halfWidth + offset,
    halfLength: shape.halfLength + offset,
    cornerRadius: shape.cornerRadius + offset
  };
}

export function createRoundedArenaShell(THREE, scene, accentMaterials = [], shape = ARENA_SHAPE) {
  const heights = new Set();
  const bevelSteps = 16;
  const wallSteps = 12;
  for (let i = 0; i <= bevelSteps; i++) {
    heights.add(shape.wallRadius * i / bevelSteps);
    heights.add(shape.ceilingY - shape.wallRadius * i / bevelSteps);
  }
  for (let i = 1; i < wallSteps; i++) {
    heights.add(shape.wallRadius + (shape.ceilingY - shape.wallRadius * 2) * i / wallSteps);
  }
  heights.add(shape.goalOpeningHeight);
  const rows = [...heights].sort((a, b) => a - b).map(height => ringAtHeight(height, shape));
  const outlines = rows.map(row => roundedRectangleContour(row.halfWidth, row.halfLength, row.cornerRadius, 10, 48));
  const pointCount = outlines[0].points.length;
  const vertices = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const { height } = rows[rowIndex];
    for (const [x, z] of outlines[rowIndex].points) vertices.push(x, height, z + shape.centerZ);
  }

  const indices = [];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  for (let row = 0; row < rows.length - 1; row++) {
    const groupStart = indices.length;
    const y0 = rows[row].height;
    const y1 = rows[row + 1].height;
    for (let edge = 0; edge < pointCount; edge++) {
      const next = (edge + 1) % pointCount;
      const isGoalWall = outlines[row].endWallEdges[edge] && outlines[row + 1].endWallEdges[edge];
      const xMid = (outlines[row].points[edge][0] + outlines[row].points[next][0]) * .5;
      const openingHalfWidth = goalOpeningHalfWidthAt((y0 + y1) * .5, shape);
      if (isGoalWall && Math.abs(xMid) < openingHalfWidth && y1 <= shape.goalOpeningHeight + .001) continue;
      const a = row * pointCount + edge;
      const b = row * pointCount + next;
      const d = (row + 1) * pointCount + edge;
      const c = (row + 1) * pointCount + next;
      indices.push(a, b, d, b, c, d);
    }
    const groupCount = indices.length - groupStart;
    if (groupCount) geometry.addGroup(groupStart, groupCount, (y0 + y1) * .5 < 1.35 ? 0 : 1);
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const bumper = new THREE.MeshStandardMaterial({
    color: 0x182e40, metalness: .42, roughness: .4, side: THREE.DoubleSide
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x317ca7, metalness: .22, roughness: .36, clearcoat: .6,
    transparent: true, opacity: .24, depthWrite: false, side: THREE.DoubleSide
  });
  const shell = new THREE.Mesh(geometry, [bumper, glass]);
  shell.name = 'rounded-arena-wall-and-ceiling-transitions';
  shell.receiveShadow = true;
  scene.add(shell);

  const ceiling = createRoundedFloorMesh(THREE, new THREE.MeshPhysicalMaterial({
    color: 0x294961, metalness: .16, roughness: .6,
    transparent: true, opacity: .15, depthWrite: false, side: THREE.DoubleSide
  }), { y: shape.ceilingY, centerZ: shape.centerZ, halfWidth: shape.halfWidth, halfLength: shape.halfLength, cornerRadius: shape.cornerRadius });
  ceiling.name = 'rounded-arena-ceiling';
  ceiling.receiveShadow = false;
  scene.add(ceiling);

  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0x35b7ef, emissive: 0x0874ae, emissiveIntensity: 1.05,
    metalness: .42, roughness: .32
  });
  accentMaterials.push(railMaterial);
  const railHeight = 2.25;
  const railRing = ringAtHeight(railHeight, shape);
  const railOutline = roundedRectangleContour(railRing.halfWidth, railRing.halfLength, railRing.cornerRadius, 12, 12).points;
  const railPath = new THREE.CatmullRomCurve3(railOutline.map(([x, z]) => new THREE.Vector3(x, railHeight, z + shape.centerZ)), true, 'centripetal');
  const rail = new THREE.Mesh(new THREE.TubeGeometry(railPath, railOutline.length * 3, .105, 8, true), railMaterial);
  rail.name = 'rounded-arena-led-rail';
  rail.castShadow = false;
  scene.add(rail);
  return shell;
}

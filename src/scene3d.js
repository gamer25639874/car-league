/* Car Soccer 3D prototype — Vite + Three.js. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ARENA_SHAPE, createRoundedArenaShell, createRoundedFloorMesh } from './arena-geometry.js';
const canvas = document.querySelector('#arena');
const $ = selector => document.querySelector(selector);
const ui = {
  panel: $('#panel'), panelTitle: $('#panelTitle'), panelEyebrow: $('#panelEyebrow'), panelContent: $('#panelContent'),
  panelFoot: $('#panelFoot'), closePanel: $('#closePanel'), pause: $('#pauseButton'), garage: $('#garageButton'), play: $('#playButton'),
  settings: $('#settingsButton'), clips: $('#clipsButton'), record: $('#recordButton'), fullscreen: $('#fullscreenButton'),
  ballCam: $('#ballCamButton'), cameraState: $('#cameraState'), scoreboard: $('#scoreboard'), hint: $('#matchHint'),
  blueScore: $('#blueScore'), orangeScore: $('#orangeScore'), clock: $('#matchClock'), boostValue: $('#boostValue'),
  boostArc: $('#boostArc'), carLabel: $('#carLabel'), playLabel: $('#playLabel'), playSubLabel: $('#playSubLabel'),
  mapLabel: $('#mapLabel'), toast: $('#toast'), banner: $('#startBanner'), bannerCount: $('#bannerCount'), sponsor: $('#sponsorButton')
};

if (!THREE) throw new Error('No se pudo cargar Three.js desde vendor/three.min.js');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.info.autoReset = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x091522);
scene.fog = new THREE.Fog(0x0b1b2b, 90, 210);
const camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, .1, 280);
const clock = new THREE.Clock();
const cameraLookTarget = new THREE.Vector3();
let cameraLookInitialized = false;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), .42, .58, .8);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const cars = [
  { name: 'Octane', shape: 'realistic', model: 'octane', detail: 'Carrocería todoterreno' },
  { name: 'Fennec', shape: 'default', model: 'fennec', detail: 'Compacto y robusto' },
  { name: 'Dominus', shape: 'flat', model: 'dominus', detail: 'Perfil bajo de carreras' }
];
const carModels = {
  octane: { url: new URL('./models/octane.glb', import.meta.url).href, rotationY: Math.PI / 2 },
  fennec: { url: new URL('./models/fennec.glb', import.meta.url).href, rotationY: 0 },
  dominus: { url: new URL('./models/dominus.glb', import.meta.url).href, rotationY: 0 }
};
const palettes = ['#ff9b36', '#44a8ff', '#ef5d76', '#52d6a1', '#bc86ff', '#f6d455'];
const secondaryPalettes = ['#f3f7fb', '#13243a', '#44a8ff', '#ef5d76', '#52d6a1', '#f6d455'];
const wheelStyles = [
  { id: 'alloy', name: 'Aleación', color: '#c5d2df' },
  { id: 'rally', name: 'Rally', color: '#f3f4f6' },
  { id: 'neon', name: 'Neón', color: '#51d8ff' }
];
const boostStyles = [
  { id: 'standard', name: 'Estándar', detail: 'Azul eléctrico', color: '#49caff', secondary: '#d8f8ff' },
  { id: 'alpha', name: 'Alpha Boost', detail: 'Rastro dorado · Gold Rush', color: '#ffae24', secondary: '#fff1a8' },
  { id: 'dev', name: 'Dev Boost', detail: 'Llama cian de desarrollador', color: '#37f0c0', secondary: '#dcfff4' }
];
const accessories = [
  { id: 'none', name: 'Sin accesorio' },
  { id: 'spoiler', name: 'Alerón' },
  { id: 'antenna', name: 'Antena' },
  { id: 'ball', name: 'Balón mini' }
];
const defaultKeyBindings = {
  accelerate: 'KeyW', reverse: 'KeyS', left: 'KeyA', right: 'KeyD',
  boost: 'ShiftLeft', handbrake: 'ControlLeft', jump: 'Space', airRollLeft: 'KeyQ', airRollRight: 'KeyE',
  ballCam: 'KeyC', garage: 'KeyG', menu: 'KeyM'
};
const keyActions = [
  ['accelerate', 'Acelerar'], ['reverse', 'Reversa'], ['left', 'Girar a la izquierda'],
  ['right', 'Girar a la derecha'], ['boost', 'Impulso'], ['handbrake', 'Freno de mano / derrape'],
  ['jump', 'Saltar / doble salto'], ['airRollLeft', 'Giro aéreo izquierda'], ['airRollRight', 'Giro aéreo derecha'],
  ['ballCam', 'Ball cam'], ['garage', 'Abrir garaje'], ['menu', 'Menú de juego']
];
const defaultGamepadBindings = { accelerate: 7, reverse: 6, boost: 1, jump: 0, handbrake: 10, airRollLeft: 4, airRollRight: 5, ballCam: 3, garage: 2, menu: 9 };
const gamepadActions = [
  ['accelerate', 'Acelerar'], ['reverse', 'Reversa'], ['boost', 'Impulso'], ['handbrake', 'Freno de mano'],
  ['jump', 'Saltar / doble salto'], ['airRollLeft', 'Giro aéreo izquierda'], ['airRollRight', 'Giro aéreo derecha'],
  ['ballCam', 'Ball cam'], ['garage', 'Abrir garaje'], ['menu', 'Menú de juego']
];
const botProfiles = {
  rookie: { name: 'Novato', baseSpeed: 22, prediction: .34, horizon: .58, turnRate: 1.85, maxSpeed: 23, boostSpeed: 5, boostReserve: 38, chase: 1.35, acceleration: 18, boostAcceleration: 27, aerialDistance: 8, aerialHeight: 4.8, jumpCooldown: 1.9 },
  competitive: { name: 'Competitivo', baseSpeed: 25, prediction: .55, horizon: .82, turnRate: 2.45, maxSpeed: 28, boostSpeed: 7, boostReserve: 24, chase: 1.8, acceleration: 24, boostAcceleration: 36, aerialDistance: 13, aerialHeight: 7.2, jumpCooldown: 1.35 },
  expert: { name: 'Experto', baseSpeed: 29, prediction: .72, horizon: 1.02, turnRate: 3, maxSpeed: 31, boostSpeed: 8, boostReserve: 15, chase: 2, acceleration: 29, boostAcceleration: 43, aerialDistance: 17, aerialHeight: 10, jumpCooldown: .95 }
};
const savedPreferences = (() => {
  try {
    const value = JSON.parse(localStorage.getItem('car-soccer-preferences') || '{}');
    return value && typeof value === 'object' ? value : {};
  }
  catch { return {}; }
})();
function savedValue(value, validValues, fallback) { return validValues.includes(value) ? value : fallback; }
function savedNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, minimum, maximum) : fallback;
}
const maps = [
  { name: 'Neon Dome', sky: 0x0b1b2b, grass: 0x369454, stripe: 0x32884c, accent: 0x43bbff },
  { name: 'Sunset Arena', sky: 0x3b2941, grass: 0x4a9854, stripe: 0x43894d, accent: 0xffb44e },
  { name: 'Ice Field', sky: 0x19384c, grass: 0x54a5a8, stripe: 0x488f9a, accent: 0x8deaff }
];
const FIELD = ARENA_SHAPE;
const FIELD_START_Z = FIELD.centerZ - FIELD.halfLength;
const FIELD_END_Z = FIELD.centerZ + FIELD.halfLength;
const GOAL_DEPTH = 8.8;
const GOAL_NEAR_Z = FIELD_START_Z;
const GOAL_FAR_Z = FIELD_END_Z;
const GOAL_NEAR_BACK_Z = GOAL_NEAR_Z - GOAL_DEPTH;
const GOAL_FAR_BACK_Z = GOAL_FAR_Z + GOAL_DEPTH;
const FIELD_WIDTH = FIELD.halfWidth * 2;
const FIELD_LENGTH = FIELD.halfLength * 2;
const SIDE_WALL_X = FIELD.halfWidth + FIELD.wallRadius;
const PLAYER_START_Z = GOAL_NEAR_Z + 12;
const BOT_START_Z = GOAL_FAR_Z - 12;
const BALL_RADIUS = .9125;
const BALL_RESTING_HEIGHT = .9315;
const state = {
  time: 0, menu: '', match: false, paused: false, ballCam: savedPreferences.ballCam !== false,
  cameraDistance: savedNumber(savedPreferences.cameraDistance, 7, 19, 11.5),
  cameraHeight: savedNumber(savedPreferences.cameraHeight, 2, 7, 3.5),
  cameraLookAhead: savedNumber(savedPreferences.cameraLookAhead, 2, 9, 4.5),
  ballCamStrength: savedNumber(savedPreferences.ballCamStrength, .15, 1, .68),
  botDifficulty: savedValue(savedPreferences.botDifficulty, Object.keys(botProfiles), 'competitive'),
  carIndex: Number.isInteger(savedPreferences.carIndex) && savedPreferences.carIndex >= 0 && savedPreferences.carIndex < cars.length ? savedPreferences.carIndex : 1,
  carColor: savedValue(savedPreferences.carColor, palettes, palettes[0]),
  secondaryColor: savedValue(savedPreferences.secondaryColor, secondaryPalettes, secondaryPalettes[0]),
  wheelStyle: savedValue(savedPreferences.wheelStyle, wheelStyles.map(style => style.id), 'alloy'),
  accessory: savedValue(savedPreferences.accessory, accessories.map(item => item.id), 'spoiler'),
  boostStyle: savedValue(savedPreferences.boostStyle, boostStyles.map(style => style.id), 'standard'),
  keyBindings: { ...defaultKeyBindings, ...(savedPreferences.keyBindings || {}) },
  gamepadBindings: { ...defaultGamepadBindings, ...(savedPreferences.gamepadBindings || {}) },
  remappingKey: '', captureGamepadAction: '', gamepad: null, gamepadConnected: false,
  lastGamepadButtons: [], gamepadActionsState: {}, mapIndex: 0,
  boost: 100, score: [0, 0], matchSeconds: 300, keys: new Set(),
  player: { x: 0, z: PLAYER_START_Z, speed: 0, vx: 0, vz: 0, angle: 0, y: 0, vy: 0, pitch: 0, roll: 0, surface: 'ground', wallSide: 0, wallAngle: 0, airJumps: 0, airTime: 0, jumpHeld: false, jumping: false },
  bot: { x: 4, z: BOT_START_Z, angle: Math.PI, speed: 0, vx: 0, vy: 0, vz: 0, y: 0, pitch: 0, roll: 0, surface: 'ground', wallSide: 0, wallAngle: 0, boost: 100, jumping: false, airTime: 0, jumpCooldown: 0, demolishedTimer: 0, boosting: false, behavior: 'attack' },
  ball: { x: -1.8, z: FIELD.centerZ - FIELD.halfLength * .54, y: BALL_RESTING_HEIGHT, vx: .45, vz: -.15, vy: 0 },
  boostPads: [], kickoffTimer: 0, playerHitCooldown: 0, cameraShake: 0,
  clipUrls: [], recorder: null, chunks: [], recording: false, toastTimer: 0, countdown: 0
};
const fieldMaterials = [], accentMaterials = [];
let playerCar, botCar, ballObject, ballShadow, playerWheels = [], botWheels = [], skyDome;

function standard(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: .72, metalness: .08, ...options });
}
function addBox(parent, width, height, depth, material, position, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = options.castShadow ?? true; mesh.receiveShadow = options.receiveShadow ?? false;
  if (options.castShadow === false) mesh.userData.noShadow = true;
  if (options.rotationY) mesh.rotation.y = options.rotationY;
  if (options.rotationX) mesh.rotation.x = options.rotationX;
  if (options.rotationZ) mesh.rotation.z = options.rotationZ;
  parent.add(mesh); return mesh;
}
function addRoundedBox(parent, width, height, depth, radius, material, position, options = {}) {
  const bevel = Math.min(radius, width / 2 - .002, height / 2 - .002, depth / 2 - .002);
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 3, Math.max(.002, bevel)), material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = options.castShadow ?? true; mesh.receiveShadow = options.receiveShadow ?? false;
  if (options.castShadow === false) mesh.userData.noShadow = true;
  if (options.rotationY) mesh.rotation.y = options.rotationY;
  if (options.rotationX) mesh.rotation.x = options.rotationX;
  if (options.rotationZ) mesh.rotation.z = options.rotationZ;
  parent.add(mesh); return mesh;
}
function addTube(parent, points, radius, material, segments = 100) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', .15);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 7, false), material);
  mesh.castShadow = true; parent.add(mesh); return mesh;
}
function addLoop(parent, points, radius, material, segments = 128) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2])), true, 'catmullrom', .12);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8, true), material);
  parent.add(mesh); return mesh;
}

function createImageBasedLighting() {
  const environment = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  const texture = generator.fromScene(environment, .04).texture;
  scene.environment = texture;
  scene.environmentIntensity = .3;
  environment.dispose(); generator.dispose();
}

function createTurfTexture() {
  const canvasTexture = document.createElement('canvas');
  canvasTexture.width = canvasTexture.height = 256;
  const ctx = canvasTexture.getContext('2d');
  ctx.fillStyle = '#8ba66b'; ctx.fillRect(0, 0, 256, 256);
  let seed = 194827;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 5200; i++) {
    const shade = Math.floor(random() * 48);
    ctx.fillStyle = random() > .5 ? `rgba(226,245,186,${.025 + random() * .09})` : `rgba(13,48,20,${.025 + random() * .1})`;
    const x = random() * 256, y = random() * 256;
    ctx.fillRect(x, y, .7 + random() * 1.2, 1 + shade % 5);
  }
  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 3);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function addLights() {
  scene.add(new THREE.HemisphereLight(0xb8d9ff, 0x243e2c, 1.35));
  const key = new THREE.DirectionalLight(0xffe7c5, 2.15);
  key.position.set(-32, 62, 28); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -75; key.shadow.camera.right = 75;
  key.shadow.camera.top = 100; key.shadow.camera.bottom = -75; key.shadow.camera.near = 1; key.shadow.camera.far = 180;
  key.shadow.bias = -.00018; key.shadow.normalBias = .025; scene.add(key);
  const cool = new THREE.DirectionalLight(0x67baff, 1.15); cool.position.set(35, 28, -45); scene.add(cool);
  const lightX = SIDE_WALL_X + 17;
  for (const x of [-lightX, lightX]) for (const z of [GOAL_NEAR_Z, FIELD.centerZ, GOAL_FAR_Z]) {
    const lamp = new THREE.SpotLight(0xe5f4ff, 980, 145, Math.PI / 4.5, .55, 1.4);
    lamp.position.set(x, FIELD.ceilingY + 2, z); lamp.target.position.set(0, 0, z); scene.add(lamp, lamp.target);
  }
}

function createGroundAndPitch() {
  const concrete = standard(0x172534, { roughness: .95 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), concrete);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.16, FIELD.centerZ); ground.receiveShadow = true; scene.add(ground);
  const turf = createTurfTexture();
  const turfMaterial = (color, bumpScale = .028) => standard(color, { roughness: .96, map: turf, bumpMap: turf, bumpScale });
  const baseMat = turfMaterial(0x286b42, .022);
  const base = createRoundedFloorMesh(THREE, baseMat, { y: -.04 });
  base.receiveShadow = true; scene.add(base);
  fieldMaterials.push(baseMat);
  const stripeCount = Math.ceil(FIELD_LENGTH / 16);
  for (let i = 0; i < stripeCount; i++) {
    const mat = turfMaterial(i % 2 ? maps[0].stripe : maps[0].grass, .028);
    const stripe = createRoundedFloorMesh(THREE, mat, {
      y: .006 + i * .0001,
      depthStart: -ARENA_SHAPE.halfLength + i * 16,
      depthEnd: Math.min(ARENA_SHAPE.halfLength, -ARENA_SHAPE.halfLength + (i + 1) * 16)
    });
    stripe.receiveShadow = true; scene.add(stripe);
    fieldMaterials.push(mat);
  }
  const white = new THREE.MeshStandardMaterial({ color: 0xe5f0ea, roughness: .8, emissive: 0x14211c });
  const mark = (x, z, w, d, y = .04) => addBox(scene, w, .035, d, white, [x, y, z], { castShadow: false });
  mark(0, FIELD.centerZ, FIELD_WIDTH, .15);
  const boundaryArc = (cx, cz, from, to, target) => {
    const radius = FIELD.cornerRadius;
    for (let i = 1; i <= 16; i++) {
      const angle = from + (to - from) * i / 16;
      target.push([cx + Math.cos(angle) * radius, .065, cz + Math.sin(angle) * radius]);
    }
  };
  for (const side of [-1, 1]) {
    const points = [[side * FIELD.goalHalfWidth, .065, FIELD_START_Z], [side * (FIELD.halfWidth - FIELD.cornerRadius), .065, FIELD_START_Z]];
    const nearCornerX = side * (FIELD.halfWidth - FIELD.cornerRadius);
    boundaryArc(nearCornerX, FIELD_START_Z + FIELD.cornerRadius, -Math.PI / 2, side > 0 ? 0 : -Math.PI, points);
    points.push([side * FIELD.halfWidth, .065, FIELD_END_Z - FIELD.cornerRadius]);
    const farCornerX = side * (FIELD.halfWidth - FIELD.cornerRadius);
    boundaryArc(farCornerX, FIELD_END_Z - FIELD.cornerRadius, side > 0 ? 0 : Math.PI, Math.PI / 2, points);
    points.push([side * FIELD.goalHalfWidth, .065, FIELD_END_Z]);
    addTube(scene, points, .085, white, points.length * 2);
  }
  const circlePts = [];
  const centerCircleRadius = 10.24;
  for (let i = 0; i < 97; i++) { const a = Math.PI * 2 * i / 96; circlePts.push([centerCircleRadius * Math.cos(a), .07, FIELD.centerZ + centerCircleRadius * Math.sin(a)]); }
  addLoop(scene, circlePts, .08, white, 96);
  const spotGeo = new THREE.CircleGeometry(.28, 24);
  const kickoffSpots = [[0, FIELD.centerZ], [0, FIELD.centerZ - 46.08], [0, FIELD.centerZ + 46.08]];
  for (const side of [-1, 1]) for (const offset of [-20.48, 20.48]) kickoffSpots.push([side * 25.6, FIELD.centerZ + offset]);
  for (const [x, z] of kickoffSpots) {
    const spot = new THREE.Mesh(spotGeo, white); spot.rotation.x = -Math.PI / 2; spot.position.set(x, .075, z); scene.add(spot);
  }
  for (const z of [GOAL_NEAR_Z, GOAL_FAR_Z]) {
    const towardCenter = z === GOAL_NEAR_Z ? 1 : -1;
    mark(0, z + towardCenter * 7, 30, .16);
    mark(-15, z + towardCenter * 7, .16, 14); mark(15, z + towardCenter * 7, .16, 14);
    mark(0, z + towardCenter * 14, 30, .16);
  }
  for (const end of [GOAL_NEAR_Z, GOAL_FAR_Z]) {
    const direction = end === GOAL_NEAR_Z ? 1 : -1, boxDepth = end + direction * 17;
    mark(0, boxDepth, FIELD.goalHalfWidth * 3, .15);
    mark(-FIELD.goalHalfWidth * 1.5, end + direction * 8.5, .15, 17);
    mark(FIELD.goalHalfWidth * 1.5, end + direction * 8.5, .15, 17);
    const arcPoints = [];
    for (let i = 0; i <= 32; i++) {
      const angle = Math.PI * i / 32;
      arcPoints.push([9 * Math.cos(angle), .075, boxDepth + direction * 9 * Math.sin(angle)]);
    }
    addTube(scene, arcPoints, .07, white, 40);
  }
  createRoundedArenaShell(THREE, scene, accentMaterials);
}

function createBoostPads() {
  // Standard Soccar boost placements from the Rocket League coordinate grid
  // (centimetres); the two central side pads and four corners are full boosts.
  const rawLocations = [
    [0, -4240], [-1792, -4184], [1792, -4184], [-3072, -4096], [3072, -4096],
    [-940, -3308], [940, -3308], [0, -2816], [-3584, -2484], [3584, -2484],
    [-1788, -2300], [1788, -2300], [-2048, -1036], [0, -1024], [2048, -1036],
    [-3584, 0], [-1024, 0], [1024, 0], [3584, 0], [-2048, 1036], [0, 1024],
    [2048, 1036], [-1788, 2300], [1788, 2300], [-3584, 2484], [3584, 2484],
    [0, 2816], [-940, 3310], [940, 3308], [-3072, 4096], [3072, 4096],
    [-1792, 4184], [1792, 4184], [0, 4240]
  ];
  state.boostPads = rawLocations.map(([rawX, rawZ]) => {
    const x = rawX / 100;
    const z = FIELD.centerZ + rawZ / 100;
    const large = (Math.abs(x) === 35.84 && Math.abs(z - FIELD.centerZ) < .001)
      || (Math.abs(x) === 30.72 && Math.abs(z - FIELD.centerZ) > 40);
    const amount = large ? 100 : 12;
    const color = 0xffbd49;
    const glow = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: large ? 1.4 : 1.05, metalness: .45, roughness: .28 });
    const dark = standard(0x172332, { metalness: .68, roughness: .32 });
    const group = new THREE.Group(); group.position.set(x, .035, z); scene.add(group);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(large ? 1.02 : .55, large ? 1.12 : .62, .16, 32), dark);
    base.position.y = .08; base.receiveShadow = true; group.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(large ? .91 : .48, large ? .09 : .06, 8, 32), glow);
    ring.rotation.x = -Math.PI / 2; ring.position.y = .19; group.add(ring);
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(large ? .43 : .25, 1), glow);
    orb.position.y = large ? .82 : .48; orb.castShadow = true; group.add(orb);
    const pad = { x, z, amount, large, group, base, ring, orb, modelRoot: null, active: true, cooldown: 0, respawn: large ? 10 : 4, radius: large ? 2.3 : 1.65 };
    return pad;
  });
  for (const pad of state.boostPads) loadBoostPadModel(pad);
}

function updateBoostPads(dt) {
  for (const pad of state.boostPads) {
    if (!pad.active) {
      pad.cooldown -= dt;
      if (pad.cooldown <= 0) { pad.active = true; pad.group.visible = true; }
      continue;
    }
    const playerDistance = Math.hypot(state.player.x - pad.x, state.player.z - pad.z);
    if (state.player.y < 1.65 && playerDistance < pad.radius) {
      const oldBoost = state.boost;
      state.boost = Math.min(100, state.boost + pad.amount);
      if (state.boost > oldBoost) {
        pad.active = false; pad.cooldown = pad.respawn; pad.group.visible = false;
        if (pad.large || oldBoost < 25) showToast(`+${Math.round(state.boost - oldBoost)} de boost`);
      }
    }
    if (pad.active && state.match && !state.bot.demolishedTimer && state.bot.boost < 100) {
      const botDistance = Math.hypot(state.bot.x - pad.x, state.bot.z - pad.z);
      if (state.bot.y < 1.65 && botDistance < pad.radius) {
        state.bot.boost = Math.min(100, state.bot.boost + pad.amount);
        pad.active = false; pad.cooldown = pad.respawn; pad.group.visible = false;
      }
    }
  }
  for (const pad of state.boostPads) if (pad.active) pad.orb.rotation.y += dt * (pad.large ? 1.8 : 2.7);
}

function createSeatBanks() {
  const seatGeomSide = new THREE.BoxGeometry(1.25, .42, 2.85);
  const backGeomSide = new THREE.BoxGeometry(.34, .86, 2.85);
  const seatGeomEnd = new THREE.BoxGeometry(2.85, .42, 1.25);
  const backGeomEnd = new THREE.BoxGeometry(2.85, .86, .34);
  const seatMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .82, vertexColors: true });
  const backMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .88, vertexColors: true });
  const sideColumns = 56;
  const seatCountSide = 17 * sideColumns;
  const sideSeats = new THREE.InstancedMesh(seatGeomSide, seatMat, seatCountSide * 2);
  const sideBacks = new THREE.InstancedMesh(backGeomSide, backMat, seatCountSide * 2);
  sideSeats.receiveShadow = true; sideBacks.receiveShadow = true;
  const dummy = new THREE.Object3D(); let index = 0;
  for (const side of [-1, 1]) for (let row = 0; row < 17; row++) for (let col = 0; col < sideColumns; col++) {
    const x = side * (SIDE_WALL_X + 4 + row * 1.18), y = 2.35 + row * .61;
    const z = FIELD_START_Z + 1.5 + col * (FIELD_LENGTH - 3) / (sideColumns - 1);
    dummy.position.set(x, y, z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); sideSeats.setMatrixAt(index, dummy.matrix);
    const backX = x - side * .68;
    dummy.position.set(backX, y + .49, z); dummy.updateMatrix(); sideBacks.setMatrixAt(index, dummy.matrix);
    const color = seatColor(row, col); sideSeats.setColorAt(index, color); sideBacks.setColorAt(index, color.clone().multiplyScalar(.63)); index++;
  }
  scene.add(sideSeats, sideBacks);
  const endColumns = 42;
  const endCount = 16 * endColumns;
  const endSeats = new THREE.InstancedMesh(seatGeomEnd, seatMat, endCount * 2);
  const endBacks = new THREE.InstancedMesh(backGeomEnd, backMat, endCount * 2);
  index = 0;
  for (const side of [-1, 1]) for (let row = 0; row < 16; row++) for (let col = 0; col < endColumns; col++) {
    const x = -FIELD.halfWidth + 3 + col * (FIELD_WIDTH - 6) / (endColumns - 1);
    const z = FIELD.centerZ + side * (FIELD.halfLength + FIELD.wallRadius + 5 + row * 1.15), y = 2.1 + row * .57;
    dummy.position.set(x, y, z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); endSeats.setMatrixAt(index, dummy.matrix);
    dummy.position.set(x, y + .48, z - side * .68); dummy.updateMatrix(); endBacks.setMatrixAt(index, dummy.matrix);
    const color = seatColor(row + 5, col + 23); endSeats.setColorAt(index, color); endBacks.setColorAt(index, color.clone().multiplyScalar(.63)); index++;
  }
  scene.add(endSeats, endBacks);
}
function seatColor(row, col) {
  const n = Math.abs(Math.sin(row * 91.7 + col * 21.33) * 43758.5453) % 1;
  if (n > .89) return new THREE.Color(0xe69a3f);
  const blues = [0x154d7e, 0x12669a, 0x1d3857, 0x285778, 0x223a54];
  return new THREE.Color(blues[Math.floor(n * 17) % blues.length]);
}

function createRoofAndLights() {
  const roofMat = standard(0x172332, { metalness: .42, roughness: .62 });
  const beamMat = standard(0x667f91, { metalness: .68, roughness: .38 });
  const neonMat = new THREE.MeshStandardMaterial({ color: 0x188fe0, emissive: 0x07518b, emissiveIntensity: 1.25, metalness: .3, roughness: .35 }); accentMaterials.push(neonMat);
  const roofX = SIDE_WALL_X + 19, roofZ = FIELD.centerZ + FIELD.halfLength + FIELD.wallRadius + 14;
  addBox(scene, 46, 1.3, FIELD_LENGTH + 32, roofMat, [-roofX, FIELD.ceilingY + 2.5, FIELD.centerZ], { castShadow: false });
  addBox(scene, 46, 1.3, FIELD_LENGTH + 32, roofMat, [roofX, FIELD.ceilingY + 2.5, FIELD.centerZ], { castShadow: false });
  addBox(scene, FIELD_WIDTH + 58, 1.1, 38, roofMat, [0, FIELD.ceilingY + 2.5, FIELD.centerZ - FIELD.halfLength - FIELD.wallRadius - 12], { castShadow: false });
  addBox(scene, FIELD_WIDTH + 58, 1.1, 38, roofMat, [0, FIELD.ceilingY + 2.5, FIELD.centerZ + FIELD.halfLength + FIELD.wallRadius + 12], { castShadow: false });
  const ellipsePts = [];
  const ellipseX = SIDE_WALL_X + 42, ellipseZ = FIELD.halfLength + FIELD.wallRadius + 25;
  for (let i = 0; i < 96; i++) { const a = i / 96 * Math.PI * 2; ellipsePts.push([ellipseX * Math.cos(a), FIELD.ceilingY + 1 + 2.3 * Math.cos(a * 2), FIELD.centerZ + ellipseZ * Math.sin(a)]); }
  addLoop(scene, ellipsePts, .52, beamMat, 192);
  const lightRingPts = ellipsePts.map(([x, y, z]) => [x, y - 1.05, z]); addLoop(scene, lightRingPts, .2, neonMat, 192);
  for (let z = FIELD_START_Z; z <= FIELD_END_Z; z += 16) {
    addTube(scene, [[-roofX - 10, FIELD.ceilingY - 3, z], [-SIDE_WALL_X, FIELD.ceilingY + 1, z], [-FIELD.halfWidth, FIELD.ceilingY + 3.5, z], [0, FIELD.ceilingY + 5, z], [FIELD.halfWidth, FIELD.ceilingY + 3.5, z], [SIDE_WALL_X, FIELD.ceilingY + 1, z], [roofX + 10, FIELD.ceilingY - 3, z]], .2, beamMat, 42);
  }
  for (const side of [-1, 1]) for (const z of [GOAL_NEAR_Z, FIELD.centerZ - 42, FIELD.centerZ, FIELD.centerZ + 42, GOAL_FAR_Z]) {
    addTube(scene, [[side * (roofX + 10), 4, z], [side * (roofX + 5), 14, z], [side * (roofX - 5), FIELD.ceilingY - 5, z], [side * (SIDE_WALL_X + 9), FIELD.ceilingY + 1, z]], .3, beamMat, 20);
    addTube(scene, [[side * (roofX + 10), FIELD.ceilingY - 9, z], [side * (roofX + 2), FIELD.ceilingY - 18, z], [side * (SIDE_WALL_X + 9), FIELD.ceilingY - 23, z]], .2, beamMat, 12);
  }
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xdff3ff, emissive: 0xc5e8ff, emissiveIntensity: 2.2, roughness: .3 });
  for (const side of [-1, 1]) for (const z of [GOAL_NEAR_Z, FIELD.centerZ - 42, FIELD.centerZ + 42, GOAL_FAR_Z]) {
    addBox(scene, 5.2, .32, 2.1, glowMat, [side * (SIDE_WALL_X + 17), FIELD.ceilingY - 2, z], { castShadow: false });
    const p = new THREE.PointLight(0xb9ddff, 52, 58, 1.7); p.position.set(side * (SIDE_WALL_X + 17), FIELD.ceilingY - 3, z); scene.add(p);
  }
  const pillarMat = standard(0x526677, { metalness: .55, roughness: .5 });
  for (const side of [-1, 1]) for (const z of [FIELD_START_Z + 9, FIELD.centerZ - 42, FIELD.centerZ + 42, FIELD_END_Z - 9]) addBox(scene, 1.5, FIELD.ceilingY - 5, 1.5, pillarMat, [side * (roofX + 12), (FIELD.ceilingY - 5) / 2, z], { castShadow: false });
  skyDome = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 18), new THREE.MeshBasicMaterial({ color: 0x182c40, side: THREE.BackSide, fog: false }));
  scene.add(skyDome);
}

function makeSignTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#0a1724'; g.fillRect(0, 0, c.width, c.height);
  const gradient = g.createLinearGradient(0, 0, c.width, 0); gradient.addColorStop(0, '#102a42'); gradient.addColorStop(.5, '#142338'); gradient.addColorStop(1, '#102a42');
  g.fillStyle = gradient; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#5592bb'; g.lineWidth = 7; g.strokeRect(8, 8, c.width - 16, c.height - 16);
  // Mirror the artwork because the 3D sign faces back toward the kickoff camera.
  g.save(); g.translate(c.width, 0); g.scale(-1, 1);
  g.textAlign = 'center'; g.fillStyle = '#f1f6fb'; g.font = '900 90px Arial'; g.fillText('CAR SOCCER', c.width / 2, 129);
  g.fillStyle = '#6cbcff'; g.font = '700 28px Arial'; g.fillText('ARENA SERIES  ·  EST. 2024', c.width / 2, 185); g.restore();
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

function createGoal(z, facing, teamColor) {
  const group = new THREE.Group(); group.position.z = z; group.rotation.y = facing > 0 ? Math.PI : 0; scene.add(group);
  const trim = new THREE.MeshStandardMaterial({ color: teamColor, emissive: teamColor, emissiveIntensity: .55, metalness: .52, roughness: .24, clearcoat: .8 });
  const halfWidth = FIELD.goalHalfWidth;
  const goalHeight = FIELD.goalOpeningHeight;
  const goalDepth = GOAL_DEPTH;
  for (const x of [-halfWidth, halfWidth]) addRoundedBox(group, .42, goalHeight, .42, .13, trim, [x, goalHeight / 2, 0]);
  addRoundedBox(group, halfWidth * 2 + .55, .42, .42, .13, trim, [0, goalHeight, 0]);
  const vertices = [], line = (a, b) => vertices.push(...a, ...b);
  const netHalfWidth = halfWidth - .15;
  for (let i = 0; i <= 24; i++) {
    const x = -netHalfWidth + i * netHalfWidth * 2 / 24;
    line([x, .18, goalDepth], [x, goalHeight - .18, goalDepth]);
    line([x, goalHeight - .18, 0], [x, goalHeight - .18, goalDepth]);
  }
  for (let i = 0; i <= 12; i++) {
    const y = .2 + i * (goalHeight - .4) / 12;
    line([-netHalfWidth, y, goalDepth], [netHalfWidth, y, goalDepth]);
    line([-netHalfWidth, y, 0], [netHalfWidth, y, 0]);
  }
  for (const x of [-netHalfWidth, netHalfWidth]) {
    for (let i = 0; i <= 8; i++) {
      const y = .2 + i * (goalHeight - .4) / 8;
      line([x, y, 0], [x, y, goalDepth]);
    }
    for (let i = 0; i <= 7; i++) {
      const depth = i * goalDepth / 7;
      line([x, .2, depth], [x, goalHeight - .18, depth]);
    }
  }
  const netGlow = new THREE.Mesh(new THREE.PlaneGeometry(netHalfWidth * 2, goalHeight - .36), new THREE.MeshBasicMaterial({ color: teamColor, transparent: true, opacity: .075, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  netGlow.position.set(0, goalHeight / 2, goalDepth - .02); group.add(netGlow);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  group.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: teamColor, transparent: true, opacity: .78, toneMapped: false })));
  const goalGlow = new THREE.PointLight(teamColor, 18, 25, 2); goalGlow.position.set(0, goalHeight * .55, -facing * goalDepth * .35); group.add(goalGlow);
  return group;
}

function createStadiumSign() {
  const tex = makeSignTexture(); const board = new THREE.Mesh(new THREE.BoxGeometry(37, 8.5, .8), standard(0x142234, { metalness: .4, roughness: .42 }));
  board.position.set(0, FIELD.ceilingY - 6.5, FIELD_END_Z + FIELD.wallRadius + 7); scene.add(board);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(35.8, 7.5), new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide }));
  face.position.set(0, FIELD.ceilingY - 6.5, FIELD_END_Z + FIELD.wallRadius + 6.55); face.rotation.y = Math.PI; scene.add(face);
  const supports = standard(0x64788a, { metalness: .6, roughness: .45 });
  for (const x of [-13, 13]) addBox(scene, .5, 8, .5, supports, [x, FIELD.ceilingY - 12, FIELD_END_Z + FIELD.wallRadius + 7]);
}

function createStadium() {
  const banner = new THREE.MeshStandardMaterial({ color: 0x1f3850, metalness: .32, roughness: .5 });
  const bannerGlow = new THREE.MeshStandardMaterial({ color: 0x226b9a, emissive: 0x0b3c61, emissiveIntensity: .9, metalness: .25, roughness: .42 });
  const sideWallX = SIDE_WALL_X;
  const wallLength = FIELD_LENGTH + FIELD.wallRadius * 2 - 4;
  for (const side of [-1, 1]) {
    addBox(scene, .55, 2.4, wallLength, banner, [side * sideWallX, 10, FIELD.centerZ], { castShadow: false });
    addBox(scene, .18, .22, wallLength, bannerGlow, [side * (sideWallX - .34), 11.35, FIELD.centerZ], { castShadow: false });
  }
  const adCanvas = document.createElement('canvas'); adCanvas.width = 512; adCanvas.height = 96;
  const ctx = adCanvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 512, 96);
  gradient.addColorStop(0, '#0d2a43'); gradient.addColorStop(.5, '#1b4770'); gradient.addColorStop(1, '#0d2a43');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = '#39baff'; ctx.fillRect(0, 0, 512, 5); ctx.fillRect(0, 91, 512, 5);
  ctx.fillStyle = '#eff8ff'; ctx.font = '900 40px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('ARENA CHAMPIONSHIP  ·  CAR SOCCER', 256, 51);
  const adTexture = new THREE.CanvasTexture(adCanvas); adTexture.colorSpace = THREE.SRGBColorSpace;
  const adMaterial = new THREE.MeshBasicMaterial({ map: adTexture, toneMapped: false, side: THREE.DoubleSide });
  for (const side of [-1, 1]) for (let z = FIELD_START_Z + 20; z < FIELD_END_Z - 12; z += 25) {
    const ad = new THREE.Mesh(new THREE.PlaneGeometry(17, 1.8), adMaterial);
    ad.position.set(side * (sideWallX - .32), 10, z); ad.rotation.y = -side * Math.PI / 2; scene.add(ad);
  }
  createSeatBanks(); createRoofAndLights(); createStadiumSign();
  createGoal(GOAL_FAR_Z, -1, 0x47b2ff); createGoal(GOAL_NEAR_Z, 1, 0xffa14a);
}

function makeCar(color, shape = 'default', options = {}) {
  const root = new THREE.Group();
  const fallback = new THREE.Group(), addons = new THREE.Group(), wheelsGroup = new THREE.Group();
  root.add(fallback, addons, wheelsGroup);
  const bodyMat = new THREE.MeshPhysicalMaterial({ color, metalness: .42, roughness: .27, clearcoat: .9, clearcoatRoughness: .19 });
  const secondaryMat = new THREE.MeshPhysicalMaterial({ color: options.secondaryColor || '#f3f7fb', metalness: .38, roughness: .28, clearcoat: .8, clearcoatRoughness: .2 });
  const darkBody = standard(0x172535, { metalness: .32, roughness: .38 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x174566, metalness: .25, roughness: .18, clearcoat: .8, transparent: true, opacity: .9 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x080d14, roughness: .92 });
  const selectedWheel = options.wheelStyle || 'alloy';
  const hubColor = selectedWheel === 'neon' ? 0x1c2938 : selectedWheel === 'rally' ? 0xf1f3f5 : 0x95a8b8;
  const hub = standard(hubColor, { metalness: selectedWheel === 'rally' ? .35 : .8, roughness: .26 });
  const wheelAccent = standard(selectedWheel === 'neon' ? 0x51d8ff : 0x73889b, { metalness: .55, roughness: .3, emissive: selectedWheel === 'neon' ? 0x12627d : 0x000000, emissiveIntensity: .8 });
  const lightFront = new THREE.MeshStandardMaterial({ color: 0xdaf8ff, emissive: 0xa9e7ff, emissiveIntensity: 2.1, roughness: .25 });
  const lightBack = new THREE.MeshStandardMaterial({ color: 0xff3434, emissive: 0xa70012, emissiveIntensity: 1.2, roughness: .3 });
  addRoundedBox(fallback, 2.18, .48, 4.12, .18, darkBody, [0, .58, -.05]);
  const bodyWidth = shape === 'realistic' ? 2.5 : 2.42;
  addRoundedBox(fallback, bodyWidth, .56, 3.72, .22, bodyMat, [0, .91, -.05]);
  addRoundedBox(fallback, 2.18, .32, 1.42, .12, bodyMat, [0, 1.08, 1.28]);
  addRoundedBox(fallback, 2.08, .22, 1.08, .09, bodyMat, [0, 1.13, -1.37]);
  const roofHeight = shape === 'flat' ? .45 : shape === 'realistic' ? .7 : .62;
  const cabin = addRoundedBox(fallback, shape === 'realistic' ? 1.58 : 1.48, roofHeight, shape === 'flat' ? 1.4 : 1.72, .13, glass, [0, 1.48 + (roofHeight - .62) * .25, -.15]);
  cabin.castShadow = false;
  addRoundedBox(fallback, 1.5, .13, .99, .06, bodyMat, [0, 1.83 + (roofHeight - .62) * .25, -.18]);
  // Contrasting paint follows the hood and roof as a raised 3D racing stripe.
  addRoundedBox(fallback, .13, .025, 1.12, .01, secondaryMat, [0, 1.255, 1.28], { castShadow: false });
  addRoundedBox(fallback, .12, .025, .82, .01, secondaryMat, [0, 1.916 + (roofHeight - .62) * .25, -.18], { castShadow: false });
  const archMaterial = standard(0x263544, { metalness: .48, roughness: .38 });
  for (const side of [-1, 1]) for (const z of [-1.34, 1.34]) {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(.52, .075, 8, 28, Math.PI), archMaterial);
    arch.position.set(side * 1.2, .52, z); arch.rotation.y = side * Math.PI / 2; fallback.add(arch);
  }
  for (const side of [-1, 1]) {
    addRoundedBox(fallback, .12, .38, .65, .055, glass, [side * .735, 1.48, -.12], { castShadow: false });
    addRoundedBox(fallback, .18, .16, .32, .055, darkBody, [side * 1.25, 1.27, .55]);
    addRoundedBox(fallback, .16, .1, .36, .035, secondaryMat, [side * 1.12, .96, -.45]);
    const head = addRoundedBox(fallback, .5, .14, .1, .045, lightFront, [side * .68, .91, 2.12], { castShadow: false });
    head.rotation.z = side * -.04;
    addRoundedBox(fallback, .48, .14, .09, .04, lightBack, [side * .68, .9, -2.04], { castShadow: false });
    const beam = new THREE.SpotLight(0xc4eaff, 24, 33, Math.PI / 7, .72, 1.4);
    beam.position.set(side * .68, .9, 2.1); beam.target.position.set(side * .8, .5, 20);
    fallback.add(beam, beam.target);
  }
  addRoundedBox(fallback, 2.36, .24, .32, .08, darkBody, [0, .58, 2.05]);
  addRoundedBox(fallback, .92, .16, .08, .045, darkBody, [0, .78, 2.16]);
  for (let i = -3; i <= 3; i++) addRoundedBox(fallback, .035, .1, .025, .01, wheelAccent, [i * .11, .78, 2.205], { castShadow: false });
  const boostJets = [];
  const boostTheme = {
    standard: { outer: 0x16aaff, inner: 0xdff8ff, sparks: 0x82dcff },
    alpha: { outer: 0xffa20d, inner: 0xfff0a1, sparks: 0xffd34f },
    dev: { outer: 0x12dcb0, inner: 0xd5fff5, sparks: 0x55ffe1 }
  }[options.boostStyle] || { outer: 0x16aaff, inner: 0xdff8ff, sparks: 0x82dcff };
  for (const side of [-1, 1]) {
    addRoundedBox(root, .22, .2, .28, .07, darkBody, [side * .62, .57, -2.02]);
    const jet = new THREE.Group(); jet.position.set(side * .62, .57, -2.1); jet.visible = false; root.add(jet);
    const flameMaterial = color => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .88, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(options.boostStyle === 'alpha' ? .29 : .24, options.boostStyle === 'alpha' ? 1.45 : 1.15, 14, 1), flameMaterial(boostTheme.outer));
    flame.rotation.x = -Math.PI / 2; flame.position.z = -.66; flame.userData.noShadow = true; jet.add(flame);
    const hotCore = new THREE.Mesh(new THREE.ConeGeometry(.11, .8, 12, 1), flameMaterial(boostTheme.inner));
    hotCore.rotation.x = -Math.PI / 2; hotCore.position.z = -.47; hotCore.userData.noShadow = true; jet.add(hotCore);
    const sparks = [];
    if (options.boostStyle === 'alpha' || options.boostStyle === 'dev') {
      const sparkMaterial = flameMaterial(boostTheme.sparks);
      const sparkCount = options.boostStyle === 'alpha' ? 10 : 5;
      for (let index = 0; index < sparkCount; index++) {
        const geometry = options.boostStyle === 'alpha' ? new THREE.OctahedronGeometry(.055 + (index % 3) * .018, 0) : new THREE.SphereGeometry(.045, 6, 5);
        const spark = new THREE.Mesh(geometry, sparkMaterial);
        spark.userData.noShadow = true;
        spark.userData.phase = index / sparkCount + (side > 0 ? .31 : 0);
        spark.userData.spread = ((index * 17) % 9 - 4) * .055;
        jet.add(spark); sparks.push(spark);
      }
    }
    if (options.boostStyle === 'dev') {
      for (let index = 0; index < 2; index++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(.18 - index * .035, .025, 7, 22), flameMaterial(boostTheme.sparks));
        ring.position.z = -.22 - index * .35; ring.userData.noShadow = true; ring.userData.pulseOffset = index * 1.4; jet.add(ring);
      }
    }
    boostJets.push({ group: jet, flame, hotCore, sparks });
  }
  if (options.accessory === 'spoiler') {
    addRoundedBox(addons, 2.2, .12, .27, .05, darkBody, [0, 1.65, -1.82]);
    addRoundedBox(addons, 2.32, .12, .34, .05, secondaryMat, [0, 1.82, -1.82]);
    for (const x of [-.82, .82]) addRoundedBox(addons, .1, .48, .12, .045, darkBody, [x, 1.42, -1.82]);
  } else if (options.accessory === 'antenna' || options.accessory === 'ball') {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.035, .055, .7, 8), darkBody);
    post.position.set(.42, 2.12 + (roofHeight - .62) * .25, -.2); addons.add(post);
    const topper = options.accessory === 'ball'
      ? new THREE.Mesh(new THREE.SphereGeometry(.2, 12, 10), standard('#f4f6f8', { roughness: .58 }))
      : new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 10), secondaryMat);
    topper.position.set(.42, 2.5 + (roofHeight - .62) * .25, -.2); topper.castShadow = true; addons.add(topper);
  }
  const wheels = [];
  for (const x of [-1.16, 1.16]) for (const z of [-1.34, 1.34]) {
    const wheel = new THREE.Group(); wheel.position.set(x, .48, z); wheelsGroup.add(wheel);
    const rubber = new THREE.Mesh(new THREE.CylinderGeometry(.47, .47, .34, selectedWheel === 'rally' ? 20 : 16), tire); rubber.rotation.z = Math.PI / 2; rubber.castShadow = true; wheel.add(rubber);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(selectedWheel === 'rally' ? .27 : .22, selectedWheel === 'rally' ? .27 : .22, .36, selectedWheel === 'rally' ? 8 : 12), hub); cap.rotation.z = Math.PI / 2; wheel.add(cap);
    if (selectedWheel === 'neon') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.33, .035, 6, 20), wheelAccent);
      ring.rotation.y = Math.PI / 2; ring.position.x = x > 0 ? .19 : -.19; ring.castShadow = false; wheel.add(ring);
    } else if (selectedWheel === 'alloy') {
      for (let spoke = 0; spoke < 5; spoke++) {
        const angle = spoke * Math.PI * 2 / 5;
        const bar = new THREE.Mesh(new THREE.BoxGeometry(.04, .31, .075), wheelAccent);
        bar.position.set(0, Math.cos(angle) * .13, Math.sin(angle) * .13);
        bar.rotation.x = -angle; wheel.add(bar);
      }
    }
    wheels.push(wheel);
  }
  root.traverse(obj => { if (obj.isMesh && !obj.userData.noShadow) { obj.castShadow = true; obj.receiveShadow = true; } });
  return { group: root, wheels, boostJets, fallback, addons, wheelsGroup, modelToken: null };
}

function updateBoostJets(vehicle, active, time) {
  for (const [index, jet] of vehicle.boostJets.entries()) {
    jet.group.visible = active;
    if (!active) continue;
    const pulse = .82 + Math.sin(time * 38 + index) * .13;
    jet.flame.scale.y = pulse;
    jet.hotCore.scale.y = .8 + pulse * .24;
    jet.sparks.forEach((spark, sparkIndex) => {
      const trail = (time * 1.45 + spark.userData.phase) % 1;
      spark.position.set(spark.userData.spread * Math.sin(time * 9 + sparkIndex), spark.userData.spread * Math.cos(time * 11 + sparkIndex), -.32 - trail * 1.2);
      spark.rotation.set(time * 5 + sparkIndex, time * 7 + sparkIndex, time * 4);
      spark.scale.setScalar(.35 + Math.abs(Math.sin(time * 18 + sparkIndex)) * .85);
    });
    jet.group.children.filter(child => child.isMesh && child.geometry?.type === 'TorusGeometry').forEach(ring => {
      const ringPulse = .8 + Math.sin(time * 17 + (ring.userData.pulseOffset || 0)) * .18;
      ring.scale.setScalar(ringPulse);
    });
  }
}

function createBall() {
  const root = new THREE.Group();
  const white = standard(0xf0f3f5, { roughness: .53 });
  const dark = standard(0x111923, { roughness: .7 });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 40, 28), white); sphere.castShadow = true; sphere.receiveShadow = true; root.add(sphere);
  const seam = standard(0x919da5, { roughness: .76 });
  const dirs = [[1,1,1],[-1,1,1],[1,-1,1],[-1,-1,1],[1,1,-1],[-1,1,-1],[1,-1,-1],[-1,-1,-1],[0,1,.4],[0,-1,-.4],[.4,0,-1],[-.4,0,1]];
  for (const values of dirs) {
    const normal = new THREE.Vector3(...values).normalize();
    const patch = new THREE.Mesh(new THREE.CircleGeometry(.25 * BALL_RADIUS / 1.18, 5), dark);
    patch.position.copy(normal.clone().multiplyScalar(BALL_RADIUS * .987)); patch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal); patch.castShadow = true; root.add(patch);
    const helper = Math.abs(normal.y) > .9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const tangent = new THREE.Vector3().crossVectors(normal, helper).normalize();
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
    const seamPoints = [];
    for (let edge = 0; edge <= 5; edge++) {
      const angle = (edge % 5) * Math.PI * 2 / 5 - Math.PI / 2;
      const point = normal.clone().multiplyScalar(Math.cos(.235))
        .addScaledVector(tangent, Math.sin(.235) * Math.cos(angle))
        .addScaledVector(bitangent, Math.sin(.235) * Math.sin(angle));
      seamPoints.push(point.multiplyScalar(BALL_RADIUS * .998).toArray());
    }
    addTube(root, seamPoints, .009 * BALL_RADIUS / 1.18, seam, 24);
  }
  scene.add(root);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.4, 28), new THREE.MeshBasicMaterial({ color: 0x061019, transparent: true, opacity: .22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .035; scene.add(shadow);
  return { group: root, shadow };
}

const carModelLoader = new GLTFLoader();
const carModelCache = new Map();
const boostPadModelCache = new Map();
const boostPadModelUrls = {
  big: new URL('./models/pad_platform.glb', import.meta.url).href,
  small: new URL('./models/pad_core.glb', import.meta.url).href
};
function getCarModel(modelId, url) {
  if (!carModelCache.has(modelId)) {
    const pending = carModelLoader.loadAsync(url).then(gltf => gltf.scene).catch(error => {
      carModelCache.delete(modelId); throw error;
    });
    carModelCache.set(modelId, pending);
  }
  return carModelCache.get(modelId);
}
function getBoostPadModel(kind) {
  if (!boostPadModelCache.has(kind)) {
    const pending = carModelLoader.loadAsync(boostPadModelUrls[kind]).then(gltf => gltf.scene).catch(error => {
      boostPadModelCache.delete(kind);
      throw error;
    });
    boostPadModelCache.set(kind, pending);
  }
  return boostPadModelCache.get(kind);
}
function loadBoostPadModel(pad) {
  getBoostPadModel(pad.large ? 'big' : 'small').then(source => {
    if (!pad.group.parent || pad.modelRoot) return;
    const model = source.clone(true);
    if (!pad.large) model.rotation.x = -Math.PI / 2;
    model.updateMatrixWorld(true);
    const sourceBounds = new THREE.Box3().setFromObject(model);
    const sourceSize = sourceBounds.getSize(new THREE.Vector3());
    const targetWidth = pad.large ? 2.45 : 1.28;
    model.scale.setScalar(targetWidth / Math.max(sourceSize.x, sourceSize.z, .001));
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -bounds.min.y, -center.z);
    model.traverse(object => {
      object.frustumCulled = false;
      if (object.isMesh) { object.castShadow = false; object.receiveShadow = true; }
    });
    pad.modelRoot = model;
    pad.group.add(model);
    pad.base.visible = false;
    pad.orb.visible = false;
  }).catch(error => console.warn('No se pudo cargar el modelo local del pad de boost; se conserva su modelo 3D integrado.', error));
}
function loadCarModel(vehicle, modelId, color, secondaryColor = '#f3f7fb') {
  const definition = carModels[modelId];
  if (!definition) return;
  const token = Symbol(modelId); vehicle.modelToken = token;
  getCarModel(modelId, definition.url).then(source => {
    if (vehicle.modelToken !== token) return;
    const sourceClone = source.clone(true);
    const model = new THREE.Group(); model.rotation.y = definition.rotationY; model.add(sourceClone);
    model.updateMatrixWorld(true);
    const sourceBounds = new THREE.Box3().setFromObject(model);
    const sourceSize = sourceBounds.getSize(new THREE.Vector3());
    model.scale.setScalar(4.1 / Math.max(sourceSize.x, sourceSize.z, .01));
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const modelHeight = bounds.max.y - bounds.min.y;
    vehicle.addons.scale.y = clamp(modelHeight / 2.15, .5, 1);
    model.position.set(-center.x, -bounds.min.y, -center.z);
    model.updateMatrixWorld(true);
    model.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = true; object.receiveShadow = true;
      object.geometry = object.geometry.clone();
      const tintMaterial = material => {
        const tinted = material.clone();
        if (tinted.color) tinted.color.set(color);
        tinted.needsUpdate = true;
        return tinted;
      };
      object.material = Array.isArray(object.material) ? object.material.map(tintMaterial) : tintMaterial(object.material);
    });
    vehicle.fallback.visible = false;
    vehicle.group.add(model); vehicle.modelRoot = model;
    const stripe = new THREE.Mesh(
      new RoundedBoxGeometry(.13, .035, 1.15, 3, .015),
      new THREE.MeshPhysicalMaterial({ color: secondaryColor, metalness: .42, roughness: .3, clearcoat: .85 })
    );
    stripe.position.set(0, (modelHeight - .025) / vehicle.addons.scale.y, .22); stripe.castShadow = true; vehicle.addons.add(stripe);
    vehicle.paintStripe = stripe;
  }).catch(error => console.warn(`No se pudo cargar el modelo ${modelId}; se usará el coche 3D integrado.`, error));
}
function repaintVehicle(vehicle, color, secondaryColor) {
  if (!vehicle.modelRoot) return false;
  vehicle.modelRoot.traverse(object => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.color?.set(color);
  });
  vehicle.paintStripe?.material.color.set(secondaryColor);
  return true;
}

function setupScene() {
  createImageBasedLighting();
  addLights();
  createGroundAndPitch(); createBoostPads(); createStadium();
  playerCar = makeCar(state.carColor, cars[state.carIndex].shape, state); scene.add(playerCar.group);
  loadCarModel(playerCar, cars[state.carIndex].model, state.carColor, state.secondaryColor);
  ui.carLabel.textContent = cars[state.carIndex].name;
  botCar = makeCar('#43aaff', 'default'); scene.add(botCar.group); loadCarModel(botCar, 'octane', '#43aaff', '#d5eeff');
  ballObject = createBall();
}
setupScene();

function updateCar(model, world, angle, y = 0) {
  model.group.position.set(world.x, y, world.z); model.group.rotation.y = angle;
}
const surfaceUp = new THREE.Vector3();
const surfaceForward = new THREE.Vector3();
const surfaceRight = new THREE.Vector3();
const surfaceMatrix = new THREE.Matrix4();
const worldVelocity = new THREE.Vector3();
const cameraAnchor = new THREE.Vector3();
const cameraDesired = new THREE.Vector3();
const cameraViewTarget = new THREE.Vector3();
const cameraAim = new THREE.Vector3(0, 0, 1);
const cameraAimTarget = new THREE.Vector3();
const cameraBallDirection = new THREE.Vector3();
const cameraPlanarBallDirection = new THREE.Vector3();
const carBallDelta = new THREE.Vector3();
const carRight = new THREE.Vector3();
const carUp = new THREE.Vector3();
const carForward = new THREE.Vector3();
const carBasisMatrix = new THREE.Matrix4();
const carBasisEuler = new THREE.Euler();
function getPlayerSurfaceFrame(world) {
  surfaceUp.set(0, 1, 0);
  surfaceForward.set(Math.sin(world.angle || 0), 0, Math.cos(world.angle || 0));
  if (world.surface === 'wall') {
    surfaceUp.set(-world.wallSide, 0, 0);
    surfaceForward.set(0, Math.sin(world.wallAngle), Math.cos(world.wallAngle));
  } else if (world.surface === 'ceiling') {
    surfaceUp.set(0, -1, 0);
  } else if (world.surface === 'lowerRamp' || world.surface === 'upperRamp') {
    const side = Math.sign(world.x) || 1;
    const offset = clamp(Math.abs(world.x) - FIELD.halfWidth, 0, FIELD.wallRadius);
    const sine = offset / FIELD.wallRadius;
    const cosine = Math.sqrt(Math.max(0, 1 - sine * sine));
    if (world.surface === 'lowerRamp') surfaceUp.set(-side * sine, cosine, 0);
    else surfaceUp.set(-side * sine, -cosine, 0);
    const verticalSign = world.surface === 'lowerRamp' ? 1 : -1;
    const fallback = new THREE.Vector3(side * cosine, verticalSign * sine, 0);
    surfaceForward.addScaledVector(surfaceUp, -surfaceForward.dot(surfaceUp));
    if (surfaceForward.lengthSq() < .001) surfaceForward.copy(fallback);
  }
  surfaceUp.normalize(); surfaceForward.normalize();
  surfaceRight.crossVectors(surfaceUp, surfaceForward).normalize();
  surfaceUp.crossVectors(surfaceForward, surfaceRight).normalize();
  return { up: surfaceUp, forward: surfaceForward };
}
function updatePlayerModelPose(world, steer = 0) {
  const group = playerCar.group;
  group.position.set(world.x, world.y, world.z);
  if (world.jumping || world.surface === 'air' || world.surface === 'ground') {
    group.rotation.set(world.jumping ? world.pitch : 0, world.angle, (world.roll || 0) - clamp(steer * world.speed * .0025, -.075, .075), 'XYZ');
    return;
  }
  const frame = getPlayerSurfaceFrame(world);
  surfaceMatrix.makeBasis(surfaceRight, surfaceUp, surfaceForward);
  group.quaternion.setFromRotationMatrix(surfaceMatrix);
}
function projectForward(angle, distance) { return new THREE.Vector3(Math.sin(angle) * distance, 0, Math.cos(angle) * distance); }
function showToast(message) {
  ui.toast.textContent = message; ui.toast.classList.add('show'); clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2300);
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function angleDiff(a, b) { let d = (b - a + Math.PI) % (Math.PI * 2) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return d; }

function savePreferences() {
  try {
    localStorage.setItem('car-soccer-preferences', JSON.stringify({
      carIndex: state.carIndex, carColor: state.carColor, secondaryColor: state.secondaryColor,
      wheelStyle: state.wheelStyle, accessory: state.accessory, boostStyle: state.boostStyle,
      keyBindings: state.keyBindings, gamepadBindings: state.gamepadBindings, botDifficulty: state.botDifficulty,
      ballCam: state.ballCam, cameraDistance: state.cameraDistance, cameraHeight: state.cameraHeight,
      cameraLookAhead: state.cameraLookAhead, ballCamStrength: state.ballCamStrength
    }));
  } catch { showToast('No se pudieron guardar las preferencias en este navegador.'); }
}

function disposeObject(root) {
  root.traverse(object => {
    if (!object.isMesh) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      // GLB textures are shared by the cached source model and stay alive for later garage changes.
      material.dispose();
    }
  });
}

function rebuildPlayerCar() {
  playerCar.modelToken = Symbol('rebuild'); scene.remove(playerCar.group); disposeObject(playerCar.group);
  playerCar = makeCar(state.carColor, cars[state.carIndex].shape, state); scene.add(playerCar.group);
  loadCarModel(playerCar, cars[state.carIndex].model, state.carColor, state.secondaryColor);
  ui.carLabel.textContent = cars[state.carIndex].name;
}

function readGamepad() {
  let pad = null;
  try { pad = Array.from(navigator.getGamepads?.() || []).find(Boolean) || null; } catch { /* Gamepad API unavailable. */ }
  const connected = Boolean(pad);
  if (connected !== state.gamepadConnected) {
    state.gamepadConnected = connected;
    state.gamepad = pad;
    showToast(connected ? `Mando conectado: ${pad.id.slice(0, 38)}` : 'Mando desconectado.');
    if (state.menu === 'settings' && ui.panelContent.querySelector('[data-tab="controls"]')?.classList.contains('active')) renderSettingsPanel('controls');
  }
  if (!pad) {
    state.lastGamepadButtons = []; state.gamepadActionsState = {};
    return { steer: 0, actions: {}, pressed: {} };
  }
  state.gamepad = pad;
  const values = pad.buttons.map(button => Math.max(button.value || 0, button.pressed ? 1 : 0));
  const pressedButtons = values.map((value, index) => value > .55 && !(state.lastGamepadButtons[index] > .55) ? index : -1).filter(index => index >= 0);
  state.lastGamepadButtons = values;
  let justCaptured = false;
  if (state.captureGamepadAction && pressedButtons.length) {
    const action = state.captureGamepadAction, index = pressedButtons[0];
    state.gamepadBindings[action] = index; state.captureGamepadAction = ''; savePreferences();
    justCaptured = true;
    showToast(`Botón ${index + 1} asignado a ${gamepadActions.find(([id]) => id === action)?.[1] || action}.`);
    if (state.menu === 'settings') renderSettingsPanel('controls');
  }
  const actions = Object.fromEntries(gamepadActions.map(([action]) => {
    const button = values[state.gamepadBindings[action]] || 0;
    return [action, button];
  }));
  const pressed = {};
  for (const [action, value] of Object.entries(actions)) {
    pressed[action] = !justCaptured && value > .55 && !state.gamepadActionsState[action];
    state.gamepadActionsState[action] = value > .55;
  }
  const deadzone = value => Math.abs(value) < .14 ? 0 : Math.sign(value) * (Math.abs(value) - .14) / .86;
  return { steer: deadzone(pad.axes[0] || 0), actions, pressed };
}

function isActionHeld(action, controller) {
  const code = state.keyBindings[action];
  const arrowFallback = { accelerate: 'ArrowUp', reverse: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[action];
  return (code && state.keys.has(code)) || (arrowFallback && state.keys.has(arrowFallback)) || (controller.actions[action] || 0) > .18;
}

function formatKey(code) {
  const names = { Space: 'Espacio', ShiftLeft: 'Shift', ShiftRight: 'Shift', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ControlLeft: 'Ctrl', AltLeft: 'Alt' };
  if (names[code]) return names[code];
  if (code?.startsWith('Key')) return code.slice(3);
  if (code?.startsWith('Digit')) return code.slice(5);
  return code || 'Sin asignar';
}

function refreshShortcutLabels() {
  ui.garage.querySelector('.corner-key').textContent = formatKey(state.keyBindings.garage);
  ui.play.querySelector('.corner-key').textContent = formatKey(state.keyBindings.menu);
  ui.hint.innerHTML = `<kbd>${formatKey(state.keyBindings.accelerate)}</kbd><kbd>${formatKey(state.keyBindings.left)}</kbd><kbd>${formatKey(state.keyBindings.reverse)}</kbd><kbd>${formatKey(state.keyBindings.right)}</kbd> conducir <span>·</span> <kbd>${formatKey(state.keyBindings.boost)}</kbd> boost <span>·</span> <kbd>${formatKey(state.keyBindings.handbrake)}</kbd> derrape <span>·</span> <kbd>${formatKey(state.keyBindings.jump)}</kbd> salto / flip <span>·</span> <kbd>Esc</kbd> pausa`;
}

function gamepadButtonName(index) {
  const labels = ['A / ✕', 'B / ◯', 'X / □', 'Y / △', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS', '↑', '↓', '←', '→'];
  return labels[index] || `Botón ${index + 1}`;
}

function lowerWallHeight(offset) {
  const progress = clamp(offset, 0, FIELD.wallRadius);
  return FIELD.wallRadius - Math.sqrt(Math.max(0, FIELD.wallRadius ** 2 - progress ** 2));
}

function roundedWallOffset(height) {
  const level = clamp(height < FIELD.wallRadius ? height : FIELD.ceilingY - height, 0, FIELD.wallRadius);
  return Math.sqrt(Math.max(0, FIELD.wallRadius ** 2 - (FIELD.wallRadius - level) ** 2));
}

function roundedBallWallOffset(height, ballRadius) {
  const usableRadius = Math.max(0, FIELD.wallRadius - ballRadius);
  if (height < FIELD.wallRadius) {
    return Math.sqrt(Math.max(0, usableRadius ** 2 - (FIELD.wallRadius - height) ** 2));
  }
  if (height > FIELD.ceilingY - FIELD.wallRadius) {
    return Math.sqrt(Math.max(0, usableRadius ** 2 - (height - (FIELD.ceilingY - FIELD.wallRadius)) ** 2));
  }
  return usableRadius;
}

function resolvePlayerGoalBounds(p) {
  const carHalfWidth = 1.28, carHalfLength = 2.12, carHeight = 2.05;
  const insideMouth = Math.abs(p.x) < FIELD.goalHalfWidth - carHalfWidth && p.y < FIELD.goalOpeningHeight - carHeight;
  const nearLimit = FIELD_START_Z + carHalfLength;
  const farLimit = FIELD_END_Z - carHalfLength;
  const nearTunnel = p.z < FIELD_START_Z;
  const farTunnel = p.z > FIELD_END_Z;
  if ((nearTunnel || p.z < nearLimit) && !insideMouth) {
    p.z = nearLimit;
    if (p.vz < 0) p.vz = Math.abs(p.vz) * .22;
  } else if ((farTunnel || p.z > farLimit) && !insideMouth) {
    p.z = farLimit;
    if (p.vz > 0) p.vz = -Math.abs(p.vz) * .22;
  }
  if (insideMouth && (nearTunnel || farTunnel)) {
    const tunnelSide = FIELD.goalHalfWidth - carHalfWidth;
    if (Math.abs(p.x) > tunnelSide) { p.x = Math.sign(p.x) * tunnelSide; p.vx *= -.24; }
    const backLimit = nearTunnel ? GOAL_NEAR_BACK_Z + carHalfLength : GOAL_FAR_BACK_Z - carHalfLength;
    if (nearTunnel && p.z < backLimit) { p.z = backLimit; if (p.vz < 0) p.vz = Math.abs(p.vz) * .22; }
    if (farTunnel && p.z > backLimit) { p.z = backLimit; if (p.vz > 0) p.vz = -Math.abs(p.vz) * .22; }
  }
}

function resolvePlayerAirWallBounds(p) {
  if (!p.jumping) return;
  const halfWidth = FIELD.halfWidth + roundedWallOffset(p.y) - 1.28;
  if (Math.abs(p.x) > halfWidth) {
    p.x = Math.sign(p.x) * halfWidth;
    if (p.vx * p.x > 0) p.vx *= -.38;
    p.vz *= .92;
  }
}

function updateWallDrive(dt, controls, p, boosting) {
  const forwardInput = Number(controls.forward) - Number(controls.reverse);
  const reverseDirection = p.speed < -.15 ? -1 : 1;
  const turnScale = 2.3 * (1 - .42 * clamp(Math.abs(p.speed) / 38, 0, 1)) * (controls.handbrake ? 1.42 : 1);
  p.wallAngle = Math.atan2(Math.sin(p.wallAngle + controls.steer * reverseDirection * turnScale * dt), Math.cos(p.wallAngle + controls.steer * reverseDirection * turnScale * dt));
  let speed = p.speed;
  if (controls.forward) speed += (speed < -1 ? 50 : 34) * dt;
  if (controls.reverse) speed -= (speed > 1 ? 55 : 19) * dt;
  if (boosting) speed += 40 * dt;
  speed -= 12 * Math.sin(p.wallAngle) * dt;
  speed *= Math.exp(-dt * (controls.handbrake ? .24 : .11));
  speed = clamp(speed, -13, boosting ? 42 : 34);
  p.speed = speed;
  p.vx = 0;
  p.vy = Math.sin(p.wallAngle) * speed;
  p.vz = Math.cos(p.wallAngle) * speed;
  p.y += p.vy * dt;
  p.z += p.vz * dt;
  p.x = p.wallSide * SIDE_WALL_X;

  const zMin = FIELD_START_Z + 2, zMax = FIELD_END_Z - 2;
  if (p.z < zMin || p.z > zMax) {
    p.z = clamp(p.z, zMin, zMax);
    p.wallAngle = Math.atan2(Math.sin(p.wallAngle), -Math.cos(p.wallAngle));
    p.speed *= .72;
  }

  const lower = FIELD.wallRadius, upper = FIELD.ceilingY - FIELD.wallRadius;
  if (p.y < lower && p.vy < 0) {
    const side = p.wallSide, offset = FIELD.wallRadius * .995;
    p.surface = 'lowerRamp'; p.wallSide = 0; p.wallAngle = 0;
    p.x = side * (FIELD.halfWidth + offset); p.y = lowerWallHeight(offset);
    p.vx = -side * Math.abs(p.vy); p.vy = 0;
    p.angle = Math.atan2(p.vx, p.vz); p.speed = Math.hypot(p.vx, p.vz);
  } else if (p.y > upper && p.vy > 0) {
    const side = p.wallSide, offset = FIELD.wallRadius * .995;
    p.surface = 'upperRamp'; p.wallSide = 0; p.wallAngle = 0;
    p.x = side * (FIELD.halfWidth + offset); p.y = FIELD.ceilingY - lowerWallHeight(offset);
    p.vx = -side * Math.abs(p.vy); p.vy = 0;
    p.angle = Math.atan2(p.vx, p.vz); p.speed = Math.hypot(p.vx, p.vz);
  } else {
    p.y = clamp(p.y, lower, upper);
  }
  return boosting;
}

function updateCeilingDrive(dt, controls, p, boosting) {
  const fwdX = Math.sin(p.angle), fwdZ = Math.cos(p.angle);
  const rightX = Math.cos(p.angle), rightZ = -Math.sin(p.angle);
  let longitudinal = p.vx * fwdX + p.vz * fwdZ;
  let lateral = p.vx * rightX + p.vz * rightZ;
  const reverseDirection = longitudinal < -.15 ? -1 : 1;
  const steerScale = 2.2 * (1 - .43 * clamp(Math.abs(longitudinal) / 36, 0, 1));
  p.angle -= controls.steer * reverseDirection * steerScale * dt;
  const newFwdX = Math.sin(p.angle), newFwdZ = Math.cos(p.angle);
  const newRightX = Math.cos(p.angle), newRightZ = -Math.sin(p.angle);
  longitudinal = p.vx * newFwdX + p.vz * newFwdZ;
  lateral = p.vx * newRightX + p.vz * newRightZ;
  if (controls.forward) longitudinal += (longitudinal < -1 ? 50 : 34) * dt;
  if (controls.reverse) longitudinal -= (longitudinal > 1 ? 55 : 19) * dt;
  if (boosting) longitudinal += 40 * dt;
  longitudinal *= Math.exp(-dt * .11);
  lateral *= Math.exp(-dt * (controls.handbrake ? 1.7 : 8.5));
  longitudinal = clamp(longitudinal, -13, boosting ? 42 : 34);
  p.vx = newFwdX * longitudinal + newRightX * lateral;
  p.vz = newFwdZ * longitudinal + newRightZ * lateral;
  p.speed = longitudinal;
  p.x += p.vx * dt; p.z += p.vz * dt;
  p.y = FIELD.ceilingY;

  const side = Math.sign(p.x);
  const offset = Math.abs(p.x) - FIELD.halfWidth;
  if (offset > 0 && offset < FIELD.wallRadius) {
    p.surface = 'upperRamp';
    p.y = FIELD.ceilingY - lowerWallHeight(offset);
  } else if (offset >= FIELD.wallRadius) {
    p.surface = 'wall'; p.wallSide = side; p.x = side * SIDE_WALL_X; p.y = FIELD.ceilingY - FIELD.wallRadius;
    p.wallAngle = Math.atan2(-Math.abs(p.vx), p.vz);
    p.speed = Math.hypot(p.vx, p.vz); p.vx = 0; p.vy = Math.sin(p.wallAngle) * p.speed; p.vz = Math.cos(p.wallAngle) * p.speed;
  } else {
    p.surface = 'ceiling';
  }
  p.z = clamp(p.z, FIELD_START_Z + 2, FIELD_END_Z - 2);
  return boosting;
}

function updatePlayerPhysics(dt, controls, kickoffLocked) {
  const p = state.player;
  const forwardInput = Number(controls.forward) - Number(controls.reverse);
  const grounded = !p.jumping && p.surface !== 'air';
  const jumpPressed = controls.jump && !p.jumpHeld;
  p.jumpHeld = controls.jump;

  if (kickoffLocked) {
    p.vx *= Math.exp(-dt * 8); p.vy *= Math.exp(-dt * 8); p.vz *= Math.exp(-dt * 8); p.speed = 0;
    p.surface = 'ground'; p.wallSide = 0; p.wallAngle = 0; p.y = 0; p.jumping = false;
    return false;
  }

  if (jumpPressed && grounded) {
    if (p.surface === 'wall') {
      p.vx = -p.wallSide * 10.5; p.vy += 2.2;
      p.angle = Math.atan2(p.vx, p.vz); p.wallSide = 0;
    } else if (p.surface === 'ceiling') {
      p.vy = -10.2;
    } else if (p.surface === 'lowerRamp' || p.surface === 'upperRamp') {
      const side = Math.sign(p.x), offset = Math.abs(p.x) - FIELD.halfWidth;
      const progress = clamp(offset, 0, FIELD.wallRadius) / FIELD.wallRadius;
      const sign = p.surface === 'lowerRamp' ? 1 : -1;
      p.vx += -side * progress * 8.5;
      p.vy += Math.sqrt(Math.max(0, 1 - progress * progress)) * sign * 8.5;
    } else p.vy = 10.2;
    p.surface = 'air'; p.jumping = true; p.airJumps = 1; p.airTime = 0; p.jumpHoldTime = 0;
    p.pitch = -.08; state.cameraShake = Math.max(state.cameraShake, .08);
  } else if (jumpPressed && p.jumping && p.airJumps < 2 && p.airTime < 1.25) {
    p.airJumps++;
    if (Math.abs(controls.steer) > .24) {
      const rightX = Math.cos(p.angle), rightZ = -Math.sin(p.angle), direction = Math.sign(controls.steer);
      p.vx += rightX * direction * 12.5; p.vz += rightZ * direction * 12.5;
      p.vy += 3.6; p.flipAxis = 'roll'; p.flipDirection = -direction; p.flipTimer = .28;
    } else if (Math.abs(forwardInput) > .2) {
      const direction = Math.sign(forwardInput), fwdX = Math.sin(p.angle), fwdZ = Math.cos(p.angle);
      p.vx += fwdX * direction * 13; p.vz += fwdZ * direction * 13;
      p.vy += 5.8; p.flipAxis = 'pitch'; p.flipDirection = direction; p.flipTimer = .38;
    } else p.vy += 9.2;
    state.cameraShake = Math.max(state.cameraShake, .14);
  }

  const boosting = controls.boost && state.boost > 0;
  if (boosting) state.boost = Math.max(0, state.boost - 33 * dt);
  if (!p.jumping && p.surface === 'wall') return updateWallDrive(dt, controls, p, boosting);
  if (!p.jumping && p.surface === 'ceiling') return updateCeilingDrive(dt, controls, p, boosting);

  if (!p.jumping) {
    const fwdX = Math.sin(p.angle), fwdZ = Math.cos(p.angle);
    const rightX = Math.cos(p.angle), rightZ = -Math.sin(p.angle);
    let longitudinal = p.vx * fwdX + p.vz * fwdZ;
    let lateral = p.vx * rightX + p.vz * rightZ;
    const reverseDirection = longitudinal < -.15 ? -1 : 1;
    const steeringDirection = p.surface === 'upperRamp' ? -1 : 1;
    const steerScale = 2.5 * (1 - .55 * clamp(Math.abs(longitudinal) / 34, 0, 1)) * (controls.handbrake ? 1.82 : 1);
    p.angle += controls.steer * reverseDirection * steerScale * dt * steeringDirection;
    const newFwdX = Math.sin(p.angle), newFwdZ = Math.cos(p.angle);
    const newRightX = Math.cos(p.angle), newRightZ = -Math.sin(p.angle);
    longitudinal = p.vx * newFwdX + p.vz * newFwdZ;
    lateral = p.vx * newRightX + p.vz * newRightZ;
    if (controls.forward) longitudinal += (longitudinal < -1 ? 50 : 34) * dt;
    if (controls.reverse) longitudinal -= (longitudinal > 1 ? 55 : 19) * dt;
    if (boosting) longitudinal += 40 * dt;
    longitudinal *= Math.exp(-dt * .11);
    lateral *= Math.exp(-dt * (controls.handbrake ? 1.3 : 7.2));
    longitudinal = clamp(longitudinal, -13, boosting ? 42 : 34);
    p.vx = newFwdX * longitudinal + newRightX * lateral;
    p.vz = newFwdZ * longitudinal + newRightZ * lateral;
    const maxSpeed = boosting ? 42 : 34;
    const horizontalSpeed = Math.hypot(p.vx, p.vz);
    if (horizontalSpeed > maxSpeed) { p.vx *= maxSpeed / horizontalSpeed; p.vz *= maxSpeed / horizontalSpeed; }
    p.pitch *= Math.exp(-dt * 10); p.roll *= Math.exp(-dt * 10);
    p.speed = longitudinal;
  } else {
    p.airTime += dt;
    p.angle += controls.steer * 1.65 * dt;
    p.pitch += forwardInput * 1.7 * dt;
    const rollInput = Number(controls.airRollRight) - Number(controls.airRollLeft);
    if (p.flipTimer > 0) {
      p.flipTimer = Math.max(0, p.flipTimer - dt);
      if (p.flipAxis === 'pitch') p.pitch += p.flipDirection * 14 * dt;
      else p.roll += p.flipDirection * 17 * dt;
    } else if (rollInput) p.roll += rollInput * 3.55 * dt;
    else p.roll *= Math.exp(-dt * 1.3);
    if (controls.jump && p.airJumps === 1 && p.jumpHoldTime < .18) {
      p.vy += 10.5 * dt; p.jumpHoldTime += dt;
    }
    const forwardX = Math.sin(p.angle) * Math.cos(p.pitch);
    const forwardY = -Math.sin(p.pitch);
    const forwardZ = Math.cos(p.angle) * Math.cos(p.pitch);
    const airEngine = controls.forward || controls.reverse ? 5.5 * forwardInput : 0;
    const airBoost = boosting ? 40 : 0;
    p.vx += forwardX * (airEngine + airBoost) * dt;
    p.vy += forwardY * (airEngine + airBoost) * dt;
    p.vz += forwardZ * (airEngine + airBoost) * dt;
    p.vy -= 24.5 * dt;
    p.vx *= Math.exp(-dt * .035); p.vz *= Math.exp(-dt * .035);
    const horizontalSpeed = Math.hypot(p.vx, p.vz);
    if (horizontalSpeed > 42) { p.vx *= 42 / horizontalSpeed; p.vz *= 42 / horizontalSpeed; }
    p.speed = p.vx * Math.sin(p.angle) + p.vz * Math.cos(p.angle);
  }

  p.x += p.vx * dt; p.z += p.vz * dt;
  if (!p.jumping) {
    const side = Math.sign(p.x);
    const sideOffset = Math.abs(p.x) - FIELD.halfWidth;
    if (p.surface === 'ground' || p.surface === 'lowerRamp') {
      if (sideOffset > 0 && sideOffset < FIELD.wallRadius) {
        p.surface = 'lowerRamp'; p.y = lowerWallHeight(sideOffset);
      } else if (sideOffset >= FIELD.wallRadius) {
        p.surface = 'wall'; p.wallSide = side; p.x = side * SIDE_WALL_X; p.y = FIELD.wallRadius;
        p.wallAngle = Math.atan2(side * p.vx, p.vz); p.speed = Math.hypot(p.vx, p.vz);
        p.vx = 0; p.vy = Math.sin(p.wallAngle) * p.speed; p.vz = Math.cos(p.wallAngle) * p.speed;
      } else {
        p.surface = 'ground'; p.y = 0; p.roll = 0;
      }
    } else if (p.surface === 'upperRamp') {
      if (sideOffset > 0 && sideOffset < FIELD.wallRadius) p.y = FIELD.ceilingY - lowerWallHeight(sideOffset);
      else if (sideOffset >= FIELD.wallRadius) {
        p.surface = 'wall'; p.wallSide = side; p.x = side * SIDE_WALL_X; p.y = FIELD.ceilingY - FIELD.wallRadius;
        p.wallAngle = Math.atan2(-Math.abs(p.vx), p.vz); p.speed = Math.hypot(p.vx, p.vz);
        p.vx = 0; p.vy = Math.sin(p.wallAngle) * p.speed; p.vz = Math.cos(p.wallAngle) * p.speed;
      } else { p.surface = 'ceiling'; p.y = FIELD.ceilingY; }
    }
  }
  if (p.jumping) {
    p.y += p.vy * dt;
    if (p.y <= 0) {
      p.y = 0; p.vy = 0; p.jumping = false; p.surface = 'ground'; p.airJumps = 0; p.airTime = 0;
      p.pitch = 0; p.roll = 0; p.flipTimer = 0; state.cameraShake = Math.max(state.cameraShake, .2);
    } else if (p.y >= FIELD.ceilingY - 1.4 && p.vy > 0) {
      p.y = FIELD.ceilingY - 1.4; p.vy = -Math.abs(p.vy) * .46; p.surface = 'air';
    }
  } else if (p.surface === 'ground') p.y = 0;
  resolvePlayerGoalBounds(p);
  resolvePlayerAirWallBounds(p);
  return boosting;
}

function updateBallPhysics(dt, kickoffLocked) {
  const ball = state.ball;
  if (kickoffLocked) { Object.assign(ball, { x: 0, z: FIELD.centerZ, y: BALL_RESTING_HEIGHT, vx: 0, vz: 0, vy: 0 }); return false; }
  const previousZ = ball.z;
  const radius = BALL_RADIUS;
  ball.vy -= 24 * dt; ball.y += ball.vy * dt;
  if (ball.y < radius) {
    ball.y = radius; ball.vy = Math.abs(ball.vy) * .58;
    if (ball.vy < 1.5) ball.vy = 0;
    ball.vx *= Math.exp(-dt * .36); ball.vz *= Math.exp(-dt * .36);
  } else {
    ball.vx *= Math.exp(-dt * .055); ball.vz *= Math.exp(-dt * .055);
  }
  ball.x += ball.vx * dt; ball.z += ball.vz * dt;
  limitBallSpeed();
  const sideLimit = FIELD.halfWidth + roundedBallWallOffset(ball.y, radius);
  if (Math.abs(ball.x) > sideLimit) { ball.x = Math.sign(ball.x) * sideLimit; ball.vx *= -.76; }
  const ceilingLimit = FIELD.ceilingY - radius;
  if (ball.y > ceilingLimit) { ball.y = ceilingLimit; ball.vy = -Math.abs(ball.vy) * .68; }

  const insideGoalMouth = Math.abs(ball.x) < FIELD.goalHalfWidth - radius && ball.y >= radius && ball.y < FIELD.goalOpeningHeight - radius;
  const inNearTunnel = ball.z < FIELD_START_Z;
  const inFarTunnel = ball.z > FIELD_END_Z;
  if (inNearTunnel || inFarTunnel) {
    if (!insideGoalMouth) {
      const blockedByGoalFrame = Math.abs(ball.x) < FIELD.goalHalfWidth + radius && ball.y + radius > FIELD.goalOpeningHeight;
      const wallOffset = blockedByGoalFrame ? 0 : roundedBallWallOffset(ball.y, radius);
      if (inNearTunnel) { ball.z = FIELD_START_Z - wallOffset + radius; ball.vz = Math.abs(ball.vz) * .78; }
      else { ball.z = FIELD_END_Z + wallOffset - radius; ball.vz = -Math.abs(ball.vz) * .78; }
    } else {
      const goalSideLimit = FIELD.goalHalfWidth - radius;
      if (Math.abs(ball.x) > goalSideLimit) { ball.x = Math.sign(ball.x) * goalSideLimit; ball.vx *= -.68; }
      if (ball.y > FIELD.goalOpeningHeight - radius) { ball.y = FIELD.goalOpeningHeight - radius; ball.vy = -Math.abs(ball.vy) * .62; }
      const nearScorePlane = FIELD_START_Z - radius;
      const farScorePlane = FIELD_END_Z + radius;
      const crossedNearGoalLine = previousZ >= nearScorePlane && ball.z <= nearScorePlane;
      const crossedFarGoalLine = previousZ <= farScorePlane && ball.z >= farScorePlane;
      if (state.match && (crossedNearGoalLine || crossedFarGoalLine)) {
        if (crossedFarGoalLine) state.score[0]++; else state.score[1]++;
        resetRound(crossedFarGoalLine ? 0 : 1); return true;
      }
      if (ball.z < GOAL_NEAR_BACK_Z + radius) { ball.z = GOAL_NEAR_BACK_Z + radius; ball.vz = Math.abs(ball.vz) * .68; }
      if (ball.z > GOAL_FAR_BACK_Z - radius) { ball.z = GOAL_FAR_BACK_Z - radius; ball.vz = -Math.abs(ball.vz) * .68; }
    }
  } else {
    const blockedByGoalFrame = Math.abs(ball.x) < FIELD.goalHalfWidth + radius && ball.y + radius > FIELD.goalOpeningHeight;
    const wallOffset = blockedByGoalFrame ? 0 : roundedBallWallOffset(ball.y, radius);
    const nearLimit = FIELD_START_Z - wallOffset + radius;
    const farLimit = FIELD_END_Z + wallOffset - radius;
    if (ball.z < nearLimit) {
      ball.z = nearLimit;
      if (ball.vz < 0) ball.vz *= -.78;
    }
    if (ball.z > farLimit) {
      ball.z = farLimit;
      if (ball.vz > 0) ball.vz *= -.78;
    }
  }
  return false;
}

function limitBallSpeed() {
  const ball = state.ball;
  const speed = Math.hypot(ball.vx, ball.vy, ball.vz);
  const maxSpeed = 48;
  if (speed > maxSpeed) {
    const scale = maxSpeed / speed;
    ball.vx *= scale; ball.vy *= scale; ball.vz *= scale;
  }
}

function getCarCollisionBasis(car) {
  if (car === state.player && !car.jumping && ['wall', 'ceiling', 'lowerRamp', 'upperRamp'].includes(car.surface)) {
    const frame = getPlayerSurfaceFrame(car);
    carRight.copy(surfaceRight); carUp.copy(frame.up); carForward.copy(frame.forward);
    return;
  }
  carBasisEuler.set(car.pitch || 0, car.angle || 0, car.roll || 0, 'XYZ');
  carBasisMatrix.makeRotationFromEuler(carBasisEuler);
  carRight.set(1, 0, 0).transformDirection(carBasisMatrix);
  carUp.set(0, 1, 0).transformDirection(carBasisMatrix);
  carForward.set(0, 0, 1).transformDirection(carBasisMatrix);
}

function resolveCarBallCollision(car, playerControlled = false, boosting = false) {
  const ball = state.ball;
  getCarCollisionBasis(car);
  carBallDelta.set(ball.x - car.x, ball.y - ((car.y || 0) + .88), ball.z - car.z);
  const localX = carBallDelta.dot(carRight);
  const localY = carBallDelta.dot(carUp);
  const localZ = carBallDelta.dot(carForward);
  const closestX = clamp(localX, -1.24, 1.24), closestY = clamp(localY, -.82, .82), closestZ = clamp(localZ, -2.06, 2.06);
  let nx = localX - closestX, ny = localY - closestY, nz = localZ - closestZ;
  let distance = Math.hypot(nx, ny, nz);
  const ballRadius = BALL_RADIUS;
  if (distance >= ballRadius) return false;
  if (distance < .0001) { nz = localZ >= 0 ? 1 : -1; distance = 1; }
  nx /= distance; ny /= distance; nz /= distance;
  const normalX = carRight.x * nx + carUp.x * ny + carForward.x * nz;
  const normalY = carRight.y * nx + carUp.y * ny + carForward.y * nz;
  const normalZ = carRight.z * nx + carUp.z * ny + carForward.z * nz;
  const penetration = ballRadius - Math.hypot(localX - closestX, localY - closestY, localZ - closestZ);
  ball.x += normalX * (penetration + .005); ball.y += normalY * (penetration + .005); ball.z += normalZ * (penetration + .005);
  const carVx = car.vx || 0, carVy = car.vy || 0, carVz = car.vz || 0;
  const relativeSpeed = (ball.vx - carVx) * normalX + (ball.vy - carVy) * normalY + (ball.vz - carVz) * normalZ;
  if (relativeSpeed < 0) {
    const impulse = clamp(-relativeSpeed * 1.52 + (boosting ? 3.5 : 0), 0, 27);
    ball.vx += normalX * impulse; ball.vy += normalY * impulse; ball.vz += normalZ * impulse;
    ball.vy = Math.max(ball.vy, .8);
    limitBallSpeed();
    if (playerControlled) {
      state.cameraShake = Math.max(state.cameraShake, .28);
      if (state.time - state.playerHitCooldown > .65) { showToast('¡Impacto!'); state.playerHitCooldown = state.time; }
    }
  }
  return true;
}

function resolveCarCarCollision(player, opponent) {
  if (Math.abs((player.y || 0) - (opponent.y || 0)) > 2.6) return false;
  let dx = player.x - opponent.x, dz = player.z - opponent.z;
  let distance = Math.hypot(dx, dz);
  const minimum = 3.35;
  if (distance >= minimum) return false;
  if (distance < .001) { dx = 1; dz = 0; distance = 1; }
  const nx = dx / distance, nz = dz / distance, penetration = minimum - distance;
  player.x += nx * penetration * .58; player.z += nz * penetration * .58;
  opponent.x -= nx * penetration * .42; opponent.z -= nz * penetration * .42;
  const closingSpeed = (player.vx - (opponent.vx || 0)) * nx + (player.vz - (opponent.vz || 0)) * nz;
  if (closingSpeed < 0) {
    const impulse = Math.min(18, -closingSpeed * .72);
    player.vx += nx * impulse * .35; player.vz += nz * impulse * .35;
    opponent.vx = (opponent.vx || 0) - nx * impulse * .65;
    opponent.vz = (opponent.vz || 0) - nz * impulse * .65;
    if (Math.hypot(player.vx, player.vz) > 38 && state.boost > 0) {
      opponent.x = 0; opponent.z = BOT_START_Z; opponent.angle = Math.PI; opponent.speed = 0;
      opponent.vx = 0; opponent.vz = 0; opponent.demolishedTimer = 2.2;
      if (botCar) botCar.group.visible = false;
      showToast('¡Demolición!');
    }
    state.cameraShake = Math.max(state.cameraShake, .38);
  }
  return true;
}

function updateBotAI(dt, kickoffLocked) {
  const bot = state.bot, ball = state.ball, player = state.player;
  const profile = botProfiles[state.botDifficulty] || botProfiles.competitive;
  bot.jumpCooldown = Math.max(0, bot.jumpCooldown - dt);
  if (kickoffLocked) {
    bot.speed = 0; bot.vx = 0; bot.vy = 0; bot.vz = 0;
    bot.y = 0; bot.pitch = 0; bot.jumping = false; bot.boosting = false;
    return;
  }

  const toBallX = ball.x - bot.x, toBallZ = ball.z - bot.z;
  const distanceToBall = Math.hypot(toBallX, toBallZ);
  const interceptTime = clamp(distanceToBall / (profile.baseSpeed + Math.hypot(bot.vx, bot.vz) * profile.prediction), .12, profile.horizon);
  const interceptX = clamp(ball.x + ball.vx * interceptTime, -FIELD.halfWidth + 5, FIELD.halfWidth - 5);
  const interceptZ = clamp(ball.z + ball.vz * interceptTime, FIELD_START_Z + 3, FIELD_END_Z - 3);
  const ownGoalThreat = ball.z > FIELD.centerZ + FIELD.halfLength * .3 && (ball.vz > 2 || ball.z > GOAL_FAR_Z - 20);
  let targetX, targetZ;

  if (ownGoalThreat) {
    bot.behavior = 'defend';
    const timeToGoalLine = clamp((GOAL_FAR_Z - ball.z) / Math.max(4, ball.vz), 0, .9);
    targetX = clamp(ball.x + ball.vx * timeToGoalLine, -FIELD.goalHalfWidth + 1.5, FIELD.goalHalfWidth - 1.5);
    targetZ = GOAL_FAR_Z - 12;
  } else {
    bot.behavior = 'attack';
    // Line up behind the ball relative to the near net so the hit travels toward goal.
    const awayX = interceptX, awayZ = interceptZ - GOAL_NEAR_Z;
    const awayLength = Math.max(.001, Math.hypot(awayX, awayZ));
    targetX = interceptX + awayX / awayLength * 4.8;
    targetZ = interceptZ + awayZ / awayLength * 4.8;
  }
  targetX = clamp(targetX, -FIELD.halfWidth + 7, FIELD.halfWidth - 7);
  targetZ = clamp(targetZ, FIELD_START_Z + 3, FIELD_END_Z - 3);

  const dx = targetX - bot.x, dz = targetZ - bot.z;
  const targetDistance = Math.hypot(dx, dz);
  const faceBall = bot.jumping || (bot.behavior === 'defend' && Math.abs(bot.z - targetZ) < 10);
  const wantedAngle = Math.atan2((faceBall ? ball.x : targetX) - bot.x, (faceBall ? ball.z : targetZ) - bot.z);
  const angleError = angleDiff(bot.angle, wantedAngle);
  const turningRate = bot.jumping ? profile.turnRate * .74 : profile.turnRate;
  bot.angle += clamp(angleError, -turningRate * dt, turningRate * dt);
  const aligned = Math.abs(angleError) < .48;

  const playerHasPressure = Math.hypot(player.x - ball.x, player.z - ball.z) < 15;
  const boostThreshold = bot.behavior === 'defend' || playerHasPressure ? profile.boostReserve * .45 : profile.boostReserve;
  const wantsBoost = (targetDistance > 14 || (bot.jumping && ball.y > bot.y + 1.5 && distanceToBall > 2.8)) && aligned && bot.boost > boostThreshold;
  bot.boosting = wantsBoost;
  if (wantsBoost) bot.boost = Math.max(0, bot.boost - 31 * dt);

  const comeback = state.score[1] < state.score[0];
  const maxSpeed = profile.maxSpeed + (comeback ? 2 : 0) + (bot.boosting ? profile.boostSpeed : 0);
  if (!bot.jumping) {
    const turnPenalty = clamp(Math.abs(angleError) / 1.7, 0, .84);
    let targetSpeed = clamp(targetDistance * profile.chase, 4.5, maxSpeed) * (1 - turnPenalty);
    if (targetDistance < 2.8) targetSpeed = Math.min(targetSpeed, 5);
    const acceleration = bot.boosting ? profile.boostAcceleration : profile.acceleration;
    bot.speed += clamp(targetSpeed - bot.speed, -29 * dt, acceleration * dt);
    bot.speed = clamp(bot.speed, 0, maxSpeed);
    bot.vx = Math.sin(bot.angle) * bot.speed;
    bot.vz = Math.cos(bot.angle) * bot.speed;
  }

  const predictedHeight = ball.y + ball.vy * interceptTime - 12 * interceptTime * interceptTime;
  const aerialIntercept = !bot.jumping && bot.jumpCooldown <= 0 && distanceToBall < profile.aerialDistance && predictedHeight > 2.35 && predictedHeight < profile.aerialHeight;
  if (aerialIntercept) {
    bot.jumping = true; bot.airTime = 0; bot.vy = 10.5; bot.jumpCooldown = profile.jumpCooldown;
  }

  if (bot.jumping) {
    bot.airTime += dt;
    const horizontalDistance = Math.max(2, Math.hypot(toBallX, toBallZ));
    const desiredPitch = clamp(-Math.atan2(ball.y - bot.y, horizontalDistance), -.42, .3);
    bot.pitch += (desiredPitch - bot.pitch) * (1 - Math.exp(-dt * 3.5));
    bot.roll *= Math.exp(-dt * 2.5);
    if (bot.boosting) {
      const thrust = 16;
      bot.vx += Math.sin(bot.angle) * Math.cos(bot.pitch) * thrust * dt;
      bot.vy += -Math.sin(bot.pitch) * thrust * dt;
      bot.vz += Math.cos(bot.angle) * Math.cos(bot.pitch) * thrust * dt;
    }
    bot.vy -= 25 * dt;
    bot.vx *= Math.exp(-dt * .06); bot.vz *= Math.exp(-dt * .06);
    const airSpeed = Math.hypot(bot.vx, bot.vz);
    if (airSpeed > 36) { bot.vx *= 36 / airSpeed; bot.vz *= 36 / airSpeed; }
    bot.x += bot.vx * dt; bot.z += bot.vz * dt; bot.y += bot.vy * dt;
    if (bot.y <= 0) {
      bot.y = 0; bot.vy = 0; bot.jumping = false; bot.airTime = 0; bot.pitch = 0;
      bot.speed = Math.hypot(bot.vx, bot.vz);
    }
  } else {
    bot.y = 0; bot.pitch = 0; bot.roll = 0;
    bot.x += bot.vx * dt; bot.z += bot.vz * dt;
  }

  bot.x = clamp(bot.x, -FIELD.halfWidth + 3, FIELD.halfWidth - 3);
  bot.z = clamp(bot.z, FIELD_START_Z + 2.2, FIELD_END_Z - 2.2);
}

function updateWorld(dt) {
  const controller = readGamepad();
  const wasPaused = state.paused;
  if (controller.pressed.menu && state.match) togglePause();
  if (wasPaused || state.paused) return;
  state.time += dt;
  if (controller.pressed.ballCam) setBallCam(!state.ballCam);
  if (controller.pressed.garage && !state.match) state.menu === 'garage' ? closePanel() : openPanel('garage');
  if (controller.pressed.menu && !state.match) state.menu === 'play' ? closePanel() : openPanel('play');
  const p = state.player, b = state.ball;
  const kickoffLocked = state.match && state.kickoffTimer > 0;
  if (kickoffLocked) state.kickoffTimer = Math.max(0, state.kickoffTimer - dt);
  const canDrive = ui.panel.hidden && !kickoffLocked;
  const controls = {
    forward: canDrive && isActionHeld('accelerate', controller),
    reverse: canDrive && isActionHeld('reverse', controller),
    steer: canDrive ? clamp(Number(isActionHeld('right', controller)) - Number(isActionHeld('left', controller)) + controller.steer, -1, 1) : 0,
    boost: canDrive && isActionHeld('boost', controller),
    handbrake: canDrive && isActionHeld('handbrake', controller),
    jump: canDrive && isActionHeld('jump', controller),
    airRollLeft: canDrive && isActionHeld('airRollLeft', controller),
    airRollRight: canDrive && isActionHeld('airRollRight', controller)
  };
  const boosting = updatePlayerPhysics(dt, controls, kickoffLocked);
  if (!kickoffLocked) updateBoostPads(dt);

  const scored = updateBallPhysics(dt, kickoffLocked);
  if (!scored && !kickoffLocked) resolveCarBallCollision(p, true, boosting);

  if (state.match) {
    const bot = state.bot;
    if (bot.demolishedTimer > 0) {
      bot.demolishedTimer = Math.max(0, bot.demolishedTimer - dt);
      if (bot.demolishedTimer === 0) {
        Object.assign(bot, { x: 0, z: BOT_START_Z, angle: Math.PI, speed: 0, vx: 0, vy: 0, vz: 0, y: 0, pitch: 0, roll: 0, surface: 'ground', wallSide: 0, wallAngle: 0, jumping: false, boosting: false });
        botCar.group.visible = true;
      }
    }
    if (!bot.demolishedTimer) updateBotAI(dt, kickoffLocked);
    if (!kickoffLocked && !bot.demolishedTimer) {
      resolveCarCarCollision(p, bot);
      resolveCarBallCollision(bot, false, bot.boosting);
    }
    if (!kickoffLocked) state.matchSeconds = Math.max(0, state.matchSeconds - dt);
    if (state.matchSeconds <= 0) {
      const result = state.score[0] > state.score[1] ? '¡Victoria naranja!' : state.score[1] > state.score[0] ? '¡Victoria azul!' : 'Partida empatada';
      finishMatch(); showToast(result);
    }
  }

  updatePlayerModelPose(p, controls.steer);
  updateBoostJets(playerCar, boosting, state.time);
  const wheelSpin = p.speed * dt * 1.6;
  for (const wheel of playerCar.wheels) {
    wheel.rotation.x += wheelSpin;
    wheel.rotation.y = wheel.position.z > 0 ? controls.steer * .34 : 0;
  }
  updateCar(botCar, state.bot, state.bot.angle, state.bot.y || 0);
  botCar.group.rotation.x = state.bot.jumping ? state.bot.pitch : 0;
  botCar.group.rotation.z = state.bot.roll || 0;
  updateBoostJets(botCar, Boolean(state.match && state.bot.boosting), state.time);
  for (const wheel of botCar.wheels) { wheel.rotation.x += (state.bot.speed || 0) * dt * 1.2; wheel.rotation.y = wheel.position.z > 0 ? angleDiff(state.bot.angle, Math.atan2(state.ball.x - state.bot.x, state.ball.z - state.bot.z)) * .25 : 0; }
  ballObject.group.position.set(b.x, b.y, b.z); ballObject.group.rotation.x += b.vz * dt * .24; ballObject.group.rotation.z -= b.vx * dt * .24;
  ballObject.shadow.position.set(b.x, .04, b.z); const shadowScale = clamp(1.08 - (b.y - BALL_RESTING_HEIGHT) * .08, .62, 1.08); ballObject.shadow.scale.setScalar(shadowScale);
  updateCamera(dt);
  ui.boostValue.textContent = String(Math.round(state.boost)); ui.boostArc.style.strokeDasharray = `${state.boost * .77} 100`;
  const sec = Math.ceil(state.matchSeconds); ui.clock.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  ui.orangeScore.textContent = state.score[0]; ui.blueScore.textContent = state.score[1];
}

function updateCamera(dt) {
  const p = state.player;
  const frame = getPlayerSurfaceFrame(p);
  cameraAnchor.set(p.x, p.y, p.z);
  let ballDistance = 0;
  cameraAimTarget.copy(frame.forward);
  if (state.ballCam) {
    cameraBallDirection.set(state.ball.x - p.x, state.ball.y - p.y, state.ball.z - p.z);
    ballDistance = cameraBallDirection.length();
    if (ballDistance > .001) {
      cameraBallDirection.multiplyScalar(1 / ballDistance);
      cameraPlanarBallDirection.copy(cameraBallDirection).addScaledVector(frame.up, -cameraBallDirection.dot(frame.up));
      if (cameraPlanarBallDirection.lengthSq() > .001) {
        cameraPlanarBallDirection.normalize();
        cameraAim.lerpVectors(frame.forward, cameraPlanarBallDirection, state.ballCamStrength).normalize();
      } else cameraAim.copy(frame.forward);
      cameraAimTarget.lerp(cameraBallDirection, state.ballCamStrength).normalize();
    } else cameraAim.copy(frame.forward);
  } else cameraAim.copy(frame.forward);
  const adaptiveDistance = state.ballCam ? Math.min(22, Math.max(0, ballDistance - state.cameraLookAhead) * state.ballCamStrength * .18) : 0;
  cameraDesired.copy(cameraAnchor).addScaledVector(cameraAim, -(state.cameraDistance + adaptiveDistance)).addScaledVector(frame.up, state.cameraHeight);
  worldVelocity.set(p.vx || 0, p.vy || 0, p.vz || 0);
  cameraDesired.addScaledVector(worldVelocity, -.035);
  const lookDistance = state.ballCam
    ? Math.min(Math.max(state.cameraLookAhead, ballDistance * state.ballCamStrength), Math.max(state.cameraLookAhead, ballDistance))
    : state.cameraLookAhead;
  cameraViewTarget.copy(cameraAnchor).addScaledVector(cameraAimTarget, lookDistance).addScaledVector(frame.up, .82);
  state.cameraShake *= Math.exp(-dt * 5.5);
  const shake = state.cameraShake;
  cameraDesired.addScaledVector(frame.up, Math.cos(state.time * 37) * shake * .14);
  cameraDesired.x += Math.sin(state.time * 49) * shake * .18;
  camera.up.copy(frame.up);
  camera.position.lerp(cameraDesired, 1 - Math.exp(-dt * 7.2));
  if (!cameraLookInitialized) { cameraLookTarget.copy(cameraViewTarget); cameraLookInitialized = true; }
  else cameraLookTarget.lerp(cameraViewTarget, 1 - Math.exp(-dt * 7.5));
  camera.lookAt(cameraLookTarget);
}

function animate() {
  const dt = Math.min(.04, clock.getDelta()); updateWorld(dt); composer.render();
}
renderer.setAnimationLoop(animate);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); renderer.setSize(window.innerWidth, window.innerHeight, false);
  composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(window.innerWidth, window.innerHeight);
});

function setBallCam(value) {
  state.ballCam = value; ui.ballCam.setAttribute('aria-pressed', String(value)); ui.cameraState.textContent = value ? 'ON' : 'OFF';
  savePreferences();
}
setBallCam(state.ballCam);
function closePanel() {
  if (state.paused && state.menu !== 'pause') { openPanel('pause'); return; }
  if (state.menu === 'pause') { state.paused = false; ui.pause.setAttribute('aria-label', 'Pausar partida'); ui.pause.title = 'Pausar partida'; }
  ui.panel.hidden = true; state.menu = '';
}
function openPanel(type) {
  if (state.match && !state.paused && ['settings', 'garage', 'clips', 'maps'].includes(type)) {
    state.paused = true; ui.pause.setAttribute('aria-label', 'Reanudar partida'); ui.pause.title = 'Reanudar partida';
  }
  state.menu = type; ui.panel.hidden = false; ui.panelContent.scrollTop = 0; ui.panelFoot.innerHTML = '<kbd>ESC</kbd> para cerrar';
  if (type === 'play') renderPlayPanel();
  if (type === 'garage') renderGaragePanel();
  if (type === 'settings') renderSettingsPanel('camera');
  if (type === 'pause') renderPausePanel();
  if (type === 'clips') renderClipsPanel();
  if (type === 'maps') renderMapsPanel();
}
ui.closePanel.addEventListener('click', closePanel);

function togglePause() {
  if (!state.match) return;
  if (state.paused) {
    if (state.menu !== 'pause') { openPanel('pause'); return; }
    state.paused = false; ui.pause.setAttribute('aria-label', 'Pausar partida'); ui.pause.title = 'Pausar partida';
    ui.panel.hidden = true; state.menu = ''; state.keys.clear();
  } else {
    state.paused = true; ui.pause.setAttribute('aria-label', 'Reanudar partida'); ui.pause.title = 'Reanudar partida';
    state.keys.clear(); openPanel('pause');
  }
}
function renderPausePanel() {
  ui.panelEyebrow.textContent = 'PARTIDA LOCAL · EN PAUSA'; ui.panelTitle.textContent = 'PAUSA';
  ui.panelFoot.innerHTML = '<kbd>ESC</kbd> o <kbd>P</kbd> para continuar';
  ui.panelContent.innerHTML = `<p class="menu-intro">La partida está detenida.</p><div class="menu-list">
    <button class="menu-option" data-pause="resume" type="button"><span class="option-icon orange">▶</span><span class="option-copy"><strong>Continuar</strong><small>Volver a la cancha.</small></span><span class="option-arrow">›</span></button>
    <button class="menu-option" data-pause="settings" type="button"><span class="option-icon">⚙</span><span class="option-copy"><strong>Ajustes</strong><small>Configurar cámara, controles y gráficos.</small></span><span class="option-arrow">›</span></button>
    <button class="menu-option" data-pause="restart" type="button"><span class="option-icon">↻</span><span class="option-copy"><strong>Reiniciar partida</strong><small>Empezar de nuevo desde el saque inicial.</small></span><span class="option-arrow">›</span></button>
    <button class="menu-option" data-pause="exit" type="button"><span class="option-icon">⌂</span><span class="option-copy"><strong>Salir al menú</strong><small>Terminar esta partida local.</small></span><span class="option-arrow">›</span></button>
  </div>`;
  ui.panelContent.querySelector('[data-pause="resume"]').addEventListener('click', togglePause);
  ui.panelContent.querySelector('[data-pause="settings"]').addEventListener('click', () => openPanel('settings'));
  ui.panelContent.querySelector('[data-pause="restart"]').addEventListener('click', startMatch);
  ui.panelContent.querySelector('[data-pause="exit"]').addEventListener('click', () => {
    state.paused = false; finishMatch(); closePanel(); showToast('Volviste al menú principal.');
  });
}

function renderPlayPanel() {
  ui.panelEyebrow.textContent = 'ARENA · ELIGE TU MODO'; ui.panelTitle.textContent = 'PLAY';
  ui.panelContent.innerHTML = `<p class="menu-intro">Elige cómo quieres entrar a la cancha.</p><div class="menu-list">
    <button class="menu-option" data-mode="multiplayer"><span class="option-icon">♟</span><span class="option-copy"><strong>Multiplayer</strong><small>Conecta con amigos en una sala local.</small></span><span class="option-arrow">›</span></button>
    <button class="menu-option" data-mode="bot"><span class="option-icon orange">⚡</span><span class="option-copy"><strong>You vs Bot</strong><small>Una partida en 3D contra el rival azul.</small></span><span class="option-arrow">›</span></button>
    <button class="menu-option" data-mode="maps"><span class="option-icon">◈</span><span class="option-copy"><strong>Custom maps</strong><small>Cambia de estadio y el color de la cancha.</small></span><span class="option-arrow">›</span></button>
  </div><div class="setting-row bot-difficulty-row"><span>Dificultad del rival</span><select id="botDifficulty" aria-label="Dificultad del rival">${Object.entries(botProfiles).map(([id, profile]) => `<option value="${id}" ${state.botDifficulty === id ? 'selected' : ''}>${profile.name}</option>`).join('')}</select></div><div class="mode-note">El rival anticipa la pelota, defiende su portería, recoge boost y salta para disputar tiros aéreos. WASD conduce · Shift boost · Ctrl derrape · Espacio salta / flip · Q/E giro aéreo.</div>`;
  ui.panelContent.querySelector('[data-mode="bot"]').addEventListener('click', startMatch);
  ui.panelContent.querySelector('[data-mode="maps"]').addEventListener('click', () => openPanel('maps'));
  ui.panelContent.querySelector('[data-mode="multiplayer"]').addEventListener('click', () => showToast('El multijugador en línea llegará en una siguiente versión.'));
  ui.panelContent.querySelector('#botDifficulty').addEventListener('change', event => {
    state.botDifficulty = event.target.value; savePreferences();
    showToast(`Dificultad del rival: ${botProfiles[state.botDifficulty].name}.`);
  });
}
function startMatch() {
  closePanel(); state.paused = false; state.match = true; state.matchSeconds = 300; state.score = [0, 0];
  Object.assign(state.player, { x: 0, z: PLAYER_START_Z, speed: 0, vx: 0, vy: 0, vz: 0, angle: 0, y: 0, surface: 'ground', wallSide: 0, wallAngle: 0, pitch: 0, roll: 0, airJumps: 0, airTime: 0, jumpHeld: false, jumping: false, flipTimer: 0 });
  Object.assign(state.bot, { x: 0, z: BOT_START_Z, angle: Math.PI, speed: 0, vx: 0, vy: 0, vz: 0, y: 0, surface: 'ground', wallSide: 0, wallAngle: 0, pitch: 0, roll: 0, boost: 100, jumping: false, airTime: 0, jumpCooldown: 0, demolishedTimer: 0, boosting: false, behavior: 'attack' });
  botCar.group.visible = true;
  Object.assign(state.ball, { x: 0, z: FIELD.centerZ, y: BALL_RESTING_HEIGHT, vx: 0, vz: 0, vy: 0 });
  state.boost = 100; state.kickoffTimer = 3;
  ui.scoreboard.hidden = false; ui.hint.hidden = false; ui.pause.hidden = false; ui.pause.setAttribute('aria-label', 'Pausar partida'); ui.pause.title = 'Pausar partida'; ui.playLabel.textContent = 'SALIR'; ui.playSubLabel.textContent = 'VOLVER AL MENÚ'; showCountdown();
}
function finishMatch() {
  if (state.countdown) clearInterval(state.countdown); state.countdown = 0; ui.banner.hidden = true;
  state.match = false; state.paused = false; state.kickoffTimer = 0; ui.scoreboard.hidden = true; ui.hint.hidden = true; ui.pause.hidden = true; ui.pause.setAttribute('aria-label', 'Pausar partida'); ui.pause.title = 'Pausar partida'; ui.playLabel.textContent = 'PLAY'; ui.playSubLabel.textContent = 'PARTIDAS Y MAPAS';
}
function resetRound(side) {
  Object.assign(state.player, { x: 0, z: PLAYER_START_Z, speed: 0, vx: 0, vy: 0, vz: 0, angle: 0, y: 0, surface: 'ground', wallSide: 0, wallAngle: 0, pitch: 0, roll: 0, airJumps: 0, airTime: 0, jumpHeld: false, jumping: false, flipTimer: 0 });
  Object.assign(state.bot, { x: 0, z: BOT_START_Z, angle: Math.PI, speed: 0, vx: 0, vy: 0, vz: 0, y: 0, surface: 'ground', wallSide: 0, wallAngle: 0, pitch: 0, roll: 0, jumping: false, airTime: 0, jumpCooldown: 0, demolishedTimer: 0, boosting: false, behavior: 'attack' });
  botCar.group.visible = true;
  Object.assign(state.ball, { x: 0, z: FIELD.centerZ, y: BALL_RESTING_HEIGHT, vx: 0, vz: 0, vy: 0 });
  state.boost = 100; state.kickoffTimer = 3;
  showCountdown();
  showToast(side === 0 ? '¡GOOOL! Naranja' : '¡GOOOL! Azul');
}
function showCountdown() {
  if (state.countdown) clearInterval(state.countdown);
  let n = 3; ui.bannerCount.textContent = n; ui.banner.hidden = false;
  state.countdown = setInterval(() => { if (state.paused) return; n--; if (n < 1) { clearInterval(state.countdown); state.countdown = 0; ui.banner.hidden = true; } else ui.bannerCount.textContent = n; }, 1000);
}

function renderColorPalette(label, kind, current, palette) {
  return `<div class="palette-row"><span class="palette-label">${label}</span>${palette.map(color => `<button class="swatch ${color === current ? 'selected' : ''}" data-color-kind="${kind}" data-color="${color}" style="--swatch:${color}" aria-label="${label}: ${color}" aria-pressed="${color === current}" type="button"></button>`).join('')}<label class="custom-color" title="Elegir cualquier color" aria-label="Elegir cualquier color"><span>＋</span><input type="color" data-color-picker="${kind}" value="${current}"></label></div>`;
}

function renderGaragePanel() {
  ui.panelEyebrow.textContent = 'ARENA · PERSONALIZA'; ui.panelTitle.textContent = 'GARAJE';
  ui.panelContent.innerHTML = `<p class="menu-intro">Personaliza las piezas de tu coche 3D. Los cambios se guardan automáticamente.</p>
    <div class="setting-section"><h2>CARROCERÍA</h2><div class="car-options">${cars.map((car, i) => `<button class="car-card ${i === state.carIndex ? 'selected' : ''}" data-car="${i}" type="button" aria-pressed="${i === state.carIndex}"><span class="mini-car" style="--car-color:${state.carColor}"><span class="car-wheels"><i></i><i></i></span></span><strong>${car.name}</strong></button>`).join('')}</div></div>
    <div class="setting-section"><h2>PINTURA</h2>${renderColorPalette('Principal', 'primary', state.carColor, palettes)}${renderColorPalette('Secundaria', 'secondary', state.secondaryColor, secondaryPalettes)}</div>
    <div class="setting-section"><h2>RUEDAS</h2><div class="choice-grid">${wheelStyles.map(style => `<button class="choice-button ${state.wheelStyle === style.id ? 'selected' : ''}" data-wheel="${style.id}" type="button" aria-pressed="${state.wheelStyle === style.id}"><span class="wheel-sample ${style.id}" style="--wheel-color:${style.color}"></span>${style.name}</button>`).join('')}</div></div>
    <div class="setting-section"><h2>BOOST · ESTILO VISUAL</h2><div class="choice-grid boost-grid">${boostStyles.map(style => `<button class="choice-button boost-choice ${state.boostStyle === style.id ? 'selected' : ''}" data-boost="${style.id}" type="button" aria-pressed="${state.boostStyle === style.id}"><span class="boost-preview ${style.id}" style="--boost-color:${style.color};--boost-core:${style.secondary}"></span><strong>${style.name}</strong><small>${style.detail}</small></button>`).join('')}</div><p class="control-help">El aspecto del rastro es cosmético; la fuerza y consumo del impulso siguen iguales.</p></div>
    <div class="setting-section"><h2>ACCESORIO</h2><div class="choice-grid accessory-grid">${accessories.map(item => `<button class="choice-button ${state.accessory === item.id ? 'selected' : ''}" data-accessory="${item.id}" type="button" aria-pressed="${state.accessory === item.id}">${item.id === 'spoiler' ? '▰' : item.id === 'antenna' ? '⌁' : item.id === 'ball' ? '⚽' : '—'}<span>${item.name}</span></button>`).join('')}</div></div>
    <button class="primary-action" id="garageDone">LISTO · VOLVER A LA ARENA</button>`;
  ui.panelContent.querySelectorAll('[data-car]').forEach(button => button.addEventListener('click', () => {
    state.carIndex = Number(button.dataset.car); savePreferences();
    rebuildPlayerCar(); renderGaragePanel();
  }));
  ui.panelContent.querySelectorAll('[data-color-kind]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.colorKind === 'primary') state.carColor = button.dataset.color;
    else state.secondaryColor = button.dataset.color;
    savePreferences();
    if (!repaintVehicle(playerCar, state.carColor, state.secondaryColor)) rebuildPlayerCar();
    renderGaragePanel();
  }));
  ui.panelContent.querySelectorAll('[data-color-picker]').forEach(input => input.addEventListener('input', () => {
    const kind = input.dataset.colorPicker;
    if (kind === 'primary') state.carColor = input.value;
    else state.secondaryColor = input.value;
    ui.panelContent.querySelectorAll(`[data-color-kind="${kind}"]`).forEach(swatch => {
      const selected = swatch.dataset.color.toLowerCase() === input.value.toLowerCase();
      swatch.classList.toggle('selected', selected); swatch.setAttribute('aria-pressed', String(selected));
    });
    savePreferences();
    if (!repaintVehicle(playerCar, state.carColor, state.secondaryColor)) rebuildPlayerCar();
  }));
  ui.panelContent.querySelectorAll('[data-wheel]').forEach(button => button.addEventListener('click', () => {
    state.wheelStyle = button.dataset.wheel; savePreferences(); rebuildPlayerCar(); renderGaragePanel();
  }));
  ui.panelContent.querySelectorAll('[data-accessory]').forEach(button => button.addEventListener('click', () => {
    state.accessory = button.dataset.accessory; savePreferences(); rebuildPlayerCar(); renderGaragePanel();
  }));
  ui.panelContent.querySelectorAll('[data-boost]').forEach(button => button.addEventListener('click', () => {
    state.boostStyle = button.dataset.boost; savePreferences(); rebuildPlayerCar(); renderGaragePanel();
  }));
  ui.panelContent.querySelector('#garageDone').addEventListener('click', closePanel);
}

function renderSettingsPanel(tab = 'camera') {
  ui.panelEyebrow.textContent = 'ARENA · PREFERENCIAS'; ui.panelTitle.textContent = 'AJUSTES';
  const tabs = `<div class="settings-tabs">${[['camera','Cámara'],['controls','Controles'],['graphics','Gráficos'],['audio','Audio']].map(([id, name]) => `<button class="settings-tab ${tab === id ? 'active' : ''}" data-tab="${id}" type="button">${name}</button>`).join('')}</div>`;
  let body = '';
  if (tab === 'camera') body = `<div class="setting-section"><h2>CÁMARA DE SEGUIMIENTO</h2>
    <div class="setting-row"><span>Enfocar la pelota (Ball Cam)</span><input id="settingBallCam" type="checkbox" ${state.ballCam ? 'checked' : ''}></div>
    <p class="control-help">La cámara sigue al coche y orienta la vista hacia el balón. En Ball Cam el coche se mantiene en primer plano, en la parte baja de la imagen.</p>
    <div class="setting-slider"><label for="settingCameraDistance">Distancia <output id="settingCameraDistanceValue">${state.cameraDistance.toFixed(1)}</output></label><input id="settingCameraDistance" data-camera-setting="cameraDistance" type="range" min="7" max="19" step="0.5" value="${state.cameraDistance}" aria-label="Distancia de cámara"></div>
    <div class="setting-slider"><label for="settingCameraHeight">Altura <output id="settingCameraHeightValue">${state.cameraHeight.toFixed(1)}</output></label><input id="settingCameraHeight" data-camera-setting="cameraHeight" type="range" min="2" max="7" step="0.1" value="${state.cameraHeight}" aria-label="Altura de cámara"></div>
    <div class="setting-slider"><label for="settingCameraLookAhead">Anticipación <output id="settingCameraLookAheadValue">${state.cameraLookAhead.toFixed(1)}</output></label><input id="settingCameraLookAhead" data-camera-setting="cameraLookAhead" type="range" min="2" max="9" step="0.1" value="${state.cameraLookAhead}" aria-label="Anticipación de cámara"></div>
    <div class="setting-slider"><label for="settingBallCamStrength">Fuerza de Ball Cam <output id="settingBallCamStrengthValue">${Math.round(state.ballCamStrength * 100)}%</output></label><input id="settingBallCamStrength" data-camera-setting="ballCamStrength" type="range" min="0.15" max="1" step="0.01" value="${state.ballCamStrength}" aria-label="Fuerza de Ball Cam"></div>
    <div class="setting-row"><span>Sombras en tiempo real</span><input id="settingShadows" type="checkbox" checked></div></div>`;
  if (tab === 'controls') body = `<div class="setting-section"><h2>TECLADO · PERSONALIZA LOS BOTONES</h2><div class="control-list">${keyActions.map(([action, label]) => `<div class="control-row"><span>${label}</span><button class="bind-button ${state.remappingKey === action ? 'listening' : ''}" data-rebind="${action}" type="button">${state.remappingKey === action ? 'Pulsa una tecla…' : formatKey(state.keyBindings[action])}</button></div>`).join('')}</div><p class="control-help">Selecciona una tecla y pulsa la nueva asignación. Pulsa Esc para cancelar.</p></div>
    <div class="setting-section"><h2>MANDO</h2><div class="controller-status ${state.gamepadConnected ? 'connected' : ''}"><span class="controller-dot"></span><span>${state.gamepadConnected ? `Conectado: ${state.gamepad?.id?.slice(0, 48) || 'mando detectado'}` : 'Sin mando conectado'}</span></div><p class="control-help">Stick izquierdo: dirección · RT/LT: acelerar y reversa · A salta / hace flip · B boost · Start pausa. La cámara permanece fija detrás del coche.</p><div class="control-list">${gamepadActions.map(([action, label]) => `<div class="control-row"><span>${label}</span><button class="bind-button ${state.captureGamepadAction === action ? 'listening' : ''}" data-gamepadbind="${action}" type="button">${state.captureGamepadAction === action ? 'Pulsa un botón…' : gamepadButtonName(state.gamepadBindings[action])}</button></div>`).join('')}</div><p class="control-help">Pulsa Asignar y luego el botón deseado en el mando. En teclado: Ctrl derrapa; Q/E hace giro aéreo.</p></div>
    <button class="secondary-action" id="resetControls" type="button">RESTABLECER CONTROLES</button>`;
  if (tab === 'graphics') body = `<div class="setting-section"><h2>Calidad 3D</h2><div class="setting-row"><span>Resolución</span><select id="qualitySelect" aria-label="Resolución"><option value="1">Alta</option><option value=".8">Media</option><option value=".6">Baja</option></select></div><div class="setting-row"><span>Bloom y resplandor</span><input id="settingBloom" type="checkbox" ${bloomPass.enabled ? 'checked' : ''}></div><div class="setting-row"><span>Sombras</span><input id="settingShadows2" type="checkbox" checked></div></div>`;
  if (tab === 'audio') body = `<div class="setting-section"><h2>Sonido</h2><div class="setting-row"><span>Volumen general</span><input type="range" min="0" max="100" value="60" aria-label="Volumen general"></div><p class="mode-note">El audio de la arena está desactivado en esta primera versión.</p></div>`;
  ui.panelContent.innerHTML = tabs + body + '<button class="primary-action" id="settingsDone">LISTO</button>';
  ui.panelContent.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => renderSettingsPanel(button.dataset.tab)));
  ui.panelContent.querySelector('#settingsDone').addEventListener('click', closePanel);
  const ballCam = $('#settingBallCam'); if (ballCam) ballCam.addEventListener('change', e => setBallCam(e.target.checked));
  ui.panelContent.querySelectorAll('[data-camera-setting]').forEach(input => input.addEventListener('input', () => {
    const key = input.dataset.cameraSetting;
    state[key] = Number(input.value);
    const output = ui.panelContent.querySelector(`#${input.id}Value`);
    if (output) output.textContent = key === 'ballCamStrength' ? `${Math.round(state[key] * 100)}%` : state[key].toFixed(1);
    savePreferences();
  }));
  const setShadow = checked => { scene.traverse(obj => { if (obj.isDirectionalLight) obj.castShadow = checked; }); };
  const shadow = $('#settingShadows') || $('#settingShadows2'); if (shadow) shadow.addEventListener('change', e => setShadow(e.target.checked));
  const bloom = $('#settingBloom'); if (bloom) bloom.addEventListener('change', e => { bloomPass.enabled = e.target.checked; });
  const quality = $('#qualitySelect'); if (quality) quality.addEventListener('change', e => {
    renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1) * Number(e.target.value), 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(window.innerWidth, window.innerHeight);
  });
  ui.panelContent.querySelectorAll('[data-rebind]').forEach(button => button.addEventListener('click', () => {
    state.remappingKey = button.dataset.rebind; renderSettingsPanel('controls');
    showToast('Pulsa la tecla que quieres asignar.');
  }));
  ui.panelContent.querySelectorAll('[data-gamepadbind]').forEach(button => button.addEventListener('click', () => {
    state.captureGamepadAction = button.dataset.gamepadbind; renderSettingsPanel('controls');
    showToast(state.gamepadConnected ? 'Pulsa el botón que quieres asignar.' : 'Conecta un mando y luego pulsa el botón deseado.');
  }));
  const resetControls = $('#resetControls'); if (resetControls) resetControls.addEventListener('click', () => {
    state.keyBindings = { ...defaultKeyBindings }; state.gamepadBindings = { ...defaultGamepadBindings };
    state.remappingKey = ''; state.captureGamepadAction = ''; savePreferences(); renderSettingsPanel('controls'); showToast('Controles restablecidos.');
  });
}

function applyMap() {
  const map = maps[state.mapIndex]; scene.background.set(map.sky); scene.fog.color.set(map.sky);
  if (skyDome) skyDome.material.color.set(map.sky);
  fieldMaterials.forEach((material, i) => material.color.set(i === 0 || i % 2 ? map.grass : map.stripe));
  accentMaterials.forEach(material => { material.color.set(map.accent); material.emissive.set(map.accent).multiplyScalar(.3); });
}
function renderMapsPanel() {
  ui.panelEyebrow.textContent = 'ARENA · ESCENARIOS 3D'; ui.panelTitle.textContent = 'CUSTOM MAPS';
  ui.panelContent.innerHTML = `<p class="menu-intro">Cambia el estadio, su iluminación y el color de la cancha.</p><div class="menu-list">${maps.map((map, i) => `<button class="menu-option" data-map="${i}" type="button"><span class="option-icon ${i === 1 ? 'orange' : ''}">${i === 0 ? '◉' : i === 1 ? '☀' : '❄'}</span><span class="option-copy"><strong>${map.name}</strong><small>${['Domo azul con césped clásico.','Gradas cálidas al atardecer.','Arena fría con campo turquesa.'][i]}</small></span><span class="option-arrow">${state.mapIndex === i ? '✓' : '›'}</span></button>`).join('')}</div><button class="primary-action" id="mapDone">JUGAR EN ESTA ARENA</button>`;
  ui.panelContent.querySelectorAll('[data-map]').forEach(button => button.addEventListener('click', () => { state.mapIndex = Number(button.dataset.map); ui.mapLabel.textContent = maps[state.mapIndex].name.toUpperCase(); applyMap(); renderMapsPanel(); }));
  ui.panelContent.querySelector('#mapDone').addEventListener('click', () => { if (!state.match) startMatch(); else closePanel(); });
}

function renderClipsPanel() {
  ui.panelEyebrow.textContent = 'ARENA · RECUERDOS'; ui.panelTitle.textContent = 'CLIPS';
  ui.panelContent.innerHTML = state.clipUrls.length ? `<div class="menu-list">${state.clipUrls.map((item, i) => `<div class="menu-option"><span class="option-icon">▶</span><span class="option-copy"><strong>Clip de la arena ${i + 1}</strong><small>${item.name}</small></span><a class="option-arrow" href="${item.url}" download="${item.name}">↓</a></div>`).join('')}</div>` : '<div class="clip-empty">Todavía no has guardado clips.<br>Pulsa el botón rojo para grabar hasta 30 segundos de la arena.</div>';
  ui.panelFoot.innerHTML = 'La grabación se procesa localmente en el navegador.';
}

function toggleRecording() {
  if (!state.recording) {
    if (!renderer.domElement.captureStream || !window.MediaRecorder) { showToast('Este navegador no permite grabar la arena.'); return; }
    try {
      state.chunks = []; const stream = renderer.domElement.captureStream(24);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      state.recorder = new MediaRecorder(stream, { mimeType: mime }); state.recorder.ondataavailable = e => { if (e.data.size) state.chunks.push(e.data); };
      state.recorder.onstop = () => {
        const blob = new Blob(state.chunks, { type: mime }), url = URL.createObjectURL(blob);
        const name = `car-soccer-clip-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.webm`;
        state.clipUrls.unshift({ url, name }); state.clipUrls = state.clipUrls.slice(0, 6); state.recording = false;
        ui.record.classList.remove('is-recording'); showToast('Clip guardado. Ya puedes verlo en Clips.'); openPanel('clips');
      };
      state.recorder.start(1000); state.recording = true; ui.record.classList.add('is-recording'); showToast('Grabando la arena. Pulsa otra vez para guardar.');
      state.recordStopTimer = setTimeout(() => { if (state.recorder?.state === 'recording') state.recorder.stop(); }, 30000);
    } catch { showToast('No se pudo iniciar la grabación.'); }
  } else { clearTimeout(state.recordStopTimer); state.recorder?.stop(); }
}

function bindUI() {
  ui.garage.addEventListener('click', () => state.menu === 'garage' ? closePanel() : openPanel('garage'));
  ui.play.addEventListener('click', () => { if (state.match) { finishMatch(); closePanel(); showToast('Volviste al menú principal.'); } else if (state.menu === 'play') closePanel(); else openPanel('play'); });
  ui.pause.addEventListener('click', togglePause);
  ui.settings.addEventListener('click', () => openPanel('settings')); ui.clips.addEventListener('click', () => openPanel('clips'));
  ui.ballCam.addEventListener('click', () => setBallCam(!state.ballCam)); ui.record.addEventListener('click', toggleRecording);
  ui.fullscreen.addEventListener('click', async () => { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); } catch { showToast('Pantalla completa no disponible.'); } });
  ui.sponsor.addEventListener('click', () => showToast('Prototipo 3D en desarrollo.'));
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  addEventListener('keydown', event => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    if (state.remappingKey) {
      if (event.code === 'Escape') { state.remappingKey = ''; showToast('Asignación cancelada.'); }
      else { state.keyBindings[state.remappingKey] = event.code; state.remappingKey = ''; savePreferences(); showToast(`Tecla asignada: ${formatKey(event.code)}.`); }
      if (state.menu === 'settings') renderSettingsPanel('controls');
      refreshShortcutLabels(); return;
    }
    if (event.code === 'Escape') {
      if (state.match && state.paused) { if (state.menu === 'pause') togglePause(); else openPanel('pause'); return; }
      if (!ui.panel.hidden) closePanel(); else if (state.match) togglePause();
      return;
    }
    if (event.code === 'KeyP' && state.match && !event.repeat) { togglePause(); return; }
    if (event.repeat && [state.keyBindings.garage, state.keyBindings.menu, state.keyBindings.ballCam].includes(event.code)) return;
    if (event.code === state.keyBindings.garage && !state.match) { state.menu === 'garage' ? closePanel() : openPanel('garage'); return; }
    if (event.code === state.keyBindings.menu && !state.match) { state.menu === 'play' ? closePanel() : openPanel('play'); return; }
    if (event.code === state.keyBindings.ballCam) { setBallCam(!state.ballCam); return; }
    state.keys.add(event.code);
  });
  addEventListener('keyup', event => state.keys.delete(event.code)); addEventListener('blur', () => state.keys.clear());
  window.addEventListener('gamepadconnected', event => { state.gamepad = event.gamepad; state.gamepadConnected = true; showToast(`Mando conectado: ${event.gamepad.id.slice(0, 38)}`); if (state.menu === 'settings') renderSettingsPanel('controls'); });
  window.addEventListener('gamepaddisconnected', () => { state.gamepad = null; state.gamepadConnected = false; showToast('Mando desconectado.'); if (state.menu === 'settings') renderSettingsPanel('controls'); });
  refreshShortcutLabels();
}
bindUI();

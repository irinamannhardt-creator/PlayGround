import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const clamp = THREE.MathUtils.clamp;
const damp = THREE.MathUtils.damp;
const smooth = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

const canvas = document.getElementById('scene');
const intro = document.getElementById('intro');
const startButton = document.getElementById('start');
const soundButton = document.getElementById('sound');
const filmButton = document.getElementById('film');
const caption = document.getElementById('caption');
const capNum = document.getElementById('capNum');
const capLine = document.getElementById('capLine');
const navButtons = [...document.querySelectorAll('.reflect-nav button')];
const hint = document.getElementById('hint');
const toast = document.getElementById('toast');
const rec = document.getElementById('rec');
const recTime = document.getElementById('recTime');

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const LINES = [
  'She turns a half-beat before you do.',
  'The angle is almost forgiving.',
  'Her hands are folded the other way.',
  'This is the one looking at you.',
  'She is listening through the glass.',
  'A breath behind, and gaining.',
  'She has already turned back.'
];

const compact = window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 900;
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = compact ? 1.08 : 1.02;
renderer.shadowMap.enabled = !compact;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050507);
scene.fog = new THREE.FogExp2(0x060608, 0.026);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.08, 80);
camera.position.set(0.32, 1.82, 7.1);

const pmrem = new THREE.PMREMGenerator(renderer);
const environment = pmrem.fromScene(new RoomEnvironment(), 0.035);
scene.environment = environment.texture;
scene.environmentIntensity = 0.42;

let composer = null;
let bloom = null;
if (!compact) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.38,
    0.62,
    0.82
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

function createCanvasTexture(width, height, paint) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  paint(c.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

const marbleTexture = createCanvasTexture(1024, 1024, (ctx, w, h) => {
  ctx.fillStyle = '#0d0d10';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 90; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 40 + Math.random() * 210;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const shade = 48 + Math.random() * 28;
    g.addColorStop(0, `rgba(${shade},${shade},${shade + 5},${0.018 + Math.random() * 0.03})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  ctx.globalCompositeOperation = 'lighter';
  for (let v = 0; v < 18; v++) {
    const startX = Math.random() * w;
    const startY = -40;
    const endX = startX + (Math.random() - 0.5) * 680;
    const endY = h + 40;
    const midX = startX + (Math.random() - 0.5) * 300;
    const midY = h * (0.25 + Math.random() * 0.5);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(midX, midY, midX + (Math.random() - 0.5) * 240, midY + 140, endX, endY);
    ctx.strokeStyle = `rgba(196,184,162,${0.014 + Math.random() * 0.036})`;
    ctx.lineWidth = 0.5 + Math.random() * 2.4;
    ctx.shadowColor = 'rgba(196,184,162,0.08)';
    ctx.shadowBlur = 8 + Math.random() * 18;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * 0.055;
    ctx.fillStyle = `rgba(225,215,197,${a})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * 2 + 0.4, Math.random() * 2 + 0.4);
  }
  ctx.globalCompositeOperation = 'source-over';
});
marbleTexture.wrapS = THREE.ClampToEdgeWrapping;
marbleTexture.wrapT = THREE.ClampToEdgeWrapping;

const glowTexture = createCanvasTexture(256, 512, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w * 0.5, h * 0.43, 4, w * 0.5, h * 0.43, h * 0.48);
  g.addColorStop(0, 'rgba(255,224,180,0.9)');
  g.addColorStop(0.25, 'rgba(233,190,139,0.34)');
  g.addColorStop(0.7, 'rgba(156,121,84,0.06)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
});

const dustTexture = createCanvasTexture(64, 64, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,240,214,0.9)');
  g.addColorStop(0.28, 'rgba(255,230,196,0.38)');
  g.addColorStop(1, 'rgba(255,225,190,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
});

const goldMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x97743f,
  metalness: 1,
  roughness: 0.3,
  envMapIntensity: 1.05,
  emissive: 0x120a03,
  emissiveIntensity: 0.14
});

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(24, 96),
  new THREE.MeshPhysicalMaterial({
    map: marbleTexture,
    color: 0x6c6c72,
    metalness: 0.58,
    roughness: 0.31,
    clearcoat: 0.72,
    clearcoatRoughness: 0.16,
    envMapIntensity: 0.5
  })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const platform = new THREE.Mesh(
  new THREE.CylinderGeometry(2.38, 2.42, 0.05, 96),
  new THREE.MeshPhysicalMaterial({
    map: marbleTexture,
    color: 0x7b7b82,
    metalness: 0.48,
    roughness: 0.26,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
    envMapIntensity: 0.55
  })
);
platform.position.y = 0.025;
platform.receiveShadow = true;
scene.add(platform);

const rim = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.008, 8, 160), goldMaterial);
rim.rotation.x = -Math.PI / 2;
rim.position.y = 0.056;
scene.add(rim);

const innerRing = new THREE.Mesh(
  new THREE.TorusGeometry(1.42, 0.0045, 6, 140),
  new THREE.MeshBasicMaterial({ color: 0x9f7b46, transparent: true, opacity: 0.18 })
);
innerRing.rotation.x = -Math.PI / 2;
innerRing.position.y = 0.057;
scene.add(innerRing);

const wall = new THREE.Mesh(
  new THREE.PlaneGeometry(46, 18),
  new THREE.MeshStandardMaterial({ color: 0x08080b, roughness: 0.96, metalness: 0 })
);
wall.position.set(0, 7, -9.5);
scene.add(wall);

function glowPlane(color, opacity, width, height, x, y, z) {
  const material = new THREE.MeshBasicMaterial({
    color,
    map: glowTexture,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

glowPlane(0x9b7447, 0.32, 14, 8, 0, 3.1, -8.7);
glowPlane(0x3e4b68, 0.22, 9, 5, 4.8, 2.4, -7.8);

const hemi = new THREE.HemisphereLight(0x2c3140, 0x080607, 0.34);
scene.add(hemi);

const key = new THREE.SpotLight(0xffd8ae, 128, 20, 0.5, 0.94, 1.3);
key.position.set(-3.3, 6.4, 4.4);
key.target.position.set(-0.1, 1.15, 0.1);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.near = 1;
key.shadow.camera.far = 16;
key.shadow.bias = -0.0008;
key.shadow.normalBias = 0.022;
key.shadow.radius = 4;
scene.add(key, key.target);

const rimLight = new THREE.SpotLight(0xa8b9dd, 90, 18, 0.62, 1, 1.5);
rimLight.position.set(4.1, 3.5, -3.6);
rimLight.target.position.set(0, 1.35, 0.3);
scene.add(rimLight, rimLight.target);

const galleryLight = new THREE.SpotLight(0xffdcb4, 88, 20, 0.63, 1, 1.45);
galleryLight.position.set(1.0, 5.4, 5.6);
galleryLight.target.position.set(0, 1.4, -2.3);
scene.add(galleryLight, galleryLight.target);

const backRim = new THREE.SpotLight(0x9fb2d8, 52, 15, 0.58, 1, 1.55);
backRim.position.set(-2.6, 3.5, -1.6);
backRim.target.position.set(0, 1.35, 0.4);
scene.add(backRim, backRim.target);

const upperFill = new THREE.SpotLight(0xffddb5, 34, 12, 0.72, 1, 1.7);
upperFill.position.set(-1.6, 4.3, -0.8);
upperFill.target.position.set(0, 1.5, -2.0);
scene.add(upperFill, upperFill.target);

const warmBounce = new THREE.PointLight(0xd99b5f, 4.5, 8, 2);
warmBounce.position.set(0, 2.3, 2.6);
scene.add(warmBounce);

const dustCount = window.innerWidth < 760 ? 190 : 360;
const dustPositions = new Float32Array(dustCount * 3);
for (let i = 0; i < dustCount; i++) {
  dustPositions[i * 3] = (Math.random() - 0.5) * 11;
  dustPositions[i * 3 + 1] = Math.random() * 4.4;
  dustPositions[i * 3 + 2] = -4.6 + Math.random() * 9;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
const dust = new THREE.Points(
  dustGeo,
  new THREE.PointsMaterial({
    size: 0.018,
    map: dustTexture,
    color: 0xffe4bd,
    transparent: true,
    opacity: 0.46,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  })
);
scene.add(dust);

const GEO = {};

function skirtGeometry() {
  if (GEO.skirt) return GEO.skirt;
  const profile = [
    [0.01, 0.0],
    [0.225, 0.0],
    [0.335, 0.045],
    [0.368, 0.15],
    [0.358, 0.32],
    [0.326, 0.52],
    [0.29, 0.72],
    [0.252, 0.9],
    [0.218, 1.03],
    [0.195, 1.12],
    [0.188, 1.18]
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(profile, 72);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const radius = Math.hypot(x, z);
    if (radius < 0.001) continue;
    const theta = Math.atan2(z, x);
    const hem = Math.pow(clamp(1 - y / 1.18, 0, 1), 1.35);
    const wave = Math.sin(theta * 9 + Math.sin(y * 4.2) * 0.7 + 0.6) * 0.036
      + Math.sin(theta * 17 + 1.4) * 0.011;
    const flare = 1 + (wave * hem) / radius;
    pos.setX(i, x * flare);
    pos.setZ(i, z * flare);
  }
  geo.computeVertexNormals();
  GEO.skirt = geo;
  return geo;
}

function bodiceGeometry() {
  if (GEO.bodice) return GEO.bodice;
  const profile = [
    [0.19, 1.07],
    [0.172, 1.16],
    [0.181, 1.25],
    [0.199, 1.33],
    [0.193, 1.39],
    [0.155, 1.44],
    [0.098, 1.47],
    [0.058, 1.48]
  ].map(([x, y]) => new THREE.Vector2(x, y - 1.04));
  GEO.bodice = new THREE.LatheGeometry(profile, 56);
  return GEO.bodice;
}


function hairGeometrySet() {
  if (GEO.hair) return GEO.hair;
  const parts = [];
  const crown = new THREE.SphereGeometry(0.114, 32, 22, 0, Math.PI * 2, 0, Math.PI * 0.335);
  crown.scale(1.0, 1.04, 1.02);
  crown.translate(0, 0.005, -0.004);
  parts.push(crown);

  const cap = new THREE.SphereGeometry(0.113, 30, 20, Math.PI, Math.PI, 0, Math.PI * 0.74);
  cap.scale(1.05, 1.1, 1.06);
  cap.translate(0, 0, -0.007);
  parts.push(cap);

  for (const side of [-1, 1]) {
    const temple = new THREE.SphereGeometry(0.054, 20, 16);
    temple.scale(0.82, 1.18, 0.92);
    temple.translate(side * 0.074, 0.008, -0.001);
    parts.push(temple);
  }

  const crownSweep = new THREE.SphereGeometry(0.09, 22, 16);
  crownSweep.scale(1.06, 0.72, 0.94);
  crownSweep.translate(0, 0.057, -0.032);
  parts.push(crownSweep);

  const mass = new THREE.SphereGeometry(0.096, 24, 18);
  mass.scale(1.0, 1.2, 1.16);
  mass.translate(0, -0.028, -0.046);
  parts.push(mass);

  const bun = new THREE.SphereGeometry(0.072, 20, 14);
  bun.scale(0.86, 0.76, 0.9);
  bun.translate(0.015, 0.012, -0.108);
  parts.push(bun);

  const strands = 17;
  for (let i = 0; i < strands; i++) {
    const spread = strands === 1 ? 0 : i / (strands - 1);
    const a = -1.15 + spread * 2.3;
    const r = 0.0042 + Math.random() * 0.0042;
    const sway = (Math.random() - 0.5) * 0.03;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.sin(a) * 0.052, 0.11 - Math.abs(a) * 0.012, -0.02 - Math.cos(a) * 0.032),
      new THREE.Vector3(Math.sin(a) * 0.093, 0.012, -0.058 - Math.cos(a) * 0.036),
      new THREE.Vector3(Math.sin(a) * 0.105 + sway, -0.15 - Math.random() * 0.06, -0.074 - Math.cos(a) * 0.022),
      new THREE.Vector3(Math.sin(a) * 0.086 + sway * 1.5, -0.31 - Math.random() * 0.08, -0.058 - Math.cos(a) * 0.012)
    ], false, 'catmullrom', 0.5);
    parts.push(new THREE.TubeGeometry(curve, 12, r, 5, false));
  }

  for (const side of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.067, 0.103, 0.055),
      new THREE.Vector3(side * 0.094, 0.03, 0.066),
      new THREE.Vector3(side * 0.088, -0.06, 0.05),
      new THREE.Vector3(side * 0.074, -0.13, 0.018)
    ], false, 'catmullrom', 0.4);
    parts.push(new THREE.TubeGeometry(curve, 10, 0.0055, 5, false));

    const longCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.076, 0.104, 0.058),
      new THREE.Vector3(side * 0.104, 0.012, 0.073),
      new THREE.Vector3(side * 0.114, -0.11, 0.06),
      new THREE.Vector3(side * 0.1, -0.235, 0.036),
      new THREE.Vector3(side * 0.086, -0.325, 0.016)
    ], false, 'catmullrom', 0.4);
    parts.push(new THREE.TubeGeometry(longCurve, 14, 0.0068, 5, false));

    const wispCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.082, 0.09, 0.049),
      new THREE.Vector3(side * 0.11, -0.005, 0.057),
      new THREE.Vector3(side * 0.12, -0.12, 0.046),
      new THREE.Vector3(side * 0.104, -0.22, 0.024)
    ], false, 'catmullrom', 0.35);
    parts.push(new THREE.TubeGeometry(wispCurve, 10, 0.0046, 5, false));
  }

  GEO.hair = mergeGeometries(parts, false);
  return GEO.hair;
}

function createMaterials(tint = 1) {
  const skinColor = new THREE.Color(0xd2b2a0).multiplyScalar(tint);
  const dressColor = new THREE.Color(0x0a0a0d).multiplyScalar(tint);
  return {
    skin: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xd0ad9a).multiplyScalar(tint),
      roughness: 0.58,
      metalness: 0,
      clearcoat: 0.04,
      clearcoatRoughness: 0.7,
      sheen: 0.16,
      sheenColor: new THREE.Color(0xffd0ba),
      envMapIntensity: 0.42,
      emissive: new THREE.Color(0x120906),
      emissiveIntensity: 0.2
    }),
    dress: new THREE.MeshPhysicalMaterial({
      color: dressColor,
      roughness: 0.52,
      metalness: 0.03,
      clearcoat: 0.22,
      clearcoatRoughness: 0.5,
      sheen: 0.5,
      sheenColor: new THREE.Color(0x4c3b30),
      sheenRoughness: 0.65,
      envMapIntensity: 0.38,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0x070606),
      emissiveIntensity: 0.22
    }),
    hair: new THREE.MeshPhysicalMaterial({
      color: 0x0a0706,
      roughness: 0.48,
      metalness: 0.02,
      clearcoat: 0.2,
      clearcoatRoughness: 0.5,
      sheen: 0.34,
      sheenColor: new THREE.Color(0x312019),
      sheenRoughness: 0.7,
      envMapIntensity: 0.32,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0x080403),
      emissiveIntensity: 0.16
    }),
    lips: new THREE.MeshStandardMaterial({
      color: 0x68403e,
      roughness: 0.46,
      metalness: 0
    }),
    sclera: new THREE.MeshPhysicalMaterial({
      color: 0xc7afa1,
      roughness: 0.38,
      metalness: 0,
      clearcoat: 0.25,
      envMapIntensity: 0.35
    }),
    eye: new THREE.MeshStandardMaterial({
      color: 0x2a1b13,
      roughness: 0.15,
      metalness: 0.05,
      emissive: new THREE.Color(0x1c100a),
      emissiveIntensity: 0.35
    }),
    catchlight: new THREE.MeshBasicMaterial({ color: 0xfff3df }),
    brow: new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.7 }),
    gold: goldMaterial.clone(),
    pearl: new THREE.MeshPhysicalMaterial({
      color: 0xd8cab3,
      roughness: 0.22,
      metalness: 0.15,
      clearcoat: 0.9,
      envMapIntensity: 1.4
    })
  };
}

function applyArmPose(woman, pose) {
  const { armL, armR } = woman;
  armL.rotation.set(0.04, 0, -0.075);
  armR.rotation.set(0.04, 0, 0.075);
  woman.elbowL.rotation.set(0.08, 0, 0);
  woman.elbowR.rotation.set(0.08, 0, 0);

  if (pose === 'clasp') {
    armL.rotation.set(-0.3, 0.2, 0.36);
    armR.rotation.set(-0.3, -0.2, -0.36);
    woman.elbowL.rotation.set(-0.82, 0, 0.34);
    woman.elbowR.rotation.set(-0.82, 0, -0.34);
  } else if (pose === 'behind') {
    armL.rotation.set(0.32, 0, 0.05);
    armR.rotation.set(0.32, 0, -0.05);
    woman.elbowL.rotation.set(0.26, 0, 0);
    woman.elbowR.rotation.set(0.26, 0, 0);
  } else if (pose === 'neck') {
    armR.rotation.set(-0.4, 0.1, -2.14);
    woman.elbowR.rotation.set(-1.08, 0, -0.28);
    armL.rotation.set(0.12, 0, -0.1);
    woman.elbowL.rotation.set(0.24, 0, 0.05);
  } else if (pose === 'reach') {
    armL.rotation.set(-1.34, -0.1, -0.14);
    woman.elbowL.rotation.set(-0.32, 0, 0.08);
    armR.rotation.set(0.08, 0, 0.06);
    woman.elbowR.rotation.set(0.18, 0, 0);
  }
}

function createWoman({ tint = 1, pose = 'down', detail = true } = {}) {
  const materials = createMaterials(tint);
  const group = new THREE.Group();

  const skirt = new THREE.Mesh(skirtGeometry(), materials.dress);
  skirt.castShadow = true;
  skirt.receiveShadow = true;
  group.add(skirt);

  const upper = new THREE.Group();
  upper.position.y = 1.04;
  group.add(upper);

  const bodice = new THREE.Mesh(bodiceGeometry(), materials.dress);
  bodice.castShadow = true;
  upper.add(bodice);

  const yokeProfile = [
    [0.048, 1.548],
    [0.058, 1.522],
    [0.082, 1.495],
    [0.122, 1.468],
    [0.163, 1.444],
    [0.184, 1.418],
    [0.174, 1.396],
    [0.138, 1.376],
    [0.106, 1.366]
  ].map(([x, y]) => new THREE.Vector2(x, y - 1.04));
  const yoke = new THREE.Mesh(new THREE.LatheGeometry(yokeProfile, 48), materials.skin);
  yoke.scale.z = 0.68;
  yoke.castShadow = true;
  upper.add(yoke);

  for (const side of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.073, 0.405, 0.078),
      new THREE.Vector3(side * 0.112, 0.452, 0.012),
      new THREE.Vector3(side * 0.079, 0.407, -0.072)
    ], false, 'catmullrom', 0.4), 10, 0.0065, 5, false), materials.dress);
    upper.add(strap);
  }

  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.0038, 6, 72), materials.gold);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.062;
  upper.add(belt);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.051, 0.059, 0.125, 20), materials.skin);
  neck.position.set(0, 0.474, 0.002);
  upper.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 0.623, 0.006);
  upper.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.104, 32, 24), materials.skin);
  skull.scale.set(0.91, 1.1, 0.97);
  skull.castShadow = true;
  head.add(skull);

  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.076, 24, 18), materials.skin);
  jaw.scale.set(0.92, 0.78, 0.88);
  jaw.position.set(0, -0.048, 0.017);
  head.add(jaw);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.048, 8), materials.skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.012, 0.104);
  head.add(nose);

  const lips = new THREE.Mesh(new THREE.SphereGeometry(0.0255, 18, 10), materials.lips);
  lips.scale.set(1.2, 0.29, 0.32);
  lips.position.set(0, -0.054, 0.0965);
  head.add(lips);

  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.036, 0.018, 0.0945);
    head.add(eye);
    eyes.push(eye);

    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.0155, 18, 12), materials.sclera);
    sclera.scale.set(1.28, 0.56, 0.42);
    sclera.rotation.z = side * 0.055;
    eye.add(sclera);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0082, 16, 12), materials.eye);
    iris.scale.set(0.92, 0.92, 0.5);
    iris.position.set(0, -0.0005, 0.008);
    eye.add(iris);

    const catchlight = new THREE.Mesh(new THREE.SphereGeometry(0.0021, 8, 6), materials.catchlight);
    catchlight.position.set(0.0032, 0.0025, 0.0117);
    eye.add(catchlight);

    const lash = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.00115, 4, 10, Math.PI), materials.brow);
    lash.position.set(0, -0.002, 0.006);
    lash.rotation.z = side * 0.045;
    eye.add(lash);

    const brow = new THREE.Mesh(new THREE.CylinderGeometry(0.0024, 0.0024, 0.04, 5), materials.brow);
    brow.rotation.z = Math.PI / 2;
    brow.rotation.x = -0.06;
    brow.position.set(side * 0.038, 0.049, 0.093);
    head.add(brow);

    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.023, 14, 10), materials.skin);
    ear.scale.set(0.54, 0.9, 0.55);
    ear.position.set(side * 0.094, 0.002, 0.004);
    head.add(ear);

    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.05, 5), materials.gold);
    chain.position.set(side * 0.096, -0.061, 0.004);
    head.add(chain);

    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 14, 10), materials.pearl);
    pearl.position.set(side * 0.096, -0.092, 0.004);
    head.add(pearl);
  }

  const hair = new THREE.Mesh(hairGeometrySet(), materials.hair);
  hair.castShadow = true;
  head.add(hair);

  const necklace = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.0024, 6, 36), materials.gold);
  necklace.rotation.x = Math.PI / 2;
  necklace.position.set(0, 0.43, 0.02);
  upper.add(necklace);

  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.183, 0.382, 0);
    upper.add(shoulder);

    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.21, 6, 12), materials.skin);
    upperArm.position.y = -0.145;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -0.295;
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.027, 0.19, 6, 12), materials.skin);
    forearm.position.y = -0.12;
    forearm.castShadow = true;
    elbow.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.039, 16, 12), materials.skin);
    hand.scale.set(0.68, 1.18, 0.46);
    hand.position.y = -0.246;
    elbow.add(hand);

    return { shoulder, elbow };
  }

  const left = makeArm(-1);
  const right = makeArm(1);
  const woman = {
    group,
    upper,
    head,
    armL: left.shoulder,
    elbowL: left.elbow,
    armR: right.shoulder,
    elbowR: right.elbow,
    materials,
    eyes,
    baseHeadYaw: 0,
    baseHeadTilt: 0,
    phase: Math.random() * Math.PI * 2,
    blinkOffset: Math.random() * 7.2
  };
  applyArmPose(woman, pose);

  if (!detail) {
    group.traverse((child) => {
      if (child.isMesh) child.castShadow = false;
    });
  }

  return woman;
}

const mainWoman = createWoman({ tint: 1, pose: 'clasp', detail: true });
mainWoman.group.position.set(-0.72, 0.05, 0.52);
mainWoman.group.rotation.y = Math.PI + 0.14;
mainWoman.baseHeadYaw = 0.97;
mainWoman.baseHeadTilt = 0.045;
mainWoman.head.rotation.set(0.015, mainWoman.baseHeadYaw, mainWoman.baseHeadTilt);
Object.values(mainWoman.materials).forEach((material) => {
  if (material && material.isMaterial) {
    material.transparent = true;
    material.depthWrite = true;
    material.opacity = 1;
  }
});
scene.add(mainWoman.group);

const contactTexture = createCanvasTexture(256, 256, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.76)');
  g.addColorStop(0.48, 'rgba(0,0,0,0.4)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
});
const contact = new THREE.Mesh(
  new THREE.PlaneGeometry(1.9, 2.6),
  new THREE.MeshBasicMaterial({ map: contactTexture, transparent: true, opacity: 0.7, depthWrite: false })
);
contact.rotation.x = -Math.PI / 2;
contact.position.set(-0.66, 0.055, 0.32);
scene.add(contact);

const reflections = [];
const glassMeshes = [];
const panelCameraPoint = new THREE.Vector3(0, 1.55, 7.4);

const panelConfigs = [
  { bodyYaw: 0.3, headYaw: -0.2, headTilt: 0.03, pose: 'clasp', delay: 4.6 },
  { bodyYaw: -0.4, headYaw: -0.5, headTilt: -0.02, pose: 'down', delay: 3.1 },
  { bodyYaw: 0.13, headYaw: 0.25, headTilt: 0.05, pose: 'clasp', delay: 1.6 },
  { bodyYaw: 0.0, headYaw: 0.0, headTilt: 0.0, pose: 'clasp', delay: 0.3 },
  { bodyYaw: 0.5, headYaw: -0.18, headTilt: 0.04, pose: 'behind', delay: 2.3 },
  { bodyYaw: -0.18, headYaw: 0.82, headTilt: -0.055, pose: 'neck', delay: 3.9 },
  { bodyYaw: -0.56, headYaw: 0.18, headTilt: 0.02, pose: 'down', delay: 5.3 }
];

const panelRadius = 3.9;
const panelCenterZ = 1.4;
const panelWidth = 0.88;
const panelHeight = 2.56;
const panelBottom = 0.035;
const frameThickness = 0.042;
const panelAngle = 1.02;

const glassGeometry = new THREE.PlaneGeometry(panelWidth, panelHeight);

function makeFrameGeometry() {
  const ow = panelWidth + frameThickness * 2;
  const oh = panelHeight + frameThickness * 2;
  const shape = new THREE.Shape();
  shape.moveTo(-ow / 2, 0);
  shape.lineTo(ow / 2, 0);
  shape.lineTo(ow / 2, oh);
  shape.lineTo(-ow / 2, oh);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-panelWidth / 2, frameThickness);
  hole.lineTo(panelWidth / 2, frameThickness);
  hole.lineTo(panelWidth / 2, frameThickness + panelHeight);
  hole.lineTo(-panelWidth / 2, frameThickness + panelHeight);
  hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.055,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
    curveSegments: 1
  });
  geo.translate(0, panelBottom - frameThickness, -0.0275);
  return geo;
}
const frameGeometry = makeFrameGeometry();

const glintVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const glintFragment = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uSeed;
  uniform float uReveal;
  void main() {
    float travel = fract(uTime * 0.024 + uSeed);
    float coord = vUv.x * 1.05 + vUv.y * 0.55;
    float band = smoothstep(0.145, 0.0, abs(coord - (travel * 2.2 - 0.55)));
    float edge = smoothstep(0.0, 0.09, vUv.x) * smoothstep(1.0, 0.91, vUv.x)
               * smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.94, vUv.y);
    float vertical = smoothstep(0.1, 0.5, vUv.y) * smoothstep(1.0, 0.72, vUv.y) * 0.22;
    float shimmer = (band * 0.72 + vertical) * edge;
    vec3 tint = mix(vec3(0.64, 0.74, 0.9), vec3(1.0, 0.82, 0.58), vUv.y);
    gl_FragColor = vec4(tint, 1.0) * shimmer * (0.055 + uReveal * 0.42);
  }
`;

for (let i = 0; i < 7; i++) {
  const a = -panelAngle + (i / 6) * panelAngle * 2;
  const x = panelRadius * Math.sin(a);
  const z = panelCenterZ - panelRadius * Math.cos(a);
  const panel = new THREE.Group();
  panel.position.set(x, 0, z);
  panel.rotation.y = Math.atan2(panelCameraPoint.x - x, panelCameraPoint.z - z);

  const frame = new THREE.Mesh(frameGeometry, goldMaterial);
  frame.castShadow = true;
  panel.add(frame);

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0e1216,
    metalness: 0.94,
    roughness: 0.06,
    transparent: true,
    opacity: 0.2,
    envMapIntensity: 1.65,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const glass = new THREE.Mesh(glassGeometry, glassMaterial);
  glass.position.set(0, panelBottom + panelHeight / 2, 0.042);
  glass.userData.index = i;
  panel.add(glass);
  glassMeshes.push(glass);

  const glintMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: i * 0.173 + 0.11 },
      uReveal: { value: 0 }
    },
    vertexShader: glintVertex,
    fragmentShader: glintFragment,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const glint = new THREE.Mesh(glassGeometry, glintMaterial);
  glint.position.set(0, panelBottom + panelHeight / 2, 0.048);
  panel.add(glint);

  const backdropMaterial = new THREE.MeshBasicMaterial({
    color: 0x08090c,
    side: THREE.DoubleSide
  });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(panelWidth * 2.2, panelHeight * 1.55), backdropMaterial);
  backdrop.position.set(0, panelBottom + panelHeight * 0.56, -1.75);
  panel.add(backdrop);

  const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd6a0,
    map: glowTexture,
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(panelWidth * 1.55, panelHeight * 1.22), haloMaterial);
  halo.position.set(0, panelBottom + panelHeight * 0.56, -1.62);
  panel.add(halo);

  const config = panelConfigs[i];
  const woman = createWoman({ tint: 0.9, pose: config.pose, detail: false });
  woman.group.position.set(0, 0, -0.82);
  woman.group.rotation.y = config.bodyYaw;
  woman.baseHeadYaw = config.headYaw;
  woman.baseHeadTilt = config.headTilt;
  woman.head.rotation.set(0, config.headYaw, config.headTilt);
  woman.phase = i * 0.9 + 0.4;
  woman.materials.skin.emissive = new THREE.Color(0x27170f);
  woman.materials.skin.emissiveIntensity = 0.34;
  woman.materials.dress.emissive = new THREE.Color(0x17110b);
  woman.materials.dress.emissiveIntensity = 0.32;
  panel.add(woman.group);

  const fadeMaterials = Object.values(woman.materials).filter((material) => material && material.isMaterial);
  fadeMaterials.forEach((material) => {
    if (!material.transparent) {
      material.transparent = true;
      material.depthWrite = true;
    }
    material.opacity = 0.1;
  });

  const clipPlanes = [
    new THREE.Plane(),
    new THREE.Plane(),
    new THREE.Plane(),
    new THREE.Plane()
  ];
  fadeMaterials.forEach((material) => {
    material.clippingPlanes = clipPlanes;
    material.clipShadows = false;
  });
  backdropMaterial.clippingPlanes = clipPlanes;
  haloMaterial.clippingPlanes = clipPlanes;

  scene.add(panel);

  reflections.push({
    index: i,
    panel,
    glass,
    glint,
    halo,
    haloMaterial,
    backdrop,
    woman,
    fadeMaterials,
    clipPlanes,
    normal: new THREE.Vector3(Math.sin(panel.rotation.y), 0, Math.cos(panel.rotation.y)),
    yaw: panel.rotation.y,
    reveal: 0,
    delay: config.delay,
    position: new THREE.Vector3(x, panelBottom + panelHeight / 2, z),
    localCorners: [
      new THREE.Vector3(-panelWidth / 2, panelBottom, 0.02),
      new THREE.Vector3(panelWidth / 2, panelBottom, 0.02),
      new THREE.Vector3(panelWidth / 2, panelBottom + panelHeight, 0.02),
      new THREE.Vector3(-panelWidth / 2, panelBottom + panelHeight, 0.02)
    ]
  });
}

scene.updateMatrixWorld(true);

const cornerWorld = reflections.map((r) => r.localCorners.map((corner) => corner.clone().applyMatrix4(r.panel.matrixWorld)));
const edgeIndices = [[0, 1], [1, 2], [2, 3], [3, 0]];
const tempA = new THREE.Vector3();
const tempB = new THREE.Vector3();
const tempC = new THREE.Vector3();
const tempN = new THREE.Vector3();
const tempCenter = new THREE.Vector3();

function updateClipPlanes() {
  for (let r = 0; r < reflections.length; r++) {
    const reflection = reflections[r];
    const corners = cornerWorld[r];
    const planes = reflection.clipPlanes;
    tempCenter.copy(corners[0]).add(corners[1]).add(corners[2]).add(corners[3]).multiplyScalar(0.25);
    for (let p = 0; p < 4; p++) {
      const [a, b] = edgeIndices[p];
      tempA.copy(corners[a]);
      tempB.copy(corners[b]);
      tempC.copy(camera.position);
      tempN.copy(tempB).sub(tempA).cross(tempC.copy(camera.position).sub(tempA)).normalize();
      planes[p].setFromNormalAndCoplanarPoint(tempN, tempA);
      if (planes[p].distanceToPoint(tempCenter) < 0) {
        planes[p].normal.negate();
        planes[p].constant = -planes[p].constant;
      }
    }
  }
}

const startTime = performance.now();
let time = 0;
let revealOffset = 0;
let focusIndex = null;
let activeIndex = 3;
let holdUntil = 0;
let pointerNX = 0;
let pointerNY = 0;
let userYaw = 0;
let userYawTarget = 0;
let userPitch = 0;
let userPitchTarget = 0;
let dragging = false;
let dragMoved = 0;
let lastPointerX = 0;
let lastPointerY = 0;
let started = false;
let mainFade = 1;
let focusVisual = false;

const wideTarget = new THREE.Vector3(0, 1.32, -0.55);
const lookAtTarget = new THREE.Vector3(0, 1.32, -0.55);
const desiredPosition = new THREE.Vector3(0.32, 1.82, 7.1);

function setActive(index, { focus = false } = {}) {
  activeIndex = clamp(index, 0, 6);
  navButtons.forEach((button, n) => button.classList.toggle('active', n === activeIndex));
  capNum.textContent = ROMAN[activeIndex];
  capLine.textContent = LINES[activeIndex];
  caption.classList.add('show');
  if (focus) {
    focusIndex = activeIndex;
    userYawTarget = 0;
    userPitchTarget = 0;
    hint.classList.add('hide');
  }
  playChime(activeIndex);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 3400);
}

function enterExperience() {
  if (!started) {
    started = true;
    document.body.classList.add('started');
    intro.classList.add('hidden');
    revealOffset = time;
    holdUntil = time + 8.5;
    setTimeout(() => caption.classList.add('show'), 350);
    setTimeout(() => hint.classList.add('hide'), 10000);
    if (!audio) createAudio();
    if (audio) {
      audio.ctx.resume();
      soundOn = true;
      soundButton.textContent = 'Sound on';
      audio.master.gain.cancelScheduledValues(audio.ctx.currentTime);
      audio.master.gain.setTargetAtTime(0.55, audio.ctx.currentTime, 1.2);
      setTimeout(() => playChime(3), 600);
    }
  }
}

startButton.addEventListener('click', enterExperience);

soundButton.addEventListener('click', () => {
  if (!audio) createAudio();
  if (!audio) return;
  soundOn = !soundOn;
  soundButton.textContent = soundOn ? 'Sound on' : 'Sound off';
  audio.ctx.resume();
  audio.master.gain.setTargetAtTime(soundOn ? 0.55 : 0, audio.ctx.currentTime, 0.4);
  if (soundOn) playChime(activeIndex);
});

navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const index = Number(button.dataset.index);
    if (focusIndex === index) {
      focusIndex = null;
      hint.textContent = 'Drag to shift the room · Tap a mirror to hold her gaze';
      hint.classList.remove('hide');
      setTimeout(() => hint.classList.add('hide'), 5000);
    } else {
      setActive(index, { focus: true });
    }
  });
});

canvas.addEventListener('pointerdown', (event) => {
  dragging = true;
  dragMoved = 0;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  canvas.classList.add('dragging');
  canvas.setPointerCapture(event.pointerId);
  if (!started) return;
});

canvas.addEventListener('pointermove', (event) => {
  pointerNX = (event.clientX / window.innerWidth) * 2 - 1;
  pointerNY = (event.clientY / window.innerHeight) * 2 - 1;
  if (!dragging || !started) return;
  const dx = event.clientX - lastPointerX;
  const dy = event.clientY - lastPointerY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  if (dragMoved > 6) {
    if (focusIndex !== null) {
      focusIndex = null;
      hint.textContent = 'Drag to shift the room · Tap a mirror to hold her gaze';
      hint.classList.remove('hide');
      setTimeout(() => hint.classList.add('hide'), 5000);
    }
    userYawTarget = clamp(userYawTarget + dx * 0.0028, -0.34, 0.34);
    userPitchTarget = clamp(userPitchTarget + dy * 0.0018, -0.055, 0.055);
  }
});

function endDrag(event) {
  if (!dragging) return;
  dragging = false;
  canvas.classList.remove('dragging');
  try { canvas.releasePointerCapture(event.pointerId); } catch {}
  if (Math.abs(dragMoved) < 7 && started) {
    const ndc = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(glassMeshes, false);
    if (hits.length) {
      const index = hits[0].object.userData.index;
      if (focusIndex === index) {
        focusIndex = null;
        hint.textContent = 'Drag to shift the room · Tap a mirror to hold her gaze';
        hint.classList.remove('hide');
        setTimeout(() => hint.classList.add('hide'), 5000);
      } else {
        setActive(index, { focus: true });
      }
    } else if (focusIndex !== null) {
      focusIndex = null;
      hint.textContent = 'Drag to shift the room · Tap a mirror to hold her gaze';
      hint.classList.remove('hide');
      setTimeout(() => hint.classList.add('hide'), 5000);
    } else {
      setActive((activeIndex + 4) % 7);
    }
    holdUntil = time + 11;
  }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

const raycaster = new THREE.Raycaster();

let audio = null;
let soundOn = false;

function createAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const reverb = ctx.createConvolver();
  const length = Math.floor(ctx.sampleRate * 3.2);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.7);
    }
  }
  reverb.buffer = impulse;
  const reverbGain = ctx.createGain();
  reverbGain.gain.value = 0.62;
  reverb.connect(reverbGain);
  reverbGain.connect(master);

  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.055;
  droneGain.connect(master);
  const droneFilter = ctx.createBiquadFilter();
  droneFilter.type = 'lowpass';
  droneFilter.frequency.value = 210;
  droneFilter.Q.value = 0.6;
  droneFilter.connect(droneGain);

  const droneFrequencies = [55, 82.41, 110, 164.81];
  droneFrequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = i % 2 === 0 ? 'sine' : 'triangle';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = 0.16 / (i + 1);
    osc.connect(gain);
    gain.connect(droneFilter);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.045 + i * 0.017;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.start();
    lfo.start();
  });

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < noiseData.length; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.98 + white * 0.02;
    noiseData[i] = last;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 320;
  noiseFilter.Q.value = 0.7;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.35;
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(master);
  noise.start();

  audio = { ctx, master, reverb, reverbGain };
  return audio;
}

const chimeNotes = [146.83, 174.61, 220.0, 261.63, 329.63, 349.23, 440.0];

function playChime(index) {
  if (!audio || !soundOn) return;
  const ctx = audio.ctx;
  const now = ctx.currentTime + 0.02;
  const base = chimeNotes[index % chimeNotes.length];
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = base;
  const osc2 = ctx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.value = base * 2.002;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.045, now + 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 5.6);
  const gain2 = ctx.createGain();
  gain2.gain.setValueAtTime(0, now);
  gain2.gain.linearRampToValueAtTime(0.012, now + 0.2);
  gain2.gain.exponentialRampToValueAtTime(0.0001, now + 4.2);
  osc.connect(gain);
  osc2.connect(gain2);
  gain.connect(audio.master);
  gain.connect(audio.reverb);
  gain2.connect(audio.master);
  gain2.connect(audio.reverb);
  osc.start(now);
  osc2.start(now);
  osc.stop(now + 5.8);
  osc2.stop(now + 4.4);
}

function createNoiseGrain() {
  const c = document.createElement('canvas');
  c.width = c.height = 140;
  const ctx = c.getContext('2d');
  const image = ctx.createImageData(140, 140);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.random() * 255;
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = Math.random() * 36;
  }
  ctx.putImageData(image, 0, 0);
  document.documentElement.style.setProperty('--grain', `url(${c.toDataURL()})`);
}
createNoiseGrain();

let recording = false;
let recorder = null;
let recordChunks = [];
let recordStartedAt = 0;
let recordTimer = null;

function formatTime(seconds) {
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function resetReveal() {
  revealOffset = time;
  reflections.forEach((reflection) => {
    reflection.reveal = 0;
    reflection.fadeMaterials.forEach((material) => { material.opacity = 0.1; });
  });
  focusIndex = null;
  setActive(3);
}

function startFilm() {
  if (recording) {
    stopFilm();
    return;
  }
  if (!window.MediaRecorder) {
    showToast('Film recording is unavailable in this browser');
    return;
  }
  enterExperience();
  resetReveal();
  holdUntil = time + 30;
  const stream = canvas.captureStream(30);
  if (audio) {
    try {
      const destination = audio.ctx.createMediaStreamDestination();
      audio.master.connect(destination);
      destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    } catch {}
  }
  let mimeType = 'video/webm;codecs=vp9';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6500000 });
  } catch {
    showToast('Film recording could not start');
    return;
  }
  recordChunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) recordChunks.push(event.data);
  };
  recorder.onstop = () => {
    const blob = new Blob(recordChunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reflections-film.webm';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
    showToast('Film saved — reflections-film.webm');
  };
  recording = true;
  recordStartedAt = performance.now();
  document.body.classList.add('recording');
  rec.classList.add('show');
  filmButton.textContent = 'Stop';
  recorder.start(250);
  clearTimeout(recordTimer);
  recordTimer = setTimeout(stopFilm, 18000);
}

function stopFilm() {
  if (!recording) return;
  recording = false;
  clearTimeout(recordTimer);
  document.body.classList.remove('recording');
  rec.classList.remove('show');
  filmButton.innerHTML = '<span class="dot"></span>Film';
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  recorder = null;
}

filmButton.addEventListener('click', startFilm);

window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  if (composer) {
    composer.setSize(width, height);
    bloom.setSize(width, height);
  }
});

const clock = new THREE.Clock();

function updateReveals(dt) {
  const local = time - revealOffset;
  for (let i = 0; i < reflections.length; i++) {
    const reflection = reflections[i];
    const target = smooth((local - reflection.delay) / 2.0);
    reflection.reveal = damp(reflection.reveal, target, 2.1, dt);
    const opacity = 0.09 + reflection.reveal * 0.91;
    reflection.fadeMaterials.forEach((material) => {
      material.opacity = opacity;
      material.emissiveIntensity = 0.28 + reflection.reveal * 0.2 + (i === activeIndex ? 0.1 : 0);
    });
    reflection.glint.material.uniforms.uTime.value = time;
    reflection.glint.material.uniforms.uReveal.value = reflection.reveal;
    reflection.haloMaterial.opacity = 0.06 + reflection.reveal * 0.23 + (i === activeIndex ? 0.05 : 0);
  }
}

function updateWoman(woman, t, intensity = 1, headTrack = 0) {
  const breath = Math.sin(t * 0.9 + woman.phase);
  const sway = Math.sin(t * 0.34 + woman.phase * 1.2);
  woman.upper.position.y = 1.04 + breath * 0.0032 * intensity;
  woman.upper.rotation.z = sway * 0.0034 * intensity;
  woman.upper.rotation.x = Math.sin(t * 0.27 + woman.phase) * 0.0025;
  const headYaw = woman.baseHeadYaw + Math.sin(t * 0.23 + woman.phase * 1.4) * 0.022 + headTrack;
  const headTilt = woman.baseHeadTilt + Math.sin(t * 0.31 + woman.phase) * 0.012;
  woman.head.rotation.y = headYaw;
  woman.head.rotation.z = headTilt;
  woman.head.rotation.x = Math.sin(t * 0.19 + woman.phase) * 0.011;
  woman.group.rotation.z = sway * 0.0018;
  const blinkClock = (t + woman.phase * 1.7 + woman.blinkOffset) % 7.2;
  const blink = blinkClock < 0.2 ? Math.sin((blinkClock / 0.2) * Math.PI) : 0;
  const eyeScale = 1 - blink * 0.94;
  for (const eye of woman.eyes) eye.scale.y = eyeScale;
}

function updateCamera(dt) {
  const portrait = window.innerWidth / window.innerHeight < 0.86;
  const wideFov = portrait ? 48 : 38;
  const wideY = portrait ? 1.68 : 1.82;
  const wideZ = portrait ? 6.55 : 7.1;
  const baseX = portrait ? -0.22 : 0.32;
  const drift = (Math.sin(time * 0.075) * 0.15 + Math.sin(time * 0.021 + 1.2) * 0.2) * (portrait ? 0.45 : 1);
  const vertical = Math.sin(time * 0.058) * 0.022;
  const breatheZ = Math.sin(time * 0.042) * 0.1;

  desiredPosition.set(baseX + drift, wideY + vertical, wideZ + breatheZ);
  wideTarget.set(
    Math.sin(time * 0.051) * (portrait ? 0.05 : 0.16),
    portrait ? 1.29 : 1.33,
    -0.55
  );

  let desiredFov = wideFov;

  if (focusIndex !== null) {
    const reflection = reflections[focusIndex];
    const p = reflection.position;
    const n = reflection.normal;
    const distance = portrait ? 5.2 : 3.3;
    desiredPosition.set(
      p.x + n.x * distance,
      portrait ? 1.52 : 1.66,
      p.z + n.z * distance
    );
    wideTarget.set(
      p.x - n.x * 0.4,
      portrait ? 1.35 : 1.58,
      p.z - n.z * 0.4
    );
    desiredFov = portrait ? 32 : 26;
  }

  const offset = desiredPosition.clone().sub(wideTarget);
  const yaw = userYaw + (started ? 0 : Math.sin(time * 0.1) * 0.012);
  offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  offset.applyAxisAngle(right, userPitch);
  desiredPosition.copy(wideTarget).add(offset);

  const lambda = focusIndex !== null ? 2.2 : 1.7;
  camera.position.x = damp(camera.position.x, desiredPosition.x, lambda, dt);
  camera.position.y = damp(camera.position.y, desiredPosition.y, lambda, dt);
  camera.position.z = damp(camera.position.z, desiredPosition.z, lambda, dt);
  lookAtTarget.x = damp(lookAtTarget.x, wideTarget.x, lambda, dt);
  lookAtTarget.y = damp(lookAtTarget.y, wideTarget.y, lambda, dt);
  lookAtTarget.z = damp(lookAtTarget.z, wideTarget.z, lambda, dt);
  camera.lookAt(lookAtTarget);
  if (Math.abs(camera.fov - desiredFov) > 0.01) {
    camera.fov = damp(camera.fov, desiredFov, 2.2, dt);
    camera.updateProjectionMatrix();
  }
}

function updateDust(dt) {
  const positions = dustGeo.attributes.position.array;
  for (let i = 0; i < dustCount; i++) {
    positions[i * 3 + 1] += dt * (0.018 + (i % 7) * 0.004);
    positions[i * 3] += Math.sin(time * 0.22 + i) * dt * 0.006;
    if (positions[i * 3 + 1] > 4.4) positions[i * 3 + 1] = 0.02;
  }
  dustGeo.attributes.position.needsUpdate = true;
  dust.rotation.y = Math.sin(time * 0.02) * 0.02;
}

let lastAutoCycle = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  time = (performance.now() - startTime) / 1000;

  if (started && !focusIndex && time > holdUntil) {
    if (time - lastAutoCycle > 6.4) {
      lastAutoCycle = time;
      const next = (activeIndex + 1) % 7;
      const readyAt = 8.5;
      if (time - revealOffset > readyAt) setActive(next);
    }
  }

  updateReveals(dt);

  const trackScale = focusIndex !== null ? 0.24 : 0.08;
  const track = clamp(pointerNX, -1, 1) * trackScale;
  const portrait = window.innerWidth / window.innerHeight < 0.86;

  const targetMainFade = focusIndex !== null ? 0 : 1;
  mainFade = damp(mainFade, targetMainFade, 5.5, dt);
  mainWoman.group.visible = mainFade > 0.015;
  Object.values(mainWoman.materials).forEach((material) => {
    if (material && material.isMaterial) material.opacity = mainFade;
  });
  updateWoman(mainWoman, time, 1, Math.sin(time * 0.11) * 0.018);
  mainWoman.group.rotation.y = Math.PI + 0.14 + Math.sin(time * 0.06) * 0.012;

  reflections.forEach((reflection, i) => {
    const isActive = i === activeIndex;
    const headTrack = isActive ? track : clamp(pointerNX, -1, 1) * 0.022;
    updateWoman(reflection.woman, time, 1, headTrack);
    if (isActive) {
      reflection.woman.upper.rotation.y = damp(reflection.woman.upper.rotation.y, 0.015, 1.5, dt);
    } else {
      reflection.woman.upper.rotation.y = damp(reflection.woman.upper.rotation.y, 0, 1.5, dt);
    }
  });

  updateCamera(dt);
  updateClipPlanes();
  updateDust(dt);

  const focused = focusIndex !== null;
  if (focused !== focusVisual) {
    focusVisual = focused;
    document.body.classList.toggle('focused', focused);
  }

  const activeLightTarget = focusIndex !== null ? focusIndex : activeIndex;
  const rp = reflections[activeLightTarget].position;
  warmBounce.position.x = damp(warmBounce.position.x, rp.x * 0.5 + 0.2, 1.1, dt);
  warmBounce.position.z = damp(warmBounce.position.z, rp.z * 0.28 + 2.4, 1.1, dt);
  warmBounce.intensity = 4.2 + Math.sin(time * 0.7) * 0.5;

  if (recording) {
    recTime.textContent = formatTime((performance.now() - recordStartedAt) / 1000);
  }

  if (bloom) {
    bloom.strength = camera.fov > (portrait ? 44 : 34) ? 0.36 : 0.42;
  }

  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}

setActive(3);
navButtons[3].classList.add('active');
animate();

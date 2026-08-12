/* ═══════════════════════════════════════════════════════════════════
   scene.js — renderer, camera, lights, frame loop, quality management

   The camera behaves like a cockpit seat: gentle idle sway, subtle
   mouse parallax, an impulse-based shake system, and everything scales
   down (or off) under reduced-motion.

   If WebGL is unavailable, createSpace() returns a 2D canvas starfield
   fallback that honours the same API, so the rest of the app never
   needs to care.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from "three";
import { Settings } from "../storage/prefs.js";

export const QUALITIES = {
  low:    { stars: 900,  asteroids: 8,  particles: 500,  nebula: 2, dprCap: 1.0 },
  medium: { stars: 2000, asteroids: 16, particles: 1200, nebula: 3, dprCap: 1.25 },
  high:   { stars: 3500, asteroids: 26, particles: 2200, nebula: 5, dprCap: 1.75 },
  ultra:  { stars: 6000, asteroids: 40, particles: 3200, nebula: 6, dprCap: 2.0 },
};

export function autoQuality() {
  const touch = "ontouchstart" in window;
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (touch || mem <= 2 || cores <= 2) return "low";
  if (mem <= 4 || cores <= 4) return "medium";
  return "high";
}

export function createSpace(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch {
    return create2DFallback(canvas);
  }

  const qualityName = Settings.quality === "auto" ? autoQuality() : Settings.quality;
  const Q = QUALITIES[qualityName];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, Q.dprCap));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x02040a, 0.0016);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 0, 0);
  scene.add(camera);           // children of the camera stay fixed in view (cockpit weapon)

  /* lighting: cold key light (the "sun"), soft ambient, warm rim */
  const ambient = new THREE.AmbientLight(0x2a3550, 0.9);
  const sun = new THREE.DirectionalLight(0xdfe8ff, 2.1);
  sun.position.set(-40, 25, -60);
  const rim = new THREE.PointLight(0x38b6ff, 1.4, 60);
  rim.position.set(0, -2, -6);
  scene.add(ambient, sun, rim);

  /* frame loop with registered updaters */
  const updaters = new Set();
  const clock = new THREE.Clock();
  let shakeAmt = 0;
  const mouse = { x: 0, y: 0 };
  let typeKick = 0;            // tiny nudge when a key lands
  let intensity = 0;           // 0..1 performance heat → fov / lights / speed
  let fovPulse = 0;            // brief cinematic fov kick

  window.addEventListener("pointermove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  /* adaptive quality: if fps sags badly, drop a level once */
  let fpsAccum = 0, fpsCount = 0, degraded = false;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    const rm = Settings.reducedMotion;

    for (const fn of updaters) fn(dt, t);

    // cockpit sway + parallax + shake
    const sway = rm ? 0 : 1;
    camera.rotation.z = Math.sin(t * 0.31) * 0.006 * sway;
    const tx = (rm ? 0 : mouse.x * 0.04) + Math.sin(t * 0.23) * 0.012 * sway;
    const ty = (rm ? 0 : -mouse.y * 0.03) + Math.cos(t * 0.19) * 0.010 * sway;
    camera.rotation.y += (tx * 0.5 - camera.rotation.y) * 0.05;
    camera.rotation.x += (ty * 0.5 - camera.rotation.x) * 0.05;
    if (shakeAmt > 0.001) {
      camera.position.x = (Math.random() - 0.5) * shakeAmt;
      camera.position.y = (Math.random() - 0.5) * shakeAmt;
      shakeAmt *= 0.86;
    } else { camera.position.x = camera.position.y = 0; }
    if (typeKick > 0.001) { camera.position.z = -typeKick; typeKick *= 0.8; }
    else camera.position.z = 0;

    // performance heat: subtle fov widen + warmer rim light
    if (fovPulse > 0.01) fovPulse *= Math.exp(-dt * 2.2);
    const targetFov = 62 + intensity * 4 + fovPulse;
    if (Math.abs(camera.fov - targetFov) > 0.02) {
      camera.fov += (targetFov - camera.fov) * Math.min(dt * 4, 1);
      camera.updateProjectionMatrix();
    }
    rim.intensity = 1.4 + intensity * 1.6;

    renderer.render(scene, camera);

    // fps watchdog (checks ~every 3s)
    fpsAccum += dt; fpsCount++;
    if (fpsAccum >= 3) {
      const fps = fpsCount / fpsAccum;
      fpsAccum = 0; fpsCount = 0;
      if (!degraded && fps < 38 && qualityName !== "low") {
        degraded = true;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    is3D: true,
    scene, camera, renderer,
    quality: Q,
    qualityName,
    onFrame: (fn) => updaters.add(fn),
    shake(amount) { if (Settings.shake && !Settings.reducedMotion) shakeAmt = Math.max(shakeAmt, amount); },
    typeKick() { if (!Settings.reducedMotion) typeKick = 0.02; },
    setIntensity(v) { intensity = Settings.reducedMotion ? 0 : Math.max(0, Math.min(1, v)); },
    getIntensity: () => intensity,
    pulseFov(deg) { if (!Settings.reducedMotion) fovPulse = deg; },
    /** viewport pixel coords → world point at `dist` in front of the camera */
    screenToWorld(px, py, dist = 16, out = new THREE.Vector3()) {
      out.set((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1, 0.5);
      out.unproject(camera);
      out.sub(camera.position).normalize();
      return out.multiplyScalar(dist).add(camera.position);
    },
    /** brief "solar flare" random event — sun intensity swells */
    flare() {
      const base = sun.intensity;
      let p = 0;
      const id = setInterval(() => {
        p += 0.05;
        sun.intensity = base + Math.sin(Math.min(p, 1) * Math.PI) * 2.2;
        if (p >= 1) { sun.intensity = base; clearInterval(id); }
      }, 50);
    },
  };
}

/* ── 2D fallback: still beautiful, zero WebGL ───────────────────── */
function create2DFallback(canvas) {
  const ctx = canvas.getContext("2d");
  const stars = Array.from({ length: 350 }, () => ({
    x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8,
  }));
  const updaters = new Set();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const g = ctx.createRadialGradient(canvas.width / 2, canvas.height * 0.3, 0, canvas.width / 2, canvas.height * 0.3, canvas.height);
    g.addColorStop(0, "#071120"); g.addColorStop(1, "#02040a");
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#cfe4ff";
    for (const s of stars) {
      s.y += dt * 0.02 * s.z;
      if (s.y > 1) s.y = 0;
      ctx.globalAlpha = s.z;
      ctx.fillRect(s.x * canvas.width, s.y * canvas.height, s.z * 1.8, s.z * 1.8);
    }
    ctx.globalAlpha = 1;
    for (const fn of updaters) fn(dt, now / 1000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  const noop = () => {};
  return {
    is3D: false, scene: null, camera: null, renderer: null,
    quality: QUALITIES.low, qualityName: "low",
    onFrame: (fn) => updaters.add(fn),
    shake: noop, typeKick: noop, flare: noop,
    setIntensity: noop, getIntensity: () => 0, pulseFov: noop, screenToWorld: () => null,
  };
}

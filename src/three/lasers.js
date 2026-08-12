/* ═══════════════════════════════════════════════════════════════════
   lasers.js — beam pool, target drones, impacts and shockwaves

   fire(power) draws a pooled additive beam from the weapon muzzle to
   either the locked target drone or a random distant point, with a
   muzzle flash, an impact particle burst and an expanding shockwave
   ring. power: 1 = pulse, 2 = laser, 3 = heavy blast, 4 = final volley.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from "three";
import { emit } from "../bus.js";

const COLORS = { 1: 0x59d8ff, 2: 0x38b6ff, 3: 0x8a7dff, 4: 0xffd166 };

export function createLasers(scene, craft, particles) {
  /* ── beam pool ─────────────────────────────────────────────── */
  const POOL = 8;
  const beams = [];
  const unit = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
  unit.rotateX(Math.PI / 2);                 // align length with +Z
  for (let i = 0; i < POOL; i++) {
    const core = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    const halo = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({
      color: 0x38b6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    core.visible = halo.visible = false;
    scene.add(core, halo);
    beams.push({ core, halo, life: 0, max: 0 });
  }

  /* ── shockwave ring pool ───────────────────────────────────── */
  const rings = [];
  for (let i = 0; i < 4; i++) {
    const r = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1, 40),
      new THREE.MeshBasicMaterial({ color: 0x9fe4ff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    r.visible = false;
    scene.add(r);
    rings.push({ mesh: r, life: 0 });
  }

  /* ── target drone ──────────────────────────────────────────── */
  const drone = new THREE.Group();
  const droneCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.4, 0),
    new THREE.MeshStandardMaterial({ color: 0x27303f, emissive: 0xff4d5e, emissiveIntensity: 0.7, metalness: 0.8, roughness: 0.3 }),
  );
  const droneRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.09, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0xff4d5e, transparent: true, opacity: 0.7 }),
  );
  drone.add(droneCore, droneRing);
  scene.add(drone);
  let droneAlive = false, droneRespawn = 4, locked = false;

  function spawnDrone() {
    drone.position.set((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 26, -90 - Math.random() * 50);
    drone.visible = droneAlive = true;
    locked = false;
  }
  spawnDrone();

  function destroyDrone() {
    particles.spawn(drone.position, { count: 60, speed: 9, color: 0xffb066, lifeSec: 1.2 });
    particles.spawn(drone.position, { count: 40, speed: 5, color: 0xff5b45, lifeSec: 0.9 });
    shockwave(drone.position, 14);
    drone.visible = droneAlive = false;
    droneRespawn = 5 + Math.random() * 6;
    if (locked) { locked = false; emit("tv:lock", { locked: false }); }
    emit("tv:targetDown", {});
  }

  /** HUD asks for a lock when the pilot is performing well. */
  function tryLock() {
    if (droneAlive && !locked) {
      locked = true;
      droneRing.material.color.setHex(0x59ff9d);
      emit("tv:lock", { locked: true });
    }
  }

  function shockwave(pos, size) {
    const r = rings.find(x => x.life <= 0);
    if (!r) return;
    r.mesh.position.copy(pos);
    r.mesh.lookAt(craft.muzzleWorld(new THREE.Vector3()));
    r.mesh.scale.setScalar(0.4);
    r.userSize = size;
    r.life = 1;
    r.mesh.visible = true;
  }

  /* ── targeting guide: faint holographic line, muzzle → current char ── */
  const guide = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({
    color: 0x38b6ff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  guide.visible = false;
  scene.add(guide);

  const _gFrom = new THREE.Vector3(), _gMid = new THREE.Vector3();
  function updateGuide(targetPoint, visible) {
    guide.visible = visible;
    if (!visible) return;
    craft.muzzleWorld(_gFrom);
    const len = _gFrom.distanceTo(targetPoint);
    _gMid.addVectors(_gFrom, targetPoint).multiplyScalar(0.5);
    guide.position.copy(_gMid);
    guide.scale.set(0.006, 0.006, len);
    guide.lookAt(targetPoint);
  }

  const _from = new THREE.Vector3(), _to = new THREE.Vector3(), _mid = new THREE.Vector3();

  /** Precision shot at an exact world point (one per typed character).
      kind: {color, width} from the character's weapon category. */
  function fireAt(point, { color = 0x38b6ff, width = 0.014, life = 0.09, burst = 5 } = {}) {
    craft.muzzleWorld(_from);
    _to.copy(point);
    const b = beams.find(x => x.life <= 0) || beams[0];
    const len = _from.distanceTo(_to);
    _mid.addVectors(_from, _to).multiplyScalar(0.5);
    for (const [mesh, w] of [[b.core, width * 0.5], [b.halo, width * 1.8]]) {
      mesh.position.copy(_mid);
      mesh.scale.set(w, w, len);
      mesh.lookAt(_to);
      mesh.visible = true;
    }
    b.halo.material.color.setHex(color);
    b.life = b.max = life;
    particles.spawn(_from, { count: 3, speed: 1.5, color, lifeSec: 0.18 });      // muzzle
    particles.spawn(_to, { count: burst, speed: 2.2, color, lifeSec: 0.45 });    // letter impact
  }

  /** Fire a beam. power 1..4 */
  function fire(power = 1) {
    craft.muzzleWorld(_from);
    if (droneAlive && (locked || power >= 3)) _to.copy(drone.getWorldPosition(new THREE.Vector3()));
    else _to.set((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 24, -110 - Math.random() * 60);

    const b = beams.find(x => x.life <= 0) || beams[0];
    const len = _from.distanceTo(_to);
    _mid.addVectors(_from, _to).multiplyScalar(0.5);
    const width = [0, 0.02, 0.045, 0.09, 0.16][power];
    for (const [mesh, w] of [[b.core, width], [b.halo, width * 3]]) {
      mesh.position.copy(_mid);
      mesh.scale.set(w, w, len);
      mesh.lookAt(_to);
      mesh.visible = true;
    }
    b.halo.material.color.setHex(COLORS[power]);
    b.life = b.max = 0.16 + power * 0.06;

    // muzzle flash + impact
    particles.spawn(_from, { count: 6 + power * 4, speed: 2, color: COLORS[power], lifeSec: 0.25 });
    particles.spawn(_to, { count: 10 + power * 12, speed: 3 + power * 2, color: COLORS[power], lifeSec: 0.7 });
    if (power >= 2) shockwave(_to, 3 + power * 2.5);
    craft.recoil();

    if (droneAlive && power >= 3 && _to.equals(drone.position)) destroyDrone();
    else if (droneAlive && locked && power >= 2 && Math.random() < 0.4) destroyDrone();
  }

  function update(dt, t) {
    for (const b of beams) {
      if (b.life <= 0) continue;
      b.life -= dt;
      const k = Math.max(b.life / b.max, 0);
      b.core.material.opacity = k;
      b.halo.material.opacity = k * 0.5;
      if (b.life <= 0) b.core.visible = b.halo.visible = false;
    }
    for (const r of rings) {
      if (r.life <= 0) continue;
      r.life -= dt * 1.6;
      const k = Math.max(r.life, 0);
      r.mesh.scale.setScalar((1 - k) * r.userSize + 0.4);
      r.mesh.material.opacity = k * 0.8;
      if (r.life <= 0) r.mesh.visible = false;
    }
    if (droneAlive) {
      drone.rotation.y += dt * 0.8;
      droneRing.rotation.x = Math.PI / 2 + Math.sin(t * 0.7) * 0.4;
      drone.position.y += Math.sin(t * 1.3) * 0.01;
      if (!locked) droneRing.material.color.setHex(0xff4d5e);
    } else {
      droneRespawn -= dt;
      if (droneRespawn <= 0) spawnDrone();
    }
  }

  return { fire, fireAt, updateGuide, update, tryLock, isLocked: () => locked, hasTarget: () => droneAlive };
}

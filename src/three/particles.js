/* ═══════════════════════════════════════════════════════════════════
   particles.js — one pooled GPU particle system for everything

   A single THREE.Points with pre-allocated buffers. spawn() reuses dead
   slots (object pooling), colors fade to black and the material blends
   additively, so "faded to black" = invisible with zero allocation.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from "three";

export function createParticles(scene, max) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.14, vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  points.frustumCulled = false;
  scene.add(points);

  // parallel state arrays (structure-of-arrays for cache-friendly updates)
  const vel = new Float32Array(max * 3);
  const life = new Float32Array(max);      // seconds remaining; <=0 == dead
  const maxLife = new Float32Array(max);
  const baseCol = new Float32Array(max * 3);
  const grav = new Float32Array(max);
  let cursor = 0;
  const tmp = new THREE.Color();

  /** Burst `count` particles at `p` (Vector3). */
  function spawn(p, { count = 12, speed = 3, spread = 1, color = 0x7fd8ff, lifeSec = 0.8, gravity = 0, dir = null } = {}) {
    tmp.set(color);
    for (let n = 0; n < count; n++) {
      const i = cursor; cursor = (cursor + 1) % max;
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      // random direction, optionally biased along `dir`
      let vx = (Math.random() - 0.5), vy = (Math.random() - 0.5), vz = (Math.random() - 0.5);
      const len = Math.hypot(vx, vy, vz) || 1;
      const s = speed * (0.4 + Math.random() * 0.8);
      vx = vx / len * spread; vy = vy / len * spread; vz = vz / len * spread;
      if (dir) { vx += dir.x; vy += dir.y; vz += dir.z; }
      vel[i * 3] = vx * s; vel[i * 3 + 1] = vy * s; vel[i * 3 + 2] = vz * s;
      life[i] = maxLife[i] = lifeSec * (0.6 + Math.random() * 0.7);
      grav[i] = gravity;
      const b = 0.7 + Math.random() * 0.3;
      baseCol[i * 3] = tmp.r * b; baseCol[i * 3 + 1] = tmp.g * b; baseCol[i * 3 + 2] = tmp.b * b;
    }
  }

  function update(dt) {
    let any = false;
    for (let i = 0; i < max; i++) {
      if (life[i] <= 0) continue;
      any = true;
      life[i] -= dt;
      const k = Math.max(life[i] / maxLife[i], 0);   // 1 → 0 fade
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += (vel[i * 3 + 1] - grav[i] * (maxLife[i] - life[i])) * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      col[i * 3] = baseCol[i * 3] * k;
      col[i * 3 + 1] = baseCol[i * 3 + 1] * k;
      col[i * 3 + 2] = baseCol[i * 3 + 2] * k;
    }
    if (any) {
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    }
  }

  return { spawn, update };
}

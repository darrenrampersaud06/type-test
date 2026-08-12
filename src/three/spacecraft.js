/* ═══════════════════════════════════════════════════════════════════
   spacecraft.js — the player's weapon platform

   Built from primitives and parented to the CAMERA (cockpit mount).
   The TURRET sub-group smoothly tracks the current target character:
   aimAt(worldPoint) slerps the turret toward the target every frame,
   so the gun physically follows the text as you type — and tracks
   backward when you backspace. Spring recoil + micro-vibration scale
   with shot power.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from "three";

export function createSpacecraft(camera) {
  const group = new THREE.Group();
  group.position.set(0, -1.5, -3.2);
  group.scale.setScalar(0.72);
  camera.add(group);

  const steel = new THREE.MeshStandardMaterial({ color: 0x424b5a, roughness: 0.35, metalness: 0.9 });
  const dark  = new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.6, metalness: 0.7 });
  const conduitMat = new THREE.MeshStandardMaterial({
    color: 0x0b2233, emissive: 0x38b6ff, emissiveIntensity: 0.8, roughness: 0.4, metalness: 0.4,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x081522, emissive: 0x38b6ff, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.2,
  });

  /* chassis (static) */
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 1.1), dark);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.85), steel);
  deck.position.y = 0.2;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 18), coreMat);
  core.position.set(0, 0.3, 0.15);
  group.add(base, deck, core);

  /* TURRET — everything that pivots toward the target */
  const turret = new THREE.Group();
  turret.position.set(0, 0.34, -0.1);
  group.add(turret);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 1.7, 14), steel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.65;
  const railGeo = new THREE.BoxGeometry(0.07, 0.07, 1.45);
  const railL = new THREE.Mesh(railGeo, conduitMat); railL.position.set(-0.21, 0, -0.5);
  const railR = new THREE.Mesh(railGeo, conduitMat); railR.position.set(0.21, 0, -0.5);
  const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 8, 20), conduitMat);
  muzzleRing.position.z = -1.48;
  const chargeOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  chargeOrb.position.z = -1.52;
  const muzzleLight = new THREE.PointLight(0x66d9ff, 0, 8);
  muzzleLight.position.copy(chargeOrb.position);
  turret.add(barrel, railL, railR, muzzleRing, chargeOrb, muzzleLight);

  /* cockpit blinkers */
  const blinkMat = new THREE.MeshBasicMaterial({ color: 0xff4d5e });
  const blink1 = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), blinkMat);
  blink1.position.set(-0.6, 0.32, 0.3);
  const blink2 = blink1.clone(); blink2.position.x = 0.6;
  group.add(blink1, blink2);

  let charge = 0;
  let recoilZ = 0, vibe = 0;
  let intensity = 0;
  const aimTarget = new THREE.Vector3(0, 0.3, -20);   // world space
  const _local = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _m = new THREE.Matrix4();

  return {
    group, turret,
    muzzleWorld(target = new THREE.Vector3()) { return chargeOrb.getWorldPosition(target); },
    setCharge(v) { charge = Math.max(0, Math.min(1, v)); },
    setIntensity(v) { intensity = v; },
    /** point the turret at a world-space position (smoothed per-frame) */
    aimAt(worldPoint) { aimTarget.copy(worldPoint); },
    /** power 0..1 — scales recoil depth and vibration */
    recoil(power = 0.4) {
      recoilZ = Math.max(recoilZ, 0.06 + power * 0.14);
      vibe = Math.max(vibe, power);
      muzzleLight.intensity = 3 + power * 6;
    },
    update(dt, t) {
      // — turret tracking: smooth slerp toward the target, never snap —
      _local.copy(aimTarget);
      turret.parent.worldToLocal(_local);
      _m.lookAt(turret.position, _local, turret.up);
      _q.setFromRotationMatrix(_m);
      // clamp extreme angles so the gun stays plausible in-frame
      turret.quaternion.slerp(_q, 1 - Math.exp(-dt * 9));

      // charge orb breathes and grows with stored energy
      const s = 0.4 + charge * 1.1 + Math.sin(t * 6) * 0.08 * charge;
      chargeOrb.scale.setScalar(Math.max(s, 0.3));
      chargeOrb.material.opacity = 0.35 + charge * 0.6;
      conduitMat.emissiveIntensity = 0.5 + charge * 2.2 + intensity;
      coreMat.emissiveIntensity = 1.1 + Math.sin(t * 3) * 0.3 + charge * 1.6 + intensity * 1.4;

      // spring recoil + decaying micro-vibration
      if (recoilZ > 0.001) recoilZ *= Math.exp(-dt * 11);
      if (vibe > 0.005) vibe *= Math.exp(-dt * 8);
      const jx = (Math.random() - 0.5) * vibe * 0.03;
      const jy = (Math.random() - 0.5) * vibe * 0.03;
      barrel.position.set(jx, jy, -0.65 + recoilZ);
      muzzleRing.position.set(jx, jy, -1.48 + recoilZ);
      chargeOrb.position.set(jx, jy, -1.52 + recoilZ);
      muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 26);

      // blinkers + idle float (float scales up slightly with performance)
      const on = Math.sin(t * 2.4) > 0.7;
      blinkMat.color.setHex(on ? 0xff4d5e : 0x401318);
      group.position.y = -1.5 + Math.sin(t * (1.1 + intensity)) * 0.012;
    },
  };
}

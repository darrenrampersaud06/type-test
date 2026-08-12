/* ═══════════════════════════════════════════════════════════════════
   spacecraft.js — the player's weapon platform

   Built from primitives (boxes, cylinders, cones, spheres) and parented
   to the CAMERA, so it sits fixed at the bottom of the view like a
   cockpit-mounted cannon. Exposes charge level (drives the muzzle orb
   + conduit glow), recoil(), and pulsing engine light.
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

  /* chassis */
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 1.1), dark);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.85), steel);
  deck.position.y = 0.2;
  group.add(base, deck);

  /* twin rails + central barrel pointing into the screen */
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 1.7, 14), steel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.34, -0.75);
  const railGeo = new THREE.BoxGeometry(0.07, 0.07, 1.45);
  const railL = new THREE.Mesh(railGeo, conduitMat); railL.position.set(-0.21, 0.34, -0.6);
  const railR = new THREE.Mesh(railGeo, conduitMat); railR.position.set(0.21, 0.34, -0.6);
  const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 8, 20), conduitMat);
  muzzleRing.position.set(0, 0.34, -1.58);
  group.add(barrel, railL, railR, muzzleRing);

  /* energy core + charge orb at the muzzle */
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 18), coreMat);
  core.position.set(0, 0.3, 0.15);
  const chargeOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  chargeOrb.position.set(0, 0.34, -1.62);
  group.add(core, chargeOrb);

  /* cockpit blinkers */
  const blinkMat = new THREE.MeshBasicMaterial({ color: 0xff4d5e });
  const blink1 = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), blinkMat);
  blink1.position.set(-0.6, 0.32, 0.3);
  const blink2 = blink1.clone(); blink2.position.x = 0.6;
  group.add(blink1, blink2);

  /* muzzle light — illuminates the ship when firing */
  const muzzleLight = new THREE.PointLight(0x66d9ff, 0, 8);
  muzzleLight.position.copy(chargeOrb.position);
  group.add(muzzleLight);

  let charge = 0;              // 0..1, mirrors the HUD energy meter
  let recoilZ = 0;

  return {
    group,
    /** world position of the muzzle — lasers spawn here */
    muzzleWorld(target = new THREE.Vector3()) { return chargeOrb.getWorldPosition(target); },
    setCharge(v) { charge = Math.max(0, Math.min(1, v)); },
    recoil() { recoilZ = 0.16; muzzleLight.intensity = 6; },
    update(dt, t) {
      // charge orb breathes and grows with stored energy
      const s = 0.4 + charge * 1.1 + Math.sin(t * 6) * 0.08 * charge;
      chargeOrb.scale.setScalar(Math.max(s, 0.3));
      chargeOrb.material.opacity = 0.35 + charge * 0.6;
      conduitMat.emissiveIntensity = 0.5 + charge * 2.2;
      coreMat.emissiveIntensity = 1.1 + Math.sin(t * 3) * 0.3 + charge * 1.6;
      // recoil spring
      if (recoilZ > 0.001) { recoilZ *= 0.82; }
      barrel.position.z = -0.75 + recoilZ;
      muzzleRing.position.z = -1.58 + recoilZ;
      chargeOrb.position.z = -1.62 + recoilZ;
      muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 30);
      // blinkers
      const on = Math.sin(t * 2.4) > 0.7;
      blinkMat.color.setHex(on ? 0xff4d5e : 0x401318);
      // idle float
      group.position.y = -1.5 + Math.sin(t * 1.1) * 0.012;
    },
  };
}

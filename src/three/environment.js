/* ═══════════════════════════════════════════════════════════════════
   environment.js — the deep-space backdrop, all procedural

   Factories (each returns an object the caller registers on the frame
   loop): starfield, nebula, planets, asteroid belt, distant ships.
   No downloaded assets — geometry, canvas textures and sprites only.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from "three";

/* ── canvas texture helpers ─────────────────────────────────────── */
function canvasTexture(size, draw) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** soft radial glow sprite texture */
function glowTexture(color, size = 128) {
  return canvasTexture(size, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, color);
    g.addColorStop(0.4, color.replace("1)", "0.35)"));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

/* ── starfield ──────────────────────────────────────────────────── */
export function createStarfield(scene, count) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const tints = [[1, 1, 1], [0.75, 0.85, 1], [1, 0.9, 0.75], [0.85, 0.95, 1]];
  for (let i = 0; i < count; i++) {
    // shell distribution so stars surround the camera
    const r = 300 + Math.random() * 900;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
    const t = tints[Math.floor(Math.random() * tints.length)];
    const b = 0.4 + Math.random() * 0.6;
    col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 1.6, vertexColors: true, sizeAttenuation: true,
    transparent: true, opacity: 0.95, depthWrite: false,
  }));
  scene.add(stars);
  return { update(dt) { stars.rotation.y += dt * 0.0035; stars.rotation.x += dt * 0.0009; } };
}

/* ── nebula: layered additive sprites, slow drift ───────────────── */
export function createNebula(scene, layers) {
  const palettes = [
    "rgba(56,120,255,1)", "rgba(130,80,255,1)", "rgba(40,190,220,1)",
    "rgba(200,80,160,1)", "rgba(70,90,200,1)", "rgba(90,200,170,1)",
  ];
  const sprites = [];
  for (let i = 0; i < layers; i++) {
    const mat = new THREE.SpriteMaterial({
      map: glowTexture(palettes[i % palettes.length], 256),
      transparent: true, opacity: 0.13, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sp = new THREE.Sprite(mat);
    const scale = 380 + Math.random() * 420;
    sp.scale.set(scale, scale * (0.55 + Math.random() * 0.5), 1);
    sp.position.set((Math.random() - 0.5) * 800, (Math.random() - 0.5) * 400, -500 - Math.random() * 400);
    sp.userData.rot = (Math.random() - 0.5) * 0.004;
    scene.add(sp);
    sprites.push(sp);
  }
  return { update(dt) { for (const s of sprites) s.material.rotation += s.userData.rot * dt * 10; } };
}

/* ── planets: banded canvas textures + atmosphere + optional ring ── */
function planetTexture(hueA, hueB) {
  return canvasTexture(256, (ctx, s) => {
    for (let y = 0; y < s; y++) {
      const m = (Math.sin(y * 0.08) + Math.sin(y * 0.023 + 2)) * 0.25 + 0.5;
      ctx.fillStyle = `hsl(${hueA + (hueB - hueA) * m}, 45%, ${22 + m * 22}%)`;
      ctx.fillRect(0, y, s, 1);
    }
    for (let i = 0; i < 550; i++) {              // speckle noise
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 1);
    }
  });
}

export function createPlanets(scene) {
  const planets = [];

  function makePlanet({ radius, pos, hueA, hueB, atmo, ring, speed }) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 40, 40),
      new THREE.MeshStandardMaterial({ map: planetTexture(hueA, hueB), roughness: 0.9, metalness: 0.05 }),
    );
    group.add(body);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.06, 32, 32),
      new THREE.MeshBasicMaterial({ color: atmo, transparent: true, opacity: 0.14, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    group.add(glow);
    if (ring) {
      const ringTex = canvasTexture(128, (ctx, s) => {
        for (let x = 0; x < s; x++) {
          ctx.fillStyle = `rgba(210,190,160,${(Math.sin(x * 0.55) * 0.5 + 0.5) * 0.55})`;
          ctx.fillRect(x, 0, 1, s);
        }
      });
      const r = new THREE.Mesh(
        new THREE.RingGeometry(radius * 1.5, radius * 2.5, 64),
        new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }),
      );
      r.rotation.x = Math.PI / 2.25;
      group.add(r);
    }
    group.position.copy(pos);
    scene.add(group);
    planets.push({ group, body, speed });
  }

  makePlanet({ radius: 26, pos: new THREE.Vector3(-120, 30, -320), hueA: 200, hueB: 240, atmo: 0x4488ff, speed: 0.01 });
  makePlanet({ radius: 14, pos: new THREE.Vector3(150, -40, -420), hueA: 18, hueB: 40, atmo: 0xff9955, ring: true, speed: 0.02 });

  return { update(dt) { for (const p of planets) p.body.rotation.y += dt * p.speed; } };
}

/* ── asteroid belt + near-pass random event ─────────────────────── */
export function createAsteroids(scene, count) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 1, metalness: 0.1, flatShading: true });
  // three shared displaced geometries, reused across the belt
  const geos = [0, 1, 2].map(() => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const scale = 0.7 + Math.random() * 0.6;
      p.setXYZ(i, p.getX(i) * scale, p.getY(i) * scale, p.getZ(i) * scale);
    }
    g.computeVertexNormals();
    return g;
  });
  const rocks = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geos[i % 3], mat);
    const s = 0.6 + Math.random() * 3.4;
    m.scale.setScalar(s);
    m.position.set((Math.random() - 0.5) * 400, (Math.random() - 0.5) * 160, -80 - Math.random() * 500);
    m.userData = {
      rx: (Math.random() - 0.5) * 0.6, ry: (Math.random() - 0.5) * 0.6,
      drift: (Math.random() - 0.5) * 0.8,
    };
    scene.add(m);
    rocks.push(m);
  }
  let passing = null;
  return {
    update(dt) {
      for (const r of rocks) {
        r.rotation.x += r.userData.rx * dt;
        r.rotation.y += r.userData.ry * dt;
        r.position.x += r.userData.drift * dt;
      }
      if (passing) {
        passing.mesh.position.addScaledVector(passing.vel, dt);
        passing.life -= dt;
        if (passing.life <= 0) { passing.mesh.position.copy(passing.home); passing = null; }
      }
    },
    /** random event: an asteroid tumbles close past the cockpit */
    pass() {
      if (passing) return;
      const mesh = rocks[Math.floor(Math.random() * rocks.length)];
      passing = {
        mesh, home: mesh.position.clone(), life: 7,
        vel: new THREE.Vector3(14, 3 * (Math.random() - 0.5), 4),
      };
      mesh.position.set(-60, (Math.random() - 0.5) * 20, -45);
    },
  };
}

/* ── distant ships: simple silhouettes cruising the void ────────── */
export function createShips(scene) {
  const ships = [];
  function buildShip(scale) {
    const g = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x39414f, roughness: 0.5, metalness: 0.8 });
    const hull = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3, 6), hullMat);
    hull.rotation.z = -Math.PI / 2;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 2.4), hullMat);
    const engine = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture("rgba(120,200,255,1)", 64), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    engine.position.x = -1.6;
    engine.scale.setScalar(1.4);
    g.add(hull, wing, engine);
    g.scale.setScalar(scale);
    return g;
  }
  for (let i = 0; i < 4; i++) {
    const g = buildShip(0.9 + Math.random() * 1.4);
    resetShip(g, true);
    scene.add(g);
    ships.push(g);
  }
  function resetShip(g, randomX = false) {
    g.position.set(
      randomX ? (Math.random() - 0.5) * 500 : -280 - Math.random() * 120,
      (Math.random() - 0.5) * 140,
      -180 - Math.random() * 320,
    );
    g.userData.speed = 3 + Math.random() * 5;
  }
  let flyby = null;
  return {
    update(dt) {
      for (const s of ships) {
        s.position.x += s.userData.speed * dt;
        if (s.position.x > 300) resetShip(s);
      }
      if (flyby) {
        flyby.ship.position.addScaledVector(flyby.vel, dt);
        flyby.life -= dt;
        if (flyby.life <= 0) { resetShip(flyby.ship, true); flyby = null; }
      }
    },
    /** random event: a ship sweeps closer through the view */
    flyby() {
      if (flyby) return;
      const ship = ships[0];
      ship.position.set(-70, -8 + Math.random() * 16, -60);
      flyby = { ship, vel: new THREE.Vector3(26, 2, -6), life: 6 };
    },
  };
}

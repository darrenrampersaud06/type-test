/* ═══════════════════════════════════════════════════════════════════
   avatars.js — pilot portraits with drop-in image slots

   Each slot has an IMAGE PATH and an EMOJI FALLBACK. Drop a picture at
   the path (assets/avatars/<id>.png) and it is used automatically; if
   the file isn't there, the emoji shows instead. Nothing else to wire.

   See assets/avatars/README.md for the slot list and sizing advice.
   ═══════════════════════════════════════════════════════════════════ */
import { Store } from "../storage/store.js";

export const AVATARS = [
  { id: "pilot",     emoji: "🧑‍🚀", label: "PILOT" },
  { id: "commander", emoji: "👨‍✈️", label: "COMMANDER" },
  { id: "android",   emoji: "🤖",   label: "ANDROID" },
  { id: "alien",     emoji: "👽",   label: "XENO" },
  { id: "cyborg",    emoji: "🦾",   label: "CYBERNETIC" },
  { id: "satellite", emoji: "🛰️",   label: "DRONE" },
  { id: "helm",      emoji: "🪐",   label: "VOYAGER" },
  { id: "ace",       emoji: "⭐",   label: "ACE" },
];

export const avatarPath = (id) => `assets/avatars/${id}.png`;
export const currentAvatarId = () => Store.get("avatarId", "pilot");
export const setAvatarId = (id) => Store.set("avatarId", id);

const byId = (id) => AVATARS.find(a => a.id === id) || AVATARS[0];

/** Paint an avatar into `el`: the image if it loads, else the emoji.
    Works for the big profile portrait, the header chip and the picker. */
export function paintAvatar(el, id = currentAvatarId()) {
  const a = byId(id);
  el.textContent = a.emoji;                 // instant fallback, no flash of blank
  el.dataset.avatarId = a.id;
  const img = new Image();
  img.onload = () => {
    if (el.dataset.avatarId !== a.id) return;   // selection changed mid-load
    el.textContent = "";
    img.alt = a.label;
    el.appendChild(img);
  };
  img.onerror = () => { /* no file yet — emoji stays */ };
  img.src = avatarPath(a.id);
}

/* Tiny pub/sub event bus — every module talks through this, so the typing
   engine never needs to know the 3D scene exists (and vice versa). */
export const bus = new EventTarget();
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
export const on = (type, fn) => bus.addEventListener(type, (e) => fn(e.detail));

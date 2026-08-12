# Profile pictures

Eight placeholder pilot portraits ship here as 256×256 PNGs. **To use your
own, just overwrite the file with the same name** — no code changes, the
picker loads whatever is at that path.

| file | slot label | emoji fallback |
|---|---|---|
| `pilot.png` | PILOT | 🧑‍🚀 |
| `commander.png` | COMMANDER | 👨‍✈️ |
| `android.png` | ANDROID | 🤖 |
| `alien.png` | XENO | 👽 |
| `cyborg.png` | CYBERNETIC | 🦾 |
| `satellite.png` | DRONE | 🛰️ |
| `helm.png` | VOYAGER | 🪐 |
| `ace.png` | ACE | ⭐ |

**Sizing:** square, 256×256 px or larger. Images are cropped to fill
(`object-fit: cover`), so keep the subject centered. PNG or JPG both work
if you keep the `.png` filename; transparent PNGs look great against the
dark cockpit panels.

**More slots:** append `{ id, emoji, label }` to the `AVATARS` array in
`src/ui/avatars.js` and drop the matching `<id>.png` here. If an image is
ever missing, the emoji fallback renders instead — the picker never breaks.

# Sounds

Real sound files ship here (16-bit WAV, synthesized in-house):

| file | plays on |
|---|---|
| `click.wav` | every correct keypress |
| `error.wav` | wrong keypress |
| `finish.wav` | test complete |
| `levelup.wav` | new personal best / signup |

To use your own sounds, replace any file keeping the same name — `js/sound.js`
picks them up automatically. If a file is missing or fails to load, Jango
falls back to a tiny Web Audio synth blip, so sound never breaks.

# Sound placeholders

Drop audio files here with these exact names and Jango picks them up
automatically (no code changes needed — see `js/sound.js`):

| file | plays on |
|---|---|
| `click.mp3` | every correct keypress |
| `error.mp3` | wrong keypress |
| `finish.mp3` | test complete |
| `levelup.mp3` | new personal best / signup |

Until the files exist, Jango synthesizes tiny fallback blips with the
Web Audio API, so the 🔊 toggle works out of the box.

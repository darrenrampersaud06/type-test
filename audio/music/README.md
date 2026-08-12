# Music — drop your own tracks here

Place MP3s with these exact names; no code changes needed
(`src/audio/musicManager.js` finds them automatically):

| file | plays during |
|---|---|
| `menu.mp3` | landing / mission config / profile |
| `gameplay.mp3` | active missions |
| `results.mp3` | mission complete |
| `record.mp3` | personal-record stinger (plays once) |

Transitions crossfade automatically (~1.4s). Any missing file falls back
to the built-in generative ambient pad, so music never breaks. Use music
you own or that is licensed for your use.

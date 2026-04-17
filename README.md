# Desk Companion

A cute AI-powered desktop companion that sits on your screen, reacts to what you're doing, and keeps you company while you work.

## Setup

```bash
# Install dependencies
npm install

# Run in development mode (opens devtools)
npm run dev

# Run normally
npm start
```

## Project structure

```
companion-app/
├── main.js          # Electron main process — window, IPC, Claude API
├── preload.js       # Secure bridge between main and renderer
├── package.json
└── renderer/
    ├── index.html   # Companion UI shell
    ├── style.css    # Transparent window styles
    └── companion.js # All companion logic — messages, mood, drag, idle
```

## How it works

- **Transparent window**: Frameless, always-on-top, sits over your desktop
- **Active window polling**: Every 10s checks what app you're using and reacts
- **Time awareness**: Greets you based on time of day, warns you if it's 2am
- **Idle detection**: Notices when you stop working and checks in
- **Drag to move**: Drag the character anywhere on screen
- **Click to talk**: Click the character for a message based on your current app

## Adding the Claude vision feature (paid tier)

The `ask-claude` IPC handler in `main.js` is ready to go.
You just need to add a screen region selector in the renderer:

1. On click-and-drag, capture a screen region using Electron's `desktopCapturer`
2. Send the base64 image to `window.companion.askClaude({ imageBase64, context })`
3. Display the response in the bubble

Set your Anthropic API key as an environment variable:
```bash
export ANTHROPIC_API_KEY=your_key_here
npm start
```

## Customising the character

The character is an SVG in `renderer/index.html`. All key elements have IDs:
- `c-skin`, `c-hair`, `c-hair-l`, `c-hair-r` — skin and hair
- `c-shirt` — shirt colour
- `c-mouth`, `brow-l`, `brow-r` — expression (controlled by `setMood()` in companion.js)

Replace the SVG with your own Procreate art by exporting as SVG or PNG.
For PNG, swap the `<svg>` for `<img src="character.png" />` and animate with CSS.

## Adding more app reactions

In `companion.js`, add entries to the `messages.apps` object:

```js
'Figma': ["making something beautiful?", "design brain activated."],
'Terminal': ["oh we're getting technical.", "command line. respect."],
```

App names must match exactly what the OS reports. Run with `--dev` flag and
check the console to see what `getActiveWindow()` returns for each app.

## Monetisation plan

**Free tier:**
- Companion on screen
- Time + app awareness
- All personality messages
- Basic customisation

**Paid tier (~€7/month):**
- Click-to-ask AI vision feature (powered by Claude)
- More character customisation options
- Custom message themes / personalities
- Seasonal outfits and accessories

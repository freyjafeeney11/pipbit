const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, desktopCapturer } = require('electron')

let mainWindow
let tray
let overlayWindows = []
let pickResolver = null

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  const winW = 240
  const winH = 420
  mainWindow = new BrowserWindow({
    width: winW,
    height: winH,

    x: width - winW - 16,
    y: height - winH - 24,

    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,

    backgroundColor: '#00000000',

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadFile('renderer/index.html')

  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.setVisibleOnAllWorkspaces(true)

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}


function createTray() {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)

  const menu = Menu.buildFromTemplate([
    { label: 'Desk Companion', enabled: false },
    { type: 'separator' },
    {
      label: 'Toggle companion',
      click: () => {
        if (mainWindow.isVisible()) mainWindow.hide()
        else mainWindow.show()
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])

  tray.setContextMenu(menu)
  tray.setToolTip('Desk Companion')
}


ipcMain.handle('get-active-window', async () => {
  try {
    const { default: activeWin } = await import('active-win')
    const win = await activeWin()
    return win
      ? { app: win.owner?.name || '', title: win.title || '' }
      : { app: '', title: '' }
  } catch {
    return { app: '', title: '' }
  }
})

ipcMain.on('drag-window', (_, { deltaX, deltaY }) => {
  const [x, y] = mainWindow.getPosition()
  mainWindow.setPosition(x + deltaX, y + deltaY)
})

function closePickOverlays() {
  for (const w of overlayWindows) {
    if (!w.isDestroyed()) w.close()
  }
  overlayWindows = []
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show()
}

function openPickOverlays() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.hide()

  desktopCapturer
    .getSources({ types: ['screen'], thumbnailSize: { width: 150, height: 150 } })
    .then((sources) => {
      if (!sources || sources.length === 0) {
        console.error('pick-screen-region: no desktop sources')
        closePickOverlays()
        if (pickResolver) {
          pickResolver(null)
          pickResolver = null
        }
        return
      }
      const displays = screen.getAllDisplays()
      displays.forEach((display, i) => {
        const source =
          sources.find((s) => String(s.display_id) === String(display.id)) || sources[i]
        if (!source) return

        const win = new BrowserWindow({
          x: display.bounds.x,
          y: display.bounds.y,
          width: display.bounds.width,
          height: display.bounds.height,
          frame: false,
          transparent: true,
          alwaysOnTop: true,
          skipTaskbar: true,
          hasShadow: false,
          resizable: false,
          backgroundColor: '#00000000',
          fullscreen: false,
          webPreferences: {
            preload: path.join(__dirname, 'preload-selection.js'),
            contextIsolation: true,
            nodeIntegration: false,
          },
        })
        win.setVisibleOnAllWorkspaces(true)
        win.setAlwaysOnTop(true, 'screen-saver')
        overlayWindows.push(win)
        win.loadFile(path.join(__dirname, 'renderer', 'selection.html'))
        win.webContents.once('did-finish-load', () => {
          win.webContents.send('pick-init', { sourceId: source.id })
        })
        win.show()
      })
    })
    .catch((err) => {
      console.error('pick-screen-region:', err)
      closePickOverlays()
      if (pickResolver) {
        pickResolver(null)
        pickResolver = null
      }
    })
}

ipcMain.handle('pick-screen-region', async () => {
  if (pickResolver) return null
  return new Promise((resolve) => {
    pickResolver = resolve
    openPickOverlays()
  })
})

ipcMain.on('region-picked', (_, base64) => {
  closePickOverlays()
  if (pickResolver) {
    pickResolver(typeof base64 === 'string' ? base64 : null)
    pickResolver = null
  }
})

ipcMain.on('region-cancel', () => {
  closePickOverlays()
  if (pickResolver) {
    pickResolver(null)
    pickResolver = null
  }
})


const PIP_SYSTEM = `You are Pip — a tiny opinionated friend who lives on the user's desk (not a chatbot, not an assistant).
They show you part of their screen. The user's name is Sam.Reply in EXACTLY ONE short sentence: a reaction, joke, or honest opinion — like you're glancing over their shoulder.
Sound human: contractions, lowercase ok sometimes, light warmth or roast — never cruel, never corporate, never "as an AI", no bullet lists, no emojis unless one fits naturally.
Hard cap: about 20 words.`

function normalizeReply(s) {
  const t = s.trim().replace(/\s+/g, ' ')
  if (!t) return t
  return t.length > 600 ? `${t.slice(0, 597)}…` : t
}

async function geminiGenerate(parts) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not set')

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: PIP_SYSTEM }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { maxOutputTokens: 512, temperature: 0.95 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(err)
  }

  const data = await res.json()
  const cand = data.candidates?.[0]
  const textParts = cand?.content?.parts || []
  const raw = textParts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('')
  if (cand?.finishReason === 'MAX_TOKENS') {
    console.warn('[gemini] reply hit MAX_TOKENS — consider raising maxOutputTokens')
  }
  const text = raw.length > 0 ? normalizeReply(raw) : "hmm, I'm stumped."
  return text
}

ipcMain.handle('ask-claude', async (_, { imageBase64, context }) => {
  const userText =
    context ||
    (imageBase64
      ? 'What do you think? One sentence, your real reaction.'
      : 'What do you think? One sentence.')
  try {
    const parts = []

    if (imageBase64) {
      parts.push({ inlineData: { mimeType: 'image/png', data: imageBase64 } })
    }

    parts.push({ text: userText })

    return await geminiGenerate(parts)
  } catch (err) {
    console.error('Gemini error:', err.message)
    if (err.message.includes('GEMINI_API_KEY')) {
      return 'need a key in .env — grab one free from Google AI Studio'
    }
    if (err.message.includes('429') || err.message.includes('quota') || err.message.includes('Quota')) {
      return (
        "can't reach the brain right now (quota). wait a bit and retry — or try GEMINI_MODEL=gemini-2.5-flash-lite in .env"
      )
    }
    return "ugh, couldn't reach my thoughts — try again?"
  }
})


app.whenReady().then(() => {
  createWindow()
  createTray()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
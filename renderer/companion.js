;(function () {
  'use strict'


  const bridge = window.companion
  const pipRoot = document.getElementById('pip-root')
  const bubbleEl = document.getElementById('bubble')
  const bubbleText = document.getElementById('bubble-text')

  const AMBIENT_MIN_GAP_MS = 4 * 60 * 1000
  const PAUSE_AFTER_SCREENSHOT_FLOW_MS = 7 * 60 * 1000
  const PAUSE_AFTER_AI_REPLY_MS = 5 * 60 * 1000
  const APP_SWITCH_COOLDOWN_MS = 15 * 60 * 1000

  const state = {
    mood: 'happy',
    lastApp: '',
    idleSeconds: 0,
    bubbleVisible: false,
    bubbleTimer: null,
    ambientPausedUntil: 0,
    lastAmbientAt: 0,
    lastAppSwitchBubbleAt: 0,
  }

  function pauseAmbient(ms) {
    const u = Date.now() + ms
    if (u > state.ambientPausedUntil) state.ambientPausedUntil = u
  }

  function ambientAllowed() {
    if (Date.now() < state.ambientPausedUntil) return false
    if (Date.now() - state.lastAmbientAt < AMBIENT_MIN_GAP_MS) return false
    return true
  }

  function ambientBubble(text, durationMs, tag) {
    if (!ambientAllowed()) {
      console.log('[pip] skip ambient', tag || '')
      return false
    }
    state.lastAmbientAt = Date.now()
    bubbleShow(text, durationMs, tag)
    return true
  }

  const messages = {
    time: {
      earlyMorning:  ["you're up early. respect.", "5am? are you ok?", "the birds aren't even awake yet."],
      morning:       ['good morning! big plans today?', 'coffee first, everything else second.', 'ready when you are.'],
      afternoon:     ["still going strong?", "don't forget to eat something.", "how's the focus holding up?"],
      lateAfternoon: ['nearly there. finish strong.', 'the end of the day is in sight.', "5pm soon. what's the priority?"],
      evening:       ['wrapping up or just getting started?', 'evenings are underrated for deep work.', 'hope today was good.'],
      lateNight:     ["it's getting late...", 'we doing the late night thing again?', "don't blame me if you're cranky tomorrow."],
      veryLate:      ['ok seriously. bed?', "it's tomorrow already.", 'are you going to keep both of us up?'],
    },
    apps: {
      'Google Chrome':  ['tabs... so many tabs.', 'how many tabs is too many? asking for a friend.', 'are you actually working or just researching procrastination?'],
      Firefox:        ['firefox! good taste.', 'let me guess, 30+ tabs?'],
      Safari:         ['safari user. classy.', 'apple ecosystem. i respect the commitment.'],
      'Visual Studio Code': ["let's build something.", "code time. i'll be quiet.", 'ooh what are we making?'],
      Cursor:             ['ai-assisted coding. very 2024 of you.', "let's ship something."],
      Xcode:              ['swift or objc? dont answer that.', 'building for apple? respect.'],
      Figma:         ['design mode!!.', 'making something pretty?', 'i love a good design session.'],
      Procreate:     ["oh we're drawing? i love drawing.", 'making something for the shop?'],
      Slack:         ['slack...', 'are you actually going to respond to that?', 'i saw that notification. you saw that notification.'],
      Discord:       ['discord? 5 minute break or actual work?', "don't let discord eat your afternoon."],
      Mail:          ["emails. everyone's favourite.", 'reply or archive. those are the only two options.', "i wouldn't start that email like that if i were you."],
      Spotify:       ['good soundtrack choice.', 'music makes everything better.', 'what are we listening to?'],
      YouTube:       ['youtube... is this research or a rabbit hole?', '5 minute break or 2 hour documentary?'],
      Netflix:       ['ok we are definitely not working.', 'deserved. carry on.', 'no judgement. well. a little.'],
      Notion:        ['notion! are we actually using it or just reorganising it?', 'love a good notion session.', 'planning mode. i like it.'],
      Obsidian:      ['deep work mode. i respect it.', 'knowledge graph enthusiast.', 'writing things down. the most underrated skill.'],
    },
    idle: {
      short:  ['what was i doing..?', 'hi', '...'],
      medium: ["im working on my novel...", "i'm still here if you need me.", 'hey hey click me'],
      long:   ["what time is it..?", "we've been at this for awhile.", 'time for a break for you?'],
    },
    general: [
      'be careful of this bluelight..',
      "im more productive than you",
      'hey alexa fart',
      "you got this!",
      'im scared of emails too.',
      'i forgot to brush my teeth last night...',
      "did you eat lunch?",
      'wake me up when were done.',
    ],
  }

  function getTimeSlot() {
    const h = new Date().getHours()
    if (h >= 4 && h < 7) return 'earlyMorning'
    if (h >= 7 && h < 12) return 'morning'
    if (h >= 12 && h < 15) return 'afternoon'
    if (h >= 15 && h < 18) return 'lateAfternoon'
    if (h >= 18 && h < 22) return 'evening'
    if (h >= 22 || h === 0) return 'lateNight'
    if (h >= 1 && h < 4) return 'veryLate'
    return 'veryLate'
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
  }

  function pickMessage(activeApp) {
    if (activeApp && messages.apps[activeApp] && Math.random() < 0.7) {
      return pickRandom(messages.apps[activeApp])
    }
    if (Math.random() < 0.3) {
      return pickRandom(messages.time[getTimeSlot()])
    }
    return pickRandom(messages.general)
  }

  function bubbleShow(text, durationMs, tag) {
    const ms = durationMs ?? 5000
    console.log('[pip]', tag || 'bubble', text)

    if (!bubbleEl || !bubbleText) {
      console.error('[pip] missing bubble DOM')
      return
    }

    bubbleText.textContent = text
    bubbleEl.classList.remove('hidden')
    bubbleEl.classList.remove('bubble-anim')
    void bubbleEl.offsetWidth
    bubbleEl.classList.add('bubble-anim')
    state.bubbleVisible = true

    clearTimeout(state.bubbleTimer)
    state.bubbleTimer = setTimeout(hideBubble, ms)
  }

  function hideBubble() {
    if (bubbleEl) bubbleEl.classList.add('hidden')
    state.bubbleVisible = false
  }

  function setMood(mood) {
    const mouth = document.getElementById('c-mouth')
    const browL = document.getElementById('brow-l')
    const browR = document.getElementById('brow-r')
    if (!mouth || !browL || !browR) return

    switch (mood) {
      case 'happy':
        mouth.setAttribute('d', 'M74 90 Q80 97 86 90')
        browL.setAttribute('x1', '68'); browL.setAttribute('y1', '71')
        browL.setAttribute('x2', '78'); browL.setAttribute('y2', '72')
        browR.setAttribute('x1', '83'); browR.setAttribute('y1', '72')
        browR.setAttribute('x2', '93'); browR.setAttribute('y2', '71')
        break
      case 'tired':
        mouth.setAttribute('d', 'M74 91 Q80 93 86 91')
        browL.setAttribute('x1', '68'); browL.setAttribute('y1', '73')
        browL.setAttribute('x2', '78'); browL.setAttribute('y2', '71')
        browR.setAttribute('x1', '83'); browR.setAttribute('y1', '71')
        browR.setAttribute('x2', '93'); browR.setAttribute('y2', '73')
        break
      case 'focused':
        mouth.setAttribute('d', 'M74 91 Q80 91 86 91')
        browL.setAttribute('x1', '68'); browL.setAttribute('y1', '72')
        browL.setAttribute('x2', '78'); browL.setAttribute('y2', '70')
        browR.setAttribute('x1', '83'); browR.setAttribute('y1', '70')
        browR.setAttribute('x2', '93'); browR.setAttribute('y2', '72')
        break
      case 'sassy':
        mouth.setAttribute('d', 'M74 92 Q80 90 86 92')
        browL.setAttribute('x1', '68'); browL.setAttribute('y1', '69')
        browL.setAttribute('x2', '78'); browL.setAttribute('y2', '72')
        browR.setAttribute('x1', '83'); browR.setAttribute('y1', '72')
        browR.setAttribute('x2', '93'); browR.setAttribute('y2', '70')
        break
      default:
        break
    }
    state.mood = mood
  }

  async function activeWin() {
    if (!bridge || typeof bridge.getActiveWindow !== 'function') {
      console.error('[pip] preload API missing — run with Electron (npm start)')
      return { app: '', title: '' }
    }
    return bridge.getActiveWindow()
  }

  async function onTapWidget() {
    if (!bridge || typeof bridge.pickScreenRegion !== 'function') {
      bubbleShow('Screen pick needs a current build of the app.', 5000, 'tap')
      return
    }
    pauseAmbient(PAUSE_AFTER_SCREENSHOT_FLOW_MS)
    bubbleShow('drag a box around whatever — I’ll peek. Esc to chicken out.', 6000, 'pick')
    let base64
    try {
      base64 = await bridge.pickScreenRegion()
    } catch (err) {
      console.error('[pip] pickScreenRegion', err)
      bubbleShow('Screen pick failed.', 4000, 'pick')
      return
    }
    if (!base64) {
      bubbleShow('Cancelled.', 2500, 'pick')
      return
    }
    const waitLines = [
      'ok one sec...',
      'ok what am I looking at…',
      'im looking…',
      'what did u just send me…',
      'im looking up…',
    ]
    bubbleShow(waitLines[Math.floor(Math.random() * waitLines.length)], 180000, 'ai-wait')
    try {
      const text = await bridge.askAi({
        imageBase64: base64,
        context: 'Screenshot attached — one sentence, your gut reaction as Pip.',
      })
      pauseAmbient(PAUSE_AFTER_AI_REPLY_MS)
      bubbleShow(text, 55000, 'ai-reply')
    } catch (err) {
      console.error('[pip] askAi', err)
      bubbleShow("couldn't hear myself think — key ok?", 8000, 'ai-err')
    }
  }

  const DRAG_PX = 8
  let dragSession = null

  function onDocMouseMove(e) {
    if (!dragSession) return
    const dx = e.screenX - dragSession.x0
    const dy = e.screenY - dragSession.y0
    if (!dragSession.dragging && dx * dx + dy * dy >= DRAG_PX * DRAG_PX) {
      dragSession.dragging = true
    }
    if (!dragSession.dragging || !bridge) return
    const deltaX = e.screenX - dragSession.lastX
    const deltaY = e.screenY - dragSession.lastY
    dragSession.lastX = e.screenX
    dragSession.lastY = e.screenY
    bridge.dragWindow({ deltaX, deltaY })
  }

  function onDocMouseUp(e) {
    document.removeEventListener('mousemove', onDocMouseMove)
    document.removeEventListener('mouseup', onDocMouseUp)
    if (!dragSession) return
    const wasDragging = dragSession.dragging
    dragSession = null
    if (e.button !== 0) return
    if (!wasDragging) void onTapWidget()
  }

  if (pipRoot) {
    pipRoot.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return
      dragSession = {
        x0: e.screenX,
        y0: e.screenY,
        lastX: e.screenX,
        lastY: e.screenY,
        dragging: false,
      }
      document.addEventListener('mousemove', onDocMouseMove)
      document.addEventListener('mouseup', onDocMouseUp)
    })
  }

  if (bubbleEl) {
    bubbleEl.addEventListener('click', hideBubble)
  }

  async function checkActiveWindow() {
    const win = await activeWin()
    const appName = win?.app || ''
    if (appName && appName !== state.lastApp) {
      state.lastApp = appName
      if (['Netflix', 'YouTube', 'Spotify'].includes(appName)) setMood('happy')
      else if (['Visual Studio Code', 'Cursor', 'Xcode'].includes(appName)) setMood('focused')
      else if (['Slack', 'Mail'].includes(appName)) setMood('sassy')
      else if (getTimeSlot() === 'veryLate' || getTimeSlot() === 'lateNight') setMood('tired')
      else setMood('happy')
      setTimeout(() => {
        if (Date.now() - state.lastAppSwitchBubbleAt < APP_SWITCH_COOLDOWN_MS) return
        if (Math.random() > 0.35) return
        if (!ambientBubble(pickMessage(appName), 9000, 'app-switch')) return
        state.lastAppSwitchBubbleAt = Date.now()
      }, 2500)
    }
  }

  document.addEventListener('mousemove', () => {
    state.idleSeconds = 0
  })
  document.addEventListener('keydown', () => {
    state.idleSeconds = 0
  })

  function checkIdle() {
    state.idleSeconds += 20
    if (state.idleSeconds === 240) ambientBubble(pickRandom(messages.idle.short), 5000, 'idle')
    else if (state.idleSeconds === 900) {
      ambientBubble(pickRandom(messages.idle.medium), 7000, 'idle')
      setMood('tired')
    } else if (state.idleSeconds === 2400) {
      ambientBubble(pickRandom(messages.idle.long), 8000, 'idle')
    }
  }

  function proactiveCheck() {
    const h = new Date().getHours()
    const m = new Date().getMinutes()
    if (h === 23 && m === 0) {
      ambientBubble("it's 11pm... are we doing this again?", 9000, 'late')
      setMood('tired')
    }
    if (h === 2 && m === 0) {
      ambientBubble("ok it's 2am. are you going to keep both of us up?", 9000, 'late')
      setMood('tired')
    }
  }

  function init() {
    console.log('[pip] init', {
      hasBridge: !!(bridge && bridge.getActiveWindow),
      pipRoot: !!pipRoot,
      bubble: !!bubbleEl,
    })

    const greeting = pickRandom(messages.time[getTimeSlot()])
    setTimeout(() => ambientBubble(greeting, 9000, 'startup'), 5000)

    setInterval(checkActiveWindow, 45000)
    setInterval(checkIdle, 20000)
    setInterval(proactiveCheck, 60 * 1000)

    if (getTimeSlot() === 'veryLate' || getTimeSlot() === 'lateNight') setMood('tired')
    else setMood('happy')
  }

  init()
})()

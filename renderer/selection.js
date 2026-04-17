;(function () {
  'use strict'

  const box = document.getElementById('box')
  const hint = document.getElementById('hint')

  let sourceId = null
  let start = null

  function showBox(x0, y0, x1, y1) {
    const x = Math.min(x0, x1)
    const y = Math.min(y0, y1)
    const w = Math.abs(x1 - x0)
    const h = Math.abs(y1 - y0)
    if (w < 2 || h < 2) {
      box.style.display = 'none'
      return
    }
    box.style.display = 'block'
    box.style.left = `${x}px`
    box.style.top = `${y}px`
    box.style.width = `${w}px`
    box.style.height = `${h}px`
  }

  async function captureRegion(clientRect) {
    const w = Math.max(2, Math.round(clientRect.w))
    const h = Math.max(2, Math.round(clientRect.h))

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
        },
      },
    })

    const video = document.createElement('video')
    video.srcObject = stream
    video.muted = true
    await video.play()

    await new Promise((resolve) => {
      if (video.readyState >= 2) resolve()
      else video.onloadeddata = resolve
    })

    const vw = video.videoWidth
    const vh = video.videoHeight
    const sx = window.innerWidth
    const sy = window.innerHeight
    const scaleX = vw / sx
    const scaleY = vh / sy

    const x = Math.round(clientRect.x * scaleX)
    const y = Math.round(clientRect.y * scaleY)
    const cw = Math.round(w * scaleX)
    const ch = Math.round(h * scaleY)

    const full = document.createElement('canvas')
    full.width = vw
    full.height = vh
    full.getContext('2d').drawImage(video, 0, 0)

    stream.getTracks().forEach((t) => t.stop())

    const crop = document.createElement('canvas')
    crop.width = cw
    crop.height = ch
    const cx = Math.max(0, Math.min(x, vw - 1))
    const cy = Math.max(0, Math.min(y, vh - 1))
    const cw2 = Math.min(cw, vw - cx)
    const ch2 = Math.min(ch, vh - cy)
    crop.width = cw2
    crop.height = ch2
    crop.getContext('2d').drawImage(full, cx, cy, cw2, ch2, 0, 0, cw2, ch2)

    const dataUrl = crop.toDataURL('image/png')
    return dataUrl.replace(/^data:image\/\w+;base64,/, '')
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.pickRegion.cancel()
    }
  })

  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    start = { x: e.clientX, y: e.clientY }
  })

  window.addEventListener('mousemove', (e) => {
    if (!start) return
    showBox(start.x, start.y, e.clientX, e.clientY)
  })

  window.addEventListener('mouseup', async (e) => {
    if (e.button !== 0 || !start) return
    const x0 = start.x
    const y0 = start.y
    const x1 = e.clientX
    const y1 = e.clientY
    start = null

    const rect = {
      x: Math.min(x0, x1),
      y: Math.min(y0, y1),
      w: Math.abs(x1 - x0),
      h: Math.abs(y1 - y0),
    }

    if (rect.w < 8 || rect.h < 8) {
      hint.textContent = 'Selection too small — try again or press Esc'
      box.style.display = 'none'
      return
    }

    hint.textContent = 'Capturing…'
    try {
      const base64 = await captureRegion(rect)
      window.pickRegion.done(base64)
    } catch (err) {
      console.error('[selection]', err)
      hint.textContent = 'Could not capture — Esc to cancel'
      box.style.display = 'none'
    }
  })

  window.pickRegion.onInit((data) => {
    sourceId = data.sourceId
    if (!sourceId) {
      hint.textContent = 'No screen source — Esc to cancel'
    }
  })
})()

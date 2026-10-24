#!/usr/bin/env bash
set -euo pipefail

: "${CAPTURE_URL:?CAPTURE_URL is required}"
: "${CAPTURE_DIR:?CAPTURE_DIR is required}"
: "${RUNTIME_DIR:?RUNTIME_DIR is required}"

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_dir"

if [[ "$(uname -s)" == "Linux" && -z "${DISPLAY:-}" ]]; then
  display_file="$HOME/.local/share/omgithub-playwright/display"
  if [[ -f "$display_file" ]]; then
    display_value="$(cat "$display_file")"
    export DISPLAY=":$display_value"
  fi
fi

run() {
  local label="$1"
  shift
  echo "[capture] $label"
  /usr/bin/time -p "$@"
}

run "prepare capture directory" mkdir -p "$CAPTURE_DIR"
capture_dir="$(cd "$CAPTURE_DIR" && pwd)"
export CAPTURE_DIR="$capture_dir"

run "capture desktop and mobile views" node --input-type=module <<'NODE'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir, platform } from 'node:os'

class CaptureError extends Error {
  constructor(message, exitCode = 1, cause) {
    super(message, { cause })
    this.exitCode = exitCode
  }
}

const output = process.env.CAPTURE_DIR
const url = process.env.CAPTURE_URL
const runtime = join(homedir(), '.local/share/omgithub-playwright')
const require = createRequire(join(runtime, 'package.json'))
const { chromium } = require('playwright')
const config = JSON.parse(readFileSync(join(runtime, platform() === 'darwin' ? 'metal.json' : 'linux.json'), 'utf8'))

if (platform() === 'linux') {
  process.env.DISPLAY ||= ':' + readFileSync(join(runtime, 'display'), 'utf8').trim()
}

const transient = (error, label) => new CaptureError(
  `${label}: ${error?.message || error}`,
  75,
  error
)

async function timed(label, action) {
  const started = Date.now()
  try {
    const value = await action()
    console.log(`[capture] ${label}: ${Date.now() - started}ms`)
    return value
  } catch (error) {
    console.error(`[capture] ${label}: ${Date.now() - started}ms (failed)`)
    throw error
  }
}

function logPageFailure(name, page) {
  page.on('pageerror', error => console.error(`[capture] ${name} page error: ${error.message}`))
  page.on('console', message => {
    if (message.type() === 'error') console.error(`[capture] ${name} console error: ${message.text()}`)
  })
}

async function waitForApp(page, name) {
  try {
    await page.locator('#start').waitFor({ state: 'visible', timeout: 20000 })
    await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 20000 })
    await page.waitForFunction(() => {
      const canvas = document.querySelector('#scene')
      return Boolean(canvas && canvas.width >= innerWidth && canvas.height >= innerHeight)
    }, null, { timeout: 20000 })
  } catch (error) {
    throw new CaptureError(`App did not become ready in ${name} view: ${error.message}`, 1, error)
  }
}

async function startExperience(page) {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    const clicked = await page.evaluate(() => {
      const button = document.getElementById('start')
      if (!button) return false
      button.click()
      return true
    })
    if (!clicked) throw new CaptureError('Start control is missing', 1)
    const started = await page.waitForFunction(
      () => document.body.classList.contains('started'),
      null,
      { timeout: 1500 }
    ).then(() => true).catch(() => false)
    if (started) return 'dom'
    await page.waitForTimeout(250)
  }
  throw new CaptureError('Start did not enter the experience', 1)
}

async function waitForReveal(page, name) {
  try {
    await page.waitForFunction(() => document.body.classList.contains('started'), null, { timeout: 5000 })
    await page.waitForFunction(
      () => document.getElementById('intro')?.classList.contains('hidden'),
      null,
      { timeout: 5000 }
    )
    await page.waitForTimeout(1500)
  } catch (error) {
    throw new CaptureError(`Start did not reveal the ${name} scene: ${error.message}`, 1, error)
  }
}

async function validateRender(page, name) {
  const state = await page.evaluate(() => {
    const canvas = document.querySelector('#scene')
    const intro = document.getElementById('intro')
    return {
      started: document.body.classList.contains('started'),
      introHidden: Boolean(intro?.classList.contains('hidden')),
      mirrors: document.querySelectorAll('.reflect-nav button').length,
      brand: document.querySelector('.brand-name')?.textContent?.trim() || '',
      canvasWidth: canvas?.width || 0,
      canvasHeight: canvas?.height || 0,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight
    }
  })
  const valid = state.started &&
    state.introHidden &&
    state.mirrors === 7 &&
    /^reflections$/i.test(state.brand) &&
    state.canvasWidth >= state.viewportWidth &&
    state.canvasHeight >= state.viewportHeight
  if (!valid) throw new CaptureError(`Unexpected ${name} render state: ${JSON.stringify(state)}`, 1)
  return state
}

let browser
let exitCode = 0
const views = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844 }
]

try {
  browser = await timed('launch browser', () =>
    chromium.launch({ ...config.browser.launchOptions, timeout: 30000 }).catch(error => {
      throw transient(error, 'launch browser')
    })
  )

  for (const view of views) {
    const page = await timed(`open ${view.name} page`, () =>
      browser.newPage({
        viewport: { width: view.width, height: view.height },
        deviceScaleFactor: 1
      }).catch(error => {
        throw transient(error, `open ${view.name} page`)
      })
    )
    page.setDefaultTimeout(30000)
    logPageFailure(view.name, page)

    const response = await timed(`navigate ${view.name}`, () =>
      page.goto(url, { waitUntil: 'load', timeout: 60000 }).catch(error => {
        throw transient(error, `navigate ${view.name}`)
      })
    )
    if (!response) throw transient(new Error('no navigation response'), `navigate ${view.name}`)
    if (!response.ok()) {
      const status = response.status()
      const temporary = status === 408 || status === 429 || status >= 500
      throw new CaptureError(`HTTP ${status} loading preview in ${view.name} view`, temporary ? 75 : 1)
    }

    await timed(`wait for app ${view.name}`, () => waitForApp(page, view.name))
    const startMode = await timed(`start ${view.name}`, () => startExperience(page))
    console.log(`[capture] ${view.name} auto-start: ${startMode}`)
    await timed(`wait for reveal ${view.name}`, () => waitForReveal(page, view.name))

    const state = await timed(`validate ${view.name}`, () => validateRender(page, view.name))
    console.log(`[capture] ${view.name} viewport ${state.viewportWidth}x${state.viewportHeight}, canvas ${state.canvasWidth}x${state.canvasHeight}`)

    await timed(`settle reflections ${view.name}`, () => page.waitForTimeout(7500))

    const screenshotPath = join(output, `final-${view.name}.png`)
    await timed(`screenshot ${view.name}`, () =>
      page.screenshot({ path: screenshotPath, timeout: 30000 }).catch(error => {
        throw transient(error, `screenshot ${view.name}`)
      })
    )
    const image = readFileSync(screenshotPath)
    if (image.length < 24 || image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      throw new CaptureError(`Capture did not produce a valid PNG: ${screenshotPath}`, 1)
    }
    console.log(`[capture] wrote ${screenshotPath} (${image.length} bytes)`)

    await timed(`close ${view.name} page`, () => page.close()).catch(error => {
      console.error(`[capture] could not close ${view.name} page: ${error.message}`)
    })
  }
} catch (error) {
  console.error(`[capture] ${error.message}`)
  if (error.cause) console.error(error.cause)
  exitCode = error.exitCode || 1
} finally {
  if (browser) {
    try {
      await timed('close browser', () => browser.close())
    } catch (error) {
      console.error(`[capture] could not close browser: ${error.message}`)
      if (!exitCode) exitCode = 75
    }
  }
}

process.exit(exitCode)
NODE

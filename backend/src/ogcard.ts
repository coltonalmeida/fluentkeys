import { Resvg } from '@resvg/resvg-js'
import { fileURLToPath } from 'url'

// Open Graph result card (§1). Hand-built SVG → PNG via resvg, using the bundled
// Nunito font. Variable-font default instance renders fine in resvg. The asset
// lives at backend/assets and is reached via ../assets from both src and dist.
const FONT_PATH = fileURLToPath(new URL('../assets/nunito.ttf', import.meta.url))

const WIDTH = 1200
const HEIGHT = 630

export interface CardData {
  wpm: number
  accuracy: number
  /** e.g. "all · medium · 30s" */
  detail: string
  username: string
}

/** Escape text for safe interpolation into the SVG. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderCardPng(data: CardData): Buffer {
  const wpm = Math.round(data.wpm)
  const acc = data.accuracy.toFixed(1)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="#18181b"/>
    <rect x="0" y="0" width="${WIDTH}" height="12" fill="#34d399"/>
    <text x="80" y="120" font-family="Nunito" font-weight="800" font-size="44" fill="#34d399">FluentKeys</text>
    <text x="80" y="170" font-family="Nunito" font-weight="600" font-size="28" fill="#a1a1aa">${esc(data.detail)}</text>

    <text x="80" y="400" font-family="Nunito" font-weight="800" font-size="240" fill="#f4f4f5">${wpm}</text>
    <text x="80" y="470" font-family="Nunito" font-weight="700" font-size="48" fill="#34d399">WPM</text>

    <text x="700" y="400" font-family="Nunito" font-weight="800" font-size="120" fill="#f4f4f5">${acc}%</text>
    <text x="700" y="455" font-family="Nunito" font-weight="700" font-size="40" fill="#a1a1aa">accuracy</text>

    <text x="80" y="575" font-family="Nunito" font-weight="700" font-size="40" fill="#f4f4f5">@${esc(data.username)}</text>
  </svg>`

  const resvg = new Resvg(svg, {
    font: { fontFiles: [FONT_PATH], defaultFontFamily: 'Nunito', loadSystemFonts: false },
    fitTo: { mode: 'width', value: WIDTH },
  })
  return Buffer.from(resvg.render().asPng())
}

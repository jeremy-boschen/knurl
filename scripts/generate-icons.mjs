import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const svgPath = join(process.cwd(), 'public', 'knurl.svg')
const svg = await fs.readFile(svgPath)

const targets = [
  { size: 32, file: '32x32.png' },
  { size: 128, file: '128x128.png' },
  { size: 256, file: '128x128@2x.png' },
  { size: 30, file: 'Square30x30Logo.png' },
  { size: 44, file: 'Square44x44Logo.png' },
  { size: 71, file: 'Square71x71Logo.png' },
  { size: 89, file: 'Square89x89Logo.png' },
  { size: 107, file: 'Square107x107Logo.png' },
  { size: 142, file: 'Square142x142Logo.png' },
  { size: 150, file: 'Square150x150Logo.png' },
  { size: 284, file: 'Square284x284Logo.png' },
  { size: 310, file: 'Square310x310Logo.png' },
  { size: 50, file: 'StoreLogo.png' },
  { size: 512, file: 'icon.png' },
]

const outDir = join(process.cwd(), 'src-tauri', 'icons')

for (const { size, file } of targets) {
  const r = new Resvg(svg, {
    background: 'rgba(0,0,0,0)',
    fitTo: { mode: 'width', value: size },
  })
  const png = r.render()
  const image = png.asPng()
  await fs.writeFile(join(outDir, file), image)
}

const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const icnsSizes = [16, 32, 64, 128, 256, 512]
const tmpDir = await fs.mkdtemp('/tmp/knurl-icon-')

const rasterSizes = [...new Set([...icoSizes, ...icnsSizes])]

for (const size of rasterSizes) {
  const r = new Resvg(svg, {
    background: 'rgba(0,0,0,0)',
    fitTo: { mode: 'width', value: size },
  })
  const png = r.render().asPng()
  await fs.writeFile(join(tmpDir, `icon-${size}.png`), png)
}

// build ICO via ImageMagick
const icoCmd = icoSizes.map((size) => join(tmpDir, `icon-${size}.png`)).join(' ')
await fs.writeFile(
  join(tmpDir, 'make-ico.sh'),
  `#!/usr/bin/env bash\nset -euo pipefail\nconvert ${icoCmd} ${join(outDir, 'icon.ico')}\n`,
  { mode: 0o755 },
)

const icnsCmd = icnsSizes.map((size) => join(tmpDir, `icon-${size}.png`)).join(' ')
await fs.writeFile(
  join(tmpDir, 'make-icns.sh'),
  `#!/usr/bin/env bash\nset -euo pipefail\npng2icns ${join(outDir, 'icon.icns')} ${icnsCmd}\n`,
  { mode: 0o755 },
)

await fs.chmod(join(tmpDir, 'make-ico.sh'), 0o755)
await fs.chmod(join(tmpDir, 'make-icns.sh'), 0o755)

const { exec } = await import('node:child_process')

const run = (cmd) => new Promise((resolve, reject) => {
  exec(cmd, { cwd: tmpDir }, (err, stdout, stderr) => {
    if (err) {
      reject(new Error(stderr || err.message))
    } else {
      resolve(stdout)
    }
  })
})

await run('./make-ico.sh')
await run('./make-icns.sh')

await fs.rm(tmpDir, { recursive: true, force: true })

console.log('Icons generated.')

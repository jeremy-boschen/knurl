import { promises as fs, existsSync } from 'node:fs'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'

// Check if a command is available in PATH
function commandExists(command) {
  try {
    if (process.platform === 'win32') {
      // On Windows, use 'where' to check command availability
      execSync(`where ${command}`, { stdio: 'pipe' })
    } else {
      // On Unix-like systems, use 'which'
      execSync(`which ${command}`, { stdio: 'pipe' })
    }
    return true
  } catch {
    return false
  }
}

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

// Check if tools are available for ICO/ICNS generation
const hasConvert = commandExists('convert')
const hasPng2icns = commandExists('png2icns')
const hasIcotools = process.platform === 'win32' ? commandExists('icotool') : false

// Generate ICO and ICNS only if tools are available
if (hasConvert || hasPng2icns || hasIcotools) {
  const tmpDir = await fs.mkdtemp(join(tmpdir(), 'knurl-icon-'))

  const rasterSizes = [...new Set([...icoSizes, ...icnsSizes])]

  for (const size of rasterSizes) {
    const r = new Resvg(svg, {
      background: 'rgba(0,0,0,0)',
      fitTo: { mode: 'width', value: size },
    })
    const png = r.render().asPng()
    await fs.writeFile(join(tmpDir, `icon-${size}.png`), png)
  }

  const { spawn } = await import('node:child_process')

  const run = (command, args = []) => new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' })
    child.on('error', (error) => {
      reject(error)
    })
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} exited with code ${code}`))
      }
    })
  })

  // Build ICO via ImageMagick or icotool
  if (hasConvert) {
    try {
      const icoFiles = icoSizes.map((size) => join(tmpDir, `icon-${size}.png`)).join(' ')
      await run('convert', [...icoSizes.map((size) => join(tmpDir, `icon-${size}.png`)), join(outDir, 'icon.ico')])
      console.log('✓ icon.ico generated')
    } catch (e) {
      console.warn('⚠ Failed to generate icon.ico:', e.message)
    }
  }

  // Build ICNS via png2icns
  if (hasPng2icns) {
    try {
      const icnsFiles = icnsSizes.map((size) => join(tmpDir, `icon-${size}.png`))
      await run('png2icns', [join(outDir, 'icon.icns'), ...icnsFiles])
      console.log('✓ icon.icns generated')
    } catch (e) {
      console.warn('⚠ Failed to generate icon.icns:', e.message)
    }
  }

  await fs.rm(tmpDir, { recursive: true, force: true })
} else {
  console.warn('⚠ Skipping ICO/ICNS generation - required tools not found:')
  console.warn('  - For ICO: install ImageMagick (convert command)')
  console.warn('  - For ICNS: install libicns (png2icns command)')
  console.warn('  On macOS: brew install imagemagick libicns')
  console.warn('  On Linux: sudo apt-get install imagemagick libicns-bin')
  console.warn('  On Windows: install via vcpkg or manually')
}

console.log('✓ PNG icons generated')

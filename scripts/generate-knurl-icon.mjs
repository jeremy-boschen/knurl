import {promises as fs} from 'node:fs'
import {join} from 'node:path'
import {execSync} from 'node:child_process'

const svgPath = join(process.cwd(), 'src-ui', 'src', 'assets', 'knurl.svg')
const componentPath = join(process.cwd(), 'src-ui', 'src', 'components', 'icons', 'knurl-icon.tsx')

// Read the SVG file
const svgContent = await fs.readFile(svgPath, 'utf-8')

// Extract just the SVG content (everything inside <svg> tags)
const svgMatch = svgContent.match(/<svg[^>]*>[\s\S]*<\/svg>/)
if (!svgMatch) {
  throw new Error(`Could not parse SVG from ${svgPath}`)
}

let svgBody = svgMatch[0]

// Convert SVG to React-compatible JSX
// 1. Convert style strings to React style objects
svgBody = svgBody.replace(/style="([^"]*)"/g, (match, styleStr) => {
  const styleObj = {}
  styleStr.split(';').forEach(pair => {
    const [prop, value] = pair.split(':').map(s => s.trim())
    if (prop && value) {
      // Convert kebab-case to camelCase
      const camelCaseProp = prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
      styleObj[camelCaseProp] = value
    }
  })
  return `style={${JSON.stringify(styleObj)}}`
})

// 2. Convert SVG attribute names from kebab-case to camelCase
svgBody = svgBody.replace(/([a-z])-([a-z])/g, (match, char1, char2) => {
  return char1 + char2.toUpperCase()
})

// 3. Add ref and props to the SVG element
svgBody = svgBody.replace(/<svg([^>]*)>/, '<svg$1 ref={ref} {...props}><title>KNURL</title>')

// Generate the component
const componentCode = `import type { SVGProps } from "react"
import { forwardRef } from "react"

const KnurlIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>((props, ref) => (
  ${svgBody.replace(/^\s+/gm, '  ')}
))
KnurlIcon.displayName = "KnurlIcon"
export { KnurlIcon }
`

// Write the component
await fs.writeFile(componentPath, componentCode)

// Format the generated file with Biome
try {
  execSync(`yarn biome format --write "${componentPath}"`, { stdio: 'pipe' })
} catch (error) {
  // Biome format errors are non-fatal; log but don't fail
  console.warn('⚠ Biome formatting had issues (non-fatal):', error.message)
}

console.log('✓ Generated KnurlIcon component from SVG')

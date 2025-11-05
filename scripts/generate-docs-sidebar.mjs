#!/usr/bin/env node

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, "..")
const MANUAL_CONTENT_DIR = path.join(PROJECT_ROOT, "docs/manual-content")
const DOCS_OUTPUT_DIR = path.join(PROJECT_ROOT, "documentation/src/content/docs")

/**
 * Generate documentation pages from manual content.
 *
 * This script reads markdown files from docs/manual-content/ and generates
 * MDX pages in documentation/src/content/docs/guides/ for the Astro site.
 *
 * Input: docs/manual-content/{category}/*.md
 * Output: documentation/src/content/docs/guides/{category}/*.mdx
 */

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)/)
  if (!match) return { metadata: {}, body: content }

  const metadata = {}
  const fmLines = match[1].split("\n")

  for (const line of fmLines) {
    const colonIndex = line.indexOf(":")
    if (colonIndex === -1) continue

    const key = line.substring(0, colonIndex).trim()
    let value = line.substring(colonIndex + 1).trim()

    // Parse YAML values
    if (value.startsWith("[") && value.endsWith("]")) {
      value = JSON.parse(value)
    } else if (value === "true" || value === "false") {
      value = value === "true"
    } else if (!isNaN(value)) {
      value = parseInt(value, 10)
    } else if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    }

    metadata[key] = value
  }

  return {
    metadata,
    body: match[2],
  }
}

/**
 * Generate MDX frontmatter for Astro
 */
function generateFrontmatter(metadata, category) {
  const fm = {
    title: metadata.title || "Untitled",
    description: metadata.description || "",
    sidebar: {
      parent: category.charAt(0).toUpperCase() + category.slice(1),
      order: metadata.order || 50,
    },
  }

  return fm
}

/**
 * Convert markdown to MDX (just copy content for now)
 */
function convertToMdx(body) {
  return body
}

async function generateDocsSidebar() {
  console.log("📚 Generating documentation from manual content...")

  try {
    // Clean up old docs
    const guidesDir = path.join(DOCS_OUTPUT_DIR, "guides")
    if (fs.existsSync(guidesDir)) {
      console.log("🧹 Cleaning up old documentation...")
      fs.rmSync(guidesDir, { recursive: true, force: true })
    }

    // Read all categories (in directory order, not alphabetical)
    const categories = fs
      .readdirSync(MANUAL_CONTENT_DIR)
      .filter((f) =>
        fs.statSync(path.join(MANUAL_CONTENT_DIR, f)).isDirectory()
      )
      .filter((f) => !f.startsWith("."))

    let totalGenerated = 0
    const sidebarStructure = {}

    for (const category of categories) {
      const categoryPath = path.join(MANUAL_CONTENT_DIR, category)
      // Strip numeric prefix (01-, 02-, etc) for display
      const cleanCategory = category.replace(/^\d+-/, "")
      const categoryLabel =
        cleanCategory === "getting-started"
          ? "Getting Started"
          : cleanCategory
              .split("-")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")

      sidebarStructure[categoryLabel] = {
        category,
        files: [],
      }

      const files = fs
        .readdirSync(categoryPath)
        .filter((f) => f.endsWith(".md"))
        .sort()

      for (const file of files) {
        const filePath = path.join(categoryPath, file)
        const content = fs.readFileSync(filePath, "utf-8")
        const { metadata, body } = parseFrontmatter(content)

        // Generate MDX
        const frontmatter = generateFrontmatter(metadata, category)
        const fm = Object.entries(frontmatter)
          .map(([key, value]) => {
            return `${key}: ${JSON.stringify(value)}`
          })
          .join("\n")

        const mdxContent = `---\n${fm}\n---\n\n${convertToMdx(body)}`

        // Write MDX file (preserve directory with numeric prefix for ordering)
        const outputCategoryDir = path.join(guidesDir, category)
        ensureDir(outputCategoryDir)

        const outputFile = path.join(
          outputCategoryDir,
          file.replace(".md", ".mdx")
        )
        fs.writeFileSync(outputFile, mdxContent)

        sidebarStructure[categoryLabel].files.push({
          title: metadata.title || "Untitled",
          slug: `guides/${category}/${file.replace(".md", "")}`,
          order: metadata.order || 50,
        })

        console.log(`  ✓ Generated ${categoryLabel} > ${metadata.title}`)
        totalGenerated++
      }
    }

    // Sort files within each category by order
    for (const category in sidebarStructure) {
      sidebarStructure[category].files.sort((a, b) => a.order - b.order)
    }

    console.log(`\n✅ Generated ${totalGenerated} documentation pages`)
    console.log(`   Location: ${guidesDir}`)

    process.exit(0)
  } catch (error) {
    console.error("❌ Failed to generate documentation:", error.message)
    process.exit(1)
  }
}

generateDocsSidebar()

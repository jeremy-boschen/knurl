import { defineConfig } from "astro/config"
import starlight from "@astrojs/starlight"
import { visit } from "unist-util-visit"
import fs from "fs"
import path from "path"

const prefixImageUrls = () => {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName === "img" && node.properties?.src) {
        const src = node.properties.src
        if (typeof src === "string" && src.startsWith("/screenshots/")) {
          node.properties.src = "/knurl/docs" + src
        }
      }
    })
  }
}

/**
 * Build sidebar items for documentation guides.
 * Reads from guides/ directory and groups by category.
 */
function buildGuidesSidebarItems() {
  const guidesDir = path.join(process.cwd(), "src/content/docs/guides")

  if (!fs.existsSync(guidesDir)) {
    return [] // No guides directory yet
  }

  const categories = fs
    .readdirSync(guidesDir)
    .filter((f) => fs.statSync(path.join(guidesDir, f)).isDirectory())
    // Don't sort - preserve directory order (numeric prefixes control order)

  return categories.map((category) => {
    const categoryDir = path.join(guidesDir, category)
    const files = fs
      .readdirSync(categoryDir)
      .filter((f) => f.endsWith(".mdx"))
      .map((f) => f.replace(".mdx", ""))
      .sort()

    // Strip numeric prefix (01-, 02-, etc) for display
    const cleanCategory = category.replace(/^\d+-/, "")
    // Format category name for display (convert kebab-case to Title Case)
    const categoryLabel =
      cleanCategory === "getting-started"
        ? "Getting Started"
        : cleanCategory
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ")

    return {
      label: categoryLabel,
      collapsed: category !== "getting-started", // Getting Started expanded by default
      items: files.map((file) => `guides/${category}/${file}`),
    }
  })
}

export default defineConfig({
  base: "/knurl/docs",
  markdown: {
    rehypePlugins: [prefixImageUrls]
  },
  integrations: [
    starlight({
      title: "Knurl Documentation",
      description: "HTTP API testing and documentation made simple.",
      editLink: {
        baseUrl: "https://github.com/newty/knurl/edit/wsl/main/documentation/src/content/docs/",
      },
      social: [
        { label: "GitHub", icon: "github", href: "https://github.com/newty/knurl" },
      ],
      sidebar: [
        { label: "Home", slug: "index" },
        ...buildGuidesSidebarItems(),
      ],
    }),
  ],
  output: "static",
  outDir: "./dist",
})

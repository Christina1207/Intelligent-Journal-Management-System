import type { InfoSection, PublicPageContent } from "../types"

function createSectionId(title: string, index: number) {
  const slug = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")

  return slug || `section-${index + 1}`
}

export function getPublicPageSections(
  page: PublicPageContent | null
): InfoSection[] {
  if (!page?.content.trim()) {
    return []
  }

  const sections: InfoSection[] = []
  let currentTitle = page.title
  let currentLines: string[] = []

  function commitSection() {
    const body = currentLines.join("\n").trim()

    if (!body) {
      return
    }

    sections.push({
      id: createSectionId(currentTitle, sections.length),
      title: currentTitle,
      body,
    })
  }

  for (const line of page.content.split(/\r?\n/)) {
    const heading = line.match(/^#{1,3}\s+(.+?)\s*$/)

    if (heading) {
      commitSection()
      currentTitle = heading[1]
      currentLines = []
      continue
    }

    currentLines.push(line)
  }

  commitSection()

  return sections
}

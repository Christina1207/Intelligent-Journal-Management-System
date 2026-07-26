export const submissionLoginHref =
  "/login?next=/author/submissions/new"

export const publicPrimaryNavigation = [
  { label: "Articles", href: "/articles" },
  { label: "Sections", href: "/sections" },
  { label: "Archives", href: "/archives" },
  { label: "About", href: "/about" },
] as const

export const publicFooterNavigation = [
  {
    title: "Journal",
    links: [
      { label: "About the Journal", href: "/about" },
      { label: "Editorial Board", href: "/editorial-board" },
      { label: "Browse Sections", href: "/sections" },
      { label: "Issue Archives", href: "/archives" },
    ],
  },
  {
    title: "For Authors",
    links: [
      { label: "Author Guidelines", href: "/author-guidelines" },
      { label: "Publication Ethics", href: "/publication-ethics" },
      { label: "Submit a Manuscript", href: submissionLoginHref },
    ],
  },
  {
    title: "Access",
    links: [
      { label: "Published Articles", href: "/articles" },
      { label: "Open Access", href: "/open-access" },
      { label: "Contact the Journal", href: "/contact" },
      { label: "Author Login", href: "/login" },
    ],
  },
] as const

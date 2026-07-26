import type { InfoSection, JournalInfo } from "../types";

export const fallbackJournalInfo: JournalInfo = {
  name: "Scientific Journal",
  shortName: "Journal",
  description:
    "A peer-reviewed scientific journal supporting research publication and open scholarly communication.",
  issn: "Not assigned",
  publisher: "",
  accessPolicy: "Open Access",
  peerReviewPolicy: "Peer Reviewed",
  publicationFrequency: "Continuous publication",
  license: "Not specified",
};
export const fallbackAboutSections: InfoSection[] = [
  {
    id: "mission",
    title: "Journal Mission",
    body: "The journal supports the publication and dissemination of peer-reviewed scientific research.",
  },
  {
    id: "scope",
    title: "Journal Scope",
    body: "The journal welcomes original research relevant to its active scientific sections.",
  },
];

export const fallbackAuthorGuidelineSections: InfoSection[] = [
  {
    id: "preparation",
    title: "Manuscript Preparation",
    body: "Authors must provide a complete manuscript PDF together with an anonymized PDF for peer review.",
    items: [
      "Provide accurate title, abstract, language, and section information.",
      "Remove author names, affiliations, acknowledgements, and identifying metadata from the blinded PDF.",
      "Ensure both uploaded files are PDF documents no larger than 50MB.",
    ],
  },
  {
    id: "originality",
    title: "Originality and Author Approval",
    body: "Submitted work must be original, must not be under consideration elsewhere, and must be approved by all contributing authors.",
  },
];

export const fallbackOpenAccessSections: InfoSection[] = [
  {
    id: "reader-access",
    title: "Reader Access",
    body: "Published articles are available through the public journal portal without requiring reader authentication.",
  },
];

export const fallbackPublicationEthicsSections: InfoSection[] = [
  {
    id: "integrity",
    title: "Research Integrity",
    body: "Authors, reviewers, and editors are expected to protect originality, confidentiality, impartiality, and accurate scientific reporting.",
  },
  {
    id: "confidentiality",
    title: "Peer-Review Confidentiality",
    body: "Review manuscripts and confidential editorial information must not be shared outside the authorized review workflow.",
  },
];

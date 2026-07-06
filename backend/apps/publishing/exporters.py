import re
import xml.etree.ElementTree as ET
from typing import Optional

from .metadata import ArticleMetadata


OAI_DC_NAMESPACE = "http://www.openarchives.org/OAI/2.0/oai_dc/"
DC_NAMESPACE = "http://purl.org/dc/elements/1.1/"
XSI_NAMESPACE = "http://www.w3.org/2001/XMLSchema-instance"
OAI_DC_SCHEMA_LOCATION = (
    "http://www.openarchives.org/OAI/2.0/oai_dc/ "
    "http://www.openarchives.org/OAI/2.0/oai_dc.xsd"
)


FORMAT_ALIASES = {
    "bibtex": "bibtex",
    "bib": "bibtex",
    "ris": "ris",
    "dc": "dc",
    "dublin-core": "dc",
    "dublin_core": "dc",
    "xml": "dc",
}


def normalize_export_format(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return FORMAT_ALIASES.get(value.strip().lower())


def render_bibtex(metadata: ArticleMetadata) -> str:
    fields = [
        ("title", metadata.title),
        ("author", _bibtex_authors(metadata)),
        ("journal", metadata.journal_title),
        ("year", metadata.year),
        ("doi", metadata.doi),
        ("url", metadata.article_url),
        ("volume", metadata.volume),
        ("number", metadata.issue),
        ("pages", _pages(metadata)),
        ("abstract", metadata.abstract),
        ("keywords", ", ".join(metadata.keywords) if metadata.keywords else None),
        ("issn", metadata.online_issn or metadata.print_issn),
    ]

    lines = [f"@article{{{_citation_key(metadata)},"]
    for name, value in fields:
        if _has_value(value):
            lines.append(f"  {name} = {{{_escape_bibtex(str(value))}}},")

    if len(lines) > 1:
        lines[-1] = lines[-1].rstrip(",")
    lines.append("}")
    return "\n".join(lines) + "\n"


def render_ris(metadata: ArticleMetadata) -> str:
    lines = ["TY  - JOUR"]
    _append_ris(lines, "TI", metadata.title)
    for author in metadata.authors:
        _append_ris(lines, "AU", author.full_name)
    _append_ris(lines, "JO", metadata.journal_title)
    _append_ris(lines, "PY", metadata.year)
    _append_ris(lines, "VL", metadata.volume)
    _append_ris(lines, "IS", metadata.issue)
    _append_ris(lines, "SP", metadata.first_page)
    _append_ris(lines, "EP", metadata.last_page)
    _append_ris(lines, "DO", metadata.doi)
    _append_ris(lines, "UR", metadata.article_url)
    _append_ris(lines, "AB", metadata.abstract)
    for keyword in metadata.keywords:
        _append_ris(lines, "KW", keyword)
    _append_ris(lines, "LA", metadata.language)
    lines.append("ER  -")
    return "\n".join(lines) + "\n"


def render_dublin_core_xml(metadata: ArticleMetadata) -> str:
    ET.register_namespace("oai_dc", OAI_DC_NAMESPACE)
    ET.register_namespace("dc", DC_NAMESPACE)
    ET.register_namespace("xsi", XSI_NAMESPACE)

    root = ET.Element(
        ET.QName(OAI_DC_NAMESPACE, "dc"),
        {
            ET.QName(XSI_NAMESPACE, "schemaLocation"): OAI_DC_SCHEMA_LOCATION,
        },
    )

    _add_dc(root, "title", metadata.title)
    for author in metadata.authors:
        _add_dc(root, "creator", author.full_name)
    for keyword in metadata.keywords:
        _add_dc(root, "subject", keyword)
    _add_dc(root, "description", metadata.abstract)
    _add_dc(root, "publisher", metadata.publisher_name or metadata.journal_title)
    if metadata.publication_date:
        _add_dc(root, "date", metadata.publication_date.isoformat())
    _add_dc(root, "type", "Journal Article")
    if metadata.doi:
        _add_dc(root, "identifier", f"https://doi.org/{metadata.doi}")
    _add_dc(root, "identifier", metadata.article_url)
    _add_dc(root, "identifier", metadata.pdf_url)
    _add_dc(root, "language", metadata.language)
    _add_dc(root, "rights", metadata.license_name)
    _add_dc(root, "rights", metadata.license_url)
    _add_dc(root, "source", _source(metadata))

    return ET.tostring(root, encoding="unicode")


def _bibtex_authors(metadata: ArticleMetadata) -> Optional[str]:
    names = [author.full_name for author in metadata.authors if _has_value(author.full_name)]
    if not names:
        return None
    return " and ".join(names)


def _citation_key(metadata: ArticleMetadata) -> str:
    base = metadata.slug or metadata.title or "article"
    key = re.sub(r"[^A-Za-z0-9]+", "", base)
    return key or "article"


def _escape_bibtex(value: str) -> str:
    replacements = {
        "\\": r"\textbackslash{}",
        "{": r"\{",
        "}": r"\}",
        "&": r"\&",
        "%": r"\%",
        "_": r"\_",
        "#": r"\#",
    }
    return "".join(replacements.get(char, char) for char in value)


def _append_ris(lines: list[str], tag: str, value) -> None:
    if _has_value(value):
        lines.append(f"{tag}  - {_single_line(value)}")


def _add_dc(root: ET.Element, tag_name: str, value) -> None:
    if not _has_value(value):
        return

    element = ET.SubElement(root, ET.QName(DC_NAMESPACE, tag_name))
    element.text = _strip_invalid_xml_chars(str(value))


def _pages(metadata: ArticleMetadata) -> Optional[str]:
    if metadata.first_page and metadata.last_page:
        return f"{metadata.first_page}--{metadata.last_page}"
    return metadata.first_page or metadata.last_page


def _source(metadata: ArticleMetadata) -> Optional[str]:
    parts = [metadata.journal_title]
    if metadata.volume:
        parts.append(f"vol. {metadata.volume}")
    if metadata.issue:
        parts.append(f"no. {metadata.issue}")
    pages = _pages(metadata)
    if pages:
        parts.append(f"pp. {pages.replace('--', '-')}")
    return ", ".join(part for part in parts if _has_value(part)) or None


def _single_line(value) -> str:
    return " ".join(str(value).splitlines()).strip()


def _has_value(value) -> bool:
    return value is not None and str(value).strip() != ""


def _strip_invalid_xml_chars(value: str) -> str:
    return "".join(char for char in value if _is_valid_xml_char(ord(char)))


def _is_valid_xml_char(codepoint: int) -> bool:
    return (
        codepoint == 0x09
        or codepoint == 0x0A
        or codepoint == 0x0D
        or 0x20 <= codepoint <= 0xD7FF
        or 0xE000 <= codepoint <= 0xFFFD
        or 0x10000 <= codepoint <= 0x10FFFF
    )

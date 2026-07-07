from datetime import timezone as datetime_timezone
import xml.etree.ElementTree as ET

from django.utils import timezone

from apps.publishing.exporters import build_dublin_core_element

from .services import (
    IdentifyInfo,
    MetadataFormat,
    OAIRecord,
    OAIResponse,
    SectionSet,
)


OAI_NAMESPACE = "http://www.openarchives.org/OAI/2.0/"
XSI_NAMESPACE = "http://www.w3.org/2001/XMLSchema-instance"
OAI_SCHEMA_LOCATION = (
    "http://www.openarchives.org/OAI/2.0/ "
    "http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd"
)


def render_oai_response(*, response: OAIResponse, request_url: str) -> bytes:
    ET.register_namespace("", OAI_NAMESPACE)
    ET.register_namespace("xsi", XSI_NAMESPACE)

    root = ET.Element(
        _oai_tag("OAI-PMH"),
        {
            ET.QName(XSI_NAMESPACE, "schemaLocation"): OAI_SCHEMA_LOCATION,
        },
    )
    _append_text(root, "responseDate", _response_date())
    request_element = ET.SubElement(
        root,
        _oai_tag("request"),
        {key: str(value) for key, value in response.request_attributes.items()},
    )
    request_element.text = request_url

    if response.errors:
        for error in response.errors:
            error_element = ET.SubElement(
                root,
                _oai_tag("error"),
                {"code": error.code},
            )
            error_element.text = error.message
    elif response.verb == "Identify":
        _append_identify(root, response.payload)
    elif response.verb == "ListMetadataFormats":
        _append_metadata_formats(root, response.payload)
    elif response.verb == "ListSets":
        _append_list_sets(root, response.payload)
    elif response.verb == "ListIdentifiers":
        _append_list_identifiers(root, response.payload)
    elif response.verb == "ListRecords":
        _append_list_records(root, response.payload)
    elif response.verb == "GetRecord":
        _append_get_record(root, response.payload)

    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def _append_identify(parent: ET.Element, identify: IdentifyInfo) -> None:
    container = ET.SubElement(parent, _oai_tag("Identify"))
    _append_text(container, "repositoryName", identify.repository_name)
    _append_text(container, "baseURL", identify.base_url)
    _append_text(container, "protocolVersion", identify.protocol_version)
    _append_text(container, "adminEmail", identify.admin_email)
    _append_text(container, "earliestDatestamp", identify.earliest_datestamp)
    _append_text(container, "deletedRecord", identify.deleted_record)
    _append_text(container, "granularity", identify.granularity)


def _append_metadata_formats(
    parent: ET.Element,
    formats: list[MetadataFormat],
) -> None:
    container = ET.SubElement(parent, _oai_tag("ListMetadataFormats"))
    for metadata_format in formats:
        element = ET.SubElement(container, _oai_tag("metadataFormat"))
        _append_text(element, "metadataPrefix", metadata_format.metadata_prefix)
        _append_text(element, "schema", metadata_format.schema)
        _append_text(element, "metadataNamespace", metadata_format.metadata_namespace)


def _append_list_sets(parent: ET.Element, sets: list[SectionSet]) -> None:
    container = ET.SubElement(parent, _oai_tag("ListSets"))
    for section_set in sets:
        element = ET.SubElement(container, _oai_tag("set"))
        _append_text(element, "setSpec", section_set.spec)
        _append_text(element, "setName", section_set.name)


def _append_list_identifiers(parent: ET.Element, records: list[OAIRecord]) -> None:
    container = ET.SubElement(parent, _oai_tag("ListIdentifiers"))
    for record in records:
        _append_header(container, record)


def _append_list_records(parent: ET.Element, records: list[OAIRecord]) -> None:
    container = ET.SubElement(parent, _oai_tag("ListRecords"))
    for record in records:
        _append_record(container, record)


def _append_get_record(parent: ET.Element, record: OAIRecord) -> None:
    container = ET.SubElement(parent, _oai_tag("GetRecord"))
    _append_record(container, record)


def _append_record(parent: ET.Element, record: OAIRecord) -> None:
    record_element = ET.SubElement(parent, _oai_tag("record"))
    _append_header(record_element, record)
    if record.metadata is not None:
        metadata_element = ET.SubElement(record_element, _oai_tag("metadata"))
        metadata_element.append(build_dublin_core_element(record.metadata))


def _append_header(parent: ET.Element, record: OAIRecord) -> None:
    header = ET.SubElement(parent, _oai_tag("header"))
    _append_text(header, "identifier", record.identifier)
    _append_text(header, "datestamp", record.datestamp)
    if record.set_spec:
        _append_text(header, "setSpec", record.set_spec)


def _append_text(parent: ET.Element, tag_name: str, value) -> ET.Element:
    element = ET.SubElement(parent, _oai_tag(tag_name))
    element.text = "" if value is None else str(value)
    return element


def _response_date() -> str:
    return timezone.now().astimezone(datetime_timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _oai_tag(tag_name: str) -> ET.QName:
    return ET.QName(OAI_NAMESPACE, tag_name)

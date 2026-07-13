TRIAGE_CHECKLIST_VERSION = 1

TRIAGE_RESULT_PASS = "PASS"
TRIAGE_RESULT_CONCERN = "CONCERN"
TRIAGE_RESULT_NOT_APPLICABLE = "NOT_APPLICABLE"

TRIAGE_RESULT_CHOICES = (
    (TRIAGE_RESULT_PASS, "Pass"),
    (TRIAGE_RESULT_CONCERN, "Concern"),
    (TRIAGE_RESULT_NOT_APPLICABLE, "Not applicable"),
)

TRIAGE_CHECKLISTS = {
    1: (
        {
            "code": "scope_fit",
            "label": "Section scope fit",
            "description": (
                "The manuscript topic falls within the aims and scope "
                "of the selected journal section."
            ),
            "required": True,
            "allow_not_applicable": False,
        },
        {
            "code": "manuscript_completeness",
            "label": "Manuscript completeness",
            "description": (
                "The submitted manuscript contains the major components "
                "required for an initial editorial assessment."
            ),
            "required": True,
            "allow_not_applicable": False,
        },
        {
            "code": "metadata_completeness",
            "label": "Submission metadata completeness",
            "description": (
                "The title, abstract, language, section, and required "
                "submission metadata are complete."
            ),
            "required": True,
            "allow_not_applicable": False,
        },
        {
            "code": "author_guidelines",
            "label": "Basic author-guideline compliance",
            "description": (
                "The submission broadly follows the journal's author "
                "guidelines and file requirements."
            ),
            "required": True,
            "allow_not_applicable": False,
        },
        {
            "code": "basic_quality",
            "label": "Basic scholarly and presentation quality",
            "description": (
                "The manuscript is sufficiently coherent and complete "
                "to justify further editorial handling."
            ),
            "required": True,
            "allow_not_applicable": False,
        },
        {
            "code": "ethics_disclosures",
            "label": "Ethics and disclosure information",
            "description": (
                "Relevant ethics approval, consent, funding, and conflict "
                "disclosures are present where applicable."
            ),
            "required": True,
            "allow_not_applicable": True,
        },
    ),
}


def get_triage_checklist(version=TRIAGE_CHECKLIST_VERSION):
    try:
        return TRIAGE_CHECKLISTS[version]
    except KeyError as exc:
        raise ValueError(
            f"Unknown triage checklist version: {version}"
        ) from exc
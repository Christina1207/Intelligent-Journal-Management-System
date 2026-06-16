import logging
import requests

logger = logging.getLogger(__name__)

ORCID_API_BASE = "https://pub.orcid.org/v3.0"


class ORCIDClient:
    """
    Client for the ORCID public API.
    No authentication required for public profiles.
    Fetches and cleans publication works for a given ORCID ID.

    # TODO: If the journal requires access to private ORCID records in the future,
    # implement OAuth 2.0 client credentials flow. Defer to Sprint 4+.
    """

    @staticmethod
    def fetch_publications(orcid_id: str) -> list[dict]:
        """
        Fetch works from ORCID public API for the given ORCID ID.
        Returns a cleaned list of [{title, year, doi}].
        Returns empty list on any failure — caller must handle gracefully.
        """
        if not orcid_id or not orcid_id.strip():
            logger.warning("ORCIDClient.fetch_publications called with empty ORCID ID.")
            return []

        url = f"{ORCID_API_BASE}/{orcid_id}/works"

        try:
            response = requests.get(
                url,
                headers={"Accept": "application/json"},
                timeout=10,
            )
            response.raise_for_status()
            data = response.json()
        except requests.exceptions.Timeout:
            logger.error("ORCID API timeout for ORCID ID: %s", orcid_id)
            return []
        except requests.exceptions.HTTPError as e:
            logger.error("ORCID API HTTP error for %s: %s", orcid_id, str(e))
            return []
        except Exception as e:
            logger.error("ORCID API unexpected error for %s: %s", orcid_id, str(e))
            return []

        return ORCIDClient._parse_works(data)

    @staticmethod
    def _parse_works(data: dict) -> list[dict]:
        """
        Parse the ORCID works response into a clean list.
        ORCID structure is deeply nested — defensive parsing throughout.
        """
        publications = []

        groups = data.get("group", []) or []
        for group in groups:
            summaries = group.get("work-summary", []) or []
            if not summaries:
                continue

            # Take the first summary — ORCID groups duplicates together
            work = summaries[0]

            title = (
                work.get("title", {})
                    .get("title", {})
                    .get("value", "")
            )
            year = (
                work.get("publication-date", {})
                    .get("year", {})
                    .get("value", "")
                if work.get("publication-date")
                else ""
            )
            doi = ""
            # Fallback to empty dict if "external-ids" is None, then get "external-id" list
            external_ids_container = work.get("external-ids") or {}
            external_ids_list = external_ids_container.get("external-id", []) if isinstance(external_ids_container, dict) else []

            for ext_id in external_ids_list:
                if isinstance(ext_id, dict) and ext_id.get("external-id-type") == "doi":
                    doi = ext_id.get("external-id-value", "")
                    break

            if not title:
                continue

            publications.append({
                "title": title.strip(),
                "year": year,
                "doi": doi,
            })

        return publications
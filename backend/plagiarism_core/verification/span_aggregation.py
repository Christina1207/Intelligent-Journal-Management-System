from __future__ import annotations

import json
import math
import os
from collections import Counter, defaultdict, deque
from dataclasses import asdict, dataclass
from itertools import product
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence


AGGREGATED_DETECTION_SCHEMA = "dual_span_aggregated_detection_v1"
END_TO_END_METRICS_SCHEMA = "dual_span_end_to_end_metrics_v1"
AGGREGATION_SEARCH_SCHEMA = "validation_aggregation_grid_search_v1"
ERROR_BREAKDOWN_SCHEMA = "dual_span_error_breakdown_v1"


@dataclass(frozen=True, order=True)
class AggregationConfig:
    """Maximum half-open interval gaps permitted on both document sides."""

    submitted_gap: int
    source_gap: int

    def __post_init__(self) -> None:
        if self.submitted_gap < 0:
            raise ValueError("submitted_gap cannot be negative.")
        if self.source_gap < 0:
            raise ValueError("source_gap cannot be negative.")

    def to_dict(self) -> dict[str, int]:
        return asdict(self)


@dataclass(frozen=True)
class AggregationSearchResult:
    """Selected validation configuration and its saved artifacts."""

    aggregation_input_file: str
    ground_truth_file: str
    detections_file: str
    metrics_file: str
    error_breakdown_file: str
    parameter_search_file: str
    selected_config: AggregationConfig
    selected_metrics: dict[str, Any]
    searched_configuration_count: int

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["selected_config"] = self.selected_config.to_dict()
        return result


class DualSpanGapAggregator:
    """
    Merge accepted pairs only when both submitted and source spans are near.

    Within each submitted/source document pair, records form an undirected
    graph. Two records are connected when their submitted interval gap and
    source interval gap are both within the configured limits. Each connected
    component becomes one coherent detection.
    """

    def aggregate(
        self,
        records: Sequence[Mapping[str, Any]],
        config: AggregationConfig,
    ) -> list[dict[str, Any]]:
        grouped: dict[
            tuple[str, str],
            list[dict[str, Any]],
        ] = defaultdict(list)

        for raw_record in records:
            record = self._validated_record(raw_record)
            if record["verification"]["prediction"] != 1:
                continue
            key = (
                record["submitted_document_id"],
                record["source_document_id"],
            )
            grouped[key].append(record)

        detections: list[dict[str, Any]] = []
        detection_number = 0
        for document_key in sorted(grouped):
            components = self._components(
                grouped[document_key],
                config,
            )
            for component in components:
                detection_number += 1
                detections.append(
                    self._build_detection(
                        component,
                        config=config,
                        detection_number=detection_number,
                    )
                )
        return detections

    def _components(
        self,
        records: list[dict[str, Any]],
        config: AggregationConfig,
    ) -> list[list[dict[str, Any]]]:
        records.sort(
            key=lambda item: (
                item["submitted_offsets"]["start"],
                item["submitted_offsets"]["end"],
                item["source_offsets"]["start"],
                item["source_offsets"]["end"],
                item["pair_id"],
            )
        )
        parents = list(range(len(records)))
        ranks = [0] * len(records)

        def find(index: int) -> int:
            while parents[index] != index:
                parents[index] = parents[parents[index]]
                index = parents[index]
            return index

        def union(left: int, right: int) -> None:
            left_root = find(left)
            right_root = find(right)
            if left_root == right_root:
                return
            if ranks[left_root] < ranks[right_root]:
                left_root, right_root = right_root, left_root
            parents[right_root] = left_root
            if ranks[left_root] == ranks[right_root]:
                ranks[left_root] += 1

        active_indices: list[int] = []
        for current_index, current in enumerate(records):
            current_start = current["submitted_offsets"]["start"]
            active_indices = [
                index
                for index in active_indices
                if (
                    records[index]["submitted_offsets"]["end"]
                    + config.submitted_gap
                    >= current_start
                )
            ]
            for previous_index in active_indices:
                previous = records[previous_index]
                if (
                    _interval_gap(
                        previous["source_offsets"],
                        current["source_offsets"],
                    )
                    <= config.source_gap
                ):
                    union(previous_index, current_index)
            active_indices.append(current_index)

        grouped_indices: dict[int, list[int]] = defaultdict(list)
        for index in range(len(records)):
            grouped_indices[find(index)].append(index)

        components = [
            [records[index] for index in indices]
            for indices in grouped_indices.values()
        ]
        components.sort(
            key=lambda component: (
                min(
                    item["submitted_offsets"]["start"]
                    for item in component
                ),
                min(
                    item["source_offsets"]["start"]
                    for item in component
                ),
                min(item["pair_id"] for item in component),
            )
        )
        return components

    @staticmethod
    def _build_detection(
        component: Sequence[Mapping[str, Any]],
        *,
        config: AggregationConfig,
        detection_number: int,
    ) -> dict[str, Any]:
        scores = [
            float(item["verification"]["score"]) for item in component
        ]
        strongest = min(
            component,
            key=lambda item: (
                -float(item["verification"]["score"]),
                int(item["retrieval"]["rank"]),
                item["pair_id"],
            ),
        )
        retrieval_methods = sorted(
            {
                method
                for item in component
                for method in item["retrieval"].get(
                    "retrieval_methods",
                    [],
                )
            }
        )
        source_segment_ids = sorted(
            {
                item["source_segment_id"]
                for item in component
                if item.get("source_segment_id") is not None
            }
        )
        pair_ids = sorted(item["pair_id"] for item in component)
        return {
            "schema_version": AGGREGATED_DETECTION_SCHEMA,
            "detection_id": f"detection-{detection_number:06d}",
            "submitted_document_id": strongest[
                "submitted_document_id"
            ],
            "source_document_id": strongest["source_document_id"],
            "submitted_offsets": {
                "start": min(
                    item["submitted_offsets"]["start"]
                    for item in component
                ),
                "end": max(
                    item["submitted_offsets"]["end"]
                    for item in component
                ),
            },
            "source_offsets": {
                "start": min(
                    item["source_offsets"]["start"]
                    for item in component
                ),
                "end": max(
                    item["source_offsets"]["end"]
                    for item in component
                ),
            },
            "supporting_pair_count": len(component),
            "supporting_pair_ids": pair_ids,
            "source_segment_ids": source_segment_ids,
            "retrieval_methods": retrieval_methods,
            "verifier_score": {
                "maximum": max(scores),
                "mean": sum(scores) / len(scores),
                "minimum": min(scores),
            },
            "strongest_pair": {
                "pair_id": strongest["pair_id"],
                "submitted_segment_index": strongest[
                    "submitted_segment_index"
                ],
                "source_segment_id": strongest.get("source_segment_id"),
                "source_segment_index": strongest[
                    "source_segment_index"
                ],
                "retrieval": strongest["retrieval"],
                "score": strongest["verification"]["score"],
            },
            "aggregation_config": config.to_dict(),
        }

    @staticmethod
    def _validated_record(
        raw_record: Mapping[str, Any],
    ) -> dict[str, Any]:
        if not isinstance(raw_record, Mapping):
            raise ValueError("Aggregation record must be an object.")
        record = dict(raw_record)
        for field in (
            "pair_id",
            "submitted_document_id",
            "source_document_id",
        ):
            if not isinstance(record.get(field), str) or not record[field]:
                raise ValueError(f"{field} must be a non-empty string.")
        _validate_offsets(record.get("submitted_offsets"), field="submitted")
        _validate_offsets(record.get("source_offsets"), field="source")

        retrieval = record.get("retrieval")
        if not isinstance(retrieval, Mapping):
            raise ValueError("Aggregation record has no retrieval object.")
        rank = retrieval.get("rank")
        if not isinstance(rank, int) or isinstance(rank, bool) or rank < 1:
            raise ValueError("retrieval.rank must be a positive integer.")

        verification = record.get("verification")
        if not isinstance(verification, Mapping):
            raise ValueError("Aggregation record has no verification object.")
        score = verification.get("score")
        if (
            not isinstance(score, (int, float))
            or isinstance(score, bool)
            or not math.isfinite(float(score))
            or not 0.0 <= float(score) <= 1.0
        ):
            raise ValueError(
                "verification.score must be a probability."
            )
        prediction = verification.get("prediction")
        if prediction not in {0, 1} or isinstance(prediction, bool):
            raise ValueError(
                "verification.prediction must be binary integer 0 or 1."
            )
        return record


class DualSpanCoverageEvaluator:
    """
    Evaluate final regions using one-to-one dual-span overlap matching.

    A detection can match an annotation only when the document pair agrees
    and both its submitted and source intervals overlap by at least one
    character. Hopcroft-Karp matching maximizes the number of credited
    detections/annotations; higher dual-IoU edges are visited first to make
    coverage reporting deterministic and quality-oriented.
    """

    def evaluate(
        self,
        detections: Sequence[Mapping[str, Any]],
        annotations: Sequence[Mapping[str, Any]],
        *,
        candidate_records: Sequence[Mapping[str, Any]] = (),
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        clean_detections = [
            self._validated_detection(item) for item in detections
        ]
        clean_annotations = [
            self._validated_annotation(item) for item in annotations
        ]
        self._ensure_unique_ids(
            clean_detections,
            id_field="detection_id",
        )
        self._ensure_unique_ids(
            clean_annotations,
            id_field="annotation_id",
        )

        grouped_detections = self._group_by_document_pair(
            clean_detections
        )
        grouped_annotations = self._group_by_document_pair(
            clean_annotations
        )
        matches: list[dict[str, Any]] = []
        all_group_keys = sorted(
            set(grouped_detections) | set(grouped_annotations)
        )
        for group_key in all_group_keys:
            group_matches = self._maximum_group_matching(
                grouped_detections.get(group_key, []),
                grouped_annotations.get(group_key, []),
            )
            matches.extend(group_matches)

        matched_detection_ids = {
            item["detection_id"] for item in matches
        }
        matched_annotation_ids = {
            item["annotation_id"] for item in matches
        }
        false_detections = [
            item
            for item in clean_detections
            if item["detection_id"] not in matched_detection_ids
        ]
        missed_annotations = [
            item
            for item in clean_annotations
            if item["annotation_id"] not in matched_annotation_ids
        ]

        metrics = self._metrics(
            detections=clean_detections,
            annotations=clean_annotations,
            matches=matches,
            grouped_detections=grouped_detections,
            grouped_annotations=grouped_annotations,
        )
        error_breakdown = self._error_breakdown(
            detections=clean_detections,
            annotations=clean_annotations,
            matches=matches,
            false_detections=false_detections,
            missed_annotations=missed_annotations,
            candidate_records=candidate_records,
        )
        return metrics, error_breakdown

    def _maximum_group_matching(
        self,
        detections: Sequence[Mapping[str, Any]],
        annotations: Sequence[Mapping[str, Any]],
    ) -> list[dict[str, Any]]:
        if not detections or not annotations:
            return []

        adjacency: dict[int, list[int]] = {}
        coverage_by_edge: dict[tuple[int, int], dict[str, float]] = {}
        for detection_index, detection in enumerate(detections):
            eligible: list[tuple[float, str, int]] = []
            for annotation_index, annotation in enumerate(annotations):
                coverage = _dual_span_coverage(detection, annotation)
                if coverage is None:
                    continue
                quality = math.sqrt(
                    coverage["submitted_iou"]
                    * coverage["source_iou"]
                )
                coverage_by_edge[
                    (detection_index, annotation_index)
                ] = coverage
                eligible.append(
                    (
                        -quality,
                        annotation["annotation_id"],
                        annotation_index,
                    )
                )
            adjacency[detection_index] = [
                item[2] for item in sorted(eligible)
            ]

        detection_match: dict[int, int] = {}
        annotation_match: dict[int, int] = {}
        infinity = len(detections) + len(annotations) + 1

        while True:
            distances: dict[int, int] = {}
            queue: deque[int] = deque()
            for detection_index in range(len(detections)):
                if detection_index not in detection_match:
                    distances[detection_index] = 0
                    queue.append(detection_index)
                else:
                    distances[detection_index] = infinity

            augmenting_path_exists = False
            while queue:
                detection_index = queue.popleft()
                for annotation_index in adjacency[detection_index]:
                    paired_detection = annotation_match.get(
                        annotation_index
                    )
                    if paired_detection is None:
                        augmenting_path_exists = True
                    elif distances[paired_detection] == infinity:
                        distances[paired_detection] = (
                            distances[detection_index] + 1
                        )
                        queue.append(paired_detection)

            if not augmenting_path_exists:
                break

            def augment(detection_index: int) -> bool:
                for annotation_index in adjacency[detection_index]:
                    paired_detection = annotation_match.get(
                        annotation_index
                    )
                    if (
                        paired_detection is None
                        or (
                            distances.get(paired_detection, infinity)
                            == distances[detection_index] + 1
                            and augment(paired_detection)
                        )
                    ):
                        detection_match[detection_index] = annotation_index
                        annotation_match[annotation_index] = detection_index
                        return True
                distances[detection_index] = infinity
                return False

            for detection_index in range(len(detections)):
                if detection_index not in detection_match:
                    augment(detection_index)

        matches: list[dict[str, Any]] = []
        for detection_index, annotation_index in sorted(
            detection_match.items(),
            key=lambda item: detections[item[0]]["detection_id"],
        ):
            coverage = coverage_by_edge[
                (detection_index, annotation_index)
            ]
            matches.append(
                {
                    "detection_id": detections[detection_index][
                        "detection_id"
                    ],
                    "annotation_id": annotations[annotation_index][
                        "annotation_id"
                    ],
                    "submitted_document_id": detections[detection_index][
                        "submitted_document_id"
                    ],
                    "source_document_id": detections[detection_index][
                        "source_document_id"
                    ],
                    **coverage,
                }
            )
        return matches

    def _metrics(
        self,
        *,
        detections: Sequence[Mapping[str, Any]],
        annotations: Sequence[Mapping[str, Any]],
        matches: Sequence[Mapping[str, Any]],
        grouped_detections: Mapping[
            tuple[str, str],
            Sequence[Mapping[str, Any]],
        ],
        grouped_annotations: Mapping[
            tuple[str, str],
            Sequence[Mapping[str, Any]],
        ],
    ) -> dict[str, Any]:
        true_positive_count = len(matches)
        false_positive_count = len(detections) - true_positive_count
        false_negative_count = len(annotations) - true_positive_count
        precision = _safe_divide(
            true_positive_count,
            len(detections),
        )
        recall = _safe_divide(
            true_positive_count,
            len(annotations),
        )

        matched_submitted_overlap = sum(
            item["submitted_overlap_length"] for item in matches
        )
        matched_source_overlap = sum(
            item["source_overlap_length"] for item in matches
        )
        total_annotation_submitted_chars = sum(
            _interval_length(item["submitted_offsets"])
            for item in annotations
        )
        total_annotation_source_chars = sum(
            _interval_length(item["source_offsets"])
            for item in annotations
        )
        total_detection_submitted_chars = sum(
            _interval_length(item["submitted_offsets"])
            for item in detections
        )
        total_detection_source_chars = sum(
            _interval_length(item["source_offsets"])
            for item in detections
        )

        fully_detected_count = sum(
            math.isclose(
                item["submitted_annotation_coverage"],
                1.0,
                abs_tol=1e-12,
            )
            and math.isclose(
                item["source_annotation_coverage"],
                1.0,
                abs_tol=1e-12,
            )
            for item in matches
        )
        fragmentation_count = 0
        overmerge_count = 0
        all_keys = set(grouped_detections) | set(grouped_annotations)
        for key in all_keys:
            group_detections = grouped_detections.get(key, [])
            group_annotations = grouped_annotations.get(key, [])
            fragmentation_count += sum(
                sum(
                    _dual_span_coverage(detection, annotation) is not None
                    for detection in group_detections
                )
                > 1
                for annotation in group_annotations
            )
            overmerge_count += sum(
                sum(
                    _dual_span_coverage(detection, annotation) is not None
                    for annotation in group_annotations
                )
                > 1
                for detection in group_detections
            )

        annotation_by_id = {
            item["annotation_id"]: item for item in annotations
        }
        detected_annotation_ids = {
            item["annotation_id"] for item in matches
        }
        return {
            "schema_version": END_TO_END_METRICS_SCHEMA,
            "matching_rule": (
                "same document pair and positive character overlap on both "
                "submitted and source spans; one-to-one maximum-cardinality "
                "matching"
            ),
            "detection_count": len(detections),
            "annotation_count": len(annotations),
            "true_positive_detection_count": true_positive_count,
            "false_positive_detection_count": false_positive_count,
            "detected_annotation_count": true_positive_count,
            "missed_annotation_count": false_negative_count,
            "precision": precision,
            "recall": recall,
            "f1": _f_beta(precision, recall, beta=1.0),
            "f2": _f_beta(precision, recall, beta=2.0),
            "fully_detected_annotation_count": fully_detected_count,
            "partially_detected_annotation_count": (
                true_positive_count - fully_detected_count
            ),
            "fragmented_annotation_count": fragmentation_count,
            "overmerged_detection_count": overmerge_count,
            "submitted_character_recall": _safe_divide(
                matched_submitted_overlap,
                total_annotation_submitted_chars,
            ),
            "source_character_recall": _safe_divide(
                matched_source_overlap,
                total_annotation_source_chars,
            ),
            "submitted_character_precision": _safe_divide(
                matched_submitted_overlap,
                total_detection_submitted_chars,
            ),
            "source_character_precision": _safe_divide(
                matched_source_overlap,
                total_detection_source_chars,
            ),
            "mean_matched_submitted_annotation_coverage": _mean(
                [
                    item["submitted_annotation_coverage"]
                    for item in matches
                ]
            ),
            "mean_matched_source_annotation_coverage": _mean(
                [
                    item["source_annotation_coverage"]
                    for item in matches
                ]
            ),
            "mean_matched_submitted_detection_coverage": _mean(
                [
                    item["submitted_detection_coverage"]
                    for item in matches
                ]
            ),
            "mean_matched_source_detection_coverage": _mean(
                [
                    item["source_detection_coverage"]
                    for item in matches
                ]
            ),
            "annotation_recall_by_obfuscation": self._grouped_recall(
                annotations,
                detected_annotation_ids,
                field="obfuscation",
            ),
            "annotation_recall_by_plagiarism_type": self._grouped_recall(
                annotations,
                detected_annotation_ids,
                field="plagiarism_type",
            ),
            "matched_annotation_ids": sorted(
                item["annotation_id"]
                for item in matches
                if item["annotation_id"] in annotation_by_id
            ),
        }

    def _error_breakdown(
        self,
        *,
        detections: Sequence[Mapping[str, Any]],
        annotations: Sequence[Mapping[str, Any]],
        matches: Sequence[Mapping[str, Any]],
        false_detections: Sequence[Mapping[str, Any]],
        missed_annotations: Sequence[Mapping[str, Any]],
        candidate_records: Sequence[Mapping[str, Any]],
    ) -> dict[str, Any]:
        candidates_by_pair = self._group_by_document_pair(
            candidate_records
        )
        annotations_by_pair = self._group_by_document_pair(annotations)
        annotations_by_submitted: dict[
            str,
            list[Mapping[str, Any]],
        ] = defaultdict(list)
        for annotation in annotations:
            annotations_by_submitted[
                annotation["submitted_document_id"]
            ].append(annotation)

        missed_payload: list[dict[str, Any]] = []
        attribution_counts: Counter[str] = Counter()
        for annotation in missed_annotations:
            key = (
                annotation["submitted_document_id"],
                annotation["source_document_id"],
            )
            overlapping_candidates = [
                candidate
                for candidate in candidates_by_pair.get(key, [])
                if _dual_span_coverage(candidate, annotation) is not None
            ]
            accepted_candidates = [
                candidate
                for candidate in overlapping_candidates
                if candidate["verification"]["prediction"] == 1
            ]
            if not overlapping_candidates:
                attribution = "retrieval"
            elif not accepted_candidates:
                attribution = "verification"
            else:
                attribution = "aggregation_or_one_to_one_matching"
            attribution_counts[attribution] += 1
            missed_payload.append(
                {
                    **dict(annotation),
                    "miss_attribution": attribution,
                    "overlapping_candidate_count": len(
                        overlapping_candidates
                    ),
                    "accepted_overlapping_candidate_count": len(
                        accepted_candidates
                    ),
                }
            )

        false_payload: list[dict[str, Any]] = []
        false_reason_counts: Counter[str] = Counter()
        for detection in false_detections:
            key = (
                detection["submitted_document_id"],
                detection["source_document_id"],
            )
            same_source_annotations = annotations_by_pair.get(key, [])
            eligible_annotations = [
                annotation
                for annotation in same_source_annotations
                if _dual_span_coverage(detection, annotation) is not None
            ]
            if eligible_annotations:
                reason = "duplicate_or_matching_conflict"
            elif same_source_annotations:
                reason = "correct_source_document_wrong_source_span"
            elif annotations_by_submitted.get(
                detection["submitted_document_id"]
            ):
                reason = "wrong_source_document"
            else:
                reason = "no_plagiarism_document"
            false_reason_counts[reason] += 1
            false_payload.append(
                {
                    **dict(detection),
                    "false_detection_reason": reason,
                }
            )

        return {
            "schema_version": ERROR_BREAKDOWN_SCHEMA,
            "match_count": len(matches),
            "false_detection_count": len(false_detections),
            "missed_annotation_count": len(missed_annotations),
            "miss_attribution_counts": dict(
                sorted(attribution_counts.items())
            ),
            "false_detection_reason_counts": dict(
                sorted(false_reason_counts.items())
            ),
            "matches": list(matches),
            "false_detections": false_payload,
            "missed_annotations": missed_payload,
        }

    @staticmethod
    def _group_by_document_pair(
        records: Iterable[Mapping[str, Any]],
    ) -> dict[tuple[str, str], list[Mapping[str, Any]]]:
        grouped: dict[
            tuple[str, str],
            list[Mapping[str, Any]],
        ] = defaultdict(list)
        for item in records:
            grouped[
                (
                    item["submitted_document_id"],
                    item["source_document_id"],
                )
            ].append(item)
        return grouped

    @staticmethod
    def _validated_detection(
        raw: Mapping[str, Any],
    ) -> dict[str, Any]:
        if not isinstance(raw, Mapping):
            raise ValueError("Detection must be an object.")
        detection = dict(raw)
        for field in (
            "detection_id",
            "submitted_document_id",
            "source_document_id",
        ):
            if not isinstance(detection.get(field), str) or not detection[field]:
                raise ValueError(f"{field} must be a non-empty string.")
        _validate_offsets(
            detection.get("submitted_offsets"),
            field="submitted",
        )
        _validate_offsets(
            detection.get("source_offsets"),
            field="source",
        )
        return detection

    @staticmethod
    def _validated_annotation(
        raw: Mapping[str, Any],
    ) -> dict[str, Any]:
        if not isinstance(raw, Mapping):
            raise ValueError("Ground-truth annotation must be an object.")
        annotation = dict(raw)
        for field in (
            "annotation_id",
            "submitted_document_id",
            "source_document_id",
        ):
            if not isinstance(annotation.get(field), str) or not annotation[field]:
                raise ValueError(f"{field} must be a non-empty string.")
        _validate_offsets(
            annotation.get("submitted_offsets"),
            field="submitted",
        )
        _validate_offsets(
            annotation.get("source_offsets"),
            field="source",
        )
        return annotation

    @staticmethod
    def _ensure_unique_ids(
        records: Sequence[Mapping[str, Any]],
        *,
        id_field: str,
    ) -> None:
        identifiers = [item[id_field] for item in records]
        if len(set(identifiers)) != len(identifiers):
            raise ValueError(f"Duplicate {id_field} values are not allowed.")

    @staticmethod
    def _grouped_recall(
        annotations: Sequence[Mapping[str, Any]],
        detected_ids: set[str],
        *,
        field: str,
    ) -> dict[str, dict[str, Any]]:
        counts: dict[str, list[int]] = defaultdict(lambda: [0, 0])
        for annotation in annotations:
            value = annotation.get(field)
            group = value if isinstance(value, str) and value else "unknown"
            counts[group][0] += 1
            counts[group][1] += int(
                annotation["annotation_id"] in detected_ids
            )
        return {
            group: {
                "annotation_count": total,
                "detected_count": detected,
                "recall": _safe_divide(detected, total),
            }
            for group, (total, detected) in sorted(counts.items())
        }


class ValidationAggregationGridSearch:
    """Run Strategy 1: select a small dual-gap grid by validation F1."""

    def __init__(
        self,
        *,
        aggregator: DualSpanGapAggregator | None = None,
        evaluator: DualSpanCoverageEvaluator | None = None,
    ) -> None:
        self.aggregator = aggregator or DualSpanGapAggregator()
        self.evaluator = evaluator or DualSpanCoverageEvaluator()

    def run(
        self,
        *,
        aggregation_input_path: str | Path,
        ground_truth_path: str | Path,
        output_directory: str | Path,
        submitted_gaps: Sequence[int] = (0, 50, 150, 300),
        source_gaps: Sequence[int] = (0, 50, 150, 300),
        overwrite: bool = False,
    ) -> AggregationSearchResult:
        submitted_gap_values = self._validated_gap_values(
            submitted_gaps,
            name="submitted_gaps",
        )
        source_gap_values = self._validated_gap_values(
            source_gaps,
            name="source_gaps",
        )
        aggregation_input_path = Path(aggregation_input_path)
        ground_truth_path = Path(ground_truth_path)
        records = self._load_minimal_aggregation_records(
            aggregation_input_path
        )
        annotations = _read_jsonl(ground_truth_path)
        if not annotations:
            raise ValueError("Validation ground-truth JSONL is empty.")

        output_directory = Path(output_directory)
        output_directory.mkdir(parents=True, exist_ok=True)
        detections_path = (
            output_directory / "validation_aggregated_detections.jsonl"
        )
        metrics_path = (
            output_directory / "validation_end_to_end_metrics.json"
        )
        error_breakdown_path = (
            output_directory / "validation_error_breakdown.json"
        )
        parameter_search_path = (
            output_directory / "aggregation_parameter_search.json"
        )
        targets = (
            detections_path,
            metrics_path,
            error_breakdown_path,
            parameter_search_path,
        )
        _validate_output_targets(targets, overwrite=overwrite)

        search_rows: list[dict[str, Any]] = []
        selected: tuple[
            AggregationConfig,
            list[dict[str, Any]],
            dict[str, Any],
            dict[str, Any],
        ] | None = None
        selected_key: tuple[float, ...] | None = None

        for submitted_gap, source_gap in product(
            submitted_gap_values,
            source_gap_values,
        ):
            config = AggregationConfig(
                submitted_gap=submitted_gap,
                source_gap=source_gap,
            )
            detections = self.aggregator.aggregate(records, config)
            metrics, error_breakdown = self.evaluator.evaluate(
                detections,
                annotations,
                candidate_records=records,
            )
            row = {
                "config": config.to_dict(),
                "metrics": metrics,
            }
            search_rows.append(row)
            selection_key = (
                float(metrics["f1"]),
                float(metrics["f2"]),
                float(metrics["precision"]),
                float(metrics["recall"]),
                -float(submitted_gap + source_gap),
                -float(submitted_gap),
                -float(source_gap),
            )
            if selected_key is None or selection_key > selected_key:
                selected_key = selection_key
                selected = (
                    config,
                    detections,
                    metrics,
                    error_breakdown,
                )

        if selected is None:  # pragma: no cover - product cannot be empty
            raise RuntimeError("Aggregation grid search produced no result.")
        config, detections, metrics, error_breakdown = selected
        metrics = {
            **metrics,
            "selected_aggregation_config": config.to_dict(),
            "selection_split": "validation",
            "selection_metric": "f1",
            "verifier_threshold_tuned_during_aggregation": False,
        }
        search_payload = {
            "schema_version": AGGREGATION_SEARCH_SCHEMA,
            "strategy": (
                "small validation grid; maximize F1, then F2, precision, "
                "recall, and prefer smaller gaps"
            ),
            "aggregation_input_file": str(
                aggregation_input_path.resolve()
            ),
            "ground_truth_file": str(ground_truth_path.resolve()),
            "submitted_gap_values": list(submitted_gap_values),
            "source_gap_values": list(source_gap_values),
            "configuration_count": len(search_rows),
            "selected_config": config.to_dict(),
            "selected_metrics": metrics,
            "results": search_rows,
        }

        _atomic_jsonl_write(detections, detections_path)
        _atomic_json_write(metrics, metrics_path)
        _atomic_json_write(error_breakdown, error_breakdown_path)
        _atomic_json_write(search_payload, parameter_search_path)

        return AggregationSearchResult(
            aggregation_input_file=str(
                aggregation_input_path.resolve()
            ),
            ground_truth_file=str(ground_truth_path.resolve()),
            detections_file=str(detections_path.resolve()),
            metrics_file=str(metrics_path.resolve()),
            error_breakdown_file=str(error_breakdown_path.resolve()),
            parameter_search_file=str(parameter_search_path.resolve()),
            selected_config=config,
            selected_metrics=metrics,
            searched_configuration_count=len(search_rows),
        )

    @staticmethod
    def _validated_gap_values(
        values: Sequence[int],
        *,
        name: str,
    ) -> tuple[int, ...]:
        if not values:
            raise ValueError(f"{name} cannot be empty.")
        if any(
            not isinstance(value, int)
            or isinstance(value, bool)
            or value < 0
            for value in values
        ):
            raise ValueError(
                f"{name} must contain non-negative integers."
            )
        return tuple(sorted(set(values)))

    @staticmethod
    def _load_minimal_aggregation_records(
        path: Path,
    ) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for record in _read_jsonl(path):
            records.append(
                {
                    "pair_id": record.get("pair_id"),
                    "submitted_document_id": record.get(
                        "submitted_document_id"
                    ),
                    "submitted_segment_index": record.get(
                        "submitted_segment_index"
                    ),
                    "submitted_offsets": record.get("submitted_offsets"),
                    "source_document_id": record.get(
                        "source_document_id"
                    ),
                    "source_segment_id": record.get("source_segment_id"),
                    "source_segment_index": record.get(
                        "source_segment_index"
                    ),
                    "source_offsets": record.get("source_offsets"),
                    "retrieval": record.get("retrieval"),
                    "verification": record.get("verification"),
                }
            )
        if not records:
            raise ValueError("Validation aggregation input JSONL is empty.")
        return records


def _dual_span_coverage(
    detection: Mapping[str, Any],
    annotation: Mapping[str, Any],
) -> dict[str, float] | None:
    submitted_overlap = _interval_overlap_length(
        detection["submitted_offsets"],
        annotation["submitted_offsets"],
    )
    source_overlap = _interval_overlap_length(
        detection["source_offsets"],
        annotation["source_offsets"],
    )
    if submitted_overlap <= 0 or source_overlap <= 0:
        return None

    detection_submitted_length = _interval_length(
        detection["submitted_offsets"]
    )
    annotation_submitted_length = _interval_length(
        annotation["submitted_offsets"]
    )
    detection_source_length = _interval_length(
        detection["source_offsets"]
    )
    annotation_source_length = _interval_length(
        annotation["source_offsets"]
    )
    submitted_union = (
        detection_submitted_length
        + annotation_submitted_length
        - submitted_overlap
    )
    source_union = (
        detection_source_length
        + annotation_source_length
        - source_overlap
    )
    return {
        "submitted_overlap_length": submitted_overlap,
        "source_overlap_length": source_overlap,
        "submitted_annotation_coverage": (
            submitted_overlap / annotation_submitted_length
        ),
        "submitted_detection_coverage": (
            submitted_overlap / detection_submitted_length
        ),
        "source_annotation_coverage": (
            source_overlap / annotation_source_length
        ),
        "source_detection_coverage": (
            source_overlap / detection_source_length
        ),
        "submitted_iou": submitted_overlap / submitted_union,
        "source_iou": source_overlap / source_union,
    }


def _validate_offsets(value: Any, *, field: str) -> None:
    if not isinstance(value, Mapping):
        raise ValueError(f"{field}_offsets must be an object.")
    start = value.get("start")
    end = value.get("end")
    if (
        not isinstance(start, int)
        or isinstance(start, bool)
        or not isinstance(end, int)
        or isinstance(end, bool)
        or start < 0
        or end <= start
    ):
        raise ValueError(
            f"{field}_offsets must satisfy 0 <= start < end."
        )


def _interval_gap(
    left: Mapping[str, int],
    right: Mapping[str, int],
) -> int:
    if left["end"] < right["start"]:
        return right["start"] - left["end"]
    if right["end"] < left["start"]:
        return left["start"] - right["end"]
    return 0


def _interval_overlap_length(
    left: Mapping[str, int],
    right: Mapping[str, int],
) -> int:
    return max(
        0,
        min(left["end"], right["end"])
        - max(left["start"], right["start"]),
    )


def _interval_length(value: Mapping[str, int]) -> int:
    return value["end"] - value["start"]


def _safe_divide(
    numerator: int | float,
    denominator: int | float,
) -> float:
    if denominator == 0:
        return 0.0
    return float(numerator / denominator)


def _f_beta(precision: float, recall: float, *, beta: float) -> float:
    beta_squared = beta * beta
    denominator = beta_squared * precision + recall
    if denominator == 0.0:
        return 0.0
    return (
        (1.0 + beta_squared)
        * precision
        * recall
        / denominator
    )


def _mean(values: Sequence[float]) -> float:
    if not values:
        return 0.0
    return float(sum(values) / len(values))


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        raise FileNotFoundError(f"JSONL file does not exist: {path}")
    records: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as file:
        for line_number, line in enumerate(file, start=1):
            if not line.strip():
                raise ValueError(
                    f"Blank JSONL line in {path} at {line_number}."
                )
            try:
                record = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(
                    f"Invalid JSON in {path} at line {line_number}."
                ) from exc
            if not isinstance(record, dict):
                raise ValueError(
                    f"JSONL record in {path} at line {line_number} "
                    "is not an object."
                )
            records.append(record)
    return records


def _validate_output_targets(
    paths: Sequence[Path],
    *,
    overwrite: bool,
) -> None:
    existing = [path for path in paths if path.exists()]
    if existing and not overwrite:
        names = ", ".join(str(path) for path in existing)
        raise FileExistsError(
            f"Aggregation outputs already exist: {names}. "
            "Choose another directory or enable overwrite."
        )


def _atomic_jsonl_write(
    records: Sequence[Mapping[str, Any]],
    path: Path,
) -> None:
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    try:
        with temporary_path.open("w", encoding="utf-8") as file:
            for record in records:
                file.write(
                    json.dumps(
                        record,
                        ensure_ascii=False,
                        separators=(",", ":"),
                    )
                )
                file.write("\n")
        os.replace(temporary_path, path)
    finally:
        temporary_path.unlink(missing_ok=True)


def _atomic_json_write(
    payload: Mapping[str, Any],
    path: Path,
) -> None:
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    try:
        with temporary_path.open("w", encoding="utf-8") as file:
            json.dump(payload, file, ensure_ascii=False, indent=2)
        os.replace(temporary_path, path)
    finally:
        temporary_path.unlink(missing_ok=True)

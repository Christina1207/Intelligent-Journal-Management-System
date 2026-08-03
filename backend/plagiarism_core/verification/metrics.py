from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Sequence


@dataclass(frozen=True)
class BinaryVerificationMetrics:
    """Metrics for one naturally distributed verifier evaluation split."""

    example_count: int
    positive_count: int
    negative_count: int
    loss: float
    average_precision: float
    threshold: float
    true_positives: int
    false_positives: int
    true_negatives: int
    false_negatives: int
    precision: float
    recall: float
    f1: float
    f2: float
    accuracy: float

    @property
    def positive_rate(self) -> float:
        if self.example_count == 0:
            return 0.0
        return self.positive_count / self.example_count

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["positive_rate"] = self.positive_rate
        return result


def average_precision(
    labels: Sequence[int],
    scores: Sequence[float],
) -> float:
    """
    Return step-wise area under the precision-recall curve.

    This is the standard average-precision summary: the precision observed at
    every positive rank, averaged across all positives. It is appropriate for
    the verifier's strongly imbalanced natural validation distribution.
    """
    clean_labels, clean_scores = _validated_inputs(labels, scores)
    positive_count = sum(clean_labels)

    if positive_count == 0:
        return 0.0

    ranked = sorted(
        zip(clean_scores, clean_labels),
        key=lambda item: item[0],
        reverse=True,
    )
    true_positives = 0
    processed = 0
    area = 0.0
    cursor = 0

    # Process equal-score examples as one threshold group. This makes the
    # result independent of arbitrary ordering among tied scores.
    while cursor < len(ranked):
        threshold = ranked[cursor][0]
        positives_in_group = 0
        group_size = 0

        while cursor < len(ranked) and ranked[cursor][0] == threshold:
            positives_in_group += ranked[cursor][1]
            group_size += 1
            cursor += 1

        true_positives += positives_in_group
        processed += group_size

        if positives_in_group:
            precision = true_positives / processed
            recall_increment = positives_in_group / positive_count
            area += precision * recall_increment

    return area


def select_f2_threshold(
    labels: Sequence[int],
    scores: Sequence[float],
) -> float:
    """Select the score threshold with the best F2 on validation data."""
    clean_labels, clean_scores = _validated_inputs(labels, scores)
    ranked = sorted(
        zip(clean_scores, clean_labels),
        key=lambda item: item[0],
        reverse=True,
    )
    total_positives = sum(clean_labels)
    true_positives = 0
    false_positives = 0
    best_threshold = 0.5
    best_key = (-1.0, -1.0, -1.0, -1.0)
    cursor = 0

    while cursor < len(ranked):
        threshold = ranked[cursor][0]

        while cursor < len(ranked) and ranked[cursor][0] == threshold:
            if ranked[cursor][1] == 1:
                true_positives += 1
            else:
                false_positives += 1
            cursor += 1

        false_negatives = total_positives - true_positives
        precision = _safe_divide(
            true_positives,
            true_positives + false_positives,
        )
        recall = _safe_divide(
            true_positives,
            true_positives + false_negatives,
        )
        f2 = _f_beta(precision, recall, beta=2.0)

        # F2 is primary. Recall is the first tie-break because missing real
        # plagiarism is costlier for this pipeline; precision and the higher
        # threshold make subsequent ties deterministic.
        key = (f2, recall, precision, threshold)
        if key > best_key:
            best_key = key
            best_threshold = threshold

    return float(best_threshold)


def calculate_binary_metrics(
    labels: Sequence[int],
    scores: Sequence[float],
    *,
    loss: float,
    threshold: float,
) -> BinaryVerificationMetrics:
    """Calculate threshold-free and threshold-dependent binary metrics."""
    clean_labels, clean_scores = _validated_inputs(labels, scores)

    if not 0.0 <= threshold <= 1.0:
        raise ValueError("threshold must be in the interval [0, 1].")

    true_positives = 0
    false_positives = 0
    true_negatives = 0
    false_negatives = 0

    for label, score in zip(clean_labels, clean_scores):
        prediction = int(score >= threshold)

        if label == 1 and prediction == 1:
            true_positives += 1
        elif label == 0 and prediction == 1:
            false_positives += 1
        elif label == 0 and prediction == 0:
            true_negatives += 1
        else:
            false_negatives += 1

    precision = _safe_divide(
        true_positives,
        true_positives + false_positives,
    )
    recall = _safe_divide(
        true_positives,
        true_positives + false_negatives,
    )
    example_count = len(clean_labels)

    return BinaryVerificationMetrics(
        example_count=example_count,
        positive_count=sum(clean_labels),
        negative_count=example_count - sum(clean_labels),
        loss=float(loss),
        average_precision=average_precision(clean_labels, clean_scores),
        threshold=float(threshold),
        true_positives=true_positives,
        false_positives=false_positives,
        true_negatives=true_negatives,
        false_negatives=false_negatives,
        precision=precision,
        recall=recall,
        f1=_f_beta(precision, recall, beta=1.0),
        f2=_f_beta(precision, recall, beta=2.0),
        accuracy=_safe_divide(
            true_positives + true_negatives,
            example_count,
        ),
    )


def _validated_inputs(
    labels: Sequence[int],
    scores: Sequence[float],
) -> tuple[list[int], list[float]]:
    if len(labels) != len(scores):
        raise ValueError("labels and scores must have the same length.")

    if not labels:
        raise ValueError("At least one label and score are required.")

    clean_labels: list[int] = []
    clean_scores: list[float] = []

    for label, score in zip(labels, scores):
        if label not in {0, 1} or isinstance(label, bool):
            raise ValueError("labels must contain only binary integers.")

        numeric_score = float(score)
        if not 0.0 <= numeric_score <= 1.0:
            raise ValueError("scores must be in the interval [0, 1].")

        clean_labels.append(label)
        clean_scores.append(numeric_score)

    return clean_labels, clean_scores


def _safe_divide(numerator: int | float, denominator: int | float) -> float:
    if denominator == 0:
        return 0.0
    return float(numerator / denominator)


def _f_beta(precision: float, recall: float, *, beta: float) -> float:
    beta_squared = beta * beta
    denominator = beta_squared * precision + recall

    if denominator == 0.0:
        return 0.0

    return (1.0 + beta_squared) * precision * recall / denominator

from dataclasses import dataclass, asdict, field
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class TextSpan:
    """
    Raw segment before normalization.

    Offsets refer to the original document text.
    """
    segment_index: int
    text: str
    start_offset: int
    end_offset: int

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class TextSegment:
    """
    Final preprocessing output.

    This is the shared unit used by:
    - offline source indexing
    - online plagiarism checking
    """
    segment_index: int
    text: str
    normalized_text: str
    start_offset: int
    end_offset: int
    language: str
    token_count: int
    char_count: int

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class PreprocessingConfig:
    """
    Configuration for the shared preprocessing layer.

    Keep it here so future layers can reuse the same settings.
    """
    min_segment_chars: int = 250
    max_segment_chars: int = 1200
    target_segment_chars: int = 800

    sliding_window_words: int = 120
    sliding_window_stride: int = 80

    remove_diacritics: bool = True
    remove_tatweel: bool = True
    normalize_punctuation: bool = True
    normalize_whitespace: bool = True

    lowercase_english: bool = True

    language: Optional[str] = None


@dataclass(frozen=True)
class SourceDocumentRecord:
    """
    Python representation of a source document.

    Later this maps naturally to a Django SourceDocument model.
    """
    external_id: str | None
    title: str | None
    language: str
    source_type: str

    file_path: str | None
    file_hash: str | None
    text_hash: str

    char_count: int
    metadata: Dict[str, Any] = field(default_factory=dict)

    id: int | None = None
    indexed_at: str | None = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class SourceSegmentRecord:
    """
    Python representation of one indexed source passage.

    Later this maps naturally to a Django SourceSegment model.
    """
    source_document_id: int
    segment_index: int

    text: str
    normalized_text: str
    language: str

    start_offset: int
    end_offset: int

    token_count: int
    char_count: int

    id: int | None = None
    source_document_external_id: str | None = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "source_document_id": self.source_document_id,
            "source_document_external_id": (
                self.source_document_external_id
            ),
            "segment_index": self.segment_index,
            "text": self.text,
            "normalized_text": self.normalized_text,
            "language": self.language,
            "start_offset": self.start_offset,
            "end_offset": self.end_offset,
            "token_count": self.token_count,
            "char_count": self.char_count,
        }

@dataclass(frozen=True)
class ExAraPlagiarismAnnotation:
    suspicious_reference: str
    source_reference: str
    this_offset: int
    this_length: int
    source_offset: int
    source_length: int
    obfuscation: str | None = None
    plagiarism_type: str | None = None
    annotation_file: str | None = None

    @property
    def this_end_offset(self) -> int:
        return self.this_offset + self.this_length

    @property
    def source_end_offset(self) -> int:
        return self.source_offset + self.source_length

    def to_dict(self) -> dict:
        return {
            "suspicious_reference": self.suspicious_reference,
            "source_reference": self.source_reference,
            "this_offset": self.this_offset,
            "this_length": self.this_length,
            "this_end_offset": self.this_end_offset,
            "source_offset": self.source_offset,
            "source_length": self.source_length,
            "source_end_offset": self.source_end_offset,
            "obfuscation": self.obfuscation,
            "plagiarism_type": self.plagiarism_type,
            "annotation_file": self.annotation_file,
        }

@dataclass(frozen=True)
class IndexingResult:
    """
    Result returned after indexing one source document.
    """
    document_id: int
    segment_count: int
    skipped: bool
    reason: str | None = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    


@dataclass(frozen=True)
class LexicalScore:
    """
    Lexical retrieval scores for one submitted/source segment pair.

    These are candidate retrieval scores, not final plagiarism decisions.
    Winnowing can be added later without changing CandidatePair.
    """
    method: str

    bm25_raw_score: float
    bm25_normalized_score: float

    query_term_coverage: float
    source_term_coverage: float
    exact_phrase_bonus: float

    final_lexical_score: float

    # Reserved for future extension.
    winnowing_score: float | None = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    
@dataclass(frozen=True)
class SemanticScore:
    """
    Semantic retrieval score for one submitted/source segment pair.

    This score comes from vector similarity using a multilingual embedding model.
    It is not a final plagiarism decision.
    """
    method: str
    model_name: str
    similarity_score: float
    final_semantic_score: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class CandidatePair:
    """
    Candidate pair produced by retrieval.

    A candidate may come from lexical retrieval, semantic retrieval, or both.
    """
    submitted_segment: TextSegment
    source_segment: SourceSegmentRecord

    lexical_score: LexicalScore | None = None
    semantic_score: SemanticScore | None = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "submitted_segment": self.submitted_segment.to_dict(),
            "source_segment": self.source_segment.to_dict(),
            "lexical_score": (
                self.lexical_score.to_dict()
                if self.lexical_score is not None
                else None
            ),
            "semantic_score": (
                self.semantic_score.to_dict()
                if self.semantic_score is not None
                else None
            ),
        }
    
@dataclass(frozen=True)
class AnnotationRetrievalEvaluation:
    suspicious_reference: str
    expected_source_reference: str

    suspicious_start_offset: int
    suspicious_end_offset: int

    source_start_offset: int
    source_end_offset: int

    obfuscation: str | None
    plagiarism_type: str | None

    overlapping_segment_indices: list[int]

    best_document_match_rank: int | None
    best_source_span_overlap_rank: int | None

    found_by_lexical: bool = False
    found_by_semantic: bool = False

    def document_hit_at(self, k: int) -> bool:
        return (
            self.best_document_match_rank is not None
            and self.best_document_match_rank <= k
        )

    def source_span_hit_at(self, k: int) -> bool:
        return (
            self.best_source_span_overlap_rank is not None
            and self.best_source_span_overlap_rank <= k
        )

    def to_dict(self) -> dict:
        return {
            "suspicious_reference": self.suspicious_reference,
            "expected_source_reference": self.expected_source_reference,
            "suspicious_start_offset": self.suspicious_start_offset,
            "suspicious_end_offset": self.suspicious_end_offset,
            "source_start_offset": self.source_start_offset,
            "source_end_offset": self.source_end_offset,
            "obfuscation": self.obfuscation,
            "plagiarism_type": self.plagiarism_type,
            "overlapping_segment_indices": self.overlapping_segment_indices,
            "best_document_match_rank": self.best_document_match_rank,
            "best_source_span_overlap_rank": self.best_source_span_overlap_rank,
            "found_by_lexical": self.found_by_lexical,
            "found_by_semantic": self.found_by_semantic,
        }
    
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SegmentRetrievalEvaluation:
    """
    Evaluation of one submitted segment that overlaps at least one XML annotation.

    The strict span metrics require:
    - the expected source document
    - AND overlap with the expected source offsets
    """

    suspicious_reference: str
    segment_index: int
    segment_start_offset: int
    segment_end_offset: int

    expected_annotation_count: int

    found_document_count_at_k: dict[int, int]
    found_span_count_at_k: dict[int, int]

    all_expected_documents_found_at_k: dict[int, bool]
    all_expected_spans_found_at_k: dict[int, bool]

    document_coverage_at_k: dict[int, float]
    span_coverage_at_k: dict[int, float]

    def to_dict(self) -> dict:
        return {
            "suspicious_reference": self.suspicious_reference,
            "segment_index": self.segment_index,
            "segment_start_offset": self.segment_start_offset,
            "segment_end_offset": self.segment_end_offset,
            "expected_annotation_count": self.expected_annotation_count,
            "found_document_count_at_k": self.found_document_count_at_k,
            "found_span_count_at_k": self.found_span_count_at_k,
            "all_expected_documents_found_at_k": (
                self.all_expected_documents_found_at_k
            ),
            "all_expected_spans_found_at_k": (
                self.all_expected_spans_found_at_k
            ),
            "document_coverage_at_k": self.document_coverage_at_k,
            "span_coverage_at_k": self.span_coverage_at_k,
        }


@dataclass(frozen=True)
class DocumentRetrievalEvaluation:
    suspicious_reference: str

    submitted_segment_count: int
    candidate_count: int

    annotation_evaluations: list[AnnotationRetrievalEvaluation]
    segment_evaluations: list[SegmentRetrievalEvaluation]

    @property
    def annotation_count(self) -> int:
        return len(self.annotation_evaluations)

    @property
    def annotated_segment_count(self) -> int:
        return len(self.segment_evaluations)

    def to_dict(self) -> dict:
        return {
            "suspicious_reference": self.suspicious_reference,
            "submitted_segment_count": self.submitted_segment_count,
            "candidate_count": self.candidate_count,
            "annotation_count": self.annotation_count,
            "annotated_segment_count": self.annotated_segment_count,
            "annotation_evaluations": [
                evaluation.to_dict()
                for evaluation in self.annotation_evaluations
            ],
            "segment_evaluations": [
                evaluation.to_dict()
                for evaluation in self.segment_evaluations
            ],
        }


@dataclass(frozen=True)
class RetrievalEvaluationSummary:
    split: str
    mode: str

    documents_evaluated: int
    annotations_evaluated: int

    annotation_level: dict[str, Any]
    segment_level: dict[str, Any]
    candidate_volume: dict[str, Any]
    grouped_metrics: dict[str, Any]

    def to_dict(self) -> dict:
        return {
            "split": self.split,
            "mode": self.mode,
            "documents_evaluated": self.documents_evaluated,
            "annotations_evaluated": self.annotations_evaluated,
            "annotation_level": self.annotation_level,
            "segment_level": self.segment_level,
            "candidate_volume": self.candidate_volume,
            "grouped_metrics": self.grouped_metrics,
        }


## Verification Layer schema


HUMAN_REVIEW_MESSAGE = (
    "Potential similarity detected. Editorial review required."
)


@dataclass(frozen=True)
class OffsetRange:
    """Half-open character offsets in the original document text."""

    start: int
    end: int

    def __post_init__(self) -> None:
        if self.start < 0:
            raise ValueError("Offset start must be non-negative.")

        if self.end < self.start:
            raise ValueError("Offset end must be greater than or equal to start.")


@dataclass(frozen=True)
class RetrievalEvidence:
    """Retrieval information retained for analysis and explainability."""

    rank: int
    combined_ranking_score: float
    retrieval_methods: tuple[str, ...] = ()
    lexical_score: dict[str, Any] | None = None
    semantic_score: dict[str, Any] | None = None


@dataclass(frozen=True)
class DatasetGroundTruth:
    """ExAra-only supervision. This is never required in production."""

    expected_source_document_match: bool
    expected_source_span_overlap: bool
    matching_document_annotation_indices: tuple[int, ...] = ()
    matching_span_annotation_indices: tuple[int, ...] = ()
    obfuscations: tuple[str, ...] = ()
    plagiarism_types: tuple[str, ...] = ()


@dataclass(frozen=True)
class VerificationInput:
    """
    Model-independent input for one submitted/source candidate pair.

    The verifier sees text in ``representation_language``. A future
    translation layer can therefore create an English/English pair without
    changing this contract.
    """

    pair_id: str
    submitted_document_id: str
    submitted_segment_index: int
    submitted_offsets: OffsetRange
    submitted_text: str
    submitted_normalized_text: str
    submitted_language: str

    source_document_id: str
    source_document_internal_id: int | None
    source_segment_id: int | None
    source_segment_index: int
    source_offsets: OffsetRange
    source_text: str
    source_normalized_text: str
    source_language: str

    representation_language: str
    retrieval: RetrievalEvidence

    def model_texts(self, use_normalized_text: bool = False) -> tuple[str, str]:
        """Return the two texts selected for a verifier implementation."""
        if use_normalized_text:
            return (
                self.submitted_normalized_text,
                self.source_normalized_text,
            )

        return self.submitted_text, self.source_text

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class VerificationExample:
    """Training/evaluation example with an ExAra-derived binary label."""

    verification_input: VerificationInput
    label: int
    ground_truth: DatasetGroundTruth

    def __post_init__(self) -> None:
        if self.label not in {0, 1}:
            raise ValueError("Binary verification label must be 0 or 1.")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class VerificationResult:
    """
    Verifier evidence intended for human review, not an accusation.

    ``is_potential_match`` means the configured threshold was reached. The
    editor remains responsible for the final decision.
    """

    pair_id: str
    plagiarism_probability: float
    is_potential_match: bool
    threshold: float
    model_name: str
    model_version: str | None = None
    requires_human_review: bool = True
    review_message: str = HUMAN_REVIEW_MESSAGE
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not 0.0 <= self.plagiarism_probability <= 1.0:
            raise ValueError("Plagiarism probability must be between 0 and 1.")

        if not 0.0 <= self.threshold <= 1.0:
            raise ValueError("Verification threshold must be between 0 and 1.")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class VerificationDataSummary:
    """Small serializable report produced by the streaming data audit."""

    candidate_file: str
    candidate_metadata: dict[str, Any]
    text_field: str

    document_count: int
    segment_count: int
    candidate_count: int
    valid_example_count: int
    invalid_candidate_count: int

    positive_count: int
    negative_count: int
    positive_rate: float

    documents_with_positive_candidates: int
    segments_with_positive_candidates: int

    retrieval_method_counts: dict[str, int]
    positive_rank_counts: dict[str, int]
    negative_rank_counts: dict[str, int]
    positive_obfuscation_counts: dict[str, int]
    positive_plagiarism_type_counts: dict[str, int]

    submitted_character_lengths: dict[str, Any]
    source_character_lengths: dict[str, Any]
    tokenizer_name: str | None = None
    submitted_token_lengths: dict[str, Any] | None = None
    source_token_lengths: dict[str, Any] | None = None
    maximum_branch_token_lengths: dict[str, Any] | None = None

    validation_errors: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class PreparedVerificationRecord:
    """Compact, model-ready text pair stored in a prepared JSONL split."""

    pair_id: str
    submitted_document_id: str
    submitted_segment_index: int
    submitted_text: str

    source_document_id: str
    source_segment_id: int | None
    source_segment_index: int
    source_text: str

    label: int
    retrieval_rank: int
    obfuscations: tuple[str, ...] = ()
    plagiarism_types: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if self.label not in {0, 1}:
            raise ValueError("Binary verification label must be 0 or 1.")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class VerificationSplitSummary:
    """Counts for one document-level verifier data split."""

    file: str
    document_count: int
    example_count: int
    positive_count: int
    negative_count: int

    @property
    def positive_rate(self) -> float:
        if self.example_count == 0:
            return 0.0

        return self.positive_count / self.example_count

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["positive_rate"] = self.positive_rate
        return result


@dataclass(frozen=True)
class VerificationDataPreparationSummary:
    """Serializable report for document splitting and JSONL preparation."""

    candidate_file: str
    text_field: str
    validation_fraction: float
    random_seed: int
    negative_ratio: int
    train: VerificationSplitSummary
    validation: VerificationSplitSummary
    document_overlap_count: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "candidate_file": self.candidate_file,
            "text_field": self.text_field,
            "validation_fraction": self.validation_fraction,
            "random_seed": self.random_seed,
            "negative_ratio": self.negative_ratio,
            "train": self.train.to_dict(),
            "validation": self.validation.to_dict(),
            "document_overlap_count": self.document_overlap_count,
        }

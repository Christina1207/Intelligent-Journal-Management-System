from plagiarism_core.verification.candidate_reader import (
    CandidateJsonError,
    CandidateJsonReader,
)
from plagiarism_core.verification.data_audit import VerificationDataAuditor
from plagiarism_core.verification.data_preparation import (
    VerificationDataPreparationConfig,
    VerificationDataPreparer,
)
from plagiarism_core.verification.example_builder import (
    InvalidCandidateError,
    VerifierExampleBuilder,
    VerifierExampleBuilderConfig,
)
from plagiarism_core.verification.interfaces import PairVerifier
from plagiarism_core.verification.local_pair_verifier import (
    DEFAULT_CHECKPOINT_ID,
    DEFAULT_ENCODER_MODEL_ID,
    DEFAULT_VERIFIER_EPOCH,
    DEFAULT_VERIFIER_THRESHOLD,
    LocalAraT5PairVerifier,
    LocalAraT5PairVerifierConfig,
    LocalVerifierCheckpointInfo,
    inspect_compact_verifier_checkpoint,
    validate_compact_verifier_checkpoint_payload,
    validate_local_arat5_directory,
)
from plagiarism_core.verification.model_installation import (
    LOCAL_MODEL_MANIFEST_SCHEMA,
    LocalAraT5Installation,
    install_local_arat5,
)
from plagiarism_core.verification.metrics import (
    BinaryVerificationMetrics,
    average_precision,
    calculate_binary_metrics,
    select_f2_threshold,
)
from plagiarism_core.verification.span_aggregation import (
    AggregationConfig,
    AggregationSearchResult,
    DualSpanCoverageEvaluator,
    DualSpanGapAggregator,
    ValidationAggregationGridSearch,
)
from plagiarism_core.verification.siamese_model import (
    AraT5SiameseConfig,
    AraT5SiameseVerifier,
    ModelTrainabilitySummary,
)
from plagiarism_core.verification.training_data import (
    PreparedVerificationDataset,
    RotatingBalancedBatchSampler,
    SiameseBatchCollator,
    build_training_dataloader,
    build_validation_dataloader,
)
from plagiarism_core.verification.test_inference import (
    FrozenTestInferenceResult,
    FrozenVerifierTestInference,
    ReportReadyPredictionBatchCollator,
    build_test_prediction_dataloader,
)
from plagiarism_core.verification.test_preparation import (
    TestVerificationDataPreparer,
    TestVerificationPreparationResult,
)
from plagiarism_core.verification.validation_inference import (
    PredictionBatchCollator,
    ValidationInferenceResult,
    VerifierValidationInference,
    build_prediction_dataloader,
)
from plagiarism_core.verification.validation_enrichment import (
    ValidationEnrichmentResult,
    ValidationPredictionEnricher,
)
from plagiarism_core.verification.trainer import (
    EpochTrainingRecord,
    O1TrainingConfig,
    O1VerifierTrainer,
    TrainingRunResult,
    load_compact_verifier_checkpoint,
)
from plagiarism_core.schemas import (
    DatasetGroundTruth,
    OffsetRange,
    PreparedVerificationRecord,
    RetrievalEvidence,
    VerificationDataPreparationSummary,
    VerificationDataSummary,
    VerificationExample,
    VerificationInput,
    VerificationResult,
    VerificationSplitSummary,
)

__all__ = [
    "CandidateJsonError",
    "CandidateJsonReader",
    "AraT5SiameseConfig",
    "AraT5SiameseVerifier",
    "BinaryVerificationMetrics",
    "AggregationConfig",
    "AggregationSearchResult",
    "DatasetGroundTruth",
    "DualSpanCoverageEvaluator",
    "DualSpanGapAggregator",
    "InvalidCandidateError",
    "ModelTrainabilitySummary",
    "EpochTrainingRecord",
    "O1TrainingConfig",
    "O1VerifierTrainer",
    "OffsetRange",
    "PairVerifier",
    "DEFAULT_CHECKPOINT_ID",
    "DEFAULT_ENCODER_MODEL_ID",
    "DEFAULT_VERIFIER_EPOCH",
    "DEFAULT_VERIFIER_THRESHOLD",
    "LOCAL_MODEL_MANIFEST_SCHEMA",
    "LocalAraT5Installation",
    "LocalAraT5PairVerifier",
    "LocalAraT5PairVerifierConfig",
    "LocalVerifierCheckpointInfo",
    "PreparedVerificationDataset",
    "PreparedVerificationRecord",
    "FrozenTestInferenceResult",
    "FrozenVerifierTestInference",
    "ReportReadyPredictionBatchCollator",
    "RetrievalEvidence",
    "RotatingBalancedBatchSampler",
    "SiameseBatchCollator",
    "TestVerificationDataPreparer",
    "TestVerificationPreparationResult",
    "VerificationDataPreparationConfig",
    "VerificationDataPreparationSummary",
    "VerificationDataPreparer",
    "VerificationDataAuditor",
    "VerificationDataSummary",
    "VerificationExample",
    "VerificationInput",
    "VerificationResult",
    "VerificationSplitSummary",
    "VerifierExampleBuilder",
    "VerifierExampleBuilderConfig",
    "build_test_prediction_dataloader",
    "build_training_dataloader",
    "build_validation_dataloader",
    "average_precision",
    "calculate_binary_metrics",
    "inspect_compact_verifier_checkpoint",
    "install_local_arat5",
    "load_compact_verifier_checkpoint",
    "select_f2_threshold",
    "TrainingRunResult",
    "PredictionBatchCollator",
    "ValidationInferenceResult",
    "ValidationAggregationGridSearch",
    "ValidationEnrichmentResult",
    "ValidationPredictionEnricher",
    "VerifierValidationInference",
    "validate_compact_verifier_checkpoint_payload",
    "validate_local_arat5_directory",
    "build_prediction_dataloader",
]

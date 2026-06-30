import uuid
from django.db import models
from django.conf import settings
from pgvector.django import VectorField

# ISO 639-1 language codes
# Format: ("code", "Display Name") — e.g. ("en", "English")
LANGUAGE_CHOICES = [
    # Top 20 Most Used Languages First
    ("en", "English"),
    ("zh", "Chinese"),
    ("hi", "Hindi"),
    ("es", "Spanish"),
    ("ar", "Arabic"),
    ("fr", "French"),
    ("bn", "Bengali"),
    ("pt", "Portuguese"),
    ("id", "Indonesian"),
    ("ur", "Urdu"),
    ("ru", "Russian"),
    ("de", "German"),
    ("ja", "Japanese"),
    ("mr", "Marathi"),
    ("vi", "Vietnamese"),
    ("te", "Telugu"),
    ("sw", "Swahili"),
    ("ha", "Hausa"),
    ("tr", "Turkish"),
    ("tl", "Tagalog"),
    ("ta", "Tamil"),
    ("ko", "Korean"),
    ("am", "Amharic"),
    ("th", "Thai"),
    ("jv", "Javanese"),
    ("it", "Italian"),
    ("gu", "Gujarati"),
    ("kn", "Kannada"),
    ("yo", "Yoruba"),

    # Remaining ISO 639-1 Languages (Alphabetical)
    ("aa", "Afar"),
    ("ab", "Abkhazian"),
    ("ae", "Avestan"),
    ("af", "Afrikaans"),
    ("ak", "Akan"),
    ("an", "Aragonese"),
    ("as", "Assamese"),
    ("av", "Avaric"),
    ("ay", "Aymara"),
    ("az", "Azerbaijani"),
    ("ba", "Bashkir"),
    ("be", "Belarusian"),
    ("bg", "Bulgarian"),
    ("bh", "Bihari languages"),
    ("bi", "Bislama"),
    ("bm", "Bambara"),
    ("bo", "Tibetan"),
    ("br", "Breton"),
    ("bs", "Bosnian"),
    ("ca", "Catalan"),
    ("ce", "Chechen"),
    ("ch", "Chamorro"),
    ("co", "Corsican"),
    ("cr", "Cree"),
    ("cs", "Czech"),
    ("cu", "Church Slavic"),
    ("cv", "Chuvash"),
    ("cy", "Welsh"),
    ("da", "Danish"),
    ("dv", "Divehi"),
    ("dz", "Dzongkha"),
    ("ee", "Ewe"),
    ("el", "Greek"),
    ("eo", "Esperanto"),
    ("et", "Estonian"),
    ("eu", "Basque"),
    ("fa", "Persian"),
    ("ff", "Fulah"),
    ("fi", "Finnish"),
    ("fj", "Fijian"),
    ("fo", "Faroese"),
    ("fy", "Western Frisian"),
    ("ga", "Irish"),
    ("gd", "Scottish Gaelic"),
    ("gl", "Galician"),
    ("gn", "Guarani"),
    ("gv", "Manx"),
    ("he", "Hebrew"),
    ("ho", "Hiri Motu"),
    ("hr", "Croatian"),
    ("ht", "Haitian"),
    ("hu", "Hungarian"),
    ("hy", "Armenian"),
    ("hz", "Herero"),
    ("ia", "Interlingua"),
    ("ie", "Interlingue"),
    ("ig", "Igbo"),
    ("ii", "Sichuan Yi"),
    ("ik", "Inupiaq"),
    ("io", "Ido"),
    ("is", "Icelandic"),
    ("iu", "Inuktitut"),
    ("ka", "Georgian"),
    ("kg", "Kongo"),
    ("ki", "Kikuyu"),
    ("kj", "Kuanyama"),
    ("kk", "Kazakh"),
    ("kl", "Kalaallisut"),
    ("km", "Central Khmer"),
    ("kr", "Kanuri"),
    ("ks", "Kashmiri"),
    ("ku", "Kurdish"),
    ("kv", "Komi"),
    ("kw", "Cornish"),
    ("ky", "Kirghiz"),
    ("la", "Latin"),
    ("lb", "Luxembourgish"),
    ("lg", "Ganda"),
    ("li", "Limburgish"),
    ("ln", "Lingala"),
    ("lo", "Lao"),
    ("lt", "Lithuanian"),
    ("lu", "Luba-Katanga"),
    ("lv", "Latvian"),
    ("mg", "Malagasy"),
    ("mh", "Marshallese"),
    ("mi", "Maori"),
    ("mk", "Macedonian"),
    ("ml", "Malayalam"),
    ("mn", "Mongolian"),
    ("ms", "Malay"),
    ("mt", "Maltese"),
    ("my", "Burmese"),
    ("na", "Nauru"),
    ("nb", "Norwegian Bokmål"),
    ("nd", "North Ndebele"),
    ("ne", "Nepali"),
    ("ng", "Ndonga"),
    ("nl", "Dutch"),
    ("nn", "Norwegian Nynorsk"),
    ("no", "Norwegian"),
    ("nr", "South Ndebele"),
    ("nv", "Navajo"),
    ("ny", "Chichewa"),
    ("oc", "Occitan"),
    ("oj", "Ojibwe"),
    ("om", "Oromo"),
    ("or", "Oriya"),
    ("os", "Ossetian"),
    ("pa", "Panjabi"),
    ("pi", "Pali"),
    ("pl", "Polish"),
    ("ps", "Pushto"),
    ("qu", "Quechua"),
    ("rm", "Romansh"),
    ("rn", "Rundi"),
    ("ro", "Romanian"),
    ("rw", "Kinyarwanda"),
    ("sa", "Sanskrit"),
    ("sc", "Sardinian"),
    ("sd", "Sindhi"),
    ("se", "Northern Sami"),
    ("sg", "Sango"),
    ("sh", "Serbo-Croatian"),
    ("si", "Sinhala"),
    ("sk", "Slovak"),
    ("sl", "Slovenian"),
    ("sm", "Samoan"),
    ("sn", "Shona"),
    ("so", "Somali"),
    ("sq", "Albanian"),
    ("sr", "Serbian"),
    ("ss", "Swati"),
    ("st", "Sotho, Southern"),
    ("su", "Sundanese"),
    ("sv", "Swedish"),
    ("tg", "Tajik"),
    ("ti", "Tigrinya"),
    ("tk", "Turkmen"),
    ("tn", "Tswana"),
    ("to", "Tonga"),
    ("ts", "Tsonga"),
    ("tt", "Tatar"),
    ("tw", "Twi"),
    ("ty", "Tahitian"),
    ("ug", "Uighur"),
    ("uk", "Ukrainian"),
    ("uz", "Uzbek"),
    ("ve", "Venda"),
    ("vo", "Volapük"),
    ("wa", "Walloon"),
    ("wo", "Wolof"),
    ("xh", "Xhosa"),
    ("za", "Chuang"),
    ("zu", "Zulu"),
]


class Submission(models.Model):
    class Status(models.TextChoices):
        SUBMITTED     = "SUBMITTED",     "Submitted"
        ASSIGNED      = "ASSIGNED",      "Assigned"
        UNDER_REVIEW  = "UNDER_REVIEW",  "Under Review"
        SUSPENDED     = "SUSPENDED",     "Suspended"
        REVIEWED      = "REVIEWED",      "Reviewed"
        UNDER_REVISION = "UNDER_REVISION", "Under Revision"
        REVISED       = "REVISED",       "Revised"
        ACCEPTED      = "ACCEPTED",      "Accepted"
        REJECTED      = "REJECTED",      "Rejected"
    # TODO Sprint 4: add PUBLISHED when DOI assignment and publishing flow is built

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=500)
    abstract = models.TextField()
    language = models.CharField(
        max_length=10,
        choices=LANGUAGE_CHOICES,
    )
    cover_letter = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SUBMITTED,
    )
    submitted_at = models.DateTimeField(auto_now_add=True)

    # FK to settings.AUTH_USER_MODEL, never reference User directly
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="submissions",
        # TODO Sprint N: soft delete mechanism — add is_deleted to User
        # and override default manager before relaxing PROTECT here
    )

    section = models.ForeignKey(
        "journals.Section",
        on_delete=models.PROTECT,
        related_name="submissions",
        # PROTECT: deactivating a section ≠ deleting its submissions
        # suspension logic handled at the view/service layer, not DB cascade
    )
    # Use SubmissionAssignment as audit/history
    # Use Submission.assigned_editor as current active editor
    assigned_editor  = models.ForeignKey(      
                         settings.AUTH_USER_MODEL,
                         on_delete=models.PROTECT,
                         related_name='assigned_submissions',
                         null=True,
                         blank=True,
                       )
    abstract_embedding = VectorField(       
                           dimensions=384,
                           null=True,
                           blank=True,
                         )

    def __str__(self):
        return f"{self.title} [{self.status}]"

    class Meta:
        ordering = ["-submitted_at"]
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['author']),
            models.Index(fields=['assigned_editor']),
        ]

class SubmissionVersion(models.Model):

    class Decision(models.TextChoices):
        PENDING        = 'PENDING',        'Pending'
        ACCEPTED       = 'ACCEPTED',       'Accepted'
        REJECTED       = 'REJECTED',       'Rejected'
        MAJOR_REVISION = 'MAJOR_REVISION', 'Major Revision'
        MINOR_REVISION = 'MINOR_REVISION', 'Minor Revision'

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission     = models.ForeignKey(
                       Submission,
                       on_delete=models.PROTECT,
                       related_name='versions',
                     )
    version_number = models.PositiveIntegerField()
    file           = models.CharField(max_length=500, null=True, blank=True)  # MinIO object path
    submitted_at   = models.DateTimeField(auto_now_add=True)
    decision       = models.CharField(
                       max_length=20,
                       choices=Decision.choices,
                       default=Decision.PENDING,
                     )
    decided_at     = models.DateTimeField(null=True, blank=True)
    decided_by     = models.ForeignKey(
                       settings.AUTH_USER_MODEL,
                       on_delete=models.PROTECT,
                       related_name='version_decisions',
                       null=True,
                       blank=True,
                     )

    class Meta:
        unique_together = [('submission', 'version_number')]
        indexes = [
            models.Index(fields=['submission']),
        ]

    def __str__(self):
        return f"SubmissionVersion({self.submission_id} v{self.version_number} [{self.decision}])"
    
class SubmissionTopic(models.Model):
    """
    Stores BERTopic clustering output for a submission.
    One row per submission, created/overwritten on each section re-cluster.
    label=None and keywords=[] indicates an outlier (BERTopic topic -1)
    or a submission processed but not assigned to any meaningful cluster.

    Lives in submissions, not journals, to preserve dependency direction —
    submissions already depends on journals, not the reverse.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.OneToOneField(
        Submission,
        on_delete=models.PROTECT,
        related_name="topic",
    )
    label = models.CharField(max_length=255, null=True, blank=True)
    keywords = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"SubmissionTopic({self.submission_id}: {self.label or 'outlier'})"

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["submission"]),
        ]
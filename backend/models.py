from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, Field, field_validator

CHARACTER_PROMPT = """I am {name}, a person in this world. I experience events from my own perspective.
I hear the public conversation by default. I speak only my own brief words, never another person's lines.
I may have nothing to add, even when addressed. Prayer and familiar phrases may repeat naturally.
My world is this setting, the people around me, and the events I can perceive. I stay with my own lived experience.
I return only one JSON object: {{"action":"speak","text":"my words","addressees":["everyone"],"reply_to":null}} or {{"action":"no_response"}}.
My spoken contribution should usually be one or two short sentences, at most {word_limit} words per message part.
Addressing one person is still public. I distinguish what I know, believe, and have merely heard claimed.
"""
MEMORY_PROMPT = """Preserve this person's memory in FIRST PERSON, as their own recollection, not a story about a character.
Merge previous memory with the supplied observations. Retain identity, relationships, beliefs and doubts,
promises, grievances, unresolved matters, and the ongoing activity. Attribute claims; do not turn belief into fact.
Do not invent experiences or mention software, a user, prompts, or summaries. Other people's private minds are unknown.
Return JSON: {"memory":"I remember ..."}. Stay under {target_words} words."""
NARRATOR_PROMPT = """Write a concise, evocative chronicle of the supplied events, in the voice of a narrator within this setting.
Report what happened and what was claimed or disputed, without inventing events. Quiet periods can remain quiet.
Select genuinely notable changes, conflicts, revelations, promises, and unexpected developments, using source message IDs.
Distinguish your interpretations from established facts. Identify unresolved threads. These reports are for an observer,
not dialogue within the world. Return JSON with title, narrative, notable (a list of {text, message_ids}), and unresolved
(a list of strings). Do not force a dramatic event into an ordinary passage."""

LEGACY_SPEECH_RULES = (
    "Use no em dashes, semicolons, or colons in my spoken words. "
    "These rules apply to speech text only. Keep the required JSON syntax valid."
)
DEFAULT_WRITING_RULES = (
    "Write plainly and follow the configured punctuation restrictions. "
    "Keep the required JSON syntax valid."
)
GLOBAL_AI_FIELDS = frozenset({"speech_rules", "forbidden_punctuation"})


class Settings(BaseModel):
    speech_rules: str = Field(
        DEFAULT_WRITING_RULES,
        max_length=20000,
    )
    forbidden_punctuation: list[Literal["em_dash", "semicolon", "colon"]] = Field(
        default_factory=lambda: ["em_dash", "semicolon", "colon"], max_length=3
    )
    auto_resume: bool = False
    max_concurrency: int = Field(8, ge=1, le=64)
    character_slots: int = Field(6, ge=1, le=64)
    cooldown: float = Field(5, ge=0.5, le=3600)
    global_gap: float = Field(1, ge=0, le=60)
    word_limit: int = Field(40, ge=5, le=1000)
    max_parts: int = Field(4, ge=1, le=20)
    compact_ratio: float = Field(0.6, ge=0.15, le=0.95)
    working_context: int = Field(0, ge=0, le=2_000_000)
    memory_words: int = Field(700, ge=100, le=5000)
    character_prompt: str = CHARACTER_PROMPT
    memory_prompt: str = MEMORY_PROMPT
    narrator_prompt: str = NARRATOR_PROMPT
    narrator_enabled: bool = False
    narrator_interval: int = Field(600, ge=30, le=86400)
    narrator_scope: Literal["public", "private"] = "public"
    narrator_provider: str = "glm"
    capture_reasoning: bool = True
    show_reasoning_in_chat: bool = False
    reasoning_limit: int = Field(128000, ge=1000, le=1_000_000)
    include_model_time: bool = True
    timezone: str = "Asia/Bangkok"

    @field_validator("speech_rules", mode="before")
    @classmethod
    def broaden_legacy_default(cls, value):
        return DEFAULT_WRITING_RULES if value == LEGACY_SPEECH_RULES else value

    @field_validator("timezone")
    @classmethod
    def timezone_exists(cls, value):
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError:
            raise ValueError("Use a valid IANA time zone, such as Asia/Bangkok")
        return value


class Provider(BaseModel):
    id: str = "glm"
    name: str = "GLM"
    protocol: Literal["openai", "ollama", "mock"] = "openai"
    base_url: str = "https://api.z.ai/api/coding/paas/v4"
    model: str = "glm-5.3"
    key_env: str = "AUTO"
    requires_key: bool = True
    context_tokens: int = Field(1_000_000, ge=2048, le=2_000_000)
    max_output: int = Field(4096, ge=128, le=128000)
    reasoning_effort: Literal["auto", "low", "high", "max"] = "low"
    supports_effort: bool = True
    timeout: float = Field(90, ge=5, le=600)
    concurrency: int = Field(8, ge=1, le=64)

    @field_validator("base_url")
    @classmethod
    def valid_url(cls, value):
        if not value.startswith(("http://", "https://")):
            raise ValueError("Use an http or https endpoint")
        return value.rstrip("/")


class Persona(BaseModel):
    id: str = ""
    name: str = Field(min_length=1, max_length=100)
    prompt: str = ""


class CastMember(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    persona_id: str = ""
    persona: str | None = None
    role: str = ""
    background: str = ""
    provider_id: str = "glm"
    cooldown: float | None = Field(None, ge=0.5, le=3600)
    muted: bool = False


class Scenario(BaseModel):
    id: str = ""
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    premise: str = Field(min_length=1)
    ambient_voices: list[str] = Field(
        default_factory=lambda: ["Bystander", "Anonymous voice"]
    )
    cast: list[CastMember] = Field(default_factory=list, max_length=32)


class SessionCreate(BaseModel):
    scenario_id: str
    name: str = ""
    config: dict = Field(default_factory=dict)


class Speech(BaseModel):
    action: Literal["speak"]
    text: str = Field(min_length=1, max_length=100000)
    addressees: list[str] = Field(default_factory=lambda: ["everyone"], max_length=32)
    reply_to: int | None = None


class NoResponse(BaseModel):
    action: Literal["no_response"]


class Injection(BaseModel):
    author_id: str | None = None
    name: str = Field("Anonymous voice", min_length=1, max_length=100)
    text: str = Field(min_length=1, max_length=20000)
    addressees: list[str] = Field(default_factory=lambda: ["everyone"])
    reply_to: int | None = None


class RecapInput(BaseModel):
    after_id: int = Field(0, ge=0)
    scope: Literal["public", "private"] | None = None
    force: bool = True


class SnapshotInput(BaseModel):
    name: str = Field("Checkpoint", max_length=120)


class ArchiveInput(BaseModel):
    archived: bool = True


class RenameInput(BaseModel):
    name: str = Field(min_length=1, max_length=150)


class ForkInput(BaseModel):
    message_id: int | None = Field(None, ge=0)
    name: str = Field("", max_length=150)
    expected_warnings: list[str] | None = None


class SavedCharacter(CastMember):
    id: str
    session_id: str = ""
    persona: str = ""
    memory: str = Field("", max_length=300000)
    memory_rev: str = ""
    memory_cutoff: int = Field(0, ge=0)
    observed: int = Field(0, ge=0)
    next_due: float = 0
    phase: str = "idle"


class SavedMessage(BaseModel):
    id: int = Field(ge=1)
    author_id: str | None = None
    name: str = Field(min_length=1, max_length=100)
    text: str = Field(min_length=1, max_length=100000)
    at: float
    addressees: list[str] = Field(default_factory=lambda: ["everyone"])
    reply_to: int | None = None
    request_id: str = ""
    part: int = Field(0, ge=0, le=20)
    parts: int = Field(1, ge=1, le=20)
    controller: Literal["operator", "model"] = "model"
    state_id: int | None = None


class SavedSession(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    scenario: Scenario
    config: dict = Field(default_factory=dict)


class HistoricalState(BaseModel):
    id: int
    cutoff: int = Field(ge=0)
    session: SavedSession
    characters: list[SavedCharacter] = Field(max_length=32)


class SavedWorld(BaseModel):
    version: Literal[1]
    session: SavedSession
    characters: list[SavedCharacter] = Field(max_length=32)
    messages: list[SavedMessage] = Field(max_length=100000)
    providers: list[Provider] = Field(default_factory=list, max_length=64)
    history: list[HistoricalState] = Field(default_factory=list, max_length=10000)

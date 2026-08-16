from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SessionCreate(BaseModel):
    mode: str
    seed: str = Field(min_length=1, max_length=255)
    config_version: str = "zapn-simulator-v1.0"
    user_id: UUID | None = None


class SessionRead(SessionCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    started_at: datetime
    completed_at: datetime | None


class GameStart(BaseModel):
    game_id: str
    difficulty: str


class GameRead(GameStart):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    session_id: UUID
    started_at: datetime
    completed_at: datetime | None
    raw_score: float | None
    metrics_json: dict[str, Any]


class RoundCreate(BaseModel):
    round_number: int = Field(ge=1)
    stimulus_json: dict[str, Any]
    response_json: dict[str, Any]
    correct: bool
    reaction_time_ms: float = Field(ge=0)
    score: float


class EventCreate(BaseModel):
    round_number: int = Field(ge=0)
    event_type: str
    timestamp_ms: float = Field(ge=0)
    payload_json: dict[str, Any] = Field(default_factory=dict)


class EventBatch(BaseModel):
    events: list[EventCreate] = Field(min_length=1, max_length=100)


class GameComplete(BaseModel):
    raw_score: float = Field(ge=0, le=100)
    metrics_json: dict[str, Any]

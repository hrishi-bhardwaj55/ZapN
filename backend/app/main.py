import os
from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_session
from .models import Event, GameAttempt, PracticeSession, RoundAttempt
from .schemas import EventBatch, GameComplete, GameRead, GameStart, RoundCreate, SessionCreate, SessionRead

app = FastAPI(title="Cortex Practice API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/sessions", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
async def create_session(payload: SessionCreate, db: AsyncSession = Depends(get_session)):
    record = PracticeSession(**payload.model_dump())
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@app.get("/api/sessions/{session_id}", response_model=SessionRead)
async def read_session(session_id: UUID, db: AsyncSession = Depends(get_session)):
    record = await db.get(PracticeSession, session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")
    return record


@app.post("/api/sessions/{session_id}/games/start", response_model=GameRead, status_code=status.HTTP_201_CREATED)
async def start_game(session_id: UUID, payload: GameStart, db: AsyncSession = Depends(get_session)):
    if not await db.get(PracticeSession, session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    record = GameAttempt(session_id=session_id, **payload.model_dump())
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@app.post("/api/game-attempts/{attempt_id}/rounds", status_code=status.HTTP_201_CREATED)
async def create_round(attempt_id: UUID, payload: RoundCreate, db: AsyncSession = Depends(get_session)):
    if not await db.get(GameAttempt, attempt_id):
        raise HTTPException(status_code=404, detail="Game attempt not found")
    record = RoundAttempt(game_attempt_id=attempt_id, **payload.model_dump())
    db.add(record)
    await db.commit()
    return {"id": record.id}


@app.post("/api/game-attempts/{attempt_id}/events", status_code=status.HTTP_201_CREATED)
async def create_events(attempt_id: UUID, payload: EventBatch, db: AsyncSession = Depends(get_session)):
    if not await db.get(GameAttempt, attempt_id):
        raise HTTPException(status_code=404, detail="Game attempt not found")
    db.add_all([Event(game_attempt_id=attempt_id, **event.model_dump()) for event in payload.events])
    await db.commit()
    return {"accepted": len(payload.events)}


@app.post("/api/game-attempts/{attempt_id}/complete", response_model=GameRead)
async def complete_game(attempt_id: UUID, payload: GameComplete, db: AsyncSession = Depends(get_session)):
    record = await db.get(GameAttempt, attempt_id)
    if not record:
        raise HTTPException(status_code=404, detail="Game attempt not found")
    record.raw_score = payload.raw_score
    record.metrics_json = payload.metrics_json
    record.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(record)
    return record


@app.get("/api/users/{user_id}/history")
async def user_history(user_id: UUID, db: AsyncSession = Depends(get_session)):
    sessions = (await db.scalars(select(PracticeSession).where(PracticeSession.user_id == user_id).order_by(PracticeSession.started_at.desc()))).all()
    return {"sessions": [SessionRead.model_validate(item) for item in sessions]}


@app.get("/api/users/{user_id}/analytics")
async def user_analytics(user_id: UUID, db: AsyncSession = Depends(get_session)):
    attempts = (
        await db.scalars(
            select(GameAttempt)
            .join(PracticeSession)
            .where(PracticeSession.user_id == user_id, GameAttempt.completed_at.is_not(None))
        )
    ).all()
    grouped: dict[str, list[float]] = {}
    for attempt in attempts:
        grouped.setdefault(attempt.game_id, []).append(attempt.raw_score or 0)
    return {"games": {game: {"attempts": len(scores), "bestPracticeScore": max(scores)} for game, scores in grouped.items()}}

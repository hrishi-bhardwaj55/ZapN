"use client";

import { useEffect, useState } from "react";
import { createTelemetry } from "@/lib/engine";
import type { GameId } from "@/lib/types";

export function GameShell({
  title,
  eyebrow,
  round,
  total,
  score,
  children,
  aside,
}: {
  title: string;
  eyebrow: string;
  round: number;
  total: number;
  score?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="game-shell" aria-label={`${title} game`}>
      <header className="game-statusbar">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
        </div>
        <div className="game-status-metrics">
          <span>
            <small>ROUND</small>
            <strong>{Math.min(round + 1, total)} / {total}</strong>
          </span>
          {score && (
            <span>
              <small>LIVE</small>
              <strong>{score}</strong>
            </span>
          )}
        </div>
      </header>
      <div className="round-progress" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (round / total) * 100)}%` }} />
      </div>
      <div className={`game-stage${aside ? " with-aside" : ""}`}>
        <div className="game-playfield">{children}</div>
        {aside && <aside className="game-aside">{aside}</aside>}
      </div>
    </section>
  );
}

export function Feedback({
  tone,
  children,
}: {
  tone: "good" | "bad" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <div className={`feedback ${tone}`} role="status" aria-live="polite">
      {children}
    </div>
  );
}

export function useGameTelemetry(sessionId: string, gameId: GameId) {
  const [telemetry] = useState(() => createTelemetry(sessionId, gameId));

  useEffect(() => {
    telemetry.record("GAME_STARTED", 0);
    const onBlur = () => telemetry.record("FOCUS_LOST", 0, { source: "window" });
    const onVisibility = () => {
      if (document.hidden) telemetry.record("FOCUS_LOST", 0, { source: "visibility" });
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [telemetry]);
  return telemetry;
}

export function useCountdown(seconds = 3) {
  const [countdown, setCountdown] = useState(seconds);
  useEffect(() => {
    if (countdown <= 0) return;
    const timeout = window.setTimeout(() => setCountdown((value) => value - 1), 650);
    return () => window.clearTimeout(timeout);
  }, [countdown]);
  return countdown;
}

export function Countdown({ value }: { value: number }) {
  return (
    <div className="countdown-screen" aria-live="assertive">
      <span>GET READY</span>
      <strong>{value}</strong>
      <p>Focus the game area. Controls are active at zero.</p>
    </div>
  );
}

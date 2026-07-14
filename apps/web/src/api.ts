import type { MoveLog, Point, PuzzleDefinition } from "@pathweave/game";

const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:3001" : `${window.location.origin}/api`);
const TOKEN_KEY = "pathweave-access-token";
export const CLIENT_VERSION = "1.1.0";

export interface Identity { player: { id: string; nickname: string; shortCode: string }; accessToken: string; recoveryCode?: string }
export interface StarDetails { completion: boolean; optimal: boolean; challenge: boolean }
export interface RankingRow {
  id: string; nickname: string; short_code: string; rank: number; stars?: number; steps?: number; duration_ms?: number;
  total_stars?: number; total_steps?: number; total_duration_ms?: number; completed_days?: number;
}

export function requestHeaders(init: RequestInit | undefined, token: string | null) {
  const headers = new Headers();
  if (init?.body !== undefined && init.body !== null) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init, signal: init?.signal ?? controller.signal,
      headers: requestHeaders(init, token),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("网络响应超时，请重试");
    throw error;
  } finally { window.clearTimeout(timeout); }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "网络请求失败" }));
    throw new Error(error.message ?? "网络请求失败");
  }
  return response.json() as Promise<T>;
}

export function saveIdentity(identity: Identity) {
  localStorage.setItem(TOKEN_KEY, identity.accessToken);
  localStorage.setItem("pathweave-player", JSON.stringify(identity.player));
}

export function storedPlayer(): Identity["player"] | undefined {
  const value = localStorage.getItem("pathweave-player");
  return value ? JSON.parse(value) : undefined;
}

export const api = {
  createPlayer: () => request<Identity>("/v1/players/anonymous", { method: "POST" }),
  recover: (recoveryCode: string) => request<Identity>("/v1/players/recover", { method: "POST", body: JSON.stringify({ recoveryCode }) }),
  rename: (nickname: string) => request<{ nickname: string; shortCode: string }>("/v1/players/me", { method: "PATCH", body: JSON.stringify({ nickname }) }),
  profile: () => request<{ player: Identity["player"]; streak: number }>("/v1/players/me"),
  today: () => request<{ date: string; puzzle: PuzzleDefinition; serverTime: string; minClientVersion: string }>("/v1/puzzles/today"),
  start: () => request<{ attemptId: string; attemptToken: string; startedAt: string; expiresAt: string }>("/v1/attempts/start", { method: "POST" }),
  submit: (attemptId: string, data: { attemptToken: string; idempotencyKey: string; moves: Point[]; operationLog: MoveLog[] }) =>
    request<{ accepted: boolean; improved?: boolean; result: { stars: number; steps: number; durationMs: number; starDetails: StarDetails; rejectionReason?: string } }>(`/v1/attempts/${attemptId}/submit`, { method: "POST", body: JSON.stringify(data) }),
  dailyBoard: (date: string) => request<{ key: string; top: RankingRow[]; nearby: RankingRow[] }>(`/v1/leaderboards/daily/${date}`),
  seasonBoard: (month: string) => request<{ key: string; top: RankingRow[]; nearby: RankingRow[]; current: boolean }>(`/v1/leaderboards/seasons/${month}`),
};

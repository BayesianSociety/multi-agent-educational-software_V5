import { PUZZLES } from '../data/puzzles';
import type { PuzzleDefinition } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${url}`);
    if (!response.ok) {
      return fallback;
    }
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

async function safePost<T>(url: string, body: unknown, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      return fallback;
    }
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export async function fetchLevels(): Promise<PuzzleDefinition[]> {
  return safeFetch<PuzzleDefinition[]>('/api/levels', PUZZLES);
}

export async function fetchLevel(id: number): Promise<PuzzleDefinition | undefined> {
  return safeFetch<PuzzleDefinition | undefined>(`/api/levels/${id}`, PUZZLES.find((p) => p.id === id));
}

export async function startSession(payload: {
  user_id: string;
  user_agent: string;
  locale: string;
}): Promise<{ id: string }> {
  return safePost('/api/session/start', payload, { id: `session_local_${Date.now()}` } as { id: string });
}

export async function endSession(payload: { id: string; ended_at: number }): Promise<void> {
  await safePost('/api/session/end', payload, undefined);
}

export async function sendEventBatch(events: unknown[]): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/events/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events })
    });
  } catch {
    // intentionally no throw to keep gameplay available offline
  }
}

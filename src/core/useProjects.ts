"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { GameProject } from "./spec";
import {
  getProjectsSnapshot,
  getServerSnapshot,
  subscribeProjects,
} from "./store";

function parseProjects(raw: string): GameProject[] {
  try {
    return (JSON.parse(raw) as GameProject[]).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function useProjects() {
  const raw = useSyncExternalStore(subscribeProjects, getProjectsSnapshot, getServerSnapshot);
  return useMemo(() => parseProjects(raw), [raw]);
}

export function useProject(id: string) {
  const projects = useProjects();
  return projects.find((item) => item.id === id) ?? null;
}

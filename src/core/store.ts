import { uid } from "./ids";
import { currentSpec, type ChatMessage, type GameProject, type GameSpec } from "./spec";

const KEY = "gamelab-v2-projects";
const CHANGE = "gamelab-v2-change";

function readAll(): GameProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GameProject[]) : [];
  } catch {
    return [];
  }
}

function writeAll(projects: GameProject[]) {
  window.localStorage.setItem(KEY, JSON.stringify(projects));
  window.dispatchEvent(new Event(CHANGE));
}

export function subscribeProjects(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getProjectsSnapshot() {
  return window.localStorage.getItem(KEY) ?? "[]";
}

export function getServerSnapshot() {
  return "[]";
}

export function listProjects() {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getProject(id: string) {
  return readAll().find((item) => item.id === id) ?? null;
}

export function createProject(spec: GameSpec, firstReply: string) {
  const now = Date.now();
  const versionId = uid("ver");
  const project: GameProject = {
    id: spec.id,
    createdAt: now,
    updatedAt: now,
    published: false,
    currentVersionId: versionId,
    versions: [
      {
        id: versionId,
        label: "v1  游戏已生成",
        createdAt: now,
        spec,
      },
    ],
    messages: [
      {
        id: uid("msg"),
        role: "assistant",
        text: firstReply,
        at: now,
      },
    ],
  };
  writeAll([project, ...readAll().filter((item) => item.id !== spec.id)]);
  return project;
}

export function saveProject(project: GameProject) {
  const next = { ...project, updatedAt: Date.now() };
  writeAll([next, ...readAll().filter((item) => item.id !== project.id)]);
  return next;
}

export function pushVersion(project: GameProject, spec: GameSpec, label: string) {
  const version = {
    id: uid("ver"),
    label: `v${project.versions.length + 1}  ${label}`,
    createdAt: Date.now(),
    spec,
  };
  return saveProject({
    ...project,
    versions: [...project.versions, version],
    currentVersionId: version.id,
  });
}

export function restoreVersion(project: GameProject, versionId: string) {
  const version = project.versions.find((item) => item.id === versionId);
  if (!version) return project;
  return saveProject({
    ...project,
    currentVersionId: versionId,
    messages: [
      ...project.messages,
      {
        id: uid("msg"),
        role: "assistant",
        text: `已恢复到 ${version.label}。后面的修改都还在历史里。`,
        at: Date.now(),
      },
    ],
  });
}

export function appendMessages(project: GameProject, messages: ChatMessage[]) {
  return saveProject({
    ...project,
    messages: [...project.messages, ...messages],
  });
}

export function publishProject(project: GameProject) {
  return saveProject({ ...project, published: true });
}

export function compareVersions(project: GameProject, leftId: string, rightId?: string) {
  const left = project.versions.find((item) => item.id === leftId);
  const right =
    project.versions.find((item) => item.id === (rightId ?? project.currentVersionId)) ??
    currentSpec(project);
  return { left, right };
}

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { uid } from "./ids";
import type { CapabilityJob } from "./capabilityTypes";
import type { GameType } from "./spec";

const filePath = () => path.join(process.cwd(), "data", "capability-jobs.json");

async function readJobs(): Promise<CapabilityJob[]> {
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as CapabilityJob[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeJobs(jobs: CapabilityJob[]) {
  await mkdir(path.dirname(filePath()), { recursive: true });
  await writeFile(filePath(), JSON.stringify(jobs.slice(0, 80), null, 2), "utf8");
}

export async function listCapabilityJobs() {
  return (await readJobs()).sort((a, b) => b.at - a.at);
}

export async function recordCapabilityJob(input: Omit<CapabilityJob, "id" | "at">) {
  const jobs = await readJobs();
  const next: CapabilityJob = { ...input, id: uid("cap"), at: Date.now() };
  jobs.unshift(next);
  await writeJobs(jobs);
  return next;
}

export async function recordPlayRequest(gameType: GameType, gameId: string, message: string, status: CapabilityJob["status"], note: string, capabilityId?: string) {
  return recordCapabilityJob({ gameType, gameId, message, status, note, capabilityId });
}

export async function updateCapabilityJob(id: string, patch: Partial<CapabilityJob>) {
  const jobs = await readJobs();
  const index = jobs.findIndex((item) => item.id === id);
  if (index < 0) return null;
  jobs[index] = { ...jobs[index], ...patch };
  await writeJobs(jobs);
  return jobs[index];
}

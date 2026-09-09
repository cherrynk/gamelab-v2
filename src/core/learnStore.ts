import { writeFile } from "fs/promises";
import path from "path";
import type { LearnedCapability } from "./capabilityTypes";
import { learnedCapabilities } from "./learnedCapabilities";

export function listLearned() {
  return learnedCapabilities;
}

export async function persistLearned(item: LearnedCapability) {
  if (learnedCapabilities.some((row) => row.id === item.id || row.extrasKey === item.extrasKey)) {
    return item;
  }
  learnedCapabilities.push(item);
  const file = path.join(process.cwd(), "src/core/learnedCapabilities.ts");
  const body = `import type { LearnedCapability } from "./capabilityTypes";\n\nexport const learnedCapabilities: LearnedCapability[] = ${JSON.stringify(
    learnedCapabilities,
    null,
    2,
  )};\n`;
  await writeFile(file, body, "utf8");
  return item;
}

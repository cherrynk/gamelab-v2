import { listCapabilityJobs } from "@/core/capabilityJobs";
import { learnedCapabilities } from "@/core/learnedCapabilities";

export async function GET() {
  return Response.json({
    jobs: await listCapabilityJobs(),
    learned: learnedCapabilities,
  });
}

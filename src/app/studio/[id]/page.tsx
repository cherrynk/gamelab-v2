import StudioShell from "@/components/StudioShell";

export default async function StudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StudioShell id={id} />;
}

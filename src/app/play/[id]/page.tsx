import PlayView from "@/components/PlayView";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PlayView id={id} />;
}

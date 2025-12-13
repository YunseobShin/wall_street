import { BriefingDetailClient } from "@/components/BriefingDetailClient";

export default async function BriefingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BriefingDetailClient id={id} />;
}



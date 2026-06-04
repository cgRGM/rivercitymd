import { ServiceEditor } from "@/components/forms/admin/service-editor";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditServicePage({ params }: Props) {
  const { id } = await params;
  return <ServiceEditor mode="edit" serviceId={id as Id<"services">} />;
}

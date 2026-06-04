import { ServiceEditor, type ServiceEditorType } from "@/components/forms/admin/service-editor";

type Props = {
  searchParams: Promise<{ type?: string }>;
};

export default async function NewServicePage({ searchParams }: Props) {
  const { type } = await searchParams;
  const initialType: ServiceEditorType =
    type === "addon" || type === "subscription" ? type : "standard";

  return <ServiceEditor mode="create" initialType={initialType} />;
}

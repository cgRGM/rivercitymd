import { View } from "react-native";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Text } from "@/components/ui/text";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="gap-2 py-5">
        <CardTitle>{title}</CardTitle>
        <Text className="text-sm leading-5 text-muted-foreground">{description}</Text>
      </CardContent>
    </Card>
  );
}

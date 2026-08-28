import { AuthView } from "@clerk/expo/native";
import { View } from "react-native";

export default function SignUpScreen() {
  return (
    <View className="flex-1 bg-background">
      <AuthView mode="signUp" isDismissible={false} />
    </View>
  );
}

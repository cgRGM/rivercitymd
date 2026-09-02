import { Image, View } from "react-native";

export function BrandMark() {
  return (
    <View className="h-11 w-11 overflow-hidden rounded-2xl bg-primary">
      <Image
        accessibilityLabel="RiverCityMD logo"
        className="h-full w-full"
        resizeMode="cover"
        source={require("../assets/images/brand-logo.png")}
      />
    </View>
  );
}

import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { palette } from "@/constants/theme";
import { paramOne } from "@/lib/router-params";

export default function BookingConfirmationScreen() {
  const { id: idRaw } = useLocalSearchParams<{ id: string }>();
  const id = paramOne(idRaw);

  return (
    <View style={{ flex: 1, backgroundColor: palette.slate50, padding: 20, justifyContent: "center" }}>
      <SurfaceCard>
        <AppText variant="title" style={{ marginBottom: 8 }}>
          Booking confirmed
        </AppText>
        <AppText variant="body" style={{ color: palette.slate600, marginBottom: 20 }}>
          Your reference is #{id}. You can view this trip under My trips.
        </AppText>
        <PrimaryButton title="My trips" onPress={() => router.replace("/(tabs)/bookings")} />
        <PrimaryButton
          title="Book another"
          variant="outline"
          onPress={() => router.replace("/(tabs)")}
          style={{ marginTop: 12 }}
        />
      </SurfaceCard>
    </View>
  );
}

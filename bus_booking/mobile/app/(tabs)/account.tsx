import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { palette } from "@/constants/theme";
import { userApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { MeResponse } from "@/lib/types";

export default function AccountScreen() {
  const { access, getValidToken, logout } = useAuth();
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!access) {
      setProfile(null);
      return;
    }
    setLoading(true);
    try {
      const token = await getValidToken();
      if (!token) {
        setProfile(null);
        return;
      }
      const me = await userApi.me(token);
      setProfile(me);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [access, getValidToken]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  if (!access) {
    return (
      <View style={styles.center}>
        <SurfaceCard>
          <AppText variant="title" style={{ marginBottom: 8 }}>
            Account
          </AppText>
          <AppText variant="body" style={{ marginBottom: 20 }}>
            Sign in with the same account you use on the e-GO website.
          </AppText>
          <PrimaryButton title="Sign in" onPress={() => router.push("/login")} />
        </SurfaceCard>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SurfaceCard>
        {loading ? (
          <ActivityIndicator color={palette.indigo600} />
        ) : profile ? (
          <>
            <AppText variant="caption" style={{ marginBottom: 4 }}>
              Signed in as
            </AppText>
            <AppText variant="title" style={{ marginBottom: 4 }}>
              {profile.name || profile.username}
            </AppText>
            <AppText variant="body">{profile.email}</AppText>
            {profile.phone ? (
              <AppText variant="body" style={{ marginTop: 4 }}>
                {profile.phone}
              </AppText>
            ) : null}
            <AppText variant="caption" style={{ marginTop: 12 }}>
              Role: {profile.role}
            </AppText>
          </>
        ) : (
          <AppText variant="body">Could not load profile.</AppText>
        )}
        <PrimaryButton title="Sign out" variant="outline" onPress={() => void logout()} style={{ marginTop: 24 }} />
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.slate50, padding: 20 },
  center: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: palette.slate50 },
});

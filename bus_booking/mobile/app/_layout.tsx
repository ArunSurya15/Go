import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import "react-native-reanimated";

import { AuthProvider } from "@/lib/auth-context";
import { SearchDraftProvider } from "@/lib/search-draft-context";
import { egoDarkTheme, egoLightTheme } from "@/constants/navigation-theme";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const navTheme = colorScheme === "dark" ? egoDarkTheme : egoLightTheme;

  return (
    <ThemeProvider value={navTheme}>
      <AuthProvider>
        <SearchDraftProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="login"
              options={{
                title: "Sign in",
                presentation: "modal",
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen name="search" options={{ title: "Find buses", headerShadowVisible: false }} />
            <Stack.Screen
              name="location-picker"
              options={{
                title: "Search",
                presentation: "modal",
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen name="schedule-results" options={{ title: "Trips", headerShadowVisible: false }} />
            <Stack.Screen name="schedule/[id]" options={{ title: "Trip", headerShadowVisible: false }} />
            <Stack.Screen name="select-seats" options={{ title: "Seats", headerShadowVisible: false }} />
            <Stack.Screen name="board-drop" options={{ title: "Board & drop", headerShadowVisible: false }} />
            <Stack.Screen name="passenger" options={{ title: "Passengers", headerShadowVisible: false }} />
            <Stack.Screen name="payment" options={{ title: "Payment", headerShadowVisible: false }} />
            <Stack.Screen name="booking/[id]" options={{ title: "Confirmed", headerShadowVisible: false }} />
          </Stack>
        </SearchDraftProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

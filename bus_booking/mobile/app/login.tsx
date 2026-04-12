import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
  Keyboard,
} from "react-native";

import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { fonts, palette, radii } from "@/constants/theme";
import { getApiBase } from "@/lib/config";
import { useAuth } from "@/lib/auth-context";

export default function LoginScreen() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async () => {
    setErr("");
    if (!identifier.trim() || !password) {
      setErr("Enter email or phone and password.");
      return;
    }
    setBusy(true);
    try {
      await login(identifier.trim(), password);
      router.back();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <SurfaceCard style={styles.card}>
            <AppText variant="title" style={{ marginBottom: 6 }}>
              Welcome back
            </AppText>
            <AppText variant="body" style={{ marginBottom: 20 }}>
              Use your e-GO passenger account.
            </AppText>
            {__DEV__ ? (
              <AppText variant="caption" style={{ marginBottom: 16, color: palette.slate500 }}>
                Dev API: {getApiBase()}
              </AppText>
            ) : null}

            <AppText variant="label" style={styles.label}>
              Email or phone
            </AppText>
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={palette.slate500}
              style={styles.input}
            />

            <AppText variant="label" style={[styles.label, { marginTop: 14 }]}>
              Password
            </AppText>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={palette.slate500}
              style={styles.input}
            />

            {err ? (
              <AppText variant="caption" style={styles.err}>
                {err}
              </AppText>
            ) : null}

            <PrimaryButton title="Sign in" loading={busy} onPress={() => void onSubmit()} style={{ marginTop: 22 }} />
          </SurfaceCard>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.slate50,
    padding: 20,
    justifyContent: "center",
  },
  card: { maxWidth: 440, width: "100%", alignSelf: "center" },
  label: { marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: palette.slate200,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: 16,
    fontFamily: fonts.regular,
    backgroundColor: palette.slate50,
    color: palette.slate900,
  },
  err: { color: palette.rose500, marginTop: 12 },
});

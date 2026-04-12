import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { palette } from "@/constants/theme";
import { formatRupee } from "@/lib/format";
import { getApiBase } from "@/lib/config";
import { clearBookingFlow, getBookingFlow } from "@/lib/booking-flow";
import { bookingApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const { access, isReady, getValidToken } = useAuth();
  const [flow, setFlow] = useState<Awaited<ReturnType<typeof getBookingFlow>>>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getBookingFlow().then(setFlow);
  }, []);

  const simulatePayment = async (orderId: string) => {
    const base = getApiBase();
    await fetch(`${base}/api/payment/webhook/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_demo_mobile",
              order_id: orderId,
            },
          },
        },
      }),
    });
  };

  const onPay = async () => {
    setErr("");
    const latest = (await getBookingFlow()) || flow;
    if (!latest?.schedule_id || !latest.seats?.length) {
      setErr("Missing booking details. Go back to seat selection.");
      return;
    }
    const token = await getValidToken();
    if (!token) {
      router.push("/login");
      return;
    }
    setBusy(true);
    try {
      const amount =
        latest.amount ||
        String(parseFloat(latest.fare || "0") * (latest.seats?.length ?? 0));
      const payload = {
        schedule_id: latest.schedule_id,
        seats: latest.seats,
        amount,
        boarding_point_id: latest.boarding_point_id,
        dropping_point_id: latest.dropping_point_id,
        contact_phone: latest.contact_phone ?? "",
        contact_email: latest.email ?? "",
        state_of_residence: latest.state_of_residence ?? "",
        whatsapp_opt_in: latest.whatsapp_opt_in ?? false,
        passengers: latest.passengers,
      };
      const res = await bookingApi.createPayment(token, payload);
      await simulatePayment(res.order_id);
      await clearBookingFlow();
      router.replace({
        pathname: "/booking/[id]",
        params: { id: String(res.booking_id) },
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Payment failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!isReady) return <View style={styles.center} />;

  if (!access) {
    return (
      <View style={[styles.center, { padding: 20 }]}>
        <PrimaryButton title="Sign in" onPress={() => router.push("/login")} />
      </View>
    );
  }

  if (!flow?.schedule_id) {
    return (
      <View style={[styles.center, { padding: 20 }]}>
        <AppText style={{ textAlign: "center" }}>Loading booking…</AppText>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
    >
      <AppText variant="caption" style={styles.step}>
        Step 4 of 4 · Pay
      </AppText>

      <SurfaceCard style={{ marginBottom: 16 }}>
        <AppText variant="title" style={{ marginBottom: 8 }}>
          Summary
        </AppText>
        <AppText variant="body" style={{ marginBottom: 4 }}>
          {flow.from} → {flow.to}
        </AppText>
        <AppText variant="caption" style={{ color: palette.slate600, marginBottom: 12 }}>
          Seats: {(flow.seats || []).join(", ")}
        </AppText>
        <AppText style={styles.big}>
          {formatRupee(flow.amount || "0")}
        </AppText>
        <AppText variant="caption" style={{ color: palette.slate500, marginTop: 6 }}>
          Demo: we simulate a successful payment (same as the website dev flow).
        </AppText>
      </SurfaceCard>

      {err ? (
        <AppText style={{ color: palette.rose500, marginBottom: 12 }}>{err}</AppText>
      ) : null}

      <PrimaryButton
        title={busy ? "Processing…" : "Pay & confirm"}
        loading={busy}
        onPress={() => void onPay()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.slate50 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  step: { color: palette.slate500, marginBottom: 12 },
  big: { fontSize: 28, fontWeight: "700", color: palette.indigo700 },
});

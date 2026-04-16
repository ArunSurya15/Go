import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { fonts, palette, radii } from "@/constants/theme";
import { formatRupee } from "@/lib/format";
import { getApiBase } from "@/lib/config";
import { clearBookingFlow, getBookingFlow } from "@/lib/booking-flow";
import { bookingApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { seatFareBreakup } from "@/lib/fare-breakup";

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const { access, isReady, getValidToken } = useAuth();
  const [flow, setFlow] = useState<Awaited<ReturnType<typeof getBookingFlow>>>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [breakupOpen, setBreakupOpen] = useState(false);

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
        payload: { payment: { entity: { id: "pay_demo_mobile", order_id: orderId } } },
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
    if (!token) { router.push("/login"); return; }
    setBusy(true);
    try {
      const amount =
        latest.amount || String(parseFloat(latest.fare || "0") * (latest.seats?.length ?? 0));
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
      router.replace({ pathname: "/booking/[id]", params: { id: String(res.booking_id) } });
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

  // ── derived fare data ──────────────────────────────────────────────────────
  const seatCount = flow.seats?.length ?? 1;
  const farePerSeat = parseFloat(flow.fare || "0");
  const totalAmount = parseFloat(flow.amount || String(farePerSeat * seatCount));
  const perSeatBreakup = seatFareBreakup(farePerSeat);
  const totalBreakup = seatFareBreakup(totalAmount);
  const gstPct = Math.round(perSeatBreakup.gstRate * 100);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <AppText variant="caption" style={styles.step}>Step 4 of 4 · Pay</AppText>

        {/* ── trip summary ── */}
        <SurfaceCard style={styles.card}>
          <AppText variant="label" style={styles.cardLabel}>Trip summary</AppText>
          <AppText variant="title" style={styles.routeText}>
            {flow.from} → {flow.to}
          </AppText>
          <AppText variant="caption" style={styles.seatsText}>
            {seatCount} seat{seatCount === 1 ? "" : "s"}: {(flow.seats || []).join(", ")}
          </AppText>
        </SurfaceCard>

        {/* ── fare breakup (collapsible) ── */}
        <SurfaceCard style={styles.card}>
          <Pressable
            style={styles.fareHeader}
            onPress={() => setBreakupOpen((v) => !v)}
          >
            <AppText variant="label" style={{ color: palette.slate700 }}>Fare breakup</AppText>
            <MaterialCommunityIcons
              name={breakupOpen ? "chevron-up" : "chevron-down"}
              size={20}
              color={palette.slate500}
            />
          </Pressable>

          {!breakupOpen ? (
            <View style={styles.collapsedRow}>
              <AppText variant="body" style={{ color: palette.slate600, flex: 1 }}>
                {seatCount} seat{seatCount === 1 ? "" : "s"} × {formatRupee(farePerSeat)} (incl. {gstPct}% GST)
              </AppText>
              <AppText style={styles.collapsedTotal}>{formatRupee(totalAmount)}</AppText>
            </View>
          ) : (
            <View style={styles.breakRows}>
              {/* per-seat breakdown */}
              <AppText variant="caption" style={styles.breakGroupLabel}>Per seat</AppText>
              <View style={styles.breakRow}>
                <AppText variant="body" style={styles.breakLabel}>Seat fare (excl. GST, approx.)</AppText>
                <AppText variant="body" style={styles.breakVal}>
                  {formatRupee(Math.round(perSeatBreakup.baseExclGst))}
                </AppText>
              </View>
              <View style={styles.breakRow}>
                <AppText variant="body" style={styles.breakLabel}>GST ({gstPct}%, included)</AppText>
                <AppText variant="body" style={styles.breakVal}>
                  {formatRupee(Math.round(perSeatBreakup.gstAmount))}
                </AppText>
              </View>
              <View style={styles.breakRow}>
                <AppText variant="body" style={styles.breakLabel}>Fare per seat</AppText>
                <AppText variant="body" style={[styles.breakVal, { fontFamily: fonts.semibold }]}>
                  {formatRupee(farePerSeat)}
                </AppText>
              </View>

              {/* total breakdown */}
              {seatCount > 1 ? (
                <>
                  <View style={styles.breakDivider} />
                  <AppText variant="caption" style={styles.breakGroupLabel}>{seatCount} seats total</AppText>
                  <View style={styles.breakRow}>
                    <AppText variant="body" style={styles.breakLabel}>Base fare (excl. GST, approx.)</AppText>
                    <AppText variant="body" style={styles.breakVal}>
                      {formatRupee(Math.round(totalBreakup.baseExclGst))}
                    </AppText>
                  </View>
                  <View style={styles.breakRow}>
                    <AppText variant="body" style={styles.breakLabel}>GST ({gstPct}%, total)</AppText>
                    <AppText variant="body" style={styles.breakVal}>
                      {formatRupee(Math.round(totalBreakup.gstAmount))}
                    </AppText>
                  </View>
                </>
              ) : null}

              <View style={styles.breakRow}>
                <AppText variant="body" style={styles.breakLabel}>Platform / convenience fee</AppText>
                <AppText variant="body" style={styles.breakVal}>
                  {formatRupee(totalBreakup.platformFee)}
                </AppText>
              </View>
              <View style={[styles.breakRow, styles.breakTotalRow]}>
                <AppText style={styles.breakTotalLabel}>Total you pay</AppText>
                <AppText style={styles.breakTotalVal}>{formatRupee(totalAmount)}</AppText>
              </View>
              <AppText variant="caption" style={styles.disclaimer}>
                Exact tax lines and state levies appear on your ticket. GST split is an estimate when only the inclusive fare is shown.
              </AppText>
            </View>
          )}
        </SurfaceCard>

        {err ? (
          <AppText style={{ color: palette.rose500, marginBottom: 12 }}>{err}</AppText>
        ) : null}

        <AppText variant="caption" style={styles.demoNote}>
          Demo: we simulate a successful payment (same as the website dev flow).
        </AppText>
      </ScrollView>

      {/* ── sticky pay footer ── */}
      <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.stickyLeft}>
          <AppText variant="caption" style={styles.stickyLabel}>Total</AppText>
          <AppText style={styles.stickyAmount}>{formatRupee(totalAmount)}</AppText>
        </View>
        <PrimaryButton
          title={busy ? "Processing…" : "Pay & confirm"}
          loading={busy}
          style={styles.stickyBtn}
          onPress={() => void onPay()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.slate50 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  step: { color: palette.slate500, marginBottom: 12 },
  card: { marginBottom: 14 },

  // trip summary
  cardLabel: { color: palette.slate500, marginBottom: 6 },
  routeText: { fontSize: 18, marginBottom: 4 },
  seatsText: { color: palette.slate600 },

  // fare breakup
  fareHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2 },
  collapsedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 12 },
  collapsedTotal: { fontFamily: fonts.bold, fontSize: 20, color: palette.indigo700 },
  breakRows: { marginTop: 12, gap: 10 },
  breakGroupLabel: {
    color: palette.slate400,
    fontFamily: fonts.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  breakDivider: { height: 1, backgroundColor: palette.slate100, marginVertical: 4 },
  breakRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  breakLabel: { color: palette.slate600, flex: 1 },
  breakVal: { fontFamily: fonts.medium, color: palette.slate900 },
  breakTotalRow: { marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.slate200 },
  breakTotalLabel: { fontFamily: fonts.bold, fontSize: 16, color: palette.indigo900 },
  breakTotalVal: { fontFamily: fonts.bold, fontSize: 16, color: palette.indigo700 },
  disclaimer: { marginTop: 8, color: palette.slate400, lineHeight: 18 },

  demoNote: { color: palette.slate400, textAlign: "center", marginTop: 4 },

  // sticky footer
  stickyFooter: {
    backgroundColor: palette.white,
    borderTopWidth: 1,
    borderTopColor: palette.slate100,
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  stickyLeft: { flex: 1 },
  stickyLabel: { color: palette.slate500 },
  stickyAmount: { fontFamily: fonts.bold, fontSize: 22, color: palette.indigo700 },
  stickyBtn: { flex: 1.6 },
});

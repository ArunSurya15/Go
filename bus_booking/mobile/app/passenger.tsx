import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { fonts, palette, radii } from "@/constants/theme";
import { getBookingFlow, mergeBookingFlow } from "@/lib/booking-flow";
import { computeFemaleOnlySeatLabels } from "@/lib/seat-rules";
import { paramOne } from "@/lib/router-params";
import { routesApi } from "@/lib/api";
import type { SeatMapResponse } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

const STATES = [
  "Andhra Pradesh",
  "Karnataka",
  "Kerala",
  "Tamil Nadu",
  "Maharashtra",
  "Delhi",
  "Puducherry",
  "Telangana",
  "Other",
];

type PInfo = { name: string; age: string; gender: string };

function isMale(g: string) {
  const u = g.trim().toUpperCase();
  return u === "M" || u === "MALE";
}

export default function PassengerScreen() {
  const insets = useSafeAreaInsets();
  const { access, isReady } = useAuth();
  const { schedule_id: sidRaw } = useLocalSearchParams<{ schedule_id: string }>();
  const scheduleId = Number(paramOne(sidRaw));

  const [flow, setFlow] = useState<Awaited<ReturnType<typeof getBookingFlow>>>(null);
  const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [stateRes, setStateRes] = useState("");
  const [whatsapp, setWhatsapp] = useState(true);
  const [passengers, setPassengers] = useState<Record<string, PInfo>>({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const f = await getBookingFlow();
      if (!alive) return;
      setFlow(f);
      if (f?.contact_phone) setPhone(f.contact_phone);
      if (f?.email) setEmail(f.email);
      if (f?.state_of_residence) setStateRes(f.state_of_residence);
      if (f?.whatsapp_opt_in !== undefined) setWhatsapp(f.whatsapp_opt_in);
      if (f?.seats?.length) {
        const p: Record<string, PInfo> = {};
        f.seats.forEach((s) => {
          const prev = f.passengers?.[s];
          p[s] = {
            name: prev?.name ?? "",
            age: prev?.age ?? "",
            gender: prev?.gender ?? "",
          };
        });
        setPassengers(p);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!scheduleId) return;
    routesApi.scheduleSeatMap(scheduleId).then(setSeatMap).catch(() => {});
  }, [scheduleId]);

  const femaleOnly = useMemo(() => {
    if (!seatMap) return new Set<string>();
    const occ = new Set(seatMap.occupied);
    const gm = new Map<string, string>();
    seatMap.occupied_details?.forEach((o) => {
      if (o.label) gm.set(o.label, (o.gender || "").toString().toUpperCase());
    });
    return computeFemaleOnlySeatLabels(seatMap.layout, occ, gm);
  }, [seatMap]);

  const seats = flow?.seats ?? [];

  const setP = (seat: string, patch: Partial<PInfo>) => {
    setPassengers((prev) => ({
      ...prev,
      [seat]: { ...(prev[seat] || { name: "", age: "", gender: "" }), ...patch },
    }));
  };

  const onProceed = async () => {
    setErr("");
    if (!phone.trim()) {
      setErr("Phone is required.");
      return;
    }
    if (!stateRes) {
      setErr("Select state of residence.");
      return;
    }
    const missing = seats.find((s) => {
      const p = passengers[s];
      return !p?.name.trim() || !p?.age.trim() || !p?.gender;
    });
    if (missing) {
      setErr("Fill passenger name, age, and gender for every seat.");
      return;
    }
    const maleBlock = seats.find((s) => femaleOnly.has(s) && passengers[s]?.gender && isMale(passengers[s].gender));
    if (maleBlock) {
      setErr(
        `Seat ${maleBlock} is only for female passengers (next to a booked female). Change seat or set gender to Female.`
      );
      return;
    }
    setBusy(true);
    try {
      await mergeBookingFlow({
        contact_phone: phone.trim(),
        email: email.trim(),
        state_of_residence: stateRes,
        whatsapp_opt_in: whatsapp,
        passengers,
      });
      router.push({ pathname: "/payment", params: { schedule_id: String(scheduleId) } });
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

  if (!scheduleId || !seats.length) {
    return (
      <View style={[styles.center, { padding: 20 }]}>
        <AppText style={{ textAlign: "center", marginBottom: 16 }}>
          Missing booking context. Start from search and pick seats again.
        </AppText>
        <PrimaryButton title="Home" onPress={() => router.replace("/(tabs)")} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <AppText variant="caption" style={styles.step}>
        Step 3 of 4 · Passenger details
      </AppText>

      <SurfaceCard style={{ marginBottom: 14 }}>
        <AppText variant="title" style={{ marginBottom: 12 }}>
          Contact
        </AppText>
        <AppText variant="label" style={styles.lab}>
          Phone *
        </AppText>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="9876543210"
          placeholderTextColor={palette.slate400}
          style={styles.inp}
        />
        <AppText variant="label" style={[styles.lab, { marginTop: 12 }]}>
          Email (optional)
        </AppText>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={palette.slate400}
          style={styles.inp}
        />
        <View style={styles.rowBetween}>
          <AppText variant="body">WhatsApp updates</AppText>
          <Switch value={whatsapp} onValueChange={setWhatsapp} />
        </View>
      </SurfaceCard>

      <SurfaceCard style={{ marginBottom: 14 }}>
        <AppText variant="title" style={{ marginBottom: 8 }}>
          State of residence *
        </AppText>
        <View style={styles.chipWrap}>
          {STATES.map((s) => (
            <Pressable
              key={s}
              onPress={() => setStateRes(s)}
              style={[styles.chip, stateRes === s && styles.chipOn]}
            >
              <AppText variant="caption" style={stateRes === s ? styles.chipTxtOn : styles.chipTxt}>
                {s}
              </AppText>
            </Pressable>
          ))}
        </View>
      </SurfaceCard>

      {seats.map((seat) => (
        <SurfaceCard key={seat} style={{ marginBottom: 12 }}>
          <AppText variant="title" style={{ marginBottom: 10 }}>
            Seat {seat}
            {femaleOnly.has(seat) ? (
              <AppText variant="caption" style={{ color: palette.rose500 }}>
                {" "}
                · Female only
              </AppText>
            ) : null}
          </AppText>
          <AppText variant="label" style={styles.lab}>
            Full name *
          </AppText>
          <TextInput
            value={passengers[seat]?.name ?? ""}
            onChangeText={(t) => setP(seat, { name: t })}
            placeholder="As on ID"
            placeholderTextColor={palette.slate400}
            style={styles.inp}
          />
          <AppText variant="label" style={[styles.lab, { marginTop: 10 }]}>
            Age *
          </AppText>
          <TextInput
            value={passengers[seat]?.age ?? ""}
            onChangeText={(t) => setP(seat, { age: t.replace(/\D/g, "").slice(0, 3) })}
            keyboardType="number-pad"
            placeholder="25"
            placeholderTextColor={palette.slate400}
            style={styles.inp}
          />
          <AppText variant="label" style={[styles.lab, { marginTop: 10 }]}>
            Gender *
          </AppText>
          <View style={styles.gRow}>
            {(
              [
                { label: "Female", value: "F" },
                { label: "Male", value: "M" },
                { label: "Other", value: "Other" },
              ] as const
            ).map(({ label, value }) => {
              const cur = passengers[seat]?.gender ?? "";
              const active = cur === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setP(seat, { gender: value })}
                  style={[styles.gBtn, active && styles.gBtnOn]}
                >
                  <AppText variant="caption" style={active ? styles.gBtnTxtOn : undefined}>
                    {label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </SurfaceCard>
      ))}

      {err ? (
        <AppText style={{ color: palette.rose500, marginBottom: 12 }}>{err}</AppText>
      ) : null}

      <PrimaryButton title={busy ? "Saving…" : "Continue to payment"} loading={busy} onPress={() => void onProceed()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.slate50 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  step: { color: palette.slate500, marginBottom: 12 },
  lab: { marginBottom: 6, color: palette.slate600 },
  inp: {
    borderWidth: 1,
    borderColor: palette.slate200,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: palette.slate900,
    backgroundColor: palette.white,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: palette.slate200,
    backgroundColor: palette.white,
  },
  chipOn: { borderColor: palette.indigo500, backgroundColor: palette.indigo50 },
  chipTxt: { color: palette.slate700 },
  chipTxtOn: { color: palette.indigo800, fontFamily: fonts.semibold },
  gRow: { flexDirection: "row", gap: 8 },
  gBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.slate200,
  },
  gBtnOn: { borderColor: palette.indigo600, backgroundColor: palette.indigo600 },
  gBtnTxtOn: { color: "#fff", fontFamily: fonts.semibold },
});

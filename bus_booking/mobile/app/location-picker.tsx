import { useFocusEffect, useNavigation } from "@react-navigation/native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HighlightCity } from "@/components/search/HighlightCity";
import { AppText } from "@/components/ui/AppText";
import { fonts, palette, radii } from "@/constants/theme";
import { useDebounced } from "@/hooks/useDebounced";
import { POPULAR_CITIES } from "@/lib/places-constants";
import { paramOne } from "@/lib/router-params";
import { mergeWithPopular, suggestDestinations, suggestOrigins } from "@/lib/route-suggestions";
import { useSearchDraft } from "@/lib/search-draft-context";

type Row = { key: string; name: string; kind: "popular" | "api" };

export default function LocationPickerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { from, to, setFrom, setTo } = useSearchDraft();
  const { role: roleRaw } = useLocalSearchParams<{ role: string }>();
  const role = paramOne(roleRaw) === "to" ? "to" : "from";

  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 85);
  const [loading, setLoading] = useState(false);
  const [apiRows, setApiRows] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      setQuery(role === "from" ? from : to);
    }, [role, from, to])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: role === "from" ? "Search origin" : "Search destination",
    });
  }, [navigation, role]);

  useEffect(() => {
    const ac = new AbortController();
    const q = debounced.trim();
    if (!q) {
      setApiRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setApiRows([]);
    const run = async () => {
      try {
        const hits =
          role === "from"
            ? await suggestOrigins(q, 28, ac.signal)
            : await suggestDestinations(q, from.trim() || undefined, 28, ac.signal);
        const merged = mergeWithPopular(hits, POPULAR_CITIES, q);
        setApiRows(merged);
      } catch (e: unknown) {
        const aborted =
          (e instanceof Error && e.name === "AbortError") ||
          (typeof DOMException !== "undefined" && e instanceof DOMException && e.name === "AbortError");
        if (aborted) return;
        setApiRows(mergeWithPopular([], POPULAR_CITIES, q));
      } finally {
        setLoading(false);
      }
    };
    void run();
    return () => ac.abort();
  }, [debounced, role, from]);

  const listData: Row[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return POPULAR_CITIES.map((name) => ({ key: `p-${name}`, name, kind: "popular" as const }));
    }
    return apiRows.map((name) => ({ key: `a-${name}`, name, kind: "api" as const }));
  }, [query, apiRows]);

  const onPick = (name: string) => {
    if (role === "from") setFrom(name);
    else setTo(name);
    router.back();
  };

  const renderItem = ({ item }: { item: Row }) => (
    <Pressable
      onPress={() => onPick(item.name)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: palette.slate50 }]}
    >
      <View style={styles.iconWrap}>
        <FontAwesome name={item.kind === "popular" ? "building" : "bus"} size={16} color={palette.slate600} />
      </View>
      <View style={styles.rowText}>
        <HighlightCity name={item.name} query={query} />
        {item.kind === "popular" && !query.trim() ? (
          <AppText variant="caption" style={styles.sub}>
            Popular city
          </AppText>
        ) : role === "to" && from.trim() ? (
          <AppText variant="caption" style={styles.sub}>
            From {from.trim()}
          </AppText>
        ) : null}
      </View>
      <FontAwesome name="chevron-right" size={12} color={palette.slate400} />
    </Pressable>
  );

  return (
    <View style={[styles.root, { paddingTop: 8, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.searchBar}>
        <FontAwesome name="search" size={16} color={palette.slate500} style={{ marginRight: 10 }} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={role === "from" ? "Type city or stop (e.g. B…)" : "Type destination…"}
          placeholderTextColor={palette.slate500}
          style={styles.input}
          autoFocus
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery("")} hitSlop={12}>
            <FontAwesome name="times-circle" size={18} color={palette.slate400} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.sectionHead}>
        <AppText variant="label">
          {!query.trim() ? "Popular cities" : loading ? "Searching…" : "Suggestions"}
        </AppText>
        {loading && query.trim() ? <ActivityIndicator size="small" color={palette.indigo600} /> : null}
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          query.trim() && !loading && listData.length === 0 ? (
            <AppText variant="body" style={{ padding: 20, color: palette.slate500 }}>
              No matches yet — try another spelling (e.g. Bengaluru).
            </AppText>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.white },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    borderRadius: radii.full,
    backgroundColor: palette.slate100,
    borderWidth: 1,
    borderColor: palette.slate200,
  },
  input: {
    flex: 1,
    fontSize: 17,
    fontFamily: fonts.regular,
    color: palette.slate900,
    paddingVertical: 4,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: palette.slate100,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowText: { flex: 1 },
  sub: { marginTop: 3, color: palette.slate500 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: palette.slate200, marginLeft: 64 },
});

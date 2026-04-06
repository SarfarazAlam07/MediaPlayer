import { MaterialIcons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import FolderCard from "../../components/cards/FolderCard"; // 🔥 Naya Component
import VideoCard from "../../components/cards/VideoCard";
import { Colors } from "../../constants/Colors";
import { useMediaScanner } from "../../hooks/useMediaScanner";

export default function HomeScreen() {
  const { allVideos, folders, loading, rescan } = useMediaScanner();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"folders" | "all">("folders"); // 🔥 Switcher State
  const [sortVisible, setSortVisible] = useState(false);
  const router = useRouter();

  const sortOptions = [
    { label: "Latest First", value: MediaLibrary.SortBy.creationTime },
    { label: "Video Length", value: MediaLibrary.SortBy.duration },
    { label: "Alphabetical", value: MediaLibrary.SortBy.default },
  ];

  const changeSort = (val: any) => {
    rescan(val);
    setSortVisible(false);
  };

  // 🔥 1. Filter Logic (Dono Tabs ke liye)
  const filteredData = useMemo(() => {
    if (viewMode === "all") {
      return allVideos.filter((v) =>
        v.filename.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    } else {
      return folders.filter((f) =>
        f.title.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }
  }, [allVideos, folders, searchQuery, viewMode]);

  if (loading)
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );

  return (
    <View style={styles.container}>
      {/* 🔍 Premium Header & Search */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Hybrid Player</Text>

        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={20} color={Colors.textMuted} />
            <TextInput
              placeholder={
                viewMode === "all" ? "Search videos..." : "Search folders..."
              }
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Sort Button sirf 'All Videos' mein kaam karega */}
          {viewMode === "all" && (
            <TouchableOpacity
              onPress={() => setSortVisible(true)}
              style={styles.sortBtn}
            >
              <MaterialIcons name="sort" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* 🎬 Segmented Control (Tabs) */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, viewMode === "folders" && styles.activeTab]}
            onPress={() => setViewMode("folders")}
          >
            <Text
              style={[
                styles.tabText,
                viewMode === "folders" && styles.activeTabText,
              ]}
            >
              Folders
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, viewMode === "all" && styles.activeTab]}
            onPress={() => setViewMode("all")}
          >
            <Text
              style={[
                styles.tabText,
                viewMode === "all" && styles.activeTabText,
              ]}
            >
              All Videos
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 📜 Dynamic List */}
      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) =>
          viewMode === "all" ? (
            <VideoCard
              title={item.filename}
              duration={item.duration}
              resolution={`${item.width}x${item.height}`}
              date={item.creationTime}
              size={item.size}
              uri={item.uri}
              onPress={() => router.push(`/player/${item.id}` as any)}
            />
          ) : (
            <FolderCard
              name={item.title}
              count={item.assetCount}
              onPress={() => {
                // Future: Folder Detail Screen par bhejne ke liye
                alert(`Opening folder: ${item.title}`);
              }}
            />
          )
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No {viewMode} found.</Text>
        }
      />

      {/* 🚀 Sort Modal */}
      <Modal visible={sortVisible} transparent animationType="slide">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSortVisible(false)}
        >
          <View style={styles.sortMenu}>
            <Text style={styles.menuTitle}>Sort By</Text>
            {sortOptions.map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={styles.menuItem}
                onPress={() => changeSort(opt.value)}
              >
                <Text style={styles.menuText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 5,
  },
  headerTitle: {
    color: Colors.primary,
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 15,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 45,
  },
  searchInput: { flex: 1, color: "#fff", marginLeft: 10, fontSize: 16 },
  sortBtn: {
    padding: 10,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 12,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 4,
    marginBottom: 5,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: Colors.surfaceHighlight,
  },
  tabText: {
    color: Colors.textMuted,
    fontWeight: "600",
    fontSize: 14,
  },
  activeTabText: {
    color: Colors.primary,
  },
  emptyText: { color: Colors.textMuted, textAlign: "center", marginTop: 50 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sortMenu: {
    backgroundColor: Colors.surface,
    padding: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  menuTitle: {
    color: Colors.primary,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  menuItem: {
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  menuText: { color: "#fff", fontSize: 17, textAlign: "center" },
});

import { MaterialIcons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import FolderCard from "../../components/cards/FolderCard";
import VideoCard from "../../components/cards/VideoCard";
import { Colors } from "../../constants/Colors";
import { useMediaScanner } from "../../hooks/useMediaScanner";
import { useMediaStore } from "../../store/useMediaStore";

export default function HomeScreen() {
  const { folders, loading, rescan } = useMediaScanner();
  const { globalVideos, setSortOrder, loadInitialData, removeGlobalVideos } =
    useMediaStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"folders" | "all">("folders");
  const [sortVisible, setSortVisible] = useState(false);
  const router = useRouter();

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const sortOptions = [
    { label: "Latest First", value: MediaLibrary.SortBy.creationTime },
    { label: "Video Length", value: MediaLibrary.SortBy.duration },
    { label: "Alphabetical", value: MediaLibrary.SortBy.default },
  ];

  const changeSort = async (val: any) => {
    setSortVisible(false);
    await setSortOrder(val);
    rescan();
  };

  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      const newSelection = selectedIds.filter((item) => item !== id);
      setSelectedIds(newSelection);
      if (newSelection.length === 0) setSelectionMode(false);
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleCardPress = (id: string) => {
    if (selectionMode) {
      toggleSelection(id);
    } else {
      router.push(`/player/${id}` as any);
    }
  };

  const handleLongPress = (id: string) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds([id]);
    }
  };

  const deleteSelectedVideos = async () => {
    Alert.alert(
      "Delete Videos",
      `Are you sure you want to delete ${selectedIds.length} video(s) permanently?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await MediaLibrary.deleteAssetsAsync(selectedIds);
              removeGlobalVideos(selectedIds);
              setSelectionMode(false);
              setSelectedIds([]);
            } catch (error) {
              console.log("Delete failed:", error);
              Alert.alert("Error", "Could not delete the selected videos.");
            }
          },
        },
      ],
    );
  };

  const filteredData = useMemo(() => {
    if (viewMode === "all") {
      return globalVideos.filter((v) =>
        v.filename.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    } else {
      return folders.filter((f) =>
        f.title.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }
  }, [globalVideos, folders, searchQuery, viewMode]);

  if (loading && globalVideos.length === 0)
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {selectionMode ? (
          <View style={styles.selectionHeader}>
            <TouchableOpacity
              onPress={() => {
                setSelectionMode(false);
                setSelectedIds([]);
              }}
            >
              <MaterialIcons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.selectionText}>
              {selectedIds.length} Selected
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedIds(filteredData.map((v) => v.id))}
            >
              <MaterialIcons name="select-all" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.headerTitle}>Hybrid Player</Text>
        )}

        {!selectionMode && (
          <>
            <View style={styles.searchRow}>
              <View style={styles.searchBar}>
                <MaterialIcons
                  name="search"
                  size={20}
                  color={Colors.textMuted}
                />
                <TextInput
                  placeholder={
                    viewMode === "all"
                      ? "Search videos..."
                      : "Search folders..."
                  }
                  placeholderTextColor={Colors.textMuted}
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              {viewMode === "all" && (
                <TouchableOpacity
                  onPress={() => setSortVisible(true)}
                  style={styles.sortBtn}
                >
                  <MaterialIcons name="sort" size={24} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

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
          </>
        )}
      </View>

      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 130 }}
        renderItem={({ item }) =>
          viewMode === "all" ? (
            <VideoCard
              id={item.id}
              title={item.filename}
              duration={item.duration}
              resolution={`${item.width}x${item.height}`}
              date={item.creationTime}
              size={item.size}
              uri={item.uri}
              selectionMode={selectionMode}
              isSelected={selectedIds.includes(item.id)}
              onLongPress={() => handleLongPress(item.id)}
              onPress={() => handleCardPress(item.id)}
            />
          ) : (
            <FolderCard
              name={item.title}
              count={item.assetCount}
              // 🔥 YAHAN CHANGE HAI: Alert hata kar naye page par bhej rahe hain
              onPress={() =>
                router.push(
                  `/folder/${item.id}?title=${encodeURIComponent(item.title)}` as any,
                )
              }
            />
          )
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No {viewMode} found.</Text>
        }
      />

      {selectionMode && selectedIds.length > 0 && (
        <View style={styles.deleteActionBar}>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={deleteSelectedVideos}
          >
            <MaterialIcons name="delete-outline" size={24} color="#fff" />
            <Text style={styles.deleteBtnText}>
              Delete ({selectedIds.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

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

  selectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 15,
  },
  selectionText: { color: "#fff", fontSize: 18, fontWeight: "bold" },

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
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  activeTab: { backgroundColor: Colors.surfaceHighlight },
  tabText: { color: Colors.textMuted, fontWeight: "600", fontSize: 14 },
  activeTabText: { color: Colors.primary },
  emptyText: { color: Colors.textMuted, textAlign: "center", marginTop: 50 },

  deleteActionBar: {
    position: "absolute",
    bottom: 85,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 30,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  deleteBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 8,
  },

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

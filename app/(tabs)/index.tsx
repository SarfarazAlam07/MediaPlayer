import { MaterialIcons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
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
  ScrollView,
  Dimensions,
} from "react-native";
import FolderCard from "../../components/cards/FolderCard";
import VideoCard from "../../components/cards/VideoCard";
import { Colors } from "../../constants/Colors";
import { useMediaScanner } from "../../hooks/useMediaScanner";
import { useMediaStore } from "../../store/useMediaStore";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function HomeScreen() {
  const { folders, loading, rescan } = useMediaScanner();
  const { globalVideos, setSortOrder, loadInitialData, removeGlobalVideos, favorites } = useMediaStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(1); 
  const scrollViewRef = useRef<ScrollView>(null);

  const [sortVisible, setSortVisible] = useState(false);
  const router = useRouter();

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [renameVisible, setRenameVisible] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    loadInitialData();
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: false });
    }, 100);
  }, []);

  const sortOptions = [
    { label: "Latest First", value: "creationTime" },
    { label: "Video Length", value: "duration" },
    { label: "Alphabetical", value: "default" },
  ];

  const changeSort = async (val: string) => {
    setSortVisible(false);
    await setSortOrder(val); 
  };

  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / SCREEN_WIDTH);
    if (activeIndex !== index) {
      setActiveIndex(index);
      setSearchQuery(""); 
      setSelectionMode(false);
      setSelectedIds([]);
    }
  };

  const scrollToTab = (index: number) => {
    scrollViewRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    setActiveIndex(index);
  };

  // 🔥 FIX: useCallback added to prevent re-creating functions on every render
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const newSel = prev.filter((item) => item !== id);
        if (newSel.length === 0) setSelectionMode(false);
        return newSel;
      }
      return [...prev, id];
    });
  }, []);

  const handleCardPress = useCallback((id: string) => {
    if (selectionMode) toggleSelection(id);
    else router.push(`/player/${id}` as any);
  }, [selectionMode, toggleSelection, router]);

  const handleLongPress = useCallback((id: string) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds([id]);
    }
  }, [selectionMode]);

  const deleteSelectedVideos = async () => {
    Alert.alert("Delete Videos", `Permanently delete ${selectedIds.length} video(s)?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try {
            removeGlobalVideos(selectedIds);
            setSelectionMode(false);
            setSelectedIds([]);
          } catch (error) { Alert.alert("Error", "Could not delete."); }
        },
      },
    ]);
  };

  const openRenameModal = () => {
    if (selectedIds.length === 1) {
      const video = globalVideos.find(v => v.id === selectedIds[0]);
      if (video) { setNewName(video.filename || "Video"); setRenameVisible(true); }
    }
  };

  const handleRename = async () => {
    if (!newName.trim() || selectedIds.length !== 1) return;
    try {
      const video = globalVideos.find(v => v.id === selectedIds[0]);
      if (video) {
        const oldUri = video.uri;
        const ext = oldUri.substring(oldUri.lastIndexOf('.'));
        const newUri = oldUri.substring(0, oldUri.lastIndexOf('/') + 1) + newName + ext;
        await FileSystem.moveAsync({ from: oldUri, to: newUri });
        setRenameVisible(false);
        setSelectionMode(false);
        setSelectedIds([]);
        Alert.alert("Success", "Renamed successfully!");
        rescan(); 
      }
    } catch (error) { Alert.alert("Error", "OS Security blocked rename."); setRenameVisible(false); }
  };

  const allVideosProcessed = useMemo(() => {
    let videos = [...globalVideos];
    videos.sort((a, b) => {
      const aLiked = favorites.includes(a.id);
      const bLiked = favorites.includes(b.id);
      if (aLiked && !bLiked) return -1;
      if (!aLiked && bLiked) return 1;
      return 0; 
    });
    return videos.filter((item) => (item.filename || "").toLowerCase().includes(searchQuery.toLowerCase()));
  }, [globalVideos, favorites, searchQuery]);

  const likedVideosFiltered = useMemo(() => {
    return globalVideos
      .filter((v) => favorites.includes(v.id))
      .filter((item) => (item.filename || "").toLowerCase().includes(searchQuery.toLowerCase()));
  }, [globalVideos, favorites, searchQuery]);

  const foldersFiltered = useMemo(() => {
    return folders.filter((f) => (f.title || "").toLowerCase().includes(searchQuery.toLowerCase()));
  }, [folders, searchQuery]);

  // 🔥 FIX: Extracted Renderers for maximum Flatlist Speed
  const renderVideoItem = useCallback(({ item }: any) => (
    <VideoCard id={item.id} title={item.filename} duration={item.duration} resolution={`${item.width}x${item.height}`} date={item.creationTime} size={item.size} uri={item.uri} selectionMode={selectionMode} isSelected={selectedIds.includes(item.id)} onLongPress={() => handleLongPress(item.id)} onPress={() => handleCardPress(item.id)} />
  ), [selectionMode, selectedIds, handleLongPress, handleCardPress]);

  const renderFolderItem = useCallback(({ item }: any) => (
    <FolderCard name={item.title} count={item.assetCount} onPress={() => router.push(`/folder/${item.id}?title=${encodeURIComponent(item.title)}` as any)} />
  ), [router]);

  if (loading && globalVideos.length === 0)
    return <View style={styles.centerContainer}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {selectionMode ? (
          <View style={styles.selectionHeader}>
            <TouchableOpacity onPress={() => { setSelectionMode(false); setSelectedIds([]); }}><MaterialIcons name="close" size={28} color="#fff" /></TouchableOpacity>
            <Text style={styles.selectionText}>{selectedIds.length} Selected</Text>
            <TouchableOpacity onPress={() => setSelectedIds(activeIndex === 1 ? allVideosProcessed.map(v => v.id) : likedVideosFiltered.map(v => v.id))}>
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
                <MaterialIcons name="search" size={20} color={Colors.textMuted} />
                <TextInput
                  placeholder={activeIndex === 0 ? "Search liked..." : activeIndex === 2 ? "Search folders..." : "Search videos..."}
                  placeholderTextColor={Colors.textMuted}
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              {(activeIndex === 0 || activeIndex === 1) && (
                <TouchableOpacity onPress={() => setSortVisible(true)} style={styles.sortBtn}>
                  <MaterialIcons name="sort" size={24} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.tabContainer}>
              <TouchableOpacity style={[styles.tab, activeIndex === 0 && styles.activeTab]} onPress={() => scrollToTab(0)}>
                <Text style={[styles.tabText, activeIndex === 0 && styles.activeTabText]}>Liked</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, activeIndex === 1 && styles.activeTab]} onPress={() => scrollToTab(1)}>
                <Text style={[styles.tabText, activeIndex === 1 && styles.activeTabText]}>All Videos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, activeIndex === 2 && styles.activeTab]} onPress={() => scrollToTab(2)}>
                <Text style={[styles.tabText, activeIndex === 2 && styles.activeTabText]}>Folders</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <ScrollView ref={scrollViewRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={handleScroll} style={{ flex: 1 }} scrollEventThrottle={16}>
        
        {/* VIEW 0: LIKED */}
        <View style={{ width: SCREEN_WIDTH }}>
          <FlatList
            data={likedVideosFiltered}
            keyExtractor={(item) => item.id}
            renderItem={renderVideoItem}
            contentContainerStyle={{ paddingBottom: 130 }}
            ListEmptyComponent={<Text style={styles.emptyText}>No liked videos.</Text>}
            // 🔥 PERFORMANCE PROPS
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
          />
        </View>

        {/* VIEW 1: ALL VIDEOS */}
        <View style={{ width: SCREEN_WIDTH }}>
          <FlatList
            data={allVideosProcessed}
            keyExtractor={(item) => item.id}
            renderItem={renderVideoItem}
            contentContainerStyle={{ paddingBottom: 130 }}
            ListEmptyComponent={<Text style={styles.emptyText}>No videos found.</Text>}
            // 🔥 PERFORMANCE PROPS
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
          />
        </View>

        {/* VIEW 2: FOLDERS */}
        <View style={{ width: SCREEN_WIDTH }}>
          <FlatList
            data={foldersFiltered}
            keyExtractor={(item) => item.id}
            renderItem={renderFolderItem}
            contentContainerStyle={{ paddingBottom: 130 }}
            ListEmptyComponent={<Text style={styles.emptyText}>No folders found.</Text>}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
          />
        </View>
      </ScrollView>

      {/* BOTTOM ACTION BAR */}
      {selectionMode && selectedIds.length > 0 && (
        <View style={styles.deleteActionBar}>
          {selectedIds.length === 1 && (
            <TouchableOpacity style={styles.actionBtnSecondary} onPress={openRenameModal}>
              <MaterialIcons name="edit" size={24} color="#fff" />
              <Text style={styles.actionBtnText}>Rename</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionBtnPrimary} onPress={deleteSelectedVideos}>
            <MaterialIcons name="delete-outline" size={24} color="#fff" />
            <Text style={styles.actionBtnText}>Delete ({selectedIds.length})</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* RENAME MODAL */}
      <Modal visible={renameVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setRenameVisible(false)}>
          <View style={styles.renameMenu} onStartShouldSetResponder={() => true}>
            <Text style={styles.menuTitle}>Rename Video</Text>
            <View style={styles.inputContainer}>
               <TextInput style={styles.renameInput} value={newName} onChangeText={setNewName} autoFocus selectTextOnFocus />
            </View>
            <View style={styles.renameBtnRow}>
               <TouchableOpacity style={styles.cancelBtn} onPress={() => setRenameVisible(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
               <TouchableOpacity style={styles.confirmBtn} onPress={handleRename}><Text style={styles.confirmBtnText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* SORT MODAL */}
      <Modal visible={sortVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlayBottom} onPress={() => setSortVisible(false)}>
          <View style={styles.sortMenu}>
            <Text style={styles.menuTitle}>Sort By</Text>
            {sortOptions.map((opt) => (
              <TouchableOpacity key={opt.label} style={styles.menuItem} onPress={() => changeSort(opt.value)}>
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
  centerContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 10, backgroundColor: Colors.surface, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 5 },
  headerTitle: { color: Colors.primary, fontSize: 24, fontWeight: "bold", marginBottom: 15 },

  selectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 15 },
  selectionText: { color: "#fff", fontSize: 18, fontWeight: "bold" },

  searchRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 15 },
  searchBar: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: Colors.background, borderRadius: 12, paddingHorizontal: 12, height: 45 },
  searchInput: { flex: 1, color: "#fff", marginLeft: 10, fontSize: 16 },
  sortBtn: { padding: 10, backgroundColor: Colors.surfaceHighlight, borderRadius: 12 },
  
  tabContainer: { flexDirection: "row", backgroundColor: Colors.background, borderRadius: 10, padding: 4, marginBottom: 5 },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  activeTab: { backgroundColor: Colors.surfaceHighlight },
  tabText: { color: Colors.textMuted, fontWeight: "600", fontSize: 13 },
  activeTabText: { color: Colors.primary },
  
  emptyText: { color: Colors.textMuted, textAlign: "center", marginTop: 50 },

  deleteActionBar: { position: "absolute", bottom: 85, left: 20, right: 20, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, zIndex: 10 },
  actionBtnPrimary: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.primary, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 30, elevation: 10 },
  actionBtnSecondary: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceHighlight, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 30, elevation: 10, borderWidth: 1, borderColor: Colors.border },
  actionBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15, marginLeft: 8 },

  modalOverlayBottom: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sortMenu: { backgroundColor: Colors.surface, padding: 20, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  menuTitle: { color: Colors.primary, fontSize: 20, fontWeight: "bold", marginBottom: 15, textAlign: "center" },
  menuItem: { paddingVertical: 18, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  menuText: { color: "#fff", fontSize: 17, textAlign: "center" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  renameMenu: { width: '85%', backgroundColor: Colors.surface, borderRadius: 20, padding: 25, elevation: 10 },
  inputContainer: { backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 5, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  renameInput: { color: '#fff', fontSize: 16, height: 45 },
  renameBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  cancelBtnText: { color: Colors.textMuted, fontWeight: 'bold', fontSize: 16 },
  confirmBtn: { backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  confirmBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
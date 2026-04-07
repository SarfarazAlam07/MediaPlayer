import { MaterialIcons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import VideoCard from "../../components/cards/VideoCard";
import { Colors } from "../../constants/Colors";
import { useMediaStore } from "../../store/useMediaStore";

export default function FolderScreen() {
  const { id, title } = useLocalSearchParams();
  const router = useRouter();
  const { removeGlobalVideos } = useMediaStore();

  const [folderVideos, setFolderVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 🔥 FIX: Non-blocking size fetching
  const fetchFolderVideos = useCallback(async () => {
    setLoading(true);
    try {
      const media = await MediaLibrary.getAssetsAsync({
        album: id as string,
        mediaType: MediaLibrary.MediaType.video,
        first: 100,
        sortBy: [MediaLibrary.SortBy.creationTime],
      });

      // Set initial videos without sizes
      const initialVideos = media.assets.map(asset => ({
        ...asset,
        size: 0,
      }));
      setFolderVideos(initialVideos);

      // Fetch sizes in background
      const detailedAssets = await Promise.all(
        media.assets.map(async (asset) => {
          try {
            const fileInfo = await FileSystem.getInfoAsync(asset.uri);
            return { ...asset, size: fileInfo.exists ? fileInfo.size : 0 };
          } catch (e) {
            return { ...asset, size: 0 };
          }
        })
      );
      
      setFolderVideos(detailedAssets);
    } catch (error) {
      console.error("Failed to load folder videos:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchFolderVideos();
  }, [id, fetchFolderVideos]);

  const toggleSelection = useCallback((videoId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(videoId)) {
        const newSelection = prev.filter((item) => item !== videoId);
        if (newSelection.length === 0) setSelectionMode(false);
        return newSelection;
      }
      return [...prev, videoId];
    });
  }, []);

  const handleCardPress = useCallback((videoId: string) => {
    if (selectionMode) {
      toggleSelection(videoId);
    } else {
      router.push(`/player/${videoId}` as any);
    }
  }, [selectionMode, toggleSelection, router]);

  const handleLongPress = useCallback((videoId: string) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds([videoId]);
    }
  }, [selectionMode]);

  const deleteSelectedVideos = useCallback(async () => {
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
              setFolderVideos((prev) => prev.filter(v => !selectedIds.includes(v.id)));
              removeGlobalVideos(selectedIds);
              setSelectionMode(false);
              setSelectedIds([]);
            } catch (error) {
              console.log("Delete failed:", error);
              Alert.alert("Error", "Could not delete the selected videos.");
            }
          },
        },
      ]
    );
  }, [selectedIds, removeGlobalVideos]);

  const renderVideoItem = useCallback(({ item }: any) => (
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
  ), [selectionMode, selectedIds, handleLongPress, handleCardPress]);

  if (loading && folderVideos.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {selectionMode ? (
          <View style={styles.selectionHeader}>
            <TouchableOpacity onPress={() => { setSelectionMode(false); setSelectedIds([]); }}>
              <MaterialIcons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.selectionText}>{selectedIds.length} Selected</Text>
            <TouchableOpacity onPress={() => setSelectedIds(folderVideos.map(v => v.id))}>
              <MaterialIcons name="select-all" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.normalHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <MaterialIcons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={folderVideos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 130, paddingTop: 10 }}
        renderItem={renderVideoItem}
        ListEmptyComponent={<Text style={styles.emptyText}>This folder is empty.</Text>}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={3}
        removeClippedSubviews={true}
      />

      {selectionMode && selectedIds.length > 0 && (
        <View style={styles.deleteActionBar}>
          <TouchableOpacity style={styles.deleteBtn} onPress={deleteSelectedVideos}>
            <MaterialIcons name="delete-outline" size={24} color="#fff" />
            <Text style={styles.deleteBtnText}>Delete ({selectedIds.length})</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: "center", alignItems: "center" },
  
  header: { 
    paddingHorizontal: 20, 
    paddingTop: 50, 
    paddingBottom: 15, 
    backgroundColor: Colors.surface, 
    borderBottomLeftRadius: 20, 
    borderBottomRightRadius: 20, 
    elevation: 5 
  },
  normalHeader: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 15 },
  headerTitle: { color: Colors.primary, fontSize: 22, fontWeight: "bold", flex: 1 },
  
  selectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectionText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  emptyText: { color: Colors.textMuted, textAlign: "center", marginTop: 50 },

  deleteActionBar: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: Colors.primary, 
    paddingVertical: 12, 
    paddingHorizontal: 30, 
    borderRadius: 30,
    elevation: 10,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  deleteBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
});
import { MaterialIcons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
  const { id, title } = useLocalSearchParams(); // URL se Folder ID aur Naam nikal liya
  const router = useRouter();
  const { removeGlobalVideos } = useMediaStore(); // Delete hone par main memory se bhi hatane ke liye

  const [folderVideos, setFolderVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Multi-Select States
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 🔥 Sirf is folder ki videos fetch karne ka logic
  useEffect(() => {
    const fetchFolderVideos = async () => {
      setLoading(true);
      try {
        const media = await MediaLibrary.getAssetsAsync({
          album: id as string,
          mediaType: MediaLibrary.MediaType.video,
          first: 100,
          sortBy: [MediaLibrary.SortBy.creationTime], // Latest first
        });

        // Exact Size from FileSystem (0MB bug fix)
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
    };

    if (id) fetchFolderVideos();
  }, [id]);

  // 🔥 Multi-Select Logic
  const toggleSelection = (videoId: string) => {
    if (selectedIds.includes(videoId)) {
      const newSelection = selectedIds.filter((item) => item !== videoId);
      setSelectedIds(newSelection);
      if (newSelection.length === 0) setSelectionMode(false);
    } else {
      setSelectedIds([...selectedIds, videoId]);
    }
  };

  const handleCardPress = (videoId: string) => {
    if (selectionMode) {
      toggleSelection(videoId);
    } else {
      router.push(`/player/${videoId}` as any);
    }
  };

  const handleLongPress = (videoId: string) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds([videoId]);
    }
  };

  // 🔥 Delete Function
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
              // 1. Phone se delete
              await MediaLibrary.deleteAssetsAsync(selectedIds);
              
              // 2. Local folder list se hatao
              setFolderVideos((prev) => prev.filter(v => !selectedIds.includes(v.id)));
              
              // 3. Global app list se hatao taaki home page par na dikhe
              removeGlobalVideos(selectedIds);
              
              // 4. Selection mode band
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
  };

  if (loading)
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );

  return (
    <View style={styles.container}>
      {/* 🔝 HEADER */}
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

      {/* 📜 VIDEO LIST */}
      <FlatList
        data={folderVideos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 130, paddingTop: 10 }}
        renderItem={({ item }) => (
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
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>This folder is empty.</Text>
        }
      />

      {/* 🔥 FLOATING DELETE ACTION BAR */}
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
    bottom: 30, // Normal screen mein neeche rahega
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
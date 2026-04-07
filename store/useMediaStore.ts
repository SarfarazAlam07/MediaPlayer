import AsyncStorage from "@react-native-async-storage/async-storage";
import * as MediaLibrary from "expo-media-library";
import { create } from "zustand";

interface MediaState {
  favorites: string[];
  globalVideos: MediaLibrary.Asset[];
  sortOrder: MediaLibrary.SortBy | string;

  setGlobalVideos: (videos: MediaLibrary.Asset[]) => void;
  removeGlobalVideos: (ids: string[]) => void;

  setSortOrder: (order: string) => Promise<void>;
  addFavorite: (id: string) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
  isFavorite: (id: string) => boolean;
  loadInitialData: () => Promise<void>;
}

export const useMediaStore = create<MediaState>((set, get) => ({
  favorites: [],
  globalVideos: [],
  sortOrder: 'creationTime', // Default custom string

  setGlobalVideos: (videos) => {
    // Apply current sort immediately when setting videos
    const currentSort = get().sortOrder;
    let sorted = [...videos];
    
    if (currentSort === 'duration') {
      sorted.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    } else if (currentSort === 'default') { // Alphabetical
      sorted.sort((a, b) => (a.filename || "").localeCompare(b.filename || ""));
    } else { // creationTime
      sorted.sort((a, b) => (b.creationTime || 0) - (a.creationTime || 0));
    }
    
    set({ globalVideos: sorted });
  },

  removeGlobalVideos: (ids) => {
    set((state) => ({
      globalVideos: state.globalVideos.filter((video) => !ids.includes(video.id)),
    }));
  },

  // 🔥 INSTANT IN-MEMORY SORTING
  setSortOrder: async (order) => {
    const currentVideos = [...get().globalVideos];
    
    if (order === 'duration') {
      currentVideos.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    } else if (order === 'default') {
      currentVideos.sort((a, b) => (a.filename || "").localeCompare(b.filename || ""));
    } else { // creationTime
      currentVideos.sort((a, b) => (b.creationTime || 0) - (a.creationTime || 0));
    }

    set({ sortOrder: order, globalVideos: currentVideos });
    await AsyncStorage.setItem("@sortOrder", order);
  },

  loadInitialData: async () => {
    try {
      const storedFavs = await AsyncStorage.getItem("@favorites");
      const storedSort = await AsyncStorage.getItem("@sortOrder");
      if (storedFavs) set({ favorites: JSON.parse(storedFavs) });
      if (storedSort) set({ sortOrder: storedSort });
    } catch (e) {
      console.error("Failed to load data", e);
    }
  },

  addFavorite: async (id) => {
    const currentFavs = get().favorites;
    if (!currentFavs.includes(id)) {
      const newFavs = [...currentFavs, id];
      set({ favorites: newFavs });
      await AsyncStorage.setItem("@favorites", JSON.stringify(newFavs));
    }
  },

  removeFavorite: async (id) => {
    const newFavs = get().favorites.filter((favId) => favId !== id);
    set({ favorites: newFavs });
    await AsyncStorage.setItem("@favorites", JSON.stringify(newFavs));
  },

  isFavorite: (id) => get().favorites.includes(id),
}));
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as MediaLibrary from "expo-media-library";
import { create } from "zustand";

interface MediaState {
  favorites: string[];
  globalVideos: MediaLibrary.Asset[];
  sortOrder: MediaLibrary.SortBy | any;

  setGlobalVideos: (videos: MediaLibrary.Asset[]) => void;
  // 🔥 NAYA: UI se deleted videos ko turant hatane ke liye
  removeGlobalVideos: (ids: string[]) => void;

  setSortOrder: (order: any) => Promise<void>;
  addFavorite: (id: string) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
  isFavorite: (id: string) => boolean;
  loadInitialData: () => Promise<void>;
}

export const useMediaStore = create<MediaState>((set, get) => ({
  favorites: [],
  globalVideos: [],
  sortOrder: MediaLibrary.SortBy.creationTime,

  setGlobalVideos: (videos) => set({ globalVideos: videos }),

  // 🔥 NAYA: Filter karke deleted items ko hata do (Zero Lag)
  removeGlobalVideos: (ids) => {
    set((state) => ({
      globalVideos: state.globalVideos.filter(
        (video) => !ids.includes(video.id),
      ),
    }));
  },

  setSortOrder: async (order) => {
    set({ sortOrder: order });
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

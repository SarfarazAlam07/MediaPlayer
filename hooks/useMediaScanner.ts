import { useState, useEffect, useCallback } from 'react';
import * as MediaLibrary from 'expo-media-library';

export const useMediaScanner = () => {
  const [allVideos, setAllVideos] = useState<MediaLibrary.Asset[]>([]); // Saari videos ke liye
  const [folders, setFolders] = useState<MediaLibrary.Album[]>([]); // Folder-wise list ke liye
  const [loading, setLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const scanMedia = useCallback(async (sortBy: any = MediaLibrary.SortBy.creationTime) => {
    setLoading(true);
    const { status } = await MediaLibrary.requestPermissionsAsync();

    if (status === 'granted') {
      setPermissionGranted(true);

      // --- 1. FOLDERS SCANNING LOGIC ---
      // Phone ke saare albums (folders) fetch karo
      const albums = await MediaLibrary.getAlbumsAsync();
      
      // Sirf wahi folders filter karo jinme asliyat mein Videos hain
      const videoFolders = await Promise.all(
        albums.map(async (album) => {
          const assets = await MediaLibrary.getAssetsAsync({
            album: album.id,
            mediaType: MediaLibrary.MediaType.video,
            first: 1, // Sirf check karne ke liye ki video hai ya nahi
          });
          // Agar folder mein video count 0 se zyada hai, tabhi return karo
          return assets.totalCount > 0 ? album : null;
        })
      );
      // Null values hatake state update karo
      setFolders(videoFolders.filter((f) => f !== null) as MediaLibrary.Album[]);

      // --- 2. ALL VIDEOS SCANNING LOGIC ---
      const media = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.video,
        first: 100, // Performance ke liye top 100
        sortBy: [sortBy],
      });

      // Har video ki deep details (Size, localUri for Thumbnails) nikalna
      const detailedAssets = await Promise.all(
        media.assets.map(async (asset) => {
          try {
            const info = await MediaLibrary.getAssetInfoAsync(asset.id);
            return { ...asset, ...info };
          } catch (e) {
            return asset; // Fallback agar info fail ho jaye
          }
        })
      );

      setAllVideos(detailedAssets as any);
    } else {
      setPermissionGranted(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    scanMedia();
  }, [scanMedia]);

  return { 
    allVideos, 
    folders, 
    loading, 
    permissionGranted, 
    rescan: scanMedia 
  };
};
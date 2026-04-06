import { useState, useEffect, useCallback } from 'react';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { useMediaStore } from '../store/useMediaStore';

export const useMediaScanner = () => {
  const [allAudio, setAllAudio] = useState<MediaLibrary.Asset[]>([]); 
  const [folders, setFolders] = useState<MediaLibrary.Album[]>([]); 
  const [loading, setLoading] = useState(true);
  
  // Store se function nikalo
  const { setGlobalVideos, sortOrder } = useMediaStore();

  const scanMedia = useCallback(async () => {
    setLoading(true);
    const { status } = await MediaLibrary.requestPermissionsAsync();

    if (status === 'granted') {
      // 1. Folders
      const albums = await MediaLibrary.getAlbumsAsync();
      const videoFolders = await Promise.all(
        albums.map(async (album) => {
          const assets = await MediaLibrary.getAssetsAsync({
            album: album.id, mediaType: MediaLibrary.MediaType.video, first: 1, 
          });
          return assets.totalCount > 0 ? album : null;
        })
      );
      setFolders(videoFolders.filter((f) => f !== null) as MediaLibrary.Album[]);

      // 2. Videos (Yahan stored sort order use hoga)
      const media = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.video,
        first: 100, 
        sortBy: [sortOrder], 
      });

      // 3. Audio
      const audioData = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.audio,
        first: 200, 
        sortBy: [MediaLibrary.SortBy.creationTime],
      });
      setAllAudio(audioData.assets);

      // 4. Exact Size from FileSystem
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

      // Seedha global memory mein save
      setGlobalVideos(detailedAssets as any);
    }
    setLoading(false);
  }, [sortOrder, setGlobalVideos]);

  useEffect(() => {
    scanMedia();
  }, [scanMedia]);

  return { allAudio, folders, loading, rescan: scanMedia };
};
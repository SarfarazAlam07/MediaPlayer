import { useState, useEffect, useCallback, useRef } from 'react';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { useMediaStore } from '../store/useMediaStore';

export const useMediaScanner = () => {
  const [allAudio, setAllAudio] = useState<MediaLibrary.Asset[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sizeProgress, setSizeProgress] = useState(0);
  
  const { setGlobalVideos, sortOrder } = useMediaStore();
  const isMounted = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 🔥 FIX: Non-blocking size fetching with requestIdleCallback
  const fetchExactSizeAsync = async (asset: MediaLibrary.Asset): Promise<number> => {
    try {
      // Try to get size from MediaLibrary first (faster)
      const detailedInfo = await MediaLibrary.getAssetInfoAsync(asset.id);
      if (detailedInfo?.size && detailedInfo.size > 0) {
        return detailedInfo.size;
      }
      
      // Only fallback to FileSystem if absolutely necessary
      if (detailedInfo?.localUri) {
        const info = await FileSystem.getInfoAsync(detailedInfo.localUri);
        if (info.exists && info.size) return info.size;
      }
      
      return 0;
    } catch (e) {
      // Silent fail - don't block the thread
      return 0;
    }
  };

  // 🔥 FIX: Background processing with yield to main thread
  const processVideosInBackground = async (
    assets: MediaLibrary.Asset[],
    onProgress: (processed: number, total: number) => void
  ): Promise<any[]> => {
    const processedAssets: any[] = [];
    const total = assets.length;
    
    for (let i = 0; i < total; i++) {
      if (!isMounted.current) break;
      
      const asset = assets[i];
      const size = await fetchExactSizeAsync(asset);
      const finalDate = asset.creationTime || asset.modificationTime || Date.now();
      
      processedAssets.push({ 
        ...asset, 
        size, 
        uri: asset.uri, 
        creationTime: finalDate 
      });
      
      onProgress(i + 1, total);
      
      // 🔥 Yield to main thread every 10 items to prevent freeze
      if ((i + 1) % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return processedAssets;
  };

  const scanMedia = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setSizeProgress(0);
    
    const { status } = await MediaLibrary.requestPermissionsAsync();

    if (status === 'granted') {
      // 🔥 FIX: Load folders first (fast operation)
      const albums = await MediaLibrary.getAlbumsAsync();
      const videoFolders = await Promise.all(
        albums.map(async (album) => {
          const assets = await MediaLibrary.getAssetsAsync({ 
            album: album.id, 
            mediaType: MediaLibrary.MediaType.video, 
            first: 1 
          });
          if (assets.totalCount > 0) { 
            return { ...album, assetCount: assets.totalCount };
          }
          return null;
        })
      );
      setFolders(videoFolders.filter((f) => f !== null));

      // 🔥 FIX: Get video assets without sizes first (instant UI)
      const media = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.video,
        first: 500, 
        sortBy: [MediaLibrary.SortBy.creationTime], 
      });

      // 🔥 CRITICAL FIX: Set videos WITHOUT sizes first (no freeze)
      const initialVideos = media.assets.map(asset => ({
        ...asset,
        size: 0, // Placeholder
        uri: asset.uri,
        creationTime: asset.creationTime || asset.modificationTime || Date.now()
      }));
      setGlobalVideos(initialVideos);
      
      // 🔥 FIX: Process sizes in background (non-blocking)
      processVideosInBackground(media.assets, (processed, total) => {
        setSizeProgress(Math.round((processed / total) * 100));
      }).then(detailedAssets => {
        if (isMounted.current) {
          setGlobalVideos(detailedAssets);
        }
      });

      // Load audio (lightweight)
      const audioData = await MediaLibrary.getAssetsAsync({ 
        mediaType: MediaLibrary.MediaType.audio, 
        first: 200, 
        sortBy: [MediaLibrary.SortBy.creationTime] 
      });
      if (isMounted.current) {
        setAllAudio(audioData.assets);
      }
    }
    setLoading(false);
  }, [setGlobalVideos]);

  useEffect(() => {
    isMounted.current = true;
    scanMedia();
    
    return () => {
      isMounted.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [scanMedia]);

  return { allAudio, folders, loading, sizeProgress, rescan: scanMedia };
};
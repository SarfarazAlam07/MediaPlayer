import { useState, useEffect, useCallback } from 'react';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { useMediaStore } from '../store/useMediaStore';

export const useMediaScanner = () => {
  const [allAudio, setAllAudio] = useState<MediaLibrary.Asset[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { setGlobalVideos, sortOrder } = useMediaStore();

  const fetchExactSize = async (asset: MediaLibrary.Asset) => {
    try {
      let info = await FileSystem.getInfoAsync(asset.uri);
      if (info.exists && info.size) return info.size;

      const detailedInfo = await MediaLibrary.getAssetInfoAsync(asset.id);
      if (detailedInfo?.size) return detailedInfo.size; 
      
      if (detailedInfo?.localUri) {
        info = await FileSystem.getInfoAsync(detailedInfo.localUri);
        if (info.exists && info.size) return info.size;
      }
      return 0;
    } catch (e) {
      // 🔥 FIX: Removed console.warn to stop blocking JS thread on failed fetches
      return 0;
    }
  };

  const scanMedia = useCallback(async () => {
    setLoading(true);
    const { status } = await MediaLibrary.requestPermissionsAsync();

    if (status === 'granted') {
      const albums = await MediaLibrary.getAlbumsAsync();
      const videoFolders = await Promise.all(
        albums.map(async (album) => {
          const assets = await MediaLibrary.getAssetsAsync({ album: album.id, mediaType: MediaLibrary.MediaType.video, first: 1 });
          if (assets.totalCount > 0) return { ...album, assetCount: assets.totalCount };
          return null;
        })
      );
      setFolders(videoFolders.filter((f) => f !== null));

      const media = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.video,
        first: 500, 
        sortBy: [MediaLibrary.SortBy.creationTime], 
      });

      const detailedAssets: any[] = [];
      const chunkSize = 20;

      for (let i = 0; i < media.assets.length; i += chunkSize) {
        const chunk = media.assets.slice(i, i + chunkSize);
        const processedChunk = await Promise.all(
          chunk.map(async (asset) => {
            const size = await fetchExactSize(asset);
            const finalDate = asset.creationTime || asset.modificationTime || Date.now();
            return { ...asset, size, uri: asset.uri, creationTime: finalDate };
          })
        );
        detailedAssets.push(...processedChunk);
      }

      setGlobalVideos(detailedAssets);

      const audioData = await MediaLibrary.getAssetsAsync({ mediaType: MediaLibrary.MediaType.audio, first: 200, sortBy: [MediaLibrary.SortBy.creationTime] });
      setAllAudio(audioData.assets);
    }
    setLoading(false);
  }, [setGlobalVideos]);

  useEffect(() => { scanMedia(); }, [scanMedia]);

  return { allAudio, folders, loading, rescan: scanMedia };
};
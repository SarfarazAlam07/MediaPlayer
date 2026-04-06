import { MaterialIcons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router"; // 🔥 Sahi import
import * as ScreenOrientation from "expo-screen-orientation";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Colors } from "../../constants/Colors";

export default function PlayerScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const videoRef = useRef<any>(null);

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const loadVideoInfo = async () => {
      if (typeof id === "string") {
        try {
          const assetInfo = await MediaLibrary.getAssetInfoAsync(id);
          setVideoUri(assetInfo.localUri || assetInfo.uri);
        } catch (error) {
          console.error("Video load failed:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadVideoInfo();

    return () => {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      );
    };
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading Media Engine...</Text>
      </View>
    );
  }

  if (!videoUri) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={60} color={Colors.primary} />
        <Text style={styles.errorText}>Failed to load this video file.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden={isFullscreen} />

      {!isFullscreen && (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconBtn}
          >
            <MaterialIcons name="arrow-back" size={28} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Now Playing
          </Text>
          <View style={{ width: 28 }} />
        </View>
      )}

      <Video
        ref={videoRef}
        style={isFullscreen ? styles.fullscreenVideo : styles.video}
        source={{ uri: videoUri }}
        useNativeControls={true}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={true}
        onFullscreenUpdate={async (e) => {
          if (e.fullscreenUpdate === 1) {
            await ScreenOrientation.lockAsync(
              ScreenOrientation.OrientationLock.LANDSCAPE,
            );
            setIsFullscreen(true);
          } else if (e.fullscreenUpdate === 3) {
            await ScreenOrientation.lockAsync(
              ScreenOrientation.OrientationLock.PORTRAIT_UP,
            );
            setIsFullscreen(false);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  iconBtn: { padding: 5 },
  video: {
    width: "100%",
    height: 300,
    backgroundColor: "#000",
    marginTop: "auto",
    marginBottom: "auto",
  },
  fullscreenVideo: { width: "100%", height: "100%", backgroundColor: "#000" },
  loadingText: { color: Colors.text, marginTop: 15, fontSize: 16 },
  errorText: { color: Colors.text, fontSize: 18, marginVertical: 20 },
  backBtn: {
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backBtnText: { color: Colors.text, fontWeight: "bold", fontSize: 16 },
});

import { MaterialIcons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { BlurView } from "expo-blur";
import * as Brightness from "expo-brightness";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import { Colors } from "../../constants/Colors";
import { useMediaStore } from "../../store/useMediaStore";
import { formatTime } from "../../utils/timeFormat";

export default function PlayerScreen() {
  const { id, slide } = useLocalSearchParams(); // 'slide' parameter for animation
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>("Loading...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadVideo = async () => {
      if (typeof id === "string") {
        try {
          const assetInfo = await MediaLibrary.getAssetInfoAsync(id);
          setVideoUri(assetInfo.localUri || assetInfo.uri);
          setVideoTitle(assetInfo.filename || "Unknown Video");
        } catch (error) {
          console.error("Video load failed:", error);
        } finally {
          setLoading(false);
        }
      }
    };
    loadVideo();
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, [id]);

  if (loading || !videoUri) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return <PlayerContent videoUri={videoUri} videoTitle={videoTitle} videoId={id as string} slide={slide as string} />;
}

function PlayerContent({ videoUri, videoTitle, videoId, slide }: { videoUri: string, videoTitle: string, videoId: string, slide: string }) {
  const router = useRouter();
  const { globalVideos } = useMediaStore();
  
  const currentIndex = globalVideos.findIndex((v) => v.id === videoId);
  const prevVideo = currentIndex > 0 ? globalVideos[currentIndex - 1] : null;
  const nextVideo = currentIndex !== -1 && currentIndex < globalVideos.length - 1 ? globalVideos[currentIndex + 1] : null;

  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.5;
    p.play(); 
  });

  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  const { currentTime } = useEvent(player, "timeUpdate", { currentTime: player.currentTime });

  const isEnded = player.duration > 0 && currentTime >= player.duration - 0.5 && !isPlaying;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [contentFit, setContentFit] = useState<"contain" | "cover" | "fill">("contain");
  const [isLocked, setIsLocked] = useState(false);
  const isLockedRef = useRef(false);

  // Menus States
  const [showSettings, setShowSettings] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false); 

  // Tracks Information
  const availableAudioTracks = player.availableAudioTracks || [];
  const currentAudioTrack = player.audioTrack;
  const availableSubtitleTracks = player.availableSubtitleTracks || []; 
  const currentSubtitleTrack = player.subtitleTrack;

  const [isUIActive, setIsUIActive] = useState(true);
  const isUIActiveRef = useRef(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // 🔥 ANIMATION STATE FOR LEFT/RIGHT
  const screenWidth = Dimensions.get("window").width;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [activeGesture, setActiveGesture] = useState<"seek" | "volume" | "brightness" | null>(null);
  const activeGestureRef = useRef<"seek" | "volume" | "brightness" | null>(null);
  
  const startVolRef = useRef(player.volume);
  const [brightness, setBrightness] = useState(0.5);
  const brightnessRef = useRef(0.5);

  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const scrubTargetRef = useRef<number | null>(null);
  const scrubStartPosRef = useRef(0);
  
  const gestureStartTime = useRef(0);
  const lastTapTimeRef = useRef(0);
  const singleTapTimeoutRef = useRef<any>(null);
  const [seekPopup, setSeekPopup] = useState<{ direction: "left" | "right"; text: string } | null>(null);
  
  const skipAccumulator = useRef(0);
  const skipTimeout = useRef<any>(null);
  const controlsTimeout = useRef<any>(null);

  // 🔥 ANIMATION EFFECT
  useEffect(() => {
    if (slide === "left") slideAnim.setValue(-screenWidth);
    else if (slide === "right") slideAnim.setValue(screenWidth);
    else slideAnim.setValue(0);

    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [videoId, slide]);

  useEffect(() => {
    const initBright = async () => {
      const { status } = await Brightness.requestPermissionsAsync();
      if (status === "granted") {
        const currentBrightness = await Brightness.getBrightnessAsync();
        setBrightness(currentBrightness);
        brightnessRef.current = currentBrightness;
      }
    };
    initBright();
  }, []);

  useEffect(() => {
    if (isEnded) {
      showUI();
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    }
  }, [isEnded]);

  const showUI = () => {
    setIsUIActive(true);
    isUIActiveRef.current = true;
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  };

  const hideUI = () => {
    if (isEnded) return; 
    setIsUIActive(false);
    isUIActiveRef.current = false;
    setShowSettings(false);
    setShowAudioMenu(false);
    setShowSubtitleMenu(false);
    Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  };

  const resetControlsTimeout = () => {
    if (activeGestureRef.current || isEnded) return;
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    showUI();
    controlsTimeout.current = setTimeout(() => hideUI(), 3500);
  };

  const handleScreenTap = () => {
    if (isEnded) return;
    if (isUIActiveRef.current) hideUI();
    else resetControlsTimeout();
  };

  const lockScreen = () => { setIsLocked(true); isLockedRef.current = true; hideUI(); };
  const unlockScreen = () => { setIsLocked(false); isLockedRef.current = false; resetControlsTimeout(); };

  // 🔥 SAFE SEEK LOGIC IMPROVED
  const safeSeek = (time: number) => {
    const wasPlaying = player.playing;
    player.pause(); 
    player.currentTime = time;
    
    setTimeout(() => {
      if (wasPlaying) player.play();
    }, 400); // Thoda kam delay kiya taki fast react kare
  };

  const safeSwitchAudioTrack = (track: any) => {
    player.pause(); 
    player.audioTrack = track; 
    setShowAudioMenu(false);
    resetControlsTimeout();
    setTimeout(() => { player.play(); }, 500);
  };

  // 🔥 SKIP CALCULATION FIXED (0 pe reset nahi hoga)
  const executeSkip = (direction: "left" | "right") => {
    skipAccumulator.current += direction === "right" ? 10 : -10;
    const popupText = skipAccumulator.current > 0 ? `+${skipAccumulator.current}s` : `${skipAccumulator.current}s`;
    setSeekPopup({ direction, text: popupText });

    // Proper math for skipping
    let newTime = player.currentTime + (direction === "right" ? 10 : -10);
    
    // Limits lagaye: 0 se niche na jaye, aur total duration se upar na jaye
    if (newTime < 0) newTime = 0;
    if (player.duration && newTime > player.duration) newTime = player.duration - 1;

    safeSeek(newTime);

    if (skipTimeout.current) clearTimeout(skipTimeout.current);
    skipTimeout.current = setTimeout(() => {
      setSeekPopup(null);
      skipAccumulator.current = 0;
    }, 1000);

    resetControlsTimeout();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10,
      onPanResponderGrant: () => {
        gestureStartTime.current = Date.now();
        scrubStartPosRef.current = player.currentTime;
        startVolRef.current = player.volume;
        activeGestureRef.current = null;
        setActiveGesture(null);
        if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      },
      onPanResponderMove: (evt, gestureState) => {
        if (isLockedRef.current || isEnded) return;
        const { dx, dy } = gestureState;
        const screenWidth = Dimensions.get("window").width;
        const isRightSide = evt.nativeEvent.pageX > screenWidth / 2;

        if (!activeGestureRef.current) {
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 15) {
            activeGestureRef.current = "seek";
            setActiveGesture("seek");
          } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 15) {
            activeGestureRef.current = isRightSide ? "volume" : "brightness";
            setActiveGesture(activeGestureRef.current);
          }
          return;
        }

        if (isUIActiveRef.current) hideUI();

        if (activeGestureRef.current === "seek") {
          const offsetSeconds = (dx / screenWidth) * 120; 
          const safeDuration = (player.duration && player.duration > 0) ? player.duration : Infinity;
          const newPos = Math.max(0, Math.min(safeDuration, scrubStartPosRef.current + offsetSeconds));
          setScrubTime(newPos);
          scrubTargetRef.current = newPos;
        } else if (activeGestureRef.current === "volume") {
          let newVol = startVolRef.current - dy / 250;
          player.volume = Math.max(0, Math.min(1, newVol));
        } else if (activeGestureRef.current === "brightness") {
          let newBright = brightnessRef.current - dy / 250;
          newBright = Math.max(0, Math.min(1, newBright));
          if (Math.abs(newBright - brightnessRef.current) >= 0.02) {
            brightnessRef.current = newBright;
            setBrightness(newBright);
            Brightness.setBrightnessAsync(newBright);
          }
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (isLockedRef.current || isEnded) {
          if (!activeGestureRef.current) handleScreenTap();
          return;
        }

        if (activeGestureRef.current === "seek" && scrubTargetRef.current !== null) {
          safeSeek(scrubTargetRef.current);
        }

        if (!activeGestureRef.current) {
          const now = Date.now();
          const screenWidth = Dimensions.get("window").width;
          if (now - gestureStartTime.current < 400 && Math.sqrt(gestureState.dx ** 2 + gestureState.dy ** 2) < 20) {
            if (now - lastTapTimeRef.current < 300) {
              if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
              lastTapTimeRef.current = 0;
              if (evt.nativeEvent.pageX < screenWidth / 3) executeSkip("left");
              else if (evt.nativeEvent.pageX > (screenWidth * 2) / 3) executeSkip("right");
            } else {
              lastTapTimeRef.current = now;
              singleTapTimeoutRef.current = setTimeout(() => handleScreenTap(), 250);
            }
          }
        }

        activeGestureRef.current = null;
        setActiveGesture(null);
        setScrubTime(null);
        scrubTargetRef.current = null; 
      },
    }),
  ).current;

  // 🔥 URL PARAMS BHEJE HAIN ANIMATION KE LIYE
  const playNext = () => { if (nextVideo) router.replace(`/player/${nextVideo.id}?slide=right` as any); };
  const playPrev = () => { if (prevVideo) router.replace(`/player/${prevVideo.id}?slide=left` as any); };
  const replayVideo = () => { safeSeek(0); resetControlsTimeout(); };

  return (
    <View style={styles.container}>
      <StatusBar hidden={isFullscreen} />

      {/* 🔥 ANIMATED VIEW WRAPPER */}
      <Animated.View style={[styles.videoWrapper, { transform: [{ translateX: slideAnim }] }]}>
        <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit={contentFit} />
        <Animated.View {...panResponder.panHandlers} style={StyleSheet.absoluteFill} collapsable={false} />

        {isLocked && isUIActive && !isEnded && (
          <View style={styles.unlockContainer}>
            <TouchableOpacity style={styles.unlockBtn} onPress={unlockScreen}>
              <MaterialIcons name="lock" size={24} color={Colors.primary} />
              <Text style={styles.unlockText}>Unlock</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* HUDs */}
        {activeGesture === "seek" && scrubTime !== null && (
          <View style={styles.centerHUD} pointerEvents="none">
            <Text style={styles.hudTime}>{formatTime(scrubTime)}</Text>
            <Text style={styles.hudSub}>[ {scrubTime - scrubStartPosRef.current >= 0 ? "+" : "-"}{Math.floor(Math.abs(scrubTime - scrubStartPosRef.current))}s ]</Text>
          </View>
        )}

        {activeGesture === "brightness" && (
          <View style={[styles.sideHUD, { left: 30 }]} pointerEvents="none">
            <MaterialIcons name="brightness-6" size={28} color="#fff" />
            <View style={styles.hudBarBg}><View style={[styles.hudBarFill, { height: `${brightness * 100}%` }]} /></View>
            <Text style={styles.hudText}>{Math.round(brightness * 100)}%</Text>
          </View>
        )}

        {activeGesture === "volume" && (
          <View style={[styles.sideHUD, { right: 30 }]} pointerEvents="none">
            <MaterialIcons name={player.muted || player.volume === 0 ? "volume-off" : player.volume < 0.5 ? "volume-down" : "volume-up"} size={28} color="#fff" />
            <View style={styles.hudBarBg}><View style={[styles.hudBarFill, { height: `${player.volume * 100}%` }]} /></View>
            <Text style={styles.hudText}>{Math.round(player.volume * 100)}%</Text>
          </View>
        )}

        {seekPopup && (
          <View style={[styles.seekPopupOverlay, seekPopup.direction === "left" ? { left: "15%" } : { right: "15%" }]} pointerEvents="none">
            <View style={styles.seekPopupBox}>
              <MaterialIcons name={seekPopup.direction === "left" ? "replay-10" : "forward-10"} size={35} color="#fff" />
              <Text style={styles.seekPopupText}>{seekPopup.text}</Text>
            </View>
          </View>
        )}

        {/* CONTROLS */}
        {!isLocked && (
          <Animated.View style={[styles.controlsOverlay, isEnded && styles.endScreenOverlay, { opacity: fadeAnim }]} pointerEvents={isUIActiveRef.current ? "box-none" : "none"}>
            
            <BlurView intensity={40} tint="dark" style={styles.topControls}>
              <View style={styles.topLeft}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                  <MaterialIcons name="arrow-back-ios" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.videoTitle} numberOfLines={1}>{videoTitle}</Text>
              </View>

              <View style={styles.topRightControls}>
                {availableSubtitleTracks.length > 0 && (
                  <TouchableOpacity onPress={() => { setShowSubtitleMenu(!showSubtitleMenu); setShowAudioMenu(false); setShowSettings(false); resetControlsTimeout(); }} style={styles.iconBtn}>
                    <MaterialIcons name="subtitles" size={24} color={currentSubtitleTrack ? Colors.primary : "#fff"} />
                  </TouchableOpacity>
                )}
                {availableAudioTracks.length > 1 && (
                  <TouchableOpacity onPress={() => { setShowAudioMenu(!showAudioMenu); setShowSubtitleMenu(false); setShowSettings(false); resetControlsTimeout(); }} style={styles.iconBtn}>
                    <MaterialIcons name="audiotrack" size={24} color={currentAudioTrack ? Colors.primary : "#fff"} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => { setShowSettings(!showSettings); setShowAudioMenu(false); setShowSubtitleMenu(false); resetControlsTimeout(); }} style={styles.iconBtn}>
                  <MaterialIcons name="speed" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setContentFit(contentFit === "contain" ? "cover" : "contain")} style={styles.iconBtn}>
                  <MaterialIcons name={contentFit === "contain" ? "crop-free" : "aspect-ratio"} size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={lockScreen} style={styles.iconBtn}><MaterialIcons name="lock-outline" size={24} color="#fff" /></TouchableOpacity>
              </View>
            </BlurView>

            {/* Menus */}
            {showAudioMenu && (
              <BlurView intensity={50} tint="dark" style={styles.settingsMenu}>
                <Text style={styles.menuTitle}>Audio Language</Text>
                {availableAudioTracks.map((track, idx) => (
                  <TouchableOpacity key={idx} style={styles.speedOption} onPress={() => safeSwitchAudioTrack(track)}>
                    <Text style={[styles.speedText, currentAudioTrack?.id === track.id && styles.activeSpeed]}>{track.language?.toUpperCase() || `Track ${idx+1}`}</Text>
                  </TouchableOpacity>
                ))}
              </BlurView>
            )}

            {showSubtitleMenu && (
              <BlurView intensity={50} tint="dark" style={styles.settingsMenu}>
                <Text style={styles.menuTitle}>Subtitles</Text>
                <TouchableOpacity style={styles.speedOption} onPress={() => { player.subtitleTrack = null; setShowSubtitleMenu(false); resetControlsTimeout(); }}>
                  <Text style={[styles.speedText, !currentSubtitleTrack && styles.activeSpeed]}>None</Text>
                </TouchableOpacity>
                {availableSubtitleTracks.map((track, idx) => (
                  <TouchableOpacity key={idx} style={styles.speedOption} onPress={() => { player.subtitleTrack = track; setShowSubtitleMenu(false); resetControlsTimeout(); }}>
                    <Text style={[styles.speedText, currentSubtitleTrack?.id === track.id && styles.activeSpeed]}>{track.language?.toUpperCase() || `Subtitle ${idx + 1}`}</Text>
                  </TouchableOpacity>
                ))}
              </BlurView>
            )}

            {showSettings && (
              <BlurView intensity={50} tint="dark" style={styles.settingsMenu}>
                <Text style={styles.menuTitle}>Speed</Text>
                {[0.5, 1.0, 1.25, 1.5, 2.0].map((s) => (
                  <TouchableOpacity key={s} style={styles.speedOption} onPress={() => { player.playbackRate = s; setShowSettings(false); resetControlsTimeout(); }}>
                    <Text style={[styles.speedText, player.playbackRate === s && styles.activeSpeed]}>{s}x</Text>
                  </TouchableOpacity>
                ))}
              </BlurView>
            )}

            <View style={styles.centerControls} pointerEvents="box-none">
              {isEnded ? (
                <View style={styles.endScreenContainer}>
                  <TouchableOpacity onPress={playPrev} disabled={!prevVideo} style={[styles.endBtn, { opacity: prevVideo ? 1 : 0.3 }]}><MaterialIcons name="skip-previous" size={50} color="#fff" /></TouchableOpacity>
                  <TouchableOpacity onPress={replayVideo} style={styles.replayBtn}><MaterialIcons name="replay" size={60} color="#fff" /></TouchableOpacity>
                  <TouchableOpacity onPress={playNext} disabled={!nextVideo} style={[styles.endBtn, { opacity: nextVideo ? 1 : 0.3 }]}><MaterialIcons name="skip-next" size={50} color="#fff" /></TouchableOpacity>
                </View>
              ) : (
                <View style={styles.centerNav} pointerEvents="box-none">
                  {/* 🔥 PREV BUTTON (Ab Playback me bhi dikhega) */}
                  <TouchableOpacity onPress={playPrev} disabled={!prevVideo} style={[styles.navBtn, { opacity: prevVideo ? 1 : 0.3 }]}>
                    <MaterialIcons name="skip-previous" size={45} color="#fff" />
                  </TouchableOpacity>

                  <TouchableOpacity hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }} onPress={() => { if (isPlaying) player.pause(); else player.play(); resetControlsTimeout(); }} style={styles.playPauseBtn}>
                    <MaterialIcons name={isPlaying ? "pause" : "play-arrow"} size={65} color="#fff" />
                  </TouchableOpacity>

                  {/* 🔥 NEXT BUTTON (Ab Playback me bhi dikhega) */}
                  <TouchableOpacity onPress={playNext} disabled={!nextVideo} style={[styles.navBtn, { opacity: nextVideo ? 1 : 0.3 }]}>
                    <MaterialIcons name="skip-next" size={45} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <BlurView intensity={40} tint="dark" style={styles.bottomControls}>
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
              <Slider
                style={styles.slider} minimumValue={0} maximumValue={player.duration || 1} value={currentTime}
                minimumTrackTintColor={Colors.primary} maximumTrackTintColor="rgba(255,255,255,0.4)" thumbTintColor={Colors.primary}
                onSlidingComplete={(value) => safeSeek(value)}
              />
              <Text style={styles.timeText}>{formatTime(player.duration)}</Text>
              <TouchableOpacity onPress={() => {
                if (isFullscreen) { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); setIsFullscreen(false); } 
                else { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE); setIsFullscreen(true); }
                resetControlsTimeout();
              }} style={styles.fullscreenBtn}>
                <MaterialIcons name={isFullscreen ? "fullscreen-exit" : "fullscreen"} size={26} color="#fff" />
              </TouchableOpacity>
            </BlurView>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centerContainer: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  videoWrapper: { flex: 1, justifyContent: "center", position: "relative" },
  unlockContainer: { position: "absolute", top: 50, left: 20, zIndex: 10 },
  unlockBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 30, borderWidth: 1, borderColor: Colors.primary },
  unlockText: { color: "#fff", fontWeight: "600", marginLeft: 8, fontSize: 15 },
  centerHUD: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(0,0,0,0.8)", paddingVertical: 10, paddingHorizontal: 25, borderRadius: 20, alignItems: "center", zIndex: 5 },
  hudTime: { color: "#fff", fontSize: 28, fontWeight: "bold" },
  hudSub: { color: Colors.primary, fontSize: 16, fontWeight: "bold" },
  sideHUD: { position: "absolute", top: "30%", backgroundColor: "rgba(0,0,0,0.6)", paddingVertical: 20, paddingHorizontal: 10, borderRadius: 25, alignItems: "center", zIndex: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  hudBarBg: { width: 4, height: 100, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2, marginVertical: 15, justifyContent: "flex-end", overflow: "hidden" },
  hudBarFill: { width: "100%", backgroundColor: Colors.primary, borderRadius: 2 },
  hudText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  seekPopupOverlay: { position: "absolute", top: "45%", zIndex: 10 },
  seekPopupBox: { alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", padding: 15, borderRadius: 25 },
  seekPopupText: { color: "#fff", fontSize: 14, fontWeight: "bold", marginTop: 5 },
  controlsOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between", zIndex: 2 },
  endScreenOverlay: { backgroundColor: "rgba(0,0,0,0.7)" },
  topControls: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 15, paddingTop: 50, paddingBottom: 15 },
  topLeft: { flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 10 },
  videoTitle: { color: "#fff", fontSize: 16, fontWeight: "600", marginLeft: 5, flex: 1 },
  topRightControls: { flexDirection: "row", alignItems: "center", gap: 5 },
  iconBtn: { padding: 8 },
  settingsMenu: { position: "absolute", top: 100, right: 20, borderRadius: 15, overflow: "hidden", padding: 15, zIndex: 20, width: 180, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  menuTitle: { color: Colors.primary, fontSize: 16, fontWeight: "bold", marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.2)" },
  speedOption: { paddingVertical: 10 },
  speedText: { color: "#ccc", fontSize: 15 },
  activeSpeed: { color: "#fff", fontWeight: "bold" },
  centerControls: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 3 },
  centerNav: { flexDirection: "row", alignItems: "center", gap: 30 }, // Gap badha diya
  navBtn: { padding: 10 }, // Next/Prev button padding
  playPauseBtn: { backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 60, padding: 10 },
  endScreenContainer: { flexDirection: "row", alignItems: "center", gap: 35 },
  endBtn: { padding: 15 },
  replayBtn: { backgroundColor: Colors.primary, borderRadius: 60, padding: 15, elevation: 10 },
  bottomControls: { flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingBottom: 35, paddingTop: 10 },
  timeText: { color: "#fff", fontSize: 12, width: 45, textAlign: "center" },
  slider: { flex: 1, height: 40, marginHorizontal: 5 },
  fullscreenBtn: { marginLeft: 5, padding: 5 },
});
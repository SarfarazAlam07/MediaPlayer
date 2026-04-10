import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Brightness from "expo-brightness";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { VLCPlayer } from "react-native-vlc-media-player";
import { Colors } from "../../constants/Colors";
import { useMediaStore } from "../../store/useMediaStore";
import { usePlayerStore } from "../../store/usePlayerStore";
import { formatTime } from "../../utils/timeFormat";

const Slider = require("@react-native-community/slider").default;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function PlayerScreen() {
  const { id, slide } = useLocalSearchParams();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>("Loading...");
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const loadVideo = async () => {
      if (typeof id === "string") {
        try {
          const assetInfo = await MediaLibrary.getAssetInfoAsync(id);
          if (isMounted.current) {
            setVideoUri(assetInfo.localUri || assetInfo.uri);
            setVideoTitle(assetInfo.filename || "Unknown Video");
          }
        } catch (error) {
          console.error("Video load failed:", error);
        } finally {
          if (isMounted.current) setLoading(false);
        }
      }
    };
    loadVideo();
    return () => {
      isMounted.current = false;
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

  return (
    <PlayerContent
      videoUri={videoUri}
      videoTitle={videoTitle}
      videoId={id as string}
      slide={slide as string}
    />
  );
}

function PlayerContent({
  videoUri,
  videoTitle,
  videoId,
  slide,
}: {
  videoUri: string;
  videoTitle: string;
  videoId: string;
  slide: string;
}) {
  const router = useRouter();
  const { globalVideos } = useMediaStore();
  const { sound: audioSound, pauseTrack } = usePlayerStore();

  const playerRef = useRef<any>(null);
  const isComponentMounted = useRef(true);
  const isSeekingRef = useRef(false);

  // Player state
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number>(-1);
  const [availableAudioTracks, setAvailableAudioTracks] = useState<any[]>([]);
  const [selectedTextTrack, setSelectedTextTrack] = useState<number>(-1);
  const [availableTextTracks, setAvailableTextTracks] = useState<any[]>([]);

  // UI state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const isLockedRef = useRef(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [isUIActive, setIsUIActive] = useState(true);
  const isUIActiveRef = useRef(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Gesture state
  const [activeGesture, setActiveGesture] = useState<"seek" | "volume" | "brightness" | null>(null);
  const activeGestureRef = useRef<"seek" | "volume" | "brightness" | null>(null);
  const startVolRef = useRef(volume);
  const brightnessRef = useRef(0.5);
  const [brightness, setBrightness] = useState(0.5);
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

  // Navigation
  const currentIndex = globalVideos.findIndex((v) => v.id === videoId);
  const prevVideo = currentIndex > 0 ? globalVideos[currentIndex - 1] : null;
  const nextVideo = currentIndex !== -1 && currentIndex < globalVideos.length - 1 ? globalVideos[currentIndex + 1] : null;
  const isEnded = duration > 0 && currentTime >= duration - 0.5 && !isPlaying;

  // Pause audio when video starts
  useEffect(() => {
    if (audioSound && pauseTrack) pauseTrack();
  }, []);

  // Animations
  useEffect(() => {
    if (slide === "left") slideAnim.setValue(-SCREEN_WIDTH);
    else if (slide === "right") slideAnim.setValue(SCREEN_WIDTH);
    else slideAnim.setValue(0);
    Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }).start();
  }, [videoId, slide]);

  // Brightness
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

  // Cleanup
  useEffect(() => {
    isComponentMounted.current = true;
    return () => {
      isComponentMounted.current = false;
      controlsTimeout.current && clearTimeout(controlsTimeout.current);
      skipTimeout.current && clearTimeout(skipTimeout.current);
      singleTapTimeoutRef.current && clearTimeout(singleTapTimeoutRef.current);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  useEffect(() => {
    if (isEnded) {
      showUI();
      controlsTimeout.current && clearTimeout(controlsTimeout.current);
    }
  }, [isEnded]);

  // UI functions
  const showUI = useCallback(() => {
    if (!isComponentMounted.current) return;
    setIsUIActive(true);
    isUIActiveRef.current = true;
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const hideUI = useCallback(() => {
    if (isEnded || !isComponentMounted.current) return;
    setIsUIActive(false);
    isUIActiveRef.current = false;
    setShowSettings(false);
    setShowAudioMenu(false);
    setShowSubtitleMenu(false);
    Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  }, [isEnded, fadeAnim]);

  const resetControlsTimeout = useCallback(() => {
    if (activeGestureRef.current || isEnded || !isComponentMounted.current) return;
    controlsTimeout.current && clearTimeout(controlsTimeout.current);
    showUI();
    controlsTimeout.current = setTimeout(() => hideUI(), 3500);
  }, [isEnded, showUI, hideUI]);

  const handleScreenTap = useCallback(() => {
    if (isEnded || !isComponentMounted.current) return;
    if (isUIActiveRef.current) hideUI();
    else resetControlsTimeout();
  }, [isEnded, hideUI, resetControlsTimeout]);

  const lockScreen = useCallback(() => { setIsLocked(true); isLockedRef.current = true; hideUI(); }, [hideUI]);
  const unlockScreen = useCallback(() => { setIsLocked(false); isLockedRef.current = false; resetControlsTimeout(); }, [resetControlsTimeout]);

  // 🔥 CRITICAL: VLC uses 0-1 range for seek
  const safeSeek = useCallback((time: number) => {
    if (!playerRef.current || !isComponentMounted.current || isSeekingRef.current) return;
    isSeekingRef.current = true;
    const targetTime = Math.max(0, Math.min(duration || time, time));
    const seekValue = targetTime / duration; // Convert to 0-1 range
    playerRef.current.seek = seekValue;
    setTimeout(() => { isSeekingRef.current = false; }, 100);
  }, [duration]);

  // VLC Event Handlers
  const onLoad = useCallback((data: any) => {
    console.log("Video loaded:", data);
    setDuration(data.duration);
    
    // Parse audio tracks (documentation format)
    if (data.audioTracks && data.audioTracks.length > 0) {
      setAvailableAudioTracks(data.audioTracks);
      // Auto-select first non-disabled track (id !== -1)
      const firstTrack = data.audioTracks.find((t: any) => t.id !== -1);
      if (firstTrack) {
        setSelectedAudioTrack(firstTrack.id);
        if (playerRef.current) playerRef.current.audioTrack = firstTrack.id;
      }
    }
    
    // Parse subtitle tracks
    if (data.textTracks && data.textTracks.length > 0) {
      setAvailableTextTracks(data.textTracks);
    }
    
    resetControlsTimeout();
  }, []);

  const onProgress = useCallback((data: any) => {
    if (!isSeekingRef.current) {
      setCurrentTime(data.currentTime);
    }
  }, []);

  const onEnd = useCallback(() => { setIsPlaying(false); }, []);
  const onError = useCallback((error: any) => console.error("VLC Error:", error), []);

  // Track switching
  const onAudioTrackChange = useCallback((trackId: number) => {
    setSelectedAudioTrack(trackId);
    if (playerRef.current) playerRef.current.audioTrack = trackId;
    setShowAudioMenu(false);
    resetControlsTimeout();
  }, []);

  const onTextTrackChange = useCallback((trackId: number) => {
    setSelectedTextTrack(trackId);
    if (playerRef.current) playerRef.current.textTrack = trackId;
    setShowSubtitleMenu(false);
    resetControlsTimeout();
  }, []);

  // Skip controls
  const GESTURE_SENSITIVITY = 0.4;
  const executeSkip = useCallback((direction: "left" | "right") => {
    if (!isComponentMounted.current || isSeekingRef.current) return;
    skipAccumulator.current += direction === "right" ? 10 : -10;
    setSeekPopup({ direction, text: `${skipAccumulator.current > 0 ? "+" : ""}${skipAccumulator.current}s` });
    let newTime = currentTime + (direction === "right" ? 10 : -10);
    if (newTime < 0) newTime = 0;
    if (duration && newTime > duration) newTime = duration - 1;
    safeSeek(newTime);
    skipTimeout.current = setTimeout(() => {
      if (isComponentMounted.current) setSeekPopup(null);
      skipAccumulator.current = 0;
    }, 1000);
    resetControlsTimeout();
  }, [currentTime, duration, safeSeek, resetControlsTimeout]);

  // PanResponder (same as before, kept for gesture controls)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dx, dy }) => Math.abs(dx) > 10 || Math.abs(dy) > 10,
      onPanResponderGrant: () => {
        if (!isComponentMounted.current) return;
        gestureStartTime.current = Date.now();
        scrubStartPosRef.current = currentTime;
        startVolRef.current = volume;
        activeGestureRef.current = null;
        setActiveGesture(null);
        controlsTimeout.current && clearTimeout(controlsTimeout.current);
      },
      onPanResponderMove: (evt, { dx, dy }) => {
        if (isLockedRef.current || isEnded || !isComponentMounted.current) return;
        const isRightSide = evt.nativeEvent.pageX > SCREEN_WIDTH / 2;
        if (!activeGestureRef.current) {
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 15) activeGestureRef.current = "seek";
          else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 15) activeGestureRef.current = isRightSide ? "volume" : "brightness";
          else return;
          setActiveGesture(activeGestureRef.current);
        }
        if (isUIActiveRef.current) hideUI();
        if (activeGestureRef.current === "seek") {
          const offsetSeconds = (dx / SCREEN_WIDTH) * 60;
          const newPos = Math.max(0, Math.min(duration || Infinity, scrubStartPosRef.current + offsetSeconds));
          setScrubTime(newPos);
          scrubTargetRef.current = newPos;
        } else if (activeGestureRef.current === "volume") {
          let newVol = startVolRef.current - (dy / 500) * GESTURE_SENSITIVITY;
          newVol = Math.max(0, Math.min(1, newVol));
          setVolume(newVol);
          if (playerRef.current) playerRef.current.volume = newVol;
        } else if (activeGestureRef.current === "brightness") {
          let newBright = brightnessRef.current - (dy / 500) * GESTURE_SENSITIVITY;
          newBright = Math.max(0, Math.min(1, newBright));
          if (Math.abs(newBright - brightnessRef.current) >= 0.01) {
            brightnessRef.current = newBright;
            Brightness.setBrightnessAsync(newBright);
            if (Math.abs(newBright - brightness) > 0.03) setBrightness(newBright);
          }
        }
      },
      onPanResponderRelease: (evt, { dx, dy }) => {
        if (!isComponentMounted.current) return;
        if (isLockedRef.current || isEnded) {
          if (!activeGestureRef.current) handleScreenTap();
          activeGestureRef.current = null;
          setActiveGesture(null);
          return;
        }
        if (activeGestureRef.current === "seek" && scrubTargetRef.current !== null && !isSeekingRef.current) {
          safeSeek(scrubTargetRef.current);
        }
        if (!activeGestureRef.current) {
          const now = Date.now();
          if (now - gestureStartTime.current < 400 && Math.sqrt(dx ** 2 + dy ** 2) < 20) {
            if (now - lastTapTimeRef.current < 300) {
              singleTapTimeoutRef.current && clearTimeout(singleTapTimeoutRef.current);
              lastTapTimeRef.current = 0;
              if (evt.nativeEvent.pageX < SCREEN_WIDTH / 3) executeSkip("left");
              else if (evt.nativeEvent.pageX > (SCREEN_WIDTH * 2) / 3) executeSkip("right");
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
        if (brightnessRef.current !== brightness) setBrightness(brightnessRef.current);
      },
    })
  ).current;

  const playNext = useCallback(() => {
    if (nextVideo && isComponentMounted.current) router.replace(`/player/${nextVideo.id}?slide=right`);
  }, [nextVideo, router]);
  const playPrev = useCallback(() => {
    if (prevVideo && isComponentMounted.current) router.replace(`/player/${prevVideo.id}?slide=left`);
  }, [prevVideo, router]);
  const replayVideo = useCallback(() => { safeSeek(0); resetControlsTimeout(); }, [safeSeek, resetControlsTimeout]);

  return (
    <View style={styles.container}>
      <StatusBar hidden={isFullscreen} />
      <Animated.View style={[styles.videoWrapper, { transform: [{ translateX: slideAnim }] }]}>
        <VLCPlayer
          ref={playerRef}
          style={StyleSheet.absoluteFill}
          source={{ uri: videoUri }}
          paused={!isPlaying}
          volume={volume}
          rate={playbackRate}
          audioTrack={selectedAudioTrack}
          textTrack={selectedTextTrack}
          videoAspectRatio="16:9"
          autoAspectRatio={false}
          resizeMode="contain"
          autoplay={true}
          onLoad={onLoad}
          onProgress={onProgress}
          onEnd={onEnd}
          onError={onError}
        />
        <Animated.View {...panResponder.panHandlers} style={StyleSheet.absoluteFill} collapsable={false} />

        {/* Lock UI */}
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
            <Text style={styles.hudSub}>[{scrubTime >= scrubStartPosRef.current ? "+" : "-"}{Math.abs(Math.floor(scrubTime - scrubStartPosRef.current))}s]</Text>
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
            <MaterialIcons name={volume === 0 ? "volume-off" : volume < 0.5 ? "volume-down" : "volume-up"} size={28} color="#fff" />
            <View style={styles.hudBarBg}><View style={[styles.hudBarFill, { height: `${volume * 100}%` }]} /></View>
            <Text style={styles.hudText}>{Math.round(volume * 100)}%</Text>
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

        {/* Controls Overlay */}
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
                {availableTextTracks.length > 0 && (
                  <TouchableOpacity onPress={() => { setShowSubtitleMenu(!showSubtitleMenu); setShowAudioMenu(false); setShowSettings(false); resetControlsTimeout(); }} style={styles.iconBtn}>
                    <MaterialIcons name="subtitles" size={24} color={selectedTextTrack !== -1 ? Colors.primary : "#fff"} />
                  </TouchableOpacity>
                )}
                {availableAudioTracks.length > 1 && (
                  <TouchableOpacity onPress={() => { setShowAudioMenu(!showAudioMenu); setShowSubtitleMenu(false); setShowSettings(false); resetControlsTimeout(); }} style={styles.iconBtn}>
                    <MaterialIcons name="audiotrack" size={24} color={selectedAudioTrack !== -1 ? Colors.primary : "#fff"} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => { setShowSettings(!showSettings); setShowAudioMenu(false); setShowSubtitleMenu(false); resetControlsTimeout(); }} style={styles.iconBtn}>
                  <MaterialIcons name="speed" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={lockScreen} style={styles.iconBtn}>
                  <MaterialIcons name="lock-outline" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </BlurView>

            {/* Audio Track Menu */}
            {showAudioMenu && availableAudioTracks.length > 0 && (
              <BlurView intensity={50} tint="dark" style={styles.settingsMenu}>
                <Text style={styles.menuTitle}>Audio Language</Text>
                {availableAudioTracks.map((track) => (
                  <TouchableOpacity key={track.id} style={styles.speedOption} onPress={() => onAudioTrackChange(track.id)}>
                    <Text style={[styles.speedText, selectedAudioTrack === track.id && styles.activeSpeed]}>
                      {track.name || `Track ${track.id}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </BlurView>
            )}

            {/* Subtitle Menu */}
            {showSubtitleMenu && availableTextTracks.length > 0 && (
              <BlurView intensity={50} tint="dark" style={styles.settingsMenu}>
                <Text style={styles.menuTitle}>Subtitles</Text>
                <TouchableOpacity style={styles.speedOption} onPress={() => onTextTrackChange(-1)}>
                  <Text style={[styles.speedText, selectedTextTrack === -1 && styles.activeSpeed]}>None</Text>
                </TouchableOpacity>
                {availableTextTracks.map((track) => (
                  <TouchableOpacity key={track.id} style={styles.speedOption} onPress={() => onTextTrackChange(track.id)}>
                    <Text style={[styles.speedText, selectedTextTrack === track.id && styles.activeSpeed]}>
                      {track.name || `Subtitle ${track.id}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </BlurView>
            )}

            {/* Speed Menu */}
            {showSettings && (
              <BlurView intensity={50} tint="dark" style={styles.settingsMenu}>
                <Text style={styles.menuTitle}>Speed</Text>
                {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
                  <TouchableOpacity key={s} style={styles.speedOption} onPress={() => { setPlaybackRate(s); setShowSettings(false); resetControlsTimeout(); }}>
                    <Text style={[styles.speedText, playbackRate === s && styles.activeSpeed]}>{s}x</Text>
                  </TouchableOpacity>
                ))}
              </BlurView>
            )}

            {/* Center Controls */}
            <View style={styles.centerControls} pointerEvents="box-none">
              {isEnded ? (
                <View style={styles.endScreenContainer}>
                  <TouchableOpacity onPress={playPrev} disabled={!prevVideo} style={[styles.endBtn, { opacity: prevVideo ? 1 : 0.3 }]}>
                    <MaterialIcons name="skip-previous" size={50} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={replayVideo} style={styles.replayBtn}>
                    <MaterialIcons name="replay" size={60} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={playNext} disabled={!nextVideo} style={[styles.endBtn, { opacity: nextVideo ? 1 : 0.3 }]}>
                    <MaterialIcons name="skip-next" size={50} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.centerNav}>
                  <TouchableOpacity onPress={playPrev} disabled={!prevVideo} style={[styles.navBtn, { opacity: prevVideo ? 1 : 0.3 }]}>
                    <MaterialIcons name="skip-previous" size={45} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }} onPress={() => { setIsPlaying(!isPlaying); resetControlsTimeout(); }} style={styles.playPauseBtn}>
                    <MaterialIcons name={isPlaying ? "pause" : "play-arrow"} size={65} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={playNext} disabled={!nextVideo} style={[styles.navBtn, { opacity: nextVideo ? 1 : 0.3 }]}>
                    <MaterialIcons name="skip-next" size={45} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Bottom Controls */}
            <BlurView intensity={40} tint="dark" style={styles.bottomControls}>
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={duration || 1}
                value={currentTime}
                minimumTrackTintColor={Colors.primary}
                maximumTrackTintColor="rgba(255,255,255,0.4)"
                thumbTintColor={Colors.primary}
                onSlidingComplete={safeSeek}
              />
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
              <TouchableOpacity onPress={() => {
                if (isFullscreen) {
                  ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
                  setIsFullscreen(false);
                } else {
                  ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
                  setIsFullscreen(true);
                }
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
  settingsMenu: { position: "absolute", top: 100, right: 20, borderRadius: 15, overflow: "hidden", padding: 15, zIndex: 20, width: 200, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  menuTitle: { color: Colors.primary, fontSize: 16, fontWeight: "bold", marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.2)" },
  speedOption: { paddingVertical: 10 },
  speedText: { color: "#ccc", fontSize: 15 },
  activeSpeed: { color: "#fff", fontWeight: "bold" },
  centerControls: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 3 },
  centerNav: { flexDirection: "row", alignItems: "center", gap: 30 },
  navBtn: { padding: 10 },
  playPauseBtn: { backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 60, padding: 10 },
  endScreenContainer: { flexDirection: "row", alignItems: "center", gap: 35 },
  endBtn: { padding: 15 },
  replayBtn: { backgroundColor: Colors.primary, borderRadius: 60, padding: 15, elevation: 10 },
  bottomControls: { flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingBottom: 35, paddingTop: 10 },
  timeText: { color: "#fff", fontSize: 12, width: 45, textAlign: "center" },
  slider: { flex: 1, height: 40, marginHorizontal: 5 },
  fullscreenBtn: { marginLeft: 5, padding: 5 },
});
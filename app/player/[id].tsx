import { MaterialIcons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { Audio, ResizeMode, Video } from "expo-av";
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
import { Colors } from "../../constants/Colors";
import { useMediaStore } from "../../store/useMediaStore";
import { formatTime } from "../../utils/timeFormat";

export default function PlayerScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const videoRef = useRef<Video>(null);

  const { globalVideos } = useMediaStore();
  const currentIndex = globalVideos.findIndex((v) => v.id === id);
  const prevVideo = currentIndex > 0 ? globalVideos[currentIndex - 1] : null;
  const nextVideo =
    currentIndex !== -1 && currentIndex < globalVideos.length - 1
      ? globalVideos[currentIndex + 1]
      : null;

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>("Loading...");
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [resizeMode, setResizeMode] = useState<ResizeMode>(ResizeMode.CONTAIN);

  const [isLocked, setIsLocked] = useState(false);
  const isLockedRef = useRef(false);

  const [isMuted, setIsMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  const [status, setStatus] = useState<any>({});

  const [isUIActive, setIsUIActive] = useState(true);
  // 🔥 FIX: Stale Closure bug se bachne ke liye Ref add kiya
  const isUIActiveRef = useRef(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // 🔥 Smart Gesture States & Refs
  const [activeGesture, setActiveGesture] = useState<
    "seek" | "volume" | "brightness" | null
  >(null);
  const activeGestureRef = useRef<"seek" | "volume" | "brightness" | null>(
    null,
  );

  const [volume, setVolume] = useState(1.0);
  const volumeRef = useRef(1.0);
  const startVolRef = useRef(1.0);

  const [brightness, setBrightness] = useState(0.5);
  const brightnessRef = useRef(0.5);
  const startBrightRef = useRef(0.5);

  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const scrubTargetRef = useRef<number | null>(null);
  const currentPosRef = useRef(0);
  const durationRef = useRef(0);
  const scrubStartPosRef = useRef(0);

  const gestureStartTime = useRef(0);
  const lastTapTimeRef = useRef(0);
  const singleTapTimeoutRef = useRef<any>(null);

  const isPlayingRef = useRef(false);

  const skipAccumulator = useRef(0);
  const targetPositionRef = useRef<number | null>(null);
  const skipTimeout = useRef<any>(null);
  const [seekPopup, setSeekPopup] = useState<{
    direction: "left" | "right";
    text: string;
  } | null>(null);
  const controlsTimeout = useRef<any>(null);

  useEffect(() => {
    const initSystem = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });

        const { status } = await Brightness.requestPermissionsAsync();
        if (status === "granted") {
          const currentBrightness = await Brightness.getBrightnessAsync();
          setBrightness(currentBrightness);
          brightnessRef.current = currentBrightness;
        }
      } catch (e) {
        console.log("System Init Error:", e);
      }

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
    initSystem();
    return () => {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      );
    };
  }, [id]);

  useEffect(() => {
    if (status.isLoaded) {
      currentPosRef.current = status.positionMillis || 0;
      durationRef.current = status.durationMillis || 0;
      isPlayingRef.current = status.isPlaying;
    }
    if (status.didJustFinish) {
      showUI();
      setShowSettings(false);
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    }
  }, [status]);

  const showUI = () => {
    setIsUIActive(true);
    isUIActiveRef.current = true; // 🔥 Immediate ref update
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const hideUI = () => {
    setIsUIActive(false);
    isUIActiveRef.current = false; // 🔥 Immediate ref update
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const resetControlsTimeout = () => {
    if (status.didJustFinish || activeGestureRef.current) return;
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    showUI();
    controlsTimeout.current = setTimeout(() => hideUI(), 3500);
  };

  // 🔥 FIX: Ab ye Ref use kar raha hai tap pe toggle karne ke liye
  const handleScreenTap = () => {
    if (status.didJustFinish) return;
    setShowSettings(false);

    if (isUIActiveRef.current) {
      hideUI();
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    } else {
      resetControlsTimeout();
    }
  };

  const safePlay = async () => {
    try {
      if (videoRef.current) await videoRef.current.playAsync();
    } catch (error) {
      console.warn("OS Blocked Audio. Playing muted.");
      if (videoRef.current) {
        await videoRef.current.setIsMutedAsync(true);
        await videoRef.current.playAsync();
      }
    }
  };

  const lockScreen = () => {
    setIsLocked(true);
    isLockedRef.current = true;
    hideUI();
  };
  const unlockScreen = () => {
    setIsLocked(false);
    isLockedRef.current = false;
    resetControlsTimeout();
  };

  const executeSkip = async (direction: "left" | "right") => {
    if (!videoRef.current || !status.isLoaded || status.didJustFinish) return;

    if (seekPopup?.direction !== direction) {
      skipAccumulator.current = 0;
      targetPositionRef.current = status.positionMillis;
    }

    const amount = 10000;
    skipAccumulator.current += direction === "right" ? 10 : -10;
    const popupText =
      skipAccumulator.current > 0
        ? `+${skipAccumulator.current}s`
        : `${skipAccumulator.current}s`;
    setSeekPopup({ direction, text: popupText });

    const duration = status.durationMillis || 0;
    let currentTarget =
      targetPositionRef.current !== null
        ? targetPositionRef.current
        : status.positionMillis;
    currentTarget += direction === "right" ? amount : -amount;
    currentTarget = Math.max(0, Math.min(duration, currentTarget));

    targetPositionRef.current = currentTarget;
    await videoRef.current.setPositionAsync(currentTarget);

    if (skipTimeout.current) clearTimeout(skipTimeout.current);
    skipTimeout.current = setTimeout(() => {
      setSeekPopup(null);
      skipAccumulator.current = 0;
      targetPositionRef.current = null;
    }, 1000);

    resetControlsTimeout();
  };

  // 🔥 MAGIC GESTURE LAYER
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: (evt) => {
        gestureStartTime.current = Date.now();
        scrubStartPosRef.current = currentPosRef.current;
        startVolRef.current = volumeRef.current;
        startBrightRef.current = brightnessRef.current;
        activeGestureRef.current = null;
        setActiveGesture(null);
        if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      },
      onPanResponderMove: (evt, gestureState) => {
        if (isLockedRef.current) return;

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
          const offset = dx * 150;
          const newPos = Math.max(
            0,
            Math.min(durationRef.current, scrubStartPosRef.current + offset),
          );
          setScrubTime(newPos);
          scrubTargetRef.current = newPos;
        } else if (activeGestureRef.current === "volume") {
          let newVol = startVolRef.current - dy / 250;
          newVol = Math.max(0, Math.min(1, newVol));
          if (Math.abs(newVol - volumeRef.current) >= 0.02) {
            volumeRef.current = newVol;
            setVolume(newVol);
            if (videoRef.current) videoRef.current.setVolumeAsync(newVol);
          }
        } else if (activeGestureRef.current === "brightness") {
          let newBright = startBrightRef.current - dy / 250;
          newBright = Math.max(0, Math.min(1, newBright));
          if (Math.abs(newBright - brightnessRef.current) >= 0.02) {
            brightnessRef.current = newBright;
            setBrightness(newBright);
            Brightness.setBrightnessAsync(newBright);
          }
        }
      },
      onPanResponderRelease: async (evt, gestureState) => {
        if (isLockedRef.current) {
          if (!activeGestureRef.current) handleScreenTap();
          return;
        }

        if (
          activeGestureRef.current === "seek" &&
          scrubTargetRef.current !== null
        ) {
          if (videoRef.current) {
            await videoRef.current.setPositionAsync(scrubTargetRef.current);
            await safePlay();
          }
        }

        // 🔥 PERFECT TAP TIMING & CLOSURE FIX
        if (!activeGestureRef.current) {
          const now = Date.now();
          const tapDuration = now - gestureStartTime.current;
          const distanceMoved = Math.sqrt(
            gestureState.dx * gestureState.dx +
              gestureState.dy * gestureState.dy,
          );

          if (tapDuration < 400 && distanceMoved < 20) {
            const timeSinceLastTap = now - lastTapTimeRef.current;

            if (timeSinceLastTap < 300) {
              // DOUBLE TAP DETECTED
              if (singleTapTimeoutRef.current)
                clearTimeout(singleTapTimeoutRef.current);
              lastTapTimeRef.current = 0;

              const screenWidth = Dimensions.get("window").width;
              const tapX = evt.nativeEvent.pageX;

              if (tapX < screenWidth / 3) executeSkip("left");
              else if (tapX > (screenWidth * 2) / 3) executeSkip("right");
            } else {
              // SINGLE TAP DETECTED
              lastTapTimeRef.current = now;
              singleTapTimeoutRef.current = setTimeout(() => {
                handleScreenTap(); // Ab ye safely naya UI ref value padhega
              }, 250);
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

  const handlePlayPause = async () => {
    if (!videoRef.current || !status.isLoaded) return;

    const wasPlaying = isPlayingRef.current;
    isPlayingRef.current = !wasPlaying;

    if (wasPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await safePlay();
    }
    resetControlsTimeout();
  };

  const replayVideo = async () => {
    if (videoRef.current) {
      await videoRef.current.setPositionAsync(0);
      await safePlay();
      resetControlsTimeout();
    }
  };

  const playNext = () => {
    if (nextVideo) router.replace(`/player/${nextVideo.id}` as any);
  };
  const playPrev = () => {
    if (prevVideo) router.replace(`/player/${prevVideo.id}` as any);
  };

  const changeSpeed = async (speed: number) => {
    if (videoRef.current) {
      await videoRef.current.setStatusAsync({
        rate: speed,
        shouldCorrectPitch: true,
      });
      setPlaybackSpeed(speed);
      setShowSettings(false);
      resetControlsTimeout();
    }
  };

  const toggleFullscreen = async () => {
    if (isFullscreen) {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      );
      setIsFullscreen(false);
    } else {
      const isPortraitVideo = videoDimensions.height > videoDimensions.width;
      if (!isPortraitVideo) {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE,
        );
      }
      setIsFullscreen(true);
    }
    resetControlsTimeout();
  };

  const toggleResizeMode = () => {
    if (resizeMode === ResizeMode.CONTAIN) setResizeMode(ResizeMode.COVER);
    else if (resizeMode === ResizeMode.COVER) setResizeMode(ResizeMode.STRETCH);
    else setResizeMode(ResizeMode.CONTAIN);
    resetControlsTimeout();
  };

  const getResizeIcon = () => {
    if (resizeMode === ResizeMode.CONTAIN) return "aspect-ratio";
    if (resizeMode === ResizeMode.COVER) return "crop-free";
    return "settings-overscan";
  };

  if (loading)
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );

  return (
    <View style={styles.container}>
      <StatusBar hidden={isFullscreen} />

      <View style={styles.videoWrapper}>
        <Video
          ref={videoRef}
          style={StyleSheet.absoluteFill}
          source={{ uri: videoUri! }}
          useNativeControls={false}
          resizeMode={resizeMode}
          shouldPlay={true}
          isMuted={isMuted}
          onPlaybackStatusUpdate={(s) => setStatus(s)}
          onReadyForDisplay={(e) => setVideoDimensions(e.naturalSize)}
        />

        {/* 👆 MAGIC LAYER: Swipes & Double Taps */}
        <Animated.View
          {...panResponder.panHandlers}
          style={StyleSheet.absoluteFill}
          collapsable={false}
        />

        {/* 🔒 UNLOCK BUTTON */}
        {isLocked && isUIActive && !status.didJustFinish && (
          <Animated.View
            style={[styles.unlockContainer, { opacity: fadeAnim }]}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              style={styles.unlockBtn}
              onPress={unlockScreen}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <MaterialIcons name="lock" size={24} color={Colors.primary} />
              <Text style={styles.unlockText}>Unlock Screen</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* 🚀 SEEK HUD */}
        {activeGesture === "seek" && scrubTime !== null && (
          <View style={styles.centerHUD} pointerEvents="none">
            <Text style={styles.hudTime}>{formatTime(scrubTime / 1000)}</Text>
            <Text style={styles.hudSub}>
              [ {scrubTime - scrubStartPosRef.current >= 0 ? "+" : "-"}
              {Math.floor(
                Math.abs(scrubTime - scrubStartPosRef.current) / 1000,
              )}
              s ]
            </Text>
          </View>
        )}

        {/* ☀️ BRIGHTNESS HUD */}
        {activeGesture === "brightness" && (
          <View style={[styles.sideHUD, { left: 30 }]} pointerEvents="none">
            <MaterialIcons name="brightness-6" size={28} color="#fff" />
            <View style={styles.hudBarBg}>
              <View
                style={[styles.hudBarFill, { height: `${brightness * 100}%` }]}
              />
            </View>
            <Text style={styles.hudText}>{Math.round(brightness * 100)}%</Text>
          </View>
        )}

        {/* 🔊 VOLUME HUD */}
        {activeGesture === "volume" && (
          <View style={[styles.sideHUD, { right: 30 }]} pointerEvents="none">
            <MaterialIcons
              name={
                volume === 0
                  ? "volume-off"
                  : volume < 0.5
                    ? "volume-down"
                    : "volume-up"
              }
              size={28}
              color="#fff"
            />
            <View style={styles.hudBarBg}>
              <View
                style={[styles.hudBarFill, { height: `${volume * 100}%` }]}
              />
            </View>
            <Text style={styles.hudText}>{Math.round(volume * 100)}%</Text>
          </View>
        )}

        {/* DOUBLE TAP POPUPS */}
        {seekPopup && (
          <View
            style={[
              styles.seekPopupOverlay,
              seekPopup.direction === "left"
                ? { left: "15%" }
                : { right: "15%" },
            ]}
            pointerEvents="none"
          >
            <View style={styles.seekPopupBox}>
              <MaterialIcons
                name={
                  seekPopup.direction === "left" ? "replay-10" : "forward-10"
                }
                size={35}
                color="#fff"
              />
              <Text style={styles.seekPopupText}>{seekPopup.text}</Text>
            </View>
          </View>
        )}

        {/* 🎬 MAIN OVERLAY (pointerEvents Box-none is critical) */}
        {!isLocked && (
          <Animated.View
            style={[
              styles.controlsOverlay,
              status.didJustFinish && styles.endScreenOverlay,
              { opacity: fadeAnim },
            ]}
            pointerEvents={isUIActiveRef.current ? "box-none" : "none"}
          >
            <BlurView intensity={40} tint="dark" style={styles.topControls}>
              <View style={styles.topLeft}>
                <TouchableOpacity
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  onPress={() => router.back()}
                  style={styles.iconBtn}
                >
                  <MaterialIcons name="arrow-back-ios" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.videoTitle} numberOfLines={1}>
                  {videoTitle}
                </Text>
              </View>

              <View style={styles.topRightControls}>
                <TouchableOpacity
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  onPress={() => {
                    setIsMuted(!isMuted);
                    resetControlsTimeout();
                  }}
                  style={styles.iconBtn}
                >
                  <MaterialIcons
                    name={isMuted ? "volume-off" : "volume-up"}
                    size={26}
                    color="#fff"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  onPress={toggleResizeMode}
                  style={styles.iconBtn}
                >
                  <MaterialIcons
                    name={getResizeIcon()}
                    size={24}
                    color="#fff"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  onPress={() => {
                    setShowSettings(!showSettings);
                    resetControlsTimeout();
                  }}
                  style={styles.iconBtn}
                >
                  <MaterialIcons name="speed" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  onPress={lockScreen}
                  style={styles.iconBtn}
                >
                  <MaterialIcons name="lock-outline" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </BlurView>

            {showSettings && (
              <BlurView intensity={50} tint="dark" style={styles.settingsMenu}>
                <Text style={styles.menuTitle}>Speed</Text>
                {[0.5, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                  <TouchableOpacity
                    key={speed}
                    style={styles.speedOption}
                    onPress={() => changeSpeed(speed)}
                  >
                    <Text
                      style={[
                        styles.speedText,
                        playbackSpeed === speed && styles.activeSpeed,
                      ]}
                    >
                      {speed}x {speed === 1.0 && "(Normal)"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </BlurView>
            )}

            <View style={styles.centerControls} pointerEvents="box-none">
              {status.didJustFinish ? (
                <View style={styles.endScreenContainer}>
                  <TouchableOpacity
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    onPress={playPrev}
                    disabled={!prevVideo}
                    style={[styles.endBtn, { opacity: prevVideo ? 1 : 0.3 }]}
                  >
                    <MaterialIcons
                      name="skip-previous"
                      size={50}
                      color="#fff"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    onPress={replayVideo}
                    style={styles.replayBtn}
                  >
                    <MaterialIcons name="replay" size={60} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    onPress={playNext}
                    disabled={!nextVideo}
                    style={[styles.endBtn, { opacity: nextVideo ? 1 : 0.3 }]}
                  >
                    <MaterialIcons name="skip-next" size={50} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.centerNav} pointerEvents="box-none">
                  <TouchableOpacity
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    onPress={playPrev}
                    disabled={!prevVideo}
                    style={[
                      styles.mainNavBtn,
                      { opacity: prevVideo ? 1 : 0.4 },
                    ]}
                  >
                    <MaterialIcons
                      name="skip-previous"
                      size={36}
                      color="#fff"
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    onPress={() => executeSkip("left")}
                    style={styles.mainNavBtn}
                  >
                    <MaterialIcons name="replay-10" size={40} color="#fff" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
                    onPress={handlePlayPause}
                    style={styles.playPauseBtn}
                  >
                    <BlurView
                      intensity={30}
                      tint="dark"
                      style={styles.playPauseGlass}
                    >
                      <MaterialIcons
                        name={isPlayingRef.current ? "pause" : "play-arrow"}
                        size={55}
                        color="#fff"
                      />
                    </BlurView>
                  </TouchableOpacity>

                  <TouchableOpacity
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    onPress={() => executeSkip("right")}
                    style={styles.mainNavBtn}
                  >
                    <MaterialIcons name="forward-10" size={40} color="#fff" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    onPress={playNext}
                    disabled={!nextVideo}
                    style={[
                      styles.mainNavBtn,
                      { opacity: nextVideo ? 1 : 0.4 },
                    ]}
                  >
                    <MaterialIcons name="skip-next" size={36} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <BlurView intensity={40} tint="dark" style={styles.bottomControls}>
              <Text style={styles.timeText}>
                {formatTime((status.positionMillis || 0) / 1000)}
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={status.durationMillis || 1}
                value={status.positionMillis || 0}
                minimumTrackTintColor={Colors.primary}
                maximumTrackTintColor="rgba(255,255,255,0.4)"
                thumbTintColor={Colors.primary}
                onSlidingComplete={async (value) => {
                  if (videoRef.current) {
                    await videoRef.current.setPositionAsync(value);
                    if (status.didJustFinish) await safePlay();
                  }
                  resetControlsTimeout();
                }}
              />
              <Text style={styles.timeText}>
                {formatTime((status.durationMillis || 0) / 1000)}
              </Text>
              <TouchableOpacity
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                onPress={toggleFullscreen}
                style={styles.fullscreenBtn}
              >
                <MaterialIcons
                  name={isFullscreen ? "fullscreen-exit" : "fullscreen"}
                  size={26}
                  color="#fff"
                />
              </TouchableOpacity>
            </BlurView>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centerContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  videoWrapper: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#000",
    position: "relative",
  },

  unlockContainer: { position: "absolute", top: 50, left: 20, zIndex: 10 },
  unlockBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  unlockText: { color: "#fff", fontWeight: "600", marginLeft: 8, fontSize: 15 },

  centerHUD: {
    position: "absolute",
    top: "20%",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 30,
    alignItems: "center",
    zIndex: 5,
    flexDirection: "row",
    gap: 10,
  },
  hudTime: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  hudSub: { color: Colors.primary, fontSize: 16, fontWeight: "bold" },

  sideHUD: {
    position: "absolute",
    top: "30%",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 20,
    paddingHorizontal: 10,
    borderRadius: 25,
    alignItems: "center",
    zIndex: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  hudBarBg: {
    width: 4,
    height: 100,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    marginVertical: 15,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  hudBarFill: {
    width: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  hudText: { color: "#fff", fontSize: 12, fontWeight: "bold" },

  seekPopupOverlay: { position: "absolute", top: "40%", zIndex: 10 },
  seekPopupBox: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 15,
    borderRadius: 30,
  },
  seekPopupText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 5,
  },

  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    zIndex: 2,
  },
  endScreenOverlay: { backgroundColor: "rgba(0,0,0,0.8)" },

  topControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: 50,
    paddingBottom: 15,
  },
  topLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },
  videoTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 5,
    flex: 1,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  topRightControls: { flexDirection: "row", alignItems: "center", gap: 5 },
  iconBtn: { padding: 8, alignItems: "center" },

  settingsMenu: {
    position: "absolute",
    top: 100,
    right: 20,
    borderRadius: 15,
    overflow: "hidden",
    padding: 15,
    zIndex: 20,
    width: 180,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  menuTitle: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.2)",
  },
  speedOption: { paddingVertical: 10 },
  speedText: { color: "#ccc", fontSize: 15, fontWeight: "500" },
  activeSpeed: { color: "#fff", fontWeight: "bold" },

  centerControls: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    zIndex: 3,
  },
  centerNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
  },
  mainNavBtn: { padding: 10 },
  playPauseBtn: { borderRadius: 50, overflow: "hidden", marginHorizontal: 10 },
  playPauseGlass: {
    padding: 15,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },

  endScreenContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 30,
  },
  endBtn: { padding: 15 },
  replayBtn: {
    padding: 15,
    backgroundColor: Colors.primary,
    borderRadius: 50,
    elevation: 10,
  },

  bottomControls: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 35,
  },
  timeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    width: 45,
    textAlign: "center",
  },
  slider: { flex: 1, height: 40, marginHorizontal: 10 },
  fullscreenBtn: { marginLeft: 5, padding: 5 },
});

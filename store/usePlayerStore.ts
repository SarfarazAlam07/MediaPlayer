import { create } from 'zustand';
import { Audio } from 'expo-av';

interface PlayerState {
  currentTrack: any | null;
  isPlaying: boolean;
  sound: Audio.Sound | null;
  setCurrentTrack: (track: any) => void;
  togglePlayback: () => Promise<void>;
  playTrack: (uri: string, track: any) => Promise<void>;
  pauseTrack: () => Promise<void>;
  stopTrack: () => Promise<void>;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  sound: null,

  playTrack: async (uri, track) => {
    const { sound: oldSound } = get();
    if (oldSound) {
      await oldSound.unloadAsync();
    }
    
    // Configure audio mode for background playback
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true }
    );
    
    set({ sound, currentTrack: track, isPlaying: true });

    sound.setOnPlaybackStatusUpdate((status: any) => {
      if (status.didJustFinish) {
        set({ isPlaying: false });
      }
    });
  },

  togglePlayback: async () => {
    const { sound, isPlaying } = get();
    if (!sound) return;
    
    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
    set({ isPlaying: !isPlaying });
  },
  
  pauseTrack: async () => {
    const { sound, isPlaying } = get();
    if (sound && isPlaying) {
      await sound.pauseAsync();
      set({ isPlaying: false });
    }
  },
  
  stopTrack: async () => {
    const { sound } = get();
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      set({ sound: null, currentTrack: null, isPlaying: false });
    }
  },

  setCurrentTrack: (track) => set({ currentTrack: track }),
}));
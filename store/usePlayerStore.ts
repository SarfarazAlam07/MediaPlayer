import { create } from 'zustand';
import { Audio } from 'expo-av';

interface PlayerState {
  currentTrack: any | null;
  isPlaying: boolean;
  sound: Audio.Sound | null;
  setCurrentTrack: (track: any) => void;
  togglePlayback: () => Promise<void>;
  playTrack: (uri: string, track: any) => Promise<void>;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  sound: null,

  playTrack: async (uri, track) => {
    const { sound: oldSound } = get();
    if (oldSound) await oldSound.unloadAsync();

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true }
    );
    
    set({ sound, currentTrack: track, isPlaying: true });

    sound.setOnPlaybackStatusUpdate((status: any) => {
      if (status.didJustFinish) set({ isPlaying: false });
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

  setCurrentTrack: (track) => set({ currentTrack: track }),
}));
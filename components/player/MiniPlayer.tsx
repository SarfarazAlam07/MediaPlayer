import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// 🔥 Use the '@' alias for clean, bulletproof imports!
import { usePlayerStore } from '@/store/usePlayerStore'; 
import { Colors } from '@/constants/Colors';

export default function MiniPlayer() {
  const { currentTrack, isPlaying, togglePlayback } = usePlayerStore();

  // Agar koi gaana nahi chal raha, toh player chup rahega (hide)
  if (!currentTrack) return null;

  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <MaterialIcons name="library-music" size={28} color={Colors.text} />
      </View>
      
      <View style={styles.infoBox}>
        <Text style={styles.title} numberOfLines={1}>{currentTrack.filename}</Text>
        <Text style={styles.subtitle}>Playing from Library</Text>
      </View>

      <TouchableOpacity onPress={() => togglePlayback()} style={styles.playBtn}>
        <MaterialIcons name={isPlaying ? "pause" : "play-arrow"} size={32} color={Colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 65, 
    left: 10,
    right: 10,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 15,
    elevation: 10, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  iconBox: {
    width: 45,
    height: 45,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBox: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: 'bold',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  playBtn: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 30,
  }
});
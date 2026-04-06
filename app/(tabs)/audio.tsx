import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useMediaScanner } from '../../hooks/useMediaScanner';
import { usePlayerStore } from '../../store/usePlayerStore';
import { formatTime } from '../../utils/timeFormat';

export default function AudioScreen() {
  const { allAudio, loading } = useMediaScanner();
  const { playTrack, currentTrack, isPlaying } = usePlayerStore();

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Music Library</Text>
      </View>

      <FlatList
        data={allAudio}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.trackCard, currentTrack?.id === item.id && styles.activeTrack]}
            onPress={() => playTrack(item.uri, item)}
          >
            <View style={styles.musicIcon}>
              <MaterialIcons 
                name={currentTrack?.id === item.id && isPlaying ? "pause-circle-filled" : "play-circle-filled"} 
                size={40} 
                color={currentTrack?.id === item.id ? Colors.primary : Colors.textMuted} 
              />
            </View>
            <View style={styles.trackInfo}>
              <Text style={styles.trackTitle} numberOfLines={1}>{item.filename}</Text>
              <Text style={styles.trackSub}>{formatTime(item.duration)} • Audio File</Text>
            </View>
            <TouchableOpacity>
              <MaterialIcons name="more-vert" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      {/* 🎵 Small Floating Player (Only visible when track is playing) */}
      {currentTrack && (
        <View style={styles.miniPlayer}>
          <Text style={styles.miniTitle} numberOfLines={1}>Playing: {currentTrack.filename}</Text>
          <TouchableOpacity onPress={() => usePlayerStore.getState().togglePlayback()}>
            <MaterialIcons name={isPlaying ? "pause" : "play-arrow"} size={32} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { padding: 25, paddingTop: 60, backgroundColor: Colors.surface },
  headerTitle: { color: Colors.text, fontSize: 24, fontWeight: 'bold' },
  trackCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  activeTrack: { backgroundColor: '#1a1a1a' },
  musicIcon: { width: 50, height: 50, justifyContent: 'center' },
  trackInfo: { flex: 1, marginLeft: 10 },
  trackTitle: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  trackSub: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  miniPlayer: { position: 'absolute', bottom: 10, left: 10, right: 10, backgroundColor: Colors.primary, borderRadius: 15, flexDirection: 'row', alignItems: 'center', padding: 15, elevation: 10 },
  miniTitle: { flex: 1, color: '#fff', fontWeight: 'bold', fontSize: 14 }
});
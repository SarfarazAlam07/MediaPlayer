import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors } from "../../constants/Colors";
import { useMediaStore } from "../../store/useMediaStore";
import { formatDate, formatSize, formatTime } from "../../utils/timeFormat";

interface VideoCardProps {
  id: string;
  title: string;
  duration: number;
  resolution: string;
  size?: number;
  date?: number;
  uri: string;
  onPress: () => void;
  onLongPress: () => void;
  selectionMode: boolean;
  isSelected: boolean;
}

const VideoCard = ({
  id, title, duration, resolution, size, date, uri, onPress, onLongPress, selectionMode, isSelected,
}: VideoCardProps) => {
  
  // 🔥 FIX: Strict Selector. Ab ye card sirf tabhi re-render hoga jab ISKA specific like status change ho.
  const liked = useMediaStore((state) => state.favorites.includes(id));
  const addFavorite = useMediaStore((state) => state.addFavorite);
  const removeFavorite = useMediaStore((state) => state.removeFavorite);

  const toggleFavorite = () => {
    if (liked) removeFavorite(id);
    else addFavorite(id);
  };

  return (
    <TouchableOpacity style={[styles.cardContainer, isSelected && styles.selectedCard]} onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.thumbnail}>
        <Image source={uri} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={300} />
        <View style={styles.thumbnailOverlay}>
          {selectionMode && isSelected ? (
            <MaterialIcons name="check-circle" size={40} color={Colors.primary} />
          ) : (
            <MaterialIcons name="play-circle-outline" size={28} color="rgba(255,255,255,0.7)" />
          )}
        </View>
        <View style={styles.durationBadge}><Text style={styles.durationText}>{formatTime(duration)}</Text></View>
      </View>

      <View style={styles.detailsContainer}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <View style={styles.metadataRow}>
          <Text style={styles.tagText}>{resolution} • </Text>
          <Text style={styles.tagText}>{formatSize(size || 0)}</Text>
        </View>
        <Text style={styles.dateText}>{formatDate(date || 0)}</Text>
      </View>

      {selectionMode ? (
        <View style={styles.optionsBtn}>
          <MaterialIcons name={isSelected ? "check-circle" : "radio-button-unchecked"} size={26} color={isSelected ? Colors.primary : Colors.textMuted} />
        </View>
      ) : (
        <TouchableOpacity onPress={toggleFavorite} style={styles.optionsBtn}>
          <MaterialIcons name={liked ? "favorite" : "favorite-border"} size={26} color={liked ? Colors.primary : Colors.textMuted} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

// 🔥 FIX: Memoizing the component so it never re-renders unless props change!
export default memo(VideoCard);

const styles = StyleSheet.create({
  cardContainer: { flexDirection: "row", backgroundColor: Colors.surface, borderRadius: 12, marginBottom: 12, padding: 8, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  selectedCard: { borderColor: Colors.primary, backgroundColor: "rgba(229, 9, 20, 0.1)" },
  thumbnail: { width: 120, height: 75, backgroundColor: "#111", borderRadius: 8, position: "relative", overflow: "hidden" },
  thumbnailOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", alignItems: "center" },
  durationBadge: { position: "absolute", bottom: 6, right: 6, backgroundColor: "rgba(0,0,0,0.8)", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  durationText: { color: Colors.text, fontSize: 10, fontWeight: "bold" },
  detailsContainer: { flex: 1, marginLeft: 12, justifyContent: "center" },
  title: { color: Colors.text, fontSize: 15, fontWeight: "600", marginBottom: 6, lineHeight: 20 },
  metadataRow: { flexDirection: "row", alignItems: "center" },
  tagText: { color: Colors.textMuted, fontSize: 12, fontWeight: "500" },
  dateText: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  optionsBtn: { padding: 10, justifyContent: "center", alignItems: "center" },
});
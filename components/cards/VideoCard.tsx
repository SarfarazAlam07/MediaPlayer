import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors } from "../../constants/Colors";
import { formatTime } from "../../utils/timeFormat";
import { formatSize, formatDate } from '../../utils/timeFormat';
// Is card ko kya-kya data chahiye (TypeScript definition)
interface VideoCardProps {
  title: string;
  duration: number;
  resolution: string;
  size?: string;
  onPress: () => void;
}

export default function VideoCard({
  title,
  duration,
  resolution,
  size,
  date,
  onPress,
}: any) {
  return (
    <TouchableOpacity style={styles.cardContainer} onPress={onPress}>
      <View style={styles.thumbnail}>
        <MaterialIcons
          name="play-circle-fill"
          size={35}
          color={Colors.primary}
        />
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatTime(duration)}</Text>
        </View>
      </View>

      <View style={styles.detailsContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.metadataRow}>
          <Text style={styles.tagText}>{resolution} • </Text>
          <Text style={styles.tagText}>{formatSize(size)}</Text>
        </View>
        <Text style={styles.dateText}>{formatDate(date)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    padding: 8,
    alignItems: "center",
    // Slight border for depth
    borderWidth: 1,
    borderColor: Colors.border,
  },
  thumbnail: {
    width: 110,
    height: 70,
    backgroundColor: "#202020", // Darker than surface
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  durationBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: Colors.text,
    fontSize: 10,
    fontWeight: "bold",
  },
  detailsContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 6,
    lineHeight: 20,
  },
  metadataRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tag: {
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "500",
  },
  mutedText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  optionsBtn: {
    padding: 10,
  },
});

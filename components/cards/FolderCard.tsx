import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

const FolderCard = ({ name, count, onPress }: any) => {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.iconWrapper}>
        <MaterialIcons name="folder-special" size={32} color={Colors.primary} />
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.subText}>Local Folder</Text>
      </View>
      <View style={styles.rightSection}>
        <Text style={styles.countText}>{count} Videos</Text>
        <MaterialIcons name="chevron-right" size={24} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
};

export default memo(FolderCard);

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 12, marginHorizontal: 15, marginBottom: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  iconWrapper: { backgroundColor: 'rgba(229, 9, 20, 0.1)', padding: 10, borderRadius: 12 },
  info: { flex: 1, marginLeft: 15 },
  name: { color: Colors.text, fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  subText: { color: Colors.textMuted, fontSize: 12 },
  rightSection: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  countText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' }
});
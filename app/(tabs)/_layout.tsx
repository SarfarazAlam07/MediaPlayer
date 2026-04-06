import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors'; // 🔥 Hamari premium theme

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary, // Premium Red active color
        tabBarInactiveTintColor: Colors.textMuted, // Grey inactive color
        tabBarStyle: {
          backgroundColor: Colors.surface, // Dark bottom bar
          borderTopColor: Colors.border,
          height: 60,
          paddingBottom: 10,
          paddingTop: 5,
        },
        headerShown: false, // 🔴 Upar wala default header hata diya, humne apna banaya hai
      }}>
      
      {/* 🎬 First Tab: Videos (Index) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Videos',
          tabBarIcon: ({ color }) => <MaterialIcons name="folder-special" size={28} color={color} />,
        }}
      />
      
      {/* 🎵 Second Tab: Music (Audio) */}
      <Tabs.Screen
        name="audio"
        options={{
          title: 'Music',
          tabBarIcon: ({ color }) => <MaterialIcons name="library-music" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
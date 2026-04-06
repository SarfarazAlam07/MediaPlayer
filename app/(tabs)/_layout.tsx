import React from 'react';
import { View } from 'react-native'; // 🔥 View import karna zaroori hai
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import MiniPlayer from '@/components/player/MiniPlayer'; // 🔥 Tumhara correct path

export default function TabLayout() {
  return (
    // 🔥 Poore layout ko ek View mein wrap kiya taaki sab ek container mein rahe
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.primary, 
          tabBarInactiveTintColor: Colors.textMuted, 
          tabBarStyle: {
            backgroundColor: Colors.surface, 
            borderTopColor: Colors.border,
            height: 60,
            paddingBottom: 10,
            paddingTop: 5,
            position: 'absolute', // 🔥 Bottom bar ko absolute kiya taaki player overlap na kare
            bottom: 0,
            left: 0,
            right: 0,
            elevation: 0,
          },
          headerShown: false, 
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

      {/* 🔥 MiniPlayer yahan aayega, Tabs ke theek upar float karega */}
      <MiniPlayer />
    </View>
  );
}
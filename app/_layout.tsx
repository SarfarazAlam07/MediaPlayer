import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Colors } from '../constants/Colors'; // Hamari premium theme

export default function RootLayout() {
  return (
    <>
      {/* 🌙 Poori app mein upar network/battery ka color white rahega */}
      <StatusBar style="light" backgroundColor={Colors.background} />
      
      {/* 🛣️ App ka main navigation (Nakshe ki root) */}
      <Stack 
        screenOptions={{ 
          headerShown: false, // Default ugly headers band
          contentStyle: { backgroundColor: Colors.background } // Background hamesha dark
        }}
      >
        {/* Pehla padaw: Hamare Tabs (Home aur Music) */}
        <Stack.Screen name="(tabs)" />
        
        {/* Doosra padaw: Hamara Fullscreen Player */}
        <Stack.Screen 
          name="player/[id]" 
          options={{ 
            presentation: 'fullScreenModal', // Player ekdum smooth popup ki tarah khulega
            animation: 'slide_from_bottom' 
          }} 
        />
      </Stack>
    </>
  );
}
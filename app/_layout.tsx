import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Colors } from '../constants/Colors';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.background} />
      
      <Stack 
        screenOptions={{ 
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background }
        }}
      >
        <Stack.Screen name="(tabs)" />
        
        <Stack.Screen 
          name="player/[id]" 
          options={{ 
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom' 
          }} 
        />
        
        {/* 🔥 NEW: FFMPEG Fix Screen */}
        <Stack.Screen 
          name="player/fix/[id]" 
          options={{ 
            presentation: 'modal',
            animation: 'slide_from_bottom',
            headerShown: false
          }} 
        />
      </Stack>
    </>
  );
}
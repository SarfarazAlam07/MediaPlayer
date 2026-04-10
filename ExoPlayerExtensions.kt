package com.sarfarazalam.hybridplayer

import com.google.android.exoplayer2.ExoPlayer
import com.google.android.exoplayer2.DefaultRenderersFactory
import com.google.android.exoplayer2.audio.AudioCapabilities
import com.google.android.exoplayer2.ext.ffmpeg.FfmpegAudioRenderer
import com.google.android.exoplayer2.ext.opus.OpusAudioRenderer
import com.google.android.exoplayer2.ext.vp9.Vp9Decoder
import com.google.android.exoplayer2.ext.vp9.Vp9Library
import com.google.android.exoplayer2.video.VideoDecoderEventListener

object ExoPlayerExtensions {
    fun enableAC3Support() {
        // Force enable AC3/EAC3 support
        try {
            Class.forName("com.google.android.exoplayer2.ext.ffmpeg.FfmpegAudioRenderer")
        } catch (e: Exception) {
            // FFMPEG extension not available
        }
    }
}
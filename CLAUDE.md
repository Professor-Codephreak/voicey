# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Development
npm run dev              # Start Vite dev server (port 3000)
npm run audio-server     # Start Node.js audio conversion server (port 3001)
npm run dev:all          # Start both servers concurrently

# Production
npm run build            # TypeScript compilation + Vite build
npm run preview          # Preview production build (port 4173)
```

The audio conversion server (`audio-server.js`) requires FFmpeg and provides format conversion endpoints at `http://localhost:3001`.

## Architecture Overview

Ataraxia Audiobook Studio is a React 18 / TypeScript web application for creating AI-powered audiobooks with background audio mixing.

### Core Data Flow

1. **Text-to-Speech Generation**: User text → `audioGenerationService.ts` → provider-specific service (Gemini/ElevenLabs/OpenAI/Together/Mistral/LocalLLM) → `AudioBuffer`
2. **Background Audio Mixing**: If enabled, `backgroundAudioService.ts` processes clips (extract, fade, repeat/crossfade) and mixes with narration
3. **Caching**: Generated audio is cached in-memory (`audioCacheRef`) keyed by `${chapterIndex}-${engine}-${voiceId}`
4. **Persistence**: `storageService.ts` manages IndexedDB with three stores: `backgroundAudio`, `chapterMetadata`, `cachedAudio`

### Key Services (`services/`)

- **audioGenerationService.ts**: Central TTS orchestrator - routes to provider services based on `VoiceEngine` type, handles background audio mixing
- **backgroundAudioService.ts**: Audio buffer manipulation (clip extraction, fades, repeat/crossfade, waveform generation)
- **storageService.ts**: IndexedDB wrapper singleton for persistent storage
- **eventService.ts**: Simple pub/sub for decoupled component communication (e.g., `chapter:select`, `player:play_pause`)

### State Management

The app uses React local state with refs for audio timing. Key state in `App.tsx`:
- `audioCacheRef`: Map<string, AudioBuffer> for in-memory audio cache
- `audioContextRef`, `sourceNodeRef`, `filterNodeRef`: Web Audio API graph nodes
- Voice settings persisted to localStorage with constants like `VOICE_ENGINE_STORAGE`

### Audio Pipeline (Web Audio API)

```
BufferSource → BiquadFilter → AnalyserNode → AudioContext.destination
```

Filter settings (`FilterSettings` type) allow real-time audio manipulation.

### Component Responsibilities

- **ChapterList.tsx**: Sidebar with chapter navigation, settings access, voice configuration
- **BackgroundAudioModal.tsx**: Background audio library management, upload, recording integration
- **BackgroundAudioRecorder.tsx**: Microphone recording with waveform visualization
- **SettingsModal.tsx**: API keys, playback settings, spectrogram/oscilloscope themes
- **AudioPlayer.tsx**: Playback controls, progress display

### Type Definitions (`types.ts`)

Core types: `Chapter`, `Book`, `SpectrogramSettings`, `FilterSettings`, `OscilloscopeTheme`

Provider-specific types are defined in their service files (e.g., `VoiceEngine`, `BackgroundAudioClip`, `BackgroundAudioSettings`).

## Environment Variables

Create `.env.local` with API keys:
```
GEMINI_API_KEY=...
ELEVENLABS_API_KEY=...
OPENAI_API_KEY=...
TOGETHER_API_KEY=...
MISTRAL_API_KEY=...
```

Keys are also stored in localStorage for runtime access.

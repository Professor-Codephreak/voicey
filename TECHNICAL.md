# Technical Documentation

## Architecture Overview

Ataraxia Audiobook is a React-based web application built with Vite, featuring AI-powered text-to-speech generation and advanced audio mixing capabilities.

### Tech Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5.x
- **Styling**: Tailwind CSS 3.x
- **Audio Processing**: Web Audio API
- **Storage**: IndexedDB via custom storage service
- **AI Integration**:
  - Google Gemini API
  - ElevenLabs API
  - OpenAI API
  - Together AI
  - Mistral AI
  - Local LLM support

### Project Structure

```
ataraxia-forging/
├── components/          # React components
│   ├── BackgroundAudioModal.tsx    # Background audio management
│   ├── BackgroundAudioRecorder.tsx # Microphone recording
│   ├── ChapterList.tsx             # Chapter navigation
│   ├── DataManagementModal.tsx     # Import/Export data
│   ├── SettingsModal.tsx           # App settings
│   ├── ShareModal.tsx              # Sharing functionality
│   ├── WaveformViewer.tsx          # Audio waveform visualization
│   └── icons/                      # SVG icon components
├── services/            # Business logic and APIs
│   ├── audioConversionService.ts   # Node.js server communication
│   ├── backgroundAudioService.ts   # Background audio mixing
│   ├── storageService.ts           # IndexedDB operations
│   └── voiceService.ts             # TTS provider integrations
├── hooks/               # Custom React hooks
├── utils/               # Utility functions
│   └── audio.ts                    # Audio encoding utilities
├── constants/           # App constants
├── public/              # Static assets
├── audio-server.js      # Node.js conversion server
└── App.tsx             # Main application component
```

## Core Features

### 1. Multi-Provider Text-to-Speech

**Supported Providers:**
- **Google Gemini** - Primary TTS with multiple voice options
- **ElevenLabs** - High-quality voice cloning and synthesis
- **OpenAI** - TTS-1 and TTS-1-HD models
- **Together AI** - Open-source model support
- **Mistral AI** - Alternative TTS provider
- **Local LLM** - Self-hosted TTS solutions

**Implementation**: `services/voiceService.ts`

Each provider implements a common interface:
```typescript
interface VoiceProvider {
  generateSpeech(text: string, voice: string): Promise<ArrayBuffer>
  getAvailableVoices(): Promise<string[]>
}
```

### 2. Background Audio Mixing

**Features:**
- Real-time audio mixing using Web Audio API
- Crossfade transitions between clips
- Volume normalization
- Loop and repeat modes
- Trim and clip selection

**Architecture:**
- `backgroundAudioService.ts` - Core mixing logic
- `BackgroundAudioModal.tsx` - UI controls
- `WaveformViewer.tsx` - Visual editing

**Audio Pipeline:**
1. Load audio file → AudioBuffer
2. Apply clip boundaries (start/end time)
3. Mix with narration using GainNode
4. Apply crossfade using exponential ramps
5. Output to destination

### 3. IndexedDB Storage System

**Storage Schema:**

```typescript
// Object Stores
- chapters: {
    id: string,
    text: string,
    audioData: ArrayBuffer,
    timestamp: number,
    metadata: ChapterMetadata
  }

- backgroundAudio: {
    id: string,
    name: string,
    data: ArrayBuffer,
    duration: number,
    settings: BackgroundAudioSettings
  }

- appState: {
    key: string,
    value: any
  }
```

**Implementation**: `services/storageService.ts`

**Features:**
- Automatic quota management
- Dynamic storage estimation
- Batch operations
- Error recovery
- Migration support

### 4. Audio Conversion Server

**Technology**: Node.js + Express + FFmpeg

**Endpoints:**

```
GET  /health              - Server health check
POST /convert             - Convert audio format
POST /info                - Get audio file metadata
GET  /download/:filename  - Download converted file
```

**Supported Formats:**
- WAV (PCM 16-bit, 44.1kHz)
- OGG (Vorbis codec, 192kbps)
- MP3 (LAME encoder, 192kbps)

**File Flow:**
1. Client uploads audio via FormData
2. Server stores in temp-uploads/
3. FFmpeg processes conversion
4. Output saved to converted-audio/
5. Optional: Copy to user-specified directory
6. Client downloads or receives file path

### 5. Microphone Recording

**Implementation**: `BackgroundAudioRecorder.tsx`

**Features:**
- Real-time waveform visualization
- Level meter with peak detection
- Configurable max duration
- Automatic IndexedDB storage
- Audio format: WAV (Web Audio API)

**Recording Pipeline:**
```
navigator.mediaDevices.getUserMedia()
  → MediaRecorder
  → Audio chunks
  → Blob concatenation
  → AudioContext.decodeAudioData()
  → IndexedDB storage
```

## State Management

### Global State
- Chapter data (audio buffers, text, metadata)
- Current playback position
- Background audio settings
- Voice provider settings
- UI preferences

### Local Component State
- Modal visibility
- Loading states
- Error messages
- Form inputs
- Audio playback controls

### Persistence
All critical state is persisted to IndexedDB:
- Chapter audio and text
- Background audio library
- User settings and preferences
- Workspace configurations

## Audio Processing Details

### Web Audio API Graph

```
Source Nodes (multiple):
  ├─ Chapter Audio (BufferSource)
  └─ Background Audio (BufferSource)
     │
     ↓
Gain Nodes:
  ├─ Narration Gain (volume control)
  └─ Background Gain (volume control)
     │
     ↓
Mixer Node (createChannelMerger)
     │
     ↓
Destination (speakers/output)
```

### Crossfade Algorithm

```typescript
// Exponential crossfade for smooth transitions
backgroundGain.gain.setValueAtTime(0, startTime);
backgroundGain.gain.exponentialRampToValueAtTime(
  targetVolume,
  startTime + fadeDuration
);

// Reverse for fade out
backgroundGain.gain.exponentialRampToValueAtTime(
  0.01,
  endTime - fadeDuration
);
backgroundGain.gain.setValueAtTime(0, endTime);
```

### Waveform Generation

```typescript
// Downsample audio buffer for visualization
function generateWaveformData(buffer: AudioBuffer, samples: number): Float32Array {
  const blockSize = Math.floor(buffer.length / samples);
  const waveform = new Float32Array(samples);

  for (let i = 0; i < samples; i++) {
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(buffer.getChannelData(0)[i * blockSize + j]);
    }
    waveform[i] = sum / blockSize;
  }

  return waveform;
}
```

## API Integration

### Gemini API
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-*`
- Authentication: API key via query parameter
- Rate Limits: Varies by tier
- Audio Format: MP3 (base64 encoded)

### ElevenLabs API
- Endpoint: `https://api.elevenlabs.io/v1/text-to-speech`
- Authentication: Bearer token
- Rate Limits: Based on subscription
- Audio Format: MP3 with configurable quality

### OpenAI TTS
- Endpoint: `https://api.openai.com/v1/audio/speech`
- Models: tts-1, tts-1-hd
- Voices: alloy, echo, fable, onyx, nova, shimmer
- Audio Format: MP3, WAV, OPUS, AAC, FLAC

## Performance Optimizations

### Audio Loading
- Lazy loading of chapter audio
- Streaming decode for large files
- Buffer pooling to reduce GC pressure

### UI Rendering
- React.memo for expensive components
- Virtualized lists for large chapter counts
- Debounced waveform updates

### Storage
- Batch IndexedDB operations
- Compressed metadata storage
- Automatic cleanup of old data

### Network
- Request queuing for API calls
- Retry logic with exponential backoff
- Concurrent request limiting

## Security Considerations

### API Keys
- Stored in localStorage (browser isolation)
- Never transmitted except to respective APIs
- Optional key validation before storage

### CORS
- Audio conversion server: localhost only
- Strict origin checking
- No public endpoints

### Content Security
- Sanitized user inputs
- No eval() or dangerous HTML injection
- Safe markdown rendering (if implemented)

## Browser Compatibility

**Minimum Requirements:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Required APIs:**
- Web Audio API
- IndexedDB
- MediaRecorder API (for recording)
- File System Access API (optional, for direct saves)

**Not Supported:**
- Internet Explorer
- Legacy browsers without ES6+ support

## Build and Deployment

### Development
```bash
npm run dev           # Start Vite dev server (port 3000)
npm run audio-server  # Start conversion server (port 3001)
npm run dev:all       # Start both servers concurrently
```

### Production Build
```bash
npm run build        # TypeScript compilation + Vite build
npm run preview      # Preview production build
```

### Build Output
```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js    # Main application bundle
│   ├── index-[hash].css   # Compiled Tailwind CSS
│   └── [other assets]
```

## Environment Variables

```bash
# Required
GEMINI_API_KEY=your_gemini_api_key

# Optional (provider-specific)
ELEVENLABS_API_KEY=your_elevenlabs_key
OPENAI_API_KEY=your_openai_key
TOGETHER_API_KEY=your_together_key
```

Stored in `.env.local` (not committed to git)

## Database Schema

### chapters Object Store
```typescript
{
  id: string,              // Unique chapter ID
  text: string,            // Chapter text content
  audioData: ArrayBuffer,  // Encoded audio (MP3/WAV)
  timestamp: number,       // Last modified timestamp
  metadata: {
    title?: string,
    duration: number,
    voice: string,
    provider: string,
    generatedAt: number,
    fileSize: number
  }
}
```

### backgroundAudio Object Store
```typescript
{
  id: string,              // Unique clip ID
  name: string,            // Display name
  data: ArrayBuffer,       // Raw audio data
  duration: number,        // Length in seconds
  settings: {
    enabled: boolean,
    clip: BackgroundAudioClip | null,
    repeat: boolean,
    matchLength: boolean,
    crossfade: boolean,
    crossfadeDuration: number
  }
}
```

## Future Enhancements

### Planned Features
- [ ] Batch chapter generation
- [ ] Advanced audio effects (EQ, compression)
- [ ] Export to audiobook formats (M4B, MP3 chapters)
- [ ] Cloud sync for chapters and settings
- [ ] Collaborative editing
- [ ] Voice cloning integration
- [ ] Real-time collaboration
- [ ] Mobile app (React Native)

### Technical Debt
- Migrate to Zustand or Redux for state management
- Add comprehensive unit tests
- Implement E2E testing with Playwright
- Add error boundary components
- Improve TypeScript strict mode compliance
- Add telemetry and analytics
- Implement proper logging system

## Troubleshooting

### Common Issues

**"Audio server offline"**
- Solution: Run `npm run audio-server` in separate terminal

**"Quota exceeded" errors**
- Solution: Clear old chapters via Data Management modal
- Check available storage with storage estimator

**"Failed to generate audio"**
- Check API key validity
- Verify network connectivity
- Check API rate limits
- Review browser console for errors

**Audio playback issues**
- Ensure browser supports Web Audio API
- Check audio permissions
- Verify audio files are not corrupted
- Try different voice provider

## Contributing

### Code Style
- TypeScript strict mode
- ESLint + Prettier
- Conventional commits
- Component-based architecture

### Testing
```bash
npm run test          # Run unit tests (when implemented)
npm run test:e2e      # Run E2E tests (when implemented)
```

### Pull Request Process
1. Fork repository
2. Create feature branch
3. Implement changes with tests
4. Update documentation
5. Submit PR with detailed description

## License

See LICENSE file for details.

## Support

For issues and questions:
- GitHub Issues: [Project Repository]
- Documentation: This file and README.md
- Community: [Discord/Forum link if available]

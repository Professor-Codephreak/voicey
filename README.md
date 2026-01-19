# Ataraxia Audiobook Studio

<div align="center">

**Professional AI-Powered Audiobook Creation and Mixing Platform**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.5.3-blue.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/react-18.3.1-61dafb.svg)](https://reactjs.org)

[Features](#features) • [Installation](#installation) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Contributing](#contributing)

</div>

---

## Overview

Ataraxia Audiobook Studio is a comprehensive web-based platform for creating professional audiobooks with AI-generated narration and advanced audio mixing capabilities. Built with React, TypeScript, and the Web Audio API, it provides a complete suite of tools for audiobook production, from text-to-speech generation to background audio mixing and export.

### Key Capabilities

- **Multi-Provider AI Narration**: Support for Google Gemini, ElevenLabs, OpenAI, Together AI, Mistral, and Local LLM
- **Professional Audio Mixing**: Real-time background audio overlay with crossfades, volume control, and trimming
- **Advanced Recording**: Built-in microphone recording with waveform visualization and level monitoring
- **Format Conversion**: Node.js/FFmpeg-powered conversion between WAV, OGG, and MP3 formats
- **Offline Storage**: IndexedDB-based local storage with quota management and import/export
- **Real-time Preview**: Instant playback with adjustable speed and streaming buffer control

---

## Features

### 🎙️ Voice Generation
- **Multiple AI Providers**: Choose from Gemini, ElevenLabs, OpenAI, Together AI, Mistral, or Local LLM
- **Voice Cloning**: Create custom voices with ElevenLabs integration
- **Voice Preview**: Test voices before generating full chapters
- **Batch Generation**: Generate multiple chapters with streaming buffer
- **Voice Consistency**: Maintain same voice across entire audiobook

### 🎵 Audio Mixing Workspace
- **Background Audio Library**: Build and manage a permanent collection of ambient sounds and music
- **Microphone Recording**: Record custom audio directly from your device
- **Waveform Editor**: Visual trimming and clip selection
- **Real-time Mixing**: Overlay background audio with narrator with live preview
- **Advanced Controls**: Volume, repeat, crossfade, and length matching
- **Format Support**: WAV, MP3, OGG, M4A, FLAC, WebM

### 🔊 Audio Processing
- **Web Audio API**: Professional-quality audio processing in-browser
- **FFmpeg Integration**: Server-side conversion for maximum compatibility
- **Crossfade Engine**: Smooth exponential fades for seamless transitions
- **Volume Normalization**: Automatic audio level balancing
- **Batch Export**: Download entire audiobook as single file or individual chapters

### 💾 Data Management
- **IndexedDB Storage**: Persistent local storage for chapters and audio
- **Import/Export**: Full backup and restore capabilities
- **Storage Quotas**: Dynamic quota estimation and management
- **Auto-cleanup**: Configurable retention and cleanup policies

### 📱 User Interface
- **Responsive Design**: Desktop and mobile-optimized layouts
- **Dark Theme**: Easy on the eyes for extended editing sessions
- **Keyboard Shortcuts**: Efficient navigation and control
- **Real-time Updates**: Hot module reload during development
- **Accessibility**: ARIA labels and keyboard navigation

---

## Installation

### Prerequisites

- **Node.js**: Version 18.0.0 or higher ([Download](https://nodejs.org))
- **npm**: Version 8.0.0 or higher (included with Node.js)
- **Modern Browser**: Chrome 90+, Firefox 88+, Safari 14+, or Edge 90+
- **FFmpeg** (Optional): For server-side audio conversion features

### System Requirements

**Minimum:**
- 4GB RAM
- 2GB free disk space
- Stable internet connection for AI providers

**Recommended:**
- 8GB RAM or more
- 10GB free disk space for audio storage
- SSD for optimal performance

### Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Professor-Codephreak/voicey.git
   cd voicey
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**

   Create a `.env.local` file in the project root:
   ```bash
   # Required - Google Gemini API Key
   GEMINI_API_KEY=your_gemini_api_key_here

   # Optional - Additional AI Providers
   ELEVENLABS_API_KEY=your_elevenlabs_key
   OPENAI_API_KEY=your_openai_key
   TOGETHER_API_KEY=your_together_key
   MISTRAL_API_KEY=your_mistral_key
   ```

   **Obtaining API Keys:**
   - **Gemini**: Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - **ElevenLabs**: Visit [ElevenLabs](https://elevenlabs.io) → Profile → API Keys
   - **OpenAI**: Visit [OpenAI Platform](https://platform.openai.com/api-keys)
   - **Together AI**: Visit [Together AI](https://together.ai) → Settings → API Keys
   - **Mistral**: Visit [Mistral AI](https://mistral.ai) → API Keys

4. **Verify Installation**
   ```bash
   npm run dev
   ```

   Open your browser to `http://localhost:3000`. You should see the Ataraxia interface.

---

## Quick Start

### Basic Workflow

1. **Configure Voice Settings**
   - Click **Settings** (gear icon) in the left sidebar
   - Select **Voice Studio** tab
   - Choose your preferred AI provider (Gemini or ElevenLabs)
   - Enter API key if not already configured
   - Select a voice and preview it

2. **Create Your First Chapter**
   - Enter or paste your text in the main editor
   - Click **Generate Audio** or press the play button
   - Wait for AI generation (5-30 seconds depending on length)
   - Audio plays automatically when ready

3. **Add Background Audio (Optional)**
   - Click **Mixing** button in the bottom control bar
   - Switch to **Library** or **Record** tab
   - Upload audio file or record from microphone
   - Adjust volume, enable crossfade, configure settings
   - Preview the mixed result

4. **Export Your Audiobook**
   - Click **Settings** → **Library & Downloads**
   - Choose **Combined OGG** or **Combined WAV** for full book
   - Or select **Batch OGG/WAV** for individual chapters
   - Wait for processing and download

### Advanced Features

#### Using the Audio Conversion Server

For professional-quality format conversion and direct filesystem access:

1. **Start the Conversion Server**
   ```bash
   # Option 1: Start both app and server together
   npm run dev:all

   # Option 2: Run in separate terminals
   npm run dev          # Terminal 1
   npm run audio-server # Terminal 2
   ```

2. **Configure Output Directory (Optional)**
   - Open **Mixing** modal
   - Look for "Output Directory" input
   - Enter path: `/home/username/Music/audiobooks`
   - Or leave empty for browser download

3. **Convert Audio Files**
   - In the Background Audio Library
   - Click export icon (↓) on any clip
   - Choose format: WAV, OGG, or MP3
   - File saves to specified directory or downloads

**Server Features:**
- Runs on: `http://localhost:3001`
- Supports: WAV (PCM 16-bit), OGG (Vorbis 192kbps), MP3 (LAME 192kbps)
- Auto-cleanup: Temporary files deleted after 1 hour
- Output location: `./converted-audio/` directory

---

## Documentation

### User Guides

Access comprehensive documentation directly within the app:

1. Click **Settings** (gear icon) in left sidebar
2. Select **Admin & Docs** from the dropdown
3. Choose from:
   - **README** - This file (Quick Start Guide)
   - **TECHNICAL** - Architecture, APIs, and implementation details
   - **ADMIN GUIDE** - Complete mixing and settings instructions

### External Resources

- **Technical Documentation**: See [TECHNICAL.md](TECHNICAL.md)
- **Admin Guide**: See [ADMIN.md](ADMIN.md)
- **API Reference**: See inline code documentation
- **Troubleshooting**: See [ADMIN.md - Troubleshooting](ADMIN.md#troubleshooting)

---

## Configuration

### Application Settings

All settings are accessible via the **Settings** modal:

#### Playback Settings
- **Playback Speed**: 0.5x to 2.0x (default: 1.0x)
- **Streaming Buffer**: 1-5 chapters (default: 2 chapters)

#### Voice Settings
- **Engine**: Gemini or ElevenLabs
- **Voice Selection**: Provider-specific voice library
- **API Keys**: Secure local storage only

#### Download Settings
- **Format**: WAV (uncompressed) or OGG (compressed)
- **Export Options**: Full book, batch chapters, or browser cache

### Storage Configuration

- **Location**: Browser IndexedDB (persistent)
- **Quota**: Managed automatically, request increase if needed
- **Backup**: Export data regularly via Data Management modal

### Advanced Configuration

Edit `vite.config.ts` for:
- Build optimization settings
- Development server configuration
- Plugin customization

Edit `audio-server.js` for:
- Conversion server port (default: 3001)
- FFmpeg encoding parameters
- Cleanup interval and retention

---

## Development

### Project Structure

```
ataraxia-forging/
├── components/          # React components
│   ├── BackgroundAudioModal.tsx
│   ├── BackgroundAudioRecorder.tsx
│   ├── ChapterList.tsx
│   ├── DataManagementModal.tsx
│   ├── DocumentationViewer.tsx
│   ├── SettingsModal.tsx
│   └── ...
├── services/            # Business logic and API integrations
│   ├── audioConversionService.ts
│   ├── backgroundAudioService.ts
│   ├── storageService.ts
│   ├── voiceService.ts
│   └── ...
├── utils/               # Utility functions
├── public/              # Static assets and documentation
├── audio-server.js      # Node.js conversion server
├── App.tsx             # Main application component
├── vite.config.ts      # Build configuration
└── package.json        # Dependencies and scripts
```

### Available Scripts

```bash
# Development
npm run dev              # Start Vite dev server (port 3000)
npm run audio-server     # Start conversion server (port 3001)
npm run dev:all          # Start both servers concurrently

# Production
npm run build            # Build for production
npm run preview          # Preview production build

# Maintenance
npm install              # Install dependencies
npm audit                # Check for vulnerabilities
npm audit fix            # Fix vulnerabilities
```

### Building for Production

1. **Build the Application**
   ```bash
   npm run build
   ```

   Output directory: `dist/`

2. **Preview Production Build**
   ```bash
   npm run preview
   ```

   Opens on `http://localhost:4173`

3. **Deploy**
   - Upload `dist/` contents to your web server
   - Configure server to serve `index.html` for all routes
   - Ensure HTTPS for MediaRecorder API support

---

## Troubleshooting

### Common Issues

#### "Failed to generate audio"

**Symptoms**: Error message when generating narration

**Solutions**:
1. Verify API key is correct in Settings → Voice Studio
2. Check internet connection
3. Verify API provider account has available credits/quota
4. Try different voice provider
5. Check browser console for detailed error messages

#### "Quota exceeded" errors

**Symptoms**: Cannot save new chapters or recordings

**Solutions**:
1. Open Data Management modal
2. View current storage usage
3. Export important projects first
4. Clear old chapters or unused background audio
5. Request quota increase in browser settings
6. Use OGG format (smaller file sizes)

#### "Audio server offline"

**Symptoms**: Red dot in conversion server status, cannot export

**Solutions**:
1. Open new terminal window
2. Navigate to project directory
3. Run: `npm run audio-server`
4. Verify green dot appears in app
5. Check `http://localhost:3001/health` in browser

#### Microphone not working

**Symptoms**: No prompt for microphone permission, recording fails

**Solutions**:
1. Check browser address bar for blocked microphone icon
2. Grant microphone permission in browser settings
3. Ensure microphone is connected and enabled
4. Try in different browser (Chrome recommended)
5. Use HTTPS or localhost (required for MediaRecorder API)
6. Close other applications using microphone

#### Choppy playback / buffering

**Symptoms**: Audio stutters or gaps between chapters

**Solutions**:
1. Increase streaming buffer: Settings → Playback → 3-5 chapters
2. Pre-cache full book: Settings → Downloads → Pre-Cache to Browser
3. Close unnecessary browser tabs
4. Disable browser extensions temporarily
5. Use wired internet connection
6. Clear browser cache and reload

### Getting Help

If issues persist:

1. **Check Console**: Open browser DevTools (F12) → Console tab
2. **Review Logs**: Copy error messages and stack traces
3. **Test in Incognito**: Rule out extension conflicts
4. **Try Different Browser**: Verify browser compatibility
5. **Report Issue**: Include browser version, OS, steps to reproduce

---

## Contributing

We welcome contributions from the community! Whether you're fixing bugs, improving documentation, or proposing new features, your help is appreciated.

### How to Contribute

1. **Fork the Repository**
   ```bash
   git clone https://github.com/Professor-Codephreak/voicey.git
   cd voicey
   git checkout -b feature/your-feature-name/
   ```

2. **Make Your Changes**
   - Follow existing code style and conventions
   - Add comments for complex logic
   - Update documentation as needed
   - Test thoroughly before submitting

3. **Submit a Pull Request**
   - Describe your changes clearly
   - Reference any related issues
   - Include screenshots for UI changes
   - Ensure all tests pass

### Development Guidelines

- **Code Style**: Follow TypeScript and React best practices
- **Commits**: Use conventional commit messages
- **Testing**: Add tests for new features (when test framework is added)
- **Documentation**: Update relevant docs for significant changes

### Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other contributors

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

### Technologies

- **React** - UI framework
- **TypeScript** - Type safety and developer experience
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling framework
- **Web Audio API** - Audio processing
- **IndexedDB** - Client-side storage
- **FFmpeg** - Audio conversion

### AI Providers

- **Google Gemini** - Text-to-speech generation
- **ElevenLabs** - Voice cloning and synthesis
- **OpenAI** - TTS models
- **Together AI** - Open-source model support
- **Mistral AI** - Alternative TTS provider

---

## Support

- **Documentation**: Built-in admin panel (Settings → Admin & Docs)
- **Technical Docs**: [TECHNICAL.md](TECHNICAL.md)
- **Admin Guide**: [ADMIN.md](ADMIN.md)
- **Issues**: [GitHub Issues](https://github.com/yourusername/ataraxia-forging/issues)

---

## Roadmap

### Planned Features

- [ ] Batch chapter generation
- [ ] Advanced audio effects (EQ, compression, reverb)
- [ ] Export to standard audiobook formats (M4B with chapters)
- [ ] Cloud sync for chapters and settings
- [ ] Collaborative editing
- [ ] Mobile applications (iOS/Android)
- [ ] Plugin system for extensions
- [ ] Automated testing suite

### Under Consideration

- Integration with audiobook platforms
- Voice training and fine-tuning
- Advanced text preprocessing
- Multi-language support
- Chapter markers and navigation
- Podcast-style export

---

<div align="center">

**Made with ❤️ for audiobook creators**

[⬆ Back to Top](#ataraxia-audiobook-studio)

</div>

# Admin Guide

Complete guide for managing and configuring the Ataraxia Audiobook application.

## Table of Contents

- [Audio Mixing Workspace](#audio-mixing-workspace)
- [Voice Settings & Configuration](#voice-settings--configuration)
- [Playback Settings](#playback-settings)
- [Download & Export Options](#download--export-options)
- [Data Management](#data-management)
- [Background Audio System](#background-audio-system)
- [Troubleshooting](#troubleshooting)

---

## Audio Mixing Workspace

The Background Audio Mixing system allows you to overlay ambient sounds, music, or environmental audio beneath your narration for a more immersive audiobook experience.

### Accessing the Mixer

1. Click the **Mixing** button in the bottom control bar
2. The Background Audio Modal will open with three tabs:
   - **Upload** - Use audio temporarily for this session
   - **Library** - Your permanent workspace of saved audio clips
   - **Record** - Record new audio from your microphone

### Tab 1: Upload (Temporary Use)

**Purpose**: Quickly test audio without saving to your library.

**Steps:**
1. Click "Upload Audio File"
2. Select an audio file (WAV, MP3, OGG, M4A, FLAC)
3. Audio loads and becomes available immediately
4. Adjust clip boundaries using the waveform viewer
5. Click "Add to Library" to save permanently

**Use Cases:**
- Testing different background music options
- Previewing audio before committing to library
- One-time use for a specific chapter

### Tab 2: Library (Workspace)

**Purpose**: Manage your permanent collection of background audio clips.

**Features:**

1. **View All Clips**
   - See all saved background audio
   - Display shows: name, duration, file size
   - Green "IN USE" badge on active clip

2. **Use a Clip**
   - Click the "Use" button on any clip
   - Clip becomes active for mixing
   - Waveform appears for editing

3. **Export/Convert Clips**
   - Click the download icon on any clip
   - Choose format: WAV, OGG, or MP3
   - Requires audio conversion server running
   - Option to save directly to filesystem

4. **Add New Clips**
   - Click "Add to Library"
   - Upload and ingest files permanently
   - Files stored in IndexedDB

5. **Delete Clips**
   - Click the trash icon
   - Confirm deletion
   - Permanently removes from library

### Tab 3: Record (Create New)

**Purpose**: Record custom audio directly from your microphone.

**Recording Steps:**

1. **Grant Microphone Permission**
   - Browser will request microphone access
   - Allow access to enable recording

2. **Start Recording**
   - Click the red "Start Recording" button
   - Waveform visualizer shows live audio levels
   - Peak meter displays current volume
   - Timer shows recording duration

3. **Monitor Levels**
   - Green: Good recording level
   - Yellow: Approaching peak
   - Red: Clipping (too loud)
   - Adjust microphone distance/volume

4. **Stop Recording**
   - Click "Stop Recording"
   - Audio automatically saves to library
   - Default name: "Recording YYYY-MM-DD HH:MM:SS"

5. **Automatic Storage**
   - Recordings save as WAV format
   - Stored permanently in library
   - Available immediately for mixing

**Recording Tips:**
- Max duration: 10 minutes (600 seconds)
- Use headphones to prevent feedback
- Record in a quiet environment
- Speak/play at consistent volume
- Stop and restart if you make a mistake

### Clip Editing & Trimming

**Waveform Viewer:**

When a clip is active, the waveform viewer appears at the bottom of the modal.

**Controls:**
- **Start Time Marker** (left): Drag to set clip start
- **End Time Marker** (right): Drag to set clip end
- **Waveform**: Visual representation of audio amplitude
- **Time Display**: Shows selected duration

**Editing Steps:**

1. **Load a Clip**
   - Select from library or upload
   - Waveform appears automatically

2. **Set Start Point**
   - Drag the left marker to desired start time
   - OR click on waveform to set position
   - Use to trim silence or intro

3. **Set End Point**
   - Drag the right marker to desired end time
   - OR click on waveform to set position
   - Use to trim outro or excess audio

4. **Preview**
   - Click the play button to hear trimmed clip
   - Verify start/end points are correct
   - Adjust markers as needed

**Use Cases:**
- Remove silence at beginning/end
- Loop a specific musical phrase
- Extract a portion of longer audio
- Match clip length to chapter duration

### Mixing Settings

Configure how background audio blends with narration.

**Background Volume:**
- Range: 0% to 100%
- Default: 20%
- Adjusts volume relative to narration
- Lower values = subtle ambiance
- Higher values = prominent background

**Repeat Mode:**
- **Off**: Play once then silence
- **On**: Loop continuously
- Useful for: ambient sounds, music beds
- Seamless loop with crossfade

**Match Chapter Length:**
- **Off**: Play clip at natural length
- **On**: Stretch/compress to match narration
- Uses time-stretching algorithm
- Maintains pitch

**Crossfade:**
- **Off**: Abrupt start/stop
- **On**: Smooth fade in/out
- Duration: Configurable (1-5 seconds)
- Creates professional transitions

**Crossfade Duration:**
- Range: 1 to 5 seconds
- Adjusts fade in/out time
- Longer = smoother, more gradual
- Shorter = quicker transition

### Audio Mixing Best Practices

**Volume Balance:**
- Start with 15-20% background volume
- Narration should always be dominant
- Test with different playback devices
- Adjust based on content type

**Choosing Background Audio:**
- **Ambient**: Nature sounds, room tone (10-15%)
- **Music**: Instrumental only (15-25%)
- **Effects**: Environmental sounds (20-30%)
- **Avoid**: Vocals, lyrics, complex melodies

**Crossfade Settings:**
- Short chapters: 1-2 seconds
- Long chapters: 2-3 seconds
- Music: 3-5 seconds for smooth transitions
- Ambient: 1-2 seconds (subtle)

**File Formats:**
- **WAV**: Best quality, largest size
- **OGG**: Good quality, smaller size (recommended)
- **MP3**: Compatible, medium quality
- **FLAC**: Lossless, large size

---

## Voice Settings & Configuration

### Voice Engine Selection

**Google Gemini:**
- Fast generation
- High quality voices
- Built-in to platform
- Cost-effective
- Best for: General narration

**ElevenLabs:**
- Ultra-realistic voices
- Voice cloning support
- Multiple languages
- Premium quality
- Best for: Professional audiobooks

### Gemini Voice Configuration

1. **Open Settings** → Voice Studio tab
2. Click "Google Gemini" engine
3. Click on current voice to open selector
4. **Available Voices:**
   - Aoede (Female, warm)
   - Charon (Male, deep)
   - Fenrir (Male, strong)
   - Kore (Female, clear)
   - Puck (Neutral, playful)

5. **Preview Voices:**
   - Click play button next to voice name
   - Hear sample: "Welcome to Ataraxia..."
   - Compare different voices

6. **Select Voice:**
   - Click on desired voice
   - Automatically applies to new chapters
   - Existing chapters retain original voice

### ElevenLabs Configuration

**Setup Steps:**

1. **Get API Key:**
   - Visit elevenlabs.io
   - Sign up / log in
   - Navigate to Profile → API Keys
   - Generate new key
   - Copy to clipboard

2. **Configure in App:**
   - Settings → Voice Studio
   - Click "ElevenLabs" engine
   - Paste API key
   - Click "Save"
   - App validates and loads voices

3. **Select Voice:**
   - Click voice dropdown
   - Browse available voices
   - Preview with play button
   - Select desired voice

4. **Voice Cloning (Advanced):**
   - Click the "NEW" button
   - Follow ElevenLabs voice cloning process
   - Upload 1-5 minutes of clean audio
   - Custom voice appears in list

### Voice Preview System

**How to Preview:**
1. Open Settings → Voice Studio
2. Ensure voice is selected
3. Click play button (▶) next to voice name
4. Wait for generation (2-5 seconds)
5. Audio plays automatically

**Preview Text:**
"Welcome to Ataraxia, where inner peace meets timeless wisdom through the power of voice."

**Tips:**
- Test voices before generating full chapters
- Listen on different devices
- Consider content tone and style
- Preview multiple voices to compare

---

## Playback Settings

### Playback Speed Control

**Location:** Settings → Playback tab

**Configuration:**
- **Range:** 0.5x to 2.0x
- **Default:** 1.0x (normal speed)
- **Increment:** 0.05x
- **Live Update:** Changes apply immediately

**Speed Guide:**
- **0.5x - 0.75x**: Slow, for learning/comprehension
- **0.8x - 1.0x**: Natural listening pace
- **1.0x - 1.25x**: Slightly faster, saves time
- **1.25x - 1.5x**: Fast listening, experienced users
- **1.5x - 2.0x**: Very fast, speed readers

**Use Cases:**
- Learning new concepts: 0.75x
- Fiction/enjoyment: 1.0x
- Non-fiction review: 1.25x
- Re-listening: 1.5x+

### Streaming Buffer Configuration

**Purpose:** Controls how many chapters to pre-load ahead of current position.

**Settings:**
- **Range:** 1 to 5 chapters
- **Default:** 2 chapters
- **Impact:** Data usage, smoothness, credits

**Buffer Recommendations:**

**1 Chapter:**
- Minimal data usage
- Lowest API costs
- May have gaps between chapters
- Best for: Testing, limited credits

**2 Chapters (Default):**
- Balanced approach
- Smooth transitions
- Moderate data usage
- Best for: Normal listening

**3-5 Chapters:**
- Maximum smoothness
- No playback gaps
- Higher data/credit usage
- Best for: Uninterrupted listening sessions

**How It Works:**
1. App monitors current chapter
2. Pre-generates upcoming chapters
3. Caches in memory/IndexedDB
4. Seamless transition at chapter end
5. Rolls buffer forward

---

## Download & Export Options

### Download Format Selection

**OGG Format (Recommended):**
- Compressed, efficient
- Smaller file size (60-80% reduction)
- Good quality (lossy)
- Best for: Storage, streaming, sharing
- Browser support: All modern browsers

**WAV Format:**
- Uncompressed, lossless
- Larger file size
- Maximum quality
- Best for: Editing, archival, professional use
- Universal compatibility

**Format Comparison:**

| Feature | OGG | WAV |
|---------|-----|-----|
| Quality | Very Good | Perfect |
| Size | Small | Large |
| Compression | Yes | No |
| Editing | Limited | Excellent |
| Speed | Fast | Fast |

### Full Audiobook Downloads

**Combined WAV:**
- Downloads entire book as single file
- Uncompressed, highest quality
- Large file size (500MB - 2GB typical)
- Best for: Archival, professional use
- Time: 5-10 minutes for full book

**Combined OGG:**
- Downloads entire book as single file
- Compressed, good quality
- Smaller size (50-200MB typical)
- Best for: Personal listening, sharing
- Time: 2-5 minutes for full book

**Process:**
1. Click download button
2. App combines all chapters
3. Renders with background audio
4. Applies normalization
5. Downloads to browser

### Batch Chapter Downloads

**Batch WAV:**
- Downloads each chapter separately
- Organized by chapter number
- Individual files for maximum flexibility
- Best for: Editing, selective listening
- Creates ZIP archive

**Batch OGG:**
- Downloads each chapter separately
- Smaller individual files
- Easy to manage and share
- Best for: Podcast-style listening
- Creates ZIP archive

**Naming Convention:**
```
Chapter_01_Title.wav
Chapter_02_Title.wav
Chapter_03_Title.wav
```

### Pre-Cache to Browser

**Purpose:** Store audio locally for offline playback without downloading files.

**How It Works:**
1. Click "Pre-Cache to Browser"
2. App generates all chapter audio
3. Stores in IndexedDB
4. Available for instant playback
5. Persists across sessions

**Benefits:**
- No file downloads needed
- Instant playback
- Offline access
- Automatic management
- No file organization

**Considerations:**
- Uses browser storage quota
- Limited by device storage
- May need quota increase
- Can clear via Data Management

---

## Data Management

Access via the Data Management modal in the control bar.

### Export App Data

**Purpose:** Create a backup of all app data including chapters, audio, and settings.

**Export Contents:**
- All chapter text and metadata
- All generated audio buffers
- Background audio library
- Voice settings
- Playback preferences
- Mixing configurations

**Export Steps:**
1. Click "Export Data"
2. App gathers all IndexedDB data
3. Creates JSON blob
4. Downloads as: `ataraxia-backup-YYYY-MM-DD.json`
5. Store backup safely

**Backup Schedule:**
- After generating full book
- Before major updates
- Weekly for active projects
- Before clearing storage

### Import App Data

**Purpose:** Restore from a previous backup or transfer data between devices.

**Import Steps:**
1. Click "Import Data"
2. Select backup JSON file
3. App validates format
4. Confirmation prompt appears
5. Click "Confirm" to proceed
6. Data restores to IndexedDB
7. Refresh page to apply

**Important Notes:**
- **Overwrites current data** - Export first!
- Cannot be undone
- May take 1-2 minutes for large files
- Page refresh required after import

### Clear All Data

**Purpose:** Reset app to fresh state.

**What Gets Deleted:**
- All chapters and audio
- Background audio library
- Voice settings (reset to defaults)
- Playback preferences
- Storage cache

**What's Preserved:**
- API keys (in localStorage)
- Browser preferences
- Theme settings

**Clear Steps:**
1. **Export First!** (Cannot undo)
2. Click "Clear All Data"
3. Confirmation dialog appears
4. Type "DELETE" to confirm
5. All data removed
6. Page reloads to fresh state

### Storage Quota Management

**View Storage Usage:**
- Total used space
- Available space
- Quota limit
- Breakdown by type

**Storage Tips:**
- Export old projects before clearing
- Use OGG format to save space
- Delete unused background audio
- Clear completed audiobooks
- Request quota increase if needed

---

## Background Audio System

### Understanding the Audio Pipeline

**Signal Flow:**
```
Background Audio File
  ↓
Load → Decode → AudioBuffer
  ↓
Apply Clip Boundaries (start/end)
  ↓
Volume Control (GainNode)
  ↓
Mixer
  ↓ (combines with)
Narration Audio
  ↓
Final Output
```

### Audio Formats Supported

**Input Formats:**
- WAV (PCM, various bit depths)
- MP3 (all bitrates)
- OGG Vorbis
- M4A / AAC
- FLAC (lossless)
- WebM Audio

**Storage Format:**
- Internal: Raw AudioBuffer (Float32)
- Export: User choice (WAV/OGG/MP3)

### Conversion Server

**Purpose:** Convert audio using Node.js and FFmpeg for high-quality output.

**Start Server:**
```bash
# In project directory
npm run audio-server
```

**Server Features:**
- FFmpeg-powered conversion
- Professional encoding settings
- Direct filesystem access
- Batch processing support
- Format: WAV (PCM 16-bit), OGG (Vorbis 192kbps), MP3 (LAME 192kbps)

**Server Status:**
- Green dot: Online and ready
- Red dot: Offline (run server)
- Yellow dot: Checking...

**Configuration:**
- Port: 3001 (default)
- Output directory: Optional
- Temp cleanup: 1 hour

**Output Directory:**
- Leave empty: Download via browser
- Specify path: Save directly to filesystem
- Example: `/home/user/Music/audiobooks/`

### Advanced Mixing Techniques

**Ducking (Manual):**
1. Lower background volume during narration
2. Raise during pauses
3. Use waveform editor to identify pauses
4. Split into multiple clips if needed

**Layering:**
1. Export mixed audiobook
2. Re-import as background audio
3. Add additional layer on top
4. Repeat for complex soundscapes

**Chapter-Specific Background:**
1. Use different audio per chapter
2. Switch clips via library
3. Maintains consistent narration
4. Varies atmosphere per section

---

## Troubleshooting

### Common Issues

**"Audio server offline" error:**

**Solution:**
```bash
# Open new terminal
cd /path/to/ataraxia-forging
npm run audio-server
```

**Verification:**
- Check Settings → Admin → Server Status
- Should show green dot
- Test at: http://localhost:3001/health

---

**"Quota exceeded" when saving:**

**Solution:**
1. Open Data Management modal
2. Check storage usage
3. Export current project
4. Clear old chapters
5. Delete unused background audio
6. Try saving again

**Prevention:**
- Use OGG format (smaller)
- Export completed projects
- Regular cleanup
- Request quota increase:
  ```javascript
  navigator.storage.estimate()
  ```

---

**Background audio not playing:**

**Checklist:**
1. Is clip selected? (Check library)
2. Is "Enabled" toggled on?
3. Is volume above 0%?
4. Does waveform show?
5. Try preview button
6. Check browser console for errors

**Debug:**
- Reload page
- Re-select clip
- Re-upload audio file
- Try different format

---

**Voice preview not working:**

**Possible Causes:**
1. Invalid API key
2. No internet connection
3. Rate limit exceeded
4. Voice not selected

**Solutions:**
- Verify API key in settings
- Check network connection
- Wait 1 minute, retry
- Select voice explicitly
- Check browser console

---

**Choppy playback / gaps:**

**Solutions:**
1. Increase streaming buffer (Settings → Playback)
2. Pre-cache full book
3. Close other tabs
4. Disable browser extensions
5. Use better network connection

**For Best Performance:**
- Buffer: 3+ chapters
- Pre-cache before listening
- Close unnecessary apps
- Use wired connection

---

**Recording not working:**

**Checklist:**
1. Microphone permission granted?
2. Microphone connected/enabled?
3. Browser supports MediaRecorder?
4. Try different browser

**Grant Permission:**
- Browser prompts on first record
- Check browser address bar for icon
- Grant permission in browser settings

---

**File upload fails:**

**Possible Issues:**
1. File too large (>500MB limit)
2. Unsupported format
3. Corrupted audio file
4. Browser quota exceeded

**Solutions:**
- Compress audio externally
- Convert to supported format
- Try different file
- Clear browser storage

---

### Getting Help

**Debug Checklist:**
1. Check browser console (F12)
2. Review error messages
3. Verify all services running
4. Test with different content
5. Try incognito mode

**Report Issues:**
- Browser and version
- Steps to reproduce
- Error messages
- Console logs
- Expected vs actual behavior

**System Info:**
- Settings → Admin → Debug Info
- Logs current state to console
- Include in bug reports

---

## Best Practices Summary

### Audio Quality
- Use high-quality source audio (44.1kHz+)
- Record in quiet environment
- Monitor levels (avoid clipping)
- Export to WAV for archival

### Workflow Efficiency
- Pre-select voice before generating
- Use buffer setting appropriate for use case
- Export backups regularly
- Organize background audio library

### Storage Management
- Use OGG format for everyday use
- Export completed projects
- Clear unused background audio
- Monitor quota usage

### Professional Output
- Test on multiple devices
- Use consistent background throughout
- Apply subtle crossfades
- Balance narration and background carefully

---

**Last Updated:** 2025-12-30
**Version:** 1.0.0
**For Technical Details:** See TECHNICAL.md

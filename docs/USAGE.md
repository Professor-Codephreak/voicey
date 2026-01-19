# Application Usage Guide

This guide covers how to use the Ataraxia audiobook application, both through its graphical user interface (GUI) and its programmatic API for developers and other AIs.

## 1. User Interface (GUI)

The application is divided into two main sections: the sidebar for navigation and settings, and the main content area for the transcript and player.

### Navigation and Playback

- **Selecting a Chapter**: Click on any chapter title in the sidebar on the left to load its transcript and prepare the audio.
- **Playing Audio**: Click the large **Play** button in the audio player at the bottom of the screen to start or resume playback. The button will change to a **Pause** icon while playing.
- **Downloading a Chapter**: Click the **Download** icon on the right side of the player to save the current chapter's audio as a WAV file.
- **Downloading a Transcript**: Click the document download icon at the top right of the transcript view to save the chapter's text as a `.txt` file.

### Tools & Settings Menu

All configuration is handled in the "Tools & Settings" pop-up menu, accessed from the button at the bottom of the sidebar.

#### General Settings
- **Playback Speed**: Adjust the slider to change the audio playback speed from 0.5x to 2x.
- **Voice Engine**: Switch between **Gemini** and **ElevenLabs**.

#### Gemini Settings
- **Gemini Voice**: Select your preferred voice from an expanded list of high-quality Gemini narrators.

#### ElevenLabs Settings
1.  **Enter API Key**: First, paste your ElevenLabs API key into the input field and click **Save**. Your key is stored securely in your browser's local storage.
2.  **Select a Voice**: Once the key is saved, the app will automatically fetch all available voices (both pre-made and your custom clones) from your ElevenLabs account. Choose your desired voice from the dropdown menu. Your selection is also saved.
3.  **Clone a New Voice**:
    - Click the **"Add / Clone Voice"** button to open the voice cloning modal.
    - Give your new voice a name.
    - Click "Choose Files" and select one or more audio samples (`.mp3`, `.wav`, etc.) for cloning.
    - Click **"Start Cloning"**. The process may take a few moments.
    - Upon success, the modal will close, and your voice list will be refreshed automatically with the new voice available for selection.

#### Full Audiobook Actions
- **Play Full Audiobook**: Streams the entire book from the beginning using your currently selected settings.
- **Generate & Download**: You can generate the full audiobook for download in `.wav` or `.ogg` format.
- **Pre-cache**: Generates and caches the audio for all chapters in the browser for instant, buffer-free playback without requiring a download.

## 2. Programmatic API (Audio-as-a-Service)

The application exposes its audio generation capabilities as a service on the `window` object, allowing for programmatic access from browser developer tools, other AI Studio applications, or browser extensions.

### Accessing the Service

The service is available at `window.audiobookService`.

### `generateAudio(config)`

This is the primary method for generating audio. It is asynchronous and returns a `Promise` that resolves with a WAV audio `Blob`.

#### Configuration Object

The `config` parameter is an object with the following properties:

- `engine` (required): The voice engine to use. Can be `'gemini'` or `'elevenlabs'`.
- `text` (required): The text content you want to convert to speech.
- `apiKey` (optional): Your ElevenLabs API key. This is **required** if `engine` is `'elevenlabs'`.
- `geminiVoice` (optional): The name of the Gemini voice to use (e.g., `'Kore'`, `'Zephyr'`). Defaults to `'Kore'`.
- `elevenLabsVoiceId` (optional): The ID of the ElevenLabs voice to use. This is **required** if `engine` is `'elevenlabs'`.

#### Example Usage

Here is how you can call the service from your browser's developer console:

```javascript
// --- Example 1: Using the Gemini Engine with a specific voice ---
try {
    const geminiBlob = await window.audiobookService.generateAudio({
        engine: 'gemini',
        text: 'To be, or not to be, that is the question.',
        geminiVoice: 'Zephyr'
    });

    // Create a URL from the Blob and play it
    const geminiAudioUrl = URL.createObjectURL(geminiBlob);
    new Audio(geminiAudioUrl).play();
    console.log("Gemini audio generated and is playing.", geminiBlob);

} catch (error) {
    console.error("Failed to generate Gemini audio:", error);
}


// --- Example 2: Using a custom ElevenLabs Voice ---
try {
    const elevenLabsApiKey = 'YOUR_ELEVENLABS_API_KEY_HERE'; // Replace with your actual key
    const myCustomVoiceId = 'YOUR_CUSTOM_VOICE_ID_HERE'; // Replace with a voice ID from your account

    const elevenBlob = await window.audiobookService.generateAudio({
        engine: 'elevenlabs',
        text: 'Whether tis nobler in the mind to suffer the slings and arrows of outrageous fortune.',
        apiKey: elevenLabsApiKey,
        elevenLabsVoiceId: myCustomVoiceId
    });

    // Create a URL from the Blob and play it
    const elevenAudioUrl = URL.createObjectURL(elevenBlob);
    new Audio(elevenAudioUrl).play();
    console.log("ElevenLabs audio generated and is playing.", elevenBlob);

} catch (error) {
    console.error("Failed to generate ElevenLabs audio:", error);
}
```
This API provides a powerful way to leverage the application's TTS capabilities for any purpose directly within the browser environment.
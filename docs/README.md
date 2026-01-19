# Ataraxia: Forging the Sovereign Self
## An Interactive AI Audiobook Experience

**Ataraxia** is a cutting-edge web application that transforms the philosophical journey of "Forging the Sovereign Self" into an immersive, interactive audiobook. Unlike traditional static audiobooks, Ataraxia generates high-fidelity audio in real-time using advanced AI voice synthesis, allowing for a customizable and dynamic listening experience.

The book itself is a guide to inner tranquility, Stoic philosophy, martial arts discipline, and the psychological architecture required to navigate a chaotic world with an unshakeable mind.

---

## Technical Explanation

This project showcases the convergence of modern web technologies and Generative AI:

1.  **Frontend Architecture**: Built with **React** and **TypeScript**, using **Vite** for a lightning-fast development environment. It utilizes **Tailwind CSS** for a responsive, "cyberpunk-zen" aesthetic.
2.  **Audio Generation Engine**:
    *   **Google Gemini API (`@google/genai`)**: Used for the default, high-speed neural text-to-speech generation.
    *   **ElevenLabs API**: Integrated for ultra-realistic, emotive voice synthesis and voice cloning capabilities (requires user API key).
3.  **Signal Processing**:
    *   **Web Audio API**: The core of the audio player. It handles real-time audio buffering, playback rate adjustment, and node routing.
    *   **Visualizers**: Includes a real-time Oscilloscope and Spectrogram powered by an `AnalyserNode` and HTML5 Canvas.
    *   **Audio Filters**: Features a BiquadFilterNode (Lowpass, Highpass, Bandpass) to shape the audio output in real-time.
4.  **Local Persistence**: Application state (progress, bookmarks, API keys, settings) is stored securely in the browser's `localStorage`.

---

## Installation & Usage (Linux / macOS / Windows)

These instructions assume you are using a Linux terminal (e.g., Ubuntu, Arch, WSL), but they work similarly on macOS and Windows.

### Prerequisites

*   **Node.js**: Version 18+ is required.
*   **npm**: Included with Node.js.

### 1. Installation

Navigate to the project directory in your terminal:

```bash
cd /path/to/ataraxia
```

Install the dependencies:

```bash
npm install
```
*(If you previously saw an `ENOENT: no such file or directory` error, it was because `package.json` was missing. This file has now been added.)*

### 2. Configuration (API Keys)

To generate audio, the application needs a Google Gemini API Key.

**Option A: Environment Variable (Recommended for Dev)**
You can export the key in your terminal session before running the app:

```bash
export API_KEY="your_google_gemini_api_key_here"
```

**Option B: .env File**
Create a `.env` file in the root directory:

```bash
touch .env
```
Add the following line to the file:
```env
VITE_API_KEY=your_google_gemini_api_key_here
```
*(Note: You may need to update `vite.config.ts` to map `VITE_API_KEY` to `process.env.API_KEY` if using this method).*

**ElevenLabs Configuration**:
ElevenLabs API keys are **not** set in the environment variables. You enter these directly into the application's "Tools & Settings" menu UI. They are stored locally in your browser.

### 3. Running the Application

Start the local development server:

```bash
npm run dev
```

You should see output similar to:
```
  VITE v5.3.4  ready in 250 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

Open your browser and navigate to `http://localhost:3000`.

### 4. Building for Production

To create an optimized build for deployment:

```bash
npm run build
```

The output files will be located in the `dist/` directory.

---

## Application Features

*   **Dual Engine Voice Studio**: Switch seamlessly between Google Gemini and ElevenLabs.
*   **Full Book Download**: Generate the entire book as a single WAV or OGG file.
*   **Browser Caching**: "Pre-cache" the entire book to listen offline without repeated API calls.
*   **Voice Cloning**: Upload samples to clone voices via ElevenLabs directly within the app.
*   **Visualizer Suite**: Customize your view with Spectrograms and Oscilloscopes in various themes (Cyberpunk, Matrix, Inferno).
*   **Dark Mode UI**: Designed for long reading/listening sessions with minimal eye strain.

---

## Troubleshooting

**Error: `npm error code ENOENT ... package.json`**
*   **Cause**: You are trying to run `npm install` in a directory that doesn't have the project configuration files.
*   **Fix**: Ensure you have downloaded the `package.json` file included in the latest update of this repository.

**Audio not playing / "Permission Denied"**
*   **Fix**: Browsers often block auto-playing audio. Interact with the page (click a button) to resume the AudioContext.

**API Key Errors**
*   **Fix**: Ensure your Google Gemini API key is active and has access to the Generative Language API. If using ElevenLabs, ensure you have sufficient character credits.

---

(c) PYTHAI 2024
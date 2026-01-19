import React, { useState, useRef, useEffect } from 'react';

interface AudioFile {
    id: string;
    name: string;
    blob: Blob;
    url: string;
    duration: number;
    type: 'voice' | 'background' | 'chapter';
}

interface AudioMixerProps {
    availableFiles: AudioFile[];
    onMixComplete: (mixedBlob: Blob, filename: string) => void;
}

export const AudioMixer: React.FC<AudioMixerProps> = ({
    availableFiles,
    onMixComplete
}) => {
    const [selectedChapter, setSelectedChapter] = useState<AudioFile | null>(null);
    const [selectedBackground, setSelectedBackground] = useState<AudioFile | null>(null);
    const [chapterVolume, setChapterVolume] = useState(80); // 0-100, chapter dominance
    const [backgroundVolume, setBackgroundVolume] = useState(20); // 0-100, background level
    const [isMixing, setIsMixing] = useState(false);
    const [previewMode, setPreviewMode] = useState<'chapter' | 'background' | 'mixed' | null>(null);

    const audioContextRef = useRef<AudioContext | null>(null);
    const chapterSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const backgroundSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const chapterGainRef = useRef<GainNode | null>(null);
    const backgroundGainRef = useRef<GainNode | null>(null);

    useEffect(() => {
        return () => {
            // Cleanup
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
        };
    }, []);

    const chapterFiles = availableFiles.filter(f => f.type === 'chapter' || f.type === 'voice');
    const backgroundFiles = availableFiles.filter(f => f.type === 'background');

    const handleDominanceChange = (value: number) => {
        // Dominance spectrum: 0 = background dominant, 100 = chapter dominant
        setChapterVolume(value);
        setBackgroundVolume(100 - value);
    };

    const loadAudioBuffer = async (blob: Blob): Promise<AudioBuffer> => {
        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext();
        }

        const arrayBuffer = await blob.arrayBuffer();
        return await audioContextRef.current.decodeAudioData(arrayBuffer);
    };

    const mixAudioFiles = async () => {
        if (!selectedChapter || !selectedBackground) {
            alert('Please select both a chapter and background audio file');
            return;
        }

        setIsMixing(true);

        try {
            const audioContext = new AudioContext();

            // Load both audio files
            const chapterBuffer = await loadAudioBuffer(selectedChapter.blob);
            const backgroundBuffer = await loadAudioBuffer(selectedBackground.blob);

            // Use the longer duration
            const maxDuration = Math.max(chapterBuffer.duration, backgroundBuffer.duration);
            const sampleRate = audioContext.sampleRate;
            const numberOfChannels = Math.max(chapterBuffer.numberOfChannels, backgroundBuffer.numberOfChannels);

            // Create output buffer
            const outputBuffer = audioContext.createBuffer(
                numberOfChannels,
                Math.ceil(maxDuration * sampleRate),
                sampleRate
            );

            // Mix the audio
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const outputData = outputBuffer.getChannelData(channel);

                // Get input channels (use channel 0 if mono source)
                const chapterData = chapterBuffer.getChannelData(
                    Math.min(channel, chapterBuffer.numberOfChannels - 1)
                );
                const backgroundData = backgroundBuffer.getChannelData(
                    Math.min(channel, backgroundBuffer.numberOfChannels - 1)
                );

                const chapterGain = chapterVolume / 100;
                const backgroundGain = backgroundVolume / 100;

                // Mix samples
                for (let i = 0; i < outputData.length; i++) {
                    let sample = 0;

                    // Add chapter audio
                    if (i < chapterData.length) {
                        sample += chapterData[i] * chapterGain;
                    }

                    // Add background audio (loop if shorter)
                    if (backgroundData.length > 0) {
                        const bgIndex = i % backgroundData.length;
                        sample += backgroundData[bgIndex] * backgroundGain;
                    }

                    // Normalize to prevent clipping
                    outputData[i] = Math.max(-1, Math.min(1, sample));
                }
            }

            // Convert to WAV blob
            const wavBlob = audioBufferToWavBlob(outputBuffer);

            // Generate filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `mixed-${selectedChapter.name.replace(/\.[^/.]+$/, '')}-${timestamp}.wav`;

            onMixComplete(wavBlob, filename);
            setIsMixing(false);

        } catch (error) {
            console.error('Error mixing audio:', error);
            alert('Failed to mix audio: ' + (error instanceof Error ? error.message : 'Unknown error'));
            setIsMixing(false);
        }
    };

    const audioBufferToWavBlob = (buffer: AudioBuffer): Blob => {
        const length = buffer.length * buffer.numberOfChannels * 2;
        const arrayBuffer = new ArrayBuffer(44 + length);
        const view = new DataView(arrayBuffer);
        const channels: Float32Array[] = [];
        let pos = 0;

        const setUint16 = (data: number) => {
            view.setUint16(pos, data, true);
            pos += 2;
        };
        const setUint32 = (data: number) => {
            view.setUint32(pos, data, true);
            pos += 4;
        };

        // WAV header
        setUint32(0x46464952); // "RIFF"
        setUint32(36 + length);
        setUint32(0x45564157); // "WAVE"
        setUint32(0x20746d66); // "fmt "
        setUint32(16);
        setUint16(1);
        setUint16(buffer.numberOfChannels);
        setUint32(buffer.sampleRate);
        setUint32(buffer.sampleRate * buffer.numberOfChannels * 2);
        setUint16(buffer.numberOfChannels * 2);
        setUint16(16);
        setUint32(0x61746164); // "data"
        setUint32(length);

        // Write audio data
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }

        let offset = 0;
        while (pos < arrayBuffer.byteLength) {
            for (let i = 0; i < buffer.numberOfChannels; i++) {
                let sample = Math.max(-1, Math.min(1, channels[i][offset]));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
                view.setInt16(pos, sample, true);
                pos += 2;
            }
            offset++;
        }

        return new Blob([arrayBuffer], { type: 'audio/wav' });
    };

    const previewMix = async () => {
        if (!selectedChapter || !selectedBackground) return;

        // Stop any existing playback
        stopPreview();

        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new AudioContext();
            }

            const audioContext = audioContextRef.current;

            // Load both audio files
            const chapterBuffer = await loadAudioBuffer(selectedChapter.blob);
            const backgroundBuffer = await loadAudioBuffer(selectedBackground.blob);

            // Create sources
            const chapterSource = audioContext.createBufferSource();
            const backgroundSource = audioContext.createBufferSource();

            chapterSource.buffer = chapterBuffer;
            backgroundSource.buffer = backgroundBuffer;
            backgroundSource.loop = true; // Loop background audio

            // Create gain nodes
            const chapterGain = audioContext.createGain();
            const backgroundGain = audioContext.createGain();

            chapterGain.gain.value = chapterVolume / 100;
            backgroundGain.gain.value = backgroundVolume / 100;

            // Connect nodes
            chapterSource.connect(chapterGain);
            backgroundSource.connect(backgroundGain);

            chapterGain.connect(audioContext.destination);
            backgroundGain.connect(audioContext.destination);

            // Store references
            chapterSourceRef.current = chapterSource;
            backgroundSourceRef.current = backgroundSource;
            chapterGainRef.current = chapterGain;
            backgroundGainRef.current = backgroundGain;

            // Start playback
            chapterSource.start(0);
            backgroundSource.start(0);

            setPreviewMode('mixed');

            // Auto-stop when chapter ends
            setTimeout(() => {
                stopPreview();
            }, chapterBuffer.duration * 1000);

        } catch (error) {
            console.error('Error previewing mix:', error);
            alert('Failed to preview: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    const stopPreview = () => {
        if (chapterSourceRef.current) {
            try {
                chapterSourceRef.current.stop();
            } catch (e) {
                // Already stopped
            }
            chapterSourceRef.current = null;
        }
        if (backgroundSourceRef.current) {
            try {
                backgroundSourceRef.current.stop();
            } catch (e) {
                // Already stopped
            }
            backgroundSourceRef.current = null;
        }
        setPreviewMode(null);
    };

    const updatePreviewVolumes = () => {
        if (chapterGainRef.current) {
            chapterGainRef.current.gain.value = chapterVolume / 100;
        }
        if (backgroundGainRef.current) {
            backgroundGainRef.current.gain.value = backgroundVolume / 100;
        }
    };

    // Update volumes in real-time during preview
    useEffect(() => {
        if (previewMode === 'mixed') {
            updatePreviewVolumes();
        }
    }, [chapterVolume, backgroundVolume, previewMode]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Professional Audio Mixer</h2>
                <p className="text-sm text-gray-400">Mix chapter voice with background audio using the dominance spectrum</p>
            </div>

            {/* File Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Chapter/Voice Selection */}
                <div className="p-4 bg-gray-800 border-2 border-purple-600/50 rounded-xl">
                    <h3 className="text-lg font-semibold text-purple-300 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                        </svg>
                        Chapter / Voice Audio
                    </h3>
                    <select
                        value={selectedChapter?.id || ''}
                        onChange={(e) => {
                            const file = chapterFiles.find(f => f.id === e.target.value);
                            setSelectedChapter(file || null);
                        }}
                        className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                    >
                        <option value="">Select chapter or voice audio...</option>
                        {chapterFiles.map(file => (
                            <option key={file.id} value={file.id}>
                                {file.name} ({Math.round(file.duration)}s)
                            </option>
                        ))}
                    </select>
                    {selectedChapter && (
                        <div className="mt-3 p-3 bg-purple-900/30 border border-purple-600/50 rounded-lg">
                            <div className="text-xs text-purple-200">Selected: {selectedChapter.name}</div>
                            <div className="text-xs text-purple-300 mt-1">Duration: {selectedChapter.duration.toFixed(1)}s</div>
                        </div>
                    )}
                </div>

                {/* Background Audio Selection */}
                <div className="p-4 bg-gray-800 border-2 border-green-600/50 rounded-xl">
                    <h3 className="text-lg font-semibold text-green-300 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                        </svg>
                        Background Audio
                    </h3>
                    <select
                        value={selectedBackground?.id || ''}
                        onChange={(e) => {
                            const file = backgroundFiles.find(f => f.id === e.target.value);
                            setSelectedBackground(file || null);
                        }}
                        className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none"
                    >
                        <option value="">Select background audio...</option>
                        {backgroundFiles.map(file => (
                            <option key={file.id} value={file.id}>
                                {file.name} ({Math.round(file.duration)}s)
                            </option>
                        ))}
                    </select>
                    {selectedBackground && (
                        <div className="mt-3 p-3 bg-green-900/30 border border-green-600/50 rounded-lg">
                            <div className="text-xs text-green-200">Selected: {selectedBackground.name}</div>
                            <div className="text-xs text-green-300 mt-1">Duration: {selectedBackground.duration.toFixed(1)}s (will loop)</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Dominance Spectrum Control */}
            {selectedChapter && selectedBackground && (
                <div className="p-6 bg-gradient-to-r from-purple-900/30 via-gray-900 to-green-900/30 border-2 border-gray-700 rounded-xl space-y-4">
                    <h3 className="text-xl font-bold text-white text-center mb-4">Dominance Spectrum</h3>

                    {/* Visual Spectrum */}
                    <div className="relative h-16 bg-gray-800 rounded-lg overflow-hidden border border-gray-600">
                        <div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-200"
                            style={{ width: `${chapterVolume}%` }}
                        />
                        <div
                            className="absolute inset-y-0 right-0 bg-gradient-to-l from-green-600 to-green-400 transition-all duration-200"
                            style={{ width: `${backgroundVolume}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-white font-bold text-lg drop-shadow-lg">
                                {chapterVolume}% Chapter : {backgroundVolume}% Background
                            </span>
                        </div>
                    </div>

                    {/* Dominance Slider */}
                    <div className="space-y-2">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={chapterVolume}
                            onChange={(e) => handleDominanceChange(Number(e.target.value))}
                            className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between text-xs text-gray-400">
                            <span className="text-green-400">← Background Dominant</span>
                            <span className="text-purple-400">Chapter Dominant →</span>
                        </div>
                    </div>

                    {/* Preset Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleDominanceChange(90)}
                            className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                            Voice Focus (90:10)
                        </button>
                        <button
                            onClick={() => handleDominanceChange(70)}
                            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                            Balanced (70:30)
                        </button>
                        <button
                            onClick={() => handleDominanceChange(50)}
                            className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                            Equal (50:50)
                        </button>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
                <button
                    onClick={previewMode === 'mixed' ? stopPreview : previewMix}
                    disabled={!selectedChapter || !selectedBackground}
                    className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all transform hover:scale-105 active:scale-95 disabled:transform-none"
                >
                    {previewMode === 'mixed' ? (
                        <>
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                            </svg>
                            Stop Preview
                        </>
                    ) : (
                        <>
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                            Preview Mix
                        </>
                    )}
                </button>

                <button
                    onClick={mixAudioFiles}
                    disabled={!selectedChapter || !selectedBackground || isMixing}
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-purple-600 to-green-600 hover:from-purple-700 hover:to-green-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all transform hover:scale-105 active:scale-95 disabled:transform-none"
                >
                    {isMixing ? (
                        <>
                            <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Mixing...
                        </>
                    ) : (
                        <>
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
                            </svg>
                            Create Mixed Audio
                        </>
                    )}
                </button>
            </div>

            {/* Help Text */}
            <div className="p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                <div className="text-sm text-blue-200 space-y-1">
                    <div className="font-semibold mb-2">🎚️ Professional Mixing Guide:</div>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Select a chapter/voice audio file and background music/ambience</li>
                        <li>Use the dominance spectrum to control the balance between voice and background</li>
                        <li>Preview your mix in real-time before creating the final file</li>
                        <li>Background audio will loop automatically to match chapter duration</li>
                        <li>Adjust volumes during preview to find the perfect balance</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

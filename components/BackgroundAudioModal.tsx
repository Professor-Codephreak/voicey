import React, { useState, useRef, useCallback, useEffect } from 'react';
import { BackgroundAudioClip, BackgroundAudioSettings, loadAudioFile, generateWaveformData } from '../services/backgroundAudioService';
import WaveformViewer from './WaveformViewer';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { BackgroundAudioRecorder } from './BackgroundAudioRecorder';
import storageService from '../services/storageService';
import * as audioConversionService from '../services/audioConversionService';

interface BackgroundAudioModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: BackgroundAudioSettings;
    onSettingsChange: (settings: BackgroundAudioSettings) => void;
    audioContext: AudioContext | null;
}

export const BackgroundAudioModal: React.FC<BackgroundAudioModalProps> = ({
    isOpen,
    onClose,
    settings,
    onSettingsChange,
    audioContext,
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [waveformData, setWaveformData] = useState<Float32Array>(new Float32Array(0));
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const [activeTab, setActiveTab] = useState<'upload' | 'library' | 'record' | 'filesystem'>('filesystem');
    const [libraryClips, setLibraryClips] = useState<Array<{id: string, name: string, duration: number, size?: number}>>([]);
    const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
    const [outputDirectory, setOutputDirectory] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'date' | 'duration'>('date');

    const clip = settings.clip;

    useEffect(() => {
        // Generate waveform when clip changes
        if (clip && clip.buffer) {
            const data = generateWaveformData(clip.buffer, 1000);
            setWaveformData(data);
        }
    }, [clip]);

    useEffect(() => {
        if (isOpen) {
            loadLibrary();
            checkServerStatus();
        }
    }, [isOpen]);

    const checkServerStatus = async () => {
        const available = await audioConversionService.checkServerStatus();
        setServerAvailable(available);
        if (!available) {
            console.warn('Audio conversion server is not running. Run "npm run audio-server" to enable conversion features.');
        }
    };

    const loadLibrary = async () => {
        try {
            const allClips = await storageService.getAllBackgroundAudio();
            setLibraryClips(allClips.map(clip => ({
                id: clip.id,
                name: clip.name,
                duration: clip.duration,
                size: clip.data.byteLength
            })));
        } catch (error) {
            console.error('Failed to load library:', error);
            setError('Failed to load library: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, ingest: boolean = false) => {
        const file = e.target.files?.[0];
        if (!file || !audioContext) return;

        console.log(`Loading ${ingest ? 'and ingesting' : ''} file:`, file.name, 'Size:', file.size, 'Type:', file.type);

        setIsLoading(true);
        setError(null);

        try {
            const loadedClip = await loadAudioFile(file, audioContext);
            console.log('File loaded successfully. Duration:', loadedClip.duration, 'Buffer channels:', loadedClip.buffer.numberOfChannels);

            if (ingest) {
                // Save to library permanently
                await handleIngestFile(loadedClip, file.name);
            } else {
                // Use temporarily
                onSettingsChange({
                    ...settings,
                    clip: loadedClip,
                });
            }
        } catch (err) {
            console.error('Error loading file:', err);
            setError(err instanceof Error ? err.message : 'Failed to load audio file');
        } finally {
            setIsLoading(false);
            // Reset file input
            if (e.target) {
                e.target.value = '';
            }
        }
    };

    const handleIngestFile = async (clip: BackgroundAudioClip, originalName: string) => {
        if (!audioContext) return;

        console.log('Ingesting file to library:', originalName);
        setIsLoading(true);
        try {
            // Convert AudioBuffer to ArrayBuffer for storage
            const channels: Float32Array[] = [];
            for (let i = 0; i < clip.buffer.numberOfChannels; i++) {
                channels.push(clip.buffer.getChannelData(i));
            }

            const totalLength = clip.buffer.length * clip.buffer.numberOfChannels * 4;
            const arrayBuffer = new ArrayBuffer(totalLength);
            const view = new Float32Array(arrayBuffer);

            for (let i = 0; i < clip.buffer.length; i++) {
                for (let channel = 0; channel < clip.buffer.numberOfChannels; channel++) {
                    view[i * clip.buffer.numberOfChannels + channel] = channels[channel][i];
                }
            }

            const id = `library-${Date.now()}`;
            const backgroundSettings = {
                enabled: false,
                clip: null,
                repeat: false,
                matchLength: true,
                crossfade: true,
                crossfadeDuration: 2,
            };

            await storageService.saveBackgroundAudio(id, originalName, arrayBuffer, clip.buffer.duration, backgroundSettings);
            console.log('File ingested successfully. ID:', id, 'Size:', arrayBuffer.byteLength);

            // Reload library and set as current clip
            await loadLibrary();

            const newClip = { ...clip, id, name: originalName };
            onSettingsChange({
                ...settings,
                clip: newClip,
            });

            console.log('Switched to library tab. Total clips:', libraryClips.length + 1);
            setActiveTab('library');
        } catch (err) {
            console.error('Error ingesting file:', err);
            setError(err instanceof Error ? err.message : 'Failed to ingest file to library');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportClip = async (clipId: string, format: 'wav' | 'ogg' | 'mp3') => {
        if (!audioContext) return;

        // Check if server is available
        if (serverAvailable === false) {
            setError('Audio conversion server is not running. Please run "npm run audio-server" in a separate terminal.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const record = await storageService.getBackgroundAudio(clipId);
            if (!record) throw new Error('Clip not found');

            // Decode to AudioBuffer
            const audioBuffer = await audioContext.decodeAudioData(record.data.slice(0));

            // Use the Node.js server for conversion
            const result = await audioConversionService.convertAudioBuffer(
                audioBuffer,
                {
                    format,
                    outputPath: outputDirectory || undefined
                },
                record.name
            );

            console.log('Conversion successful:', result);

            // If no output directory specified, download from server
            if (!outputDirectory) {
                const blob = await audioConversionService.downloadConvertedFile(result.filename);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.download = result.filename;
                a.href = url;
                document.body.appendChild(a);
                a.click();
                URL.revokeObjectURL(url);
                document.body.removeChild(a);

                setError(`✓ Exported ${result.filename} (${(result.size / (1024 * 1024)).toFixed(2)} MB)`);
            } else {
                setError(`✓ Saved to ${result.userPath} (${(result.size / (1024 * 1024)).toFixed(2)} MB)`);
            }
        } catch (err) {
            console.error('Error exporting clip:', err);
            setError(err instanceof Error ? err.message : 'Failed to export clip');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoadFromLibrary = async (clipId: string) => {
        if (!audioContext) return;

        setIsLoading(true);
        setError(null);

        try {
            const record = await storageService.getBackgroundAudio(clipId);
            if (!record) {
                throw new Error('Clip not found in library');
            }

            // Convert ArrayBuffer back to AudioBuffer
            const audioBuffer = await audioContext.decodeAudioData(record.data.slice(0));

            const loadedClip: BackgroundAudioClip = {
                id: record.id,
                name: record.name,
                buffer: audioBuffer,
                duration: record.duration,
                startTime: 0,
                endTime: record.duration,
                volume: 0.3,
                fadeIn: 2,
                fadeOut: 2,
            };

            onSettingsChange({
                ...settings,
                clip: loadedClip,
            });
        } catch (err) {
            console.error('Error loading from library:', err);
            setError(err instanceof Error ? err.message : 'Failed to load clip from library');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteFromLibrary = async (clipId: string) => {
        try {
            await storageService.deleteBackgroundAudio(clipId);
            await loadLibrary();

            // If this was the current clip, clear it
            if (clip && clip.id === clipId) {
                onSettingsChange({
                    ...settings,
                    clip: null,
                });
            }
        } catch (err) {
            console.error('Error deleting from library:', err);
            setError(err instanceof Error ? err.message : 'Failed to delete clip');
        }
    };

    const handleClipUpdate = (updates: Partial<BackgroundAudioClip>) => {
        if (!clip) return;
        onSettingsChange({
            ...settings,
            clip: { ...clip, ...updates },
        });
    };

    const handleRecordingComplete = async (audioBuffer: AudioBuffer, name: string, _format: 'wav' | 'ogg') => {
        if (!audioContext) return;

        setIsLoading(true);
        setError(null);

        try {
            // Convert AudioBuffer to ArrayBuffer for storage
            const channels: Float32Array[] = [];
            for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
                channels.push(audioBuffer.getChannelData(i));
            }

            // Calculate total size
            const totalLength = audioBuffer.length * audioBuffer.numberOfChannels * 4; // 4 bytes per float32
            const arrayBuffer = new ArrayBuffer(totalLength);
            const view = new Float32Array(arrayBuffer);

            // Interleave channels
            for (let i = 0; i < audioBuffer.length; i++) {
                for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                    view[i * audioBuffer.numberOfChannels + channel] = channels[channel][i];
                }
            }

            // Save to IndexedDB
            const id = `recorded-${Date.now()}`;
            const backgroundSettings = {
                enabled: false,
                clip: null,
                repeat: false,
                matchLength: true,
                crossfade: true,
                crossfadeDuration: 2,
            };
            await storageService.saveBackgroundAudio(id, name, arrayBuffer, audioBuffer.duration, backgroundSettings);

            // Create clip from recorded audio
            const newClip: BackgroundAudioClip = {
                id,
                name,
                buffer: audioBuffer,
                duration: audioBuffer.duration,
                startTime: 0,
                endTime: audioBuffer.duration,
                volume: 0.3,
                fadeIn: 2,
                fadeOut: 2,
            };

            onSettingsChange({
                ...settings,
                clip: newClip,
            });

            // Reload library and switch to library tab
            await loadLibrary();
            setActiveTab('library');
        } catch (err) {
            console.error('Error saving recording:', err);
            setError(err instanceof Error ? err.message : 'Failed to save recording');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent, ingest: boolean = false) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('audio/')) {
                // Process the dropped file directly
                if (!audioContext) return;

                setIsLoading(true);
                setError(null);

                try {
                    const loadedClip = await loadAudioFile(file, audioContext);

                    if (ingest) {
                        await handleIngestFile(loadedClip, file.name);
                    } else {
                        onSettingsChange({
                            ...settings,
                            clip: loadedClip,
                        });
                    }
                } catch (err) {
                    console.error('Error loading dropped file:', err);
                    setError(err instanceof Error ? err.message : 'Failed to load audio file');
                } finally {
                    setIsLoading(false);
                }
            } else {
                setError('Please drop an audio file (MP3, WAV, OGG, etc.)');
            }
        }
    };

    const handlePreview = useCallback(() => {
        if (!clip || !audioContext) return;

        if (isPlaying && audioSourceRef.current) {
            audioSourceRef.current.stop();
            audioSourceRef.current = null;
            setIsPlaying(false);
            return;
        }

        // Create a source from the clip
        const source = audioContext.createBufferSource();
        source.buffer = clip.buffer;

        // Apply volume
        const gainNode = audioContext.createGain();
        gainNode.gain.value = clip.volume;

        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Start from the clip start time
        source.start(0, clip.startTime, clip.endTime - clip.startTime);

        source.onended = () => {
            setIsPlaying(false);
            audioSourceRef.current = null;
        };

        audioSourceRef.current = source;
        setIsPlaying(true);
    }, [clip, audioContext, isPlaying]);

    const stopPreview = useCallback(() => {
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
            audioSourceRef.current = null;
            setIsPlaying(false);
        }
    }, []);

    useEffect(() => {
        return () => {
            stopPreview();
        };
    }, [stopPreview]);

    // Filter and sort library clips
    const filteredAndSortedClips = libraryClips
        .filter(libraryClip =>
            libraryClip.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'duration') return b.duration - a.duration;
            return 0; // 'date' - already sorted by ID which includes timestamp
        });

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Background Audio Settings</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                        aria-label="Close"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Enable/Disable Toggle */}
                    <div className={`p-4 rounded-lg border-2 transition-all ${
                        settings.enabled
                            ? 'bg-green-900/20 border-green-600/50'
                            : 'bg-gray-700/50 border-gray-600/50'
                    }`}>
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    Enable Background Audio
                                    {settings.enabled && (
                                        <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded-full">
                                            ACTIVE
                                        </span>
                                    )}
                                </h3>
                                <p className="text-sm text-gray-400">
                                    {settings.enabled
                                        ? 'Background audio will be mixed into all newly generated chapters'
                                        : 'Add music or ambient sounds to your audiobook'
                                    }
                                </p>
                            </div>
                            <button
                                onClick={() => onSettingsChange({ ...settings, enabled: !settings.enabled })}
                                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                                    settings.enabled ? 'bg-green-600' : 'bg-gray-600'
                                }`}
                            >
                                <span
                                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                                        settings.enabled ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>
                        {settings.enabled && !clip && (
                            <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-700/50 rounded text-xs text-yellow-200">
                                <strong>Note:</strong> No audio clip selected. Upload or record audio below to use background audio.
                            </div>
                        )}
                        {settings.enabled && clip && (
                            <div className="mt-2 p-2 bg-green-900/20 border border-green-700/50 rounded text-xs text-green-200">
                                <strong>Ready!</strong> Using "{clip.name}" as background audio for new chapters.
                            </div>
                        )}
                    </div>

                    {/* Tab Selection */}
                    <div className="grid grid-cols-4 gap-1.5 p-1 bg-gray-700/50 rounded-lg">
                        <button
                            onClick={() => setActiveTab('filesystem')}
                            className={`px-2 py-2 rounded transition-all ${
                                activeTab === 'filesystem'
                                    ? 'bg-purple-600 text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-600'
                            }`}
                        >
                            <div className="flex flex-col items-center gap-0.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                                </svg>
                                <span className="text-[10px] font-semibold">HD</span>
                                <span className="text-[9px] opacity-75">Cache+Disk</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('library')}
                            className={`px-2 py-2 rounded transition-all ${
                                activeTab === 'library'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-600'
                            }`}
                        >
                            <div className="flex flex-col items-center gap-0.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                <span className="text-[10px] font-semibold">Library</span>
                                <span className="text-[9px] opacity-75">IndexedDB</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('upload')}
                            className={`px-2 py-2 rounded transition-all ${
                                activeTab === 'upload'
                                    ? 'bg-yellow-600 text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-600'
                            }`}
                        >
                            <div className="flex flex-col items-center gap-0.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <span className="text-[10px] font-semibold">Upload</span>
                                <span className="text-[9px] opacity-75">Temporary</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('record')}
                            className={`px-2 py-2 rounded transition-all ${
                                activeTab === 'record'
                                    ? 'bg-red-600 text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-600'
                            }`}
                        >
                            <div className="flex flex-col items-center gap-0.5">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                </svg>
                                <span className="text-[10px] font-semibold">Record</span>
                                <span className="text-[9px] opacity-75">Create</span>
                            </div>
                        </button>
                    </div>

                    {/* Server Status and Settings */}
                    <div className="space-y-2 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${serverAvailable ? 'bg-green-500' : serverAvailable === false ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                                <span className="text-sm text-gray-300">
                                    Conversion Server: {serverAvailable ? 'Online' : serverAvailable === false ? 'Offline' : 'Checking...'}
                                </span>
                            </div>
                            {serverAvailable === false && (
                                <button
                                    onClick={checkServerStatus}
                                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                >
                                    Retry
                                </button>
                            )}
                        </div>
                        {serverAvailable === false && (
                            <div className="text-xs text-red-300">
                                Run <code className="px-1 py-0.5 bg-gray-900 rounded">npm run audio-server</code> to enable Node.js conversion
                            </div>
                        )}
                        {serverAvailable && (
                            <div className="space-y-1">
                                <label className="text-xs text-gray-400">Output Directory (optional):</label>
                                <input
                                    type="text"
                                    value={outputDirectory}
                                    onChange={(e) => setOutputDirectory(e.target.value)}
                                    placeholder="/path/to/output (leave empty for browser download)"
                                    className="w-full px-2 py-1 text-sm bg-gray-900 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                />
                                <div className="text-[10px] text-gray-500">
                                    Specify a local filesystem path to save files directly. Leave empty to download via browser.
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Upload File Tab - Temporary Use */}
                    {activeTab === 'upload' && (
                        <div className="space-y-4">
                            <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg text-sm text-yellow-200">
                                <strong>Temporary Upload:</strong> File will be used for this session only. Use "Library" tab to save permanently.
                            </div>

                            {/* Drag and Drop Zone for Temporary Upload */}
                            <div
                                className={`p-6 rounded-lg border-2 border-dashed transition-all ${
                                    isDragging
                                        ? 'bg-yellow-600/30 border-yellow-400 scale-[1.02]'
                                        : 'bg-gray-700/50 border-gray-600 hover:border-yellow-600/70 hover:bg-gray-700/70'
                                }`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, false)}
                            >
                                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    Quick Upload
                                </h3>
                                <p className="text-sm text-gray-400 mb-4">
                                    {isDragging ? 'Drop file here to use temporarily' : 'Drag & drop audio file or click to browse'}
                                </p>
                                <div className="flex gap-4">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isLoading}
                                className="px-2.5 py-1.5 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white rounded-md transition-colors flex items-center gap-1.5 font-medium text-xs shadow-md"
                            >
                                {isLoading ? (
                                    <>
                                        <SpinnerIcon className="w-3.5 h-3.5" />
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        {clip ? 'Change File' : 'Browse Files'}
                                    </>
                                )}
                            </button>
                            {clip && (
                                <button
                                    onClick={handlePreview}
                                    className={`px-2.5 py-1.5 ${isPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded-md transition-colors flex items-center gap-1.5 font-medium text-xs shadow-md`}
                                >
                                    {isPlaying ? (
                                        <>
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                            Stop Preview
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Preview Clip
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="audio/*"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        {clip && (
                            <div className="p-4 bg-gray-700/50 rounded-lg">
                                <div className="text-sm text-gray-300 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                                        </svg>
                                        <span className="font-semibold">Current File:</span>
                                        <span className="text-white">{clip.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                        </svg>
                                        <span>Duration: {Math.floor(clip.duration / 60)}:{Math.floor(clip.duration % 60).toString().padStart(2, '0')}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        {error && (
                            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200">
                                {error}
                            </div>
                        )}
                        </div>
                    )}

                    {/* Library Tab - Mixing Workspace */}
                    {activeTab === 'library' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-white">Mixing Workspace Library</h3>
                                <div className="text-sm text-gray-400">
                                    {libraryClips.length} clip{libraryClips.length !== 1 ? 's' : ''}
                                </div>
                            </div>

                            {/* Search and Sort Controls */}
                            {libraryClips.length > 0 && (
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search clips..."
                                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                                        />
                                    </div>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'duration')}
                                        className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500 text-sm"
                                    >
                                        <option value="date">Latest First</option>
                                        <option value="name">Name (A-Z)</option>
                                        <option value="duration">Duration (Longest)</option>
                                    </select>
                                </div>
                            )}

                            {/* Ingest File to Library - Drag and Drop Zone */}
                            <div
                                className={`p-6 rounded-lg border-2 border-dashed transition-all ${
                                    isDragging
                                        ? 'bg-blue-600/30 border-blue-400 scale-[1.02]'
                                        : 'bg-blue-900/20 border-blue-700/50 hover:border-blue-600/70 hover:bg-blue-900/30'
                                }`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, true)}
                            >
                                <h4 className="font-semibold text-blue-300 mb-2 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    Add to Workspace
                                </h4>
                                <p className="text-sm text-gray-400 mb-3">
                                    {isDragging ? 'Drop file here to add to library' : 'Drag & drop audio files or click to browse'}
                                </p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="audio/*"
                                    onChange={(e) => handleFileSelect(e, true)}
                                    className="hidden"
                                    multiple={false}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isLoading}
                                    className="w-full px-2.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-md transition-colors flex items-center justify-center gap-1.5 font-medium text-sm shadow-md"
                                >
                                    {isLoading ? (
                                        <>
                                            <SpinnerIcon className="w-4 h-4" />
                                            Adding to Workspace...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            Browse Files
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Library Clips */}
                            {libraryClips.length === 0 ? (
                                <div className="p-8 text-center bg-gray-700/30 rounded-lg border-2 border-dashed border-gray-600">
                                    <svg className="w-16 h-16 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    <p className="text-gray-400 text-sm">
                                        No clips in library yet. Add files or record audio to build your mixing workspace.
                                    </p>
                                </div>
                            ) : filteredAndSortedClips.length === 0 ? (
                                <div className="p-6 text-center bg-gray-700/30 rounded-lg border border-gray-600">
                                    <p className="text-gray-400 text-sm">
                                        No clips match "{searchQuery}". Try a different search.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                                    {filteredAndSortedClips.map((libraryClip) => {
                                        const fileExtension = libraryClip.name.split('.').pop()?.toUpperCase() || 'AUDIO';
                                        return (
                                        <div
                                            key={libraryClip.id}
                                            className={`p-3 rounded-lg border transition-all ${
                                                clip && clip.id === libraryClip.id
                                                    ? 'bg-green-900/30 border-green-600/50'
                                                    : 'bg-gray-700/50 border-gray-600/50 hover:border-blue-500/50'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-600/80 text-white rounded font-bold flex-shrink-0">
                                                            {fileExtension}
                                                        </span>
                                                        <span className="font-medium text-white truncate">
                                                            {libraryClip.name}
                                                        </span>
                                                        {clip && clip.id === libraryClip.id && (
                                                            <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded-full flex-shrink-0 animate-pulse">
                                                                ACTIVE
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-400 flex items-center gap-3 flex-wrap">
                                                        <span className="flex items-center gap-1">
                                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                                            </svg>
                                                            {Math.floor(libraryClip.duration / 60)}:{Math.floor(libraryClip.duration % 60).toString().padStart(2, '0')}
                                                        </span>
                                                        {libraryClip.size && (
                                                            <span className="flex items-center gap-1">
                                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                                                </svg>
                                                                {libraryClip.size < 1024 * 1024
                                                                    ? `${(libraryClip.size / 1024).toFixed(1)} KB`
                                                                    : `${(libraryClip.size / (1024 * 1024)).toFixed(1)} MB`
                                                                }
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                                    {!(clip && clip.id === libraryClip.id) && (
                                                        <button
                                                            onClick={() => handleLoadFromLibrary(libraryClip.id)}
                                                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors whitespace-nowrap font-medium shadow-sm"
                                                        >
                                                            Use
                                                        </button>
                                                    )}
                                                    {/* Export dropdown */}
                                                    <div className="relative group">
                                                        <button
                                                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded transition-colors"
                                                            title="Export/Convert"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                            </svg>
                                                        </button>
                                                        <div className="hidden group-hover:block absolute right-0 bottom-full mb-1 w-32 bg-gray-900 border border-gray-700 rounded-md shadow-lg z-10">
                                                            <button
                                                                onClick={() => handleExportClip(libraryClip.id, 'wav')}
                                                                className="w-full px-2.5 py-1.5 text-left text-xs font-medium text-white hover:bg-gray-700 transition-colors rounded-t-md"
                                                            >
                                                                Export as WAV
                                                            </button>
                                                            <button
                                                                onClick={() => handleExportClip(libraryClip.id, 'ogg')}
                                                                className="w-full px-2.5 py-1.5 text-left text-xs font-medium text-white hover:bg-gray-700 transition-colors border-t border-gray-700"
                                                            >
                                                                Export as OGG
                                                            </button>
                                                            <button
                                                                onClick={() => handleExportClip(libraryClip.id, 'mp3')}
                                                                className="w-full px-2.5 py-1.5 text-left text-xs font-medium text-white hover:bg-gray-700 transition-colors border-t border-gray-700 rounded-b-md"
                                                            >
                                                                Export as MP3
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm(`Delete "${libraryClip.name}" from library?`)) {
                                                                handleDeleteFromLibrary(libraryClip.id);
                                                            }
                                                        }}
                                                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"
                                                        title="Delete"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Filesystem Tab - HD + Cache Storage */}
                    {activeTab === 'filesystem' && (
                        <div className="space-y-4">
                            <div className="p-3 bg-purple-900/20 border border-purple-700/50 rounded-lg text-sm text-purple-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <strong>Two-Tier Client Storage:</strong>
                                </div>
                                <ul className="text-xs space-y-1 ml-7">
                                    <li>• <strong className="text-purple-300">Tier 1:</strong> Browser Cache (fastest access)</li>
                                    <li>• <strong className="text-purple-300">Tier 2:</strong> Your Hard Drive (persistent storage)</li>
                                    <li>• All processing on <strong className="text-purple-300">YOUR processor</strong> - fully local!</li>
                                </ul>
                            </div>

                            {serverAvailable === false ? (
                                <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg text-center">
                                    <svg className="w-12 h-12 mx-auto text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <h3 className="text-lg font-semibold text-red-200 mb-2">Node.js Server Required</h3>
                                    <p className="text-sm text-red-300 mb-4">
                                        Filesystem storage requires the local Node.js server to access your hard drive.
                                    </p>
                                    <code className="px-3 py-2 bg-gray-900 rounded text-green-400 inline-block mb-4">
                                        npm run audio-server
                                    </code>
                                    <p className="text-xs text-red-400">
                                        Start the server in a separate terminal to enable HD storage.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-white">Your Background Audio Files</h3>
                                        <div className="text-xs text-gray-400">
                                            Storage: Cache + HD
                                        </div>
                                    </div>

                                    <div className="p-8 text-center bg-gray-700/30 rounded-lg border-2 border-dashed border-gray-600">
                                        <svg className="w-16 h-16 mx-auto text-purple-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                                        </svg>
                                        <p className="text-gray-300 font-semibold mb-2">
                                            Filesystem Storage Active
                                        </p>
                                        <p className="text-sm text-gray-400 mb-4">
                                            Files are stored on your hard drive with browser cache for fast access.
                                        </p>
                                        <div className="text-xs text-gray-500">
                                            Default location: <code className="px-2 py-0.5 bg-gray-800 rounded">./recordings/background-audio/</code>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
                                            <div className="flex items-center gap-2 mb-1">
                                                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                                </svg>
                                                <span className="text-xs font-semibold text-green-200">Cache Status</span>
                                            </div>
                                            <div className="text-lg font-bold text-green-300">Active</div>
                                            <div className="text-[10px] text-green-400">Fast tier ready</div>
                                        </div>
                                        <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                                            <div className="flex items-center gap-2 mb-1">
                                                <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                </svg>
                                                <span className="text-xs font-semibold text-blue-200">HD Status</span>
                                            </div>
                                            <div className="text-lg font-bold text-blue-300">Connected</div>
                                            <div className="text-[10px] text-blue-400">Persistent storage</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Record Audio Tab - Create New */}
                    {activeTab === 'record' && audioContext && (
                        <div className="space-y-4">
                            <div className="p-3 bg-green-900/20 border border-green-700/50 rounded-lg text-sm text-green-200">
                                <strong>Create & Save:</strong> Recordings are automatically saved to your mixing workspace library.
                            </div>
                            <h3 className="text-lg font-semibold text-white">Record from Microphone</h3>
                            <BackgroundAudioRecorder
                                onRecordingComplete={handleRecordingComplete}
                                maxDuration={600}
                            />
                        </div>
                    )}

                    {/* Waveform and Clip Selection */}
                    {clip && waveformData.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-white">Clip Selection</h3>
                            <WaveformViewer
                                waveformData={waveformData}
                                duration={clip.duration}
                                startTime={clip.startTime}
                                endTime={clip.endTime}
                                onStartTimeChange={(time) => handleClipUpdate({ startTime: time })}
                                onEndTimeChange={(time) => handleClipUpdate({ endTime: time })}
                                height={120}
                            />
                        </div>
                    )}

                    {/* Volume Control - Enhanced */}
                    {clip && (
                        <div className="space-y-3 p-4 bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-700/30 rounded-lg">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                                    </svg>
                                    <h3 className="text-lg font-semibold text-white">Volume</h3>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-xs text-gray-400">Level:</div>
                                    <span className="px-3 py-1 bg-purple-600/30 border border-purple-500/50 rounded-md text-purple-300 font-mono font-bold text-sm min-w-[60px] text-center">
                                        {Math.round(clip.volume * 100)}%
                                    </span>
                                </div>
                            </div>
                            <div className="relative">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={clip.volume * 100}
                                    onChange={(e) => handleClipUpdate({ volume: parseInt(e.target.value) / 100 })}
                                    className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 transition-all"
                                    style={{
                                        background: `linear-gradient(to right, rgb(168, 85, 247) 0%, rgb(168, 85, 247) ${clip.volume * 100}%, rgb(55, 65, 81) ${clip.volume * 100}%, rgb(55, 65, 81) 100%)`
                                    }}
                                />
                                <div className="flex justify-between text-[10px] text-gray-500 mt-1 px-1">
                                    <span>0%</span>
                                    <span>25%</span>
                                    <span>50%</span>
                                    <span>75%</span>
                                    <span>100%</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Fade In/Out - Enhanced */}
                    {clip && (
                        <div className="p-4 bg-gradient-to-br from-green-900/20 to-cyan-900/20 border border-green-700/30 rounded-lg">
                            <div className="flex items-center gap-2 mb-4">
                                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                </svg>
                                <h3 className="text-lg font-semibold text-white">Fade Controls</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-1.5">
                                            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                            </svg>
                                            <label className="text-sm font-semibold text-green-300">Fade In</label>
                                        </div>
                                        <span className="px-2 py-0.5 bg-green-600/30 border border-green-500/50 rounded text-green-300 font-mono text-xs font-bold min-w-[45px] text-center">
                                            {clip.fadeIn.toFixed(1)}s
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="10"
                                        step="0.1"
                                        value={clip.fadeIn}
                                        onChange={(e) => handleClipUpdate({ fadeIn: parseFloat(e.target.value) })}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500 hover:accent-green-400 transition-all"
                                        style={{
                                            background: `linear-gradient(to right, rgb(34, 197, 94) 0%, rgb(34, 197, 94) ${(clip.fadeIn / 10) * 100}%, rgb(55, 65, 81) ${(clip.fadeIn / 10) * 100}%, rgb(55, 65, 81) 100%)`
                                        }}
                                    />
                                    <div className="flex justify-between text-[9px] text-gray-500 px-0.5">
                                        <span>0s</span>
                                        <span>5s</span>
                                        <span>10s</span>
                                    </div>
                                </div>
                                <div className="space-y-2 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-1.5">
                                            <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                            </svg>
                                            <label className="text-sm font-semibold text-cyan-300">Fade Out</label>
                                        </div>
                                        <span className="px-2 py-0.5 bg-cyan-600/30 border border-cyan-500/50 rounded text-cyan-300 font-mono text-xs font-bold min-w-[45px] text-center">
                                            {clip.fadeOut.toFixed(1)}s
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="10"
                                        step="0.1"
                                        value={clip.fadeOut}
                                        onChange={(e) => handleClipUpdate({ fadeOut: parseFloat(e.target.value) })}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-all"
                                        style={{
                                            background: `linear-gradient(to right, rgb(6, 182, 212) 0%, rgb(6, 182, 212) ${(clip.fadeOut / 10) * 100}%, rgb(55, 65, 81) ${(clip.fadeOut / 10) * 100}%, rgb(55, 65, 81) 100%)`
                                        }}
                                    />
                                    <div className="flex justify-between text-[9px] text-gray-500 px-0.5">
                                        <span>0s</span>
                                        <span>5s</span>
                                        <span>10s</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Playback Options */}
                    {clip && (
                        <div className="space-y-4 p-4 bg-gray-700/50 rounded-lg">
                            <h3 className="text-lg font-semibold text-white">Playback Options</h3>

                            {/* Match Length */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.matchLength}
                                    onChange={(e) => onSettingsChange({ ...settings, matchLength: e.target.checked })}
                                    className="w-5 h-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                />
                                <div>
                                    <span className="text-white font-medium">Match Audiobook Length</span>
                                    <p className="text-sm text-gray-400">Repeat background audio to match the full audiobook duration</p>
                                </div>
                            </label>

                            {/* Repeat */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.repeat}
                                    onChange={(e) => onSettingsChange({ ...settings, repeat: e.target.checked })}
                                    className="w-5 h-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                />
                                <div>
                                    <span className="text-white font-medium">Loop/Repeat</span>
                                    <p className="text-sm text-gray-400">Continuously loop the background audio</p>
                                </div>
                            </label>

                            {/* Crossfade */}
                            {(settings.repeat || settings.matchLength) && (
                                <>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.crossfade}
                                            onChange={(e) => onSettingsChange({ ...settings, crossfade: e.target.checked })}
                                            className="w-5 h-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                        />
                                        <div>
                                            <span className="text-white font-medium">Crossfade Loops</span>
                                            <p className="text-sm text-gray-400">Smoothly blend loop transitions</p>
                                        </div>
                                    </label>

                                    {settings.crossfade && (
                                        <div className="ml-8 space-y-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-sm font-medium text-gray-300">Crossfade Duration</label>
                                                <span className="text-blue-400 font-mono text-sm">{settings.crossfadeDuration.toFixed(1)}s</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0.5"
                                                max="10"
                                                step="0.5"
                                                value={settings.crossfadeDuration}
                                                onChange={(e) => onSettingsChange({ ...settings, crossfadeDuration: parseFloat(e.target.value) })}
                                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

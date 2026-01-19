import React, { useState, useRef, useEffect } from 'react';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { RecordingOscilloscope } from './RecordingOscilloscope';

interface BackgroundAudioRecorderProps {
    onRecordingComplete: (audioBuffer: AudioBuffer, name: string, format: 'wav' | 'ogg') => void;
    maxDuration?: number; // in seconds
}

interface MediaDeviceInfo {
    deviceId: string;
    label: string;
    kind: string;
}

export const BackgroundAudioRecorder: React.FC<BackgroundAudioRecorderProps> = ({
    onRecordingComplete,
    maxDuration = 600, // 10 minutes default for background audio
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioURL, setAudioURL] = useState<string | null>(null);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState(false);
    const [hasRecording, setHasRecording] = useState(false);
    const [recordingName, setRecordingName] = useState<string>('');
    const [recordingFormat, setRecordingFormat] = useState<'wav' | 'ogg'>('ogg');
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [alwaysSave, setAlwaysSave] = useState(() => {
        return localStorage.getItem('backgroundAudio_alwaysSave') === 'true';
    });

    // Device selection state
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
    const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
    const [includeVideo, setIncludeVideo] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'requesting' | 'granted' | 'denied'>('unknown');

    // Audio level visualization and quality metrics
    const [audioLevel, setAudioLevel] = useState(0);
    const [audioQualityMetrics, setAudioQualityMetrics] = useState({
        currentLevel: 0,
        peakLevel: 0,
        isClipping: false,
        noiseLevel: 0,
        snr: 0,
        qualityRating: 'unknown' as 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'
    });
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const noiseFloorSamplesRef = useRef<number[]>([]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        // Enumerate devices on mount
        enumerateDevices();

        return () => {
            // Cleanup
            cleanup();
        };
    }, []);

    useEffect(() => {
        return () => {
            if (audioURL) {
                URL.revokeObjectURL(audioURL);
            }
        };
    }, [audioURL]);

    const cleanup = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
    };

    const enumerateDevices = async () => {
        try {
            // Request permission first to get device labels
            const tempStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: includeVideo
            });

            // Stop the temporary stream
            tempStream.getTracks().forEach(track => track.stop());

            // Now enumerate devices with labels
            const devices = await navigator.mediaDevices.enumerateDevices();

            const audioInputs = devices
                .filter(device => device.kind === 'audioinput')
                .map(device => ({
                    deviceId: device.deviceId,
                    label: device.label || `Microphone ${device.deviceId.substring(0, 5)}`,
                    kind: device.kind
                }));

            const videoInputs = devices
                .filter(device => device.kind === 'videoinput')
                .map(device => ({
                    deviceId: device.deviceId,
                    label: device.label || `Camera ${device.deviceId.substring(0, 5)}`,
                    kind: device.kind
                }));

            setAudioDevices(audioInputs);
            setVideoDevices(videoInputs);

            // Set default devices
            if (audioInputs.length > 0 && !selectedAudioDevice) {
                setSelectedAudioDevice(audioInputs[0].deviceId);
            }
            if (videoInputs.length > 0 && !selectedVideoDevice) {
                setSelectedVideoDevice(videoInputs[0].deviceId);
            }

            setPermissionStatus('granted');
        } catch (err) {
            console.error('Error enumerating devices:', err);
            setPermissionStatus('denied');
            setError('Failed to access media devices. Please grant microphone permission in your browser settings.');
        }
    };

    const requestPermissions = async () => {
        setPermissionStatus('requesting');
        setError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: includeVideo
            });

            // Stop the stream immediately, we just needed permission
            stream.getTracks().forEach(track => track.stop());

            // Now enumerate devices
            await enumerateDevices();
        } catch (err) {
            console.error('Permission denied:', err);
            setPermissionStatus('denied');
            setError('Microphone access denied. Please allow access in your browser settings and try again.');
        }
    };

    const visualizeAudioLevel = (stream: MediaStream) => {
        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext();
        }

        const audioContext = audioContextRef.current;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();

        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyserRef.current = analyser;

        const frequencyDataArray = new Uint8Array(analyser.frequencyBinCount);
        const timeDomainDataArray = new Uint8Array(analyser.fftSize);
        let peakLevel = 0;
        let frameCount = 0;

        const updateQualityMetrics = () => {
            if (!analyserRef.current) return;

            analyser.getByteFrequencyData(frequencyDataArray);
            analyser.getByteTimeDomainData(timeDomainDataArray);

            // Calculate RMS (Root Mean Square) for accurate level
            let sumSquares = 0;
            let peak = 0;
            for (let i = 0; i < timeDomainDataArray.length; i++) {
                const normalized = (timeDomainDataArray[i] - 128) / 128;
                sumSquares += normalized * normalized;
                peak = Math.max(peak, Math.abs(normalized));
            }
            const rms = Math.sqrt(sumSquares / timeDomainDataArray.length);
            const currentLevel = rms * 100;

            // Track peak level
            peakLevel = Math.max(peakLevel, peak * 100);

            // Detect clipping (peak close to 1.0)
            const isClipping = peak > 0.95;

            // Sample noise floor during first 30 frames (about 0.5 seconds)
            if (frameCount < 30) {
                noiseFloorSamplesRef.current.push(rms);
                frameCount++;
            }

            // Calculate noise floor and SNR
            let noiseFloor = 0;
            let snr = 0;
            let qualityRating: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' = 'unknown';

            if (noiseFloorSamplesRef.current.length > 0) {
                noiseFloor = Math.min(...noiseFloorSamplesRef.current) * 100;

                // Signal-to-Noise Ratio (in dB approximation)
                if (noiseFloor > 0.01) {
                    snr = 20 * Math.log10(Math.max(rms, 0.001) / Math.max(noiseFloor / 100, 0.001));
                    snr = Math.max(0, Math.min(60, snr)); // Clamp between 0-60 dB
                }

                // Quality rating based on SNR and clipping
                if (isClipping) {
                    qualityRating = 'poor';
                } else if (snr > 35 && currentLevel > 5 && currentLevel < 70) {
                    qualityRating = 'excellent';
                } else if (snr > 25 && currentLevel > 3) {
                    qualityRating = 'good';
                } else if (snr > 15) {
                    qualityRating = 'fair';
                } else {
                    qualityRating = 'poor';
                }
            }

            // Update state
            setAudioQualityMetrics({
                currentLevel,
                peakLevel,
                isClipping,
                noiseLevel: noiseFloor,
                snr,
                qualityRating
            });

            // Simple audio level for existing meter
            const average = frequencyDataArray.reduce((a, b) => a + b) / frequencyDataArray.length;
            const normalized = Math.min(100, (average / 255) * 100);
            setAudioLevel(normalized);

            if (isRecording) {
                animationFrameRef.current = requestAnimationFrame(updateQualityMetrics);
            }
        };

        updateQualityMetrics();
    };

    const startRecording = async () => {
        try {
            setIsInitializing(true);
            setError(null);

            // Build constraints with selected devices
            const constraints: MediaStreamConstraints = {
                audio: selectedAudioDevice
                    ? {
                        deviceId: { exact: selectedAudioDevice },
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                    }
                    : {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                    }
            };

            if (includeVideo && selectedVideoDevice) {
                constraints.video = {
                    deviceId: { exact: selectedVideoDevice },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                };
            }

            // Request media stream
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            // Start audio level visualization
            visualizeAudioLevel(stream);

            // Create MediaRecorder with appropriate mime type
            const mimeType = includeVideo
                ? (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4')
                : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4');

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });

                // Convert blob to AudioBuffer (extract audio if video)
                try {
                    if (!audioContextRef.current) {
                        audioContextRef.current = new AudioContext();
                    }
                    const arrayBuffer = await blob.arrayBuffer();
                    const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

                    setAudioBuffer(buffer);

                    // Create preview URL
                    const url = URL.createObjectURL(blob);
                    setAudioURL(url);
                    setHasRecording(true);
                } catch (err) {
                    console.error('Error decoding audio:', err);
                    setError('Failed to decode recorded audio. This may happen with video recordings - audio will still be saved.');

                    // Still allow preview even if decoding failed
                    const url = URL.createObjectURL(blob);
                    setAudioURL(url);
                    setHasRecording(true);
                }

                // Stop all tracks
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                }

                // Stop level visualization
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
                setAudioLevel(0);
            };

            mediaRecorder.start(100); // Collect data every 100ms
            setIsRecording(true);
            setIsInitializing(false);
            setRecordingTime(0);

            // Start timer
            timerRef.current = window.setInterval(() => {
                setRecordingTime((prev) => {
                    const newTime = prev + 1;
                    if (newTime >= maxDuration) {
                        stopRecording();
                        return newTime;
                    }
                    return newTime;
                });
            }, 1000);

        } catch (err) {
            console.error('Error accessing media devices:', err);
            let errorMessage = 'Could not access microphone. ';

            if (err instanceof Error) {
                if (err.name === 'NotAllowedError') {
                    errorMessage += 'Permission denied. Please allow access in your browser settings.';
                } else if (err.name === 'NotFoundError') {
                    errorMessage += 'No microphone found. Please connect a microphone and try again.';
                } else if (err.name === 'NotReadableError') {
                    errorMessage += 'Microphone is already in use by another application.';
                } else {
                    errorMessage += err.message;
                }
            } else {
                errorMessage += 'Please check permissions and try again.';
            }

            setError(errorMessage);
            setIsInitializing(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsPaused(false);

            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }

            // Reset quality metrics
            noiseFloorSamplesRef.current = [];
            setAudioQualityMetrics({
                currentLevel: 0,
                peakLevel: 0,
                isClipping: false,
                noiseLevel: 0,
                snr: 0,
                qualityRating: 'unknown'
            });

            // Show save dialog if "always save" is not enabled
            if (!alwaysSave) {
                setShowSaveDialog(true);
            }
        }
    };

    const pauseRecording = () => {
        if (mediaRecorderRef.current && isRecording && !isPaused) {
            mediaRecorderRef.current.pause();
            setIsPaused(true);

            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    };

    const resumeRecording = () => {
        if (mediaRecorderRef.current && isRecording && isPaused) {
            mediaRecorderRef.current.resume();
            setIsPaused(false);

            // Resume timer
            timerRef.current = window.setInterval(() => {
                setRecordingTime((prev) => {
                    const newTime = prev + 1;
                    if (newTime >= maxDuration) {
                        stopRecording();
                        return newTime;
                    }
                    return newTime;
                });
            }, 1000);
        }
    };

    const resetRecording = () => {
        if (audioURL) {
            URL.revokeObjectURL(audioURL);
        }
        setAudioURL(null);
        setAudioBuffer(null);
        setRecordingTime(0);
        setHasRecording(false);
        setRecordingName('');
        chunksRef.current = [];
    };

    const saveRecording = () => {
        if (!audioBuffer) {
            setError('No recording available to save.');
            return;
        }

        const name = recordingName.trim() || `Recording ${new Date().toLocaleString()}`;

        // Save "always save" preference if it was changed
        localStorage.setItem('backgroundAudio_alwaysSave', alwaysSave.toString());

        onRecordingComplete(audioBuffer, name, recordingFormat);
        setShowSaveDialog(false);
        resetRecording();
    };

    const handleSaveDialogDiscard = () => {
        setShowSaveDialog(false);
        resetRecording();
    };

    const handleAlwaysSaveChange = (checked: boolean) => {
        setAlwaysSave(checked);
        localStorage.setItem('backgroundAudio_alwaysSave', checked.toString());
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getLevelColor = (level: number): string => {
        if (level < 30) return 'bg-green-500';
        if (level < 70) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    // Permission request UI
    if (permissionStatus === 'unknown' || permissionStatus === 'denied') {
        return (
            <div className="space-y-4">
                <div className="p-6 bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-600 text-center space-y-4">
                    <div className="flex justify-center">
                        <svg className="w-16 h-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-2">Microphone Access Required</h3>
                        <p className="text-sm text-gray-400 mb-4">
                            This app needs access to your microphone{includeVideo ? ' and camera' : ''} to record audio.
                        </p>
                        {permissionStatus === 'denied' && (
                            <div className="p-3 bg-red-900/30 border border-red-700/50 rounded text-red-200 text-sm mb-4">
                                <strong>Permission Denied:</strong> Please enable microphone access in your browser settings and refresh the page.
                            </div>
                        )}
                    </div>
                    <button
                        onClick={requestPermissions}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors font-semibold flex items-center gap-2 mx-auto"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        Grant Access
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Device Selection */}
            {!isRecording && !hasRecording && (
                <div className="space-y-4">
                    {/* Audio Device Selection */}
                    {audioDevices.length > 0 && (
                        <div className="p-4 bg-gray-700/50 rounded-lg space-y-3">
                            <label className="block text-sm font-semibold text-gray-300">
                                Microphone:
                            </label>
                            <select
                                value={selectedAudioDevice}
                                onChange={(e) => setSelectedAudioDevice(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                            >
                                {audioDevices.map(device => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                        {device.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Video Option */}
                    <div className="p-4 bg-gray-700/50 rounded-lg space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={includeVideo}
                                onChange={(e) => {
                                    setIncludeVideo(e.target.checked);
                                    if (e.target.checked && videoDevices.length === 0) {
                                        enumerateDevices();
                                    }
                                }}
                                className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-semibold text-gray-300">Include Video (webcam)</span>
                        </label>
                        <p className="text-xs text-gray-500">
                            Optional: Record video along with audio. Only audio will be used for mixing.
                        </p>
                    </div>

                    {/* Video Device Selection */}
                    {includeVideo && videoDevices.length > 0 && (
                        <div className="p-4 bg-gray-700/50 rounded-lg space-y-3">
                            <label className="block text-sm font-semibold text-gray-300">
                                Camera:
                            </label>
                            <select
                                value={selectedVideoDevice}
                                onChange={(e) => setSelectedVideoDevice(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                            >
                                {videoDevices.map(device => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                        {device.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Format Selection */}
                    <div className="p-4 bg-gray-700/50 rounded-lg space-y-3">
                        <label className="block text-sm font-semibold text-gray-300">
                            Recording Format:
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setRecordingFormat('ogg')}
                                className={`p-3 rounded-lg border-2 transition-all ${
                                    recordingFormat === 'ogg'
                                        ? 'border-blue-500 bg-blue-600/30 text-white'
                                        : 'border-gray-600 bg-gray-700/30 text-gray-300 hover:border-gray-500'
                                }`}
                            >
                                <div className="font-semibold">OGG</div>
                                <div className="text-xs opacity-75">Smaller size (Recommended)</div>
                            </button>
                            <button
                                onClick={() => setRecordingFormat('wav')}
                                className={`p-3 rounded-lg border-2 transition-all ${
                                    recordingFormat === 'wav'
                                        ? 'border-blue-500 bg-blue-600/30 text-white'
                                        : 'border-gray-600 bg-gray-700/30 text-gray-300 hover:border-gray-500'
                                }`}
                            >
                                <div className="font-semibold">WAV</div>
                                <div className="text-xs opacity-75">Uncompressed</div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Recording Status */}
            <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                    {isRecording && !isPaused && (
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    )}
                    {isPaused && (
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    )}
                    {!isRecording && hasRecording && (
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    )}
                    <div>
                        <div className="text-white font-semibold">
                            {isRecording && !isPaused && 'Recording...'}
                            {isPaused && 'Paused'}
                            {!isRecording && hasRecording && 'Recording Complete'}
                            {!isRecording && !hasRecording && 'Ready to Record'}
                        </div>
                        <div className="text-sm text-gray-400">
                            Duration: {formatTime(recordingTime)} / {formatTime(maxDuration)}
                        </div>
                    </div>
                </div>

                {/* Timer Display */}
                <div className="text-3xl font-mono text-blue-400">
                    {formatTime(recordingTime)}
                </div>
            </div>

            {/* Audio Level Meter */}
            {isRecording && (
                <div className="p-4 bg-gray-700/50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-300 font-semibold">Audio Level:</span>
                        <span className="text-gray-400">{Math.round(audioLevel)}%</span>
                    </div>
                    <div className="h-6 bg-gray-800 rounded-full overflow-hidden border border-gray-600">
                        <div
                            className={`h-full transition-all duration-100 ${getLevelColor(audioLevel)}`}
                            style={{ width: `${audioLevel}%` }}
                        />
                    </div>
                    <div className="text-xs text-gray-500">
                        <span className="text-green-400">●</span> Good &nbsp;
                        <span className="text-yellow-400">●</span> Loud &nbsp;
                        <span className="text-red-400">●</span> Clipping
                    </div>
                </div>
            )}

            {/* Quality Metrics Panel */}
            {isRecording && audioQualityMetrics.qualityRating !== 'unknown' && (
                <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg space-y-3">
                    {/* Quality Rating Badge */}
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-300">Audio Quality:</span>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                            audioQualityMetrics.qualityRating === 'excellent' ? 'bg-green-500/20 text-green-400 border border-green-500/50' :
                            audioQualityMetrics.qualityRating === 'good' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' :
                            audioQualityMetrics.qualityRating === 'fair' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' :
                            'bg-red-500/20 text-red-400 border border-red-500/50'
                        }`}>
                            {audioQualityMetrics.qualityRating}
                        </div>
                    </div>

                    {/* Real-time Oscilloscope */}
                    <RecordingOscilloscope
                        analyserNode={analyserRef.current}
                        isRecording={isRecording}
                        height={120}
                        showStats={true}
                    />

                    {/* Input Level Meter */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Input Level</span>
                            <span className="text-gray-300 font-mono">{audioQualityMetrics.currentLevel.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-gray-900 rounded-full overflow-hidden border border-gray-700">
                            <div
                                className={`h-full transition-all duration-100 ${
                                    audioQualityMetrics.currentLevel < 3 ? 'bg-red-500' :
                                    audioQualityMetrics.currentLevel < 70 ? 'bg-green-500' :
                                    audioQualityMetrics.currentLevel < 85 ? 'bg-yellow-500' :
                                    'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(100, audioQualityMetrics.currentLevel)}%` }}
                            />
                        </div>
                    </div>

                    {/* Detailed Metrics */}
                    <div className="grid grid-cols-3 gap-3 text-xs">
                        <div className="p-2 bg-gray-900/50 rounded border border-gray-700">
                            <div className="text-gray-400 mb-1">Peak</div>
                            <div className="text-white font-mono font-semibold">{audioQualityMetrics.peakLevel.toFixed(1)}%</div>
                        </div>
                        <div className="p-2 bg-gray-900/50 rounded border border-gray-700">
                            <div className="text-gray-400 mb-1">SNR</div>
                            <div className="text-white font-mono font-semibold">{audioQualityMetrics.snr.toFixed(0)} dB</div>
                        </div>
                        <div className="p-2 bg-gray-900/50 rounded border border-gray-700">
                            <div className="text-gray-400 mb-1">Noise</div>
                            <div className="text-white font-mono font-semibold">{audioQualityMetrics.noiseLevel.toFixed(1)}%</div>
                        </div>
                    </div>

                    {/* Quality Warnings */}
                    {audioQualityMetrics.isClipping && (
                        <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg flex items-start gap-2">
                            <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div className="text-xs text-red-200">
                                <strong>Clipping detected!</strong> Audio is too loud. Move microphone further away or reduce input gain.
                            </div>
                        </div>
                    )}

                    {audioQualityMetrics.snr < 20 && !audioQualityMetrics.isClipping && (
                        <div className="p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg flex items-start gap-2">
                            <svg className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div className="text-xs text-yellow-200">
                                <strong>High noise level.</strong> Try recording in a quieter environment or move closer to the microphone.
                            </div>
                        </div>
                    )}

                    {audioQualityMetrics.currentLevel < 3 && !audioQualityMetrics.isClipping && (
                        <div className="p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg flex items-start gap-2">
                            <svg className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div className="text-xs text-yellow-200">
                                <strong>Low input level.</strong> Move closer to the microphone or increase input gain.
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200">
                    {error}
                </div>
            )}

            {/* Recording Controls */}
            <div className="flex gap-2">
                {!isRecording && !hasRecording && (
                    <button
                        onClick={startRecording}
                        disabled={isInitializing}
                        className="flex-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-md transition-colors flex items-center justify-center gap-1.5 font-medium text-xs shadow-md"
                    >
                        {isInitializing ? (
                            <>
                                <SpinnerIcon className="w-3.5 h-3.5" />
                                Initializing...
                            </>
                        ) : (
                            <>
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                </svg>
                                Start Recording
                            </>
                        )}
                    </button>
                )}

                {isRecording && !isPaused && (
                    <>
                        <button
                            onClick={pauseRecording}
                            className="flex-1 px-2.5 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md transition-colors flex items-center justify-center gap-1.5 font-medium text-xs shadow-md"
                        >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Pause
                        </button>
                        <button
                            onClick={stopRecording}
                            className="flex-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center justify-center gap-1.5 font-medium text-xs shadow-md"
                        >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                            </svg>
                            Stop
                        </button>
                    </>
                )}

                {isRecording && isPaused && (
                    <>
                        <button
                            onClick={resumeRecording}
                            className="flex-1 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors flex items-center justify-center gap-1.5 font-medium text-xs shadow-md"
                        >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                            Resume
                        </button>
                        <button
                            onClick={stopRecording}
                            className="flex-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center justify-center gap-1.5 font-medium text-xs shadow-md"
                        >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                            </svg>
                            Stop
                        </button>
                    </>
                )}
            </div>

            {/* Save Dialog Modal */}
            {showSaveDialog && audioURL && hasRecording && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={handleSaveDialogDiscard}>
                    <div className="bg-gray-800 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-700" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Save Recording?
                            </h3>
                            <button onClick={handleSaveDialogDiscard} className="text-gray-400 hover:text-white transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="p-3 bg-gray-700/50 rounded-lg">
                                <div className="text-sm text-gray-300 font-semibold mb-2">Preview Recording:</div>
                                {includeVideo ? (
                                    <video src={audioURL} controls className="w-full rounded" />
                                ) : (
                                    <audio src={audioURL} controls className="w-full" />
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-300">
                                    Recording Name:
                                </label>
                                <input
                                    type="text"
                                    value={recordingName}
                                    onChange={(e) => setRecordingName(e.target.value)}
                                    placeholder={`Recording ${new Date().toLocaleString()}`}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    autoFocus
                                />
                            </div>

                            <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={alwaysSave}
                                        onChange={(e) => handleAlwaysSaveChange(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                                    />
                                    <div className="flex-1">
                                        <div className="text-sm font-semibold text-blue-200 group-hover:text-blue-100 transition-colors">
                                            Always save recordings automatically
                                        </div>
                                        <div className="text-xs text-blue-300/80 mt-1">
                                            When enabled, recordings will be saved immediately without showing this dialog.
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={handleSaveDialogDiscard}
                                className="flex-1 px-4 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors flex items-center justify-center gap-2 font-semibold text-sm shadow-md"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Discard
                            </button>
                            <button
                                onClick={saveRecording}
                                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors flex items-center justify-center gap-2 font-semibold text-sm shadow-lg"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Save to Library
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Audio/Video Playback and Name Input (shown when always save is on or dialog was dismissed) */}
            {audioURL && hasRecording && !showSaveDialog && (
                <div className="space-y-3">
                    <div className="p-4 bg-gray-700/50 rounded-lg space-y-2">
                        <div className="text-sm text-gray-300 font-semibold">Preview Recording:</div>
                        {includeVideo ? (
                            <video src={audioURL} controls className="w-full rounded" />
                        ) : (
                            <audio src={audioURL} controls className="w-full" />
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-300">
                            Recording Name:
                        </label>
                        <input
                            type="text"
                            value={recordingName}
                            onChange={(e) => setRecordingName(e.target.value)}
                            placeholder={`Recording ${new Date().toLocaleString()}`}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={saveRecording}
                            className="flex-1 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors flex items-center justify-center gap-1.5 font-medium text-xs shadow-md"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Save to Library
                        </button>
                        <button
                            onClick={resetRecording}
                            className="flex-1 px-2.5 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors flex items-center justify-center gap-1.5 font-medium text-xs shadow-md"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Record Again
                        </button>
                    </div>
                </div>
            )}

            {/* Recording Tips */}
            {!isRecording && !hasRecording && permissionStatus === 'granted' && (
                <div className="p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                    <div className="text-sm text-blue-200 space-y-1">
                        <div className="font-semibold mb-2 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            Recording Tips:
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>Select your preferred microphone from the dropdown above</li>
                            <li>Optional: Enable video to record both camera and audio</li>
                            <li>Watch the audio level meter to avoid clipping (red)</li>
                            <li>Keep microphone 6-12 inches from sound source</li>
                            <li>OGG format recommended for smaller file sizes</li>
                            <li>Recording will automatically stop at {formatTime(maxDuration)}</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

import React, { useState, useRef, useEffect } from 'react';
import { SpinnerIcon } from './icons/SpinnerIcon';
import * as audioConversionService from '../services/audioConversionService';
import { RecordingOscilloscope } from './RecordingOscilloscope';
import { AudioWaveformEditor } from './AudioWaveformEditor';

interface VoiceRecorderProps {
    onRecordingComplete: (audioBlob: Blob, duration: number) => void;
    maxDuration?: number; // in seconds
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
    onRecordingComplete,
    maxDuration = 300, // 5 minutes default
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioURL, setAudioURL] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState(false);
    const [hasRecording, setHasRecording] = useState(false);
    const [audioQualityMetrics, setAudioQualityMetrics] = useState({
        currentLevel: 0,
        peakLevel: 0,
        isClipping: false,
        noiseLevel: 0,
        snr: 0,
        qualityRating: 'unknown' as 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'
    });
    const [saveToLocal, setSaveToLocal] = useState(false);
    const [localDirectory, setLocalDirectory] = useState('');
    const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
    const [inputSource, setInputSource] = useState<'microphone' | 'camera'>('microphone');
    const [showVideoPreview, setShowVideoPreview] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [recordingFilename, setRecordingFilename] = useState<string>('');
    const [savedClips, setSavedClips] = useState<Array<{ blob: Blob; filename: string }>>([]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        checkServer();
    }, []);

    const checkServer = async () => {
        const available = await audioConversionService.checkServerStatus();
        setServerAvailable(available);

        if (available) {
            try {
                const dirInfo = await audioConversionService.getRecordingDirectory();
                setLocalDirectory(dirInfo.directory);
            } catch (err) {
                console.error('Failed to get recording directory:', err);
            }
        }
    };

    useEffect(() => {
        return () => {
            // Cleanup
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
            if (audioURL) {
                URL.revokeObjectURL(audioURL);
            }
        };
    }, [audioURL]);

    const startQualityMonitoring = (stream: MediaStream) => {
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

        const bufferLength = analyser.frequencyBinCount;
        const timeDataArray = new Uint8Array(bufferLength);

        let maxPeak = 0;
        const noiseFloorSamples: number[] = [];

        const updateQualityMetrics = () => {
            if (!analyserRef.current || !isRecording) return;

            // Get time domain data
            analyser.getByteTimeDomainData(timeDataArray);

            // Calculate RMS and peak
            let sum = 0;
            let peak = 0;
            for (let i = 0; i < timeDataArray.length; i++) {
                const normalized = (timeDataArray[i] - 128) / 128;
                sum += normalized * normalized;
                peak = Math.max(peak, Math.abs(normalized));
            }
            const rms = Math.sqrt(sum / timeDataArray.length);
            const currentLevel = rms * 100;

            // Track peak
            maxPeak = Math.max(maxPeak, peak);

            // Detect clipping (above 95% of max)
            const isClipping = peak > 0.95;

            // Estimate noise floor (average of low-level samples)
            if (currentLevel < 5) {
                noiseFloorSamples.push(currentLevel);
                if (noiseFloorSamples.length > 100) noiseFloorSamples.shift();
            }

            const noiseLevel = noiseFloorSamples.length > 0
                ? noiseFloorSamples.reduce((a, b) => a + b, 0) / noiseFloorSamples.length
                : 0;

            // Calculate SNR (simplified)
            const signalLevel = currentLevel > noiseLevel ? currentLevel : noiseLevel + 1;
            const snr = 20 * Math.log10(signalLevel / (noiseLevel + 0.1));

            // Quality rating
            let qualityRating: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
            if (!isClipping && snr > 30 && currentLevel > 10 && currentLevel < 80) {
                qualityRating = 'excellent';
            } else if (!isClipping && snr > 20 && currentLevel > 5) {
                qualityRating = 'good';
            } else if (snr > 10) {
                qualityRating = 'fair';
            }

            setAudioQualityMetrics({
                currentLevel,
                peakLevel: maxPeak * 100,
                isClipping,
                noiseLevel,
                snr,
                qualityRating
            });

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

            // Request microphone or camera access based on inputSource
            const constraints = inputSource === 'camera'
                ? {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        facingMode: 'user'
                    }
                }
                : {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            // Show video preview if using camera
            if (inputSource === 'camera' && videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                setShowVideoPreview(true);
            }

            // Create audio-only stream for recording (even if video is present for preview)
            const audioTracks = stream.getAudioTracks();
            const audioOnlyStream = new MediaStream(audioTracks);

            // Create MediaRecorder with audio-only stream
            const mimeType = MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : 'audio/mp4';

            const mediaRecorder = new MediaRecorder(audioOnlyStream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });
                const url = URL.createObjectURL(blob);
                const filename = generateTimestampFilename('voice', 'wav');

                setAudioURL(url);
                setAudioBlob(blob);
                setRecordingFilename(filename);
                setHasRecording(true);
                onRecordingComplete(blob, recordingTime);

                // Save to local filesystem if enabled and server available
                if (saveToLocal && serverAvailable) {
                    try {
                        const result = await audioConversionService.saveRecording(
                            blob,
                            {
                                directory: localDirectory || undefined,
                                filename: filename,
                                format: 'wav'
                            }
                        );
                        console.log('Saved to local:', result.path);
                        setError(`✓ Saved to ${result.path}`);
                    } catch (err) {
                        console.error('Failed to save locally:', err);
                        setError('Failed to save to local filesystem: ' + (err instanceof Error ? err.message : 'Unknown error'));
                    }
                }

                // Stop all tracks
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                }
            };

            mediaRecorder.start(100); // Collect data every 100ms

            // Start quality monitoring
            startQualityMonitoring(stream);

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
            console.error('Error accessing microphone:', err);
            setError('Could not access microphone. Please check permissions.');
            setIsInitializing(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsPaused(false);
            setShowVideoPreview(false);

            // Stop video preview
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }

            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
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
        setAudioBlob(null);
        setRecordingFilename('');
        setRecordingTime(0);
        setHasRecording(false);
        setSavedClips([]);
        chunksRef.current = [];
    };

    const handleSaveClip = async (clipBlob: Blob, filename: string) => {
        // Add to saved clips list
        setSavedClips(prev => [...prev, { blob: clipBlob, filename }]);

        // Save to local filesystem if enabled and server available
        if (saveToLocal && serverAvailable) {
            try {
                const result = await audioConversionService.saveRecording(
                    clipBlob,
                    {
                        directory: localDirectory || undefined,
                        filename: filename,
                        format: 'wav'
                    }
                );
                console.log('Saved clip to local:', result.path);
                setError(`✓ Clip saved to ${result.path}`);
            } catch (err) {
                console.error('Failed to save clip locally:', err);
                setError('Failed to save clip: ' + (err instanceof Error ? err.message : 'Unknown error'));
            }
        } else {
            // Create download link for browser download
            const url = URL.createObjectURL(clipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setError(`✓ Clip "${filename}" downloaded`);
        }
    };

    const handleDeleteRecording = () => {
        if (confirm('Are you sure you want to delete this recording? This action cannot be undone.')) {
            resetRecording();
            setError('Recording deleted');
        }
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const generateTimestampFilename = (prefix: string, extension: string): string => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        const second = String(now.getSeconds()).padStart(2, '0');
        // Format: voice-20250131-143022.wav (no spaces, no special chars except dash and dot)
        return `${prefix}-${year}${month}${day}-${hour}${minute}${second}.${extension}`;
    };

    return (
        <div className="space-y-4">
            {/* Input Source Toggle - Prominent */}
            {!isRecording && !hasRecording && (
                <div className="p-4 bg-gradient-to-r from-gray-800 to-gray-900 border-2 border-gray-700 rounded-xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="text-white">
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    {inputSource === 'microphone' ? (
                                        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                    ) : (
                                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                                    )}
                                </svg>
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-white">Audio Input Source</div>
                                <div className="text-xs text-gray-400">
                                    {inputSource === 'microphone' ? 'Using microphone only' : 'Using camera with video preview'}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setInputSource('microphone')}
                                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                                    inputSource === 'microphone'
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                    </svg>
                                    Mic
                                </div>
                            </button>
                            <button
                                onClick={() => setInputSource('camera')}
                                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                                    inputSource === 'camera'
                                        ? 'bg-purple-600 text-white shadow-lg'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                                    </svg>
                                    Camera
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Video Preview - Shows when recording with camera */}
            {showVideoPreview && inputSource === 'camera' && isRecording && (
                <div className="relative rounded-xl overflow-hidden border-4 border-purple-600 shadow-2xl">
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-auto bg-black"
                        style={{ transform: 'scaleX(-1)' }} // Mirror the video for natural appearance
                    />
                    <div className="absolute top-4 left-4 bg-purple-600 px-3 py-1 rounded-full flex items-center gap-2">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        <span className="text-white text-sm font-semibold">Camera Active (Audio Only)</span>
                    </div>
                </div>
            )}

            {/* Main Recording Button - Huge and Prominent */}
            {!isRecording && !hasRecording && (
                <div className="text-center space-y-4">
                    <div className="p-8 bg-gradient-to-br from-red-900/30 via-red-800/20 to-red-900/30 border-2 border-red-600/50 rounded-xl">
                        <div className="flex justify-center mb-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20"></div>
                                <button
                                    onClick={startRecording}
                                    disabled={isInitializing}
                                    className="relative w-32 h-32 bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:from-gray-600 disabled:to-gray-700 rounded-full shadow-2xl transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:scale-100 flex items-center justify-center group"
                                >
                                    {isInitializing ? (
                                        <SpinnerIcon className="w-16 h-16 text-white" />
                                    ) : (
                                        <div className="text-center">
                                            <svg className="w-16 h-16 text-white mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    )}
                                </button>
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">
                            {isInitializing ? 'Initializing Microphone...' : 'Start Voice Recording'}
                        </h3>
                        <p className="text-gray-300 text-sm max-w-md mx-auto">
                            Click the button above to start recording your voice sample. Speak clearly for at least 30 seconds for best results.
                        </p>
                        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <span>Max duration: {formatTime(maxDuration)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Recording Status with Prominent Controls */}
            {isRecording && (
                <div className="p-6 bg-gradient-to-br from-red-900/30 via-red-800/20 to-red-900/30 border-2 border-red-600/50 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {!isPaused && (
                                <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                            )}
                            {isPaused && (
                                <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                            )}
                            <div>
                                <div className="text-xl font-bold text-white">
                                    {!isPaused && 'Recording in Progress...'}
                                    {isPaused && 'Recording Paused'}
                                </div>
                                <div className="text-sm text-gray-300">
                                    {formatTime(recordingTime)} / {formatTime(maxDuration)}
                                </div>
                            </div>
                        </div>

                        {/* Timer Display */}
                        <div className="text-5xl font-mono font-bold text-red-400 tabular-nums">
                            {formatTime(recordingTime)}
                        </div>
                    </div>

                    {/* Prominent Recording Controls - Always Visible */}
                    <div className="flex gap-3">
                        {!isPaused && (
                            <>
                                <button
                                    onClick={pauseRecording}
                                    className="flex-1 px-6 py-4 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 font-bold text-lg shadow-lg"
                                >
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    Pause
                                </button>
                                <button
                                    onClick={stopRecording}
                                    className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 font-bold text-lg shadow-lg"
                                >
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                                    </svg>
                                    Stop Recording
                                </button>
                            </>
                        )}

                        {isPaused && (
                            <>
                                <button
                                    onClick={resumeRecording}
                                    className="flex-1 px-6 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 font-bold text-lg shadow-lg"
                                >
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                    </svg>
                                    Resume
                                </button>
                                <button
                                    onClick={stopRecording}
                                    className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 font-bold text-lg shadow-lg"
                                >
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                                    </svg>
                                    Stop
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Audio Quality Feedback */}
            {isRecording && (
                <div className="p-4 bg-gray-700/50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-300">Recording Quality</h4>
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                            audioQualityMetrics.qualityRating === 'excellent' ? 'bg-green-600 text-white' :
                            audioQualityMetrics.qualityRating === 'good' ? 'bg-blue-600 text-white' :
                            audioQualityMetrics.qualityRating === 'fair' ? 'bg-yellow-600 text-white' :
                            'bg-red-600 text-white'
                        }`}>
                            {audioQualityMetrics.qualityRating.toUpperCase()}
                        </span>
                    </div>

                    {/* Real-time Oscilloscope */}
                    <RecordingOscilloscope
                        analyserNode={analyserRef.current}
                        isRecording={isRecording}
                        height={100}
                        showStats={true}
                    />

                    {/* Current Level Meter */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Input Level</span>
                            <span className="text-gray-300">{Math.round(audioQualityMetrics.currentLevel)}%</span>
                        </div>
                        <div className="h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-600">
                            <div
                                className={`h-full transition-all duration-100 ${
                                    audioQualityMetrics.isClipping ? 'bg-red-500' :
                                    audioQualityMetrics.currentLevel > 70 ? 'bg-yellow-500' :
                                    'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(100, audioQualityMetrics.currentLevel)}%` }}
                            />
                        </div>
                    </div>

                    {/* Quality Indicators */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="p-2 bg-gray-800 rounded">
                            <div className="text-gray-500 text-[10px]">Peak</div>
                            <div className={`font-mono font-semibold ${
                                audioQualityMetrics.peakLevel > 95 ? 'text-red-400' : 'text-green-400'
                            }`}>
                                {Math.round(audioQualityMetrics.peakLevel)}%
                            </div>
                        </div>
                        <div className="p-2 bg-gray-800 rounded">
                            <div className="text-gray-500 text-[10px]">SNR</div>
                            <div className={`font-mono font-semibold ${
                                audioQualityMetrics.snr > 30 ? 'text-green-400' :
                                audioQualityMetrics.snr > 20 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                                {Math.round(audioQualityMetrics.snr)} dB
                            </div>
                        </div>
                        <div className="p-2 bg-gray-800 rounded">
                            <div className="text-gray-500 text-[10px]">Noise</div>
                            <div className={`font-mono font-semibold ${
                                audioQualityMetrics.noiseLevel < 3 ? 'text-green-400' : 'text-yellow-400'
                            }`}>
                                {Math.round(audioQualityMetrics.noiseLevel)}%
                            </div>
                        </div>
                    </div>

                    {/* Warnings */}
                    {audioQualityMetrics.isClipping && (
                        <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-200 flex items-start gap-2">
                            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div>
                                <div className="font-semibold">Clipping Detected!</div>
                                <div>Move microphone further away or reduce input gain</div>
                            </div>
                        </div>
                    )}

                    {audioQualityMetrics.snr < 15 && !audioQualityMetrics.isClipping && (
                        <div className="p-2 bg-yellow-900/30 border border-yellow-700/50 rounded text-xs text-yellow-200 flex items-start gap-2">
                            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <div>
                                <div className="font-semibold">High Background Noise</div>
                                <div>Find a quieter environment for better quality</div>
                            </div>
                        </div>
                    )}

                    {audioQualityMetrics.currentLevel < 5 && (
                        <div className="p-2 bg-yellow-900/30 border border-yellow-700/50 rounded text-xs text-yellow-200 flex items-start gap-2">
                            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <div>
                                <div className="font-semibold">Low Input Level</div>
                                <div>Speak louder or move microphone closer</div>
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

            {/* Post-Recording Controls */}
            {hasRecording && !isRecording && (
                <div className="flex gap-3">
                    <button
                        onClick={resetRecording}
                        className="flex-1 px-6 py-4 bg-gray-600 hover:bg-gray-700 text-white rounded-xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 font-bold text-lg shadow-lg"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Record Again
                    </button>
                </div>
            )}

            {/* Professional Audio Editor with Waveform Visualization */}
            {hasRecording && audioURL && audioBlob && !isRecording && (
                <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-r from-green-900/30 to-green-800/20 border-2 border-green-600/50 rounded-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <h4 className="text-lg font-bold text-white">Recording Complete - Professional Editor</h4>
                            <span className="text-sm text-green-300">({formatTime(recordingTime)})</span>
                        </div>

                        <AudioWaveformEditor
                            audioURL={audioURL}
                            audioBlob={audioBlob}
                            originalFilename={recordingFilename}
                            onSaveClip={handleSaveClip}
                            onDelete={handleDeleteRecording}
                        />

                        <div className="mt-4 p-3 bg-blue-900/30 border border-blue-600/50 rounded-lg">
                            <p className="text-sm text-blue-200">
                                💡 Your recording is ready! Use the professional editor above to extract clips or submit the full recording for voice cloning.
                            </p>
                        </div>
                    </div>

                    {/* Saved Clips List */}
                    {savedClips.length > 0 && (
                        <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                            <h5 className="text-sm font-semibold text-gray-300 mb-3">Saved Clips ({savedClips.length})</h5>
                            <div className="space-y-2">
                                {savedClips.map((clip, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                                        <div className="flex items-center gap-3">
                                            <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                            </svg>
                                            <div>
                                                <div className="text-sm text-white font-medium">{clip.filename}</div>
                                                <div className="text-xs text-gray-400">{(clip.blob.size / 1024).toFixed(1)} KB</div>
                                            </div>
                                        </div>
                                        <div className="text-xs text-green-400">✓ Saved</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}


            {/* Local Storage Options */}
            {serverAvailable && !isRecording && !hasRecording && (
                <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${serverAvailable ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <span className="text-sm font-semibold text-gray-300">Local File Storage</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={saveToLocal}
                                onChange={(e) => setSaveToLocal(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    {saveToLocal && (
                        <div className="space-y-2 animate-fade-in-up">
                            <label className="text-xs text-gray-400">Save recordings to:</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={localDirectory}
                                    onChange={(e) => setLocalDirectory(e.target.value)}
                                    placeholder="/path/to/recordings"
                                    className="flex-1 px-3 py-2 text-sm bg-gray-900 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                />
                                <button
                                    onClick={async () => {
                                        try {
                                            const result = await audioConversionService.setRecordingDirectory(localDirectory);
                                            setLocalDirectory(result.directory);
                                            setError(`✓ Directory set: ${result.directory}`);
                                        } catch (err) {
                                            setError('Invalid directory: ' + (err instanceof Error ? err.message : ''));
                                        }
                                    }}
                                    className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                >
                                    Set
                                </button>
                            </div>
                            <p className="text-xs text-gray-500">
                                Recordings will be automatically saved to this directory after recording completes
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Recording Tips */}
            {!isRecording && !hasRecording && (
                <div className="p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                    <div className="text-sm text-blue-200 space-y-1">
                        <div className="font-semibold mb-2">📝 Recording Tips for Best Results:</div>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>Find a quiet environment with minimal background noise</li>
                            <li>Speak clearly and naturally at a moderate pace</li>
                            <li>Record at least 1-2 minutes of speech for best cloning quality</li>
                            <li>Avoid long pauses or extended silence</li>
                            <li>Position microphone 6-12 inches from your mouth</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

import React, { useRef, useEffect, useState, useCallback } from 'react';

interface AudioWaveformEditorProps {
    audioURL: string;
    audioBlob: Blob;
    originalFilename: string;
    onSaveClip: (clipBlob: Blob, filename: string) => void;
    onDelete: () => void;
}

interface AudioMetrics {
    rms: number;
    peak: number;
    dynamicRange: number;
    hasClipping: boolean;
}

export const AudioWaveformEditor: React.FC<AudioWaveformEditorProps> = ({
    audioURL,
    audioBlob,
    originalFilename,
    onSaveClip,
    onDelete
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioBufferRef = useRef<AudioBuffer | null>(null);
    const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const animationFrameRef = useRef<number>(0);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [playbackStartTime, setPlaybackStartTime] = useState(0);
    const [playbackOffset, setPlaybackOffset] = useState(0);
    const [duration, setDuration] = useState(0);
    const [selectionStart, setSelectionStart] = useState<number | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
    const [clipCount, setClipCount] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [isDraggingStart, setIsDraggingStart] = useState(false);
    const [isDraggingEnd, setIsDraggingEnd] = useState(false);
    const [showMetrics, setShowMetrics] = useState(false);
    const [metrics, setMetrics] = useState<AudioMetrics | null>(null);
    const [fadeInDuration, setFadeInDuration] = useState(0);
    const [fadeOutDuration, setFadeOutDuration] = useState(0);
    const [playbackMode, setPlaybackMode] = useState<'full' | 'selection'>('full');

    // Load audio and generate waveform
    useEffect(() => {
        const loadAudio = async () => {
            try {
                if (!audioContextRef.current) {
                    audioContextRef.current = new AudioContext();
                }
                const arrayBuffer = await audioBlob.arrayBuffer();
                const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
                audioBufferRef.current = audioBuffer;
                setDuration(audioBuffer.duration);

                // Calculate audio metrics
                calculateMetrics(audioBuffer);

                drawWaveform(audioBuffer);
            } catch (error) {
                console.error('Error loading audio:', error);
            }
        };

        loadAudio();

        return () => {
            stopPlayback();
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [audioBlob]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input field
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            switch (e.key.toLowerCase()) {
                case ' ':
                    e.preventDefault();
                    togglePlayback();
                    break;
                case 'escape':
                    e.preventDefault();
                    clearSelection();
                    break;
                case 'i':
                    if (e.shiftKey) {
                        e.preventDefault();
                        setSelectionStart(currentTime);
                    }
                    break;
                case 'o':
                    if (e.shiftKey) {
                        e.preventDefault();
                        setSelectionEnd(currentTime);
                    }
                    break;
                case 'enter':
                    if (selectionStart !== null && selectionEnd !== null) {
                        e.preventDefault();
                        extractClip();
                    }
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    seek(Math.max(0, currentTime - (e.shiftKey ? 5 : 1)));
                    break;
                case 'arrowright':
                    e.preventDefault();
                    seek(Math.min(duration, currentTime + (e.shiftKey ? 5 : 1)));
                    break;
                case 'm':
                    e.preventDefault();
                    setShowMetrics(prev => !prev);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentTime, duration, selectionStart, selectionEnd, isPlaying]);

    const calculateMetrics = (buffer: AudioBuffer) => {
        const data = buffer.getChannelData(0);
        let sumSquares = 0;
        let peak = 0;
        let hasClipping = false;

        for (let i = 0; i < data.length; i++) {
            const sample = Math.abs(data[i]);
            sumSquares += data[i] * data[i];
            peak = Math.max(peak, sample);
            if (sample > 0.99) hasClipping = true;
        }

        const rms = Math.sqrt(sumSquares / data.length);
        const dynamicRange = 20 * Math.log10(peak / (rms + 0.0001));

        setMetrics({ rms, peak, dynamicRange, hasClipping });
    };

    // Playback update loop
    const updatePlayback = useCallback(() => {
        if (!isPlaying || !audioContextRef.current) return;

        const elapsed = audioContextRef.current.currentTime - playbackStartTime;
        const newTime = playbackOffset + elapsed;

        if (playbackMode === 'selection' && selectionEnd && newTime >= selectionEnd) {
            stopPlayback();
            setCurrentTime(selectionEnd);
            return;
        }

        if (newTime >= duration) {
            stopPlayback();
            setCurrentTime(0);
            return;
        }

        setCurrentTime(newTime);
        animationFrameRef.current = requestAnimationFrame(updatePlayback);
    }, [isPlaying, playbackStartTime, playbackOffset, duration, playbackMode, selectionEnd]);

    useEffect(() => {
        if (isPlaying) {
            animationFrameRef.current = requestAnimationFrame(updatePlayback);
        }
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isPlaying, updatePlayback]);

    const startPlayback = (startTime: number = 0) => {
        if (!audioBufferRef.current || !audioContextRef.current) return;

        stopPlayback();

        const audioContext = audioContextRef.current;
        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();

        source.buffer = audioBufferRef.current;
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        sourceNodeRef.current = source;
        gainNodeRef.current = gainNode;

        const offset = playbackMode === 'selection' && selectionStart !== null ? selectionStart : startTime;
        const duration_to_play = playbackMode === 'selection' && selectionStart !== null && selectionEnd !== null
            ? selectionEnd - selectionStart
            : undefined;

        source.start(0, offset, duration_to_play);

        setPlaybackStartTime(audioContext.currentTime);
        setPlaybackOffset(offset);
        setCurrentTime(offset);
        setIsPlaying(true);
    };

    const stopPlayback = () => {
        if (sourceNodeRef.current) {
            try {
                sourceNodeRef.current.stop();
            } catch (e) {
                // Already stopped
            }
            sourceNodeRef.current = null;
        }
        setIsPlaying(false);
    };

    const togglePlayback = () => {
        if (isPlaying) {
            stopPlayback();
        } else {
            startPlayback(currentTime);
        }
    };

    const seek = (time: number) => {
        const wasPlaying = isPlaying;
        if (wasPlaying) stopPlayback();

        setCurrentTime(time);

        if (wasPlaying) {
            startPlayback(time);
        }
    };

    const clearSelection = () => {
        setSelectionStart(null);
        setSelectionEnd(null);
        setFadeInDuration(0);
        setFadeOutDuration(0);
    };

    // Draw waveform visualization
    const drawWaveform = useCallback((audioBuffer: AudioBuffer) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { width, height } = canvas.getBoundingClientRect();
        canvas.width = width;
        canvas.height = height;

        // Clear canvas with gradient background
        const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, '#1e293b');
        bgGradient.addColorStop(1, '#0f172a');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

        // Get audio data
        const data = audioBuffer.getChannelData(0);
        const step = Math.ceil(data.length / (width * zoom));
        const amp = height / 2;

        // Draw waveform with gradient
        const waveGradient = ctx.createLinearGradient(0, 0, 0, height);
        waveGradient.addColorStop(0, '#60a5fa');
        waveGradient.addColorStop(0.5, '#3b82f6');
        waveGradient.addColorStop(1, '#2563eb');

        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;

            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }

            const x = i;
            const y1 = (1 + min) * amp;
            const y2 = (1 + max) * amp;

            // Draw filled waveform
            ctx.fillStyle = waveGradient;
            ctx.fillRect(x, y1, 1, y2 - y1);
        }

        // Draw time ruler at top
        const rulerHeight = 25;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.fillRect(0, 0, width, rulerHeight);

        // Time markers
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';

        const timeInterval = duration < 10 ? 1 : duration < 60 ? 5 : 10;
        for (let t = 0; t <= duration; t += timeInterval) {
            const x = (t / duration) * width;

            // Draw tick
            ctx.strokeStyle = '#475569';
            ctx.beginPath();
            ctx.moveTo(x, rulerHeight - 5);
            ctx.lineTo(x, rulerHeight);
            ctx.stroke();

            // Draw time label
            const mins = Math.floor(t / 60);
            const secs = Math.floor(t % 60);
            const label = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
            ctx.fillText(label, x, rulerHeight - 8);
        }

        // Draw center line
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, amp);
        ctx.lineTo(width, amp);
        ctx.stroke();

        // Draw selection overlay with fade indicators
        if (selectionStart !== null && selectionEnd !== null) {
            const startX = (selectionStart / duration) * width;
            const endX = (selectionEnd / duration) * width;

            // Selection overlay with gradient
            const selectionGradient = ctx.createLinearGradient(0, 0, 0, height);
            selectionGradient.addColorStop(0, 'rgba(96, 165, 250, 0.25)');
            selectionGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.35)');
            selectionGradient.addColorStop(1, 'rgba(37, 99, 235, 0.25)');
            ctx.fillStyle = selectionGradient;
            ctx.fillRect(startX, 0, endX - startX, height);

            // Fade in indicator with glow
            if (fadeInDuration > 0) {
                const fadeInWidth = (fadeInDuration / duration) * width;
                const fadeGradient = ctx.createLinearGradient(startX, 0, startX + fadeInWidth, 0);
                fadeGradient.addColorStop(0, 'rgba(34, 197, 94, 0.6)');
                fadeGradient.addColorStop(0.5, 'rgba(34, 197, 94, 0.3)');
                fadeGradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
                ctx.fillStyle = fadeGradient;
                ctx.fillRect(startX, 0, fadeInWidth, height);
            }

            // Fade out indicator with glow
            if (fadeOutDuration > 0) {
                const fadeOutWidth = (fadeOutDuration / duration) * width;
                const fadeGradient = ctx.createLinearGradient(endX - fadeOutWidth, 0, endX, 0);
                fadeGradient.addColorStop(0, 'rgba(34, 197, 94, 0)');
                fadeGradient.addColorStop(0.5, 'rgba(34, 197, 94, 0.3)');
                fadeGradient.addColorStop(1, 'rgba(34, 197, 94, 0.6)');
                ctx.fillStyle = fadeGradient;
                ctx.fillRect(endX - fadeOutWidth, 0, fadeOutWidth, height);
            }

            // Draw selection borders with glow
            ctx.shadowColor = '#3b82f6';
            ctx.shadowBlur = 8;
            ctx.strokeStyle = '#60a5fa';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(startX, 0);
            ctx.lineTo(startX, height);
            ctx.moveTo(endX, 0);
            ctx.lineTo(endX, height);
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Draw drag handles with modern design
            const handleHeight = 50;
            const handleWidth = 10;
            const handleY = (height - handleHeight) / 2;

            // Start handle with gradient
            const startHandleGradient = ctx.createLinearGradient(
                startX - handleWidth / 2, handleY,
                startX + handleWidth / 2, handleY
            );
            startHandleGradient.addColorStop(0, '#60a5fa');
            startHandleGradient.addColorStop(1, '#3b82f6');
            ctx.fillStyle = startHandleGradient;

            // Rounded rectangle for handle
            ctx.beginPath();
            const radius = 3;
            ctx.roundRect(startX - handleWidth / 2, handleY, handleWidth, handleHeight, radius);
            ctx.fill();

            // Handle border
            ctx.strokeStyle = '#1e40af';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Handle grip lines
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            for (let i = 0; i < 3; i++) {
                const y = handleY + handleHeight / 2 + (i - 1) * 6;
                ctx.beginPath();
                ctx.moveTo(startX - 3, y);
                ctx.lineTo(startX + 3, y);
                ctx.stroke();
            }

            // End handle with gradient
            const endHandleGradient = ctx.createLinearGradient(
                endX - handleWidth / 2, handleY,
                endX + handleWidth / 2, handleY
            );
            endHandleGradient.addColorStop(0, '#60a5fa');
            endHandleGradient.addColorStop(1, '#3b82f6');
            ctx.fillStyle = endHandleGradient;

            ctx.beginPath();
            ctx.roundRect(endX - handleWidth / 2, handleY, handleWidth, handleHeight, radius);
            ctx.fill();

            ctx.strokeStyle = '#1e40af';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Handle grip lines
            ctx.strokeStyle = '#ffffff';
            for (let i = 0; i < 3; i++) {
                const y = handleY + handleHeight / 2 + (i - 1) * 6;
                ctx.beginPath();
                ctx.moveTo(endX - 3, y);
                ctx.lineTo(endX + 3, y);
                ctx.stroke();
            }
        }

        // Draw playhead with glow
        const playheadX = (currentTime / duration) * width;

        // Playhead glow
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(playheadX, 25);
        ctx.lineTo(playheadX, height);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Playhead triangle at top
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(playheadX, 25);
        ctx.lineTo(playheadX - 6, 15);
        ctx.lineTo(playheadX + 6, 15);
        ctx.closePath();
        ctx.fill();

        // Triangle border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Playhead circle at bottom
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(playheadX, height - 10, 8, 0, Math.PI * 2);
        ctx.fill();

        // Circle border with glow
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }, [duration, currentTime, selectionStart, selectionEnd, zoom, fadeInDuration, fadeOutDuration]);

    // Redraw waveform when dependencies change
    useEffect(() => {
        if (audioBufferRef.current) {
            drawWaveform(audioBufferRef.current);
        }
    }, [drawWaveform]);

    // Handle canvas click for selection and seeking
    const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const clickTime = (x / rect.width) * duration;

        // Check if clicking near a handle
        if (selectionStart !== null && selectionEnd !== null) {
            const startX = (selectionStart / duration) * rect.width;
            const endX = (selectionEnd / duration) * rect.width;
            const handleThreshold = 10;

            if (Math.abs(x - startX) < handleThreshold) {
                // Clicked on start handle - start dragging
                return;
            }
            if (Math.abs(x - endX) < handleThreshold) {
                // Clicked on end handle - start dragging
                return;
            }
        }

        // If holding Shift, set selection endpoints
        if (e.shiftKey) {
            if (selectionStart === null) {
                setSelectionStart(clickTime);
                setSelectionEnd(null);
            } else if (selectionEnd === null) {
                if (clickTime > selectionStart) {
                    setSelectionEnd(clickTime);
                } else {
                    setSelectionEnd(selectionStart);
                    setSelectionStart(clickTime);
                }
            } else {
                // Reset selection
                setSelectionStart(clickTime);
                setSelectionEnd(null);
            }
        } else {
            // Normal click - seek to position
            seek(clickTime);
        }
    }, [duration, selectionStart, selectionEnd]);

    // Handle mouse down for dragging
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas || selectionStart === null || selectionEnd === null) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const startX = (selectionStart / duration) * rect.width;
        const endX = (selectionEnd / duration) * rect.width;
        const handleThreshold = 10;

        if (Math.abs(x - startX) < handleThreshold) {
            setIsDraggingStart(true);
            e.preventDefault();
        } else if (Math.abs(x - endX) < handleThreshold) {
            setIsDraggingEnd(true);
            e.preventDefault();
        }
    }, [selectionStart, selectionEnd, duration]);

    // Handle mouse move for dragging
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas || (!isDraggingStart && !isDraggingEnd)) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = Math.max(0, Math.min(duration, (x / rect.width) * duration));

        if (isDraggingStart && selectionEnd !== null) {
            if (time < selectionEnd) {
                setSelectionStart(time);
            }
        } else if (isDraggingEnd && selectionStart !== null) {
            if (time > selectionStart) {
                setSelectionEnd(time);
            }
        }
    }, [isDraggingStart, isDraggingEnd, duration, selectionStart, selectionEnd]);

    // Handle mouse up to stop dragging
    const handleMouseUp = useCallback(() => {
        setIsDraggingStart(false);
        setIsDraggingEnd(false);
    }, []);

    // Extract clip from selection with fades
    const extractClip = useCallback(async () => {
        if (!audioBufferRef.current || selectionStart === null || selectionEnd === null) return;

        const audioContext = new AudioContext();
        const originalBuffer = audioBufferRef.current;

        const startSample = Math.floor(selectionStart * originalBuffer.sampleRate);
        const endSample = Math.floor(selectionEnd * originalBuffer.sampleRate);
        const clipLength = endSample - startSample;

        // Create new buffer for the clip
        const clipBuffer = audioContext.createBuffer(
            originalBuffer.numberOfChannels,
            clipLength,
            originalBuffer.sampleRate
        );

        // Copy audio data with fades
        const fadeInSamples = Math.floor(fadeInDuration * originalBuffer.sampleRate);
        const fadeOutSamples = Math.floor(fadeOutDuration * originalBuffer.sampleRate);

        for (let channel = 0; channel < originalBuffer.numberOfChannels; channel++) {
            const sourceData = originalBuffer.getChannelData(channel);
            const clipData = clipBuffer.getChannelData(channel);

            for (let i = 0; i < clipLength; i++) {
                let sample = sourceData[startSample + i];

                // Apply fade in
                if (i < fadeInSamples) {
                    const fadeGain = i / fadeInSamples;
                    sample *= fadeGain;
                }

                // Apply fade out
                if (i > clipLength - fadeOutSamples) {
                    const fadeGain = (clipLength - i) / fadeOutSamples;
                    sample *= fadeGain;
                }

                clipData[i] = sample;
            }
        }

        // Convert to WAV blob
        const wavBlob = audioBufferToWavBlob(clipBuffer);

        // Generate filename: voice-20250131-020815-clip1.wav
        const newClipCount = clipCount + 1;
        const baseFilename = originalFilename.replace(/\.(wav|mp3|ogg|webm)$/i, '');
        const clipFilename = `${baseFilename}-clip${newClipCount}.wav`;

        setClipCount(newClipCount);
        onSaveClip(wavBlob, clipFilename);

        // Reset selection and fades
        clearSelection();
    }, [selectionStart, selectionEnd, clipCount, originalFilename, onSaveClip, fadeInDuration, fadeOutDuration]);

    // Helper function to convert AudioBuffer to WAV blob
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

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-4">
            {/* Waveform Display */}
            <div className="relative group">
                <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className="w-full h-64 cursor-crosshair rounded-xl border-2 border-slate-700 hover:border-blue-500 transition-colors shadow-2xl"
                    style={{ backgroundColor: '#0f172a' }}
                />
                <div className="absolute top-3 right-3 bg-gradient-to-r from-slate-900/90 to-slate-800/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-700 shadow-lg">
                    <div className="text-xs font-mono text-slate-300">
                        {formatTime(currentTime)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                        / {formatTime(duration)}
                    </div>
                </div>
                {playbackMode === 'selection' && selectionStart !== null && selectionEnd !== null && (
                    <div className="absolute top-3 left-3 bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2 rounded-lg shadow-lg animate-pulse">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                            <span className="text-xs text-white font-semibold">Selection Mode</span>
                        </div>
                    </div>
                )}
                {zoom > 1 && (
                    <div className="absolute bottom-3 left-3 bg-purple-600/90 backdrop-blur-sm px-3 py-1 rounded-lg text-xs text-white font-semibold shadow-lg">
                        {zoom}x Zoom
                    </div>
                )}
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl border border-slate-700 shadow-lg">
                <button
                    onClick={togglePlayback}
                    className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95 shadow-lg ${
                        isPlaying
                            ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white'
                            : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white'
                    }`}
                >
                    {isPlaying ? (
                        <>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Pause
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                            Play
                        </>
                    )}
                </button>

                <button
                    onClick={() => seek(0)}
                    className="px-5 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95 shadow-lg"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
                    </svg>
                    Reset
                </button>

                {selectionStart !== null && selectionEnd !== null && (
                    <>
                        <div className="h-8 w-px bg-slate-600"></div>
                        <button
                            onClick={() => setPlaybackMode(playbackMode === 'full' ? 'selection' : 'full')}
                            className={`px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95 shadow-lg ${
                                playbackMode === 'selection'
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white ring-2 ring-blue-400'
                                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                            }`}
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                            </svg>
                            {playbackMode === 'selection' ? 'Selection' : 'Full'}
                        </button>
                    </>
                )}

                <div className="flex-1"></div>

                <button
                    onClick={() => setShowMetrics(!showMetrics)}
                    className={`px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95 shadow-lg ${
                        showMetrics
                            ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white ring-2 ring-purple-400'
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    }`}
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                    {showMetrics ? 'Hide' : 'Show'} Metrics
                </button>
            </div>

            {/* Audio Metrics */}
            {showMetrics && metrics && (
                <div className="p-4 bg-purple-900/30 border border-purple-600/50 rounded-lg space-y-3">
                    <h4 className="text-sm font-semibold text-purple-200 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                        </svg>
                        Audio Analysis
                    </h4>
                    <div className="grid grid-cols-4 gap-3">
                        <div className="p-3 bg-gray-800 rounded-lg">
                            <div className="text-xs text-gray-400 mb-1">RMS Level</div>
                            <div className="text-lg font-bold text-white">{(metrics.rms * 100).toFixed(1)}%</div>
                        </div>
                        <div className="p-3 bg-gray-800 rounded-lg">
                            <div className="text-xs text-gray-400 mb-1">Peak Level</div>
                            <div className={`text-lg font-bold ${metrics.peak > 0.99 ? 'text-red-400' : 'text-white'}`}>
                                {(metrics.peak * 100).toFixed(1)}%
                            </div>
                        </div>
                        <div className="p-3 bg-gray-800 rounded-lg">
                            <div className="text-xs text-gray-400 mb-1">Dynamic Range</div>
                            <div className="text-lg font-bold text-white">{metrics.dynamicRange.toFixed(1)} dB</div>
                        </div>
                        <div className="p-3 bg-gray-800 rounded-lg">
                            <div className="text-xs text-gray-400 mb-1">Clipping</div>
                            <div className={`text-lg font-bold ${metrics.hasClipping ? 'text-red-400' : 'text-green-400'}`}>
                                {metrics.hasClipping ? 'YES' : 'NO'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Selection Info & Controls */}
            {selectionStart !== null && selectionEnd !== null && (
                <div className="p-4 bg-blue-900/30 border-2 border-blue-600 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-semibold text-blue-200">Selection Active</div>
                            <div className="text-xs text-blue-300">
                                {formatTime(selectionStart)} → {formatTime(selectionEnd)}
                                <span className="ml-2">({formatTime(selectionEnd - selectionStart)} duration)</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={extractClip}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                </svg>
                                Save Clip {clipCount + 1}
                            </button>
                            <button
                                onClick={clearSelection}
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold"
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    {/* Fade Controls */}
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-blue-700/50">
                        <div>
                            <label className="text-xs text-blue-300 font-semibold mb-2 block flex items-center gap-2">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                </svg>
                                Fade In: {fadeInDuration.toFixed(2)}s
                            </label>
                            <input
                                type="range"
                                min="0"
                                max={Math.min(0.5, (selectionEnd - selectionStart) / 2)}
                                step="0.01"
                                value={fadeInDuration}
                                onChange={(e) => setFadeInDuration(Number(e.target.value))}
                                className="w-full accent-green-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-blue-300 font-semibold mb-2 block flex items-center gap-2">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" style={{ transform: 'scaleX(-1)' }}>
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                </svg>
                                Fade Out: {fadeOutDuration.toFixed(2)}s
                            </label>
                            <input
                                type="range"
                                min="0"
                                max={Math.min(0.5, (selectionEnd - selectionStart) / 2)}
                                step="0.01"
                                value={fadeOutDuration}
                                onChange={(e) => setFadeOutDuration(Number(e.target.value))}
                                className="w-full accent-green-500"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Zoom & Tools */}
            <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-300 font-semibold">Zoom:</span>
                    <button
                        onClick={() => setZoom(Math.max(1, zoom - 0.5))}
                        disabled={zoom <= 1}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded"
                    >
                        −
                    </button>
                    <span className="text-sm text-gray-300 w-12 text-center">{zoom}x</span>
                    <button
                        onClick={() => setZoom(Math.min(10, zoom + 0.5))}
                        disabled={zoom >= 10}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded"
                    >
                        +
                    </button>
                </div>

                <button
                    onClick={onDelete}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Delete Recording
                </button>
            </div>

            {/* Keyboard Shortcuts Help */}
            <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg text-xs text-gray-400">
                <p className="font-semibold text-gray-300 mb-2">⌨️ Keyboard Shortcuts:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div><kbd className="px-1 bg-gray-700 rounded">Space</kbd> Play/Pause</div>
                    <div><kbd className="px-1 bg-gray-700 rounded">Shift+Click</kbd> Set Selection</div>
                    <div><kbd className="px-1 bg-gray-700 rounded">←/→</kbd> Seek 1s</div>
                    <div><kbd className="px-1 bg-gray-700 rounded">Shift+←/→</kbd> Seek 5s</div>
                    <div><kbd className="px-1 bg-gray-700 rounded">Shift+I</kbd> Mark In Point</div>
                    <div><kbd className="px-1 bg-gray-700 rounded">Shift+O</kbd> Mark Out Point</div>
                    <div><kbd className="px-1 bg-gray-700 rounded">Enter</kbd> Extract Clip</div>
                    <div><kbd className="px-1 bg-gray-700 rounded">Esc</kbd> Clear Selection</div>
                    <div><kbd className="px-1 bg-gray-700 rounded">M</kbd> Toggle Metrics</div>
                    <div><kbd className="px-1 bg-gray-700 rounded">Drag Handles</kbd> Refine Selection</div>
                </div>
            </div>
        </div>
    );
};

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { WaveformIcon } from './icons/WaveformIcon';
import { SpectrogramIcon } from './icons/SpectrogramIcon';
import { ZoomInIcon } from './icons/ZoomInIcon';
import { ZoomOutIcon } from './icons/ZoomOutIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import type { ColorScheme, OscilloscopeTheme } from '../types';

interface SpectrogramSettings {
    minFrequency: number;
    maxFrequency: number;
    intensity: number;
    colorScheme: ColorScheme;
}

interface OscilloscopeProps {
    analyserNode: AnalyserNode;
    spectrogramSettings: SpectrogramSettings;
    isPlaying: boolean;
    onSpectrogramChange: (settings: Partial<SpectrogramSettings>) => void;
    oscilloscopeTheme: OscilloscopeTheme;
    freqToSliderVal: (freq: number) => number;
    sliderValToFreq: (val: number) => number;
}

type AnalysisView = 'oscilloscope' | 'spectrogram';

// --- Spectrogram Configuration ---
const AXIS_WIDTH = 50; // px for frequency labels
const MIN_FREQ = 20; // Hz

const getColorForScheme = (scheme: ColorScheme, value: number): string => {
    if (value === 0) return '#000000'; // Black for silence
    const percent = value / 255;

    switch (scheme) {
        case 'inferno': {
            // A simplified Inferno colormap (black -> red -> yellow -> white)
            if (percent < 0.25) {
                const r = Math.round(255 * (percent * 4));
                return `rgb(${r}, 0, 0)`;
            } else if (percent < 0.75) {
                const g = Math.round(255 * ((percent - 0.25) * 2));
                return `rgb(255, ${g}, 0)`;
            } else {
                const b = Math.round(255 * ((percent - 0.75) * 4));
                return `rgb(255, 255, ${b})`;
            }
        }
        case 'viridis': {
            // A simplified Viridis-like colormap (blue -> green -> yellow)
            const r = Math.round(240 * Math.sqrt(percent));
            const g = Math.round(250 * percent * percent);
            const b = Math.round(80 * (1 - percent));
            return `rgb(${r}, ${g}, ${b})`;
        }
        case 'grayscale': {
            const lightness = Math.round(percent * 100);
            return `hsl(0, 0%, ${lightness}%)`;
        }
        case 'ocean': {
             const hue = 180 + (percent * 60); // Cyan to Blue
             const lightness = 15 + (percent * 60);
             return `hsl(${hue}, 100%, ${lightness}%)`;
        }
        case 'vibrant': // Default
        default: {
            const hue = 240 - (percent * 240); // Blue to Red
            const lightness = 15 + (percent * 60);
            return `hsl(${hue}, 100%, ${lightness}%)`;
        }
    }
};

const THEME_COLORS: Record<OscilloscopeTheme, { line: string; shadow: string; grid: string; bg: string; gridCenter: string }> = {
    cyberpunk: { line: 'rgb(219, 234, 254)', shadow: 'rgba(147, 197, 253, 0.7)', grid: 'rgba(0, 100, 255, 0.1)', bg: 'rgb(17 24 39)', gridCenter: 'rgba(0, 100, 255, 0.2)' },
    matrix: { line: 'rgb(52, 211, 153)', shadow: 'rgba(16, 185, 129, 0.7)', grid: 'rgba(16, 185, 129, 0.1)', bg: 'rgb(10, 20, 15)', gridCenter: 'rgba(16, 185, 129, 0.2)' },
    arcade: { line: 'rgb(251, 191, 36)', shadow: 'rgba(245, 158, 11, 0.7)', grid: 'rgba(249, 115, 22, 0.1)', bg: 'rgb(25, 10, 0)', gridCenter: 'rgba(249, 115, 22, 0.2)' },
    plasma: { line: 'rgb(192, 132, 252)', shadow: 'rgba(168, 85, 247, 0.7)', grid: 'rgba(139, 92, 246, 0.1)', bg: 'rgb(20, 5, 30)', gridCenter: 'rgba(139, 92, 246, 0.2)' },
};


export const Oscilloscope: React.FC<OscilloscopeProps> = ({ analyserNode, spectrogramSettings, isPlaying, onSpectrogramChange, oscilloscopeTheme, freqToSliderVal: _freqToSliderVal, sliderValToFreq: _sliderValToFreq }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameId = useRef<number>(0);
    const [view, setView] = useState<AnalysisView>('oscilloscope');
    const [fps, setFps] = useState<number>(60);
    const fpsFrameTimesRef = useRef<number[]>([]);
    const lastFrameTimeRef = useRef<number>(performance.now());

    // Unpack spectrogram settings from props
    const { minFrequency, maxFrequency, intensity, colorScheme } = spectrogramSettings;

    // Spectrogram interaction state
    const isDraggingRef = useRef(false);
    const dragStartYRef = useRef(0);
    const dragCurrentYRef = useRef(0);

    const logScale = React.useMemo(() => {
        const maxFreq = analyserNode ? analyserNode.context.sampleRate / 2 : 22050;
        const logMinFull = Math.log(MIN_FREQ);
        const logMaxFull = Math.log(maxFreq);

        const currentLogMin = Math.log(minFrequency);
        const currentLogMax = Math.log(maxFrequency);
        
        return {
            full: {
                maxFreq: maxFreq,
                logMin: logMinFull,
                scale: (logMaxFull - logMinFull),
            },
            view: {
                logMin: currentLogMin,
                scale: (currentLogMax - currentLogMin),
            }
        };
    }, [analyserNode, minFrequency, maxFrequency]);
    
    const drawOscilloscope = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, dataArray: Uint8Array) => {
        analyserNode.getByteTimeDomainData(dataArray as Uint8Array<ArrayBuffer>);

        const colors = THEME_COLORS[oscilloscopeTheme];

        ctx.fillStyle = colors.bg;
        ctx.fillRect(0, 0, width, height);

        ctx.lineWidth = 1;
        ctx.strokeStyle = colors.grid;
        const gridX = width / 10;
        const gridY = height / 4;
        for (let i = 1; i < 10; i++) { ctx.beginPath(); ctx.moveTo(i * gridX, 0); ctx.lineTo(i * gridX, height); ctx.stroke(); }
        for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, i * gridY); ctx.lineTo(width, i * gridY); ctx.stroke(); }
        
        ctx.strokeStyle = colors.gridCenter;
        ctx.beginPath(); ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();

        ctx.shadowBlur = 10;
        ctx.shadowColor = colors.shadow;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = colors.line;
        ctx.beginPath();
        const sliceWidth = width * 1.0 / dataArray.length;
        let x = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * height / 2;
            if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
            x += sliceWidth;
        }
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }, [analyserNode, oscilloscopeTheme]);

    const drawSpectrogram = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, dataArray: Uint8Array) => {
        const spectrogramWidth = width - AXIS_WIDTH;
        if (spectrogramWidth <= 0) return;

        analyserNode.getByteFrequencyData(dataArray as Uint8Array<ArrayBuffer>);
        
        ctx.drawImage(canvasRef.current!, 0, 0, spectrogramWidth, height, -1, 0, spectrogramWidth, height);

        for (let y = 0; y < height; y++) {
            const logYRatio = 1 - (y / height);
            const freq = Math.exp(logScale.view.logMin + logYRatio * logScale.view.scale);
            const bin = Math.floor((freq / logScale.full.maxFreq) * dataArray.length);
            const value = Math.min(255, (dataArray[bin] || 0) * intensity);
            
            ctx.fillStyle = getColorForScheme(colorScheme, value);
            ctx.fillRect(spectrogramWidth - 1, y, 1, 1);
        }

        ctx.clearRect(spectrogramWidth, 0, AXIS_WIDTH, height);
        ctx.fillStyle = 'rgba(31, 41, 55, 0.7)';
        ctx.fillRect(spectrogramWidth, 0, AXIS_WIDTH, height);

        const labels = [
            { freq: 100, label: '100Hz' }, { freq: 500, label: '500Hz' },
            { freq: 1000, label: '1kHz' }, { freq: 5000, label: '5kHz' },
            { freq: 10000, label: '10kHz' }, { freq: 20000, label: '20kHz' },
        ];
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '10px sans-serif';
        for (const { freq, label } of labels) {
            if (freq < minFrequency || freq > maxFrequency) continue;
            const logRatio = (Math.log(freq) - logScale.view.logMin) / logScale.view.scale;
            const y = height * (1 - logRatio);
            ctx.fillRect(spectrogramWidth, y, 5, 1);
            ctx.fillText(label, spectrogramWidth + 8, y + 4);
        }

        // Draw playback head if playing
        if (isPlaying) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillRect(spectrogramWidth - 2, 0, 2, height);
            ctx.shadowBlur = 0;
        }

        // Draw drag selection overlay
        if (isDraggingRef.current) {
            const startY = dragStartYRef.current;
            const currentY = dragCurrentYRef.current;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(0, Math.min(startY, currentY), spectrogramWidth, Math.abs(currentY - startY));
        }

    }, [analyserNode, logScale, colorScheme, intensity, minFrequency, maxFrequency, isPlaying]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !analyserNode) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Calculate FPS
        const now = performance.now();
        const delta = now - lastFrameTimeRef.current;
        lastFrameTimeRef.current = now;
        fpsFrameTimesRef.current.push(delta);
        if (fpsFrameTimesRef.current.length > 60) {
            fpsFrameTimesRef.current.shift();
        }
        if (fpsFrameTimesRef.current.length > 0) {
            const avgDelta = fpsFrameTimesRef.current.reduce((a, b) => a + b, 0) / fpsFrameTimesRef.current.length;
            const currentFps = 1000 / avgDelta;
            if (Math.abs(currentFps - fps) > 1) {
                setFps(Math.round(currentFps));
            }
        }

        const { width, height } = canvas.getBoundingClientRect();
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        if (view === 'oscilloscope') {
            drawOscilloscope(ctx, width, height, dataArray);
        } else {
            drawSpectrogram(ctx, width, height, dataArray);
        }

        analyserNode.getByteFrequencyData(dataArray as Uint8Array<ArrayBuffer>);
        let maxIndex = 0;
        for (let i = 1; i < bufferLength; i++) {
            if (dataArray[i] > dataArray[maxIndex]) maxIndex = i;
        }
        const peakFrequency = maxIndex * (analyserNode.context.sampleRate / 2) / bufferLength;

        // Calculate RMS level
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            const normalized = dataArray[i] / 255;
            sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / bufferLength);

        // Display stats
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`Peak: ${peakFrequency.toFixed(0)} Hz`, width - 10, 15);
        ctx.fillText(`RMS: ${(rms * 100).toFixed(1)}%`, width - 10, 30);
        ctx.fillText(`FPS: ${fps}`, width - 10, 45);

        animationFrameId.current = requestAnimationFrame(draw);
    }, [analyserNode, view, drawOscilloscope, drawSpectrogram, fps]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            const bg = view === 'oscilloscope' ? THEME_COLORS[oscilloscopeTheme].bg : 'rgb(17 24 39)';
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        animationFrameId.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(animationFrameId.current);
    }, [draw, view, oscilloscopeTheme]);
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const resizeObserver = new ResizeObserver(() => {
            cancelAnimationFrame(animationFrameId.current);
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const bg = view === 'oscilloscope' ? THEME_COLORS[oscilloscopeTheme].bg : 'rgb(17 24 39)';
                ctx.fillStyle = bg;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            animationFrameId.current = requestAnimationFrame(draw);
        });
        resizeObserver.observe(canvas);
        return () => resizeObserver.disconnect();
    }, [draw, view, oscilloscopeTheme]);

    // --- Spectrogram Interaction Handlers ---
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (view !== 'spectrogram' || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        isDraggingRef.current = true;
        dragStartYRef.current = y;
        dragCurrentYRef.current = y;
    }, [view]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDraggingRef.current || view !== 'spectrogram' || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        dragCurrentYRef.current = y;
    }, [view]);

    const handleMouseUp = useCallback(() => {
        if (!isDraggingRef.current || !canvasRef.current) return;
        isDraggingRef.current = false;
        
        const { height } = canvasRef.current.getBoundingClientRect();
        const startY = dragStartYRef.current;
        const endY = dragCurrentYRef.current;

        // Ignore clicks or tiny drags
        if (Math.abs(startY - endY) < 5) return;

        const y1 = Math.min(startY, endY) / height;
        const y2 = Math.max(startY, endY) / height;
        
        const logMinView = Math.log(minFrequency);
        const scaleView = Math.log(maxFrequency) - logMinView;

        const newMinFreq = Math.exp(logMinView + (1 - y2) * scaleView);
        const newMaxFreq = Math.exp(logMinView + (1 - y1) * scaleView);

        onSpectrogramChange({
            minFrequency: Math.max(MIN_FREQ, newMinFreq),
            maxFrequency: Math.min(logScale.full.maxFreq, newMaxFreq),
        });
    }, [view, onSpectrogramChange, minFrequency, maxFrequency, logScale.full.maxFreq]);

    const handleExportImage = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `oscilloscope-${view}-${Date.now()}.png`;
            a.click();
            URL.revokeObjectURL(url);
        }, 'image/png');
    }, [view]);

    return (
        <div className="relative w-full h-full group" style={{ backgroundColor: view === 'oscilloscope' ? THEME_COLORS[oscilloscopeTheme].bg : 'rgb(17 24 39)' }}>
            <canvas
                ref={canvasRef}
                className="w-full h-full"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp} // End drag if mouse leaves canvas
            />

            <div className="absolute top-2 right-2 flex items-center gap-1 bg-gray-900/50 rounded-full p-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                    onClick={() => setView('oscilloscope')}
                    className={`p-1.5 rounded-full transition-colors ${view === 'oscilloscope' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                    title="Oscilloscope View"
                >
                    <WaveformIcon />
                </button>
                <button
                    onClick={() => setView('spectrogram')}
                    className={`p-1.5 rounded-full transition-colors ${view === 'spectrogram' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                    title="Spectrogram View"
                >
                    <SpectrogramIcon />
                </button>
                <div className="w-px h-6 bg-gray-600"></div>
                <button
                    onClick={handleExportImage}
                    className="p-1.5 rounded-full transition-colors text-gray-400 hover:bg-gray-700 hover:text-white"
                    title="Export as PNG"
                >
                    <DownloadIcon />
                </button>
            </div>
            
            {view === 'spectrogram' && (
                 <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-gray-900/50 rounded-full p-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                        onClick={() => {
                            const currentRange = maxFrequency - minFrequency;
                            const center = minFrequency + currentRange / 2;
                            const newRange = currentRange * 1.5;
                            onSpectrogramChange({ 
                                minFrequency: Math.max(MIN_FREQ, center - newRange / 2),
                                maxFrequency: Math.min(logScale.full.maxFreq, center + newRange / 2)
                            });
                        }}
                        className="p-1.5 rounded-full text-gray-400 hover:bg-gray-700"
                        title="Zoom Out"
                    >
                       <ZoomOutIcon />
                    </button>
                     <button
                        onClick={() => {
                             const currentRange = maxFrequency - minFrequency;
                            const center = minFrequency + currentRange / 2;
                            const newRange = currentRange / 1.5;
                            onSpectrogramChange({ 
                                minFrequency: Math.max(MIN_FREQ, center - newRange / 2),
                                maxFrequency: Math.min(logScale.full.maxFreq, center + newRange / 2)
                            });
                        }}
                        className="p-1.5 rounded-full text-gray-400 hover:bg-gray-700"
                        title="Zoom In"
                    >
                        <ZoomInIcon />
                    </button>
                </div>
            )}
        </div>
    );
};

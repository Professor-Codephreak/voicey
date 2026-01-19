import React, { useRef, useEffect, useState, useCallback } from 'react';

interface WaveformViewerProps {
    waveformData: Float32Array;
    duration: number;
    startTime: number;
    endTime: number;
    onStartTimeChange: (time: number) => void;
    onEndTimeChange: (time: number) => void;
    height?: number;
    color?: string;
    selectedColor?: string;
}

const WaveformViewer: React.FC<WaveformViewerProps> = ({
    waveformData,
    duration,
    startTime,
    endTime,
    onStartTimeChange,
    onEndTimeChange,
    height = 120,
    color = '#4ade80',
    selectedColor = '#22c55e',
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(800);
    const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
    const [currentTime, setCurrentTime] = useState<number | null>(null);

    // Update width on resize
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setWidth(containerRef.current.clientWidth);
            }
        };

        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    // Draw waveform
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || waveformData.length === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.scale(dpr, dpr);

        // Clear canvas
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(0, 0, width, height);

        // Draw waveform
        const barWidth = width / waveformData.length;
        const centerY = height / 2;

        const startX = (startTime / duration) * width;
        const endX = (endTime / duration) * width;

        for (let i = 0; i < waveformData.length; i++) {
            const x = i * barWidth;
            const barHeight = waveformData[i] * centerY * 0.9;

            // Check if this bar is in the selected region
            const isSelected = x >= startX && x <= endX;
            ctx.fillStyle = isSelected ? selectedColor : color;

            // Draw bar
            ctx.fillRect(
                x,
                centerY - barHeight,
                Math.max(barWidth - 1, 1),
                barHeight * 2
            );
        }

        // Draw selection overlay
        ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
        ctx.fillRect(startX, 0, endX - startX, height);

        // Draw start/end markers
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;

        // Start marker
        ctx.beginPath();
        ctx.moveTo(startX, 0);
        ctx.lineTo(startX, height);
        ctx.stroke();

        // End marker
        ctx.beginPath();
        ctx.moveTo(endX, 0);
        ctx.lineTo(endX, height);
        ctx.stroke();

        // Draw time labels
        ctx.fillStyle = '#fff';
        ctx.font = '12px monospace';
        ctx.fillText(formatTime(startTime), startX + 5, 15);
        ctx.fillText(formatTime(endTime), endX - 50, 15);

        // Draw current time cursor if hovering
        if (currentTime !== null) {
            const cursorX = (currentTime / duration) * width;
            ctx.strokeStyle = '#60a5fa';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(cursorX, 0);
            ctx.lineTo(cursorX, height);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#60a5fa';
            ctx.fillText(formatTime(currentTime), cursorX + 5, height - 5);
        }
    }, [waveformData, width, height, startTime, endTime, duration, color, selectedColor, currentTime]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 10);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
    };

    const getTimeFromX = (x: number): number => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return 0;
        const relativeX = x - rect.left;
        return (relativeX / width) * duration;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        const time = getTimeFromX(e.clientX);
        const startX = (startTime / duration) * width;
        const endX = (endTime / duration) * width;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const relativeX = e.clientX - rect.left;

        // Check if clicking near start or end marker (within 10px)
        if (Math.abs(relativeX - startX) < 10) {
            setIsDragging('start');
        } else if (Math.abs(relativeX - endX) < 10) {
            setIsDragging('end');
        } else if (relativeX > startX && relativeX < endX) {
            // Clicking in the middle - determine which marker is closer
            if (Math.abs(relativeX - startX) < Math.abs(relativeX - endX)) {
                setIsDragging('start');
                onStartTimeChange(time);
            } else {
                setIsDragging('end');
                onEndTimeChange(time);
            }
        } else {
            // Clicking outside - set nearest marker
            if (time < startTime) {
                setIsDragging('start');
                onStartTimeChange(time);
            } else {
                setIsDragging('end');
                onEndTimeChange(time);
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const time = getTimeFromX(e.clientX);
        setCurrentTime(time);

        if (isDragging) {
            const newTime = Math.max(0, Math.min(duration, time));
            if (isDragging === 'start') {
                onStartTimeChange(Math.min(newTime, endTime - 0.1));
            } else {
                onEndTimeChange(Math.max(newTime, startTime + 0.1));
            }
        }
    };

    const handleMouseUp = () => {
        setIsDragging(null);
    };

    const handleMouseLeave = () => {
        setCurrentTime(null);
        setIsDragging(null);
    };

    return (
        <div ref={containerRef} className="w-full">
            <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                className="w-full cursor-crosshair rounded-lg border border-gray-700"
                style={{ height: `${height}px` }}
            />
            <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>Start: {formatTime(startTime)}</span>
                <span>Duration: {formatTime(endTime - startTime)}</span>
                <span>End: {formatTime(endTime)}</span>
            </div>
        </div>
    );
};

export default WaveformViewer;

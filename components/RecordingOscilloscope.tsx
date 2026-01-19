import React, { useRef, useEffect, useCallback } from 'react';

interface RecordingOscilloscopeProps {
    analyserNode: AnalyserNode | null;
    isRecording: boolean;
    height?: number;
    showStats?: boolean;
}

export const RecordingOscilloscope: React.FC<RecordingOscilloscopeProps> = ({
    analyserNode,
    isRecording,
    height = 120,
    showStats = true
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameId = useRef<number>(0);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !analyserNode || !isRecording) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { width, height } = canvas.getBoundingClientRect();
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        // Get time domain data for waveform
        const bufferLength = analyserNode.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteTimeDomainData(dataArray);

        // Clear canvas with dark background
        ctx.fillStyle = 'rgb(17, 24, 39)';
        ctx.fillRect(0, 0, width, height);

        // Draw professional grid
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.08)';
        const gridX = width / 20; // More vertical lines for detail
        const gridY = height / 8; // More horizontal lines

        // Vertical grid lines
        for (let i = 1; i < 20; i++) {
            ctx.beginPath();
            ctx.moveTo(i * gridX, 0);
            ctx.lineTo(i * gridX, height);
            ctx.stroke();
        }

        // Horizontal grid lines
        for (let i = 1; i < 8; i++) {
            ctx.beginPath();
            ctx.moveTo(0, i * gridY);
            ctx.lineTo(width, i * gridY);
            ctx.stroke();
        }

        // Center lines (brighter with dashed style)
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
        ctx.setLineDash([5, 5]);

        // Vertical center
        ctx.beginPath();
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width / 2, height);
        ctx.stroke();

        // Horizontal center (zero line)
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        ctx.setLineDash([]); // Reset line dash

        // Draw waveform with glow effect and increased sensitivity
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(59, 130, 246, 0.7)';
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgb(96, 165, 250)';
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        // Increased sensitivity/gain for better visualization
        const sensitivity = 3.5; // Amplify signal for better visibility

        for (let i = 0; i < bufferLength; i++) {
            // Normalize to -1 to 1 range, then apply sensitivity
            const normalized = (dataArray[i] - 128) / 128.0;
            const amplified = normalized * sensitivity;

            // Clamp to prevent overflow
            const clamped = Math.max(-1, Math.min(1, amplified));

            // Map to canvas coordinates (center at height/2)
            const y = (height / 2) + (clamped * (height / 2));

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        ctx.stroke();
        ctx.shadowBlur = 0;

        // Calculate and display stats
        if (showStats) {
            // Calculate RMS level
            let sumSquares = 0;
            let peak = 0;
            for (let i = 0; i < bufferLength; i++) {
                const normalized = (dataArray[i] - 128) / 128;
                sumSquares += normalized * normalized;
                peak = Math.max(peak, Math.abs(normalized));
            }
            const rms = Math.sqrt(sumSquares / bufferLength);

            // Get frequency data for peak frequency
            const freqData = new Uint8Array(analyserNode.frequencyBinCount);
            analyserNode.getByteFrequencyData(freqData);

            let maxIndex = 0;
            for (let i = 1; i < freqData.length; i++) {
                if (freqData[i] > freqData[maxIndex]) maxIndex = i;
            }
            const peakFrequency = maxIndex * (analyserNode.context.sampleRate / 2) / freqData.length;

            // Display stats in top-right corner
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = '10px monospace';
            ctx.textAlign = 'right';
            ctx.shadowBlur = 2;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.fillText(`Peak: ${peakFrequency.toFixed(0)} Hz`, width - 8, 14);
            ctx.fillText(`RMS: ${(rms * 100).toFixed(1)}%`, width - 8, 26);
            ctx.fillText(`Pk Lvl: ${(peak * 100).toFixed(1)}%`, width - 8, 38);
            ctx.shadowBlur = 0;
        }

        // Recording indicator
        ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.beginPath();
        ctx.arc(12, 12, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('LIVE', 22, 16);

        animationFrameId.current = requestAnimationFrame(draw);
    }, [analyserNode, isRecording, showStats]);

    useEffect(() => {
        if (isRecording && analyserNode) {
            animationFrameId.current = requestAnimationFrame(draw);
        } else {
            // Clear canvas when not recording
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = 'rgb(17, 24, 39)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    // Show "Not Recording" message
                    ctx.fillStyle = 'rgba(156, 163, 175, 0.5)';
                    ctx.font = '14px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('Oscilloscope (Idle)', canvas.width / 2, canvas.height / 2);
                }
            }
        }

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [draw, isRecording, analyserNode]);

    // Handle canvas resize
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const resizeObserver = new ResizeObserver(() => {
            if (isRecording && analyserNode) {
                cancelAnimationFrame(animationFrameId.current);
                animationFrameId.current = requestAnimationFrame(draw);
            }
        });

        resizeObserver.observe(canvas);
        return () => resizeObserver.disconnect();
    }, [draw, isRecording, analyserNode]);

    return (
        <div className="relative w-full rounded-lg overflow-hidden border border-gray-700 bg-gray-900" style={{ height: `${height}px` }}>
            <canvas
                ref={canvasRef}
                className="w-full h-full"
            />
        </div>
    );
};

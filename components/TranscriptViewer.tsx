import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DocumentDownloadIcon } from './icons/DocumentDownloadIcon';
import eventService from '../services/eventService';
import { Oscilloscope } from './Oscilloscope';
import type { ColorScheme, OscilloscopeTheme } from '../types';

interface SpectrogramSettings {
    minFrequency: number;
    maxFrequency: number;
    intensity: number;
    colorScheme: ColorScheme;
}

interface TranscriptViewerProps {
    title: string;
    content: string;
    isPlaying: boolean;
    analyserNode: AnalyserNode | null;
    spectrogramSettings: SpectrogramSettings;
    onSpectrogramChange: (settings: Partial<SpectrogramSettings>) => void;
    oscilloscopeTheme: OscilloscopeTheme;
    freqToSliderVal: (freq: number) => number;
    sliderValToFreq: (val: number) => number;
}

const MIN_HEIGHT = 80;
const MAX_HEIGHT = 400;

const TranscriptViewer: React.FC<TranscriptViewerProps> = ({ 
    title, 
    content, 
    isPlaying, 
    analyserNode, 
    spectrogramSettings, 
    onSpectrogramChange,
    oscilloscopeTheme,
    freqToSliderVal,
    sliderValToFreq,
}) => {
    const [containerHeight, setContainerHeight] = useState(150);
    const isResizingRef = useRef(false);
    const startYRef = useRef(0);
    const startHeightRef = useRef(0);

    const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isResizingRef.current = true;
        startYRef.current = e.clientY;
        startHeightRef.current = containerHeight;
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
    }, [containerHeight]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizingRef.current) return;
            const deltaY = e.clientY - startYRef.current;
            const newHeight = startHeightRef.current + deltaY;
            setContainerHeight(Math.max(MIN_HEIGHT, Math.min(newHeight, MAX_HEIGHT)));
        };

        const handleMouseUp = () => {
            if (isResizingRef.current) {
                isResizingRef.current = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // Helper function to parse Markdown-style links [text](url) into <a> tags
    const renderParagraph = (text: string) => {
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = linkRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(text.substring(lastIndex, match.index));
            }
            parts.push(
                <a 
                    key={match.index} 
                    href={match[2]} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-400 hover:text-blue-300 hover:underline transition-colors font-semibold"
                >
                    {match[1]}
                </a>
            );
            lastIndex = linkRegex.lastIndex;
        }
        if (lastIndex < text.length) {
            parts.push(text.substring(lastIndex));
        }
        return parts.length > 0 ? parts : text;
    };


    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {analyserNode && (
                <div 
                    className="relative flex-shrink-0 border-b border-gray-700/50"
                    style={{ height: `${containerHeight}px` }}
                >
                    <Oscilloscope 
                        analyserNode={analyserNode}
                        spectrogramSettings={spectrogramSettings}
                        isPlaying={isPlaying}
                        onSpectrogramChange={onSpectrogramChange}
                        oscilloscopeTheme={oscilloscopeTheme}
                        freqToSliderVal={freqToSliderVal}
                        sliderValToFreq={sliderValToFreq}
                    />
                     <div
                        onMouseDown={handleResizeMouseDown}
                        className="absolute -bottom-2 left-0 w-full h-4 flex items-center justify-center cursor-ns-resize z-20 group"
                        title="Drag to resize"
                    >
                         <div className="w-10 h-1.5 bg-gray-600/50 rounded-full group-hover:bg-gray-500 transition-colors" />
                    </div>
                </div>
            )}

            <div className="flex-1 p-6 md:p-10 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-start gap-4 mb-6">
                    <h2 className="text-3xl md:text-4xl font-bold text-blue-300 tracking-tight">{title}</h2>
                    <div className="relative group flex-shrink-0">
                        <button
                            onClick={() => eventService.emit('transcript:download')}
                            className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors duration-200"
                            aria-label="Download transcript"
                        >
                            <DocumentDownloadIcon />
                        </button>
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                            Download Transcript (.txt)
                        </div>
                    </div>
                </div>

                <div className="prose prose-invert prose-lg max-w-none text-gray-300 leading-relaxed">
                    {content.trim().split('\n\n').filter(p => p.trim() !== '').map((paragraph, index) => (
                        <p key={index} className="mb-4">{renderParagraph(paragraph)}</p>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TranscriptViewer;
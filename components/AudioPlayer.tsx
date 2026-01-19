
import React, { useState, useRef, useEffect } from 'react';
import { PlayIcon } from './icons/PlayIcon';
import { PauseIcon } from './icons/PauseIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { ExclamationIcon } from './icons/ExclamationIcon';
import eventService from '../services/eventService';
import { SkipBackwardIcon } from './icons/SkipBackwardIcon';
import { SkipForwardIcon } from './icons/SkipForwardIcon';
import { NextChapterIcon } from './icons/NextChapterIcon';
import { PreviousChapterIcon } from './icons/PreviousChapterIcon';


interface AudioPlayerProps {
    isPlaying: boolean;
    isLoading: boolean;
    isDownloading: boolean;
    progress: number;
    duration: number;
    elapsed: number;
    error: string | null;
    isFirstChapter: boolean;
    isLastChapter: boolean;
}

const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds <= 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
    isPlaying, 
    isLoading, 
    isDownloading, 
    progress, 
    duration, 
    elapsed,
    error,
    isFirstChapter,
    isLastChapter,
}) => {
    const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
    const downloadButtonRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (downloadButtonRef.current && !downloadButtonRef.current.contains(event.target as Node)) {
                setIsDownloadMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (error) {
        return (
            <div className="flex items-center gap-4 p-3 bg-red-900/50 border border-red-500/50 rounded-lg">
                <div className="flex-shrink-0 text-red-400">
                    <ExclamationIcon />
                </div>
                <div className="flex-1 text-sm text-red-200">
                    <p className="font-semibold">Audio Error</p>
                    <p className="text-xs opacity-80">{error}</p>
                </div>
                <button
                    onClick={() => eventService.emit('error:clear')}
                    className="p-2 rounded-md text-red-200 hover:bg-red-800/70 transition-colors"
                    aria-label="Dismiss error"
                >
                    Dismiss
                </button>
            </div>
        );
    }
    
    return (
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
                <button
                    onClick={() => eventService.emit('player:previous_chapter')}
                    disabled={isLoading || isDownloading || isFirstChapter}
                    className="w-12 h-12 flex items-center justify-center rounded-full text-gray-300 hover:bg-gray-700 transition-colors duration-200 disabled:text-gray-600 disabled:cursor-not-allowed"
                    aria-label="Previous Chapter"
                >
                    <PreviousChapterIcon />
                </button>
                <button
                    onClick={() => eventService.emit('player:skip_backward')}
                    disabled={isLoading || isDownloading}
                    className="w-12 h-12 flex items-center justify-center rounded-full text-gray-300 hover:bg-gray-700 transition-colors duration-200 disabled:text-gray-600 disabled:cursor-not-allowed"
                    aria-label="Skip backward 10 seconds"
                >
                    <SkipBackwardIcon />
                </button>
                <button
                    onClick={() => eventService.emit('player:play_pause')}
                    disabled={isLoading || isDownloading}
                    className="w-14 h-14 flex items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-900"
                    aria-label={isPlaying ? "Pause audio" : "Play audio"}
                >
                    {isLoading ? <SpinnerIcon /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
                 <button
                    onClick={() => eventService.emit('player:skip_forward')}
                    disabled={isLoading || isDownloading}
                    className="w-12 h-12 flex items-center justify-center rounded-full text-gray-300 hover:bg-gray-700 transition-colors duration-200 disabled:text-gray-600 disabled:cursor-not-allowed"
                    aria-label="Skip forward 10 seconds"
                >
                    <SkipForwardIcon />
                </button>
                <button
                    onClick={() => eventService.emit('player:next_chapter')}
                    disabled={isLoading || isDownloading || isLastChapter}
                    className="w-12 h-12 flex items-center justify-center rounded-full text-gray-300 hover:bg-gray-700 transition-colors duration-200 disabled:text-gray-600 disabled:cursor-not-allowed"
                    aria-label="Next Chapter"
                >
                    <NextChapterIcon />
                </button>
            </div>
            <div className="flex-1 flex items-center gap-3">
                <span className="text-sm text-gray-400 font-mono w-12 text-center" aria-hidden="true">{formatTime(elapsed)}</span>
                <div 
                    className="w-full bg-gray-700 rounded-full h-2"
                    role="progressbar"
                    aria-label="Audio progress"
                    aria-valuenow={Math.round(progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuetext={`${Math.round(progress)}%`}
                >
                    <div
                        className="bg-blue-400 h-2 rounded-full transition-all duration-150"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
                 <span className="text-sm text-gray-400 font-mono w-12 text-center" aria-hidden="true">{formatTime(duration)}</span>
            </div>
            <div className="relative group" ref={downloadButtonRef}>
                <button
                    onClick={() => setIsDownloadMenuOpen(prev => !prev)}
                    disabled={isLoading || isDownloading}
                    className="w-14 h-14 flex items-center justify-center rounded-full bg-gray-700 text-gray-300 hover:bg-gray-600 transition-all duration-200 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-900"
                    aria-label="Open download options"
                    aria-haspopup="true"
                    aria-expanded={isDownloadMenuOpen}
                >
                    {isDownloading ? <SpinnerIcon /> : <DownloadIcon />}
                </button>
                {isDownloadMenuOpen && (
                    <div className="absolute bottom-full mb-2 right-0 w-max bg-gray-900/80 backdrop-blur-sm border border-gray-700 text-white text-sm rounded-md shadow-lg z-20 animate-fade-in-up overflow-hidden">
                        <button
                            onClick={() => { eventService.emit('chapter:download', 'wav'); setIsDownloadMenuOpen(false); }}
                            className="block w-full text-left px-4 py-2 hover:bg-gray-700 transition-colors"
                        >WAV <span className="text-xs text-gray-400">(High Quality)</span></button>
                        <button
                            onClick={() => { eventService.emit('chapter:download', 'ogg'); setIsDownloadMenuOpen(false); }}
                            className="block w-full text-left px-4 py-2 hover:bg-gray-700 transition-colors border-t border-gray-700"
                        >OGG <span className="text-xs text-gray-400">(Small File)</span></button>
                    </div>
                )}
                 <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                    Download Chapter
                </div>
            </div>
        </div>
    );
};

export default AudioPlayer;

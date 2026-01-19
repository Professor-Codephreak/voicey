
import React, { useState, useRef, useEffect } from 'react';
import type { Chapter, FilterSettings, OscilloscopeTheme, ColorScheme } from '../types';
import { BookIcon } from './icons/BookIcon';
import type { VoiceEngine } from '../services/audioGenerationService';
import type { ElevenLabsVoice } from '../services/elevenLabsService';
import eventService from '../services/eventService';
import { PlaySymbolIcon } from './icons/PlaySymbolIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import { BookmarkIcon } from './icons/BookmarkIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { PlayCircleIcon } from './icons/PlayCircleIcon';
import { MixerIcon } from './icons/MixerIcon';
import { FilterIcon } from './icons/FilterIcon';
import { SpectrogramIcon } from './icons/SpectrogramIcon';
import { SoundWaveIcon } from './icons/SoundWaveIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import VoiceSelectorModal from './VoiceSelectorModal';
import MixerModal from './MixerModal';
import SettingsModal from './SettingsModal';
import VoiceCloneModal from './VoiceCloneModal';
import { APIProviderModal } from './APIProviderModal';
import { DataManagementModal } from './DataManagementModal';
import { AudioMixerModal } from './AudioMixerModal';
import { OpenAIVoice } from '../services/openaiService';
import { TogetherVoice } from '../services/togetherService';
import { MistralVoice } from '../services/mistralService';
import { LocalLLMConfig } from '../services/localLLMService';


interface SpectrogramSettings {
    minFrequency: number;
    maxFrequency: number;
    intensity: number;
    colorScheme: ColorScheme;
}

interface ChapterListProps {
    bookTitle: string;
    bookSubtitle: string;
    chapters: Chapter[];
    currentChapterIndex: number;
    isAlbumMode: boolean;
    isStartingAlbumMode: boolean;
    isDownloadingFullBook: boolean;
    voiceEngine: VoiceEngine;
    elevenLabsApiKey: string;
    elevenLabsVoices: ElevenLabsVoice[];
    elevenLabsVoiceId: string;
    openaiApiKey: string;
    openaiVoice: OpenAIVoice;
    togetherApiKey: string;
    togetherVoice: TogetherVoice;
    mistralApiKey: string;
    mistralVoice: MistralVoice;
    localLLMConfig: LocalLLMConfig | null;
    localLLMVoice: string;
    playbackRate: number;
    preCacheBufferCount: number;
    audioFormat: 'wav' | 'ogg';
    onAudioFormatChange: (format: 'wav' | 'ogg') => void;
    geminiVoice: string;
    spectrogramSettings: SpectrogramSettings;
    onSpectrogramChange: (settings: Partial<SpectrogramSettings>) => void;
    filterSettings: FilterSettings;
    onFilterSettingsChange: (settings: Partial<FilterSettings>) => void;
    oscilloscopeTheme: OscilloscopeTheme;
    onOscilloscopeThemeChange: (theme: OscilloscopeTheme) => void;
    freqToSliderVal: (freq: number) => number;
    sliderValToFreq: (val: number) => number;
    intensityToSliderVal: (intensity: number) => number;
    sliderValToIntensity: (val: number) => number;
    completedChapters: Set<number>;
    bookmarkedChapters: Set<number>;
    onVoiceEngineChange: (engine: VoiceEngine) => void;
    onOpenAIKeyChange: (key: string) => void;
    onElevenLabsKeyChange: (key: string) => void;
    onOpenAIVoiceChange: (voice: OpenAIVoice) => void;
    onTogetherKeyChange: (key: string) => void;
    onTogetherVoiceChange: (voice: TogetherVoice) => void;
    onMistralKeyChange: (key: string) => void;
    onMistralVoiceChange: (voice: MistralVoice) => void;
    onLocalLLMConfigChange: (config: LocalLLMConfig) => void;
    onLocalLLMVoiceChange: (voice: string) => void;
    onOpenBackgroundAudioModal?: () => void;
}

const getChapterDisplayTitle = (title: string): string => {
    const parts = title.split(':');
    if (parts.length > 1) {
        return parts.slice(1).join(':').trim();
    }
    return title.trim();
};

const ChapterList: React.FC<ChapterListProps> = ({
    bookTitle,
    bookSubtitle,
    chapters,
    currentChapterIndex,
    isAlbumMode: _isAlbumMode,
    isStartingAlbumMode,
    isDownloadingFullBook,
    voiceEngine,
    elevenLabsApiKey,
    elevenLabsVoices,
    elevenLabsVoiceId,
    openaiApiKey,
    openaiVoice,
    togetherApiKey,
    togetherVoice,
    mistralApiKey,
    mistralVoice,
    localLLMConfig,
    localLLMVoice,
    playbackRate,
    preCacheBufferCount,
    audioFormat,
    onAudioFormatChange,
    geminiVoice,
    spectrogramSettings,
    onSpectrogramChange,
    filterSettings,
    onFilterSettingsChange,
    oscilloscopeTheme,
    onOscilloscopeThemeChange,
    freqToSliderVal,
    sliderValToFreq,
    intensityToSliderVal,
    sliderValToIntensity,
    completedChapters,
    bookmarkedChapters,
    onVoiceEngineChange,
    onOpenAIKeyChange,
    onElevenLabsKeyChange,
    onOpenAIVoiceChange,
    onTogetherKeyChange,
    onTogetherVoiceChange,
    onMistralKeyChange,
    onMistralVoiceChange,
    onLocalLLMConfigChange,
    onLocalLLMVoiceChange,
    onOpenBackgroundAudioModal,
}) => {
    const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
    const [isMixMenuOpen, setIsMixMenuOpen] = useState(false);
    const [isRecordMenuOpen, setIsRecordMenuOpen] = useState(false);
    const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
    const [isAPIProviderModalOpen, setIsAPIProviderModalOpen] = useState(false);
    const [isDataManagementModalOpen, setIsDataManagementModalOpen] = useState(false);
    const [isAudioMixerModalOpen, setIsAudioMixerModalOpen] = useState(false);

    // UI State for Modals
    const [activeMixerTab, setActiveMixerTab] = useState<'filter' | 'visualizer' | null>(null);
    const [activeSettingsTab, setActiveSettingsTab] = useState<'playback' | 'voice' | 'downloads' | 'admin' | null>(null);
    const [voiceSelectorOpenFor, setVoiceSelectorOpenFor] = useState<VoiceEngine | null>(null);
    
    const toolsMenuRef = useRef<HTMLDivElement>(null);
    const mixMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
                setIsToolsMenuOpen(false);
            }
            if (mixMenuRef.current && !mixMenuRef.current.contains(event.target as Node)) {
                setIsMixMenuOpen(false);
            }
        };
        
        if (isToolsMenuOpen || isMixMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isToolsMenuOpen, isMixMenuOpen]);


    const handleCloneSuccess = () => {
        setIsCloneModalOpen(false);
    }
    
    const openMixer = (tab: 'filter' | 'visualizer') => {
        setActiveMixerTab(tab);
        setIsMixMenuOpen(false);
    };

    const openSettings = (tab: 'playback' | 'voice' | 'downloads' | 'admin') => {
        setActiveSettingsTab(tab);
        setIsToolsMenuOpen(false);
    };

    return (
        <>
            <aside className="w-full md:w-80 lg:w-96 bg-gray-900/70 border-b md:border-b-0 md:border-r border-gray-700/50 p-4 md:p-6 flex flex-col flex-shrink-0">
                
                <div className="flex items-start gap-3 mb-4">
                    <div className="relative group flex-shrink-0">
                        <BookIcon />
                        <button
                            onClick={() => eventService.emit('play:full_book')}
                            disabled={isStartingAlbumMode || isDownloadingFullBook}
                            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-0 disabled:cursor-wait"
                            aria-label="Play Full Audiobook"
                        >
                            <PlayCircleIcon />
                        </button>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-blue-300 tracking-wide">{bookTitle}</h1>
                        <p className="text-sm text-gray-400 -mt-1">{bookSubtitle}</p>
                    </div>
                </div>

                <button
                    onClick={() => eventService.emit('play:full_book')}
                    disabled={isStartingAlbumMode || isDownloadingFullBook}
                    className="w-full flex items-center justify-center gap-3 p-3 mb-4 rounded-lg bg-green-600/80 text-white font-semibold hover:bg-green-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:bg-gray-600 disabled:cursor-wait"
                >
                    {isStartingAlbumMode ? (
                        <>
                            <SpinnerIcon className="h-5 w-5" />
                            <span>Starting Audiobook...</span>
                        </>
                    ) : (
                        <>
                            <PlaySymbolIcon />
                            <span>Play Full Audiobook</span>
                        </>
                    )}
                </button>


                <nav className="flex-1 overflow-y-auto custom-scrollbar">
                    <ul>
                        {chapters.map((chapter, index) => (
                             <li key={index} className="mb-1">
                                <div
                                    className={`w-full text-left p-3 rounded-lg transition-colors duration-200 flex items-center justify-between ${
                                        currentChapterIndex === index
                                            ? 'bg-blue-600 text-white font-semibold shadow-lg'
                                            : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
                                    }`}
                                >
                                    <button
                                        onClick={() => eventService.emit('chapter:select', index)}
                                        className="flex-1 text-left overflow-hidden mr-2"
                                        aria-current={currentChapterIndex === index}
                                    >
                                        <span className="block text-xs opacity-80">Chapter {index + 1}</span>
                                        <span className="text-sm leading-tight line-clamp-4">{getChapterDisplayTitle(chapter.title)}</span>
                                    </button>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {completedChapters.has(index) && (
                                            <div title="Completed" className="text-green-400">
                                                <CheckCircleIcon />
                                            </div>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                eventService.emit('chapter:bookmark_toggle', index);
                                            }}
                                            className="p-1 rounded-full text-gray-400 hover:bg-gray-700/80 hover:text-yellow-400 transition-colors"
                                            title={bookmarkedChapters.has(index) ? "Remove Bookmark" : "Add Bookmark"}
                                            aria-label={bookmarkedChapters.has(index) ? "Remove Bookmark" : "Add Bookmark"}
                                            aria-pressed={bookmarkedChapters.has(index)}
                                        >
                                            <BookmarkIcon filled={bookmarkedChapters.has(index)} />
                                        </button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </nav>
                <div className="mt-auto pt-6 border-t border-gray-700/50">
                     <div className="flex items-center gap-2">
                        {/* Mix Settings Button */}
                        <div className="relative flex-1" ref={mixMenuRef}>
                            <button
                                onClick={() => setIsMixMenuOpen(prev => !prev)}
                                className={`w-full flex items-center justify-center gap-2 p-3 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-900 ${isMixMenuOpen ? 'bg-gray-600 text-white' : 'bg-gray-700/80 text-white hover:bg-gray-600'}`}
                                aria-haspopup="true"
                                aria-expanded={isMixMenuOpen}
                                disabled={isDownloadingFullBook}
                            >
                                <MixerIcon />
                                <span>Mix</span>
                            </button>
                             {isMixMenuOpen && (
                                <div className="absolute bottom-full left-0 mb-2 w-[calc(100vw-2.5rem)] md:w-[22rem] bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-50 p-2 animate-fade-in-up">
                                    <div className="space-y-2">
                                        <button 
                                            onClick={() => openMixer('filter')}
                                            className="w-full text-left p-3 rounded-lg bg-gradient-to-r from-blue-600/20 to-blue-600/5 hover:from-blue-600/40 hover:to-blue-600/10 border border-blue-500/30 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500 text-blue-300 group-hover:text-white transition-colors">
                                                    <FilterIcon />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-blue-200">Audio EQ & Filters</div>
                                                    <div className="text-xs text-blue-400/70">Shape tones & resonance</div>
                                                </div>
                                            </div>
                                        </button>
                                        
                                        <button
                                            onClick={() => openMixer('visualizer')}
                                            className="w-full text-left p-3 rounded-lg bg-gradient-to-r from-purple-600/20 to-purple-600/5 hover:from-purple-600/40 hover:to-purple-600/10 border border-purple-500/30 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-purple-500/20 rounded-lg group-hover:bg-purple-500 text-purple-300 group-hover:text-white transition-colors">
                                                    <SpectrogramIcon />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-purple-200">Visualizer Settings</div>
                                                    <div className="text-xs text-purple-400/70">Oscilloscope & Spectrogram</div>
                                                </div>
                                            </div>
                                        </button>

                                        {/* Voice Studio Button */}
                                        <button
                                            onClick={() => {
                                                openSettings('voice');
                                                setIsMixMenuOpen(false);
                                            }}
                                            className="w-full text-left p-3 rounded-lg bg-gradient-to-r from-orange-600/20 to-orange-600/5 hover:from-orange-600/40 hover:to-orange-600/10 border border-orange-500/30 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-orange-500/20 rounded-lg group-hover:bg-orange-500 text-orange-300 group-hover:text-white transition-colors">
                                                    <SoundWaveIcon />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-orange-200">Voice Studio</div>
                                                    <div className="text-xs text-orange-400/70">Engine, Voice Selection, Cloning</div>
                                                </div>
                                            </div>
                                        </button>

                                        {/* Professional Audio Mixer Button */}
                                        <button
                                            onClick={() => {
                                                setIsAudioMixerModalOpen(true);
                                                setIsMixMenuOpen(false);
                                            }}
                                            className="w-full text-left p-3 rounded-lg bg-gradient-to-r from-cyan-600/20 to-cyan-600/5 hover:from-cyan-600/40 hover:to-cyan-600/10 border border-cyan-500/30 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-cyan-500/20 rounded-lg group-hover:bg-cyan-500 text-cyan-300 group-hover:text-white transition-colors">
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-cyan-200">Professional Audio Mixer</div>
                                                    <div className="text-xs text-cyan-400/70">Mix Voice & Background with Dominance Control</div>
                                                </div>
                                            </div>
                                        </button>

                                        {/* Background Audio Button */}
                                        {onOpenBackgroundAudioModal && (
                                            <button
                                                onClick={() => {
                                                    onOpenBackgroundAudioModal();
                                                    setIsMixMenuOpen(false);
                                                }}
                                                className="w-full text-left p-3 rounded-lg bg-gradient-to-r from-green-600/20 to-green-600/5 hover:from-green-600/40 hover:to-green-600/10 border border-green-500/30 transition-all group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-green-500/20 rounded-lg group-hover:bg-green-500 text-green-300 group-hover:text-white transition-colors">
                                                        <SoundWaveIcon />
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-green-200">Background Audio</div>
                                                        <div className="text-xs text-green-400/70">Music & Ambient Sounds</div>
                                                    </div>
                                                </div>
                                            </button>
                                        )}

                                        {/* Record Audio Button with Submenu */}
                                        <div className="relative">
                                            <button
                                                onClick={() => setIsRecordMenuOpen(!isRecordMenuOpen)}
                                                onMouseEnter={() => setIsRecordMenuOpen(true)}
                                                className="w-full text-left p-3 rounded-lg bg-gradient-to-r from-red-600/20 to-red-600/5 hover:from-red-600/40 hover:to-red-600/10 border border-red-500/30 transition-all group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-red-500/20 rounded-lg group-hover:bg-red-500 text-red-300 group-hover:text-white transition-colors">
                                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-semibold text-red-200">Record Audio</div>
                                                        <div className="text-xs text-red-400/70">Voice or Background</div>
                                                    </div>
                                                    <svg className="w-4 h-4 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                            </button>

                                            {/* Record Submenu */}
                                            {isRecordMenuOpen && (
                                                <div
                                                    className="absolute left-full top-0 ml-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-50 p-2 animate-fade-in-up"
                                                    onMouseLeave={() => setIsRecordMenuOpen(false)}
                                                >
                                                    <div className="space-y-2">
                                                        <button
                                                            onClick={() => {
                                                                setIsCloneModalOpen(true);
                                                                setIsMixMenuOpen(false);
                                                                setIsRecordMenuOpen(false);
                                                            }}
                                                            className="w-full text-left p-3 rounded-lg bg-orange-600/10 hover:bg-orange-600/30 border border-orange-500/30 hover:border-orange-500/50 transition-all group"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="p-2 bg-orange-500/20 rounded-lg group-hover:bg-orange-500/40 text-orange-300 transition-colors">
                                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                                                    </svg>
                                                                </div>
                                                                <div>
                                                                    <div className="font-semibold text-orange-200 text-sm">Record Voice Sample</div>
                                                                    <div className="text-xs text-orange-400/70">Professional voice cloning</div>
                                                                </div>
                                                            </div>
                                                        </button>

                                                        {onOpenBackgroundAudioModal && (
                                                            <button
                                                                onClick={() => {
                                                                    onOpenBackgroundAudioModal();
                                                                    setIsMixMenuOpen(false);
                                                                    setIsRecordMenuOpen(false);
                                                                }}
                                                                className="w-full text-left p-3 rounded-lg bg-green-600/10 hover:bg-green-600/30 border border-green-500/30 hover:border-green-500/50 transition-all group"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className="p-2 bg-green-500/20 rounded-lg group-hover:bg-green-500/40 text-green-300 transition-colors">
                                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                                                                        </svg>
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-semibold text-green-200 text-sm">Record Background Audio</div>
                                                                        <div className="text-xs text-green-400/70">Music or ambient sounds</div>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        )}

                                                        <div className="pt-2 px-2 border-t border-gray-700">
                                                            <p className="text-xs text-gray-400">
                                                                💡 Opens recording interface with real-time quality feedback
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Tools & Settings Button */}
                        <div className="relative flex-1" ref={toolsMenuRef}>
                            <button
                                onClick={() => setIsToolsMenuOpen(prev => !prev)}
                                className={`w-full flex items-center justify-center gap-2 p-3 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-900 ${isToolsMenuOpen ? 'bg-blue-600 text-white shadow-lg' : 'bg-blue-500/80 text-white hover:bg-blue-600'}`}
                                aria-haspopup="true"
                                aria-expanded={isToolsMenuOpen}
                                disabled={isDownloadingFullBook}
                            >
                                <SettingsIcon />
                                <span>Settings</span>
                            </button>

                            {isToolsMenuOpen && (
                                <div className="absolute bottom-full right-0 md:bottom-0 md:left-full md:right-auto md:ml-4 mb-2 md:mb-0 w-[calc(100vw-2.5rem)] md:w-[22rem] bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-50 p-2 animate-fade-in-up">
                                    <div className="space-y-2">
                                        
                                        {/* Playback Launcher */}
                                        <button 
                                            onClick={() => openSettings('playback')}
                                            className="w-full text-left p-3 rounded-lg bg-gradient-to-r from-blue-600/20 to-blue-600/5 hover:from-blue-600/40 hover:to-blue-600/10 border border-blue-500/30 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500 text-blue-300 group-hover:text-white transition-colors">
                                                    <PlayCircleIcon />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-blue-200">Playback & General</div>
                                                    <div className="text-xs text-blue-400/70">Speed, Buffering, Cache</div>
                                                </div>
                                            </div>
                                        </button>

                                        {/* Voice Engine Launcher */}
                                        <button 
                                            onClick={() => openSettings('voice')}
                                            className="w-full text-left p-3 rounded-lg bg-gradient-to-r from-purple-600/20 to-purple-600/5 hover:from-purple-600/40 hover:to-purple-600/10 border border-purple-500/30 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-purple-500/20 rounded-lg group-hover:bg-purple-500 text-purple-300 group-hover:text-white transition-colors">
                                                    <SoundWaveIcon />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-purple-200">Voice Studio</div>
                                                    <div className="text-xs text-purple-400/70">Engine, Voice Selection, Cloning</div>
                                                </div>
                                            </div>
                                        </button>

                                        {/* Downloads Launcher */}
                                        <button
                                            onClick={() => openSettings('downloads')}
                                            className="w-full text-left p-3 rounded-lg bg-gradient-to-r from-green-600/20 to-green-600/5 hover:from-green-600/40 hover:to-green-600/10 border border-green-500/30 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-green-500/20 rounded-lg group-hover:bg-green-500 text-green-300 group-hover:text-white transition-colors">
                                                    <DownloadIcon />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-green-200">Library & Downloads</div>
                                                    <div className="text-xs text-green-400/70">Full Book, Offline Mode</div>
                                                </div>
                                            </div>
                                        </button>

                                        {/* Admin & Documentation Launcher */}
                                        <button
                                            onClick={() => openSettings('admin')}
                                            className="w-full text-left p-3 rounded-lg bg-gradient-to-r from-amber-600/20 to-amber-600/5 hover:from-amber-600/40 hover:to-amber-600/10 border border-amber-500/30 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-amber-500/20 rounded-lg group-hover:bg-amber-500 text-amber-300 group-hover:text-white transition-colors">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-amber-200">Admin & Docs</div>
                                                    <div className="text-xs text-amber-400/70">Guides, Mixing, Settings</div>
                                                </div>
                                            </div>
                                        </button>

                                        {/* API Provider Launcher */}
                                        <button
                                            onClick={() => {
                                                setIsAPIProviderModalOpen(true);
                                                setIsToolsMenuOpen(false);
                                            }}
                                            className="w-full text-left p-3 rounded-lg bg-gradient-to-r from-orange-600/20 to-orange-600/5 hover:from-orange-600/40 hover:to-orange-600/10 border border-orange-500/30 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-orange-500/20 rounded-lg group-hover:bg-orange-500 text-orange-300 group-hover:text-white transition-colors">
                                                    <SettingsIcon />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-orange-200">API Providers</div>
                                                    <div className="text-xs text-orange-400/70">Gemini, OpenAI, ElevenLabs, Local</div>
                                                </div>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => {
                                                setIsDataManagementModalOpen(true);
                                                setIsToolsMenuOpen(false);
                                            }}
                                            className="w-full text-left p-3 rounded-lg bg-gradient-to-r from-red-600/20 to-red-600/5 hover:from-red-600/40 hover:to-red-600/10 border border-red-500/30 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-red-500/20 rounded-lg group-hover:bg-red-500 text-red-300 group-hover:text-white transition-colors">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-red-200">Data Management</div>
                                                    <div className="text-xs text-red-400/70">Clear cache, delete files & reset app</div>
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </aside>
            
            {/* --- Modals --- */}
            
            {activeMixerTab && (
                <MixerModal
                    isOpen={!!activeMixerTab}
                    onClose={() => setActiveMixerTab(null)}
                    initialTab={activeMixerTab}
                    spectrogramSettings={spectrogramSettings}
                    onSpectrogramChange={onSpectrogramChange}
                    filterSettings={filterSettings}
                    onFilterSettingsChange={onFilterSettingsChange}
                    oscilloscopeTheme={oscilloscopeTheme}
                    onOscilloscopeThemeChange={onOscilloscopeThemeChange}
                    freqToSliderVal={freqToSliderVal}
                    sliderValToFreq={sliderValToFreq}
                    intensityToSliderVal={intensityToSliderVal}
                    sliderValToIntensity={sliderValToIntensity}
                />
            )}

            {activeSettingsTab && (
                <SettingsModal
                    isOpen={!!activeSettingsTab}
                    onClose={() => setActiveSettingsTab(null)}
                    initialTab={activeSettingsTab}
                    voiceEngine={voiceEngine}
                    elevenLabsApiKey={elevenLabsApiKey}
                    elevenLabsVoices={elevenLabsVoices}
                    elevenLabsVoiceId={elevenLabsVoiceId}
                    playbackRate={playbackRate}
                    preCacheBufferCount={preCacheBufferCount}
                    audioFormat={audioFormat}
                    onAudioFormatChange={onAudioFormatChange}
                    geminiVoice={geminiVoice}
                    isDownloadingFullBook={isDownloadingFullBook}
                    onOpenVoiceSelector={(engine) => setVoiceSelectorOpenFor(engine)}
                    onOpenCloneModal={() => setIsCloneModalOpen(true)}
                />
            )}

            {isCloneModalOpen && (
                <VoiceCloneModal
                    apiKey={elevenLabsApiKey}
                    onClose={() => setIsCloneModalOpen(false)}
                    onCloneSuccess={handleCloneSuccess}
                />
            )}

            {isAudioMixerModalOpen && (
                <AudioMixerModal
                    onClose={() => setIsAudioMixerModalOpen(false)}
                />
            )}

            {voiceSelectorOpenFor && (
                <VoiceSelectorModal
                    engine={voiceSelectorOpenFor}
                    isOpen={!!voiceSelectorOpenFor}
                    onClose={() => setVoiceSelectorOpenFor(null)}
                    elevenLabsVoices={elevenLabsVoices}
                    currentGeminiVoice={geminiVoice}
                    currentElevenLabsVoiceId={elevenLabsVoiceId}
                    onSelectGeminiVoice={(voice) => {
                        eventService.emit('settings:gemini_voice_change', voice);
                        setVoiceSelectorOpenFor(null);
                    }}
                    onSelectElevenLabsVoice={(voiceId) => {
                        eventService.emit('settings:elevenlabs_voice_change', voiceId);
                        setVoiceSelectorOpenFor(null);
                    }}
                    elevenLabsApiKey={elevenLabsApiKey}
                />
            )}

            <APIProviderModal
                isOpen={isAPIProviderModalOpen}
                onClose={() => setIsAPIProviderModalOpen(false)}
                currentEngine={voiceEngine}
                onEngineChange={onVoiceEngineChange}
                openaiApiKey={openaiApiKey}
                onOpenAIKeyChange={onOpenAIKeyChange}
                togetherApiKey={togetherApiKey}
                onTogetherKeyChange={onTogetherKeyChange}
                togetherVoice={togetherVoice}
                onTogetherVoiceChange={onTogetherVoiceChange}
                mistralApiKey={mistralApiKey}
                onMistralKeyChange={onMistralKeyChange}
                mistralVoice={mistralVoice}
                onMistralVoiceChange={onMistralVoiceChange}
                elevenLabsApiKey={elevenLabsApiKey}
                onElevenLabsKeyChange={onElevenLabsKeyChange}
                openaiVoice={openaiVoice}
                onOpenAIVoiceChange={onOpenAIVoiceChange}
                localLLMConfig={localLLMConfig}
                onLocalLLMConfigChange={onLocalLLMConfigChange}
                localLLMVoice={localLLMVoice}
                onLocalLLMVoiceChange={onLocalLLMVoiceChange}
            />

            <DataManagementModal
                isOpen={isDataManagementModalOpen}
                onClose={() => setIsDataManagementModalOpen(false)}
            />
        </>
    );
};

export default ChapterList;

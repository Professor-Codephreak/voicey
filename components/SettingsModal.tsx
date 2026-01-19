
import React, { useState, useEffect, useRef } from 'react';
import type { VoiceEngine } from '../services/audioGenerationService';
import { generatePreviewAudio } from '../services/audioGenerationService';
import type { ElevenLabsVoice } from '../services/elevenLabsService';
import { SettingsIcon } from './icons/SettingsIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { PlayCircleIcon } from './icons/PlayCircleIcon';
import { SoundWaveIcon } from './icons/SoundWaveIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { PlusCircleIcon } from './icons/PlusCircleIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { StopIcon } from './icons/StopIcon';
import { PlayIcon } from './icons/PlayIcon';
import eventService from '../services/eventService';
import { DocumentationViewer } from './DocumentationViewer';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab: 'playback' | 'voice' | 'downloads' | 'admin';
    voiceEngine: VoiceEngine;
    elevenLabsApiKey: string;
    elevenLabsVoices: ElevenLabsVoice[];
    elevenLabsVoiceId: string;
    playbackRate: number;
    preCacheBufferCount: number;
    geminiVoice: string;
    isDownloadingFullBook: boolean;
    audioFormat: 'wav' | 'ogg';
    onOpenVoiceSelector: (engine: VoiceEngine) => void;
    onOpenCloneModal: () => void;
    onAudioFormatChange: (format: 'wav' | 'ogg') => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    initialTab,
    voiceEngine,
    elevenLabsApiKey,
    elevenLabsVoices,
    elevenLabsVoiceId,
    playbackRate,
    preCacheBufferCount,
    geminiVoice,
    isDownloadingFullBook,
    audioFormat,
    onOpenVoiceSelector,
    onOpenCloneModal,
    onAudioFormatChange
}) => {
    const [activeTab, setActiveTab] = useState<'playback' | 'voice' | 'downloads' | 'admin'>(initialTab);
    const [apiKeyInput, setApiKeyInput] = useState(elevenLabsApiKey);
    const [bufferCountInput, setBufferCountInput] = useState(preCacheBufferCount);

    const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'playing'>('idle');
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const [viewingDoc, setViewingDoc] = useState<string | null>(null);

    // Update local state if prop changes
    useEffect(() => {
        setApiKeyInput(elevenLabsApiKey);
    }, [elevenLabsApiKey]);
    
    useEffect(() => {
        setBufferCountInput(preCacheBufferCount);
    }, [preCacheBufferCount]);

    // Stop preview if engine changes or modal closes
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setPreviewState('idle');
    }, [voiceEngine, isOpen]);

    const handlePlayActivePreview = async () => {
        if (previewState === 'playing') {
            audioRef.current?.pause();
            if(audioRef.current) audioRef.current.currentTime = 0;
            setPreviewState('idle');
            return;
        }

        setPreviewState('loading');
        try {
            const voiceId = voiceEngine === 'gemini' ? geminiVoice : elevenLabsVoiceId;
            if (!voiceId) {
                setPreviewState('idle');
                return;
            }

            const blob = await generatePreviewAudio(voiceEngine, voiceId, elevenLabsApiKey);
            const url = URL.createObjectURL(blob);
            
            if (!audioRef.current) {
                audioRef.current = new Audio();
            }
            
            audioRef.current.src = url;
            audioRef.current.onended = () => setPreviewState('idle');
            await audioRef.current.play();
            setPreviewState('playing');
        } catch (e) {
            console.error(e);
            setPreviewState('idle');
        }
    };

    if (!isOpen) return null;

    const selectedElevenLabsVoiceName = elevenLabsVoices.find(v => v.voice_id === elevenLabsVoiceId)?.name || 'Select Voice';

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-md transition-all duration-300"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div 
                className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gray-900/50">
                    <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-3">
                        <SettingsIcon />
                        Application Settings
                    </h2>
                    <button 
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <span className="text-2xl leading-none">&times;</span>
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-1/3 md:w-64 bg-gray-900/30 border-r border-gray-700 flex flex-col p-2 space-y-1">
                        <button
                            onClick={() => setActiveTab('playback')}
                            className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 ${
                                activeTab === 'playback' 
                                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 shadow-lg' 
                                    : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                            }`}
                        >
                            <PlayCircleIcon />
                            <span className="font-semibold">Playback</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('voice')}
                            className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 ${
                                activeTab === 'voice' 
                                    ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30 shadow-lg' 
                                    : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                            }`}
                        >
                            <SoundWaveIcon />
                            <span className="font-semibold">Voice Studio</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('downloads')}
                            className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 ${
                                activeTab === 'downloads'
                                    ? 'bg-green-600/20 text-green-300 border border-green-500/30 shadow-lg'
                                    : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                            }`}
                        >
                            <DownloadIcon />
                            <span className="font-semibold">Downloads</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('admin')}
                            className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 ${
                                activeTab === 'admin'
                                    ? 'bg-orange-600/20 text-orange-300 border border-orange-500/30 shadow-lg'
                                    : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                            }`}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="font-semibold">Admin</span>
                        </button>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar bg-gray-800/50">
                        
                        {/* --- PLAYBACK TAB --- */}
                        {activeTab === 'playback' && (
                            <div className="space-y-8 animate-fade-in-up">
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-6 border-b border-gray-700 pb-2">Audio Configuration</h3>
                                    
                                    <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700/50 mb-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <div>
                                                <label className="text-lg font-medium text-gray-200 block">Playback Speed</label>
                                                <p className="text-sm text-gray-400">Adjust the speaking rate.</p>
                                            </div>
                                            <span className="font-mono text-xl text-blue-400 font-bold bg-blue-400/10 px-3 py-1 rounded-lg">{playbackRate.toFixed(2)}x</span>
                                        </div>
                                        <input 
                                            type="range" min="0.5" max="2" step="0.05" 
                                            value={playbackRate} 
                                            onChange={(e) => eventService.emit('settings:playback_rate_change', parseFloat(e.target.value))} 
                                            className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                                        />
                                        <div className="flex justify-between text-xs text-gray-500 mt-2 font-mono">
                                            <span>0.5x</span>
                                            <span>1.0x</span>
                                            <span>2.0x</span>
                                        </div>
                                    </div>

                                    <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700/50">
                                        <div className="flex justify-between items-center mb-4">
                                            <div>
                                                <label className="text-lg font-medium text-gray-200 block">Streaming Buffer</label>
                                                <p className="text-sm text-gray-400">Number of chapters to pre-load.</p>
                                            </div>
                                            <span className="font-mono text-xl text-blue-400 font-bold bg-blue-400/10 px-3 py-1 rounded-lg">{bufferCountInput} ch</span>
                                        </div>
                                        <input 
                                            type="range" min="1" max="5" step="1" 
                                            value={bufferCountInput} 
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value, 10);
                                                setBufferCountInput(val);
                                                eventService.emit('settings:pre_cache_change', val);
                                            }}
                                            className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                                        />
                                        <p className="text-xs text-gray-500 mt-3">
                                            Higher buffer creates smoother playback but uses more data/credits.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- VOICE TAB --- */}
                        {activeTab === 'voice' && (
                            <div className="space-y-8 animate-fade-in-up">
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-6 border-b border-gray-700 pb-2">Voice Engine</h3>
                                    
                                    <div className="grid grid-cols-2 gap-4 mb-8">
                                        <button 
                                            onClick={() => eventService.emit('settings:engine_change', 'gemini')}
                                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${voiceEngine === 'gemini' ? 'border-blue-500 bg-blue-500/10 text-white shadow-lg' : 'border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-750'}`}
                                        >
                                            <div className={`p-2 rounded-full ${voiceEngine === 'gemini' ? 'bg-blue-500' : 'bg-gray-700'}`}>
                                                <SettingsIcon /> 
                                            </div>
                                            <div className="text-center">
                                                <div className="font-bold">Google Gemini</div>
                                                <div className="text-xs opacity-70">Fast, High Quality</div>
                                            </div>
                                        </button>

                                        <button 
                                            onClick={() => eventService.emit('settings:engine_change', 'elevenlabs')}
                                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${voiceEngine === 'elevenlabs' ? 'border-purple-500 bg-purple-500/10 text-white shadow-lg' : 'border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-750'}`}
                                        >
                                            <div className={`p-2 rounded-full ${voiceEngine === 'elevenlabs' ? 'bg-purple-500' : 'bg-gray-700'}`}>
                                                <SoundWaveIcon />
                                            </div>
                                            <div className="text-center">
                                                <div className="font-bold">ElevenLabs</div>
                                                <div className="text-xs opacity-70">Ultra-Realistic, Cloning</div>
                                            </div>
                                        </button>
                                    </div>

                                    {voiceEngine === 'gemini' && (
                                        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700/50 animate-fade-in-up">
                                            <label className="text-sm font-medium text-gray-400 mb-2 block">Active Voice</label>
                                            <div 
                                                onClick={() => onOpenVoiceSelector('gemini')}
                                                className="w-full flex justify-between items-center p-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-blue-500 rounded-xl text-white transition-all group shadow-sm cursor-pointer"
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') onOpenVoiceSelector('gemini'); }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handlePlayActivePreview(); }} 
                                                        className="w-10 h-10 flex-shrink-0 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-colors z-10 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                        aria-label="Preview active voice"
                                                    >
                                                        {previewState === 'loading' ? <SpinnerIcon className="w-5 h-5"/> : previewState === 'playing' ? <StopIcon /> : <div className="w-5 h-5"><PlayIcon /></div>}
                                                    </button>
                                                    <div className="text-left">
                                                        <div className="font-bold text-lg">{geminiVoice}</div>
                                                        <div className="text-xs text-gray-400">Gemini Standard Voice</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 text-gray-500 group-hover:text-blue-400 transition-colors">
                                                    <span className="text-sm font-medium">Change</span>
                                                    <ChevronDownIcon />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {voiceEngine === 'elevenlabs' && (
                                        <div className="space-y-6 animate-fade-in-up">
                                            <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700/50">
                                                <label className="text-sm font-medium text-gray-400 mb-2 block">API Configuration</label>
                                                <div className="flex gap-3">
                                                    <input 
                                                        type="password" 
                                                        value={apiKeyInput} 
                                                        onChange={(e) => setApiKeyInput(e.target.value)} 
                                                        placeholder="Enter your ElevenLabs API Key" 
                                                        className="flex-1 p-3 bg-gray-800 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-purple-500 outline-none transition-all" 
                                                    />
                                                    <button 
                                                        onClick={() => eventService.emit('settings:apikey_save', apiKeyInput)} 
                                                        className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-purple-900/20"
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2 ml-1">Your key is stored locally in your browser and never transmitted to our servers.</p>
                                            </div>

                                            <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700/50">
                                                <label className="text-sm font-medium text-gray-400 mb-2 block">Voice Model</label>
                                                <div className="flex gap-3">
                                                    <div 
                                                        onClick={() => { if (elevenLabsApiKey && elevenLabsVoices.length > 0) onOpenVoiceSelector('elevenlabs'); }} 
                                                        className={`flex-1 flex justify-between items-center p-3 bg-gray-800 border border-gray-600 rounded-xl text-white transition-all group ${(!elevenLabsApiKey || elevenLabsVoices.length === 0) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700 hover:border-purple-500 cursor-pointer'}`}
                                                        role="button"
                                                        tabIndex={0}
                                                        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && elevenLabsApiKey && elevenLabsVoices.length > 0) onOpenVoiceSelector('elevenlabs'); }}
                                                    >
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                             <button 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    if(elevenLabsApiKey && elevenLabsVoices.length > 0) handlePlayActivePreview(); 
                                                                }} 
                                                                className="w-10 h-10 flex-shrink-0 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center hover:bg-purple-500 hover:text-white transition-colors z-10 focus:outline-none focus:ring-2 focus:ring-purple-400"
                                                                aria-label="Preview active voice"
                                                                disabled={!elevenLabsApiKey || elevenLabsVoices.length === 0}
                                                             >
                                                                {previewState === 'loading' ? <SpinnerIcon className="w-5 h-5"/> : previewState === 'playing' ? <StopIcon /> : <div className="w-5 h-5"><PlayIcon /></div>}
                                                            </button>
                                                            <div className="text-left truncate">
                                                                <div className="font-bold text-lg truncate">{selectedElevenLabsVoiceName}</div>
                                                                <div className="text-xs text-gray-400">ElevenLabs Voice</div>
                                                            </div>
                                                        </div>
                                                        <ChevronDownIcon className="text-gray-500 group-hover:text-purple-400 flex-shrink-0" />
                                                    </div>
                                                    <button 
                                                        onClick={onOpenCloneModal}
                                                        className="p-3 bg-purple-600/10 text-purple-400 border border-purple-500/30 hover:bg-purple-600 hover:text-white rounded-xl transition-colors disabled:opacity-50 flex flex-col items-center justify-center w-20"
                                                        title="Add / Clone Voice"
                                                        disabled={!elevenLabsApiKey}
                                                    >
                                                        <PlusCircleIcon />
                                                        <span className="text-[10px] font-bold mt-1">NEW</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* --- DOWNLOADS TAB --- */}
                        {activeTab === 'downloads' && (
                            <div className="space-y-8 animate-fade-in-up">
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-6 border-b border-gray-700 pb-2">Library & Downloads</h3>

                                    <div className="space-y-6">

                                        {/* Audio Format Selection */}
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Download Format</h4>
                                            <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700/50">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <button
                                                        onClick={() => onAudioFormatChange('ogg')}
                                                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                                                            audioFormat === 'ogg'
                                                                ? 'border-green-500 bg-green-500/10 shadow-lg'
                                                                : 'border-gray-700 bg-gray-800 hover:bg-gray-750'
                                                        }`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                                                audioFormat === 'ogg'
                                                                    ? 'border-green-500 bg-green-500'
                                                                    : 'border-gray-600 bg-transparent'
                                                            }`}>
                                                                {audioFormat === 'ogg' && (
                                                                    <div className="w-2 h-2 bg-white rounded-full"></div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div className={`font-bold mb-1 ${
                                                                    audioFormat === 'ogg' ? 'text-white' : 'text-gray-300'
                                                                }`}>OGG Format</div>
                                                                <p className="text-sm text-gray-400">Smaller file size, better for storage and streaming (recommended)</p>
                                                            </div>
                                                        </div>
                                                    </button>

                                                    <button
                                                        onClick={() => onAudioFormatChange('wav')}
                                                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                                                            audioFormat === 'wav'
                                                                ? 'border-green-500 bg-green-500/10 shadow-lg'
                                                                : 'border-gray-700 bg-gray-800 hover:bg-gray-750'
                                                        }`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                                                audioFormat === 'wav'
                                                                    ? 'border-green-500 bg-green-500'
                                                                    : 'border-gray-600 bg-transparent'
                                                            }`}>
                                                                {audioFormat === 'wav' && (
                                                                    <div className="w-2 h-2 bg-white rounded-full"></div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div className={`font-bold mb-1 ${
                                                                    audioFormat === 'wav' ? 'text-white' : 'text-gray-300'
                                                                }`}>WAV Format</div>
                                                                <p className="text-sm text-gray-400">Uncompressed, higher quality, larger file size</p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Full Audiobook Section */}
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Full Audiobook (Single File)</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <button 
                                                    disabled={isDownloadingFullBook}
                                                    onClick={() => eventService.emit('download:full_book', 'wav')}
                                                    className="group relative p-6 bg-gray-900/50 border border-gray-700/50 hover:border-green-500/50 hover:bg-gray-800 rounded-xl transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="absolute top-4 right-4 text-gray-600 group-hover:text-green-500 transition-colors">
                                                        <DownloadIcon />
                                                    </div>
                                                    <div className="text-lg font-bold text-gray-200 group-hover:text-white mb-1">Combined WAV</div>
                                                    <p className="text-sm text-gray-400">Entire book as one high-fidelity file.</p>
                                                </button>

                                                <button 
                                                    disabled={isDownloadingFullBook}
                                                    onClick={() => eventService.emit('download:full_book', 'ogg')}
                                                    className="group relative p-6 bg-gray-900/50 border border-gray-700/50 hover:border-green-500/50 hover:bg-gray-800 rounded-xl transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="absolute top-4 right-4 text-gray-600 group-hover:text-green-500 transition-colors">
                                                        <DownloadIcon />
                                                    </div>
                                                    <div className="text-lg font-bold text-gray-200 group-hover:text-white mb-1">Combined OGG</div>
                                                    <p className="text-sm text-gray-400">Entire book as one compressed file.</p>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Batch Section */}
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Individual Chapters (Batch)</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <button 
                                                    disabled={isDownloadingFullBook}
                                                    onClick={() => eventService.emit('download:all_chapters', 'wav')}
                                                    className="group relative p-6 bg-gray-900/50 border border-gray-700/50 hover:border-blue-500/50 hover:bg-gray-800 rounded-xl transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="absolute top-4 right-4 text-gray-600 group-hover:text-blue-500 transition-colors">
                                                        <DownloadIcon />
                                                    </div>
                                                    <div className="text-lg font-bold text-gray-200 group-hover:text-white mb-1">Batch WAV</div>
                                                    <p className="text-sm text-gray-400">Download every chapter as a separate file.</p>
                                                </button>

                                                <button 
                                                    disabled={isDownloadingFullBook}
                                                    onClick={() => eventService.emit('download:all_chapters', 'ogg')}
                                                    className="group relative p-6 bg-gray-900/50 border border-gray-700/50 hover:border-blue-500/50 hover:bg-gray-800 rounded-xl transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="absolute top-4 right-4 text-gray-600 group-hover:text-blue-500 transition-colors">
                                                        <DownloadIcon />
                                                    </div>
                                                    <div className="text-lg font-bold text-gray-200 group-hover:text-white mb-1">Batch OGG</div>
                                                    <p className="text-sm text-gray-400">Download every chapter as a separate compressed file.</p>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Cache Section */}
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Offline Access</h4>
                                            <button 
                                                disabled={isDownloadingFullBook}
                                                onClick={() => eventService.emit('cache:full_book')}
                                                className="w-full group relative p-6 bg-gray-900/50 border border-gray-700/50 hover:border-purple-500/50 hover:bg-gray-800 rounded-xl transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <div className="absolute top-4 right-4 text-gray-600 group-hover:text-purple-500 transition-colors">
                                                    <PlayCircleIcon />
                                                </div>
                                                <div className="text-lg font-bold text-gray-200 group-hover:text-white mb-1">Pre-Cache to Browser</div>
                                                <p className="text-sm text-gray-400">Store audio locally for instant playback without downloading files.</p>
                                            </button>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- ADMIN TAB --- */}
                        {activeTab === 'admin' && (
                            <div className="space-y-8 animate-fade-in-up">
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-6 border-b border-gray-700 pb-2">Admin & Documentation</h3>

                                    <div className="space-y-6">
                                        {/* Documentation Section */}
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Documentation</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                <button
                                                    onClick={() => setViewingDoc('README.md')}
                                                    className="group relative p-6 bg-gray-900/50 border border-gray-700/50 hover:border-blue-500/50 hover:bg-gray-800 rounded-xl transition-all text-left"
                                                >
                                                    <div className="absolute top-4 right-4 text-gray-600 group-hover:text-blue-500 transition-colors">
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                    </div>
                                                    <div className="text-lg font-bold text-gray-200 group-hover:text-white mb-1">README</div>
                                                    <p className="text-sm text-gray-400">Quick start guide</p>
                                                </button>

                                                <button
                                                    onClick={() => setViewingDoc('TECHNICAL.md')}
                                                    className="group relative p-6 bg-gray-900/50 border border-gray-700/50 hover:border-purple-500/50 hover:bg-gray-800 rounded-xl transition-all text-left"
                                                >
                                                    <div className="absolute top-4 right-4 text-gray-600 group-hover:text-purple-500 transition-colors">
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                                        </svg>
                                                    </div>
                                                    <div className="text-lg font-bold text-gray-200 group-hover:text-white mb-1">TECHNICAL</div>
                                                    <p className="text-sm text-gray-400">Architecture & APIs</p>
                                                </button>

                                                <button
                                                    onClick={() => setViewingDoc('ADMIN.md')}
                                                    className="group relative p-6 bg-gray-900/50 border border-gray-700/50 hover:border-orange-500/50 hover:bg-gray-800 rounded-xl transition-all text-left"
                                                >
                                                    <div className="absolute top-4 right-4 text-gray-600 group-hover:text-orange-500 transition-colors">
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                                        </svg>
                                                    </div>
                                                    <div className="text-lg font-bold text-gray-200 group-hover:text-white mb-1">ADMIN GUIDE</div>
                                                    <p className="text-sm text-gray-400">Mixing & settings</p>
                                                </button>

                                                <button
                                                    onClick={() => setViewingDoc('TODO.md')}
                                                    className="group relative p-6 bg-gray-900/50 border border-gray-700/50 hover:border-yellow-500/50 hover:bg-gray-800 rounded-xl transition-all text-left"
                                                >
                                                    <div className="absolute top-4 right-4 text-gray-600 group-hover:text-yellow-500 transition-colors">
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                                        </svg>
                                                    </div>
                                                    <div className="text-lg font-bold text-gray-200 group-hover:text-white mb-1">TODO & STATUS</div>
                                                    <p className="text-sm text-gray-400">Roadmap & limits</p>
                                                </button>
                                            </div>
                                        </div>

                                        {/* System Information */}
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">System Information</h4>
                                            <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700/50">
                                                <div className="space-y-3 font-mono text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-400">Version:</span>
                                                        <span className="text-white">1.0.0</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-400">Build:</span>
                                                        <span className="text-white">Vite + React + TypeScript</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-400">Storage:</span>
                                                        <span className="text-white">IndexedDB</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-400">Audio Engine:</span>
                                                        <span className="text-white">Web Audio API</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quick Links */}
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <button
                                                    onClick={() => window.open('http://localhost:3001/health', '_blank')}
                                                    className="group relative p-6 bg-gray-900/50 border border-gray-700/50 hover:border-green-500/50 hover:bg-gray-800 rounded-xl transition-all text-left"
                                                >
                                                    <div className="absolute top-4 right-4 text-gray-600 group-hover:text-green-500 transition-colors">
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                    </div>
                                                    <div className="text-lg font-bold text-gray-200 group-hover:text-white mb-1">Server Status</div>
                                                    <p className="text-sm text-gray-400">Check audio conversion server health</p>
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        console.log('App State:', {
                                                            voiceEngine,
                                                            playbackRate,
                                                            preCacheBufferCount,
                                                            audioFormat
                                                        });
                                                        alert('Check browser console for app state details');
                                                    }}
                                                    className="group relative p-6 bg-gray-900/50 border border-gray-700/50 hover:border-orange-500/50 hover:bg-gray-800 rounded-xl transition-all text-left"
                                                >
                                                    <div className="absolute top-4 right-4 text-gray-600 group-hover:text-orange-500 transition-colors">
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                    </div>
                                                    <div className="text-lg font-bold text-gray-200 group-hover:text-white mb-1">Debug Info</div>
                                                    <p className="text-sm text-gray-400">Log current app state to console</p>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>

            {/* Documentation Viewer Modal */}
            {viewingDoc && (
                <DocumentationViewer
                    filePath={viewingDoc}
                    onClose={() => setViewingDoc(null)}
                />
            )}
        </div>
    );
};

export default SettingsModal;

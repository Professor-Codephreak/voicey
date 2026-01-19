
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { VoiceEngine } from '../services/audioGenerationService';
import { generatePreviewAudio } from '../services/audioGenerationService';
import type { ElevenLabsVoice } from '../services/elevenLabsService';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { SoundWaveIcon } from './icons/SoundWaveIcon';
import { StopIcon } from './icons/StopIcon';

// A curated list of descriptors for Gemini voices to improve user experience.
const GEMINI_VOICES: Record<string, { name: string, gender: string, tone: string }> = {
    'Achernar': { name: 'Achernar', gender: 'Male', tone: 'Deep, Resonant' },
    'Achird': { name: 'Achird', gender: 'Female', tone: 'Bright, Clear' },
    'Algenib': { name: 'Algenib', gender: 'Male', tone: 'Steady, Authoritative' },
    'Algieba': { name: 'Algieba', gender: 'Female', tone: 'Warm, Gentle' },
    'Alnilam': { name: 'Alnilam', gender: 'Male', tone: 'Crisp, Professional' },
    'Aoede': { name: 'Aoede', gender: 'Female', tone: 'Melodic, Expressive' },
    'Autonoe': { name: 'Autonoe', gender: 'Female', tone: 'Calm, Soothing' },
    'Callirrhoe': { name: 'Callirrhoe', gender: 'Female', tone: 'Energetic, Youthful' },
    'Charon': { name: 'Charon', gender: 'Male', tone: 'Gravelly, Mature' },
    'Despina': { name: 'Despina', gender: 'Female', tone: 'Soft, Whispery' },
    'Enceladus': { name: 'Enceladus', gender: 'Male', tone: 'Heroic, Strong' },
    'Erinome': { name: 'Erinome', gender: 'Female', tone: 'Raspy, Experienced' },
    'Fenrir': { name: 'Fenrir', gender: 'Male', tone: 'Intense, Commanding' },
    'Gacrux': { name: 'Gacrux', gender: 'Male', tone: 'Friendly, Approachable' },
    'Iapetus': { name: 'Iapetus', gender: 'Male', tone: 'Grand, Storyteller' },
    'Kore': { name: 'Kore', gender: 'Female', tone: 'Balanced, Neutral' },
    'Laomedeia': { name: 'Laomedeia', gender: 'Female', tone: 'Elegant, Refined' },
    'Leda': { name: 'Leda', gender: 'Female', tone: 'Playful, Light' },
    'Orus': { name: 'Orus', gender: 'Male', tone: 'Clear, Announcer' },
    'Puck': { name: 'Puck', gender: 'Male', tone: 'Youthful, Mischievous' },
    'Pulcherrima': { name: 'Pulcherrima', gender: 'Female', tone: 'Rich, Alto' },
    'Rasalgethi': { name: 'Rasalgethi', gender: 'Male', tone: 'Aged, Wise' },
    'Sadachbia': { name: 'Sadachbia', gender: 'Male', tone: 'Smooth, Baritone' },
    'Sadaltager': { name: 'Sadaltager', gender: 'Male', tone: 'Upbeat, Dynamic' },
    'Schedar': { name: 'Schedar', gender: 'Female', tone: 'Mature, Confident' },
    'Sulafat': { name: 'Sulafat', gender: 'Male', tone: 'Deep, Thoughtful' },
    'Umbriel': { name: 'Umbriel', gender: 'Male', tone: 'Mysterious, Dark' },
    'Vindemiatrix': { name: 'Vindemiatrix', gender: 'Female', tone: 'Sharp, Intellectual' },
    'Zephyr': { name: 'Zephyr', gender: 'Male', tone: 'Warm, Engaging' },
    'Zubenelgenubi': { name: 'Zubenelgenubi', gender: 'Male', tone: 'Unique, Exotic' }
};

interface VoiceSelectorModalProps {
    engine: VoiceEngine;
    isOpen: boolean;
    onClose: () => void;
    elevenLabsVoices: ElevenLabsVoice[];
    currentGeminiVoice: string;
    currentElevenLabsVoiceId: string;
    onSelectGeminiVoice: (voiceName: string) => void;
    onSelectElevenLabsVoice: (voiceId: string) => void;
    elevenLabsApiKey: string | null;
}

const VoiceSelectorModal: React.FC<VoiceSelectorModalProps> = ({
    engine,
    isOpen,
    onClose,
    elevenLabsVoices,
    currentGeminiVoice,
    currentElevenLabsVoiceId,
    onSelectGeminiVoice,
    onSelectElevenLabsVoice,
    elevenLabsApiKey,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [previewState, setPreviewState] = useState<{ id: string; status: 'loading' | 'playing' } | null>(null);
    
    // Use a ref to cache generated preview audio URLs.
    const previewCache = useRef<Map<string, string>>(new Map());
    const audioRef = useRef<HTMLAudioElement>(null);

    const filteredVoices = useMemo(() => {
        const lowerCaseSearch = searchTerm.toLowerCase();
        if (engine === 'gemini') {
            return Object.values(GEMINI_VOICES).filter(v => 
                v.name.toLowerCase().includes(lowerCaseSearch) ||
                v.gender.toLowerCase().includes(lowerCaseSearch) ||
                v.tone.toLowerCase().includes(lowerCaseSearch)
            );
        } else {
            return elevenLabsVoices.filter(v => 
                v.name.toLowerCase().includes(lowerCaseSearch) ||
                v.category.toLowerCase().includes(lowerCaseSearch)
            );
        }
    }, [searchTerm, engine, elevenLabsVoices]);

    const stopPreview = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setPreviewState(null);
    };

    const handlePlayPreview = async (voiceIdentifier: string) => {
        if (previewState?.id === voiceIdentifier && previewState.status === 'playing') {
            stopPreview();
            return;
        }

        stopPreview();

        // Check the cache first to avoid re-generating the audio.
        if (previewCache.current.has(voiceIdentifier)) {
            const url = previewCache.current.get(voiceIdentifier)!;
            if (audioRef.current) {
                audioRef.current.src = url;
                audioRef.current.play();
                setPreviewState({ id: voiceIdentifier, status: 'playing' });
            }
            return;
        }

        setPreviewState({ id: voiceIdentifier, status: 'loading' });
        try {
            const blob = await generatePreviewAudio(engine, voiceIdentifier, elevenLabsApiKey);
            const url = URL.createObjectURL(blob);
            
            // Store the newly generated URL in the cache for future use.
            previewCache.current.set(voiceIdentifier, url);
            
            if (audioRef.current) {
                audioRef.current.src = url;
                audioRef.current.play();
                setPreviewState({ id: voiceIdentifier, status: 'playing' });
            }
        } catch (error) {
            console.error("Failed to generate voice preview:", error);
            setPreviewState(null); // Reset on error
        }
    };
    
    useEffect(() => {
        const audioEl = audioRef.current;
        const handleEnded = () => {
            setPreviewState(null);
        };
        audioEl?.addEventListener('ended', handleEnded);
        return () => {
            audioEl?.removeEventListener('ended', handleEnded);
        };
    }, []);

    if (!isOpen) return null;

    const title = engine === 'gemini' ? "Select Gemini Voice" : "Select ElevenLabs Voice";
    const accentColor = engine === 'gemini' ? "blue" : "purple";

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-modal-title"
        >
            <div 
                className={`bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-lg text-white animate-fade-in-up flex flex-col h-full max-h-[80vh]`}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex-shrink-0 p-4 border-b border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <h2 id="voice-modal-title" className={`text-xl font-bold text-${accentColor}-300`}>{title}</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
                    </div>
                    <input
                        type="text"
                        placeholder="Search voices by name, gender, tone, or category..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className={`w-full p-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-${accentColor}-500 focus:border-${accentColor}-500`}
                    />
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    <ul className="space-y-1">
                        {filteredVoices.map((voice: any) => {
                            const isGemini = engine === 'gemini';
                            const id = isGemini ? voice.name : voice.voice_id;
                            const isSelected = isGemini ? voice.name === currentGeminiVoice : voice.voice_id === currentElevenLabsVoiceId;

                            return (
                                <li key={id}>
                                    <button 
                                        onClick={() => isGemini ? onSelectGeminiVoice(id) : onSelectElevenLabsVoice(id)}
                                        className={`w-full text-left p-3 rounded-lg flex items-center gap-4 transition-colors ${isSelected ? `bg-${accentColor}-600/50 ring-2 ring-${accentColor}-500` : 'hover:bg-gray-700/60'}`}
                                    >
                                        <div className="flex-shrink-0">
                                            <button 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    // Generate and play a short audio sample for the selected voice.
                                                    handlePlayPreview(id); 
                                                }} 
                                                className={`w-10 h-10 flex items-center justify-center rounded-full bg-gray-900/50 hover:bg-gray-600/50 transition-colors text-${accentColor}-300`}
                                                aria-label={`Preview voice ${voice.name}`}
                                            >
                                                {previewState?.id === id && previewState?.status === 'loading' && <SpinnerIcon className="w-5 h-5" />}
                                                {previewState?.id === id && previewState?.status === 'playing' && <StopIcon />}
                                                {(!previewState || previewState.id !== id) && <SoundWaveIcon />}
                                            </button>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-200">{voice.name}</p>
                                            <div className="text-xs text-gray-400 flex items-center gap-2 flex-wrap">
                                                {isGemini ? (
                                                    <>
                                                        <span>{voice.gender}</span>
                                                        <span className="w-1 h-1 bg-gray-600 rounded-full" />
                                                        <span>{voice.tone}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="capitalize px-1.5 py-0.5 bg-gray-600 rounded-full">{voice.category}</span>
                                                        {Object.entries(voice.labels).map(([key, value]) => (
                                                             <span key={key} className="capitalize">{value as string}</span>
                                                        ))}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <audio ref={audioRef} className="hidden" />
            </div>
        </div>
    );
};

export default VoiceSelectorModal;

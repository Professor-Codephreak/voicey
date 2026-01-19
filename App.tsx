
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { generateChapterAudio, generateAudioAsService } from './services/audioGenerationService';
import type { VoiceEngine } from './services/audioGenerationService';
import { getElevenLabsVoices, cloneElevenLabsVoice, ElevenLabsVoice } from './services/elevenLabsService';
import { OpenAIVoice } from './services/openaiService';
import { LocalLLMConfig } from './services/localLLMService';
import { TogetherVoice } from './services/togetherService';
import { MistralVoice } from './services/mistralService';
import { BackgroundAudioSettings } from './services/backgroundAudioService';
import { audioBufferToWav, concatenateAudioBuffers, audioBufferToOgg } from './utils/audio';
import { loadBookManifest, getChapter, getChapterTitles, preloadChapters, type BookManifest, type Chapter as BookChapter } from './services/bookService';
import type { Chapter, FilterSettings, OscilloscopeTheme, SpectrogramSettings } from './types';
import storageService from './services/storageService';
import ChapterList from './components/ChapterList';
import TranscriptViewer from './components/TranscriptViewer';
import AudioPlayer from './components/AudioPlayer';
import { BackgroundAudioModal } from './components/BackgroundAudioModal';
import eventService from './services/eventService';
import { SpinnerIcon } from './components/icons/SpinnerIcon';

const ELEVENLABS_API_KEY_STORAGE = 'elevenlabs_api_key';
const ELEVENLABS_VOICE_ID_STORAGE = 'elevenlabs_voice_id';
const OPENAI_API_KEY_STORAGE = 'openai_api_key';
const OPENAI_VOICE_STORAGE = 'openai_voice';
const TOGETHER_API_KEY_STORAGE = 'together_api_key';
const TOGETHER_VOICE_STORAGE = 'together_voice';
const MISTRAL_API_KEY_STORAGE = 'mistral_api_key';
const MISTRAL_VOICE_STORAGE = 'mistral_voice';
const LOCAL_LLM_CONFIG_STORAGE = 'local_llm_config';
const LOCAL_LLM_VOICE_STORAGE = 'local_llm_voice';
const BACKGROUND_AUDIO_SETTINGS_STORAGE = 'background_audio_settings';
const VOICE_ENGINE_STORAGE = 'voice_engine';
const SPECTROGRAM_SETTINGS_STORAGE = 'spectrogram_settings';
const COMPLETED_CHAPTERS_STORAGE = 'completed_chapters';
const BOOKMARKED_CHAPTERS_STORAGE = 'bookmarked_chapters';
const PRE_CACHE_BUFFER_COUNT_STORAGE = 'pre_cache_buffer_count';
const FILTER_SETTINGS_STORAGE = 'audio_filter_settings';
const OSCILLOSCOPE_THEME_STORAGE = 'oscilloscope_theme';
const AUDIO_FORMAT_STORAGE = 'audio_format_preference';
const DEFAULT_ELEVENLABS_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Default: Rachel

const getChapterDisplayTitle = (title: string): string => {
    const parts = title.split(':');
    if (parts.length > 1) {
        return parts.slice(1).join(':').trim();
    }
    return title.trim();
};

interface GlobalProgressIndicatorProps {
    isVisible: boolean;
    progressText: string;
    progressPercent: number;
}

const GlobalProgressIndicator: React.FC<GlobalProgressIndicatorProps> = ({
    isVisible,
    progressText,
    progressPercent,
}) => {
    if (!isVisible) {
        return null;
    }

    return (
        <div className="fixed top-0 left-0 right-0 h-12 bg-gray-800/90 backdrop-blur-sm border-b border-blue-500/30 z-50 flex items-center px-6 animate-fade-in-up shadow-lg" role="progressbar" aria-valuenow={progressPercent}>
            <div className="flex items-center gap-4 w-full">
                <SpinnerIcon className="h-5 w-5 text-blue-300 flex-shrink-0" />
                <div className="flex-1">
                    <p 
                        className="text-sm text-blue-300 truncate"
                        title={progressText}
                    >
                        {progressText}
                    </p>
                    <div className="w-full bg-gray-700/50 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                    </div>
                </div>
                <span className="text-xs font-mono text-gray-400 w-10 text-right">{Math.round(progressPercent)}%</span>
            </div>
        </div>
    );
};

const App: React.FC = () => {
    // Book data state - loaded async from bookService
    const [bookMetadata, setBookMetadata] = useState<{ title: string; subtitle: string; author: string } | null>(null);
    const [chapterTitles, setChapterTitles] = useState<string[]>([]);
    const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
    const [isLoadingChapter, setIsLoadingChapter] = useState<boolean>(false);
    const [isLoadingBook, setIsLoadingBook] = useState<boolean>(true);

    // Helper function to generate cache keys
    const getCacheKey = useCallback((
        index: number,
        engine: VoiceEngine,
        geminiVc: string,
        elevenLabsVc: string | null,
        openaiVc: OpenAIVoice,
        togetherVc: TogetherVoice,
        mistralVc: MistralVoice,
        localLLMCfg: LocalLLMConfig | null,
        localLLMVc: string,
        bgAudioSettings?: BackgroundAudioSettings
    ): string => {
        let baseKey: string;
        switch (engine) {
            case 'gemini':
                baseKey = `${index}-${engine}-${geminiVc}`;
                break;
            case 'elevenlabs':
                baseKey = `${index}-${engine}-${elevenLabsVc}`;
                break;
            case 'openai':
                baseKey = `${index}-${engine}-${openaiVc}`;
                break;
            case 'together':
                baseKey = `${index}-${engine}-${togetherVc}`;
                break;
            case 'mistral':
                baseKey = `${index}-${engine}-${mistralVc}`;
                break;
            case 'local-llm':
                baseKey = `${index}-${engine}-${localLLMCfg?.url}-${localLLMVc}`;
                break;
            default:
                baseKey = `${index}-${engine}`;
        }

        // Include background audio settings in cache key
        let bgHash = 'nobg';
        if (bgAudioSettings?.enabled && bgAudioSettings?.clip) {
            bgHash = `bg-${bgAudioSettings.clip.id}-${bgAudioSettings.clip.volume}-${bgAudioSettings.crossfade}`;
        }
        return `${baseKey}-${bgHash}`;
    }, []);
    const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);

    const [isDownloadingFullBook, setIsDownloadingFullBook] = useState<boolean>(false);
    const [fullBookDownloadProgress, setFullBookDownloadProgress] = useState<string>('');
    const [prebufferProgress, setPrebufferProgress] = useState<number>(0);
    
    const [voiceEngine, setVoiceEngine] = useState<VoiceEngine>(() => {
        const savedEngine = localStorage.getItem(VOICE_ENGINE_STORAGE) as VoiceEngine | null;
        if (savedEngine && ['gemini', 'elevenlabs', 'openai', 'together', 'mistral', 'local-llm'].includes(savedEngine)) {
            return savedEngine;
        }
        return 'gemini';
    });
    const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string>('');
    const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([]);
    const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState<string>(DEFAULT_ELEVENLABS_VOICE_ID);
    const [openaiApiKey, setOpenaiApiKey] = useState<string>('');
    const [openaiVoice, setOpenaiVoice] = useState<OpenAIVoice>('alloy');
    const [togetherApiKey, setTogetherApiKey] = useState<string>('');
    const [togetherVoice, setTogetherVoice] = useState<TogetherVoice>('alloy');
    const [mistralApiKey, setMistralApiKey] = useState<string>('');
    const [mistralVoice, setMistralVoice] = useState<MistralVoice>('alloy');
    const [localLLMConfig, setLocalLLMConfig] = useState<LocalLLMConfig | null>(null);
    const [localLLMVoice, setLocalLLMVoice] = useState<string>('0');
    const [backgroundAudioSettings, setBackgroundAudioSettings] = useState<BackgroundAudioSettings>({
        enabled: false,
        clip: null,
        repeat: false,
        matchLength: true,
        crossfade: true,
        crossfadeDuration: 2,
    });
    const [isBackgroundAudioModalOpen, setIsBackgroundAudioModalOpen] = useState(false);

    const [isAlbumMode, setIsAlbumMode] = useState<boolean>(false);
    const [playbackRate, setPlaybackRate] = useState<number>(1);
    const [geminiVoice, setGeminiVoice] = useState<string>('Kore');
    const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
    const [autoplayOnChapterChange, setAutoplayOnChapterChange] = useState(false);
    const [spectrogramSettings, setSpectrogramSettings] = useState<SpectrogramSettings>({
        minFrequency: 20,
        maxFrequency: 22050, // Default until context is available
        intensity: 1,
        colorScheme: 'vibrant',
    });
     const [filterSettings, setFilterSettings] = useState<FilterSettings>({
        type: 'allpass',
        frequency: 350,
        q: 1,
    });
    const [oscilloscopeTheme, setOscilloscopeTheme] = useState<OscilloscopeTheme>('cyberpunk');
    const [sampleRate, setSampleRate] = useState<number | null>(null);
    const [isSwitchingVoice, setIsSwitchingVoice] = useState<boolean>(false);
    const [completedChapters, setCompletedChapters] = useState<Set<number>>(new Set());
    const [bookmarkedChapters, setBookmarkedChapters] = useState<Set<number>>(new Set());
    const [preCacheBufferCount, setPreCacheBufferCount] = useState<number>(1);
    const [audioFormat, setAudioFormat] = useState<'wav' | 'ogg'>(() => {
        const saved = localStorage.getItem(AUDIO_FORMAT_STORAGE) as 'wav' | 'ogg' | null;
        return saved || 'ogg'; // Default to ogg for space optimization
    });


    const audioContextRef = useRef<AudioContext | null>(null);
    const audioBufferRef = useRef<AudioBuffer | null>(null);
    const audioCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
    const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
    const filterNodeRef = useRef<BiquadFilterNode | null>(null);
    const startedAtRef = useRef<number>(0);
    const pausedAtRef = useRef<number>(0);
    const animationFrameRef = useRef<number>(0);
    
    // Refs to hold latest state for use in closures like onended
    const progressRef = useRef(progress);
    const isAlbumModeRef = useRef(isAlbumMode);
    const currentChapterIndexRef = useRef(currentChapterIndex);
    const isPlayingRef = useRef(isPlaying);

    useEffect(() => { progressRef.current = progress; }, [progress]);
    useEffect(() => { isAlbumModeRef.current = isAlbumMode; }, [isAlbumMode]);
    useEffect(() => { currentChapterIndexRef.current = currentChapterIndex; }, [currentChapterIndex]);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

    // Ref to track previous background audio settings for cache invalidation
    const prevBgSettingsRef = useRef<BackgroundAudioSettings | null>(null);

    // Load book manifest on mount
    useEffect(() => {
        const loadBook = async () => {
            try {
                setIsLoadingBook(true);
                const manifest = await loadBookManifest();
                setBookMetadata({
                    title: manifest.title,
                    subtitle: manifest.subtitle,
                    author: manifest.author
                });
                const titles = await getChapterTitles();
                setChapterTitles(titles);
            } catch (error) {
                console.error('Failed to load book manifest:', error);
                setError('Failed to load book data');
            } finally {
                setIsLoadingBook(false);
            }
        };
        loadBook();
    }, []);

    // Load chapter content when currentChapterIndex changes
    useEffect(() => {
        const loadChapter = async () => {
            if (chapterTitles.length === 0) return; // Wait for manifest to load
            try {
                setIsLoadingChapter(true);
                const chapter = await getChapter(currentChapterIndex);
                setCurrentChapter(chapter);
                // Prefetch next chapters
                preloadChapters(currentChapterIndex + 1, 3).catch(() => {});
            } catch (error) {
                console.error('Failed to load chapter:', error);
                setError('Failed to load chapter content');
            } finally {
                setIsLoadingChapter(false);
            }
        };
        loadChapter();
    }, [currentChapterIndex, chapterTitles.length]);

    // Clear in-memory cache when background audio settings change
    useEffect(() => {
        if (prevBgSettingsRef.current !== null) {
            const prev = prevBgSettingsRef.current;
            const curr = backgroundAudioSettings;
            // Check if relevant settings changed
            const prevBgId = prev?.enabled && prev?.clip ? prev.clip.id : null;
            const currBgId = curr?.enabled && curr?.clip ? curr.clip.id : null;
            const prevVolume = prev?.enabled && prev?.clip ? prev.clip.volume : null;
            const currVolume = curr?.enabled && curr?.clip ? curr.clip.volume : null;
            const prevCrossfade = prev?.crossfade;
            const currCrossfade = curr?.crossfade;

            if (prevBgId !== currBgId || prevVolume !== currVolume || prevCrossfade !== currCrossfade) {
                // Background audio settings changed, invalidate cache
                audioCacheRef.current.clear();
                audioBufferRef.current = null;
            }
        }
        prevBgSettingsRef.current = backgroundAudioSettings;
    }, [backgroundAudioSettings]);

    // Helper function to save chapter metadata
    const saveChapterMetadata = useCallback(async (
        chapterIndex: number,
        buffer: AudioBuffer
    ) => {
        try {
            const voiceId = voiceEngine === 'gemini' ? geminiVoice :
                          voiceEngine === 'elevenlabs' ? elevenLabsVoiceId :
                          voiceEngine === 'openai' ? openaiVoice :
                          voiceEngine === 'together' ? togetherVoice :
                          voiceEngine === 'mistral' ? mistralVoice :
                          voiceEngine === 'local-llm' ? localLLMVoice : 'unknown';

            await storageService.saveChapterMetadata({
                chapterIndex,
                voiceEngine,
                voiceId,
                backgroundAudioId: backgroundAudioSettings?.clip?.id,
                generatedAt: Date.now(),
                duration: buffer.duration,
            });
        } catch (error) {
            console.warn('Failed to save chapter metadata:', error);
        }
    }, [voiceEngine, geminiVoice, elevenLabsVoiceId, openaiVoice, togetherVoice, mistralVoice, localLLMVoice, backgroundAudioSettings]);

    const cleanupAudio = useCallback(() => {
        if (sourceNodeRef.current) {
            sourceNodeRef.current.onended = null;
            sourceNodeRef.current.stop();
            sourceNodeRef.current.disconnect();
            sourceNodeRef.current = null;
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        setIsPlaying(false);
        setProgress(0);
        pausedAtRef.current = 0;
        startedAtRef.current = 0;
    }, []);

    const fetchElevenLabsVoices = useCallback(async (key: string) => {
        if (!key) {
            setElevenLabsVoices([]);
            return;
        }
        try {
            setError(null);
            const voices = await getElevenLabsVoices(key);
            setElevenLabsVoices(voices);
        } catch (error) {
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            setError(`Could not fetch ElevenLabs voices: ${message}`);
            setElevenLabsVoices([]);
        }
    }, []);

    const ensureAudioContext = useCallback(() => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current) {
            if (sampleRate === null) {
                const rate = audioContextRef.current.sampleRate;
                setSampleRate(rate);
                // On first context creation, update max frequency based on actual hardware sample rate
                // but only if it's still the default value.
                setSpectrogramSettings(prev => ({
                    ...prev,
                    maxFrequency: prev.maxFrequency === 22050 ? rate / 2 : Math.min(prev.maxFrequency, rate / 2),
                }));
            }
            if (!analyserNode) {
                const newNode = audioContextRef.current.createAnalyser();
                newNode.fftSize = 2048;
                newNode.minDecibels = -90;
                newNode.maxDecibels = -10;
                newNode.smoothingTimeConstant = 0.85;
                setAnalyserNode(newNode);
            }
            if (!filterNodeRef.current) {
                filterNodeRef.current = audioContextRef.current.createBiquadFilter();
                // Initial settings will be applied via useEffect
            }
        }
        return audioContextRef.current;
    }, [analyserNode, sampleRate]);

    const preCacheChapter = useCallback(async (index: number) => {
        if (index < 0 || index >= chapterTitles.length) return; // bounds check

        if (voiceEngine === 'elevenlabs' && !elevenLabsApiKey) {
            return; // Silently skip pre-caching if API key is missing for ElevenLabs
        }
        if (voiceEngine === 'openai' && !openaiApiKey) {
            return; // Silently skip pre-caching if API key is missing for OpenAI
        }
        if (voiceEngine === 'local-llm' && !localLLMConfig) {
            return; // Silently skip pre-caching if config is missing for Local LLM
        }

        const cacheKey = getCacheKey(index, voiceEngine, geminiVoice, elevenLabsVoiceId, openaiVoice, togetherVoice, mistralVoice, localLLMConfig, localLLMVoice, backgroundAudioSettings);

        if (audioCacheRef.current.has(cacheKey)) {
            return; // Already cached
        }

        const audioContext = ensureAudioContext();
        if (!audioContext) return;

        try {
            const chapter = await getChapter(index);
            const buffer = await generateChapterAudio(
                voiceEngine,
                chapter.content,
                elevenLabsApiKey,
                audioContext,
                geminiVoice,
                elevenLabsVoiceId,
                openaiApiKey,
                openaiVoice,
                localLLMConfig || undefined,
                localLLMVoice,
                backgroundAudioSettings,
                togetherApiKey,
                togetherVoice,
                mistralApiKey,
                mistralVoice
            );
            audioCacheRef.current.set(cacheKey, buffer);
            await saveChapterMetadata(index, buffer);
        } catch (error) {
            // We need to propagate the error for pre-buffering to fail correctly.
            console.error(`Failed to pre-cache chapter ${index + 1}:`, error);
            throw error;
        }
    }, [ensureAudioContext, voiceEngine, elevenLabsApiKey, geminiVoice, elevenLabsVoiceId, openaiApiKey, openaiVoice, togetherApiKey, togetherVoice, mistralApiKey, mistralVoice, localLLMConfig, localLLMVoice, backgroundAudioSettings, getCacheKey, saveChapterMetadata, chapterTitles.length]);

    const ensureAudioIsLoaded = useCallback(async (setLoading: React.Dispatch<React.SetStateAction<boolean>>): Promise<AudioBuffer | null> => {
        setError(null);
        const cacheKey = getCacheKey(currentChapterIndex, voiceEngine, geminiVoice, elevenLabsVoiceId, openaiVoice, togetherVoice, mistralVoice, localLLMConfig, localLLMVoice, backgroundAudioSettings);

        if (audioCacheRef.current.has(cacheKey)) {
            const cachedBuffer = audioCacheRef.current.get(cacheKey)!;
            audioBufferRef.current = cachedBuffer;
            return cachedBuffer;
        }

        if (!currentChapter) {
            setError("Chapter not loaded yet");
            return null;
        }

        const audioContext = ensureAudioContext();
        setLoading(true);

        try {
            const buffer = await generateChapterAudio(
                voiceEngine,
                currentChapter.content,
                elevenLabsApiKey,
                audioContext,
                geminiVoice,
                elevenLabsVoiceId,
                openaiApiKey,
                openaiVoice,
                localLLMConfig || undefined,
                localLLMVoice,
                backgroundAudioSettings,
                togetherApiKey,
                togetherVoice,
                mistralApiKey,
                mistralVoice
            );
            audioBufferRef.current = buffer;
            audioCacheRef.current.set(cacheKey, buffer);
            await saveChapterMetadata(currentChapterIndex, buffer);
            return buffer;
        } catch (error) {
            console.error("Failed to generate or decode audio:", error);
            setError(error instanceof Error ? error.message : "An unknown error occurred while preparing audio.");
            return null;
        } finally {
            setLoading(false);
        }
    }, [currentChapter, ensureAudioContext, currentChapterIndex, voiceEngine, elevenLabsApiKey, geminiVoice, elevenLabsVoiceId, openaiApiKey, openaiVoice, togetherApiKey, togetherVoice, mistralApiKey, mistralVoice, localLLMConfig, localLLMVoice, backgroundAudioSettings, getCacheKey, saveChapterMetadata]);

    const playAudio = useCallback(async () => {
        const offset = pausedAtRef.current;
        cleanupAudio();
        const audioBuffer = await ensureAudioIsLoaded(setIsLoading);
        const audioContext = audioContextRef.current;
        const filterNode = filterNodeRef.current;

        if (!audioBuffer || !audioContext || !analyserNode || !filterNode) return;
        
        await audioContext.resume();

        sourceNodeRef.current = audioContext.createBufferSource();
        sourceNodeRef.current.buffer = audioBuffer;
        sourceNodeRef.current.playbackRate.setValueAtTime(playbackRate, audioContext.currentTime);

        
        // Updated audio graph: source -> filter -> analyser -> destination
        sourceNodeRef.current.connect(filterNode);
        filterNode.connect(analyserNode);
        analyserNode.connect(audioContext.destination);

        sourceNodeRef.current.onended = () => {
            if (progressRef.current >= 99) {
                // Mark chapter as complete
                setCompletedChapters(prev => new Set(prev).add(currentChapterIndexRef.current));

                if (isAlbumModeRef.current && currentChapterIndexRef.current < chapterTitles.length - 1) {
                    setCurrentChapterIndex(i => i + 1);
                } else {
                    cleanupAudio();
                    setIsAlbumMode(false);
                }
            }
        };

        startedAtRef.current = audioContext.currentTime - (offset / playbackRate);
        sourceNodeRef.current.start(0, offset);
        setIsPlaying(true);

        // Proactively cache upcoming chapters
        if (isAlbumModeRef.current) {
            for (let i = 1; i <= preCacheBufferCount; i++) {
                const nextIndex = currentChapterIndexRef.current + i;
                if (nextIndex < chapterTitles.length) {
                    preCacheChapter(nextIndex);
                }
            }
        } else {
            // In single chapter mode, just cache the very next one
            if (currentChapterIndexRef.current < chapterTitles.length - 1) {
                preCacheChapter(currentChapterIndexRef.current + 1);
            }
        }

    }, [cleanupAudio, ensureAudioIsLoaded, playbackRate, preCacheChapter, analyserNode, preCacheBufferCount, chapterTitles.length]);

    const handleSelectChapter = useCallback((index: number) => {
        const wasPlaying = isPlayingRef.current;
        setIsAlbumMode(false);
        cleanupAudio();
        setError(null);
        audioBufferRef.current = null;
        setCurrentChapterIndex(index);
        
        if (wasPlaying) {
            playAudio();
        } else {
            preCacheChapter(index); // Proactively cache selected chapter
        }
    }, [cleanupAudio, preCacheChapter, playAudio]);
    
    const handleVoiceChange = useCallback(async (newVoiceSettings: {
        engine?: VoiceEngine,
        geminiVoice?: string,
        elevenLabsVoiceId?: string,
        openaiVoice?: OpenAIVoice,
        togetherVoice?: TogetherVoice,
        mistralVoice?: MistralVoice,
        localLLMVoice?: string
    }) => {
        const {
            engine = voiceEngine,
            geminiVoice: newGeminiVoice = geminiVoice,
            elevenLabsVoiceId: newElevenLabsVoiceId = elevenLabsVoiceId,
            openaiVoice: newOpenaiVoice = openaiVoice,
            togetherVoice: newTogetherVoice = togetherVoice,
            mistralVoice: newMistralVoice = mistralVoice,
            localLLMVoice: newLocalLLMVoice = localLLMVoice
        } = newVoiceSettings;

        // Apply changes to state immediately
        if (newVoiceSettings.engine) {
            setVoiceEngine(engine);
            localStorage.setItem(VOICE_ENGINE_STORAGE, engine);
        }
        if (newVoiceSettings.geminiVoice) setGeminiVoice(newGeminiVoice);
        if (newVoiceSettings.elevenLabsVoiceId) {
            setElevenLabsVoiceId(newElevenLabsVoiceId);
            localStorage.setItem(ELEVENLABS_VOICE_ID_STORAGE, newElevenLabsVoiceId);
        }
        if (newVoiceSettings.openaiVoice) {
            setOpenaiVoice(newOpenaiVoice);
            localStorage.setItem(OPENAI_VOICE_STORAGE, newOpenaiVoice);
        }
        if (newVoiceSettings.togetherVoice) {
            setTogetherVoice(newTogetherVoice);
            localStorage.setItem(TOGETHER_VOICE_STORAGE, newTogetherVoice);
        }
        if (newVoiceSettings.mistralVoice) {
            setMistralVoice(newMistralVoice);
            localStorage.setItem(MISTRAL_VOICE_STORAGE, newMistralVoice);
        }
        if (newVoiceSettings.localLLMVoice) {
            setLocalLLMVoice(newLocalLLMVoice);
            localStorage.setItem(LOCAL_LLM_VOICE_STORAGE, newLocalLLMVoice);
        }

        if (!isPlayingRef.current) {
            // If not playing, just clean up and clear buffer for next playback.
            cleanupAudio();
            audioBufferRef.current = null;
            return;
        }

        // If playing, perform the seamless "hot-swap".
        setIsSwitchingVoice(true);
        setError(null);

        const audioContext = ensureAudioContext();
        if (!audioContext) {
            setIsSwitchingVoice(false);
            return;
        }

        // Capture current playback time to resume from this point
        const switchTime = (audioContext.currentTime - startedAtRef.current) * playbackRate + pausedAtRef.current;

        try {
            // Generate the new audio in the background
            const newBuffer = await generateChapterAudio(
                engine,
                currentChapter.content,
                elevenLabsApiKey,
                audioContext,
                newGeminiVoice,
                newElevenLabsVoiceId,
                openaiApiKey,
                newOpenaiVoice,
                localLLMConfig || undefined,
                newLocalLLMVoice,
                backgroundAudioSettings,
                togetherApiKey,
                newTogetherVoice,
                mistralApiKey,
                newMistralVoice
            );

            // If the user paused while we were generating, don't proceed with the swap.
            // Just update the buffer and stay paused.
            if (!isPlayingRef.current) {
                cleanupAudio();
                audioBufferRef.current = newBuffer;
                return;
            }
            
            const filterNode = filterNodeRef.current;
            if (!analyserNode || !filterNode) {
                console.error("Audio graph nodes not available for voice switch.");
                cleanupAudio(); // fallback to a hard stop
                return;
            }

            // A more graceful swap: stop the old source, create and start a new one
            if (sourceNodeRef.current) {
                sourceNodeRef.current.onended = null; // Prevent onended logic (like next chapter) from firing
                sourceNodeRef.current.stop();
                sourceNodeRef.current.disconnect();
            }

            audioBufferRef.current = newBuffer;
            await saveChapterMetadata(currentChapterIndex, newBuffer);
            pausedAtRef.current = 0; // We're not paused, we're playing from an offset

            const newSourceNode = audioContext.createBufferSource();
            newSourceNode.buffer = newBuffer;
            newSourceNode.playbackRate.setValueAtTime(playbackRate, audioContext.currentTime);

            // Reconnect to the existing audio graph
            newSourceNode.connect(filterNode);
            filterNode.connect(analyserNode);
            analyserNode.connect(audioContext.destination);

            // Assign the same onended logic for chapter completion/album mode
            newSourceNode.onended = () => {
                if (progressRef.current >= 99) {
                    setCompletedChapters(prev => new Set(prev).add(currentChapterIndexRef.current));

                    if (isAlbumModeRef.current && currentChapterIndexRef.current < chapterTitles.length - 1) {
                        setCurrentChapterIndex(i => i + 1);
                    } else {
                        cleanupAudio();
                        setIsAlbumMode(false);
                    }
                }
            };

            sourceNodeRef.current = newSourceNode;

            // Calculate the correct start offset and update timing references
            const startOffset = Math.min(switchTime, newBuffer.duration);
            startedAtRef.current = audioContext.currentTime - (startOffset / playbackRate);
            
            // Start the new audio source from the calculated offset
            sourceNodeRef.current.start(0, startOffset);

        } catch (error) {
            console.error("Failed to switch voice during playback:", error);
            setError(error instanceof Error ? error.message : "An unknown error occurred while switching voice.");
            // If the switch fails, stop playback to avoid confusion.
            cleanupAudio();
        } finally {
            setIsSwitchingVoice(false);
        }
    }, [
        voiceEngine, geminiVoice, elevenLabsVoiceId, openaiApiKey, openaiVoice, togetherApiKey, togetherVoice, mistralApiKey, mistralVoice, localLLMConfig, localLLMVoice,
        cleanupAudio, ensureAudioContext, playbackRate, currentChapter.content, elevenLabsApiKey, analyserNode, backgroundAudioSettings, currentChapterIndex, saveChapterMetadata,
    ]);

    const handleVoiceEngineChange = useCallback((engine: VoiceEngine) => {
        handleVoiceChange({ engine });
    }, [handleVoiceChange]);

    const handleGeminiVoiceChange = useCallback((voice: string) => {
        if (voiceEngine !== 'gemini') return;
        handleVoiceChange({ geminiVoice: voice });
    }, [voiceEngine, handleVoiceChange]);

    const handleElevenLabsVoiceChange = useCallback((voiceId: string) => {
        if (voiceEngine !== 'elevenlabs') return;
        handleVoiceChange({ elevenLabsVoiceId: voiceId });
    }, [voiceEngine, handleVoiceChange]);

    const handleOpenAIVoiceChange = useCallback((voice: OpenAIVoice) => {
        if (voiceEngine !== 'openai') return;
        handleVoiceChange({ openaiVoice: voice });
    }, [voiceEngine, handleVoiceChange]);

    const handleLocalLLMVoiceChange = useCallback((voice: string) => {
        if (voiceEngine !== 'local-llm') return;
        handleVoiceChange({ localLLMVoice: voice });
    }, [voiceEngine, handleVoiceChange]);

    const handleTogetherVoiceChange = useCallback((voice: TogetherVoice) => {
        if (voiceEngine !== 'together') return;
        handleVoiceChange({ togetherVoice: voice });
    }, [voiceEngine, handleVoiceChange]);

    const handleMistralVoiceChange = useCallback((voice: MistralVoice) => {
        if (voiceEngine !== 'mistral') return;
        handleVoiceChange({ mistralVoice: voice });
    }, [voiceEngine, handleVoiceChange]);


    const handleSaveApiKey = useCallback(async (key: string) => {
        setElevenLabsApiKey(key);
        localStorage.setItem(ELEVENLABS_API_KEY_STORAGE, key);
        audioCacheRef.current.clear();
        await fetchElevenLabsVoices(key);
    }, [fetchElevenLabsVoices]);

    const handleSaveOpenAIKey = useCallback((key: string) => {
        setOpenaiApiKey(key);
        localStorage.setItem(OPENAI_API_KEY_STORAGE, key);
        audioCacheRef.current.clear();
    }, []);

    const handleSaveTogetherKey = useCallback((key: string) => {
        setTogetherApiKey(key);
        localStorage.setItem(TOGETHER_API_KEY_STORAGE, key);
        audioCacheRef.current.clear();
    }, []);

    const handleSaveMistralKey = useCallback((key: string) => {
        setMistralApiKey(key);
        localStorage.setItem(MISTRAL_API_KEY_STORAGE, key);
        audioCacheRef.current.clear();
    }, []);

    const handleSaveLocalLLMConfig = useCallback((config: LocalLLMConfig) => {
        setLocalLLMConfig(config);
        localStorage.setItem(LOCAL_LLM_CONFIG_STORAGE, JSON.stringify(config));
        audioCacheRef.current.clear();
    }, []);

    const handleAudioFormatChange = useCallback((format: 'wav' | 'ogg') => {
        setAudioFormat(format);
        localStorage.setItem(AUDIO_FORMAT_STORAGE, format);
    }, []);

    const handleCloneVoice = useCallback(async ({ name, files }: { name: string, files: File[] }) => {
        if (!elevenLabsApiKey) {
            eventService.emit('clone:error', new Error("ElevenLabs API Key is not set."));
            return;
        }
        try {
            await cloneElevenLabsVoice(elevenLabsApiKey, name, files);
            // Refresh the voice list on success
            await fetchElevenLabsVoices(elevenLabsApiKey);
            eventService.emit('clone:success');
        } catch (error) {
            eventService.emit('clone:error', error);
        }
    }, [elevenLabsApiKey, fetchElevenLabsVoices]);


    const handlePlaybackRateChange = useCallback((rate: number) => {
        setPlaybackRate(rate);
        if (isPlaying && sourceNodeRef.current && audioContextRef.current) {
            // Use setTargetAtTime for smooth rate changes
            sourceNodeRef.current.playbackRate.setTargetAtTime(rate, audioContextRef.current.currentTime, 0.015);
        }
    }, [isPlaying]);

    const handlePreCacheChange = useCallback((count: number) => {
        setPreCacheBufferCount(count);
    }, []);

    const updateProgress = useCallback(() => {
        if (isPlaying && audioContextRef.current && audioBufferRef.current) {
            const elapsedTime = (audioContextRef.current.currentTime - startedAtRef.current) * playbackRate + pausedAtRef.current;
            const newProgress = (elapsedTime / audioBufferRef.current.duration) * 100;
            setProgress(Math.min(newProgress, 100));
            animationFrameRef.current = requestAnimationFrame(updateProgress);
        }
    }, [isPlaying, playbackRate]);
    
    const pauseAudio = useCallback(() => {
        if (isPlaying && audioContextRef.current && sourceNodeRef.current) {
            pausedAtRef.current = (audioContextRef.current.currentTime - startedAtRef.current) * playbackRate;
            sourceNodeRef.current.stop();
            setIsPlaying(false);
        }
    }, [isPlaying, playbackRate]);
    
    const handlePlayPause = useCallback(() => {
        if (isPlaying) {
            pauseAudio();
        } else {
            const audioContext = ensureAudioContext();
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
            playAudio();
        }
    }, [isPlaying, pauseAudio, playAudio, ensureAudioContext]);

    const handleSkip = useCallback((amount: number) => {
        if (!audioBufferRef.current || !audioContextRef.current) return;

        let currentTime;
        if (isPlaying) {
            // Calculate current playback time accurately
            currentTime = (audioContextRef.current.currentTime - startedAtRef.current) * playbackRate + pausedAtRef.current;
        } else {
            // If paused, skip from the paused position
            currentTime = pausedAtRef.current;
        }
        
        const newTime = Math.max(0, Math.min(currentTime + amount, audioBufferRef.current.duration));

        pausedAtRef.current = newTime;
        setProgress((newTime / audioBufferRef.current.duration) * 100);
        
        if (isPlaying) {
            // If it was playing, restart playback from the new position
            playAudio();
        }

    }, [isPlaying, playbackRate, playAudio]);

    const handleNextChapter = useCallback(() => {
        if (currentChapterIndex < chapterTitles.length - 1) {
            if (isPlaying) {
                setAutoplayOnChapterChange(true);
            }
            cleanupAudio();
            setCurrentChapterIndex(currentChapterIndex + 1);
        }
    }, [currentChapterIndex, isPlaying, cleanupAudio, chapterTitles.length]);

    const handlePreviousChapter = useCallback(() => {
        if (currentChapterIndex > 0) {
            if (isPlaying) {
                setAutoplayOnChapterChange(true);
            }
            cleanupAudio();
            setCurrentChapterIndex(currentChapterIndex - 1);
        }
    }, [currentChapterIndex, isPlaying, cleanupAudio]);

    const handleDownload = useCallback(async (format: 'wav' | 'ogg' = 'wav') => {
        setIsDownloading(true);
        setError(null);
        const audioContext = ensureAudioContext();

        try {
            // Generate audio fresh with current settings, bypassing cache
            const buffer = await generateChapterAudio(
                voiceEngine,
                currentChapter.content,
                elevenLabsApiKey,
                audioContext,
                geminiVoice,
                elevenLabsVoiceId,
                openaiApiKey,
                openaiVoice,
                localLLMConfig || undefined,
                localLLMVoice,
                backgroundAudioSettings,
                togetherApiKey,
                togetherVoice,
                mistralApiKey,
                mistralVoice
            );

            let audioBlob: Blob;
            let fileExtension: string = format;

            if (format === 'ogg') {
                try {
                    // This now attempts multiple formats (ogg/webm/mp4)
                    audioBlob = await audioBufferToOgg(buffer);
                    if (audioBlob.type.includes('webm')) fileExtension = 'webm';
                    else if (audioBlob.type.includes('mp4')) fileExtension = 'm4a';
                } catch (oggError) {
                    console.error("Compressed audio encoding failed:", oggError);
                    const message = oggError instanceof Error ? oggError.message : "Browser may not support this encoding.";
                    setError(`Encoding failed: ${message} Please try the WAV format instead.`);
                    setTimeout(() => setError(null), 8000);
                    return;
                }
            } else { // 'wav'
                audioBlob = audioBufferToWav(buffer);
            }

            const url = URL.createObjectURL(audioBlob);
            const a = document.createElement('a');
            a.style.display = 'none';

            // Create organized filename: BookTitle/Chapter_XX_ChapterTitle.ext
            const bookTitleSafe = (bookMetadata?.title || 'Audiobook').replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '_');
            const chapterNum = (currentChapterIndex + 1).toString().padStart(2, '0');
            const chapterTitleSafe = (currentChapter?.title || 'Chapter').split(':')[0].replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '_');
            a.download = `${bookTitleSafe}/Chapter_${chapterNum}_${chapterTitleSafe}.${fileExtension}`;

            a.href = url;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            console.error(`Failed to download chapter as ${format}:`, error);
            setError(error instanceof Error ? error.message : "An unknown error occurred during download.");
        } finally {
            setIsDownloading(false);
        }
    }, [ensureAudioContext, currentChapter, bookMetadata, currentChapterIndex, voiceEngine, elevenLabsApiKey, geminiVoice, elevenLabsVoiceId, openaiApiKey, openaiVoice, togetherApiKey, togetherVoice, mistralApiKey, mistralVoice, localLLMConfig, localLLMVoice, backgroundAudioSettings]);


    const handleDownloadTranscript = useCallback(() => {
        const textContent = currentChapter.content;
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        const safeFilename = currentChapter.title.split(':')[0].replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '_');
        a.download = `${safeFilename || 'chapter'}_transcript.txt`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }, [currentChapter.title, currentChapter.content]);
    
    const handlePlayFullAudiobook = useCallback(() => {
        if (voiceEngine === 'elevenlabs' && !elevenLabsApiKey) {
            setError('ElevenLabs API key is missing. Please provide it in the settings before playing.');
            return;
        }
    
        cleanupAudio();
        setError(null);
        audioBufferRef.current = null;
    
        // Immediately update UI to reflect the intent to play the full book
        setIsAlbumMode(true);
        setCurrentChapterIndex(0);
        
        // Directly call playAudio, which will handle its own loading state for the play button
        playAudio();
    
        // Start background caching of subsequent chapters without blocking the UI
        setIsDownloadingFullBook(true); // This state now only controls the background caching progress bar
        setPrebufferProgress(0);
        
        (async () => {
            const PREBUFFER_CHAPTER_COUNT = preCacheBufferCount;
            try {
                // Pre-cache the next chapters in the background
                for (let i = 1; i < Math.min(PREBUFFER_CHAPTER_COUNT, chapterTitles.length); i++) {
                    const chapterTitle = getChapterDisplayTitle(chapterTitles[i]);
                    const cacheKey = getCacheKey(i, voiceEngine, geminiVoice, elevenLabsVoiceId, openaiVoice, togetherVoice, mistralVoice, localLLMConfig, localLLMVoice, backgroundAudioSettings);
                    const wasCached = audioCacheRef.current.has(cacheKey);

                    if (wasCached) {
                        setFullBookDownloadProgress(`Found ${i + 1}/${PREBUFFER_CHAPTER_COUNT}: "${chapterTitle}"`);
                    } else {
                        setFullBookDownloadProgress(`Caching ${i + 1}/${PREBUFFER_CHAPTER_COUNT}: "${chapterTitle}"`);
                    }

                    await preCacheChapter(i);

                    if (wasCached) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }

                    setPrebufferProgress(((i + 1) / PREBUFFER_CHAPTER_COUNT) * 100);
                }

                setFullBookDownloadProgress('Pre-buffering complete.');
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (backgroundError) {
                console.error("Failed during background pre-caching:", backgroundError);
                const errorMessage = backgroundError instanceof Error ? backgroundError.message : "An unknown error occurred.";
                setFullBookDownloadProgress('Background cache error.');
                // Show a non-blocking error in the main error display
                setError(`Background cache failed: ${errorMessage}`);
            } finally {
                // Hide the background caching UI after it's done or has failed
                setIsDownloadingFullBook(false);
                setFullBookDownloadProgress('');
                setPrebufferProgress(0);
            }
        })();

    }, [cleanupAudio, preCacheChapter, voiceEngine, elevenLabsApiKey, geminiVoice, elevenLabsVoiceId, openaiVoice, togetherVoice, mistralVoice, localLLMConfig, localLLMVoice, playAudio, preCacheBufferCount, getCacheKey, chapterTitles, backgroundAudioSettings]);

    const handleDownloadFullAudiobook = useCallback(async (format: 'wav' | 'ogg' = 'wav') => {
        if (voiceEngine === 'elevenlabs' && !elevenLabsApiKey) {
            setError('ElevenLabs API key is missing. Please provide it in the settings before downloading.');
            return;
        }
        setIsDownloadingFullBook(true);
        setPrebufferProgress(0);
        setError(null);
        const audioContext = ensureAudioContext();
        
        try {
            const chapterBuffers: AudioBuffer[] = [];

            for (let i = 0; i < chapterTitles.length; i++) {
                const chapter = await getChapter(i);
                const chapterTitle = getChapterDisplayTitle(chapter.title);
                const cacheKey = getCacheKey(i, voiceEngine, geminiVoice, elevenLabsVoiceId, openaiVoice, togetherVoice, mistralVoice, localLLMConfig, localLLMVoice, backgroundAudioSettings);

                let buffer = audioCacheRef.current.get(cacheKey);
                if (!buffer) {
                    setFullBookDownloadProgress(`Generating ${i + 1}/${chapterTitles.length}: "${chapterTitle}"`);
                    buffer = await generateChapterAudio(
                        voiceEngine,
                        chapter.content,
                        elevenLabsApiKey,
                        audioContext,
                        geminiVoice,
                        elevenLabsVoiceId,
                        openaiApiKey,
                        openaiVoice,
                        localLLMConfig || undefined,
                        localLLMVoice,
                        backgroundAudioSettings,
                        togetherApiKey,
                        togetherVoice,
                        mistralApiKey,
                        mistralVoice
                    );
                    audioCacheRef.current.set(cacheKey, buffer);
                    await saveChapterMetadata(i, buffer);
                } else {
                    setFullBookDownloadProgress(`Found ${i + 1}/${chapterTitles.length}: "${chapterTitle}"`);
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                chapterBuffers.push(buffer);
                setPrebufferProgress(((i + 1) / chapterTitles.length) * 100);
            }

            setFullBookDownloadProgress('Combining chapters...');
            const fullAudioBuffer = concatenateAudioBuffers(chapterBuffers, audioContext);

            let audioBlob: Blob;
            let fileExtension: string = format;

            if (format === 'ogg') {
                const durationMinutes = Math.ceil(fullAudioBuffer.duration / 60);
                const timeEstimate = durationMinutes > 1 ? `${durationMinutes} minutes` : 'a minute';
                setFullBookDownloadProgress(`Encoding compressed audio... (may take ~${timeEstimate})`);
                await new Promise(resolve => setTimeout(resolve, 50)); // UI update tick
                
                try {
                    audioBlob = await audioBufferToOgg(fullAudioBuffer);
                    if (audioBlob.type.includes('webm')) fileExtension = 'webm';
                    else if (audioBlob.type.includes('mp4')) fileExtension = 'm4a';
                } catch (oggError) {
                    console.error("Compressed encoding failed:", oggError);
                    const message = oggError instanceof Error ? oggError.message : "Browser may not support compressed encoding.";
                    setError(`Encoding failed: ${message} Please try the WAV format instead.`);
                    // Reset state
                    setIsDownloadingFullBook(false);
                    setFullBookDownloadProgress('');
                    setPrebufferProgress(0);
                    // Clear error after a while
                    setTimeout(() => setError(null), 8000);
                    return;
                }
            } else { // 'wav'
                setFullBookDownloadProgress('Preparing download...');
                await new Promise(resolve => setTimeout(resolve, 50)); // UI update tick
                audioBlob = audioBufferToWav(fullAudioBuffer);
            }

            setFullBookDownloadProgress('Download starting...');

            const url = URL.createObjectURL(audioBlob);
            const a = document.createElement('a');
            a.style.display = 'none';
            const bookTitleSafe = (bookMetadata?.title || 'Audiobook').replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '_');
            a.download = `${bookTitleSafe}/FULL_${bookTitleSafe}_Complete_${voiceEngine}.${fileExtension}`;
            a.href = url;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            console.error("Failed to generate full audiobook:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            setFullBookDownloadProgress('Error!');
            setError(`Failed to download audiobook. ${errorMessage}`);
        } finally {
            setIsDownloadingFullBook(false);
            setFullBookDownloadProgress('');
            setPrebufferProgress(0);
        }
    }, [ensureAudioContext, voiceEngine, elevenLabsApiKey, geminiVoice, elevenLabsVoiceId, openaiApiKey, openaiVoice, togetherApiKey, togetherVoice, mistralApiKey, mistralVoice, localLLMConfig, localLLMVoice, backgroundAudioSettings, getCacheKey, saveChapterMetadata]);

    const handleDownloadAllChapters = useCallback(async (format: 'wav' | 'ogg' = 'wav') => {
        if (voiceEngine === 'elevenlabs' && !elevenLabsApiKey) {
            setError('ElevenLabs API key is missing. Please provide it in the settings before downloading.');
            return;
        }
        
        setIsDownloadingFullBook(true);
        setPrebufferProgress(0);
        setError(null);
        const audioContext = ensureAudioContext();

        try {
            // Create book title for organized filenames
            const bookTitleForFilename = (bookMetadata?.title || 'Audiobook').replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '_');

            for (let i = 0; i < chapterTitles.length; i++) {
                const chapter = await getChapter(i);
                const chapterTitle = getChapterDisplayTitle(chapter.title);
                const chapterNum = (i + 1).toString().padStart(2, '0');
                const chapterTitleSafe = chapter.title.split(':')[0].replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '_');
                const safeFilename = `${bookTitleForFilename}/Chapter_${chapterNum}_${chapterTitleSafe}`;

                setFullBookDownloadProgress(`Downloading ${i + 1}/${chapterTitles.length}: "${chapterTitle}"`);

                // Check cache or generate
                const cacheKey = getCacheKey(i, voiceEngine, geminiVoice, elevenLabsVoiceId, openaiVoice, togetherVoice, mistralVoice, localLLMConfig, localLLMVoice, backgroundAudioSettings);

                let buffer = audioCacheRef.current.get(cacheKey);

                if (!buffer) {
                    setFullBookDownloadProgress(`Generating ${i + 1}/${chapterTitles.length}: "${chapterTitle}"`);
                    // Use current settings for generation
                    buffer = await generateChapterAudio(
                        voiceEngine,
                        chapter.content,
                        elevenLabsApiKey,
                        audioContext,
                        geminiVoice,
                        elevenLabsVoiceId,
                        openaiApiKey,
                        openaiVoice,
                        localLLMConfig || undefined,
                        localLLMVoice,
                        backgroundAudioSettings,
                        togetherApiKey,
                        togetherVoice,
                        mistralApiKey,
                        mistralVoice
                    );
                    // Cache it since we generated it
                    audioCacheRef.current.set(cacheKey, buffer);
                    await saveChapterMetadata(i, buffer);
                }

                // Convert
                let audioBlob: Blob;
                let fileExtension: string = format;

                if (format === 'ogg') {
                    try {
                        audioBlob = await audioBufferToOgg(buffer);
                        if (audioBlob.type.includes('webm')) fileExtension = 'webm';
                        else if (audioBlob.type.includes('mp4')) fileExtension = 'm4a';
                    } catch (e) {
                        console.warn("Compressed encoding failed, falling back to WAV", e);
                        audioBlob = audioBufferToWav(buffer);
                        fileExtension = 'wav';
                    }
                } else {
                    audioBlob = audioBufferToWav(buffer);
                }

                // Download
                const url = URL.createObjectURL(audioBlob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.download = `${safeFilename}.${fileExtension}`;
                a.href = url;
                document.body.appendChild(a);
                a.click();

                // Cleanup
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                }, 100);

                // Update progress
                setPrebufferProgress(((i + 1) / chapterTitles.length) * 100);
                
                // Delay to throttle downloads
                await new Promise(resolve => setTimeout(resolve, 800));
            }

            setFullBookDownloadProgress('Batch download complete.');
            setTimeout(() => {
                 setIsDownloadingFullBook(false);
                 setFullBookDownloadProgress('');
                 setPrebufferProgress(0);
            }, 2000);

        } catch (error) {
            console.error("Failed to batch download chapters:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            setFullBookDownloadProgress('Error!');
            setError(`Batch download failed. ${errorMessage}`);
            setIsDownloadingFullBook(false);
            setPrebufferProgress(0);
        }
    }, [ensureAudioContext, voiceEngine, elevenLabsApiKey, geminiVoice, elevenLabsVoiceId, openaiApiKey, openaiVoice, togetherApiKey, togetherVoice, mistralApiKey, mistralVoice, localLLMConfig, localLLMVoice, backgroundAudioSettings, getCacheKey, saveChapterMetadata]);

    const handlePreCacheAllChapters = useCallback(async () => {
        if (voiceEngine === 'elevenlabs' && !elevenLabsApiKey) {
            setError('ElevenLabs API key is missing. Please provide it in the settings before generating.');
            return;
        }
        setIsDownloadingFullBook(true);
        setPrebufferProgress(0);
        setError(null);
        const audioContext = ensureAudioContext();
        
        try {
            for (let i = 0; i < chapterTitles.length; i++) {
                const chapter = await getChapter(i);
                const chapterTitle = getChapterDisplayTitle(chapter.title);
                const cacheKey = getCacheKey(i, voiceEngine, geminiVoice, elevenLabsVoiceId, openaiVoice, togetherVoice, mistralVoice, localLLMConfig, localLLMVoice, backgroundAudioSettings);

                if (audioCacheRef.current.has(cacheKey)) {
                    setFullBookDownloadProgress(`Found ${i + 1}/${chapterTitles.length}: "${chapterTitle}"`);
                    setPrebufferProgress(((i + 1) / chapterTitles.length) * 100);
                    await new Promise(resolve => setTimeout(resolve, 50));
                    continue;
                }
                setFullBookDownloadProgress(`Caching ${i + 1}/${chapterTitles.length}: "${chapterTitle}"`);

                const buffer = await generateChapterAudio(
                    voiceEngine,
                    chapter.content,
                    elevenLabsApiKey,
                    audioContext,
                    geminiVoice,
                    elevenLabsVoiceId,
                    openaiApiKey,
                    openaiVoice,
                    localLLMConfig || undefined,
                    localLLMVoice,
                    backgroundAudioSettings,
                    togetherApiKey,
                    togetherVoice,
                    mistralApiKey,
                    mistralVoice
                );
                audioCacheRef.current.set(cacheKey, buffer);
                await saveChapterMetadata(i, buffer);
                setPrebufferProgress(((i + 1) / chapterTitles.length) * 100);
            }
            setFullBookDownloadProgress('All chapters cached!');
            
            setTimeout(() => {
                 if (fullBookDownloadProgress === 'All chapters cached!') {
                    setFullBookDownloadProgress('');
                 }
                 setIsDownloadingFullBook(false);
                 setPrebufferProgress(0);
            }, 2000);

        } catch (error) {
            console.error("Failed to pre-cache all chapters:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            setFullBookDownloadProgress('Error!');
            setError(`Failed to cache chapters. ${errorMessage}`);
            setIsDownloadingFullBook(false);
            setPrebufferProgress(0);
        }
    }, [ensureAudioContext, voiceEngine, elevenLabsApiKey, geminiVoice, elevenLabsVoiceId, openaiApiKey, openaiVoice, togetherApiKey, togetherVoice, mistralApiKey, mistralVoice, localLLMConfig, localLLMVoice, fullBookDownloadProgress, backgroundAudioSettings, getCacheKey, saveChapterMetadata]);

    const handleFilterSettingsChange = useCallback((newSettings: Partial<FilterSettings>) => {
        setFilterSettings(prev => ({ ...prev, ...newSettings }));
    }, []);

    const handleOscilloscopeThemeChange = useCallback((theme: OscilloscopeTheme) => {
        setOscilloscopeTheme(theme);
    }, []);


    const handleSpectrogramChange = useCallback((newSettings: Partial<SpectrogramSettings>) => {
        setSpectrogramSettings(prev => ({ ...prev, ...newSettings }));
    }, []);

    const handleToggleBookmark = useCallback((index: number) => {
        setBookmarkedChapters(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    }, []);

    const { freqToSliderVal, sliderValToFreq } = useMemo(() => {
        const MIN_FREQ_CONST = 20;
        const maxFreq = sampleRate ? sampleRate / 2 : 22050;
        const logMinFull = Math.log(MIN_FREQ_CONST);
        const logMaxFull = Math.log(maxFreq);
        const fullScale = logMaxFull - logMinFull;

        return {
            freqToSliderVal: (freq: number) => (Math.log(freq) - logMinFull) / fullScale,
            sliderValToFreq: (val: number) => Math.exp(logMinFull + fullScale * val)
        };
    }, [sampleRate]);

    const { intensityToSliderVal, sliderValToIntensity } = useMemo(() => {
        const MIN_INTENSITY = 0.25;
        const MAX_INTENSITY = 4.0;
        const logMin = Math.log(MIN_INTENSITY);
        const logMax = Math.log(MAX_INTENSITY);
        const scale = logMax - logMin;

        return {
            intensityToSliderVal: (intensity: number) => (Math.log(intensity) - logMin) / scale,
            sliderValToIntensity: (val: number) => Math.exp(logMin + scale * val)
        };
    }, []);

    // --- Global Setup and Event Handling ---
    useEffect(() => {
        // Load settings from storage on initial mount
        const savedKey = localStorage.getItem(ELEVENLABS_API_KEY_STORAGE);
        if (savedKey) {
            setElevenLabsApiKey(savedKey);
            fetchElevenLabsVoices(savedKey);
        }
        const savedVoiceId = localStorage.getItem(ELEVENLABS_VOICE_ID_STORAGE);
        if (savedVoiceId) {
            setElevenLabsVoiceId(savedVoiceId);
        }
        const savedOpenAIKey = localStorage.getItem(OPENAI_API_KEY_STORAGE);
        if (savedOpenAIKey) {
            setOpenaiApiKey(savedOpenAIKey);
        }
        const savedOpenAIVoice = localStorage.getItem(OPENAI_VOICE_STORAGE) as OpenAIVoice | null;
        if (savedOpenAIVoice) {
            setOpenaiVoice(savedOpenAIVoice);
        }
        const savedTogetherKey = localStorage.getItem(TOGETHER_API_KEY_STORAGE);
        if (savedTogetherKey) {
            setTogetherApiKey(savedTogetherKey);
        }
        const savedTogetherVoice = localStorage.getItem(TOGETHER_VOICE_STORAGE) as TogetherVoice | null;
        if (savedTogetherVoice) {
            setTogetherVoice(savedTogetherVoice);
        }
        const savedMistralKey = localStorage.getItem(MISTRAL_API_KEY_STORAGE);
        if (savedMistralKey) {
            setMistralApiKey(savedMistralKey);
        }
        const savedMistralVoice = localStorage.getItem(MISTRAL_VOICE_STORAGE) as MistralVoice | null;
        if (savedMistralVoice) {
            setMistralVoice(savedMistralVoice);
        }
        const savedLocalLLMConfig = localStorage.getItem(LOCAL_LLM_CONFIG_STORAGE);
        if (savedLocalLLMConfig) {
            try {
                setLocalLLMConfig(JSON.parse(savedLocalLLMConfig));
            } catch (e) {
                console.warn("Could not parse saved local LLM config.");
            }
        }
        const savedLocalLLMVoice = localStorage.getItem(LOCAL_LLM_VOICE_STORAGE);
        if (savedLocalLLMVoice) {
            setLocalLLMVoice(savedLocalLLMVoice);
        }
        const savedSpectrogramSettings = localStorage.getItem(SPECTROGRAM_SETTINGS_STORAGE);
        if (savedSpectrogramSettings) {
            try {
                const parsed = JSON.parse(savedSpectrogramSettings);
                setSpectrogramSettings(prev => ({ ...prev, ...parsed }));
            } catch (e) {
                console.warn("Could not parse saved spectrogram settings.");
            }
        }
        const savedFilterSettings = localStorage.getItem(FILTER_SETTINGS_STORAGE);
        if (savedFilterSettings) {
            try {
                setFilterSettings(JSON.parse(savedFilterSettings));
            } catch (e) { console.warn("Could not parse saved filter settings.")}
        }
        const savedOscilloscopeTheme = localStorage.getItem(OSCILLOSCOPE_THEME_STORAGE) as OscilloscopeTheme | null;
        if (savedOscilloscopeTheme) {
            setOscilloscopeTheme(savedOscilloscopeTheme);
        }
        const savedPreCacheCount = localStorage.getItem(PRE_CACHE_BUFFER_COUNT_STORAGE);
        if (savedPreCacheCount) {
            const parsedCount = parseInt(savedPreCacheCount, 10);
            if (!isNaN(parsedCount) && parsedCount >= 1 && parsedCount <= 5) {
                setPreCacheBufferCount(parsedCount);
            }
        }

        const savedCompleted = localStorage.getItem(COMPLETED_CHAPTERS_STORAGE);
        if (savedCompleted) {
            try {
                setCompletedChapters(new Set(JSON.parse(savedCompleted)));
            } catch (e) {
                console.warn("Could not parse completed chapters.");
            }
        }
        const savedBookmarked = localStorage.getItem(BOOKMARKED_CHAPTERS_STORAGE);
        if (savedBookmarked) {
            try {
                setBookmarkedChapters(new Set(JSON.parse(savedBookmarked)));
            } catch (e) {
                console.warn("Could not parse bookmarked chapters.");
            }
        }

        // Expose the audio generation service globally
        (window as any).audiobookService = {
            generateAudio: generateAudioAsService,
        };

        const handleSkipForward = () => handleSkip(10);
        const handleSkipBackward = () => handleSkip(-10);

        // Subscribe to UI events
        eventService.on('chapter:select', handleSelectChapter);
        eventService.on('player:play_pause', handlePlayPause);
        eventService.on('player:skip_forward', handleSkipForward);
        eventService.on('player:skip_backward', handleSkipBackward);
        eventService.on('player:next_chapter', handleNextChapter);
        eventService.on('player:previous_chapter', handlePreviousChapter);
        eventService.on('chapter:download', handleDownload);
        eventService.on('chapter:bookmark_toggle', handleToggleBookmark);
        eventService.on('transcript:download', handleDownloadTranscript);
        eventService.on('play:full_book', handlePlayFullAudiobook);
        eventService.on('download:full_book', handleDownloadFullAudiobook);
        eventService.on('download:all_chapters', handleDownloadAllChapters);
        eventService.on('cache:full_book', handlePreCacheAllChapters);
        eventService.on('settings:engine_change', handleVoiceEngineChange);
        eventService.on('settings:apikey_save', handleSaveApiKey);
        eventService.on('settings:playback_rate_change', handlePlaybackRateChange);
        eventService.on('settings:pre_cache_change', handlePreCacheChange);
        eventService.on('settings:gemini_voice_change', handleGeminiVoiceChange);
        eventService.on('settings:elevenlabs_voice_change', handleElevenLabsVoiceChange);
        eventService.on('settings:elevenlabs_clone_voice', handleCloneVoice);
        eventService.on('error:clear', () => setError(null));

        // Cleanup: Unsubscribe and remove global service
        return () => {
            eventService.off('chapter:select', handleSelectChapter);
            eventService.off('player:play_pause', handlePlayPause);
            eventService.off('player:skip_forward', handleSkipForward);
            eventService.off('player:skip_backward', handleSkipBackward);
            eventService.off('player:next_chapter', handleNextChapter);
            eventService.off('player:previous_chapter', handlePreviousChapter);
            eventService.off('chapter:download', handleDownload);
            eventService.off('chapter:bookmark_toggle', handleToggleBookmark);
            eventService.off('transcript:download', handleDownloadTranscript);
            eventService.off('play:full_book', handlePlayFullAudiobook);
            eventService.off('download:full_book', handleDownloadFullAudiobook);
            eventService.off('download:all_chapters', handleDownloadAllChapters);
            eventService.off('cache:full_book', handlePreCacheAllChapters);
            eventService.off('settings:engine_change', handleVoiceEngineChange);
            eventService.off('settings:apikey_save', handleSaveApiKey);
            eventService.off('settings:playback_rate_change', handlePlaybackRateChange);
            eventService.off('settings:pre_cache_change', handlePreCacheChange);
            eventService.off('settings:gemini_voice_change', handleGeminiVoiceChange);
            eventService.off('settings:elevenlabs_voice_change', handleElevenLabsVoiceChange);
            eventService.off('settings:elevenlabs_clone_voice', handleCloneVoice);
            eventService.off('error:clear', () => setError(null));
            
            delete (window as any).audiobookService;
        };
    }, [
        handleSelectChapter, 
        handlePlayPause, 
        handleDownload, 
        handleDownloadTranscript,
        handlePlayFullAudiobook,
        handleDownloadFullAudiobook,
        handleDownloadAllChapters, 
        handlePreCacheAllChapters,
        handleVoiceEngineChange,
        handleSaveApiKey,
        handlePlaybackRateChange,
        handlePreCacheChange,
        handleGeminiVoiceChange,
        handleElevenLabsVoiceChange,
        handleCloneVoice,
        handleSkip,
        fetchElevenLabsVoices,
        handleNextChapter,
        handlePreviousChapter,
        handleToggleBookmark,
    ]);

    // --- Audio Lifecycle Effects ---
    useEffect(() => {
        return () => {
            cleanupAudio();
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
        };
    }, [cleanupAudio]);

    useEffect(() => {
        if (isPlaying) {
            animationFrameRef.current = requestAnimationFrame(updateProgress);
        } else {
            cancelAnimationFrame(animationFrameRef.current);
        }
        return () => cancelAnimationFrame(animationFrameRef.current);
    }, [isPlaying, updateProgress]);

    // Effect to handle auto-play in album mode for subsequent chapters
    useEffect(() => {
        // This effect triggers when the chapter changes *while* in album mode.
        // It does not trigger for the initial start of album mode.
        if (isAlbumMode && isPlayingRef.current) {
            playAudio();
        }
    }, [isAlbumMode, currentChapterIndex, playAudio]);

    // Effect for handling autoplay after chapter skip
    useEffect(() => {
        if (autoplayOnChapterChange) {
            playAudio();
            setAutoplayOnChapterChange(false);
        }
    }, [autoplayOnChapterChange, playAudio]);

    // Effect for persisting spectrogram settings
    useEffect(() => {
        localStorage.setItem(SPECTROGRAM_SETTINGS_STORAGE, JSON.stringify(spectrogramSettings));
    }, [spectrogramSettings]);
    
    // Effect for persisting filter settings & updating audio node
    useEffect(() => {
        localStorage.setItem(FILTER_SETTINGS_STORAGE, JSON.stringify(filterSettings));
        if (filterNodeRef.current && audioContextRef.current) {
            filterNodeRef.current.type = filterSettings.type;
            filterNodeRef.current.frequency.setTargetAtTime(filterSettings.frequency, audioContextRef.current.currentTime, 0.015);
            filterNodeRef.current.Q.setTargetAtTime(filterSettings.q, audioContextRef.current.currentTime, 0.015);
        }
    }, [filterSettings]);

    // Effect for persisting oscilloscope theme
    useEffect(() => {
        localStorage.setItem(OSCILLOSCOPE_THEME_STORAGE, oscilloscopeTheme);
    }, [oscilloscopeTheme]);

    // Effect for persisting progress
    useEffect(() => {
        localStorage.setItem(COMPLETED_CHAPTERS_STORAGE, JSON.stringify(Array.from(completedChapters)));
    }, [completedChapters]);

    useEffect(() => {
        localStorage.setItem(BOOKMARKED_CHAPTERS_STORAGE, JSON.stringify(Array.from(bookmarkedChapters)));
    }, [bookmarkedChapters]);
    
    useEffect(() => {
        localStorage.setItem(PRE_CACHE_BUFFER_COUNT_STORAGE, String(preCacheBufferCount));
    }, [preCacheBufferCount]);

    // Effect for initial setup
    useEffect(() => {
        // Pre-cache the first chapter on initial load for a faster start.
        preCacheChapter(0);
    }, [preCacheChapter]);

    const isStartingAlbumMode = isLoading && isAlbumMode && currentChapterIndex === 0;
    const showProgressBar = isDownloadingFullBook && !isStartingAlbumMode;

    return (
        <>
            <GlobalProgressIndicator
                isVisible={showProgressBar}
                progressText={fullBookDownloadProgress}
                progressPercent={prebufferProgress}
            />
            <div className={`min-h-screen bg-gray-900 text-gray-200 flex flex-col md:flex-row font-sans ${showProgressBar ? 'pt-12' : ''} transition-all duration-300`}>
                <ChapterList
                    bookTitle={book.title}
                    bookSubtitle={book.subtitle}
                    chapters={book.chapters}
                    currentChapterIndex={currentChapterIndex}
                    isAlbumMode={isAlbumMode}
                    isStartingAlbumMode={isStartingAlbumMode}
                    isDownloadingFullBook={isDownloadingFullBook}
                    voiceEngine={voiceEngine}
                    elevenLabsApiKey={elevenLabsApiKey}
                    elevenLabsVoices={elevenLabsVoices}
                    elevenLabsVoiceId={elevenLabsVoiceId}
                    openaiApiKey={openaiApiKey}
                    openaiVoice={openaiVoice}
                    togetherApiKey={togetherApiKey}
                    togetherVoice={togetherVoice}
                    mistralApiKey={mistralApiKey}
                    mistralVoice={mistralVoice}
                    localLLMConfig={localLLMConfig}
                    localLLMVoice={localLLMVoice}
                    playbackRate={playbackRate}
                    preCacheBufferCount={preCacheBufferCount}
                    audioFormat={audioFormat}
                    onAudioFormatChange={handleAudioFormatChange}
                    geminiVoice={geminiVoice}
                    spectrogramSettings={spectrogramSettings}
                    onSpectrogramChange={handleSpectrogramChange}
                    filterSettings={filterSettings}
                    onFilterSettingsChange={handleFilterSettingsChange}
                    oscilloscopeTheme={oscilloscopeTheme}
                    onOscilloscopeThemeChange={handleOscilloscopeThemeChange}
                    freqToSliderVal={freqToSliderVal}
                    sliderValToFreq={sliderValToFreq}
                    intensityToSliderVal={intensityToSliderVal}
                    sliderValToIntensity={sliderValToIntensity}
                    completedChapters={completedChapters}
                    bookmarkedChapters={bookmarkedChapters}
                    onVoiceEngineChange={handleVoiceEngineChange}
                    onOpenAIKeyChange={handleSaveOpenAIKey}
                    onElevenLabsKeyChange={handleSaveApiKey}
                    onOpenAIVoiceChange={handleOpenAIVoiceChange}
                    onTogetherKeyChange={handleSaveTogetherKey}
                    onTogetherVoiceChange={handleTogetherVoiceChange}
                    onMistralKeyChange={handleSaveMistralKey}
                    onMistralVoiceChange={handleMistralVoiceChange}
                    onLocalLLMConfigChange={handleSaveLocalLLMConfig}
                    onLocalLLMVoiceChange={handleLocalLLMVoiceChange}
                    onOpenBackgroundAudioModal={() => setIsBackgroundAudioModalOpen(true)}
                />
                <main className="flex-1 flex flex-col p-4 md:p-8 overflow-hidden">
                    <div className="flex-1 flex flex-col bg-gray-800/50 rounded-lg shadow-2xl overflow-hidden">
                        <TranscriptViewer
                            title={currentChapter.title}
                            content={currentChapter.content}
                            isPlaying={isPlaying}
                            analyserNode={analyserNode}
                            spectrogramSettings={spectrogramSettings}
                            onSpectrogramChange={handleSpectrogramChange}
                            oscilloscopeTheme={oscilloscopeTheme}
                            freqToSliderVal={freqToSliderVal}
                            sliderValToFreq={sliderValToFreq}
                        />
                        <div className="mt-auto p-4 md:p-6 border-t border-gray-700 bg-gray-900/30 backdrop-blur-sm">
                            <AudioPlayer
                                isPlaying={isPlaying}
                                isLoading={isLoading || isSwitchingVoice}
                                isDownloading={isDownloading}
                                progress={progress}
                                duration={audioBufferRef.current?.duration ?? 0}
                                elapsed={((progress / 100) * (audioBufferRef.current?.duration ?? 0))}
                                error={error}
                                isFirstChapter={currentChapterIndex === 0}
                                isLastChapter={currentChapterIndex === book.chapters.length - 1}
                            />
                        </div>
                    </div>
                </main>
            </div>

            {/* Background Audio Modal */}
            <BackgroundAudioModal
                isOpen={isBackgroundAudioModalOpen}
                onClose={() => setIsBackgroundAudioModalOpen(false)}
                settings={backgroundAudioSettings}
                onSettingsChange={setBackgroundAudioSettings}
                audioContext={audioContextRef.current}
            />
        </>
    );
};

export default App;

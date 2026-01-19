
import { generateGeminiSpeech } from './geminiService';
import { generateElevenLabsSpeech } from './elevenLabsService';
import { generateOpenAISpeech, OpenAIVoice } from './openaiService';
import { generateLocalLLMSpeech, LocalLLMConfig } from './localLLMService';
import { generateTogetherSpeech, TogetherVoice } from './togetherService';
import { generateMistralSpeech, MistralVoice } from './mistralService';
import { audioBufferToWav } from '../utils/audio';
import {
    BackgroundAudioSettings,
    processBackgroundAudio,
    mixAudioBuffers,
} from './backgroundAudioService';

export type VoiceEngine = 'gemini' | 'elevenlabs' | 'openai' | 'together' | 'mistral' | 'local-llm';

interface ServiceConfig {
    engine: VoiceEngine;
    text: string;
    apiKey?: string | null;
    geminiVoice?: string;
    elevenLabsVoiceId?: string | null;
    openaiVoice?: OpenAIVoice;
    localLLMConfig?: LocalLLMConfig;
    localLLMVoice?: string;
}

const PREVIEW_TEXT = "You are at war. Not a war of nations or of fists, but a silent, undeclared war for the most valuable territory in existence: the sovereignty of your own mind.";


export const generateChapterAudio = async (
    engine: VoiceEngine,
    text: string,
    elevenLabsApiKey: string | null,
    audioContext: AudioContext,
    geminiVoice: string,
    elevenLabsVoiceId: string | null,
    openaiApiKey?: string | null,
    openaiVoice?: OpenAIVoice,
    localLLMConfig?: LocalLLMConfig,
    localLLMVoice?: string,
    backgroundAudioSettings?: BackgroundAudioSettings,
    togetherApiKey?: string | null,
    togetherVoice?: TogetherVoice,
    mistralApiKey?: string | null,
    mistralVoice?: MistralVoice
): Promise<AudioBuffer> => {
    let mainBuffer: AudioBuffer;

    switch (engine) {
        case 'gemini':
            mainBuffer = await generateGeminiSpeech(text, audioContext, geminiVoice);
            break;
        case 'elevenlabs':
            if (!elevenLabsApiKey) {
                throw new Error("ElevenLabs API key is missing. Go to Settings → API Providers to add your key.");
            }
            if (!elevenLabsVoiceId) {
                throw new Error("ElevenLabs Voice ID is missing. Go to Settings → API Providers to select a voice.");
            }
            mainBuffer = await generateElevenLabsSpeech(text, elevenLabsApiKey, elevenLabsVoiceId, audioContext);
            break;
        case 'openai':
            if (!openaiApiKey) {
                throw new Error("OpenAI API key is missing. Go to Settings → API Providers to add your key.");
            }
            mainBuffer = await generateOpenAISpeech(text, openaiApiKey, openaiVoice || 'alloy', audioContext);
            break;
        case 'together':
            if (!togetherApiKey) {
                throw new Error("Together AI API key is missing. Go to Settings → API Providers to add your key.");
            }
            mainBuffer = await generateTogetherSpeech(text, togetherApiKey, togetherVoice || 'alloy', audioContext);
            break;
        case 'mistral':
            if (!mistralApiKey) {
                throw new Error("Mistral AI API key is missing. Go to Settings → API Providers to add your key.");
            }
            mainBuffer = await generateMistralSpeech(text, mistralApiKey, mistralVoice || 'alloy', audioContext);
            break;
        case 'local-llm':
            if (!localLLMConfig) {
                throw new Error("Local LLM configuration is missing. Go to Settings → API Providers to configure.");
            }
            mainBuffer = await generateLocalLLMSpeech(text, audioContext, localLLMConfig, localLLMVoice);
            break;
        default:
            throw new Error(`Unsupported voice engine: ${engine}. Please select a valid provider in Settings → API Providers.`);
    }

    // Mix with background audio if enabled
    if (backgroundAudioSettings?.enabled && backgroundAudioSettings?.clip) {
        const backgroundBuffer = processBackgroundAudio(
            backgroundAudioSettings.clip,
            mainBuffer.duration,
            backgroundAudioSettings,
            audioContext
        );
        return mixAudioBuffers(
            mainBuffer,
            backgroundBuffer,
            backgroundAudioSettings.clip.volume,
            audioContext
        );
    }

    return mainBuffer;
};

/**
 * Generates audio from text and returns it as a WAV Blob.
 * This function is self-contained and designed to be exposed as a service endpoint.
 * It creates and closes its own AudioContext.
 * @param {ServiceConfig} config - The configuration for audio generation.
 * @returns {Promise<Blob>} A promise that resolves with a WAV audio Blob.
 */
export const generateAudioAsService = async (
    config: ServiceConfig
): Promise<Blob> => {
    const {
        engine,
        text,
        apiKey = null,
        geminiVoice = 'Kore',
        elevenLabsVoiceId = null,
        openaiVoice = 'alloy',
        localLLMConfig,
        localLLMVoice
    } = config;
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    try {
        const buffer = await generateChapterAudio(
            engine,
            text,
            apiKey,
            audioContext,
            geminiVoice,
            elevenLabsVoiceId,
            apiKey, // Use same apiKey for OpenAI
            openaiVoice,
            localLLMConfig,
            localLLMVoice
        );
        const wavBlob = audioBufferToWav(buffer);
        return wavBlob;
    } finally {
        if (audioContext.state !== 'closed') {
            await audioContext.close();
        }
    }
};

/**
 * Generates a short preview audio clip for a given voice.
 * @param engine The voice engine to use.
 * @param voiceIdentifier The voice name (for Gemini) or voice ID (for ElevenLabs).
 * @param elevenLabsApiKey Required if the engine is ElevenLabs.
 * @returns A promise that resolves with an audio Blob.
 */
export const generatePreviewAudio = async (
    engine: VoiceEngine,
    voiceIdentifier: string,
    apiKey: string | null,
    localLLMConfig?: LocalLLMConfig
): Promise<Blob> => {
    // This function creates its own temporary AudioContext for generating the preview.
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    try {
        let buffer: AudioBuffer;
        if (engine === 'gemini') {
            buffer = await generateGeminiSpeech(PREVIEW_TEXT, audioContext, voiceIdentifier);
        } else if (engine === 'elevenlabs') {
            if (!apiKey) {
                throw new Error("ElevenLabs API key is required for voice previews.");
            }
            buffer = await generateElevenLabsSpeech(PREVIEW_TEXT, apiKey, voiceIdentifier, audioContext);
        } else if (engine === 'openai') {
            if (!apiKey) {
                throw new Error("OpenAI API key is required for voice previews.");
            }
            buffer = await generateOpenAISpeech(PREVIEW_TEXT, apiKey, voiceIdentifier as OpenAIVoice, audioContext);
        } else if (engine === 'local-llm') {
            if (!localLLMConfig) {
                throw new Error("Local LLM configuration is required for voice previews.");
            }
            buffer = await generateLocalLLMSpeech(PREVIEW_TEXT, audioContext, localLLMConfig, voiceIdentifier);
        } else {
            throw new Error(`Unsupported engine for preview: ${engine}`);
        }
        return audioBufferToWav(buffer);
    } finally {
        if (audioContext.state !== 'closed') {
            await audioContext.close();
        }
    }
};

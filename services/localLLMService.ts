import monitoringService from "./monitoringService";

export interface LocalLLMConfig {
    url: string;
    format: 'openai' | 'custom';
    authHeader?: string; // Optional authentication header
    voiceParam?: string; // Parameter name for voice (e.g., 'voice', 'speaker_id')
    audioFormat?: 'mp3' | 'wav' | 'ogg'; // Expected audio format
}

/**
 * Generate speech using a local LLM/TTS server
 * Supports OpenAI-compatible endpoints and custom endpoints
 */
export const generateLocalLLMSpeech = async (
    text: string,
    audioContext: AudioContext,
    config: LocalLLMConfig,
    voice: string = 'default'
): Promise<AudioBuffer> => {
    return monitoringService.trackPerformance(
        'local_llm_tts',
        async () => {
            try {
                let response: Response;

                if (config.format === 'openai') {
                    // OpenAI-compatible format (e.g., LocalAI, text-generation-webui with extensions)
                    response = await fetch(`${config.url}/v1/audio/speech`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(config.authHeader ? { 'Authorization': config.authHeader } : {}),
                        },
                        body: JSON.stringify({
                            model: 'tts-1',
                            input: text,
                            voice: voice,
                            response_format: config.audioFormat || 'mp3',
                        })
                    });
                } else {
                    // Custom format - assumes endpoint accepts JSON with text and voice params
                    const body: Record<string, unknown> = {
                        text: text,
                    };

                    if (config.voiceParam && voice) {
                        body[config.voiceParam] = voice;
                    }

                    response = await fetch(config.url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(config.authHeader ? { 'Authorization': config.authHeader } : {}),
                        },
                        body: JSON.stringify(body)
                    });
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Local LLM API error (${response.status}): ${errorText || response.statusText}`);
                }

                const audioData = await response.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(audioData);
                return audioBuffer;

            } catch (error) {
                monitoringService.trackError(error as Error, {
                    url: config.url,
                    format: config.format,
                    voice,
                    textLength: text.length
                });
                console.error("Error generating speech with Local LLM:", error);
                const message = error instanceof Error ? error.message : "An unknown error occurred.";
                throw new Error(`Failed to generate audio via Local LLM. Details: ${message}`);
            }
        },
        { url: config.url, format: config.format, voice, textLength: text.length }
    );
};

/**
 * Test connection to local LLM endpoint
 */
export const testLocalLLMConnection = async (config: LocalLLMConfig): Promise<boolean> => {
    try {
        const testUrl = config.format === 'openai'
            ? `${config.url}/v1/models`
            : config.url;

        const response = await fetch(testUrl, {
            method: config.format === 'openai' ? 'GET' : 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(config.authHeader ? { 'Authorization': config.authHeader } : {}),
            },
            ...(config.format === 'custom' ? {
                body: JSON.stringify({ text: 'test' })
            } : {})
        });

        return response.ok || response.status === 422; // 422 might be validation error but means endpoint is reachable
    } catch (error) {
        console.error('Local LLM connection test failed:', error);
        return false;
    }
};

/**
 * Popular local TTS server presets
 */
export const LOCAL_TTS_PRESETS = {
    'coqui-tts': {
        name: 'Coqui TTS Server',
        defaultUrl: 'http://localhost:5002/api/tts',
        format: 'custom' as const,
        voiceParam: 'speaker_id',
        audioFormat: 'wav' as const,
    },
    'piper': {
        name: 'Piper TTS',
        defaultUrl: 'http://localhost:5000/api/tts',
        format: 'custom' as const,
        voiceParam: 'voice',
        audioFormat: 'wav' as const,
    },
    'localai': {
        name: 'LocalAI',
        defaultUrl: 'http://localhost:8080',
        format: 'openai' as const,
        audioFormat: 'mp3' as const,
    },
    'alltalk': {
        name: 'AllTalk TTS',
        defaultUrl: 'http://localhost:7851/api/tts-generate',
        format: 'custom' as const,
        voiceParam: 'voice',
        audioFormat: 'wav' as const,
    },
};

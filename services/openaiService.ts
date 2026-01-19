import monitoringService from "./monitoringService";

const OPENAI_API_BASE_URL = 'https://api.openai.com/v1';

export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type OpenAIModel = 'tts-1' | 'tts-1-hd';

export const OPENAI_VOICES: { id: OpenAIVoice; name: string; description: string }[] = [
    { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
    { id: 'echo', name: 'Echo', description: 'Clear and articulate' },
    { id: 'fable', name: 'Fable', description: 'Warm and expressive' },
    { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
    { id: 'nova', name: 'Nova', description: 'Energetic and engaging' },
    { id: 'shimmer', name: 'Shimmer', description: 'Soft and soothing' },
];

export const generateOpenAISpeech = async (
    text: string,
    apiKey: string,
    voice: OpenAIVoice,
    audioContext: AudioContext,
    model: OpenAIModel = 'tts-1'
): Promise<AudioBuffer> => {
    return monitoringService.trackPerformance(
        'openai_tts',
        async () => {
            try {
                const apiUrl = `${OPENAI_API_BASE_URL}/audio/speech`;
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model,
                        input: text,
                        voice,
                        response_format: 'mp3',
                    })
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error("Invalid OpenAI API key.");
                    }
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error?.message || `OpenAI API error: ${response.statusText}`);
                }

                const audioData = await response.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(audioData);
                return audioBuffer;

            } catch (error) {
                monitoringService.trackError(error as Error, { voice, model, textLength: text.length });
                console.error("Error generating speech with OpenAI:", error);
                const message = error instanceof Error ? error.message : "An unknown API error occurred.";
                throw new Error(`Failed to generate audio via OpenAI. Details: ${message}`);
            }
        },
        { voice, model, textLength: text.length }
    );
};

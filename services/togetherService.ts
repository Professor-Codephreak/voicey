import monitoringService from "./monitoringService";

const TOGETHER_API_BASE_URL = 'https://api.together.xyz/v1';

export type TogetherVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export const TOGETHER_VOICES: { id: TogetherVoice; name: string; description: string }[] = [
    { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
    { id: 'echo', name: 'Echo', description: 'Clear and articulate' },
    { id: 'fable', name: 'Fable', description: 'Warm and expressive' },
    { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
    { id: 'nova', name: 'Nova', description: 'Energetic and engaging' },
    { id: 'shimmer', name: 'Shimmer', description: 'Soft and soothing' },
];

export const generateTogetherSpeech = async (
    text: string,
    apiKey: string,
    voice: TogetherVoice,
    audioContext: AudioContext
): Promise<AudioBuffer> => {
    return monitoringService.trackPerformance(
        'together_tts',
        async () => {
            try {
                const apiUrl = `${TOGETHER_API_BASE_URL}/audio/speech`;
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: 'tts-1',
                        input: text,
                        voice,
                        response_format: 'mp3',
                    })
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error("Invalid Together AI API key. Go to Settings → API Providers to configure.");
                    }
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error?.message || `Together AI API error: ${response.statusText}`);
                }

                const audioData = await response.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(audioData);
                return audioBuffer;

            } catch (error) {
                monitoringService.trackError(error as Error, { voice, textLength: text.length });
                console.error("Error generating speech with Together AI:", error);
                const message = error instanceof Error ? error.message : "An unknown API error occurred.";
                throw new Error(`Failed to generate audio via Together AI. ${message}`);
            }
        },
        { voice, textLength: text.length }
    );
};

import monitoringService from "./monitoringService";

const MISTRAL_API_BASE_URL = 'https://api.mistral.ai/v1';

export type MistralVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export const MISTRAL_VOICES: { id: MistralVoice; name: string; description: string }[] = [
    { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
    { id: 'echo', name: 'Echo', description: 'Clear and articulate' },
    { id: 'fable', name: 'Fable', description: 'Warm and expressive' },
    { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
    { id: 'nova', name: 'Nova', description: 'Energetic and engaging' },
    { id: 'shimmer', name: 'Shimmer', description: 'Soft and soothing' },
];

export const generateMistralSpeech = async (
    text: string,
    apiKey: string,
    voice: MistralVoice,
    audioContext: AudioContext
): Promise<AudioBuffer> => {
    return monitoringService.trackPerformance(
        'mistral_tts',
        async () => {
            try {
                const apiUrl = `${MISTRAL_API_BASE_URL}/audio/speech`;
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
                        throw new Error("Invalid Mistral AI API key. Go to Settings → API Providers to configure.");
                    }
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error?.message || `Mistral AI API error: ${response.statusText}`);
                }

                const audioData = await response.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(audioData);
                return audioBuffer;

            } catch (error) {
                monitoringService.trackError(error as Error, { voice, textLength: text.length });
                console.error("Error generating speech with Mistral AI:", error);
                const message = error instanceof Error ? error.message : "An unknown API error occurred.";
                throw new Error(`Failed to generate audio via Mistral AI. ${message}`);
            }
        },
        { voice, textLength: text.length }
    );
};

import monitoringService from "./monitoringService";

const ELEVENLABS_API_BASE_URL = 'https://api.elevenlabs.io/v1';

export interface ElevenLabsVoice {
    voice_id: string;
    name: string;
    category: 'premade' | 'cloned' | 'generated' | 'professional';
    labels: Record<string, string>;
}

export const generateElevenLabsSpeech = async (
    text: string,
    apiKey: string,
    voiceId: string,
    audioContext: AudioContext
): Promise<AudioBuffer> => {
    return monitoringService.trackPerformance(
        'elevenlabs_tts',
        async () => {
            try {
                const apiUrl = `${ELEVENLABS_API_BASE_URL}/text-to-speech/${voiceId}`;
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'xi-api-key': apiKey,
                        'Accept': 'audio/mpeg'
                    },
                    body: JSON.stringify({
                        text: text,
                        model_id: 'eleven_multilingual_v2',
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75
                        }
                    })
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error("Invalid ElevenLabs API key.");
                    }
                    const errorData = await response.json();
                    throw new Error(errorData.detail?.message || `ElevenLabs API error: ${response.statusText}`);
                }

                const audioData = await response.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(audioData);
                return audioBuffer;

            } catch (error) {
                monitoringService.trackError(error as Error, { voiceId, textLength: text.length });
                console.error("Error generating speech with ElevenLabs:", error);
                const message = error instanceof Error ? error.message : "An unknown API error occurred.";
                throw new Error(`Failed to generate audio via ElevenLabs. Details: ${message}`);
            }
        },
        { voiceId, textLength: text.length }
    );
};


export const getElevenLabsVoices = async (apiKey: string): Promise<ElevenLabsVoice[]> => {
    try {
        const response = await fetch(`${ELEVENLABS_API_BASE_URL}/voices`, {
            headers: { 'xi-api-key': apiKey }
        });
        if (!response.ok) {
             if (response.status === 401) {
                throw new Error("Invalid ElevenLabs API key.");
            }
            const errorData = await response.json();
            throw new Error(errorData.detail?.message || `ElevenLabs API error: ${response.statusText}`);
        }
        const data = await response.json();
        return data.voices as ElevenLabsVoice[];
    } catch (error) {
        console.error("Error fetching ElevenLabs voices:", error);
        throw error;
    }
};

export const cloneElevenLabsVoice = async (apiKey: string, name: string, files: File[]): Promise<{voice_id: string}> => {
    try {
        const formData = new FormData();
        formData.append('name', name);
        files.forEach(file => formData.append('files', file, file.name));

        const response = await fetch(`${ELEVENLABS_API_BASE_URL}/voices/add`, {
            method: 'POST',
            headers: { 'xi-api-key': apiKey },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail?.message || `ElevenLabs API error: ${response.statusText}`);
        }
        return await response.json();
    } catch(error) {
        console.error("Error cloning voice with ElevenLabs:", error);
        throw error;
    }
}
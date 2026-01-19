import { GoogleGenAI, Modality } from "@google/genai";
import monitoringService from "./monitoringService";

// Assume process.env.API_KEY is configured in the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

// --- Audio Decoding Helpers (specific to Gemini's raw PCM output) ---

function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}


// --- API Call ---

export const generateGeminiSpeech = async (text: string, audioContext: AudioContext, voiceName: string): Promise<AudioBuffer> => {
    return monitoringService.trackPerformance(
        'gemini_tts',
        async () => {
            try {
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash-preview-tts",
                    contents: [{ parts: [{ text: `Read the following text in a calm, clear, and engaging voice: ${text}` }] }],
                    config: {
                        responseModalities: [Modality.AUDIO],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: { voiceName: voiceName },
                            },
                        },
                    },
                });

                const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

                if (!base64Audio) {
                    throw new Error("No audio data returned from API. The response may have been blocked.");
                }

                const decodedBytes = decode(base64Audio);
                const buffer = await decodeAudioData(decodedBytes, audioContext, 24000, 1);
                return buffer;

            } catch (error) {
                monitoringService.trackError(error as Error, { voiceName, textLength: text.length });
                console.error("Error generating speech with Gemini:", error);
                const message = error instanceof Error ? error.message : "An unknown API error occurred.";
                throw new Error(`Failed to generate audio via Gemini. Details: ${message}`);
            }
        },
        { voiceName, textLength: text.length }
    );
};
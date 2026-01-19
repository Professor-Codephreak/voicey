import monitoringService from "./monitoringService";

export interface BackgroundAudioClip {
    id: string;
    name: string;
    buffer: AudioBuffer;
    duration: number;
    startTime: number;  // Start position in seconds for clip selection
    endTime: number;    // End position in seconds for clip selection
    volume: number;     // 0 to 1
    fadeIn: number;     // Fade in duration in seconds
    fadeOut: number;    // Fade out duration in seconds
}

export interface BackgroundAudioSettings {
    enabled: boolean;
    clip: BackgroundAudioClip | null;
    repeat: boolean;
    matchLength: boolean;  // Match the length of the main audio
    crossfade: boolean;    // Crossfade when repeating
    crossfadeDuration: number; // Duration of crossfade in seconds
}

/**
 * Load an audio file from a File object
 */
export const loadAudioFile = async (
    file: File,
    audioContext: AudioContext
): Promise<BackgroundAudioClip> => {
    return monitoringService.trackPerformance(
        'load_background_audio',
        async () => {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                const clip: BackgroundAudioClip = {
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: file.name,
                    buffer: audioBuffer,
                    duration: audioBuffer.duration,
                    startTime: 0,
                    endTime: audioBuffer.duration,
                    volume: 0.3, // Default 30% volume for background
                    fadeIn: 1,   // Default 1 second fade in
                    fadeOut: 1,  // Default 1 second fade out
                };

                return clip;
            } catch (error) {
                monitoringService.trackError(error as Error, { fileName: file.name });
                console.error("Error loading background audio:", error);
                throw new Error(`Failed to load audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        },
        { fileName: file.name, fileSize: file.size }
    );
};

/**
 * Extract a clip from an audio buffer based on start and end times
 */
export const extractClip = (
    buffer: AudioBuffer,
    startTime: number,
    endTime: number,
    audioContext: AudioContext
): AudioBuffer => {
    const sampleRate = buffer.sampleRate;
    const numberOfChannels = buffer.numberOfChannels;

    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.floor(endTime * sampleRate);
    const clipLength = endSample - startSample;

    const clippedBuffer = audioContext.createBuffer(
        numberOfChannels,
        clipLength,
        sampleRate
    );

    for (let channel = 0; channel < numberOfChannels; channel++) {
        const sourceData = buffer.getChannelData(channel);
        const clippedData = clippedBuffer.getChannelData(channel);

        for (let i = 0; i < clipLength; i++) {
            clippedData[i] = sourceData[startSample + i];
        }
    }

    return clippedBuffer;
};

/**
 * Apply fade in/out to an audio buffer
 */
export const applyFades = (
    buffer: AudioBuffer,
    fadeInDuration: number,
    fadeOutDuration: number
): void => {
    const sampleRate = buffer.sampleRate;
    const fadeInSamples = Math.floor(fadeInDuration * sampleRate);
    const fadeOutSamples = Math.floor(fadeOutDuration * sampleRate);
    const totalSamples = buffer.length;

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);

        // Apply fade in
        for (let i = 0; i < Math.min(fadeInSamples, totalSamples); i++) {
            const gain = i / fadeInSamples;
            data[i] *= gain;
        }

        // Apply fade out
        for (let i = 0; i < Math.min(fadeOutSamples, totalSamples); i++) {
            const gain = i / fadeOutSamples;
            const index = totalSamples - 1 - i;
            data[index] *= gain;
        }
    }
};

/**
 * Repeat/loop a buffer to match a target duration
 */
export const repeatBufferToLength = (
    buffer: AudioBuffer,
    targetDuration: number,
    audioContext: AudioContext,
    crossfade: boolean = false,
    crossfadeDuration: number = 2
): AudioBuffer => {
    const sampleRate = buffer.sampleRate;
    const numberOfChannels = buffer.numberOfChannels;
    const targetSamples = Math.floor(targetDuration * sampleRate);
    const sourceSamples = buffer.length;

    const outputBuffer = audioContext.createBuffer(
        numberOfChannels,
        targetSamples,
        sampleRate
    );

    const crossfadeSamples = crossfade ? Math.floor(crossfadeDuration * sampleRate) : 0;

    for (let channel = 0; channel < numberOfChannels; channel++) {
        const sourceData = buffer.getChannelData(channel);
        const outputData = outputBuffer.getChannelData(channel);

        let outputIndex = 0;
        while (outputIndex < targetSamples) {
            const remainingSamples = targetSamples - outputIndex;
            const samplesToWrite = Math.min(sourceSamples, remainingSamples);

            // Copy samples
            for (let i = 0; i < samplesToWrite; i++) {
                outputData[outputIndex + i] = sourceData[i];
            }

            // Apply crossfade if enabled and not the last iteration
            if (crossfade && outputIndex > 0 && (outputIndex + samplesToWrite) < targetSamples) {
                const fadeStart = outputIndex - crossfadeSamples;
                const fadeEnd = outputIndex + crossfadeSamples;

                for (let i = 0; i < crossfadeSamples * 2; i++) {
                    const index = fadeStart + i;
                    if (index >= 0 && index < targetSamples) {
                        const fadeProgress = i / (crossfadeSamples * 2);
                        const fadeOutGain = 1 - fadeProgress;
                        const fadeInGain = fadeProgress;

                        const prevSampleIndex = (index - outputIndex + sourceSamples) % sourceSamples;
                        const nextSampleIndex = (index - outputIndex) % sourceSamples;

                        outputData[index] = sourceData[prevSampleIndex] * fadeOutGain +
                                          sourceData[nextSampleIndex] * fadeInGain;
                    }
                }
            }

            outputIndex += samplesToWrite;
        }
    }

    return outputBuffer;
};

/**
 * Mix two audio buffers together
 */
export const mixAudioBuffers = (
    mainBuffer: AudioBuffer,
    backgroundBuffer: AudioBuffer,
    backgroundVolume: number,
    audioContext: AudioContext
): AudioBuffer => {
    const sampleRate = mainBuffer.sampleRate;
    const numberOfChannels = Math.max(mainBuffer.numberOfChannels, backgroundBuffer.numberOfChannels);
    const length = Math.max(mainBuffer.length, backgroundBuffer.length);

    const mixedBuffer = audioContext.createBuffer(
        numberOfChannels,
        length,
        sampleRate
    );

    for (let channel = 0; channel < numberOfChannels; channel++) {
        const mixedData = mixedBuffer.getChannelData(channel);
        const mainData = channel < mainBuffer.numberOfChannels
            ? mainBuffer.getChannelData(channel)
            : mainBuffer.getChannelData(0);
        const bgData = channel < backgroundBuffer.numberOfChannels
            ? backgroundBuffer.getChannelData(channel)
            : backgroundBuffer.getChannelData(0);

        for (let i = 0; i < length; i++) {
            const mainSample = i < mainBuffer.length ? mainData[i] : 0;
            const bgSample = i < backgroundBuffer.length ? bgData[i] * backgroundVolume : 0;

            // Mix with simple addition (may want to add compression/limiting)
            mixedData[i] = mainSample + bgSample;

            // Simple soft clipping to prevent distortion
            if (mixedData[i] > 1) mixedData[i] = 1;
            if (mixedData[i] < -1) mixedData[i] = -1;
        }
    }

    return mixedBuffer;
};

/**
 * Process background audio with all settings applied
 */
export const processBackgroundAudio = (
    clip: BackgroundAudioClip,
    targetDuration: number,
    settings: BackgroundAudioSettings,
    audioContext: AudioContext
): AudioBuffer => {
    // Extract the selected clip
    let processedBuffer = extractClip(
        clip.buffer,
        clip.startTime,
        clip.endTime,
        audioContext
    );

    // Apply fades
    applyFades(processedBuffer, clip.fadeIn, clip.fadeOut);

    // Repeat to match length if needed
    if (settings.matchLength || settings.repeat) {
        const clipDuration = clip.endTime - clip.startTime;
        if (clipDuration < targetDuration) {
            processedBuffer = repeatBufferToLength(
                processedBuffer,
                targetDuration,
                audioContext,
                settings.crossfade,
                settings.crossfadeDuration
            );
        }
    }

    return processedBuffer;
};

/**
 * Generate waveform data for visualization
 */
export const generateWaveformData = (
    buffer: AudioBuffer,
    width: number = 1000
): Float32Array => {
    const samples = buffer.length;
    const channelData = buffer.getChannelData(0); // Use first channel
    const samplesPerPixel = Math.floor(samples / width);
    const waveform = new Float32Array(width);

    for (let i = 0; i < width; i++) {
        const start = i * samplesPerPixel;
        const end = start + samplesPerPixel;
        let sum = 0;
        let count = 0;

        for (let j = start; j < end && j < samples; j++) {
            sum += Math.abs(channelData[j]);
            count++;
        }

        waveform[i] = count > 0 ? sum / count : 0;
    }

    return waveform;
};

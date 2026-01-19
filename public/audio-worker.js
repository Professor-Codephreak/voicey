// Audio processing Web Worker
// Handles heavy audio operations off the main thread

self.addEventListener('message', async (event) => {
    const { type, data, id } = event.data;

    try {
        switch (type) {
            case 'DECODE_AUDIO':
                await decodeAudio(data, id);
                break;
            case 'CONVERT_TO_WAV':
                await convertToWav(data, id);
                break;
            case 'CONCATENATE_BUFFERS':
                await concatenateBuffers(data, id);
                break;
            default:
                self.postMessage({ type: 'ERROR', error: 'Unknown operation type', id });
        }
    } catch (error) {
        self.postMessage({
            type: 'ERROR',
            error: error.message,
            id
        });
    }
});

async function decodeAudio(audioData, id) {
    // For base64 encoded data
    if (typeof audioData === 'string') {
        const binaryString = atob(audioData);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        self.postMessage({
            type: 'DECODE_COMPLETE',
            data: bytes,
            id
        }, [bytes.buffer]);
    } else {
        self.postMessage({
            type: 'DECODE_COMPLETE',
            data: audioData,
            id
        });
    }
}

async function convertToWav(bufferData, id) {
    const { channelData, sampleRate, numberOfChannels } = bufferData;

    // WAV header creation
    const numFrames = channelData[0].length;
    const bytesPerSample = 2;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numFrames * numberOfChannels * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // Write WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Interleave and write PCM data
    let offset = 44;
    for (let i = 0; i < numFrames; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
            const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, pcm, true);
            offset += 2;
        }
    }

    self.postMessage({
        type: 'CONVERT_COMPLETE',
        data: new Uint8Array(buffer),
        id
    }, [buffer]);
}

async function concatenateBuffers(buffers, id) {
    const { channelData, sampleRate, numberOfChannels } = buffers;

    self.postMessage({
        type: 'CONCATENATE_COMPLETE',
        data: channelData,
        id
    });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

self.postMessage({ type: 'READY' });

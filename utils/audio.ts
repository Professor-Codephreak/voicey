
// Helper function to write a string to a DataView
function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// Convert float samples to 16-bit PCM
function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

/**
 * Encodes an AudioBuffer into a WAV file format (Blob).
 * @param buffer The AudioBuffer to encode.
 * @returns A Blob representing the WAV file.
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    // Get PCM data from all channels
    const channels = [];
    for (let i = 0; i < numOfChan; i++) {
        channels.push(buffer.getChannelData(i));
    }

    // Interleave channels
    const interleaved = new Float32Array(buffer.length * numOfChan);
    let offset = 0;
    for (let i = 0; i < buffer.length; i++) {
        for (let j = 0; j < numOfChan; j++) {
            interleaved[offset++] = channels[j][i];
        }
    }
    
    // Create buffer and view for WAV file
    const dataLength = interleaved.length * (bitDepth / 8);
    const bufferArray = new ArrayBuffer(44 + dataLength);
    const view = new DataView(bufferArray);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    
    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numOfChan, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true); // byte rate
    view.setUint16(32, numOfChan * (bitDepth / 8), true); // block align
    view.setUint16(34, bitDepth, true);
    
    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Write PCM data
    floatTo16BitPCM(view, 44, interleaved);

    return new Blob([view], { type: 'audio/wav' });
}

/**
 * Concatenates multiple AudioBuffer objects into a single AudioBuffer.
 * @param buffers An array of AudioBuffer objects to concatenate.
 * @param context The AudioContext to use for creating the new buffer.
 * @returns A new AudioBuffer containing the concatenated audio.
 */
export function concatenateAudioBuffers(buffers: AudioBuffer[], context: AudioContext): AudioBuffer {
    if (buffers.length === 0) {
        return context.createBuffer(1, 1, context.sampleRate);
    }

    const numberOfChannels = buffers[0].numberOfChannels;
    const sampleRate = buffers[0].sampleRate;
    
    const totalLength = buffers.reduce((acc, buffer) => acc + buffer.length, 0);
    const newBuffer = context.createBuffer(numberOfChannels, totalLength, sampleRate);

    for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = newBuffer.getChannelData(channel);
        let offset = 0;
        for (const buffer of buffers) {
            channelData.set(buffer.getChannelData(channel), offset);
            offset += buffer.length;
        }
    }

    return newBuffer;
}

/**
 * Encodes an AudioBuffer into a compressed audio file format (OGG, WebM, or MP4) using the MediaRecorder API.
 * This process happens in real-time, so it may be slow for long audio buffers.
 * @param buffer The AudioBuffer to encode.
 * @returns A Promise that resolves with a Blob representing the compressed audio file.
 */
export async function audioBufferToOgg(buffer: AudioBuffer): Promise<Blob> {
    // Check if MediaRecorder is supported
    if (typeof MediaRecorder === 'undefined') {
        throw new Error('MediaRecorder is not supported in this browser.');
    }

    // List of mime types to check, in order of preference
    const mimeTypes = [
        'audio/ogg; codecs=opus',
        'audio/webm; codecs=opus',
        'audio/webm',
        'audio/mp4'
    ];

    // Find the first supported mime type
    const selectedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));

    if (!selectedMimeType) {
        throw new Error('Compressed audio generation is not supported in this browser (tried OGG, WebM, MP4).');
    }
    
    // We need a live AudioContext to use MediaStreamAudioDestinationNode.
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: buffer.sampleRate });
    
    // Create a source node from the buffer
    const source = audioContext.createBufferSource();
    source.buffer = buffer;

    // Create a destination node that outputs a MediaStream
    const destination = audioContext.createMediaStreamDestination();
    
    source.connect(destination);
    
    return new Promise((resolve, reject) => {
        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(destination.stream, { mimeType: selectedMimeType });

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunks.push(e.data);
            }
        };

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: selectedMimeType });
            audioContext.close().catch(e => console.warn("Error closing audio context during compression.", e));
            resolve(blob);
        };
        
        recorder.onerror = (e) => {
            audioContext.close().catch(err => console.warn("Error closing audio context on compression error.", err));
            reject(new Error(`MediaRecorder error: ${e}`));
        };
        
        // When the buffer source ends, stop the recorder.
        source.onended = () => {
            // Use a small timeout to ensure the last bits of data are captured
            setTimeout(() => recorder.stop(), 100);
        };
        
        // Start recording and 'playing' the buffer into the stream destination
        recorder.start();
        source.start();
    });
}

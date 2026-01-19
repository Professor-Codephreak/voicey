import React, { useState, useEffect } from 'react';
import { AudioMixer } from './AudioMixer';
import * as audioConversionService from '../services/audioConversionService';

interface AudioFile {
    id: string;
    name: string;
    blob: Blob;
    url: string;
    duration: number;
    type: 'voice' | 'background' | 'chapter';
}

interface AudioMixerModalProps {
    onClose: () => void;
}

export const AudioMixerModal: React.FC<AudioMixerModalProps> = ({ onClose }) => {
    const [availableFiles, setAvailableFiles] = useState<AudioFile[]>([]);
    const [uploadedFiles, setUploadedFiles] = useState<AudioFile[]>([]);
    const [mixedFiles, setMixedFiles] = useState<Array<{ filename: string; url: string; size: number }>>([]);
    const [serverAvailable, setServerAvailable] = useState(false);
    const [localDirectory, setLocalDirectory] = useState('');

    useEffect(() => {
        checkServer();
    }, []);

    const checkServer = async () => {
        const available = await audioConversionService.checkServerStatus();
        setServerAvailable(available);

        if (available) {
            try {
                const dirInfo = await audioConversionService.getRecordingDirectory();
                setLocalDirectory(dirInfo.directory);
            } catch (err) {
                console.error('Failed to get recording directory:', err);
            }
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fileType: 'voice' | 'background' | 'chapter') => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newFiles: AudioFile[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            // Get audio duration
            const duration = await getAudioDuration(file);

            const audioFile: AudioFile = {
                id: `${fileType}-${Date.now()}-${i}`,
                name: file.name,
                blob: file,
                url: URL.createObjectURL(file),
                duration,
                type: fileType
            };

            newFiles.push(audioFile);
        }

        setUploadedFiles(prev => [...prev, ...newFiles]);
        setAvailableFiles(prev => [...prev, ...newFiles]);
    };

    const getAudioDuration = (file: Blob): Promise<number> => {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.onloadedmetadata = () => {
                resolve(audio.duration);
                URL.revokeObjectURL(audio.src);
            };
            audio.onerror = () => {
                resolve(0);
                URL.revokeObjectURL(audio.src);
            };
            audio.src = URL.createObjectURL(file);
        });
    };

    const handleRemoveFile = (fileId: string) => {
        const file = availableFiles.find(f => f.id === fileId);
        if (file) {
            URL.revokeObjectURL(file.url);
        }
        setAvailableFiles(prev => prev.filter(f => f.id !== fileId));
        setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    };

    const handleMixComplete = async (mixedBlob: Blob, filename: string) => {
        // Save to local filesystem if server available
        if (serverAvailable) {
            try {
                const result = await audioConversionService.saveRecording(
                    mixedBlob,
                    {
                        directory: localDirectory || undefined,
                        filename: filename,
                        format: 'wav'
                    }
                );
                console.log('Saved mixed audio to:', result.path);
                alert(`✓ Mixed audio saved to ${result.path}`);
            } catch (err) {
                console.error('Failed to save mixed audio:', err);
                alert('Failed to save: ' + (err instanceof Error ? err.message : 'Unknown error'));
            }
        }

        // Also create download link
        const url = URL.createObjectURL(mixedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Add to mixed files list
        setMixedFiles(prev => [...prev, {
            filename,
            url,
            size: mixedBlob.size
        }]);
    };

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="bg-gray-900 border-2 border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto my-8"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-6 flex justify-between items-center z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Professional Audio Mixer</h2>
                        <p className="text-sm text-gray-400 mt-1">Mix chapter voice with background audio - Professional Grade</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-3xl leading-none"
                    >
                        &times;
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* File Upload Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Upload Chapter/Voice */}
                        <div className="p-4 bg-gray-800/50 border border-purple-600/50 rounded-lg">
                            <h3 className="text-sm font-semibold text-purple-300 mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                </svg>
                                Upload Voice/Chapter
                            </h3>
                            <label className="block">
                                <input
                                    type="file"
                                    accept="audio/*"
                                    multiple
                                    onChange={(e) => handleFileUpload(e, 'voice')}
                                    className="block w-full text-xs text-gray-400 file:mr-2 file:py-2 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-purple-500/20 file:text-purple-300 hover:file:bg-purple-500/40 cursor-pointer"
                                />
                            </label>
                        </div>

                        {/* Upload Background */}
                        <div className="p-4 bg-gray-800/50 border border-green-600/50 rounded-lg">
                            <h3 className="text-sm font-semibold text-green-300 mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                                </svg>
                                Upload Background
                            </h3>
                            <label className="block">
                                <input
                                    type="file"
                                    accept="audio/*"
                                    multiple
                                    onChange={(e) => handleFileUpload(e, 'background')}
                                    className="block w-full text-xs text-gray-400 file:mr-2 file:py-2 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-green-500/20 file:text-green-300 hover:file:bg-green-500/40 cursor-pointer"
                                />
                            </label>
                        </div>

                        {/* Upload Chapter Audio */}
                        <div className="p-4 bg-gray-800/50 border border-blue-600/50 rounded-lg">
                            <h3 className="text-sm font-semibold text-blue-300 mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                                </svg>
                                Upload Chapter Audio
                            </h3>
                            <label className="block">
                                <input
                                    type="file"
                                    accept="audio/*"
                                    multiple
                                    onChange={(e) => handleFileUpload(e, 'chapter')}
                                    className="block w-full text-xs text-gray-400 file:mr-2 file:py-2 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-500/20 file:text-blue-300 hover:file:bg-blue-500/40 cursor-pointer"
                                />
                            </label>
                        </div>
                    </div>

                    {/* Uploaded Files List */}
                    {uploadedFiles.length > 0 && (
                        <div className="p-4 bg-gray-800/30 border border-gray-700 rounded-lg">
                            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center justify-between">
                                <span>Uploaded Files ({uploadedFiles.length})</span>
                                <button
                                    onClick={() => {
                                        uploadedFiles.forEach(f => URL.revokeObjectURL(f.url));
                                        setUploadedFiles([]);
                                        setAvailableFiles(prev => prev.filter(f => !uploadedFiles.includes(f)));
                                    }}
                                    className="text-xs text-red-400 hover:text-red-300"
                                >
                                    Clear All
                                </button>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                {uploadedFiles.map(file => (
                                    <div
                                        key={file.id}
                                        className="flex items-center justify-between p-2 bg-gray-900/50 rounded border border-gray-700"
                                    >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                                file.type === 'voice' ? 'bg-purple-500' :
                                                file.type === 'background' ? 'bg-green-500' :
                                                'bg-blue-500'
                                            }`} />
                                            <div className="text-xs text-white truncate">{file.name}</div>
                                            <div className="text-xs text-gray-400 flex-shrink-0">({file.duration.toFixed(1)}s)</div>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveFile(file.id)}
                                            className="ml-2 text-red-400 hover:text-red-300 text-sm flex-shrink-0"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Audio Mixer Component */}
                    {availableFiles.length >= 2 ? (
                        <div className="border-t-2 border-gray-700 pt-6">
                            <AudioMixer
                                availableFiles={availableFiles}
                                onMixComplete={handleMixComplete}
                            />
                        </div>
                    ) : (
                        <div className="p-8 bg-gray-800/30 border-2 border-dashed border-gray-700 rounded-xl text-center">
                            <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <h3 className="text-lg font-semibold text-gray-400 mb-2">Upload Audio Files to Begin</h3>
                            <p className="text-sm text-gray-500">
                                Upload at least one voice/chapter file and one background audio file to start mixing
                            </p>
                        </div>
                    )}

                    {/* Mixed Files */}
                    {mixedFiles.length > 0 && (
                        <div className="border-t-2 border-gray-700 pt-6">
                            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Mixed Audio Files ({mixedFiles.length})
                            </h3>
                            <div className="space-y-2">
                                {mixedFiles.map((file, idx) => (
                                    <div key={idx} className="p-4 bg-green-900/20 border border-green-600/50 rounded-lg flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
                                            </svg>
                                            <div>
                                                <div className="text-sm font-medium text-white">{file.filename}</div>
                                                <div className="text-xs text-green-300">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                                            </div>
                                        </div>
                                        <a
                                            href={file.url}
                                            download={file.filename}
                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors"
                                        >
                                            Download
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

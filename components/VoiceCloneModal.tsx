
import React, { useState } from 'react';
import { SpinnerIcon } from './icons/SpinnerIcon';
import eventService from '../services/eventService';
import { VoiceRecorder } from './VoiceRecorder';

interface VoiceCloneModalProps {
    apiKey: string;
    onClose: () => void;
    onCloneSuccess: () => void;
}

type Status = 'idle' | 'cloning' | 'success' | 'error';
type InputMode = 'upload' | 'record';

const VoiceCloneModal: React.FC<VoiceCloneModalProps> = ({ apiKey, onClose, onCloneSuccess }) => {
    const [name, setName] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [recordedDuration, setRecordedDuration] = useState<number>(0);
    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState<string | null>(null);
    const [inputMode, setInputMode] = useState<InputMode>('record'); // Default to record tab

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    const handleRecordingComplete = (audioBlob: Blob, duration: number) => {
        setRecordedBlob(audioBlob);
        setRecordedDuration(duration);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate based on input mode
        if (!name || !apiKey) return;
        if (inputMode === 'upload' && files.length === 0) return;
        if (inputMode === 'record' && !recordedBlob) return;

        setStatus('cloning');
        setError(null);

        try {
            // Convert recorded blob to File if in record mode
            let filesToSubmit = files;
            if (inputMode === 'record' && recordedBlob) {
                const recordedFile = new File([recordedBlob], `${name}_recording.webm`, {
                    type: recordedBlob.type,
                });
                filesToSubmit = [recordedFile];
            }

            await new Promise((resolve, reject) => {
                const onSuccess = () => {
                    cleanup();
                    resolve('Success');
                };
                const onError = (err: Error) => {
                    cleanup();
                    reject(err);
                };

                const cleanup = () => {
                    eventService.off('clone:success', onSuccess);
                    eventService.off('clone:error', onError);
                };

                eventService.on('clone:success', onSuccess);
                eventService.on('clone:error', onError);

                eventService.emit('settings:elevenlabs_clone_voice', { name, files: filesToSubmit });
            });

            setStatus('success');
            setTimeout(() => {
                onCloneSuccess();
            }, 1500); // Auto-close after success

        } catch (err) {
            setStatus('error');
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="clone-modal-title"
        >
            <div 
                className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-md p-6 text-white animate-fade-in-up"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 id="clone-modal-title" className="text-xl font-bold text-purple-300">Add / Clone a New Voice</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </div>

{status === 'success' ? (
                    <div className="text-center py-8">
                        <p className="text-green-400 font-semibold">Voice created successfully!</p>
                        <p className="text-sm text-gray-400 mt-2">Your voice list will be refreshed.</p>
                        <button onClick={onClose} className="mt-6 w-full p-2 bg-purple-500/80 rounded-lg font-semibold hover:bg-purple-600 transition-colors">Close</button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="voice-name" className="block text-sm font-medium text-gray-300 mb-1">Voice Name</label>
                            <input
                                id="voice-name"
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g., My Custom Voice"
                                required
                                className="w-full p-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                            />
                        </div>

                        {/* Tab Switcher */}
                        <div className="flex gap-2 border-b border-gray-700">
                            <button
                                type="button"
                                onClick={() => setInputMode('upload')}
                                className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                                    inputMode === 'upload'
                                        ? 'border-b-2 border-purple-500 text-purple-300'
                                        : 'text-gray-400 hover:text-gray-300'
                                }`}
                            >
                                Upload Files
                            </button>
                            <button
                                type="button"
                                onClick={() => setInputMode('record')}
                                className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                                    inputMode === 'record'
                                        ? 'border-b-2 border-purple-500 text-purple-300'
                                        : 'text-gray-400 hover:text-gray-300'
                                }`}
                            >
                                Record Voice
                            </button>
                        </div>

                        {/* Upload Mode */}
                        {inputMode === 'upload' && (
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="voice-files" className="block text-sm font-medium text-gray-300 mb-1">Audio Samples</label>
                                    <input
                                        id="voice-files"
                                        type="file"
                                        multiple
                                        onChange={handleFileChange}
                                        accept="audio/*"
                                        className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-300 hover:file:bg-purple-500/40 cursor-pointer"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Upload one or more audio files (.mp3, .wav, etc). At least 1 minute of audio is recommended.</p>
                                </div>

                                {files.length > 0 && (
                                    <div className="text-xs text-gray-400 space-y-1 max-h-24 overflow-y-auto custom-scrollbar pr-2">
                                        {files.map((file, i) => <p key={i} className="truncate">Selected: {file.name}</p>)}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Record Mode */}
                        {inputMode === 'record' && (
                            <div className="space-y-4">
                                <VoiceRecorder
                                    onRecordingComplete={handleRecordingComplete}
                                    maxDuration={300}
                                />
                                {recordedBlob && (
                                    <div className="text-sm text-green-400 bg-green-900/20 p-3 rounded-lg border border-green-700/50">
                                        Recording complete ({Math.floor(recordedDuration)}s). Ready to clone!
                                    </div>
                                )}
                            </div>
                        )}

                        {error && (
                            <div className="text-sm text-red-400 bg-red-900/50 p-3 rounded-lg border border-red-500/50">
                                <p className="font-semibold">Cloning Failed</p>
                                <p className="text-xs">{error}</p>
                            </div>
                        )}

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={
                                    status === 'cloning' ||
                                    !name ||
                                    (inputMode === 'upload' && files.length === 0) ||
                                    (inputMode === 'record' && !recordedBlob)
                                }
                                className="w-full flex items-center justify-center gap-2 p-2 bg-purple-500/80 rounded-lg font-semibold hover:bg-purple-600 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                            >
                                {status === 'cloning' ? (
                                    <>
                                        <SpinnerIcon />
                                        <span>Cloning...</span>
                                    </>
                                ) : (
                                    'Start Cloning'
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default VoiceCloneModal;

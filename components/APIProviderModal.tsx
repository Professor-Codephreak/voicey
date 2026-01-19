import React, { useState } from 'react';
import { VoiceEngine } from '../services/audioGenerationService';
import { LOCAL_TTS_PRESETS, testLocalLLMConnection, LocalLLMConfig } from '../services/localLLMService';
import { OPENAI_VOICES, OpenAIVoice } from '../services/openaiService';
import { TOGETHER_VOICES, TogetherVoice } from '../services/togetherService';
import { MISTRAL_VOICES, MistralVoice } from '../services/mistralService';

interface APIProviderModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentEngine: VoiceEngine;
    onEngineChange: (engine: VoiceEngine) => void;

    // API Keys
    openaiApiKey: string | null;
    onOpenAIKeyChange: (key: string) => void;
    togetherApiKey: string | null;
    onTogetherKeyChange: (key: string) => void;
    mistralApiKey: string | null;
    onMistralKeyChange: (key: string) => void;
    elevenLabsApiKey: string | null;
    onElevenLabsKeyChange: (key: string) => void;

    // Voice selections
    openaiVoice: OpenAIVoice;
    onOpenAIVoiceChange: (voice: OpenAIVoice) => void;
    togetherVoice: TogetherVoice;
    onTogetherVoiceChange: (voice: TogetherVoice) => void;
    mistralVoice: MistralVoice;
    onMistralVoiceChange: (voice: MistralVoice) => void;

    // Local LLM config
    localLLMConfig: LocalLLMConfig | null;
    onLocalLLMConfigChange: (config: LocalLLMConfig) => void;
    localLLMVoice: string;
    onLocalLLMVoiceChange: (voice: string) => void;
}

export const APIProviderModal: React.FC<APIProviderModalProps> = ({
    isOpen,
    onClose,
    currentEngine,
    onEngineChange,
    openaiApiKey,
    onOpenAIKeyChange,
    togetherApiKey,
    onTogetherKeyChange,
    mistralApiKey,
    onMistralKeyChange,
    elevenLabsApiKey,
    onElevenLabsKeyChange,
    openaiVoice,
    onOpenAIVoiceChange,
    togetherVoice,
    onTogetherVoiceChange,
    mistralVoice,
    onMistralVoiceChange,
    localLLMConfig,
    onLocalLLMConfigChange,
    localLLMVoice,
    onLocalLLMVoiceChange,
}) => {
    const [localApiKey, setLocalApiKey] = useState(openaiApiKey || '');
    const [localTogetherKey, setLocalTogetherKey] = useState(togetherApiKey || '');
    const [localMistralKey, setLocalMistralKey] = useState(mistralApiKey || '');
    const [localELKey, setLocalELKey] = useState(elevenLabsApiKey || '');
    const [localLLMUrl, setLocalLLMUrl] = useState(localLLMConfig?.url || 'http://localhost:5002/api/tts');
    const [localLLMFormat, setLocalLLMFormat] = useState<'openai' | 'custom'>(localLLMConfig?.format || 'custom');
    const [localLLMAuthHeader, setLocalLLMAuthHeader] = useState(localLLMConfig?.authHeader || '');
    const [localLLMVoiceParam, setLocalLLMVoiceParam] = useState(localLLMConfig?.voiceParam || 'speaker_id');
    const [localLLMAudioFormat, setLocalLLMAudioFormat] = useState<'mp3' | 'wav' | 'ogg'>(localLLMConfig?.audioFormat || 'wav');
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

    if (!isOpen) return null;

    const handleSaveOpenAI = () => {
        onOpenAIKeyChange(localApiKey);
    };

    const handleSaveTogether = () => {
        onTogetherKeyChange(localTogetherKey);
    };

    const handleSaveMistral = () => {
        onMistralKeyChange(localMistralKey);
    };

    const handleSaveElevenLabs = () => {
        onElevenLabsKeyChange(localELKey);
    };

    const handleSaveLocalLLM = () => {
        const config: LocalLLMConfig = {
            url: localLLMUrl,
            format: localLLMFormat,
            authHeader: localLLMAuthHeader || undefined,
            voiceParam: localLLMVoiceParam || undefined,
            audioFormat: localLLMAudioFormat,
        };
        onLocalLLMConfigChange(config);
    };

    const handleTestConnection = async () => {
        setTestingConnection(true);
        setConnectionStatus('idle');

        const config: LocalLLMConfig = {
            url: localLLMUrl,
            format: localLLMFormat,
            authHeader: localLLMAuthHeader || undefined,
            voiceParam: localLLMVoiceParam || undefined,
            audioFormat: localLLMAudioFormat,
        };

        const success = await testLocalLLMConnection(config);
        setConnectionStatus(success ? 'success' : 'error');
        setTestingConnection(false);
    };

    const handlePresetChange = (presetKey: string) => {
        const preset = LOCAL_TTS_PRESETS[presetKey as keyof typeof LOCAL_TTS_PRESETS];
        if (preset) {
            setLocalLLMUrl(preset.defaultUrl);
            setLocalLLMFormat(preset.format);
            setLocalLLMVoiceParam('voiceParam' in preset ? preset.voiceParam : '');
            setLocalLLMAudioFormat(preset.audioFormat);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">API Provider Settings</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                        aria-label="Close"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Engine Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Voice Engine</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => onEngineChange('gemini')}
                                className={`p-3 rounded-lg border transition-colors ${
                                    currentEngine === 'gemini'
                                        ? 'bg-blue-600 border-blue-500 text-white'
                                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                Google Gemini
                            </button>
                            <button
                                onClick={() => onEngineChange('elevenlabs')}
                                className={`p-3 rounded-lg border transition-colors ${
                                    currentEngine === 'elevenlabs'
                                        ? 'bg-blue-600 border-blue-500 text-white'
                                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                ElevenLabs
                            </button>
                            <button
                                onClick={() => onEngineChange('openai')}
                                className={`p-3 rounded-lg border transition-colors ${
                                    currentEngine === 'openai'
                                        ? 'bg-blue-600 border-blue-500 text-white'
                                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                OpenAI TTS
                            </button>
                            <button
                                onClick={() => onEngineChange('local-llm')}
                                className={`p-3 rounded-lg border transition-colors ${
                                    currentEngine === 'local-llm'
                                        ? 'bg-blue-600 border-blue-500 text-white'
                                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                Local LLM
                            </button>
                        </div>
                    </div>

                    {/* OpenAI Configuration */}
                    {currentEngine === 'openai' && (
                        <div className="space-y-4 p-4 bg-gray-700/50 rounded-lg">
                            <h3 className="text-lg font-semibold text-white">OpenAI Configuration</h3>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">API Key</label>
                                <input
                                    type="password"
                                    value={localApiKey}
                                    onChange={(e) => setLocalApiKey(e.target.value)}
                                    placeholder="sk-..."
                                    className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white placeholder-gray-400"
                                />
                                <button
                                    onClick={handleSaveOpenAI}
                                    className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                >
                                    Save API Key
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Voice</label>
                                <select
                                    value={openaiVoice}
                                    onChange={(e) => onOpenAIVoiceChange(e.target.value as OpenAIVoice)}
                                    className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                >
                                    {OPENAI_VOICES.map((voice) => (
                                        <option key={voice.id} value={voice.id}>
                                            {voice.name} - {voice.description}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Together AI Configuration */}
                    {currentEngine === 'together' && (
                        <div className="space-y-4 p-4 bg-gray-700/50 rounded-lg">
                            <h3 className="text-lg font-semibold text-white">Together AI Configuration</h3>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">API Key</label>
                                <input
                                    type="password"
                                    value={localTogetherKey}
                                    onChange={(e) => setLocalTogetherKey(e.target.value)}
                                    placeholder="Enter your Together AI API key"
                                    className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white placeholder-gray-400"
                                />
                                <button
                                    onClick={handleSaveTogether}
                                    className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                >
                                    Save API Key
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Voice</label>
                                <select
                                    value={togetherVoice}
                                    onChange={(e) => onTogetherVoiceChange(e.target.value as TogetherVoice)}
                                    className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                >
                                    {TOGETHER_VOICES.map((voice) => (
                                        <option key={voice.id} value={voice.id}>
                                            {voice.name} - {voice.description}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Mistral AI Configuration */}
                    {currentEngine === 'mistral' && (
                        <div className="space-y-4 p-4 bg-gray-700/50 rounded-lg">
                            <h3 className="text-lg font-semibold text-white">Mistral AI Configuration</h3>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">API Key</label>
                                <input
                                    type="password"
                                    value={localMistralKey}
                                    onChange={(e) => setLocalMistralKey(e.target.value)}
                                    placeholder="Enter your Mistral AI API key"
                                    className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white placeholder-gray-400"
                                />
                                <button
                                    onClick={handleSaveMistral}
                                    className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                >
                                    Save API Key
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Voice</label>
                                <select
                                    value={mistralVoice}
                                    onChange={(e) => onMistralVoiceChange(e.target.value as MistralVoice)}
                                    className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                >
                                    {MISTRAL_VOICES.map((voice) => (
                                        <option key={voice.id} value={voice.id}>
                                            {voice.name} - {voice.description}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* ElevenLabs Configuration */}
                    {currentEngine === 'elevenlabs' && (
                        <div className="space-y-4 p-4 bg-gray-700/50 rounded-lg">
                            <h3 className="text-lg font-semibold text-white">ElevenLabs Configuration</h3>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">API Key</label>
                                <input
                                    type="password"
                                    value={localELKey}
                                    onChange={(e) => setLocalELKey(e.target.value)}
                                    placeholder="Enter your ElevenLabs API key"
                                    className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white placeholder-gray-400"
                                />
                                <button
                                    onClick={handleSaveElevenLabs}
                                    className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                >
                                    Save API Key
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Local LLM Configuration */}
                    {currentEngine === 'local-llm' && (
                        <div className="space-y-4 p-4 bg-gray-700/50 rounded-lg">
                            <h3 className="text-lg font-semibold text-white">Local LLM Configuration</h3>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Preset</label>
                                <select
                                    onChange={(e) => handlePresetChange(e.target.value)}
                                    className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                >
                                    <option value="">Custom Configuration</option>
                                    {Object.entries(LOCAL_TTS_PRESETS).map(([key, preset]) => (
                                        <option key={key} value={key}>
                                            {preset.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Server URL</label>
                                <input
                                    type="text"
                                    value={localLLMUrl}
                                    onChange={(e) => setLocalLLMUrl(e.target.value)}
                                    placeholder="http://localhost:5002/api/tts"
                                    className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white placeholder-gray-400"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">API Format</label>
                                <select
                                    value={localLLMFormat}
                                    onChange={(e) => setLocalLLMFormat(e.target.value as 'openai' | 'custom')}
                                    className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                >
                                    <option value="openai">OpenAI Compatible</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>

                            {localLLMFormat === 'custom' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Voice Parameter Name</label>
                                        <input
                                            type="text"
                                            value={localLLMVoiceParam}
                                            onChange={(e) => setLocalLLMVoiceParam(e.target.value)}
                                            placeholder="speaker_id"
                                            className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white placeholder-gray-400"
                                        />
                                    </div>
                                </>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Audio Format</label>
                                <select
                                    value={localLLMAudioFormat}
                                    onChange={(e) => setLocalLLMAudioFormat(e.target.value as 'mp3' | 'wav' | 'ogg')}
                                    className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                                >
                                    <option value="mp3">MP3</option>
                                    <option value="wav">WAV</option>
                                    <option value="ogg">OGG</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Authentication Header (Optional)</label>
                                <input
                                    type="password"
                                    value={localLLMAuthHeader}
                                    onChange={(e) => setLocalLLMAuthHeader(e.target.value)}
                                    placeholder="Bearer token123"
                                    className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white placeholder-gray-400"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Voice/Speaker ID</label>
                                <input
                                    type="text"
                                    value={localLLMVoice}
                                    onChange={(e) => onLocalLLMVoiceChange(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white placeholder-gray-400"
                                />
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={handleTestConnection}
                                    disabled={testingConnection}
                                    className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white rounded transition-colors"
                                >
                                    {testingConnection ? 'Testing...' : 'Test Connection'}
                                </button>
                                <button
                                    onClick={handleSaveLocalLLM}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                >
                                    Save Configuration
                                </button>
                            </div>

                            {connectionStatus === 'success' && (
                                <div className="p-3 bg-green-900/50 border border-green-700 rounded text-green-200">
                                    ✓ Connection successful!
                                </div>
                            )}
                            {connectionStatus === 'error' && (
                                <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200">
                                    ✗ Connection failed. Check your configuration.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

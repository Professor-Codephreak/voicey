import React, { useState, useEffect } from 'react';
import storageService from '../services/storageService';

interface DataManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface StorageStats {
    backgroundAudioCount: number;
    chapterMetadataCount: number;
    cachedAudioCount: number;
    estimatedSize?: number;
}

const STORAGE_QUOTA_KEY = 'storage_quota_mb';
const DEFAULT_QUOTA_MB = 1024; // 1 GB default

export const DataManagementModal: React.FC<DataManagementModalProps> = ({ isOpen, onClose }) => {
    const [stats, setStats] = useState<StorageStats>({
        backgroundAudioCount: 0,
        chapterMetadataCount: 0,
        cachedAudioCount: 0,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteType, setDeleteType] = useState<'cache' | 'metadata' | 'background' | 'all' | null>(null);
    const [storageQuotaMB, setStorageQuotaMB] = useState<number>(() => {
        const saved = localStorage.getItem(STORAGE_QUOTA_KEY);
        return saved ? parseInt(saved, 10) : DEFAULT_QUOTA_MB;
    });
    const [availableStorageMB, setAvailableStorageMB] = useState<number | null>(null);
    const [totalStorageMB, setTotalStorageMB] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadStats();
            checkAvailableStorage();
        }
    }, [isOpen]);

    const loadStats = async () => {
        setIsLoading(true);
        try {
            const storageStats = await storageService.getStorageStats();
            setStats(storageStats);
        } catch (error) {
            console.error('Failed to load storage stats:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const checkAvailableStorage = async () => {
        try {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                const quota = estimate.quota || 0;
                const usage = estimate.usage || 0;
                const available = quota - usage;

                setTotalStorageMB(Math.floor(quota / (1024 * 1024)));
                setAvailableStorageMB(Math.floor(available / (1024 * 1024)));
            }
        } catch (error) {
            console.error('Failed to estimate storage:', error);
        }
    };

    const formatBytes = (bytes?: number): string => {
        if (!bytes) return 'Unknown';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    };

    const formatMBToReadable = (mb: number): string => {
        if (mb < 1024) return `${mb} MB`;
        return `${(mb / 1024).toFixed(2)} GB`;
    };

    const handleQuotaChange = (newQuotaMB: number) => {
        setStorageQuotaMB(newQuotaMB);
        localStorage.setItem(STORAGE_QUOTA_KEY, newQuotaMB.toString());
    };

    const getUsagePercentage = (): number => {
        if (!stats.estimatedSize) return 0;
        const usedMB = stats.estimatedSize / (1024 * 1024);
        return Math.min((usedMB / storageQuotaMB) * 100, 100);
    };

    const getMaxQuotaMB = (): number => {
        // Use available storage if known, otherwise fallback to default 10GB
        if (availableStorageMB !== null && availableStorageMB > 0) {
            // Allow up to 90% of available storage to leave some headroom
            const maxFromAvailable = Math.floor(availableStorageMB * 0.9);
            // But never less than 1GB
            return Math.max(maxFromAvailable, 1024);
        }
        return 10240; // 10GB default fallback
    };

    const isApproachingQuota = (): boolean => {
        return getUsagePercentage() >= 80;
    };

    const isOverQuota = (): boolean => {
        return getUsagePercentage() >= 100;
    };

    const handleDeleteRequest = (type: 'cache' | 'metadata' | 'background' | 'all') => {
        setDeleteType(type);
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        if (!deleteType) return;

        setIsLoading(true);
        try {
            switch (deleteType) {
                case 'cache':
                    await storageService.clearAllCachedAudio();
                    break;
                case 'metadata':
                    await storageService.clearAllChapterMetadata();
                    break;
                case 'background':
                    // Get all background audio and delete each one
                    const bgAudios = await storageService.getAllBackgroundAudio();
                    for (const audio of bgAudios) {
                        await storageService.deleteBackgroundAudio(audio.id);
                    }
                    break;
                case 'all':
                    await storageService.clearAllData();
                    // Also clear localStorage
                    const keysToRemove = [
                        'elevenlabs_api_key',
                        'elevenlabs_voice_id',
                        'openai_api_key',
                        'openai_voice',
                        'together_api_key',
                        'together_voice',
                        'mistral_api_key',
                        'mistral_voice',
                        'local_llm_config',
                        'local_llm_voice',
                        'background_audio_settings',
                        'voice_engine',
                        'spectrogram_settings',
                        'completed_chapters',
                        'bookmarked_chapters',
                        'pre_cache_buffer_count',
                        'audio_filter_settings',
                        'oscilloscope_theme',
                    ];
                    keysToRemove.forEach(key => localStorage.removeItem(key));
                    break;
            }
            await loadStats();
            setShowDeleteConfirm(false);
            setDeleteType(null);

            if (deleteType === 'all') {
                // Reload the page after complete deletion
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        } catch (error) {
            console.error('Failed to delete data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelDelete = () => {
        setShowDeleteConfirm(false);
        setDeleteType(null);
    };

    const getDeleteMessage = (): string => {
        switch (deleteType) {
            case 'cache':
                return `Delete all ${stats.cachedAudioCount} cached audio files? You can re-generate them anytime.`;
            case 'metadata':
                return `Delete metadata for ${stats.chapterMetadataCount} chapters? This will remove tracking of which voice/background was used.`;
            case 'background':
                return `Delete all ${stats.backgroundAudioCount} background audio files? This cannot be undone.`;
            case 'all':
                return 'Delete ALL application data including settings, API keys, cached audio, and background files? This will reset the app completely and reload the page.';
            default:
                return '';
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="data-management-title"
        >
            <div
                className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl p-6 text-white animate-fade-in-up max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 id="data-management-title" className="text-2xl font-bold text-purple-300">
                        Data Management
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-2xl leading-none"
                        aria-label="Close"
                    >
                        &times;
                    </button>
                </div>

                {showDeleteConfirm ? (
                    <div className="space-y-6">
                        <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-lg">
                            <div className="flex items-start gap-3">
                                <svg className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div>
                                    <h3 className="text-lg font-semibold text-red-300 mb-2">Confirm Deletion</h3>
                                    <p className="text-gray-300">{getDeleteMessage()}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleCancelDelete}
                                disabled={isLoading}
                                className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 text-white rounded-lg transition-colors font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                disabled={isLoading}
                                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Deleting...
                                    </>
                                ) : (
                                    'Delete'
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Storage Overview */}
                        <div className="p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                            <h3 className="text-lg font-semibold text-blue-300 mb-3">Storage Overview</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <div className="text-gray-400">Total Storage Used</div>
                                    <div className="text-xl font-bold text-white">{formatBytes(stats.estimatedSize)}</div>
                                </div>
                                <div>
                                    <div className="text-gray-400">Total Items</div>
                                    <div className="text-xl font-bold text-white">
                                        {stats.backgroundAudioCount + stats.chapterMetadataCount + stats.cachedAudioCount}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Storage Quota Settings */}
                        <div className={`p-4 rounded-lg border ${
                            isOverQuota()
                                ? 'bg-red-900/20 border-red-700/50'
                                : isApproachingQuota()
                                ? 'bg-yellow-900/20 border-yellow-700/50'
                                : 'bg-gray-700/50 border-gray-600/50'
                        }`}>
                            <h3 className="text-lg font-semibold text-white mb-3">Storage Quota</h3>

                            {/* Usage Bar */}
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-2 text-sm">
                                    <span className="text-gray-400">
                                        {formatBytes(stats.estimatedSize)} used of {formatMBToReadable(storageQuotaMB)}
                                    </span>
                                    <span className={`font-semibold ${
                                        isOverQuota()
                                            ? 'text-red-400'
                                            : isApproachingQuota()
                                            ? 'text-yellow-400'
                                            : 'text-green-400'
                                    }`}>
                                        {getUsagePercentage().toFixed(1)}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                                    <div
                                        className={`h-3 rounded-full transition-all duration-300 ${
                                            isOverQuota()
                                                ? 'bg-red-500'
                                                : isApproachingQuota()
                                                ? 'bg-yellow-500'
                                                : 'bg-green-500'
                                        }`}
                                        style={{ width: `${getUsagePercentage()}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Warning Messages */}
                            {isOverQuota() && (
                                <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-sm text-red-200">
                                    <div className="flex items-start gap-2">
                                        <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <div>
                                            <strong>Quota exceeded!</strong> Consider clearing cached audio or increasing your storage limit.
                                        </div>
                                    </div>
                                </div>
                            )}
                            {isApproachingQuota() && !isOverQuota() && (
                                <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-sm text-yellow-200">
                                    <div className="flex items-start gap-2">
                                        <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div>
                                            <strong>Approaching limit.</strong> You're using over 80% of your storage quota.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Quota Slider */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-gray-300">
                                        Storage Limit: {formatMBToReadable(storageQuotaMB)}
                                    </label>
                                    {availableStorageMB !== null && (
                                        <div className="text-xs text-blue-400">
                                            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {formatMBToReadable(availableStorageMB)} available
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-xs text-gray-400 w-12">100 MB</span>
                                    <input
                                        type="range"
                                        min="100"
                                        max={getMaxQuotaMB()}
                                        step="100"
                                        value={Math.min(storageQuotaMB, getMaxQuotaMB())}
                                        onChange={(e) => handleQuotaChange(parseInt(e.target.value, 10))}
                                        className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                    <span className="text-xs text-gray-400 w-16 text-right">
                                        {formatMBToReadable(getMaxQuotaMB())}
                                    </span>
                                </div>
                                <div className="mt-2 text-xs text-gray-400 text-center">
                                    {availableStorageMB !== null ? (
                                        <span>
                                            Adjust your storage limit based on {formatMBToReadable(totalStorageMB || 0)} total device storage
                                        </span>
                                    ) : (
                                        <span>Slide to adjust your local storage limit</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Cached Audio */}
                        <div className="p-4 bg-gray-700/50 rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Cached Audio Files</h3>
                                    <p className="text-sm text-gray-400">Generated chapter audio stored for quick playback</p>
                                </div>
                                <div className="text-2xl font-bold text-purple-400">{stats.cachedAudioCount}</div>
                            </div>
                            <button
                                onClick={() => handleDeleteRequest('cache')}
                                disabled={isLoading || stats.cachedAudioCount === 0}
                                className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors font-semibold"
                            >
                                Clear Cached Audio
                            </button>
                        </div>

                        {/* Chapter Metadata */}
                        <div className="p-4 bg-gray-700/50 rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Chapter Metadata</h3>
                                    <p className="text-sm text-gray-400">Tracking info for voice and background used per chapter</p>
                                </div>
                                <div className="text-2xl font-bold text-purple-400">{stats.chapterMetadataCount}</div>
                            </div>
                            <button
                                onClick={() => handleDeleteRequest('metadata')}
                                disabled={isLoading || stats.chapterMetadataCount === 0}
                                className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors font-semibold"
                            >
                                Clear Metadata
                            </button>
                        </div>

                        {/* Background Audio */}
                        <div className="p-4 bg-gray-700/50 rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Background Audio Files</h3>
                                    <p className="text-sm text-gray-400">Uploaded music and ambient sounds for mixing</p>
                                </div>
                                <div className="text-2xl font-bold text-purple-400">{stats.backgroundAudioCount}</div>
                            </div>
                            <button
                                onClick={() => handleDeleteRequest('background')}
                                disabled={isLoading || stats.backgroundAudioCount === 0}
                                className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors font-semibold"
                            >
                                Delete Background Audio
                            </button>
                        </div>

                        {/* Danger Zone - Complete Deletion */}
                        <div className="p-4 bg-red-900/20 border-2 border-red-700/50 rounded-lg">
                            <div className="mb-3">
                                <h3 className="text-lg font-semibold text-red-300 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    Danger Zone
                                </h3>
                                <p className="text-sm text-gray-400 mt-1">Permanently delete all application data and reset to factory settings</p>
                            </div>
                            <button
                                onClick={() => handleDeleteRequest('all')}
                                disabled={isLoading}
                                className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded transition-colors font-semibold flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete Everything & Reset App
                            </button>
                        </div>

                        <button
                            onClick={loadStats}
                            disabled={isLoading}
                            className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 text-white rounded transition-colors font-semibold flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh Stats
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

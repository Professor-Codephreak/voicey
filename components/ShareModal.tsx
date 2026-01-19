import React, { useState } from 'react';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    chapterTitle: string;
    audioBlob: Blob;
    audioFormat: 'wav' | 'ogg';
}

export const ShareModal: React.FC<ShareModalProps> = ({
    isOpen,
    onClose,
    chapterTitle,
    audioBlob,
    audioFormat,
}) => {
    const [shareLink, setShareLink] = useState<string>('');
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const generateShareLink = () => {
        // Create a blob URL for sharing
        const url = URL.createObjectURL(audioBlob);
        setShareLink(url);
        return url;
    };

    const handleCopyLink = async () => {
        const link = shareLink || generateShareLink();
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleDownloadAndShare = () => {
        const link = shareLink || generateShareLink();
        const a = document.createElement('a');
        a.href = link;
        a.download = `${chapterTitle}.${audioFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleShare = async () => {
        const link = shareLink || generateShareLink();
        const file = new File([audioBlob], `${chapterTitle}.${audioFormat}`, {
            type: audioFormat === 'ogg' ? 'audio/ogg' : 'audio/wav',
        });

        if (navigator.share) {
            try {
                await navigator.share({
                    title: chapterTitle,
                    text: `Listen to: ${chapterTitle}`,
                    files: [file],
                });
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    console.error('Error sharing:', err);
                    // Fallback to download
                    handleDownloadAndShare();
                }
            }
        } else {
            // Fallback: just download
            handleDownloadAndShare();
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
        >
            <div
                className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-md p-6 text-white animate-fade-in-up"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 id="share-modal-title" className="text-xl font-bold text-blue-300">
                        Share Audio
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-2xl leading-none"
                        aria-label="Close"
                    >
                        &times;
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Chapter Info */}
                    <div className="p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                        <h3 className="font-semibold text-blue-300 mb-1">Chapter</h3>
                        <p className="text-gray-300 text-sm">{chapterTitle}</p>
                        <div className="mt-2 text-xs text-gray-400">
                            Format: <span className="text-blue-400 uppercase font-semibold">{audioFormat}</span>
                            {' • '}
                            Size: {(audioBlob.size / (1024 * 1024)).toFixed(2)} MB
                        </div>
                    </div>

                    {/* Share Options */}
                    <div className="space-y-3">
                        {/* Native Share (Mobile/Desktop) */}
                        <button
                            onClick={handleShare}
                            className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all flex items-center justify-center gap-3 font-semibold shadow-lg"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                            Share with Friends
                        </button>

                        {/* Download for Manual Sharing */}
                        <button
                            onClick={handleDownloadAndShare}
                            className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center gap-3 font-semibold"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download to Device
                        </button>

                        {/* Copy Link */}
                        <button
                            onClick={handleCopyLink}
                            className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center gap-3 font-semibold"
                        >
                            {copied ? (
                                <>
                                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-green-400">Link Copied!</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                    </svg>
                                    Copy Shareable Link
                                </>
                            )}
                        </button>
                    </div>

                    {/* Info Note */}
                    <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg text-xs text-yellow-200">
                        <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <strong>Tip:</strong> Share via messaging apps, email, or cloud storage.
                                OGG format is recommended for smaller file sizes and easier streaming.
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="mt-6 w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-semibold"
                >
                    Close
                </button>
            </div>
        </div>
    );
};

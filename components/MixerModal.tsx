
import React, { useState } from 'react';
import type { FilterSettings, OscilloscopeTheme, ColorScheme } from '../types';
import { FilterIcon } from './icons/FilterIcon';
import { SpectrogramIcon } from './icons/SpectrogramIcon';
import { WaveformIcon } from './icons/WaveformIcon';

interface SpectrogramSettings {
    minFrequency: number;
    maxFrequency: number;
    intensity: number;
    colorScheme: ColorScheme;
}

interface MixerModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab: 'filter' | 'visualizer';
    spectrogramSettings: SpectrogramSettings;
    onSpectrogramChange: (settings: Partial<SpectrogramSettings>) => void;
    filterSettings: FilterSettings;
    onFilterSettingsChange: (settings: Partial<FilterSettings>) => void;
    oscilloscopeTheme: OscilloscopeTheme;
    onOscilloscopeThemeChange: (theme: OscilloscopeTheme) => void;
    freqToSliderVal: (freq: number) => number;
    sliderValToFreq: (val: number) => number;
    intensityToSliderVal: (intensity: number) => number;
    sliderValToIntensity: (val: number) => number;
}

type FilterTypeOption = 'off' | 'lowpass' | 'highpass' | 'bandpass';

const COLOR_SCHEME_PREVIEWS: Record<ColorScheme, string> = {
    vibrant: 'linear-gradient(to right, hsl(240, 100%, 25%), hsl(120, 100%, 50%), hsl(0, 100%, 65%))',
    inferno: 'linear-gradient(to right, #000004, #720026, #f8961e, #fcf6bd)',
    viridis: 'linear-gradient(to right, #440154, #21908d, #fde725)',
    grayscale: 'linear-gradient(to right, #000000, #ffffff)',
    ocean: 'linear-gradient(to right, hsl(180, 100%, 15%), hsl(220, 100%, 75%))'
};

const MixerModal: React.FC<MixerModalProps> = ({
    isOpen,
    onClose,
    initialTab,
    spectrogramSettings,
    onSpectrogramChange,
    filterSettings,
    onFilterSettingsChange,
    oscilloscopeTheme,
    onOscilloscopeThemeChange,
    freqToSliderVal,
    sliderValToFreq,
    intensityToSliderVal,
    sliderValToIntensity,
}) => {
    const [activeTab, setActiveTab] = useState<'filter' | 'visualizer'>(initialTab);

    if (!isOpen) return null;

    const handleMinFrequencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newMinFreq = sliderValToFreq(Number(e.target.value));
        if (newMinFreq < spectrogramSettings.maxFrequency) {
            onSpectrogramChange({ minFrequency: newMinFreq });
        }
    };
    const handleMaxFrequencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newMaxFreq = sliderValToFreq(Number(e.target.value));
        if (newMaxFreq > spectrogramSettings.minFrequency) {
            onSpectrogramChange({ maxFrequency: newMaxFreq });
        }
    };
    const handleIntensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onSpectrogramChange({ intensity: sliderValToIntensity(Number(e.target.value)) });
    };

    const filterTypeForUI: FilterTypeOption =
        filterSettings.type === 'lowpass' ? 'lowpass'
        : filterSettings.type === 'highpass' ? 'highpass'
        : filterSettings.type === 'bandpass' ? 'bandpass'
        : 'off';

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-md transition-all duration-300"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div 
                className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gray-900/50">
                    <h2 className="text-2xl font-bold text-white tracking-wide">Audio Mixer & Visualization</h2>
                    <button 
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <span className="text-2xl leading-none">&times;</span>
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-1/3 md:w-64 bg-gray-900/30 border-r border-gray-700 flex flex-col p-2 space-y-1">
                        <button
                            onClick={() => setActiveTab('filter')}
                            className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 ${
                                activeTab === 'filter' 
                                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 shadow-lg' 
                                    : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                            }`}
                        >
                            <FilterIcon />
                            <span className="font-semibold">EQ & Filter</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('visualizer')}
                            className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 ${
                                activeTab === 'visualizer' 
                                    ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30 shadow-lg' 
                                    : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                            }`}
                        >
                            <SpectrogramIcon />
                            <span className="font-semibold">Visualizer</span>
                        </button>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar bg-gray-800/50">
                        {activeTab === 'filter' && (
                            <div className="space-y-8 animate-fade-in-up">
                                <div>
                                    <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                        <FilterIcon /> Audio Filter Mode
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {(['off', 'lowpass', 'highpass', 'bandpass'] as FilterTypeOption[]).map(type => (
                                            <button 
                                                key={type}
                                                onClick={() => onFilterSettingsChange({ type: type === 'off' ? 'allpass' : type })}
                                                className={`
                                                    capitalize py-4 px-4 rounded-xl border-2 transition-all duration-200 font-semibold text-sm
                                                    ${filterTypeForUI === type 
                                                        ? 'border-blue-500 bg-blue-500/10 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                                                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:bg-gray-750'
                                                    }
                                                `}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="mt-3 text-sm text-gray-500">
                                        Select a filter mode to shape the audio output. "Off" passes the raw signal.
                                    </p>
                                </div>

                                <div className={`space-y-6 transition-opacity duration-300 ${filterTypeForUI === 'off' ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}>
                                    <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700/50">
                                        <div className="flex justify-between items-baseline mb-2">
                                            <label htmlFor="filter-frequency" className="text-base font-medium text-gray-200">Cutoff Frequency</label>
                                            <span className="font-mono text-lg text-blue-400 font-bold">{Math.round(filterSettings.frequency)} Hz</span>
                                        </div>
                                        <input 
                                            id="filter-frequency" type="range" min="0" max="1" step="0.001"
                                            value={freqToSliderVal(filterSettings.frequency)}
                                            onChange={(e) => onFilterSettingsChange({ frequency: sliderValToFreq(Number(e.target.value)) })}
                                            className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                                        />
                                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                                            <span>Bass</span>
                                            <span>Mids</span>
                                            <span>Treble</span>
                                        </div>
                                    </div>

                                    <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700/50">
                                        <div className="flex justify-between items-baseline mb-2">
                                            <label htmlFor="qfactor" className="text-base font-medium text-gray-200">Resonance (Q Factor)</label>
                                            <span className="font-mono text-lg text-blue-400 font-bold">{filterSettings.q.toFixed(1)}</span>
                                        </div>
                                        <input 
                                            id="qfactor" type="range" min="0.1" max="20" step="0.1"
                                            value={filterSettings.q}
                                            onChange={(e) => onFilterSettingsChange({ q: Number(e.target.value) })}
                                            className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                                        />
                                        <p className="text-xs text-gray-500 mt-2">Adjusts the peak sharpness around the cutoff frequency.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'visualizer' && (
                            <div className="space-y-8 animate-fade-in-up">
                                <div>
                                    <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                        <WaveformIcon /> Oscilloscope Theme
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {(['cyberpunk', 'matrix', 'arcade', 'plasma'] as OscilloscopeTheme[]).map(theme => (
                                            <button
                                                key={theme}
                                                onClick={() => onOscilloscopeThemeChange(theme)}
                                                className={`
                                                    capitalize py-3 px-2 rounded-xl border-2 transition-all duration-200 text-sm font-semibold
                                                    ${oscilloscopeTheme === theme 
                                                        ? 'border-purple-500 bg-purple-500/10 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]' 
                                                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                                                    }
                                                `}
                                            >
                                                {theme}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="border-t border-gray-700 my-6"></div>

                                <div>
                                    <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                        <SpectrogramIcon /> Spectrogram Settings
                                    </h3>
                                    
                                    <label className="text-sm font-medium text-gray-400 mb-3 block">Color Scheme</label>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
                                        {(['vibrant', 'inferno', 'viridis', 'grayscale', 'ocean'] as ColorScheme[]).map(scheme => (
                                            <button
                                                key={scheme}
                                                onClick={() => onSpectrogramChange({ colorScheme: scheme })}
                                                className={`
                                                    group relative overflow-hidden rounded-lg transition-all duration-200 ring-2 ring-offset-2 ring-offset-gray-800
                                                    ${spectrogramSettings.colorScheme === scheme 
                                                        ? 'ring-purple-500 scale-105 shadow-lg' 
                                                        : 'ring-transparent hover:ring-purple-500/50 hover:scale-[1.02]'
                                                    }
                                                `}
                                                title={`Set color scheme to ${scheme}`}
                                            >
                                                <div
                                                    className="w-full h-12"
                                                    style={{ background: COLOR_SCHEME_PREVIEWS[scheme] }}
                                                    aria-hidden="true"
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="text-xs font-bold text-white capitalize shadow-sm">
                                                        {scheme === 'grayscale' ? 'Gray' : scheme}
                                                    </span>
                                                </div>
                                                {spectrogramSettings.colorScheme === scheme && (
                                                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                        <span className="text-xs font-bold text-white capitalize drop-shadow-md">
                                                            {scheme === 'grayscale' ? 'Gray' : scheme}
                                                        </span>
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700/50 space-y-6">
                                        <div>
                                            <div className="flex justify-between items-baseline mb-2">
                                                <label htmlFor="intensity" className="text-sm font-medium text-gray-300">Signal Intensity</label>
                                                <span className="font-mono text-sm text-purple-400 font-bold">{spectrogramSettings.intensity.toFixed(2)}x</span>
                                            </div>
                                            <input 
                                                id="intensity" type="range" min="0" max="1" step="0.005"
                                                value={intensityToSliderVal(spectrogramSettings.intensity)}
                                                onChange={handleIntensityChange}
                                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <div className="flex justify-between items-baseline mb-2">
                                                    <label htmlFor="min-frequency" className="text-sm font-medium text-gray-300">Min Frequency</label>
                                                    <span className="font-mono text-sm text-purple-400 font-bold">{Math.round(spectrogramSettings.minFrequency)} Hz</span>
                                                </div>
                                                <input 
                                                    id="min-frequency" type="range" min="0" max="1" step="0.001"
                                                    value={freqToSliderVal(spectrogramSettings.minFrequency)}
                                                    onChange={handleMinFrequencyChange}
                                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
                                                />
                                            </div>
                                            <div>
                                                <div className="flex justify-between items-baseline mb-2">
                                                    <label htmlFor="max-frequency" className="text-sm font-medium text-gray-300">Max Frequency</label>
                                                    <span className="font-mono text-sm text-purple-400 font-bold">{Math.round(spectrogramSettings.maxFrequency)} Hz</span>
                                                </div>
                                                <input 
                                                    id="max-frequency" type="range" min="0" max="1" step="0.001"
                                                    value={freqToSliderVal(spectrogramSettings.maxFrequency)}
                                                    onChange={handleMaxFrequencyChange}
                                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MixerModal;

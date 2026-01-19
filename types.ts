
export interface Chapter {
    title: string;
    content: string;
}

export interface Book {
    title: string;
    subtitle: string;
    author: string;
    chapters: Chapter[];
}

export type OscilloscopeTheme = 'cyberpunk' | 'matrix' | 'arcade' | 'plasma';
export type ColorScheme = 'vibrant' | 'inferno' | 'viridis' | 'grayscale' | 'ocean';

export interface SpectrogramSettings {
    minFrequency: number;
    maxFrequency: number;
    intensity: number;
    colorScheme: ColorScheme;
}

export interface FilterSettings {
    type: BiquadFilterType;
    frequency: number;
    q: number;
}

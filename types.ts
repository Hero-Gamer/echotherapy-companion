export interface FlowerConfig {
  baseColor: string;
  intensity: number; // 1-10
  bloomSpeed: number; // 1-5
  style: 'spiky' | 'drooping' | 'trembling' | 'calm' | 'particle';
}

export interface AnalysisResult {
  emotion: string;
  empathySummary: string;
  copingPlan: string[];
  flowerConfig: FlowerConfig;
  affirmationText: string;
  distressScore: number; // 0.0 to 1.0 (1.0 = high crisis)
}

export interface ProcessingState {
  status: 'idle' | 'recording' | 'analyzing' | 'completed' | 'error';
  errorMessage?: string;
}

export enum MediaType {
  AUDIO = 'audio',
  VIDEO = 'video'
}
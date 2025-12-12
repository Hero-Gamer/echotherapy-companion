import React, { useState, useRef } from 'react';
import { Recorder } from './components/Recorder';
import { MoodFlower } from './components/MoodFlower';
import { analyzeSession, generateAffirmationAudio } from './services/geminiService';
import { AnalysisResult, MediaType, ProcessingState } from './types';
import { RotateCcw, Volume2, VolumeX, Download, AlertTriangle, PlayCircle, PauseCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import confetti from 'canvas-confetti';

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Data URL format: "data:audio/webm;base64,....."
      // We need just the base64 part
      const result = reader.result as string;
      const base64String = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const pcmToAudioBuffer = (buffer: ArrayBuffer, ctx: AudioContext): AudioBuffer => {
  // Gemini 2.5 Flash TTS returns raw 16-bit PCM at 24kHz
  const pcmData = new Int16Array(buffer);
  const channels = 1;
  const sampleRate = 24000;
  
  const audioBuffer = ctx.createBuffer(channels, pcmData.length, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  
  // Convert Int16 to Float32 [-1.0, 1.0]
  for (let i = 0; i < pcmData.length; i++) {
    channelData[i] = pcmData[i] / 32768.0;
  }
  
  return audioBuffer;
};

const BreathingWidget = () => (
  <div className="flex items-center justify-center space-x-3 bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full border border-white/40">
    <div className="relative w-4 h-4 flex items-center justify-center">
       <div className="absolute inset-0 bg-teal-400 rounded-full animate-breathe opacity-50"></div>
       <div className="absolute w-2 h-2 bg-teal-500 rounded-full animate-breathe" style={{ animationDelay: '0.5s' }}></div>
    </div>
    <span className="text-xs font-semibold text-teal-700 tracking-wide uppercase">Inhale ... Exhale</span>
  </div>
);

export default function App() {
  const [state, setState] = useState<ProcessingState>({ status: 'idle' });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  const handleRecordingComplete = async (blob: Blob, type: MediaType, mimeType: string) => {
    setState({ status: 'analyzing' });
    try {
      const base64Data = await blobToBase64(blob);
      
      // Use the actual mime type from the recorder, or fallback
      const finalMimeType = mimeType || (type === MediaType.VIDEO ? 'video/webm' : 'audio/webm');
      console.log(`Analyzing ${base64Data.length} bytes of ${finalMimeType}`);

      // 1. Get Analysis
      const analysisData = await analyzeSession(base64Data, finalMimeType);
      setResult(analysisData);

      // 2. Get Audio (Parallel-ish, but after we have text)
      const audioBufferData = await generateAffirmationAudio(analysisData.affirmationText);
      
      // Decode Audio for Playback
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      // FIX: Use manual PCM conversion instead of decodeAudioData
      const decodedBuffer = pcmToAudioBuffer(audioBufferData, audioContextRef.current);
      audioBufferRef.current = decodedBuffer;
      
      setState({ status: 'completed' });
      
      // Trigger confetti if happy
      if (['particle', 'calm'].includes(analysisData.flowerConfig.style) && analysisData.emotion.match(/joy|relief|happy|hope/i)) {
         setTimeout(() => {
           confetti({
              particleCount: 150,
              spread: 100,
              origin: { y: 0.6 },
              colors: [analysisData.flowerConfig.baseColor, '#ffffff', '#fbbf24']
           });
         }, 500);
      }

      playAudio(); // Auto-play affirmation
      
    } catch (error) {
      console.error(error);
      setState({ status: 'error', errorMessage: 'We couldn\'t quite catch that. Please try again.' });
    }
  };

  const playAudio = async () => {
    if (!audioContextRef.current || !audioBufferRef.current) return;
    
    // Resume context if suspended (browser policy)
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.connect(audioContextRef.current.destination);
    source.onended = () => setIsPlaying(false);
    source.start();
    sourceNodeRef.current = source;
    setIsPlaying(true);
  };

  const stopAudio = () => {
      if (sourceNodeRef.current) {
          sourceNodeRef.current.stop();
          setIsPlaying(false);
      }
  };

  const reset = () => {
    setState({ status: 'idle' });
    setResult(null);
    stopAudio();
    audioBufferRef.current = null;
  };

  const saveMoment = async () => {
    if (!captureRef.current) return;
    setIsSaving(true);
    try {
      // Small delay to ensure rendering
      await new Promise(resolve => setTimeout(resolve, 100));
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: '#ffffff',
        scale: 3, // High res for print quality
        useCORS: true
      });
      const link = document.createElement('a');
      link.download = `echo-moment-${new Date().toISOString().slice(0,10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error("Save failed", err);
    }
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-800">
      {/* Premium Header */}
      <header className="py-6 px-8 flex justify-center sticky top-0 bg-white/70 backdrop-blur-xl z-20 border-b border-white/40 shadow-sm">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-500 to-teal-500 tracking-tight">
          EchoTherapy
        </h1>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-start p-6 md:p-10 max-w-3xl mx-auto w-full space-y-12">
        
        {state.status === 'error' && (
          <div className="w-full glass-card border-l-4 border-red-400 p-6 rounded-xl flex items-center justify-between animate-fade-in-up">
            <div className="flex items-center space-x-4">
               <div className="bg-red-100 p-2 rounded-full text-red-500">
                 <AlertTriangle size={24} />
               </div>
               <p className="text-red-800 font-medium">{state.errorMessage}</p>
            </div>
            <button onClick={reset} className="px-4 py-2 bg-white text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors">Try Again</button>
          </div>
        )}

        {state.status === 'idle' || state.status === 'recording' || state.status === 'analyzing' ? (
           <div className="w-full mt-8">
              <Recorder 
                onRecordingComplete={handleRecordingComplete} 
                isProcessing={state.status === 'analyzing'} 
              />
           </div>
        ) : null}

        {state.status === 'completed' && result && (
          <div className="w-full space-y-10 animate-fade-in-up pb-24">
            
            {/* Crisis Resource Box (Only if high distress) */}
            {result.distressScore > 0.8 && (
               <div className="glass-card bg-orange-50/80 border-orange-200 p-6 rounded-2xl flex items-start space-x-4 text-orange-900 shadow-soft">
                  <AlertTriangle className="flex-shrink-0 mt-1 text-orange-600" size={24} />
                  <div className="text-sm leading-relaxed">
                     <p className="font-bold text-lg mb-2">You are going through a difficult moment.</p>
                     <p className="mb-3">You don't have to carry this alone. Immediate support is available:</p>
                     <div className="flex flex-wrap gap-3">
                        <span className="bg-white/60 px-3 py-1 rounded-md font-bold border border-orange-200">988 (US Crisis Line)</span>
                        <span className="bg-white/60 px-3 py-1 rounded-md font-bold border border-orange-200">Text HOME to 741741</span>
                     </div>
                  </div>
               </div>
            )}

            {/* 1. Empathy Header */}
            <section className="text-center space-y-6">
              <div className="inline-flex items-center space-x-2 px-4 py-1.5 bg-white/60 backdrop-blur-md rounded-full border border-white/50 shadow-sm">
                 <span className="w-2 h-2 rounded-full" style={{ backgroundColor: result.flowerConfig.baseColor }}></span>
                 <span className="text-sm font-semibold text-slate-600 uppercase tracking-wider">{result.emotion}</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-light leading-tight text-slate-800 tracking-tight">
                {result.empathySummary}
              </h2>
            </section>

            {/* 2. Mood Flower Card - CAPTURE ZONE */}
            <section className="relative group">
              <div 
                ref={captureRef}
                className="flex flex-col items-center justify-center pt-16 pb-12 px-8 glass-card-dark rounded-[3rem] shadow-2xl relative overflow-hidden transition-all duration-500"
              >
                 {/* Decorative background gradient based on emotion */}
                 <div 
                   className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none transition-colors duration-1000"
                   style={{ background: `radial-gradient(circle at 50% 30%, ${result.flowerConfig.baseColor}, transparent 70%)` }}
                 ></div>

                 <MoodFlower config={result.flowerConfig} onClick={isPlaying ? stopAudio : playAudio} />
                 
                 <div className="mt-10 text-center max-w-lg z-10 space-y-6">
                    <p className="text-slate-700 text-xl md:text-2xl italic font-serif leading-relaxed">"{result.affirmationText}"</p>
                    <div className="flex items-center justify-center space-x-3 opacity-50">
                       <div className="h-px w-8 bg-slate-400"></div>
                       <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">EchoTherapy</span>
                       <div className="h-px w-8 bg-slate-400"></div>
                    </div>
                 </div>
              </div>
              
              {/* Floating Controls */}
              <div className="absolute top-6 right-6 flex space-x-3 z-20">
                 <button 
                  onClick={saveMoment}
                  disabled={isSaving}
                  className="p-3 bg-white/90 backdrop-blur-md rounded-full shadow-lg text-slate-500 hover:text-indigo-600 transition-all hover:scale-105 active:scale-95 border border-white/50"
                  title="Save visual"
                 >
                   {isSaving ? <span className="animate-spin text-lg">⏳</span> : <Download size={20} />}
                 </button>
              </div>

              {/* Audio Player Control underneath */}
              <div className="absolute -bottom-6 left-0 right-0 flex justify-center z-20">
                 <button 
                    onClick={isPlaying ? stopAudio : playAudio}
                    className="flex items-center space-x-3 bg-slate-800 text-white px-8 py-3 rounded-full hover:bg-slate-900 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0"
                  >
                    {isPlaying ? (
                        <>
                           <PauseCircle size={20} className="text-teal-400" />
                           <span className="font-medium">Pause Voice</span>
                        </>
                    ) : (
                        <>
                           <PlayCircle size={20} className="text-teal-400" />
                           <span className="font-medium">Listen to Reflection</span>
                        </>
                    )}
                  </button>
              </div>
            </section>

            <div className="pt-8 flex justify-center">
                 <BreathingWidget />
            </div>

            {/* 3. Actionable Coping Cards */}
            <section className="space-y-6 pt-6">
              <h3 className="text-xl font-bold text-slate-700 flex items-center px-2">
                 <span className="mr-2 opacity-60">🌱</span>
                 Suggested Practice
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {result.copingPlan.map((step, idx) => (
                  <div key={idx} className="glass-card p-6 rounded-2xl hover:bg-white/80 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group border border-white/60">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 text-indigo-600 font-bold flex items-center justify-center mb-4 text-lg shadow-sm group-hover:scale-110 transition-transform">
                      {idx + 1}
                    </div>
                    <p className="text-slate-600 font-medium leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex justify-center pt-10">
               <button 
                 onClick={reset}
                 className="flex items-center space-x-2 text-slate-500 hover:text-indigo-600 transition-colors px-6 py-3 rounded-full hover:bg-white/50 border border-transparent hover:border-slate-200"
               >
                 <RotateCcw size={18} />
                 <span className="font-medium">Start New Session</span>
               </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
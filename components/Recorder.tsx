import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Video, Loader2 } from 'lucide-react';
import { MediaType } from '../types';

interface RecorderProps {
  onRecordingComplete: (blob: Blob, type: MediaType, mimeType: string) => void;
  isProcessing: boolean;
}

export const Recorder: React.FC<RecorderProps> = ({ onRecordingComplete, isProcessing }) => {
  const [recording, setRecording] = useState(false);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [progress, setProgress] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('');
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const getSupportedMimeType = (type: MediaType) => {
    const videoTypes = [
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ];
    const audioTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg'
    ];

    const types = type === MediaType.VIDEO ? videoTypes : audioTypes;
    return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  };

  const startRecording = async (type: MediaType) => {
    try {
      const constraints = type === MediaType.VIDEO 
        ? { video: true, audio: true } 
        : { audio: true, video: false };
        
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setMediaType(type);

      if (type === MediaType.VIDEO && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = mediaStream;
      }

      const mimeType = getSupportedMimeType(type);
      mimeTypeRef.current = mimeType;
      console.log("Using MIME type:", mimeType);

      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(mediaStream, options);
      
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // Create blob with the detected mime type
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        onRecordingComplete(blob, type, mimeTypeRef.current);
        
        // Cleanup
        mediaStream.getTracks().forEach(track => track.stop());
        setStream(null);
        setMediaType(null);
      };

      recorder.start();
      setRecording(true);
      setTimeLeft(30); // 30 second limit
    } catch (err) {
      console.error("Error accessing media devices:", err);
      alert("Could not access microphone or camera. Please grant permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (recording && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
        setProgress((prev) => prev + (100 / 30));
      }, 1000);
    } else if (timeLeft === 0 && recording) {
      stopRecording();
    }
    return () => clearInterval(interval);
  }, [recording, timeLeft]);

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in-up">
        <div className="relative">
          <div className="w-24 h-24 bg-gradient-to-tr from-indigo-100 to-purple-100 rounded-full flex items-center justify-center shadow-glow">
             <Loader2 size={40} className="text-indigo-500 animate-spin" />
          </div>
          <div className="absolute inset-0 border-4 border-indigo-50 rounded-full animate-ping opacity-30"></div>
        </div>
        <h3 className="mt-8 text-xl font-medium text-slate-700">Listening to your heart...</h3>
        <p className="mt-2 text-slate-400 text-sm">Analyzing tone, words, and expressions</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto transition-all duration-500">
      {!recording ? (
        <div className="flex flex-col items-center space-y-10 animate-fade-in-up">
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-4xl font-light text-slate-800 tracking-tight">
              How are you <span className="text-indigo-600 font-medium">feeling</span> right now?
            </h2>
            <p className="text-slate-500 text-lg font-light">
              Choose how you'd like to share. No judgment, just listening.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
             <button
              onClick={() => startRecording(MediaType.AUDIO)}
              className="group relative flex flex-col items-center justify-center p-8 h-64 rounded-3xl glass-card hover:bg-white/80 transition-all duration-300 hover:shadow-soft hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 text-indigo-500 group-hover:scale-110 transition-transform duration-300 z-10">
                <Mic size={32} />
              </div>
              <span className="text-lg font-semibold text-slate-700 z-10">Voice Only</span>
              <span className="text-sm text-slate-400 mt-2 z-10">Speak your mind</span>
            </button>

            <button
              onClick={() => startRecording(MediaType.VIDEO)}
              className="group relative flex flex-col items-center justify-center p-8 h-64 rounded-3xl glass-card hover:bg-white/80 transition-all duration-300 hover:shadow-soft hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-teal-50/50 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 text-teal-500 group-hover:scale-110 transition-transform duration-300 z-10">
                <Video size={32} />
              </div>
              <span className="text-lg font-semibold text-slate-700 z-10">Video & Voice</span>
              <span className="text-sm text-slate-400 mt-2 z-10">Show how you feel</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center animate-fade-in-up">
          <div className="relative w-full max-w-md aspect-[4/3] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl ring-8 ring-white/30">
             {mediaType === MediaType.VIDEO ? (
                <video ref={videoPreviewRef} autoPlay muted playsInline className="w-full h-full object-cover" />
             ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900 to-slate-900">
                   <div className="relative">
                      <div className="w-24 h-24 bg-indigo-500/20 rounded-full animate-ping absolute inset-0"></div>
                      <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center relative z-10 border border-white/20">
                          <Mic size={40} className="text-white drop-shadow-lg" />
                      </div>
                   </div>
                </div>
             )}
             
             {/* Overlay Controls */}
             <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent flex items-center justify-between">
                <div className="flex items-center space-x-2">
                   <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                   <span className="text-white font-mono font-bold">{30 - timeLeft}s / 30s</span>
                </div>
                <button
                  onClick={stopRecording}
                  className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform active:scale-95 shadow-lg"
                >
                  <Square size={20} className="text-slate-900 fill-current" />
                </button>
             </div>
             
             {/* Progress Bar */}
             <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-indigo-500 to-teal-400 transition-all duration-1000 ease-linear" style={{ width: `${(progress / 100) * 100}%` }}></div>
          </div>
          
          <p className="mt-8 text-slate-600 font-medium bg-white/50 px-4 py-2 rounded-full backdrop-blur-sm">
             Take a deep breath. Just speak naturally.
          </p>
        </div>
      )}
    </div>
  );
};
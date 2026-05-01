import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  Play, 
  Download, 
  Mic2, 
  Smile, 
  Zap, 
  Loader2,
  Info,
  Monitor,
  User,
  Waves
} from 'lucide-react';
import { motion, AnimatePresence } from "motion/react";

// --- Types ---
type VoiceOption = {
  id: string;
  name: string;
  gender: 'Male' | 'Female';
  description: string;
};

type EmotionOption = {
  id: string;
  name: string;
  icon: string;
  instruction: string;
};

const VOICES: VoiceOption[] = [
  { id: 'Kore', name: 'Kore', gender: 'Female', description: 'Douce et claire' },
  { id: 'Puck', name: 'Puck', gender: 'Male', description: 'Narrateur dynamique' },
  { id: 'Charon', name: 'Charon', gender: 'Male', description: 'Profond et stable' },
  { id: 'Zephyr', name: 'Zephyr', gender: 'Male', description: 'Énergique' },
  { id: 'Fenrir', name: 'Fenrir', gender: 'Male', description: 'Robuste' },
];

const EMOTIONS: EmotionOption[] = [
  { id: 'professional', name: 'Pro', icon: '💼', instruction: 'Say professionally and confidently: ' },
  { id: 'joyful', name: 'Joyeux', icon: '😊', instruction: 'Say cheerfully: ' },
  { id: 'angry', name: 'Colère', icon: '😡', instruction: 'Say angrily: ' },
  { id: 'sad', name: 'Triste', icon: '😢', instruction: 'Say sadly: ' },
  { id: 'scared', name: 'Peur', icon: '😨', instruction: 'Say fearfully: ' },
  { id: 'thinking', name: 'Réflexion', icon: '🤔', instruction: 'Say thoughtfully: ' },
  { id: 'neutral', name: 'Neutre', icon: '😐', instruction: '' },
];

// Helper to convert PCM to WAV (Gemini returns 24kHz Mono 16-bit PCM)
function createWavBlob(pcmBase64: string): Blob {
  const binary = atob(pcmBase64);
  const dataSize = binary.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  // File length
  view.setUint32(4, 36 + dataSize, true);
  // RIFF type
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // format chunk identifier
  view.setUint32(12, 0x666d7420, false); // "fmt "
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw PCM)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, 1, true); // Mono
  // sample rate
  view.setUint32(24, 24000, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, 24000 * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  view.setUint32(36, 0x64617461, false); // "data"
  // data chunk length
  view.setUint32(40, dataSize, true);

  // Write PCM data
  for (let i = 0; i < dataSize; i++) {
    view.setUint8(44 + i, binary.charCodeAt(i));
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export default function App() {
  const [text, setText] = useState('Bienvenue dans Vox-Pro Studio. Transformez votre texte en une voix off professionnelle avec des émotions ajustables.');
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0]);
  const [selectedEmotion, setSelectedEmotion] = useState(EMOTIONS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError("Veuillez entrer du texte.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Clé API manquante");

      const ai = new GoogleGenAI({ apiKey });
      
      const fullPrompt = `${selectedEmotion.instruction}${text}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: fullPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice.id },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (!base64Audio) {
        throw new Error("Impossible de générer l'audio. Essayez un autre texte.");
      }

      const blob = createWavBlob(base64Audio);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      setTimeout(() => {
        audioRef.current?.play().catch(e => console.warn("Lecteur bloqué par le navigateur", e));
      }, 100);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `voxpro-${selectedVoice.id}-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full min-h-[100dvh] bg-[#0F172A] text-slate-100 font-sans flex flex-col selection:bg-blue-500/30">
      {/* Navigation */}
      <nav className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-[#1E293B] shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Mic2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">VOX-PRO <span className="text-blue-400 font-normal">Studio</span></span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-700/50 rounded-full border border-slate-600">
            <div className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">
              {isGenerating ? 'Traitement...' : 'Prêt'}
            </span>
          </div>
          <div className="w-9 h-9 bg-slate-700 rounded-full border border-slate-600 flex items-center justify-center">
            <User className="w-5 h-5 text-slate-300" />
          </div>
        </div>
      </nav>

      {/* Workspace */}
      <main className="flex-1 flex flex-col md:flex-row p-4 md:p-6 gap-6 md:overflow-hidden h-full">
        {/* Left: Input & Preview */}
        <div className="flex flex-col gap-6 md:flex-[1.5] md:h-full">
          {/* Card: Text Area */}
          <div className="bg-[#1E293B] rounded-2xl border border-slate-800 p-5 flex flex-col shadow-xl flex-1 md:min-h-0">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Info className="w-3 h-3 text-blue-500" /> Script
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                {text.length} / 5000
              </span>
            </div>
            <textarea 
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-48 md:flex-1 bg-transparent border-none outline-none resize-none text-lg leading-relaxed text-slate-200 placeholder-slate-700 custom-scrollbar" 
              placeholder="Saisissez votre texte..."
            />
            
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2"
                >
                  <Info className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Card: Player */}
          <div className="bg-[#1E293B] rounded-2xl border border-slate-800 p-5 flex flex-col gap-4 shadow-lg shrink-0">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Flux Audio</span>
              {audioUrl && <Waves className="w-4 h-4 text-blue-400 animate-pulse" />}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 h-12 bg-slate-900 rounded-xl border border-slate-700/50 flex items-center px-3">
                {audioUrl ? (
                  <audio ref={audioRef} src={audioUrl} controls className="w-full h-8 custom-audio-player" />
                ) : (
                  <span className="text-xs text-slate-600 italic px-2">
                    {isGenerating ? 'Encodage IA...' : 'Aucun audio généré'}
                  </span>
                )}
              </div>
              <button 
                disabled={!audioUrl || isGenerating}
                onClick={() => audioRef.current?.play()}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  audioUrl && !isGenerating ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-800 text-slate-600'
                }`}
              >
                <Play className="w-6 h-6 ml-1" fill={audioUrl ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <aside className="flex flex-col gap-6 md:flex-1 md:h-full md:overflow-hidden">
          {/* Voices List */}
          <div className="bg-[#1E293B] rounded-2xl border border-slate-800 p-5 flex flex-col md:flex-1 md:min-h-0 shadow-lg">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 shrink-0">
              <Monitor className="w-3 h-3 text-blue-400" /> Bibliothèque
            </h3>
            <div className="flex flex-col gap-2 md:overflow-y-auto pr-1 custom-scrollbar">
              {VOICES.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => setSelectedVoice(voice)}
                  className={`p-3 rounded-xl flex items-center justify-between border transition-all ${
                    selectedVoice.id === voice.id 
                    ? 'bg-blue-500/10 border-blue-500/50 shadow-inner' 
                    : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      selectedVoice.id === voice.id ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'
                    }`}>
                      {voice.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-100">{voice.name}</p>
                      <p className="text-[10px] text-slate-500">{voice.gender === 'Male' ? 'Homme' : 'Femme'} • {voice.description}</p>
                    </div>
                  </div>
                  {selectedVoice.id === voice.id && <div className="w-2 h-2 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50"></div>}
                </button>
              ))}
            </div>
          </div>

          {/* Emotions */}
          <div className="bg-[#1E293B] rounded-2xl border border-slate-800 p-5 shadow-lg shrink-0">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Smile className="w-3 h-3 text-emerald-500" /> Émotions
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-2">
              {EMOTIONS.map((emotion) => (
                <button 
                  key={emotion.id}
                  onClick={() => setSelectedEmotion(emotion)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all text-xs font-bold ${
                    selectedEmotion.id === emotion.id
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <span className="text-lg">{emotion.icon}</span> {emotion.name}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {/* Footer Controls */}
      <footer className="bg-[#1E293B] border-t border-slate-800 p-4 md:px-8 pb-8 md:pb-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky bottom-0 z-40">
        <div className="hidden md:flex items-center gap-8">
           <div className="flex flex-col gap-1 w-32">
             <span className="text-[9px] text-slate-500 uppercase font-black">Tempo</span>
             <input type="range" disabled className="h-1 bg-slate-800 accent-blue-500 rounded-lg cursor-not-allowed appearance-none border border-slate-700" />
           </div>
           <div className="flex flex-col gap-1 w-32">
             <span className="text-[9px] text-slate-500 uppercase font-black">Pitch</span>
             <input type="range" disabled className="h-1 bg-slate-800 accent-blue-500 rounded-lg cursor-not-allowed appearance-none border border-slate-700" />
           </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            disabled={!audioUrl || isGenerating}
            onClick={handleDownload}
            className={`flex-1 md:w-48 h-14 md:h-12 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
              audioUrl && !isGenerating
              ? 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-white shadow-lg'
              : 'bg-slate-800/50 border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <Download className="w-4 h-4" />
            Télécharger
          </button>
          
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !text.trim()}
            className={`flex-[1.5] md:w-56 h-14 md:h-12 rounded-xl font-black text-[11px] uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-3 ${
              isGenerating || !text.trim()
              ? 'bg-slate-800 text-slate-600 border border-slate-700'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/30 animate-pulse-slow'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Génération...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-white" />
                <span>Générer Voix</span>
              </>
            )}
          </button>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-audio-player::-webkit-media-controls-panel {
          filter: invert(100%) hue-rotate(180deg) brightness(1.7);
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.95; transform: scale(0.99); }
        }
        .animate-pulse-slow { animation: pulse-slow 3s infinite ease-in-out; }
      `}</style>
    </div>
  );
}

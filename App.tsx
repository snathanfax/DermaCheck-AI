import React, { useState, useEffect } from 'react';
import { Disclaimer } from './components/Disclaimer';
import { ImageUploader } from './components/ImageUploader';
import { ResultDisplay } from './components/ResultDisplay';
import { analyzeImage } from './services/geminiService';
import { AnalysisState, HistoryItem } from './types';
import { Activity, ScanLine, Info, Sparkles, History, Trash2, Calendar, ChevronRight, ChevronDown, Clock, Loader2, Volume2, StopCircle, RotateCcw, LogOut, Settings, X, Cpu, Save, HelpCircle, Shield, Brain, Database, AlertTriangle } from 'lucide-react';
import LZString from 'lz-string';

const HISTORY_STORAGE_KEY = 'dermacheck_history_v1';
const HISTORY_LIMIT_KEY = 'dermacheck_history_limit_v1';
const MODEL_STORAGE_KEY = 'dermacheck_model_v1';

const App: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<{base64: string, mimeType: string} | null>(null);
  const [patientNotes, setPatientNotes] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisState>({
    status: 'idle',
    result: null,
    error: null,
  });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showAbcdeInfo, setShowAbcdeInfo] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // Load history on mount and check for shared URL
  useEffect(() => {
    // Load Settings (Limit & Model)
    const storedLimit = localStorage.getItem(HISTORY_LIMIT_KEY);
    let currentLimit = 10;
    if (storedLimit) {
        currentLimit = parseInt(storedLimit, 10);
        setHistoryLimit(currentLimit);
    }

    const storedModel = localStorage.getItem(MODEL_STORAGE_KEY);
    if (storedModel) {
        setSelectedModel(storedModel);
    }

    // Load History
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        let historyData = JSON.parse(stored);
        // Enforce limit on load if necessary
        if (historyData.length > currentLimit) {
            historyData = historyData.slice(0, currentLimit);
        }
        setHistory(historyData);
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }

    // Check for shared result in URL
    const params = new URLSearchParams(window.location.search);
    const shareData = params.get('share');
    if (shareData) {
      try {
        const decompressed = LZString.decompressFromEncodedURIComponent(shareData);
        if (decompressed) {
          const parsedResult = JSON.parse(decompressed);
          setAnalysis({
            status: 'success',
            result: parsedResult,
            error: null
          });
          // Small delay to ensure render before scrolling
          setTimeout(() => {
            const el = document.getElementById('results-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }, 500);
        }
      } catch (e) {
        console.error("Failed to parse shared data", e);
      }
    }

    // Cleanup speech on unmount
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Simulate progress when analyzing
  useEffect(() => {
    let interval: any;
    if (analysis.status === 'analyzing') {
      setLoadingProgress(0);
      interval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 92) return prev; // Hold at 92% until request finishes
          // Fast start, slow end
          const remaining = 92 - prev;
          const step = Math.max(0.2, remaining / 15);
          return prev + step;
        });
      }, 100);
    } else if (analysis.status === 'success') {
      setLoadingProgress(100);
    }
    return () => clearInterval(interval);
  }, [analysis.status]);

  const saveToHistory = (imageData: {base64: string, mimeType: string}, result: any, notes: string) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      imageData,
      result,
      patientNotes: notes
    };

    // Use the configured limit
    const updatedHistory = [newItem, ...history].slice(0, historyLimit); 
    setHistory(updatedHistory);
    
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch (e) {
      console.error("Storage full or error saving history", e);
      // Fallback: try saving fewer items if quota exceeded
      if (updatedHistory.length > 1) {
         try {
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([newItem]));
         } catch(retryErr) {
            console.error("Could not save even one item", retryErr);
         }
      }
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setHistoryLimit(newLimit);
    localStorage.setItem(HISTORY_LIMIT_KEY, newLimit.toString());
    
    // Trim existing history if it exceeds new limit
    if (history.length > newLimit) {
        const trimmed = history.slice(0, newLimit);
        setHistory(trimmed);
        try {
           localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
        } catch(e) { console.error(e); }
    }
  };

  const handleModelChange = (newModel: string) => {
    setSelectedModel(newModel);
    localStorage.setItem(MODEL_STORAGE_KEY, newModel);
  };

  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  };

  const loadFromHistory = (item: HistoryItem) => {
    setSelectedImage(item.imageData);
    setPatientNotes(item.patientNotes || "");
    setAnalysis({
      status: 'success',
      result: item.result,
      error: null
    });
    // Clear shared URL param if exists
    if (window.location.search) {
       window.history.pushState({}, '', window.location.pathname);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleImageSelect = (base64: string, mimeType: string) => {
    setSelectedImage({ base64, mimeType });
    setAnalysis({ status: 'idle', result: null, error: null });
    // Clear shared URL param if exists to start fresh
    if (window.location.search) {
       window.history.pushState({}, '', window.location.pathname);
    }
  };

  const handleClear = () => {
    setSelectedImage(null);
    setPatientNotes("");
    setAnalysis({ status: 'idle', result: null, error: null });
    setUploaderKey(prev => prev + 1); // Force re-mount of ImageUploader to clear internal state
    
    // Clear shared URL param if exists
    if (window.location.search) {
       window.history.pushState({}, '', window.location.pathname);
    }
    
    // Stop voice if playing
    if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage) return;

    setAnalysis({ status: 'analyzing', result: null, error: null });

    try {
      const result = await analyzeImage(selectedImage.base64, selectedImage.mimeType, selectedModel, patientNotes);
      setAnalysis({ status: 'success', result, error: null });
      saveToHistory(selectedImage, result, patientNotes);
    } catch (err: any) {
      setAnalysis({ 
        status: 'error', 
        result: null, 
        error: err.message || "An unexpected error occurred." 
      });
    }
  };

  const handleVoiceInstructions = () => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      } else {
        const text = "Welcome to Derma Check AI. Here is how to use this app. Step 1. Upload a clear photo of the skin mole or lesion you want to check. You can choose a file from your device or take a new photo with your camera. Step 2. Use the voice note section to describe the mole. Tell us if it's itching, bleeding, or has changed recently, and when you first noticed it. Step 3. Click the 'Run AI Analysis' button. The AI will scan the image and your notes using the ABCDE medical guidelines. Step 4. Review your results, which include a detailed assessment and a confidence score. Please remember, this tool provides a preliminary check only. Always consult a medical professional for advice.";
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        
        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
      }
    } else {
      alert("Voice features are not supported in this browser.");
    }
  };

  // Helper to determine badge color for history items based on simple text check
  const getStatusColor = (text: string) => {
    if (text.includes('Suspicious') || text.includes('consult a doctor')) return 'bg-red-100 text-red-700 border-red-200';
    if (text.includes('Benign')) return 'bg-green-100 text-green-700 border-green-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getStatusLabel = (text: string) => {
     if (text.includes('Suspicious') || text.includes('consult a doctor')) return 'Attention';
     if (text.includes('Benign')) return 'Likely Benign';
     return 'Analysis';
  };

  const getProgressLabel = () => {
    if (loadingProgress < 30) return "Scanning visual features...";
    if (loadingProgress < 60) return "Analyzing ABCDE patterns...";
    if (loadingProgress < 85) return "Comparing with medical references...";
    return "Finalizing assessment...";
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowSettings(false)}></div>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#DC143C] relative z-10 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
               <h3 className="font-bold text-slate-800 flex items-center gap-2">
                 <Settings className="w-5 h-5 text-blue-600" /> Application Settings
               </h3>
               <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                  <X className="w-5 h-5" />
               </button>
            </div>
            
            <div className="p-6 space-y-6">
               {/* Model Selection */}
               <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-slate-500" /> AI Analysis Model
                  </label>
                  <div className="space-y-2">
                     {[
                       { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Standard Speed & Accuracy (Recommended)' },
                       { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro', desc: 'Advanced Reasoning & Complex Tasks' },
                       { id: 'gemini-2.5-flash-lite-latest', name: 'Gemini Flash Lite', desc: 'Fastest Response Time' }
                     ].map((model) => (
                        <button
                           key={model.id}
                           onClick={() => handleModelChange(model.id)}
                           className={`w-full text-left p-3 rounded-xl border transition-all ${
                              selectedModel === model.id 
                                ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' 
                                : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                           }`}
                        >
                           <div className="flex justify-between items-center">
                              <span className={`font-semibold ${selectedModel === model.id ? 'text-blue-700' : 'text-slate-700'}`}>{model.name}</span>
                              {selectedModel === model.id && <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>}
                           </div>
                           <p className="text-xs text-slate-500 mt-1">{model.desc}</p>
                        </button>
                     ))}
                  </div>
               </div>

               {/* History Limit */}
               <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-500" /> History Storage Limit
                  </label>
                  <div className="flex items-center gap-4">
                     <select 
                        value={historyLimit}
                        onChange={(e) => handleLimitChange(Number(e.target.value))}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                     >
                        <option value={5}>Keep last 5 items</option>
                        <option value={10}>Keep last 10 items</option>
                        <option value={15}>Keep last 15 items</option>
                        <option value={20}>Keep last 20 items</option>
                     </select>
                  </div>
                  <p className="text-xs text-slate-400">
                    Older scans will be automatically removed when the limit is reached.
                  </p>
               </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
               <button 
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors flex items-center gap-2 shadow-sm"
               >
                  <Save className="w-4 h-4" /> Done
               </button>
            </div>
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAbout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowAbout(false)}></div>
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-[#DC143C] relative z-10 overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 flex-shrink-0">
               <h3 className="font-bold text-slate-800 flex items-center gap-2">
                 <Shield className="w-5 h-5 text-blue-600" /> About DermaCheck AI
               </h3>
               <button onClick={() => setShowAbout(false)} className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                  <X className="w-5 h-5" />
               </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
                <div className="space-y-2">
                    <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-500" /> Purpose
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                        DermaCheck AI is designed to make skin health monitoring accessible to everyone. Our goal is to provide a preliminary, AI-assisted evaluation of skin moles and lesions to help users identify potential warning signs early. 
                        Early detection is critical in treating skin conditions effectively.
                    </p>
                </div>

                <div className="space-y-2">
                    <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Brain className="w-4 h-4 text-purple-500" /> Technology & Methodology
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                        The application leverages Google's advanced **Gemini** generative AI models for image analysis. It evaluates skin lesions based on widely accepted medical guidelines:
                    </p>
                    <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                        <li><strong>ABCDE Rule:</strong> Analyzing Asymmetry, Border irregularity, Color variation, Diameter, and Evolving characteristics.</li>
                        <li><strong>HAM10000 Dataset:</strong> Comparing features against a dataset of 10,000 dermatoscopic images (Human Against Machine) to classify common diagnostic categories.</li>
                        <li><strong>ISIC Archive:</strong> Referencing patterns from the International Skin Imaging Collaboration for risk assessment.</li>
                    </ul>
                </div>

                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <h4 className="font-bold text-amber-800 flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4" /> Limitations & Disclaimer
                    </h4>
                    <p className="text-xs text-amber-700 leading-relaxed">
                        <strong>DermaCheck AI is NOT a diagnostic tool.</strong> It cannot replace a professional medical examination, biopsy, or diagnosis. The AI analysis is probabilistic and can make errors. <br/><br/>
                        Always consult a certified dermatologist for any skin concerns, especially if you notice changes in a mole's size, shape, or color, or if you experience bleeding or itching.
                    </p>
                </div>
                
                <div className="text-center pt-2">
                    <p className="text-xs text-slate-400">Developed by Shaji R. Nathan</p>
                </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end flex-shrink-0">
               <button 
                  onClick={() => setShowAbout(false)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors shadow-sm"
               >
                  Close
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg">
                <ScanLine className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-teal-600">
                DermaCheck AI
              </span>
            </div>
            <div className="flex items-center gap-3">
               <button
                  onClick={() => setShowAbout(true)}
                  className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                  title="About"
               >
                  <HelpCircle className="w-5 h-5" />
               </button>
               <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                  title="Settings"
               >
                  <Settings className="w-5 h-5" />
               </button>
               {history.length > 0 && (
                  <button 
                    onClick={() => {
                        const el = document.getElementById('history-section');
                        el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="hidden sm:flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    <History className="w-4 h-4" /> History
                  </button>
               )}
              <div className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                {selectedModel === 'gemini-2.5-flash' ? 'Flash' : selectedModel.includes('pro') ? 'Pro' : 'Lite'}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        <header className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
            AI-Powered <span className="text-blue-600">Skin Screening</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-6">
            Upload a photo of a mole or skin lesion. Our AI analyzes it using the ABCDE rule and checks medical databases to provide insights.
          </p>
          
          <button
            onClick={handleVoiceInstructions}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              isSpeaking 
                ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 shadow-sm'
            }`}
          >
            {isSpeaking ? <StopCircle className="w-4 h-4 animate-pulse" /> : <Volume2 className="w-4 h-4" />}
            {isSpeaking ? "Stop Instructions" : "Voice Guide: How to use"}
          </button>
        </header>

        <Disclaimer />

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 sm:p-8 border border-[#DC143C] relative z-10">
          
          <div className="flex flex-col items-center gap-8">
            {/* Step 1: Upload */}
            <div className="w-full">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">1</span>
                <h3 className="font-semibold text-slate-800">Upload & Describe</h3>
              </div>
              <ImageUploader 
                key={uploaderKey}
                onImageSelect={handleImageSelect} 
                onClear={handleClear} 
                isAnalyzing={analysis.status === 'analyzing'}
                onNotesChange={setPatientNotes}
                notesValue={patientNotes}
              />

              {/* ABCDE Info Section */}
              <div className="mt-4 flex flex-col items-center">
                <button
                    onClick={() => setShowAbcdeInfo(!showAbcdeInfo)}
                    className="flex items-center gap-2 text-sm text-blue-600 font-medium hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all"
                >
                    <Info className="w-4 h-4" />
                    <span>How does the analysis work? (ABCDE Rule)</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showAbcdeInfo ? 'rotate-180' : ''}`} />
                </button>

                {showAbcdeInfo && (
                    <div className="mt-3 w-full bg-slate-50 border border-[#DC143C] rounded-xl p-4 text-sm text-slate-600 animate-in fade-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex gap-3">
                                <div className="font-bold text-blue-600 bg-blue-100 w-6 h-6 rounded flex items-center justify-center flex-shrink-0">A</div>
                                <div><span className="font-semibold text-slate-800">Asymmetry:</span> Does one half match the other?</div>
                            </div>
                            <div className="flex gap-3">
                                <div className="font-bold text-blue-600 bg-blue-100 w-6 h-6 rounded flex items-center justify-center flex-shrink-0">B</div>
                                <div><span className="font-semibold text-slate-800">Border:</span> Are edges ragged or blurred?</div>
                            </div>
                            <div className="flex gap-3">
                                <div className="font-bold text-blue-600 bg-blue-100 w-6 h-6 rounded flex items-center justify-center flex-shrink-0">C</div>
                                <div><span className="font-semibold text-slate-800">Color:</span> Is the color uneven or multicolored?</div>
                            </div>
                            <div className="flex gap-3">
                                <div className="font-bold text-blue-600 bg-blue-100 w-6 h-6 rounded flex items-center justify-center flex-shrink-0">D</div>
                                <div><span className="font-semibold text-slate-800">Diameter:</span> Is it larger than a pencil eraser (>6mm)?</div>
                            </div>
                            <div className="flex gap-3 sm:col-span-2">
                                <div className="font-bold text-blue-600 bg-blue-100 w-6 h-6 rounded flex items-center justify-center flex-shrink-0">E</div>
                                <div><span className="font-semibold text-slate-800">Evolving:</span> Has it changed size, shape, or color recently?</div>
                            </div>
                        </div>
                    </div>
                )}
              </div>
            </div>

            {/* Step 2: Action Button or Progress */}
            {selectedImage && (
              <div className="w-full animate-fade-in-up">
                {analysis.status === 'analyzing' ? (
                  <div className="w-full bg-slate-50 rounded-2xl p-6 border border-[#DC143C] shadow-lg shadow-blue-50/50">
                     <div className="flex items-center justify-between mb-3">
                       <div className="flex items-center gap-2">
                         <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                         <span className="font-bold text-slate-700">Analyzing...</span>
                       </div>
                       <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{Math.round(loadingProgress)}%</span>
                     </div>
                     
                     <div className="w-full bg-slate-200 rounded-full h-3 mb-4 overflow-hidden relative">
                       <div 
                         className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden" 
                         style={{ width: `${loadingProgress}%` }}
                       >
                           {/* Shimmer effect using global CSS class */}
                           <div className="absolute top-0 left-0 bottom-0 right-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-full animate-shimmer"></div>
                       </div>
                     </div>
                     
                     <p className="text-xs text-slate-500 text-center font-medium animate-pulse">
                       {getProgressLabel()}
                     </p>
                  </div>
                ) : analysis.status !== 'success' && (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">2</span>
                      <h3 className="font-semibold text-slate-800">Analyze</h3>
                    </div>
                    
                    <button
                      onClick={handleAnalyze}
                      className="w-full py-4 px-6 rounded-xl font-bold text-lg text-white shadow-lg shadow-blue-200 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3"
                    >
                        <Sparkles className="h-6 w-6" />
                        Run AI Analysis
                    </button>

                    <button
                      onClick={handleClear}
                      className="mt-3 w-full py-3 px-6 rounded-xl font-medium text-slate-500 border border-transparent hover:bg-slate-100 hover:text-slate-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Reset
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Results Area */}
          {analysis.error && (
            <div className="mt-8 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-start gap-3">
              <Info className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <p>{analysis.error}</p>
            </div>
          )}

          {analysis.status === 'success' && analysis.result && (
            <div id="results-section">
                <ResultDisplay result={analysis.result} image={selectedImage} />

                <div className="mt-8 flex justify-center pb-4">
                  <button
                      onClick={() => {
                          handleClear();
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-full font-bold shadow-lg hover:bg-slate-900 hover:shadow-xl transition-all transform hover:scale-105"
                  >
                      <LogOut className="w-4 h-4" />
                      Exit Program
                  </button>
                </div>
            </div>
          )}

        {/* History Section */}
        {history.length > 0 && (
          <div id="history-section" className="mt-12">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <History className="text-slate-400 w-5 h-5" />
                    <h2 className="text-xl font-bold text-slate-800">Recent Scans</h2>
                </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {history.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => loadFromHistory(item)}
                  className="bg-white p-4 rounded-lg border border-[#DC143C] shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group flex items-start gap-4"
                >
                  {/* Thumbnail */}
                  <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-100">
                    <img 
                      src={item.imageData.base64.startsWith('data:') ? item.imageData.base64 : `data:${item.imageData.mimeType};base64,${item.imageData.base64}`} 
                      alt="Scan thumbnail" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        <span className="mx-1 text-slate-300">|</span>
                        <Clock className="w-3 h-3" />
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <button 
                        onClick={(e) => deleteHistoryItem(e, item.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                        title="Delete scan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(item.result.text)}`}>
                        {getStatusLabel(item.result.text)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Informational Footer */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left border-t border-slate-200 pt-10 mb-10">
          <div className="p-4 bg-white rounded-xl shadow-sm border border-[#DC143C]">
            <div className="text-blue-500 font-bold mb-2">Asymmetry</div>
            <p className="text-xs text-slate-500">One half of the mole does not match the other half.</p>
          </div>
          <div className="p-4 bg-white rounded-xl shadow-sm border border-[#DC143C]">
            <div className="text-blue-500 font-bold mb-2">Border</div>
            <p className="text-xs text-slate-500">Edges are ragged, notched, or blurred.</p>
          </div>
          <div className="p-4 bg-white rounded-xl shadow-sm border border-[#DC143C]">
            <div className="text-blue-500 font-bold mb-2">Color</div>
            <p className="text-xs text-slate-500">Uneven color (shades of brown, tan, black).</p>
          </div>
        </div>

      </main>
    </div>
  );
};

export default App;
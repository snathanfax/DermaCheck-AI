import React, { useState, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ResultDisplay } from './components/ResultDisplay';
import { Disclaimer } from './components/Disclaimer';
import { MoleSelector } from './components/MoleSelector';
import { TrendAnalysis } from './components/TrendAnalysis';
import { analyzeImage } from './services/geminiService';
import { storageService } from './services/storageService';
import { AnalysisResult, MoleProfile } from './types';
import { ListChecks, Loader2, Stethoscope, Microscope, Activity, Settings, X, CheckCircle, RotateCcw, TrendingUp } from 'lucide-react';

const App: React.FC = () => {
  const [image, setImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientNotes, setPatientNotes] = useState<string>("");
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.5-flash");

  // Trend & Mole Tracking State
  const [selectedMoleId, setSelectedMoleId] = useState<string | undefined>(undefined);
  const [showTrends, setShowTrends] = useState(false);
  const [activeMoleProfile, setActiveMoleProfile] = useState<MoleProfile | null>(null);

  useEffect(() => {
    const savedModel = localStorage.getItem("derma_model");
    if (savedModel) {
      setSelectedModel(savedModel);
    }
  }, []);

  const saveModelSetting = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem("derma_model", model);
    setShowSettings(false);
  };

  const handleImageSelect = (base64: string, mimeType: string) => {
    setImage({ base64, mimeType });
    // Reset results when new image is selected, but do NOT analyze yet.
    setResult(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!image) return;
    
    setIsAnalyzing(true);
    setError(null);

    try {
      // Pass patientNotes and selectedModel to the analysis service
      const analysis = await analyzeImage(image.base64, image.mimeType, selectedModel, patientNotes);
      setResult(analysis);
      
      // Auto-save to history if we have a valid result
      // We pass the selectedMoleId (undefined if general scan)
      storageService.saveAnalysis(selectedMoleId, image, analysis, patientNotes);
      
    } catch (err: any) {
      setError(err.message || "Failed to analyze image");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClear = () => {
    setImage(null);
    setResult(null);
    setError(null);
    setPatientNotes("");
    // We do NOT clear selectedMoleId here so users can rapidly scan the same mole if needed,
    // or they can change it manually in the selector.
  };

  const openTrends = () => {
    // If a mole is selected, show its trends. If not, pick the first one or show empty
    if (selectedMoleId) {
       const moles = storageService.getMoles();
       const profile = moles.find(m => m.id === selectedMoleId) || null;
       setActiveMoleProfile(profile);
       setShowTrends(true);
    } else {
       // Allow picking a mole from a list inside trends? For now, simple Alert or logic
       const moles = storageService.getMoles();
       if(moles.length > 0) {
         setActiveMoleProfile(moles[0]);
         setShowTrends(true);
       } else {
         alert("Create a mole profile first to track trends.");
       }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-12">
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-xl shadow-2xl border border-[#DC143C] w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
               <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Settings className="w-5 h-5 text-slate-500" /> Configuration</h3>
                  <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
               </div>
               <div className="p-6">
                  <label className="block text-sm font-bold text-slate-700 mb-3">Select AI Model</label>
                  <div className="space-y-3">
                      <button onClick={() => saveModelSetting('gemini-2.5-flash')} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${selectedModel === 'gemini-2.5-flash' ? 'border-[#DC143C] bg-red-50 text-red-900' : 'border-slate-200 hover:border-slate-300'}`}>
                          <div className="text-left">
                              <div className="font-bold text-sm">Gemini 2.5 Flash</div>
                              <div className="text-xs opacity-70">Fastest, efficient (Default)</div>
                          </div>
                          {selectedModel === 'gemini-2.5-flash' && <CheckCircle className="w-5 h-5 text-[#DC143C]" />}
                      </button>

                      <button onClick={() => saveModelSetting('gemini-flash-lite-latest')} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${selectedModel === 'gemini-flash-lite-latest' ? 'border-[#DC143C] bg-red-50 text-red-900' : 'border-slate-200 hover:border-slate-300'}`}>
                          <div className="text-left">
                              <div className="font-bold text-sm">Gemini Flash Lite</div>
                              <div className="text-xs opacity-70">Lightweight, high speed</div>
                          </div>
                          {selectedModel === 'gemini-flash-lite-latest' && <CheckCircle className="w-5 h-5 text-[#DC143C]" />}
                      </button>
                      
                       <button onClick={() => saveModelSetting('gemini-3.0-pro-preview')} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${selectedModel === 'gemini-3.0-pro-preview' ? 'border-[#DC143C] bg-red-50 text-red-900' : 'border-slate-200 hover:border-slate-300'}`}>
                          <div className="text-left">
                              <div className="font-bold text-sm">Gemini 3.0 Pro</div>
                              <div className="text-xs opacity-70">Reasoning capabilities</div>
                          </div>
                          {selectedModel === 'gemini-3.0-pro-preview' && <CheckCircle className="w-5 h-5 text-[#DC143C]" />}
                      </button>
                  </div>
               </div>
           </div>
        </div>
      )}

      {/* Trend Analysis Modal */}
      {showTrends && activeMoleProfile && (
        <TrendAnalysis 
          mole={activeMoleProfile}
          history={storageService.getMoleHistory(activeMoleProfile.id)}
          onClose={() => setShowTrends(false)}
        />
      )}

      <header className="bg-white border-b border-[#DC143C] shadow-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-[#DC143C] p-2 rounded-lg">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#DC143C] to-red-600">
              DermaCheck AI
            </h1>
          </div>
          <div className="flex items-center gap-3">
             <div className="text-xs font-medium text-slate-500 hidden sm:block">
               {selectedModel.replace('gemini-', '').replace('latest', '').replace('preview', '')}
             </div>
             
             {/* My Moles Button */}
             <button
               onClick={() => {
                 const moles = storageService.getMoles();
                 if (moles.length === 0) {
                   alert("Please upload an image and create a mole profile first.");
                 } else {
                   // Default to first mole or current selection
                   const targetId = selectedMoleId || moles[0].id;
                   const target = moles.find(m => m.id === targetId);
                   if(target) {
                     setActiveMoleProfile(target);
                     setShowTrends(true);
                   }
                 }
               }}
               className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors"
             >
               <TrendingUp className="w-4 h-4" /> Trends
             </button>

             <button 
               onClick={() => setShowSettings(true)}
               className="p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
               title="Settings"
             >
               <Settings className="w-5 h-5" />
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <Disclaimer />

        <div className="mb-8">
          {!result && (
            <>
              <h2 className="text-2xl font-bold text-center mb-2 text-slate-800">
                Dermatology Screening Assistant
              </h2>
              <p className="text-center text-slate-600 mb-8 max-w-lg mx-auto">
                Upload a clear, close-up photo of a skin mole or lesion for instant AI assessment using ABCDE and Glasgow 7-Point criteria.
              </p>
            </>
          )}

          <ImageUploader 
            onImageSelect={handleImageSelect}
            onClear={handleClear}
            isAnalyzing={isAnalyzing}
            onNotesChange={setPatientNotes}
            notesValue={patientNotes}
          />
          
          {/* Mole Selection Step - Only show if image is uploaded but not analyzed yet */}
          {image && !result && !isAnalyzing && (
            <div className="mt-6 animate-in fade-in slide-in-from-top-4">
              <MoleSelector 
                selectedMoleId={selectedMoleId}
                onSelect={setSelectedMoleId}
              />
            </div>
          )}

          {/* Analyze Button - Visible only after image is selected */}
          {image && !result && !isAnalyzing && (
            <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4">
              <button
                onClick={handleAnalyze}
                className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-[#DC143C] to-red-600 text-white text-lg font-bold rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-red-200"
              >
                <div className="absolute inset-0 rounded-full bg-white/20 group-hover:bg-white/30 transition-colors" />
                <Activity className="w-6 h-6 animate-pulse" />
                Run AI Analysis
              </button>
              <p className="text-xs text-slate-400 mt-3">Click to start the detailed ABCDE & Glasgow assessment</p>
              {selectedMoleId && <p className="text-xs text-emerald-600 font-bold mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Will save to history for this mole</p>}
            </div>
          )}
        </div>

        {error && (
           <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-center mb-6">
              {error}
           </div>
        )}

        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-600 animate-in fade-in duration-500">
            <Loader2 className="w-12 h-12 animate-spin text-[#DC143C] mb-4" />
            <p className="font-medium text-lg">Analyzing lesion characteristics...</p>
            <p className="text-sm text-slate-400 mt-2">Checking asymmetry, borders, color patterns...</p>
            <div className="w-64 h-1.5 bg-slate-200 rounded-full mt-6 overflow-hidden">
               <div className="h-full bg-[#DC143C] animate-shimmer w-1/2 rounded-full"></div>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <ResultDisplay 
              result={result} 
              image={image} 
              patientNotes={patientNotes}
            />
            <div className="flex justify-center pt-8 pb-4">
               <button 
                  onClick={handleClear}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-lg font-medium shadow-md hover:bg-slate-700 transition-all hover:scale-105"
               >
                 <RotateCcw className="w-4 h-4" /> Start New Assessment
               </button>
            </div>
          </div>
        )}

        {/* Educational Footer */}
        <div className="mt-16 border-t border-slate-200 pt-10 mb-10">
          <h3 className="text-xl font-bold text-slate-800 mb-6 text-center">Understanding the Evaluation Criteria</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* ABCDE Cards */}
            <div className="p-4 bg-white rounded-xl shadow-sm border border-[#DC143C] hover:shadow-md transition-shadow">
              <div className="text-blue-600 font-bold mb-2 flex items-center gap-2">
                 <span className="bg-blue-100 px-2 rounded text-sm">A</span> Asymmetry
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">Benign moles are symmetrical. If you draw a line through the middle, the two halves should match.</p>
            </div>

            <div className="p-4 bg-white rounded-xl shadow-sm border border-[#DC143C] hover:shadow-md transition-shadow">
              <div className="text-blue-600 font-bold mb-2 flex items-center gap-2">
                 <span className="bg-blue-100 px-2 rounded text-sm">B</span> Border
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">Benign moles have smooth, even borders. Early melanomas tend to have uneven, crusty, or notched edges.</p>
            </div>

            <div className="p-4 bg-white rounded-xl shadow-sm border border-[#DC143C] hover:shadow-md transition-shadow">
              <div className="text-blue-600 font-bold mb-2 flex items-center gap-2">
                 <span className="bg-blue-100 px-2 rounded text-sm">C</span> Color
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">Most benign moles are all one color. Melanomas often have different shades of brown, tan, or black.</p>
            </div>

            <div className="p-4 bg-white rounded-xl shadow-sm border border-[#DC143C] hover:shadow-md transition-shadow">
               <div className="text-blue-600 font-bold mb-2 flex items-center gap-2">
                 <span className="bg-blue-100 px-2 rounded text-sm">D</span> Diameter
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">Benign moles are usually smaller than the size of a pencil eraser (6mm). Melanomas are often larger.</p>
            </div>

            <div className="p-4 bg-white rounded-xl shadow-sm border border-[#DC143C] hover:shadow-md transition-shadow">
               <div className="text-blue-600 font-bold mb-2 flex items-center gap-2">
                 <span className="bg-blue-100 px-2 rounded text-sm">E</span> Evolving
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">Common moles look the same over time. Be on the alert for a mole that evolves or changes in any way.</p>
            </div>

            {/* Glasgow Card */}
            <div className="p-4 bg-white rounded-xl shadow-sm border border-[#DC143C] hover:shadow-md transition-shadow">
              <div className="text-sky-600 font-bold mb-2 flex items-center gap-2">
                 <ListChecks className="w-4 h-4" /> Glasgow 7-Point
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                 A weighted checklist checking for:
                 <span className="block mt-1 font-semibold text-slate-600">• Major (Size, Shape, Color)</span>
                 <span className="block font-semibold text-slate-600">• Minor (Diameter, Inflammation, Oozing, Sensation)</span>
              </p>
            </div>

            {/* Dermatoscopy Card */}
            <div className="p-4 bg-white rounded-xl shadow-sm border border-[#DC143C] hover:shadow-md transition-shadow">
              <div className="text-violet-600 font-bold mb-2 flex items-center gap-2">
                 <Microscope className="w-4 h-4" /> Dermatoscopy
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                 AI identification of micro-structures typically seen under magnification, such as pigment networks, dots/globules, or blue-white veils.
              </p>
            </div>

            {/* Risk Stratification Card */}
            <div className="p-4 bg-white rounded-xl shadow-sm border border-[#DC143C] hover:shadow-md transition-shadow">
              <div className="text-fuchsia-600 font-bold mb-2 flex items-center gap-2">
                 <Activity className="w-4 h-4" /> Risk Stratification
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                 A synthesized risk level (Low, Medium, High) that combines the ISIC score, HAM10000 neural prediction, and Glasgow checklist results.
              </p>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
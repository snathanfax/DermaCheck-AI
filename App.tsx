import React, { useState } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ResultDisplay } from './components/ResultDisplay';
import { Disclaimer } from './components/Disclaimer';
import { analyzeImage } from './services/geminiService';
import { AnalysisResult } from './types';
import { ListChecks, Loader2, Stethoscope } from 'lucide-react';

const App: React.FC = () => {
  const [image, setImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientNotes, setPatientNotes] = useState<string>("");

  const handleImageSelect = async (base64: string, mimeType: string) => {
    setImage({ base64, mimeType });
    setResult(null);
    setError(null);
    setIsAnalyzing(true);

    try {
      // Pass patientNotes to the analysis service
      const analysis = await analyzeImage(base64, mimeType, undefined, patientNotes);
      setResult(analysis);
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
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-12">
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
          <div className="text-xs font-medium text-slate-500 hidden sm:block">
            Powered by Gemini 2.5 Flash
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <Disclaimer />

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-center mb-2 text-slate-800">
            Dermatology Screening Assistant
          </h2>
          <p className="text-center text-slate-600 mb-8 max-w-lg mx-auto">
            Upload a clear, close-up photo of a skin mole or lesion for instant AI assessment using ABCDE and Glasgow 7-Point criteria.
          </p>

          <ImageUploader 
            onImageSelect={handleImageSelect}
            onClear={handleClear}
            isAnalyzing={isAnalyzing}
            onNotesChange={setPatientNotes}
            notesValue={patientNotes}
          />
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
          </div>
        )}

        {result && (
          <ResultDisplay 
            result={result} 
            image={image} 
            patientNotes={patientNotes}
          />
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

          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
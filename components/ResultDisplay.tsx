import React, { useMemo, useState, useEffect } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import { AnalysisResult } from '../types';
import { ExternalLink, Search, CheckCircle, AlertCircle, HelpCircle, AlertTriangle, Share2, Copy, Download, X, Link, ThumbsUp, ThumbsDown, FileText, Database, BrainCircuit, Activity, Shield, Mic, Microscope, ListChecks, Info } from 'lucide-react';
import LZString from 'lz-string';
import { jsPDF } from "jspdf";

interface ResultDisplayProps {
  result: AnalysisResult;
  image: { base64: string; mimeType: string } | null;
  patientNotes?: string;
}

interface ABCDEItem {
  letter: string;
  title: string;
  status: 'Benign' | 'Suspicious' | 'Unknown';
  summary: string;
}

// Enhanced Educational context for ABCDE
const ABCDE_CONTEXT: Record<string, { benign: string; suspicious: string; unknown: string }> = {
  'Asymmetry': {
    benign: "Symmetry is a reassuring sign. If you draw a line through the middle, the two halves match in shape and size.",
    suspicious: "Asymmetry is a warning sign. If you draw a line through the middle, the two halves do NOT match. This uneven growth pattern is typical of melanoma.",
    unknown: "Could not be determined. Please ensure the photo is taken directly from above, not at an angle, to properly assess symmetry."
  },
  'Border': {
    benign: "Benign moles typically have a smooth, consistent, and well-defined border. The transition from the mole to surrounding skin is sharp and clear.",
    suspicious: "Cancerous lesions often have irregular, ragged, notched, or blurred borders. The pigment may appear to leak or fade into the surrounding skin, lacking a clear edge.",
    unknown: "Edges unclear. Poor focus, low contrast, or hair obstructing the view can make the borders impossible to accurately evaluate."
  },
  'Color': {
    benign: "Safe moles are usually a single, uniform shade of tan or brown. Homogeneous pigmentation indicates stability.",
    suspicious: "Color variation is critical. Look for multiple shades of black, brown, tan, white, gray, red, or blue. A mottling of different colors suggests unregulated pigment production.",
    unknown: "Lighting conditions (shadows, glare, flash) may be distorting the true color. Try natural, even lighting for accurate color assessment."
  },
  'Diameter': {
    benign: "Most benign moles are smaller than 6mm (roughly the size of a pencil eraser). They tend to remain stable in size.",
    suspicious: "Lesions larger than 6mm are concerning, although melanomas can be smaller in early stages. Any mole that is growing in diameter should be checked.",
    unknown: "No scale reference available. It's hard to judge size from a photo without a reference object (like a coin) placed nearby."
  },
  'Evolving': {
    benign: "Stability is the hallmark of a benign mole. It looks the same month after month.",
    suspicious: "Evolution is the most important warning sign. Any change in size, shape, color, elevation, or new symptoms like bleeding, itching, or crusting indicates active progression and risk.",
    unknown: "Cannot be determined from a single photo. Evolution requires monitoring changes over time or comparison with past photos."
  },
  'Moles': {
    benign: "Common Moles (Nevi): Typically small, round, and uniform spots appearing in childhood. They are symmetrical, have even color, and do not change over time.",
    suspicious: "Atypical Moles (Dysplastic Nevi): Often larger with irregular borders. BEWARE the 'Ugly Duckling' Sign: a mole that looks significantly different from your surrounding moles. This outlier status is a strong warning sign.",
    unknown: "Classification unclear. If this mole stands out as different from your others (Ugly Duckling), seek professional evaluation."
  }
};

// Dermatoscopic Features Definition Map
const DERM_FEATURE_INFO: Record<string, { desc: string; color: string }> = {
  "Pigment Network": { 
    desc: "A honeycomb-like pattern of brownish lines. Atypical, broadened, or broken networks can suggest melanoma.", 
    color: "bg-amber-100 text-amber-900 border-amber-200" 
  },
  "Dots": { 
    desc: "Small round structures (<0.1mm). Irregularly distributed dots at the periphery can indicate growth.", 
    color: "bg-slate-100 text-slate-700 border-slate-200" 
  },
  "Globules": { 
    desc: "Larger round structures (>0.1mm). Peripheral globules are a sign of an enlarging lesion.", 
    color: "bg-stone-100 text-stone-800 border-stone-200" 
  },
  "Streaks": { 
    desc: "Radial lines or pseudopods at the periphery. Often indicates the lesion is growing rapidly (e.g., Reed/Spitz nevus or melanoma).", 
    color: "bg-red-100 text-red-900 border-red-200" 
  },
  "Blue-White Veil": { 
    desc: "Irregular, structureless blue pigmentation with an overlying white haze. A highly specific sign of invasive melanoma.", 
    color: "bg-blue-100 text-blue-900 border-blue-200" 
  },
  "Regression": { 
    desc: "White scar-like depigmentation or peppering. Indicates the immune system is attacking the tumor.", 
    color: "bg-gray-100 text-gray-700 border-gray-200" 
  },
  "Vascular": { 
    desc: "Visible blood vessels. 'Arborizing' (tree-like) vessels are typical of Basal Cell Carcinoma.", 
    color: "bg-rose-100 text-rose-900 border-rose-200" 
  },
  "Blotches": { 
    desc: "Large areas of structureless pigment that obscure the underlying network.", 
    color: "bg-orange-100 text-orange-900 border-orange-200" 
  },
  "Shiny White": {
    desc: "Shiny white lines or streaks seen under polarized light, often associated with malignancy.",
    color: "bg-indigo-50 text-indigo-900 border-indigo-200"
  }
};

// Helper to get info for a feature string (fuzzy match)
const getDermFeatureInfo = (feature: string) => {
  const lower = feature.toLowerCase();
  // Check specifically for "blue-white" first to avoid partial matches on "white"
  if (lower.includes("blue-white") || lower.includes("veil")) return DERM_FEATURE_INFO["Blue-White Veil"];
  
  for (const [key, info] of Object.entries(DERM_FEATURE_INFO)) {
    if (lower.includes(key.toLowerCase())) return info;
  }
  return { 
    desc: "A specific microscopic structure identified by the AI in the lesion's pattern.", 
    color: "bg-slate-100 text-slate-700 border-slate-200" 
  };
};

// Medical definitions map
const MEDICAL_DEFINITIONS: Record<string, string> = {
  "Basal Cell Carcinoma": "A common skin cancer arising in basal cells, often caused by sun exposure.",
  "Squamous Cell Carcinoma": "Skin cancer developing in squamous cells, often appearing as a scaly patch.",
  "Melanoma": "The most serious type of skin cancer, developing in melanocytes (pigment cells).",
  "Dysplastic Nevus": "An atypical mole that may resemble melanoma but is usually benign.",
  "Actinic Keratosis": "A rough, scaly patch on skin from years of sun exposure; can be precancerous.",
  "Seborrheic Keratosis": "A common, noncancerous waxy skin growth, often brown or black.",
  "Merkel Cell Carcinoma": "A rare, aggressive skin cancer usually appearing as a flesh-colored or bluish nodule.",
  "Spitz Nevus": "A benign, pink or brown dome-shaped mole that can mimic melanoma.",
  "Dermatofibroma": "A common, benign fibrous skin nodule.",
  "Malignant": "Cancerous; capable of invading nearby tissues and spreading.",
  "Metastasis": "The spread of cancer cells to new areas of the body.",
  "Carcinoma": "Cancer starting in skin or tissue lining organs.",
  "Sarcoma": "Cancer starting in bone or soft tissues.",
  "Hutchinson's Sign": "Pigment extending into the nail fold, suggestive of subungual melanoma.",
  "Breslow Depth": "Measurement of melanoma thickness from the skin surface.",
  "Clark Level": "Describes how deep melanoma has grown into skin layers.",
  "Ulceration": "Open sore or break in the skin over the lesion.",
  "Lymph Node": "Small organ filtering immune substances; often checked for cancer spread.",
  "BCC": "Abbreviation for Basal Cell Carcinoma.",
  "SCC": "Abbreviation for Squamous Cell Carcinoma.",
  "LMM": "Lentigo Maligna Melanoma.",
  "SSM": "Superficial Spreading Melanoma.",
  "ALM": "Acral Lentiginous Melanoma.",
  "HAM10000": "A large dataset of 10,000 dermatoscopic images used to train machine learning models for skin lesion classification.",
  "AKIEC": "Actinic keratoses and intraepithelial carcinoma / Bowen's disease.",
  "BKL": "Benign keratosis-like lesions (solar lentigines / seborrheic keratoses).",
  "DF": "Dermatofibroma.",
  "VASC": "Vascular lesions (angiomas, angiokeratomas, pyogenic granulomas)."
};

// Helper component for ABCDE Visuals
const ABCDEVisual: React.FC<{ type: string }> = ({ type }) => {
  const commonClasses = "w-full h-16 bg-slate-100 rounded-md border border-slate-200 flex items-center justify-around px-2 mb-3 overflow-hidden";
  
  switch (type) {
    case 'Asymmetry':
      return (
        <div className={commonClasses} title="Comparison: Symmetrical vs Asymmetrical">
          <div className="flex flex-col items-center gap-1">
             <svg width="40" height="40" viewBox="0 0 40 40">
               <circle cx="20" cy="20" r="14" fill="#8B5A2B" />
               <line x1="20" y1="2" x2="20" y2="38" stroke="white" strokeWidth="1" strokeDasharray="2 2" />
             </svg>
             <span className="text-[9px] font-semibold text-green-700">Symmetrical</span>
          </div>
          <div className="h-10 w-px bg-slate-300"></div>
          <div className="flex flex-col items-center gap-1">
             <svg width="40" height="40" viewBox="0 0 40 40">
               <path d="M10,20 Q12,5 25,10 T35,25 Q30,35 15,30 T10,20" fill="#5D4037" />
               <line x1="20" y1="2" x2="20" y2="38" stroke="white" strokeWidth="1" strokeDasharray="2 2" />
             </svg>
             <span className="text-[9px] font-semibold text-red-700">Asymmetrical</span>
          </div>
        </div>
      );
    case 'Border':
      return (
        <div className={commonClasses} title="Comparison: Smooth vs Irregular Border">
          <div className="flex flex-col items-center gap-1">
             <svg width="40" height="40" viewBox="0 0 40 40">
               <circle cx="20" cy="20" r="14" fill="#8B5A2B" />
             </svg>
             <span className="text-[9px] font-semibold text-green-700">Smooth</span>
          </div>
          <div className="h-10 w-px bg-slate-300"></div>
          <div className="flex flex-col items-center gap-1">
             <svg width="40" height="40" viewBox="0 0 40 40">
               {/* Jagged starburst shape */}
               <path d="M20,6 L23,15 L32,14 L26,20 L30,29 L21,25 L15,32 L14,23 L6,20 L13,14 Z" fill="#5D4037" transform="scale(1.1) translate(-2,-2)" />
             </svg>
             <span className="text-[9px] font-semibold text-red-700">Irregular</span>
          </div>
        </div>
      );
    case 'Color':
      return (
        <div className={commonClasses} title="Comparison: Single Color vs Multi-Color">
          <div className="flex flex-col items-center gap-1">
             <div className="w-8 h-8 rounded-full bg-[#8B5A2B]"></div>
             <span className="text-[9px] font-semibold text-green-700">Uniform</span>
          </div>
          <div className="h-10 w-px bg-slate-300"></div>
          <div className="flex flex-col items-center gap-1">
             <div className="w-8 h-8 rounded-full" style={{ background: 'conic-gradient(from 45deg, #3E2723, #8B5A2B, #000000, #A1887F, #3E2723)' }}></div>
             <span className="text-[9px] font-semibold text-red-700">Varied</span>
          </div>
        </div>
      );
    case 'Diameter':
      return (
        <div className={commonClasses} title="Comparison: <6mm vs >6mm">
          <div className="flex flex-col items-center gap-1 relative">
             <div className="w-3 h-3 rounded-full bg-[#8B5A2B] mb-1"></div>
             <div className="w-8 h-px bg-slate-400 absolute top-[14px]"></div>
             <span className="text-[9px] font-semibold text-green-700">&lt; 6mm</span>
          </div>
          <div className="h-10 w-px bg-slate-300"></div>
          <div className="flex flex-col items-center gap-1 relative">
             <div className="w-6 h-6 rounded-full bg-[#5D4037]"></div>
             <div className="w-10 h-px bg-slate-400 absolute top-[28px]"></div>
             <span className="text-[9px] font-semibold text-red-700">&gt; 6mm</span>
          </div>
        </div>
      );
    case 'Evolving':
      return (
        <div className={commonClasses} title="Comparison: Stable vs Changing">
           <div className="flex flex-col items-center gap-1">
             <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#8B5A2B]"></div>
                <div className="text-slate-400 text-[8px]">→</div>
                <div className="w-2 h-2 rounded-full bg-[#8B5A2B]"></div>
             </div>
             <span className="text-[9px] font-semibold text-green-700">Stable</span>
          </div>
          <div className="h-10 w-px bg-slate-300"></div>
          <div className="flex flex-col items-center gap-1">
             <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#8B5A2B]"></div>
                <div className="text-slate-400 text-[8px]">→</div>
                <div className="w-4 h-4 rounded-full bg-[#3E2723] border border-red-200"></div>
             </div>
             <span className="text-[9px] font-semibold text-red-700">Changing</span>
          </div>
        </div>
      );
    case 'Moles':
      return (
        <div className={commonClasses} title="Concept: Common Pattern vs Ugly Duckling">
          <div className="flex flex-col items-center gap-1">
             <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#8B5A2B]"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#8B5A2B]"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#8B5A2B]"></div>
             </div>
             <div className="flex gap-1 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#8B5A2B]"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#8B5A2B]"></div>
             </div>
             <span className="text-[9px] font-semibold text-green-700">Uniform</span>
          </div>
          <div className="h-10 w-px bg-slate-300"></div>
          <div className="flex flex-col items-center gap-1">
             <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-[#8B5A2B] opacity-50"></div>
                {/* The Ugly Duckling */}
                <div className="w-4 h-4 rounded-full bg-[#3E2723] border border-red-500"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#8B5A2B] opacity-50"></div>
             </div>
             <span className="text-[9px] font-semibold text-red-700">Ugly Duckling</span>
          </div>
        </div>
      );
    default:
      return null;
  }
};

// Simple Tooltip Helper Component
const SimpleTooltip: React.FC<{ content: string; children: React.ReactNode; className?: string }> = ({ content, children, className = "" }) => (
  <div className={`relative group ${className}`}>
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[60]">
      {content}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
    </div>
  </div>
);

// Helper to process text and insert search links for medical terms
const processMedicalTerms = (text: string): React.ReactNode[] | string => {
  const terms = Object.keys(MEDICAL_DEFINITIONS).sort((a, b) => b.length - a.length);

  const pattern = new RegExp(`\\b(${terms.join('|')})\\b`, 'gi');
  const parts = text.split(pattern);

  if (parts.length === 1) return text;

  return parts.map((part, i) => {
      const matchedKey = terms.find(t => t.toLowerCase() === part.toLowerCase());
      
      if (matchedKey) {
          const definition = MEDICAL_DEFINITIONS[matchedKey];
          return (
              <span 
                  key={i} 
                  className="inline-block relative group mx-0.5 cursor-help"
                  onClick={(e) => {
                      e.stopPropagation();
                      window.open(`https://www.google.com/search?q=${encodeURIComponent(part + " skin condition")}`, '_blank');
                  }}
                  title={`Click to search: ${matchedKey}`}
              >
                  <span className="inline-flex items-baseline gap-0.5 border-b border-indigo-300 border-dashed hover:border-indigo-600 transition-colors">
                    <span className="font-medium text-indigo-700">{part}</span>
                    <Search className="w-3 h-3 text-indigo-400 opacity-60 group-hover:opacity-100 transition-opacity translate-y-[1px]" />
                  </span>
                  
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center leading-relaxed">
                     <span className="font-bold block mb-0.5 text-blue-200">{matchedKey}</span>
                     {definition}
                     <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></span>
                  </span>
              </span>
          );
      }
      return part;
  });
};

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, image, patientNotes }) => {
  const { text, groundingChunks } = result;
  const [showShareModal, setShowShareModal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [linkCopyFeedback, setLinkCopyFeedback] = useState(false);
  const [userFeedback, setUserFeedback] = useState<'up' | 'down' | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setUserFeedback(null);
    setSearchTerm("");
  }, [result]);

  const { 
    abcdeData, 
    cleanText, 
    confidenceScore, 
    isicScore, 
    hamPrediction, 
    hamConfidence,
    glasgowScore,
    riskLevel,
    dermFeatures
  } = useMemo(() => {
    const abcdeRegex = /~ABCDE_START~([\s\S]*?)~ABCDE_END~/i;
    const match = text.match(abcdeRegex);
    
    let parsedData: ABCDEItem[] = [];
    let remainingText = text;
    let confidence = "N/A";
    let isic = "N/A";
    let hamPred = "N/A";
    let hamConf = "N/A";
    let glasgow = "N/A";
    let risk = "N/A";
    let features: string[] = [];

    if (match) {
      const rawData = match[1].trim();
      remainingText = text.replace(match[0], '').trim();
      
      const lines = rawData.split('\n');
      const letterMap: Record<string, string> = {
        'A': 'Asymmetry',
        'B': 'Border',
        'C': 'Color',
        'D': 'Diameter',
        'E': 'Evolving'
      };

      lines.forEach(line => {
        const cleanLine = line.trim();
        if (!cleanLine) return;

        const lowerLine = cleanLine.toLowerCase();

        if (lowerLine.startsWith('confidence score')) {
            const m = cleanLine.match(/[:\-\.]\s*(.*)/);
            if (m) confidence = m[1].trim();
            return;
        }

        if (lowerLine.includes('isic risk score') || lowerLine.includes('isic score')) {
            const m = cleanLine.match(/[:\-\.]\s*(\d+)/);
            if (m) isic = m[1].trim();
            return;
        }

        if (lowerLine.includes('glasgow score')) {
            const m = cleanLine.match(/[:\-\.]\s*(\d+)/);
            if (m) glasgow = m[1].trim();
            return;
        }

        if (lowerLine.includes('risk level')) {
            const m = cleanLine.match(/[:\-\.]\s*(.*)/);
            if (m) risk = m[1].trim();
            return;
        }

        if (lowerLine.includes('ham10000 prediction')) {
            const m = cleanLine.match(/[:\-\.]\s*(.*)/);
            if (m) hamPred = m[1].trim();
            return;
        }

        if (lowerLine.includes('ham10000 confidence')) {
            const m = cleanLine.match(/[:\-\.]\s*(.*)/);
            if (m) hamConf = m[1].trim();
            return;
        }

        if (lowerLine.includes('dermatoscopic features')) {
            const m = cleanLine.match(/[:\-\.]\s*(.*)/);
            if (m) features = m[1].split(',').map(s => s.trim()).filter(Boolean);
            return;
        }

        const lineMatch = cleanLine.match(/^\**([ABCDE]|Moles)\**[:\-\.]\s*(.*)/i);
        
        if (lineMatch) {
          const rawKey = lineMatch[1].toUpperCase();
          const rawContent = lineMatch[2];
          
          let letter = rawKey;
          let title = '';

          if (rawKey === 'MOLES') {
            letter = 'M';
            title = 'Moles';
          } else if (letterMap[rawKey]) {
            title = letterMap[rawKey];
          }

          if (title) {
            let status: ABCDEItem['status'] = 'Unknown';
            const lowerContent = rawContent.toLowerCase();
            
            if (lowerContent.includes('suspicious')) status = 'Suspicious';
            else if (lowerContent.includes('benign')) status = 'Benign';

            let summary = rawContent
                .replace(/\[(Benign|Suspicious|Unknown)\]/gi, '')
                .replace(/^(Benign|Suspicious|Unknown)\s*[:\-\.]/gi, '')
                .replace(/^[\s:\-\.]+/g, '')
                .trim();
                
            if (!summary) {
                summary = status !== 'Unknown' ? status : rawContent;
            }

            parsedData.push({ letter, title, status, summary });
          }
        }
      });
    }

    return { 
        abcdeData: parsedData, 
        cleanText: remainingText, 
        confidenceScore: confidence, 
        isicScore: isic,
        hamPrediction: hamPred,
        hamConfidence: hamConf,
        glasgowScore: glasgow,
        riskLevel: risk,
        dermFeatures: features
    };
  }, [text]);

  const processedText = useMemo(() => {
    let t = cleanText;
    const keywords = ['Asymmetry', 'Border', 'Color', 'Diameter', 'Evolving'];
    keywords.forEach(keyword => {
       const regex = new RegExp(`(\\*\\*)?\\b(${keyword})\\b(\\*\\*)?`, 'gi');
       t = t.replace(regex, (match, p1, p2, p3) => `**${p2}**`);
    });
    return t;
  }, [cleanText]);

  const hasSuspiciousItems = abcdeData.some(item => item.status === 'Suspicious');
  const isGeneralSuspicious = hasSuspiciousItems || 
                       cleanText.toLowerCase().includes('consult a doctor') || 
                       cleanText.toLowerCase().includes('melanoma') ||
                       cleanText.toLowerCase().includes('carcinoma');

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'Source';
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'DermaCheck AI Analysis',
          text: cleanText,
        });
      } catch (err) {
        console.log('Error sharing', err);
      }
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
        window.open(`https://www.google.com/search?q=${encodeURIComponent(searchTerm + " medical meaning")}`, '_blank');
    }
  };

  const handleCopy = () => {
    const parts = [];
    parts.push("DermaCheck AI Analysis Result");
    if (confidenceScore !== "N/A") parts.push(`Confidence Score: ${confidenceScore}`);
    if (riskLevel !== "N/A") parts.push(`Overall Risk Level: ${riskLevel}`);
    if (isicScore !== "N/A") parts.push(`ISIC Risk Score: ${isicScore}/10`);
    if (glasgowScore !== "N/A") parts.push(`Glasgow 7-Point Score: ${glasgowScore}`);
    if (hamPrediction !== "N/A") parts.push(`HAM10000 Prediction: ${hamPrediction} (${hamConfidence})`);
    
    if (dermFeatures.length > 0) {
        parts.push(`Dermatoscopic Features: ${dermFeatures.join(', ')}`);
    }
    
    if (patientNotes) {
        parts.push("");
        parts.push("Patient Reported History/Symptoms:");
        parts.push(patientNotes);
    }
    
    parts.push("");

    if (abcdeData.length > 0) {
        parts.push("ABCDE Analysis:");
        abcdeData.forEach(item => {
            parts.push(`${item.letter} - ${item.title} [${item.status}]: ${item.summary}`);
        });
        parts.push("");
    }

    const strippedReport = cleanText
      .replace(/#{1,6}\s?/g, '')
      .replace(/\*\*/g, '')
      .replace(/__/g, '')
      .replace(/\*/g, '')
      .replace(/^\s*[-]\s/gm, '• ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();

    parts.push("Detailed Assessment:");
    parts.push(strippedReport);
    parts.push("\nDisclaimer: This is an AI preliminary analysis and not a medical diagnosis.");

    navigator.clipboard.writeText(parts.join('\n'));
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleCopyLink = () => {
    try {
      const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(result));
      const url = `${window.location.origin}${window.location.pathname}?share=${compressed}`;
      navigator.clipboard.writeText(url);
      setLinkCopyFeedback(true);
      setTimeout(() => setLinkCopyFeedback(false), 2000);
    } catch (e) {
      console.error("Failed to generate link", e);
    }
  };

  const handleGeneratePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let yPos = 20;

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(30, 64, 175);
    doc.text("DermaCheck AI Report", margin, yPos);
    yPos += 10;

    // Date
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, margin, yPos);
    yPos += 15;

    // Disclaimer Box
    doc.setDrawColor(245, 158, 11);
    doc.setFillColor(255, 251, 235);
    doc.rect(margin, yPos, contentWidth, 25, 'FD');
    doc.setTextColor(180, 83, 9);
    doc.setFont("helvetica", "bold");
    doc.text("MEDICAL DISCLAIMER:", margin + 5, yPos + 8);
    doc.setFont("helvetica", "normal");
    const disclaimerText = "This analysis is generated by AI and is NOT a medical diagnosis. Always consult a certified dermatologist for any skin concerns.";
    const splitDisclaimer = doc.splitTextToSize(disclaimerText, contentWidth - 10);
    doc.text(splitDisclaimer, margin + 5, yPos + 15);
    yPos += 35;

    // Image & Scores
    let imgSectionHeight = 50;
    if (image) {
        try {
            const imgData = image.base64.startsWith('data:') ? image.base64 : `data:${image.mimeType};base64,${image.base64}`;
            const format = image.mimeType.toLowerCase().includes('png') ? 'PNG' : 'JPEG';
            const imgProps = doc.getImageProperties(imgData);
            const imgWidth = 50;
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
            
            doc.setDrawColor(226, 232, 240);
            doc.rect(margin - 1, yPos - 1, imgWidth + 2, imgHeight + 2);
            doc.addImage(imgData, format, margin, yPos, imgWidth, imgHeight);
            
            const textX = margin + imgWidth + 15;
            let textY = yPos + 10;
            
            // Confidence
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text("AI ANALYSIS CONFIDENCE:", textX, textY);
            doc.setFontSize(18);
            doc.setTextColor(30, 64, 175);
            doc.text(confidenceScore, textX, textY + 8);
            
            const percentageMatch = confidenceScore.match(/(\d+)%/);
            if (percentageMatch) {
                const percent = Math.min(parseInt(percentageMatch[1]), 100);
                const barWidth = 60;
                doc.setFillColor(226, 232, 240);
                doc.rect(textX, textY + 12, barWidth, 4, 'F');
                doc.setFillColor(30, 64, 175);
                doc.rect(textX, textY + 12, (barWidth * percent) / 100, 4, 'F');
            }
            textY += 25;

            // ISIC Score & Glasgow
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text("DIAGNOSTIC SCORES:", textX, textY);
            textY += 6;
            
            if (isicScore !== "N/A") {
                const scoreNum = parseInt(isicScore) || 0;
                doc.setFontSize(10);
                doc.setTextColor(30);
                doc.text(`ISIC Risk: ${isicScore}/10`, textX, textY);
                
                // Visual ISIC Bar in PDF
                const barWidth = 60;
                const percent = Math.min(scoreNum, 10) / 10;
                
                let r=0, g=0, b=0;
                // Match UI Colors: Green (<=3), Yellow (<=6), Red (>6)
                if(scoreNum <= 3) { r=34; g=197; b=94; } // Green-500
                else if(scoreNum <= 6) { r=234; g=179; b=8; } // Yellow-500
                else { r=239; g=68; b=68; } // Red-500

                doc.setFillColor(226, 232, 240); // bg-slate-200
                doc.rect(textX, textY + 2, barWidth, 3, 'F');
                doc.setFillColor(r, g, b);
                doc.rect(textX, textY + 2, barWidth * percent, 3, 'F');

                textY += 10;
            } else {
                 textY += 5;
            }

            if (glasgowScore !== "N/A") {
                doc.setFontSize(10);
                doc.setTextColor(30);
                doc.text(`Glasgow 7-Point: ${glasgowScore}`, textX, textY);
                textY += 5;
            }
             if (riskLevel !== "N/A") {
                doc.setFontSize(10);
                doc.setTextColor(30);
                doc.text(`Risk Level: ${riskLevel}`, textX, textY);
                textY += 8;
            }

            // HAM10000 Prediction
            if (hamPrediction !== "N/A") {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.setTextColor(100);
                doc.text("HAM10000 DATASET MATCH:", textX, textY);
                doc.setFontSize(12);
                doc.setTextColor(0);
                doc.text(`${hamPrediction}`, textX, textY + 6);
                if (hamConfidence !== "N/A") {
                    doc.setFontSize(9);
                    doc.setTextColor(100);
                    doc.text(`Confidence: ${hamConfidence}`, textX, textY + 11);
                }
                textY += 15;
            }

            imgSectionHeight = Math.max(imgHeight + 15, textY - yPos + 10);
            yPos += imgSectionHeight;
        } catch (e) {
            console.error("PDF Image Error", e);
            yPos += 30; 
        }
    }

    if (patientNotes) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text("Patient Reported History & Symptoms", margin, yPos);
        yPos += 6;
        
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(60);
        const notesLines = doc.splitTextToSize(`"${patientNotes}"`, contentWidth);
        doc.text(notesLines, margin, yPos);
        yPos += (notesLines.length * 5) + 10;
    }

    if (abcdeData.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("ABCDE Analysis", margin, yPos);
        yPos += 8;

        abcdeData.forEach((item) => {
             if (yPos > pageHeight - 40) { doc.addPage(); yPos = 20; }
             doc.setFont("helvetica", "bold");
             doc.setFontSize(10);
             const letterColor = item.status === 'Suspicious' ? [220, 38, 38] : (item.status === 'Benign' ? [22, 163, 74] : [71, 85, 105]);
             doc.setTextColor(letterColor[0], letterColor[1], letterColor[2]);
             doc.text(`${item.letter} - ${item.title}: [${item.status}]`, margin, yPos);
             
             doc.setFont("helvetica", "normal");
             doc.setTextColor(60);
             const summaryLines = doc.splitTextToSize(item.summary, contentWidth - 10);
             doc.text(summaryLines, margin + 5, yPos + 5);
             yPos += 8 + (summaryLines.length * 4);
        });
        yPos += 10;
    }
    
    // Advanced Diagnostics
    if (dermFeatures.length > 0) {
        if (yPos > pageHeight - 40) { doc.addPage(); yPos = 20; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text("Advanced Diagnostic Features", margin, yPos);
        yPos += 8;
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(60);
        const featuresText = "Observed Dermatoscopic Structures: " + dermFeatures.join(", ");
        const featureLines = doc.splitTextToSize(featuresText, contentWidth);
        doc.text(featureLines, margin, yPos);
        yPos += (featureLines.length * 5) + 10;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0);
    if (yPos > pageHeight - 40) { doc.addPage(); yPos = 20; }
    doc.text("Detailed Assessment", margin, yPos);
    yPos += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40);
    
    const plainText = cleanText.replace(/\*\*/g, '').replace(/##/g, '').replace(/\*/g, '•');
    const splitReport = doc.splitTextToSize(plainText, contentWidth);
    
    splitReport.forEach((line: string) => {
        if (yPos > pageHeight - 20) { doc.addPage(); yPos = 20; }
        doc.text(line, margin, yPos);
        yPos += 5;
    });

    const pageCount = doc.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(128);
        
        doc.text("DermaCheck AI Preliminary Report", margin, pageHeight - 10);
        const pageNumText = `Page ${i} of ${pageCount}`;
        doc.text(pageNumText, pageWidth - margin - doc.getTextWidth(pageNumText), pageHeight - 10);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6);
        const devText = "Developed by Shaji R. Nathan  snathanfax@gmail.com";
        doc.text(devText, (pageWidth - doc.getTextWidth(devText)) / 2, pageHeight - 10);
    }

    doc.save("DermaCheck_Report.pdf");
  };

  const handleFeedback = (type: 'up' | 'down') => {
    setUserFeedback(type);
    console.log(`[Feedback] User rated analysis: ${type}`);
  };

  const markdownComponents: Components = {
    strong: ({node, children, ...props}) => {
      const textContent = String(children);
      const isKeyword = /^(Asymmetry|Border|Color|Diameter|Evolving)$/i.test(textContent.trim());
      if (isKeyword) {
         return (
           <strong {...props} className="inline-block px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 font-extrabold border border-indigo-200 shadow-sm mx-0.5 transform hover:scale-105 transition-transform">
             {children}
           </strong>
         );
      }
      const processed = React.Children.map(children, child => {
          if (typeof child === 'string') return processMedicalTerms(child);
          return child;
      });
      return <strong {...props} className="font-bold text-slate-800">{processed}</strong>;
    },
    p: ({node, children, ...props}) => {
       const processed = React.Children.map(children, child => {
           if (typeof child === 'string') return processMedicalTerms(child);
           return child;
       });
       return <p {...props}>{processed}</p>;
    },
    li: ({node, children, ...props}) => {
       const processed = React.Children.map(children, child => {
           if (typeof child === 'string') return processMedicalTerms(child);
           return child;
       });
       return <li {...props}>{processed}</li>;
    }
  };

  return (
    <div className="mt-8 animate-fade-in relative">
      
      {showShareModal && (
         <div className="absolute inset-0 z-50 flex items-center justify-center p-4 rounded-xl">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm rounded-xl" onClick={() => setShowShareModal(false)}></div>
            <div className="relative bg-white rounded-xl shadow-2xl border border-[#DC143C] w-full max-w-xs sm:max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
               <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Share2 className="w-4 h-4 text-blue-500" /> Share & Export</h3>
                  <button onClick={() => setShowShareModal(false)} className="p-1 hover:bg-slate-200 rounded-full transition-colors" title="Close modal"><X className="w-5 h-5 text-slate-500" /></button>
               </div>
               <div className="p-4 space-y-3">
                  {navigator.share && (
                    <SimpleTooltip content="Share via device options" className="w-full">
                      <button onClick={handleNativeShare} className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all group">
                         <div className="bg-blue-100 p-2 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"><Share2 className="w-5 h-5" /></div>
                         <div className="text-left"><div className="font-medium text-slate-700">Share via...</div></div>
                      </button>
                    </SimpleTooltip>
                  )}
                  <SimpleTooltip content="Generate sharable link" className="w-full">
                    <button onClick={handleCopyLink} className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all group">
                         <div className="bg-purple-100 p-2 rounded-full text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">{linkCopyFeedback ? <CheckCircle className="w-5 h-5" /> : <Link className="w-5 h-5" />}</div>
                         <div className="text-left"><div className="font-medium text-slate-700">{linkCopyFeedback ? 'Link Copied!' : 'Copy Link'}</div></div>
                    </button>
                  </SimpleTooltip>
                  <SimpleTooltip content="Copy text report to clipboard" className="w-full">
                    <button onClick={handleCopy} className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all group">
                         <div className="bg-teal-100 p-2 rounded-full text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">{copyFeedback ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}</div>
                         <div className="text-left"><div className="font-medium text-slate-700">{copyFeedback ? 'Copied!' : 'Copy Text'}</div></div>
                    </button>
                  </SimpleTooltip>
                  <SimpleTooltip content="Download analysis as PDF" className="w-full">
                    <button onClick={handleGeneratePDF} className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all group">
                         <div className="bg-orange-100 p-2 rounded-full text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors"><FileText className="w-5 h-5" /></div>
                         <div className="text-left"><div className="font-medium text-slate-700">Download PDF Report</div></div>
                    </button>
                  </SimpleTooltip>
               </div>
            </div>
         </div>
       )}

      <div className={`p-1 rounded-t-xl bg-gradient-to-r ${isGeneralSuspicious ? 'from-orange-500 to-red-500' : 'from-green-400 to-teal-500'}`}></div>
      <div className="bg-white rounded-b-xl shadow-lg border-x border-b border-[#DC143C] overflow-hidden">
        
        {/* Header Status */}
        <div className={`px-6 py-4 border-b border-[#DC143C] flex flex-col sm:flex-row items-center justify-between gap-4 ${isGeneralSuspicious ? 'bg-red-50' : 'bg-teal-50'}`}>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {isGeneralSuspicious ? <AlertCircle className="w-8 h-8 text-red-600" /> : <CheckCircle className="w-8 h-8 text-teal-600" />}
            <div>
                <h2 className={`text-xl font-bold ${isGeneralSuspicious ? 'text-red-800' : 'text-teal-800'}`}>{isGeneralSuspicious ? 'Attention Recommended' : 'Assessment Result'}</h2>
                <div className="flex flex-wrap gap-2 mt-1">
                   {confidenceScore !== "N/A" && <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${isGeneralSuspicious ? 'bg-red-100 text-red-700 border-red-200' : 'bg-teal-100 text-teal-700 border-teal-200'}`}>Conf: {confidenceScore}</span>}
                   {riskLevel !== "N/A" && <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${riskLevel === 'High' ? 'bg-red-600 text-white border-red-700' : riskLevel === 'Medium' ? 'bg-orange-500 text-white border-orange-600' : 'bg-green-500 text-white border-green-600'}`}>Risk: {riskLevel}</span>}
                   {patientNotes && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-blue-100 text-blue-700 border-blue-200 flex items-center gap-1" title="Patient notes were analyzed">
                        <Mic className="w-3 h-3" /> Notes Included
                      </span>
                   )}
                </div>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <SimpleTooltip content="Generate detailed PDF report">
                <button onClick={handleGeneratePDF} className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border transition-colors text-sm font-medium shadow-sm w-full sm:w-auto ${isGeneralSuspicious ? 'bg-white border-red-200 text-red-700 hover:bg-red-50' : 'bg-white border-teal-200 text-teal-700 hover:bg-teal-50'}`}>
                  <FileText className="w-4 h-4" /> <span className="whitespace-nowrap">Generate PDF Report</span>
                </button>
              </SimpleTooltip>
              <SimpleTooltip content="Share or export results">
                <button onClick={() => setShowShareModal(true)} className={`p-2 rounded-full transition-colors ${isGeneralSuspicious ? 'hover:bg-red-100 text-red-700' : 'hover:bg-teal-100 text-teal-700'}`}><Share2 className="w-5 h-5" /></button>
              </SimpleTooltip>
          </div>
        </div>
        
        {/* Scores Grid */}
        <div className="px-6 py-4 border-b border-[#DC143C] bg-slate-50/50 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* ISIC Score */}
            {isicScore !== "N/A" && (
                <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 relative group/isic">
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-indigo-600" />
                            <h3 className="font-semibold text-indigo-900 text-xs">ISIC Comparison</h3>
                            {/* Tooltip for ISIC */}
                            <div className="relative group/tooltip">
                                <HelpCircle className="w-3 h-3 text-indigo-400 cursor-help" />
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-80 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 text-center font-normal leading-relaxed">
                                    The <strong>ISIC Risk Score (1-10)</strong> is a probabilistic metric derived from comparing your image against the International Skin Imaging Collaboration (ISIC) Archive.
                                    <br/><br/>
                                    <ul className="text-left list-disc pl-4 space-y-1">
                                        <li><strong className="text-green-400">Low (1-3):</strong> Patterns match predominantly benign cases.</li>
                                        <li><strong className="text-yellow-400">Intermediate (4-6):</strong> Displays features found in both benign and malignant lesions.</li>
                                        <li><strong className="text-red-400">High (7-10):</strong> Strong visual similarity to confirmed malignant cases in the dataset. Higher scores correlate with a statistically higher probability of malignancy.</li>
                                    </ul>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* New Horizontal Progress Bar next to score */}
                    <div className="flex items-center gap-3 mt-2">
                        <div className="flex-grow h-2.5 bg-indigo-100 rounded-full overflow-hidden border border-indigo-200 shadow-inner">
                             <div 
                                className={`h-full rounded-full transition-all duration-1000 shadow-sm ${
                                    parseInt(isicScore) <= 3 
                                        ? 'bg-gradient-to-r from-green-400 to-green-500' 
                                        : parseInt(isicScore) <= 6 
                                            ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' 
                                            : 'bg-gradient-to-r from-red-500 to-red-600'
                                }`} 
                                style={{ width: `${(Math.min(parseInt(isicScore) || 0, 10) / 10) * 100}%` }}
                             ></div>
                        </div>
                        <span className="text-xs font-bold text-indigo-800 whitespace-nowrap min-w-[3rem] text-right">{isicScore}/10</span>
                    </div>
                </div>
            )}

            {/* Glasgow 7-Point Checklist */}
            {glasgowScore !== "N/A" && (
                <div className="bg-sky-50/50 p-3 rounded-xl border border-sky-100 relative group/glasgow">
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                            <ListChecks className="w-4 h-4 text-sky-600" />
                            <h3 className="font-semibold text-sky-900 text-xs">Glasgow 7-Point</h3>
                            {/* Tooltip Icon */}
                            <div className="relative group/tooltip">
                                <HelpCircle className="w-3 h-3 text-sky-400 cursor-help" />
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-80 p-4 bg-slate-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 text-left font-normal leading-relaxed">
                                    <p className="mb-2 font-semibold text-sky-300">Glasgow 7-Point Checklist Criteria:</p>
                                    
                                    <div className="mb-2">
                                        <strong className="block text-sky-200 mb-0.5">Major Criteria (2 points each):</strong>
                                        <ul className="list-disc pl-3 space-y-1 text-slate-300">
                                            <li><span className="text-white">Change in Size:</span> Rapid enlargement is a major predictor of malignancy.</li>
                                            <li><span className="text-white">Irregular Shape:</span> Non-uniform borders suggest uncontrolled, asymmetrical growth.</li>
                                            <li><span className="text-white">Irregular Color:</span> Multiple shades (black, brown, red) indicate chaotic pigmentation.</li>
                                        </ul>
                                    </div>

                                    <div>
                                        <strong className="block text-sky-200 mb-0.5">Minor Criteria (1 point each):</strong>
                                        <ul className="list-disc pl-3 space-y-1 text-slate-300">
                                            <li><span className="text-white">Diameter &ge; 7mm:</span> Larger lesions (>7mm) have a higher statistical probability of being malignant.</li>
                                            <li><span className="text-white">Inflammation:</span> Redness (erythema) suggests an immune reaction to the lesion.</li>
                                            <li><span className="text-white">Oozing/Crusting:</span> Spontaneous bleeding or crusting indicates tissue ulceration.</li>
                                            <li><span className="text-white">Sensation Change:</span> Persistent itching or altered sensation often accompanies active growth.</li>
                                        </ul>
                                    </div>
                                    
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
                                </div>
                            </div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${parseInt(glasgowScore) >= 3 ? 'bg-red-200 text-red-800' : 'bg-sky-200 text-sky-800'}`}>{glasgowScore}</span>
                    </div>
                     <div className="w-full bg-sky-200 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${parseInt(glasgowScore) >= 3 ? 'bg-red-500' : 'bg-sky-500'}`} style={{ width: `${Math.min((parseInt(glasgowScore) / 7) * 100, 100)}%` }}></div>
                    </div>
                    <p className="text-[10px] text-sky-600 mt-1.5 text-right">{parseInt(glasgowScore) >= 3 ? 'Referral Recommended' : 'Low Score'}</p>
                </div>
            )}
            
            {/* HAM10000 Prediction */}
            {hamPrediction !== "N/A" && (
                <div className="bg-violet-50/50 p-3 rounded-xl border border-violet-100 relative group">
                     <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                            <BrainCircuit className="w-4 h-4 text-violet-600" />
                            <h3 className="font-semibold text-violet-900 text-xs">HAM10000 Neural Match</h3>
                            {/* Tooltip Icon */}
                            <div className="relative group/tooltip">
                                <HelpCircle className="w-3 h-3 text-violet-400 cursor-help" />
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-96 p-4 bg-slate-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 text-left font-normal leading-relaxed">
                                    <p className="mb-2">The AI utilizes a deep learning model trained on the <strong>HAM10000 dataset</strong> (10,000+ dermatoscopic images).</p>
                                    
                                    <strong className="block text-violet-300 mb-1">1. Feature Extraction:</strong>
                                    <p className="mb-1 text-slate-300">The neural network dissects the image into high-dimensional vectors, analyzing specific micro-structures:</p>
                                    <ul className="list-disc pl-4 mb-2 space-y-1 text-slate-300">
                                      <li><strong className="text-white">Texture & Pattern:</strong> Reticular pigment networks, chaotic dots/globules, and structureless zones.</li>
                                      <li><strong className="text-white">Color Variance:</strong> Blue-white veils (depth indicator), regression structures (white scarring), and multi-shade pigmentation.</li>
                                      <li><strong className="text-white">Boundary Metrics:</strong> Edge abruptness, radial streaming, and pseudopods.</li>
                                    </ul>
                                    
                                    <strong className="block text-violet-300 mb-1">2. Centroid Analysis:</strong>
                                    <p className="text-slate-300">
                                      Your lesion's feature vector is mapped into latent space. The model calculates the statistical distance (similarity) to the <strong>centroids</strong> (average representations) of known classes like Melanoma or Nevus. The closest match determines the classification.
                                    </p>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
                                </div>
                            </div>
                        </div>
                        {hamConfidence !== "N/A" && <span className="text-xs font-bold bg-violet-200 text-violet-800 px-2 py-0.5 rounded-full">{hamConfidence}</span>}
                    </div>
                    <div className="text-xs text-violet-800 font-medium truncate">
                        Matched: <span className="font-bold">{hamPrediction}</span>
                    </div>
                </div>
            )}

            {/* Overall Risk Stratification Card */}
            {riskLevel !== "N/A" && (
                <div className="bg-fuchsia-50/50 p-3 rounded-xl border border-fuchsia-100 relative group sm:col-span-2 lg:col-span-1 shadow-sm">
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-fuchsia-600" />
                            <h3 className="font-semibold text-fuchsia-900 text-xs">Risk Stratification</h3>
                            <div className="relative group/tooltip">
                                <HelpCircle className="w-3 h-3 text-fuchsia-400 cursor-help" />
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-80 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 text-center font-normal leading-relaxed">
                                    A synthesized assessment combining the <strong>ISIC Score</strong>, <strong>Glasgow Checklist</strong>, and <strong>HAM10000 prediction</strong>.
                                    <br/><br/>
                                    <ul className="text-left list-disc pl-4 space-y-1">
                                        <li><strong className="text-green-400">Low:</strong> Consistent with benign features.</li>
                                        <li><strong className="text-yellow-400">Medium:</strong> Some atypical features; monitoring recommended.</li>
                                        <li><strong className="text-red-400">High:</strong> Strong indicators of malignancy; immediate evaluation advised.</li>
                                    </ul>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
                                </div>
                            </div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${riskLevel === 'High' ? 'bg-red-100 text-red-700 border-red-200' : riskLevel === 'Medium' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-green-100 text-green-700 border-green-200'}`}>{riskLevel}</span>
                    </div>
                    <p className="text-[10px] text-fuchsia-800 mt-2 leading-tight">
                        AI confidence in this stratification: <strong>{confidenceScore}</strong>.
                        {riskLevel === 'High' ? ' Please consult a dermatologist.' : ' Continue to monitor for changes.'}
                    </p>
                </div>
            )}
        </div>
        
        {/* Patient Notes Display */}
        {patientNotes && (
            <div className="px-6 py-4 border-b border-[#DC143C] bg-white">
                <div className="flex items-start gap-3 text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <Mic className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Patient Reported History</h4>
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200 shadow-sm" title="This information was used by the AI during analysis">
                                <CheckCircle className="w-3 h-3" /> Integrated in Analysis
                            </span>
                        </div>
                        <p className="text-sm italic text-slate-700 leading-relaxed">"{patientNotes}"</p>
                    </div>
                </div>
            </div>
        )}

        <div className="px-6 pt-6">
          {/* Advanced Dermatoscopic Features Tags */}
          {dermFeatures.length > 0 && (
             <div className="mb-6 animate-in fade-in slide-in-from-top-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Microscope className="w-3.5 h-3.5" /> Identified Dermatoscopic Structures
                </h3>
                <div className="flex flex-wrap gap-2">
                    {dermFeatures.map((feature, idx) => {
                        const info = getDermFeatureInfo(feature);
                        return (
                            <div key={idx} className="relative group cursor-help">
                                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border shadow-sm transition-transform hover:scale-105 ${info.color}`}>
                                   {feature}
                                   <Info className="w-3 h-3 ml-1.5 opacity-50" />
                                </span>
                                
                                {/* Feature Tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center leading-relaxed">
                                    <span className="font-bold block mb-1 text-slate-200 border-b border-slate-700 pb-1">{feature}</span>
                                    {info.desc}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
             </div>
          )}

          {/* ABCDE Scorecard */}
          {abcdeData.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8">
              {abcdeData.map((item) => {
                const isSuspicious = item.status === 'Suspicious';
                const isBenign = item.status === 'Benign';
                const isUnknown = item.status === 'Unknown';
                
                let cardBg = 'bg-slate-50 border-slate-200';
                let icon = <HelpCircle className="w-5 h-5 text-slate-400" />;
                let titleColor = 'text-slate-700';
                
                if (isSuspicious) {
                  cardBg = 'bg-red-50 border-red-200 shadow-sm';
                  icon = <AlertTriangle className="w-5 h-5 text-red-500" />;
                  titleColor = 'text-red-800';
                } else if (isBenign) {
                  cardBg = 'bg-green-50 border-green-200';
                  icon = <CheckCircle className="w-5 h-5 text-green-500" />;
                  titleColor = 'text-green-800';
                } else if (isUnknown) {
                  cardBg = 'bg-amber-50 border-amber-200';
                  icon = <HelpCircle className="w-5 h-5 text-amber-500" />;
                  titleColor = 'text-amber-800';
                }

                const contextKey = isSuspicious ? 'suspicious' : (isBenign ? 'benign' : 'unknown');
                const contextText = ABCDE_CONTEXT[item.title]?.[contextKey];

                return (
                  <div key={item.letter} className={`p-3 rounded-lg border ${cardBg} transition-all`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${isSuspicious ? 'bg-red-200 text-red-800' : isBenign ? 'bg-green-200 text-green-800' : isUnknown ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>{item.letter}</span>
                        <span className={`font-semibold text-sm ${titleColor}`}>{item.title}</span>
                      </div>
                      {icon}
                    </div>
                    
                    {/* Visual Aid */}
                    <ABCDEVisual type={item.title} />

                    <div className="space-y-3">
                       <div className={`text-sm ${isSuspicious ? 'font-medium text-red-700' : 'text-slate-600'}`}>{item.summary}</div>
                       {contextText && (
                         <div className={`text-xs p-2 rounded border ${isSuspicious ? 'bg-white/60 border-red-100 text-red-600' : isBenign ? 'bg-white/60 border-green-100 text-green-700' : isUnknown ? 'bg-white/60 border-amber-200 text-amber-800' : 'bg-white/60 border-slate-200 text-slate-600'}`}>
                            <span className="font-bold block mb-0.5">{isSuspicious ? 'Risk Factor:' : isBenign ? 'Typical Norm:' : 'Missing Information:'}</span>
                            {contextText}
                         </div>
                       )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="prose prose-slate max-w-none prose-headings:text-slate-800 prose-p:text-slate-600 prose-li:text-slate-600 prose-strong:text-slate-800">
            <ReactMarkdown components={markdownComponents}>{processedText}</ReactMarkdown>
          </div>
          
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center justify-center">
            {!userFeedback ? (
              <>
                <p className="text-sm text-slate-500 mb-3">Was this analysis helpful?</p>
                <div className="flex gap-4">
                  <SimpleTooltip content="Mark as helpful">
                    <button onClick={() => handleFeedback('up')} className="flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 text-slate-600 hover:bg-green-50 hover:text-green-600 transition-all text-sm group"><ThumbsUp className="w-4 h-4 group-hover:scale-110 transition-transform" /> Yes</button>
                  </SimpleTooltip>
                  <SimpleTooltip content="Mark as not helpful">
                    <button onClick={() => handleFeedback('down')} className="flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all text-sm group"><ThumbsDown className="w-4 h-4 group-hover:scale-110 transition-transform" /> No</button>
                  </SimpleTooltip>
                </div>
              </>
            ) : (
               <div className="text-sm text-slate-500 font-medium flex items-center gap-2 animate-in fade-in"><span role="img" aria-label="party">🎉</span> Thank you for your feedback!</div>
            )}
          </div>
        </div>

        {/* Medical Search Bar */}
        <div className="bg-slate-50 border-t border-[#DC143C] px-6 py-4">
             <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                 <Search className="w-4 h-4 text-blue-500" /> Medical Term Lookup
             </h3>
             <form onSubmit={handleManualSearch} className="flex gap-2">
                 <input
                     type="text"
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     placeholder="Search for a medical term..."
                     className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                 />
                 <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                     Search
                 </button>
             </form>
        </div>

        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 mt-0 rounded-b-xl">
            {/* Prevention & Resources Section */}
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-3 text-emerald-600">
                    <Shield className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Prevention & Education Resources</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                    <a href="https://www.skincancer.org/skin-cancer-prevention/" title="Open resource" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg bg-white border border-[#DC143C] hover:border-emerald-400 hover:shadow-md transition-all text-sm group">
                        <div className="bg-emerald-50 p-1.5 rounded-full text-emerald-500 group-hover:bg-emerald-600 group-hover:text-white transition-colors"><ExternalLink className="w-3 h-3" /></div>
                        <span className="font-medium text-slate-700 group-hover:text-emerald-700">Skin Cancer Foundation Guidelines</span>
                    </a>
                    <a href="https://www.aad.org/public/diseases/skin-cancer/prevent/how" title="Open resource" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg bg-white border border-[#DC143C] hover:border-emerald-400 hover:shadow-md transition-all text-sm group">
                        <div className="bg-emerald-50 p-1.5 rounded-full text-emerald-500 group-hover:bg-emerald-600 group-hover:text-white transition-colors"><ExternalLink className="w-3 h-3" /></div>
                        <span className="font-medium text-slate-700 group-hover:text-emerald-700">AAD Spot Skin Cancer™</span>
                    </a>
                </div>
            </div>

            {groundingChunks && groundingChunks.length > 0 && (
            <div>
                <div className="flex items-center gap-2 mb-3 text-slate-500">
                <Search className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">References & Grounding Sources</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                {groundingChunks.map((chunk, idx) => {
                    if (!chunk.web?.uri) return null;
                    const hostname = getHostname(chunk.web.uri);
                    return (
                    <a key={idx} href={chunk.web.uri} target="_blank" title="View source" rel="noopener noreferrer" className="flex items-start gap-3 p-3 rounded-lg bg-white border border-[#DC143C] hover:border-blue-400 hover:shadow-md transition-all text-sm group">
                        <div className="mt-0.5 bg-blue-50 p-1.5 rounded-full text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-colors"><ExternalLink className="w-3 h-3" /></div>
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-700 group-hover:text-blue-700 truncate block">{chunk.web.title || hostname}</div>
                            <div className="text-xs text-slate-400 group-hover:text-slate-500 truncate">{hostname}</div>
                        </div>
                    </a>
                    );
                })}
                </div>
            </div>
            )}
        </div>
      </div>
    </div>
  );
};
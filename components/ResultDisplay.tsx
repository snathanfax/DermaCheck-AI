import React, { useMemo, useState, useEffect } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import { AnalysisResult } from '../types';
import { ExternalLink, Search, CheckCircle, AlertCircle, HelpCircle, AlertTriangle, Share2, Copy, Download, X, Link, ThumbsUp, ThumbsDown, FileText, Database, BrainCircuit, Activity, Shield, Mic } from 'lucide-react';
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

// Educational context for ABCDE
const ABCDE_CONTEXT: Record<string, { benign: string; suspicious: string; unknown: string }> = {
  'Asymmetry': {
    benign: "Symmetry is a reassuring sign. Benign moles generally grow evenly in all directions, meaning if you folded it in half, the two halves would likely match perfectly in shape and size.",
    suspicious: "Asymmetry is a key warning sign. Unlike normal moles, melanoma often grows unevenly. Look for one half of the lesion having a significantly different shape, size, or outline than the other. This suggests unregulated cell growth.",
    unknown: "Could not be determined. Please ensure the photo is taken directly from above, not at an angle, to properly assess symmetry."
  },
  'Border': {
    benign: "Benign moles typically have a smooth, well-defined, and even border that clearly separates the mole from the surrounding skin. It should look like a distinct spot drawn with a fine marker.",
    suspicious: "Irregular borders are a hallmark of malignancy. Cancerous cells often spread unevenly into surrounding tissue, creating edges that look ragged, notched, blurred, or poorly defined (like a map of a coastline).",
    unknown: "Edges unclear. Poor focus, low contrast, or hair obstructing the view can make the borders impossible to accurately evaluate."
  },
  'Color': {
    benign: "Uniformity is good. Harmless moles are usually a single, solid shade of brown or tan throughout the entire lesion. Consistent pigmentation suggests stability.",
    suspicious: "Color variation is a major red flag. Melanomas often display a chaotic mix of colors, including different shades of tan, brown, black, or even red, white, or blue within a single lesion. This mottling indicates different pigment depths.",
    unknown: "Lighting conditions (shadows, glare, flash) may be distorting the true color. Try natural, even lighting for accurate color assessment."
  },
  'Diameter': {
    benign: "Most benign moles are smaller than 6mm (about the size of a pencil eraser) and tend to stay a stable size over time.",
    suspicious: "Lesions larger than a pencil eraser (6mm) are concerning, though melanomas can be smaller when they start. Rapid growth is a more specific danger sign than size alone.",
    unknown: "No scale reference available. It's hard to judge size from a photo without a reference object (like a coin) placed nearby."
  },
  'Evolving': {
    benign: "Stability is key. Benign moles typically look the same over months and years. A lack of change is a strong indicator of a harmless lesion.",
    suspicious: "Evolution is the most critical factor. Any mole that is changing in size, shape, color, elevation, or starts bleeding, itching, or crusting requires immediate medical attention. Change indicates active growth.",
    unknown: "Cannot be determined from a single photo. Evolution requires monitoring changes over time or comparison with past photos."
  },
  'Moles': {
    benign: "Common moles (nevi) are typically small, round, and uniform. They are a normal accumulation of pigment cells and usually remain stable throughout adulthood.",
    suspicious: "Atypical moles (dysplastic nevi) often look different from your other moles (the 'Ugly Duckling' sign). While not always cancerous, a mole that stands out or looks unusual compared to your peers carries a higher risk.",
    unknown: "General classification unclear. The lesion does not clearly fit standard categories based on this image alone and may require professional dermatoscopy."
  }
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

  useEffect(() => {
    setUserFeedback(null);
  }, [result]);

  const { abcdeData, cleanText, confidenceScore, isicScore, hamPrediction, hamConfidence } = useMemo(() => {
    const abcdeRegex = /~ABCDE_START~([\s\S]*?)~ABCDE_END~/i;
    const match = text.match(abcdeRegex);
    
    let parsedData: ABCDEItem[] = [];
    let remainingText = text;
    let confidence = "N/A";
    let isic = "N/A";
    let hamPred = "N/A";
    let hamConf = "N/A";

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
        hamConfidence: hamConf
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

  const handleCopy = () => {
    const parts = [];
    parts.push("DermaCheck AI Analysis Result");
    if (confidenceScore !== "N/A") parts.push(`Confidence Score: ${confidenceScore}`);
    if (isicScore !== "N/A") parts.push(`ISIC Risk Score: ${isicScore}/10`);
    if (hamPrediction !== "N/A") parts.push(`HAM10000 Prediction: ${hamPrediction} (${hamConfidence})`);
    
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

            // ISIC Score
            if (isicScore !== "N/A") {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.setTextColor(100);
                doc.text("ISIC RISK SCORE:", textX, textY);
                
                const scoreNum = parseInt(isicScore) || 0;
                if (scoreNum <= 3) doc.setTextColor(22, 163, 74);
                else if (scoreNum <= 6) doc.setTextColor(202, 138, 4);
                else doc.setTextColor(220, 38, 38);
                
                doc.setFontSize(14);
                doc.text(`${isicScore}/10`, textX, textY + 6);
                
                const barWidth = 60;
                doc.setFillColor(226, 232, 240);
                doc.rect(textX, textY + 9, barWidth, 4, 'F');
                if (scoreNum <= 3) doc.setFillColor(22, 163, 74);
                else if (scoreNum <= 6) doc.setFillColor(202, 138, 4);
                else doc.setFillColor(220, 38, 38);
                doc.rect(textX, textY + 9, (barWidth * scoreNum) / 10, 4, 'F');
                textY += 20;
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
    } else {
        // No image logic
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text("HAM10000 PREDICTION:", margin, yPos + 50);
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text(hamPrediction !== "N/A" ? hamPrediction : "N/A", margin, yPos + 58);
        yPos += 80;
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
                  <button onClick={() => setShowShareModal(false)} className="p-1 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
               </div>
               <div className="p-4 space-y-3">
                  {navigator.share && (
                    <button onClick={handleNativeShare} className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all group">
                       <div className="bg-blue-100 p-2 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"><Share2 className="w-5 h-5" /></div>
                       <div className="text-left"><div className="font-medium text-slate-700">Share via...</div></div>
                    </button>
                  )}
                  <button onClick={handleCopyLink} className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all group">
                       <div className="bg-purple-100 p-2 rounded-full text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">{linkCopyFeedback ? <CheckCircle className="w-5 h-5" /> : <Link className="w-5 h-5" />}</div>
                       <div className="text-left"><div className="font-medium text-slate-700">{linkCopyFeedback ? 'Link Copied!' : 'Copy Link'}</div></div>
                  </button>
                  <button onClick={handleCopy} className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all group">
                       <div className="bg-teal-100 p-2 rounded-full text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">{copyFeedback ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}</div>
                       <div className="text-left"><div className="font-medium text-slate-700">{copyFeedback ? 'Copied!' : 'Copy Text'}</div></div>
                  </button>
                  <button onClick={handleGeneratePDF} className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all group">
                       <div className="bg-orange-100 p-2 rounded-full text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors"><FileText className="w-5 h-5" /></div>
                       <div className="text-left"><div className="font-medium text-slate-700">Download PDF Report</div></div>
                  </button>
               </div>
            </div>
         </div>
       )}

      <div className={`p-1 rounded-t-xl bg-gradient-to-r ${isGeneralSuspicious ? 'from-orange-500 to-red-500' : 'from-green-400 to-teal-500'}`}></div>
      <div className="bg-white rounded-b-xl shadow-lg border-x border-b border-[#DC143C] overflow-hidden">
        
        {/* Header Status */}
        <div className={`px-6 py-4 border-b border-[#DC143C] flex items-center justify-between gap-3 ${isGeneralSuspicious ? 'bg-red-50' : 'bg-teal-50'}`}>
          <div className="flex items-center gap-3">
            {isGeneralSuspicious ? <AlertCircle className="w-6 h-6 text-red-600" /> : <CheckCircle className="w-6 h-6 text-teal-600" />}
            <div>
                <h2 className={`text-lg font-bold ${isGeneralSuspicious ? 'text-red-800' : 'text-teal-800'}`}>{isGeneralSuspicious ? 'Attention Recommended' : 'Assessment Result'}</h2>
                {confidenceScore !== "N/A" && <p className={`text-xs font-medium ${isGeneralSuspicious ? 'text-red-600' : 'text-teal-600'}`}>AI Confidence: {confidenceScore}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
              <button onClick={handleGeneratePDF} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors text-sm font-medium shadow-sm ${isGeneralSuspicious ? 'bg-white border-red-200 text-red-700 hover:bg-red-50' : 'bg-white border-teal-200 text-teal-700 hover:bg-teal-50'}`}>
                 <FileText className="w-4 h-4" /> <span className="whitespace-nowrap">Generate PDF Report</span>
              </button>
              <button onClick={() => setShowShareModal(true)} className={`p-2 rounded-full transition-colors ${isGeneralSuspicious ? 'hover:bg-red-100 text-red-700' : 'hover:bg-teal-100 text-teal-700'}`}><Share2 className="w-5 h-5" /></button>
          </div>
        </div>
        
        {/* Scores Grid */}
        <div className="px-6 py-4 border-b border-[#DC143C] bg-slate-50/50 grid gap-4 sm:grid-cols-2">
            {/* ISIC Score */}
            {isicScore !== "N/A" && (
                <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-indigo-600" />
                            <h3 className="font-semibold text-indigo-900 text-xs">ISIC Comparison</h3>
                        </div>
                        <span className="text-xs font-bold bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full">{isicScore}/10</span>
                    </div>
                    <div className="w-full bg-indigo-200 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${parseInt(isicScore) <= 3 ? 'bg-green-500' : parseInt(isicScore) <= 6 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${(parseInt(isicScore) / 10) * 100}%` }}></div>
                    </div>
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
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-60 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 text-center font-normal leading-relaxed">
                                    The system infers classification by extracting high-dimensional feature vectors (texture, color, structure) and comparing them against statistical centroids of the 10,000 HAM10000 training images.
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
                                </div>
                            </div>
                        </div>
                        {hamConfidence !== "N/A" && <span className="text-xs font-bold bg-violet-200 text-violet-800 px-2 py-0.5 rounded-full">{hamConfidence}</span>}
                    </div>
                    <div className="text-xs text-violet-800 font-medium truncate">
                        Matched: <span className="font-bold">{hamPrediction}</span>
                    </div>
                     <p className="text-[10px] text-violet-600 mt-1 leading-tight opacity-80">
                         Methodology: Feature vector comparison against HAM10000 dataset centroids.
                     </p>
                </div>
            )}
        </div>
        
        {/* Patient Notes Display */}
        {patientNotes && (
            <div className="px-6 py-4 border-b border-[#DC143C] bg-white">
                <div className="flex items-start gap-2 text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <Mic className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Patient Reported History</h4>
                        <p className="text-sm italic">"{patientNotes}"</p>
                    </div>
                </div>
            </div>
        )}

        <div className="px-6 pt-6">
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
                  <button onClick={() => handleFeedback('up')} className="flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 text-slate-600 hover:bg-green-50 hover:text-green-600 transition-all text-sm group"><ThumbsUp className="w-4 h-4 group-hover:scale-110 transition-transform" /> Yes</button>
                  <button onClick={() => handleFeedback('down')} className="flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all text-sm group"><ThumbsDown className="w-4 h-4 group-hover:scale-110 transition-transform" /> No</button>
                </div>
              </>
            ) : (
               <div className="text-sm text-slate-500 font-medium flex items-center gap-2 animate-in fade-in"><span role="img" aria-label="party">🎉</span> Thank you for your feedback!</div>
            )}
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-4 border-t border-[#DC143C] mt-6 rounded-b-xl">
            {/* Prevention & Resources Section */}
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-3 text-emerald-600">
                    <Shield className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Prevention & Education Resources</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                    <a href="https://www.skincancer.org/skin-cancer-prevention/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg bg-white border border-[#DC143C] hover:border-emerald-400 hover:shadow-md transition-all text-sm group">
                        <div className="bg-emerald-50 p-1.5 rounded-full text-emerald-500 group-hover:bg-emerald-600 group-hover:text-white transition-colors"><ExternalLink className="w-3 h-3" /></div>
                        <span className="font-medium text-slate-700 group-hover:text-emerald-700">Skin Cancer Foundation Guidelines</span>
                    </a>
                    <a href="https://www.aad.org/public/diseases/skin-cancer/prevent/how" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg bg-white border border-[#DC143C] hover:border-emerald-400 hover:shadow-md transition-all text-sm group">
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
                    <a key={idx} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 p-3 rounded-lg bg-white border border-[#DC143C] hover:border-blue-400 hover:shadow-md transition-all text-sm group">
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
import { MoleProfile, HistoryItem, AnalysisResult } from '../types';

const MOLES_KEY = 'dermacheck_moles';
const HISTORY_KEY = 'dermacheck_history';
const SETTINGS_KEY = 'derma_model';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Helper to parse metrics from the raw text analysis
const parseMetrics = (text: string) => {
  let isicScore = 0;
  let glasgowScore = 0;
  let confidence = 0;
  let riskLevel = 'Low';

  const isicMatch = text.match(/ISIC Risk Score[:\-\.]\s*(\d+)/i);
  if (isicMatch) isicScore = parseInt(isicMatch[1], 10);

  const glasgowMatch = text.match(/Glasgow Score[:\-\.]\s*(\d+)/i);
  if (glasgowMatch) glasgowScore = parseInt(glasgowMatch[1], 10);

  const confMatch = text.match(/Confidence Score[:\-\.]\s*(\d+)%/i);
  if (confMatch) confidence = parseInt(confMatch[1], 10);

  const riskMatch = text.match(/Risk Level[:\-\.]\s*(High|Medium|Low)/i);
  if (riskMatch) riskLevel = riskMatch[1];

  return { isicScore, glasgowScore, confidence, riskLevel };
};

export const storageService = {
  // --- Mole Profiles ---
  getMoles: (): MoleProfile[] => {
    try {
      const stored = localStorage.getItem(MOLES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to load moles", e);
      return [];
    }
  },

  saveMole: (name: string, location: string): MoleProfile => {
    const moles = storageService.getMoles();
    const newMole: MoleProfile = {
      id: generateId(),
      name,
      location,
      createdAt: Date.now()
    };
    moles.push(newMole);
    localStorage.setItem(MOLES_KEY, JSON.stringify(moles));
    return newMole;
  },

  deleteMole: (id: string) => {
    const moles = storageService.getMoles().filter(m => m.id !== id);
    localStorage.setItem(MOLES_KEY, JSON.stringify(moles));
    // Also cleanup history for this mole? Optional, currently keeping for record.
  },

  // --- Analysis History ---
  getHistory: (): HistoryItem[] => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  },

  getMoleHistory: (moleId: string): HistoryItem[] => {
    return storageService.getHistory()
      .filter(item => item.moleId === moleId)
      .sort((a, b) => a.timestamp - b.timestamp); // Sort by date ascending for charts
  },

  saveAnalysis: (
    moleId: string | undefined,
    image: { base64: string, mimeType: string },
    result: AnalysisResult,
    patientNotes?: string
  ): HistoryItem => {
    const history = storageService.getHistory();
    const metrics = parseMetrics(result.text);

    const newItem: HistoryItem = {
      id: generateId(),
      timestamp: Date.now(),
      moleId,
      imageData: image,
      result,
      patientNotes,
      metrics
    };

    // Limit history size (keep last 50 for now, config can override)
    const updatedHistory = [newItem, ...history].slice(0, 50); 
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
    return newItem;
  },

  clearAll: () => {
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(MOLES_KEY);
  }
};
export interface AnalysisResult {
  text: string;
  groundingChunks?: GroundingChunk[];
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface AnalysisState {
  status: 'idle' | 'analyzing' | 'success' | 'error';
  result: AnalysisResult | null;
  error: string | null;
}

export enum ABCDE {
  A = "Asymmetry",
  B = "Border",
  C = "Color",
  D = "Diameter",
  E = "Evolving"
}

export interface MoleProfile {
  id: string;
  name: string;
  location: string;
  createdAt: number;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  moleId?: string; // Link to a specific mole profile
  imageData: {
    base64: string;
    mimeType: string;
  };
  result: AnalysisResult;
  patientNotes?: string;
  // Parsed metrics for easy graphing
  metrics?: {
    isicScore: number;
    glasgowScore: number;
    riskLevel: string;
    confidence: number;
  };
}
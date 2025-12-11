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

export interface HistoryItem {
  id: string;
  timestamp: number;
  imageData: {
    base64: string;
    mimeType: string;
  };
  result: AnalysisResult;
  patientNotes?: string;
}
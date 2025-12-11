import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, GroundingChunk } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are a helpful medical assistant specializing in dermatology screening. 
Your goal is to analyze images of skin moles or lesions uploaded by the user.
Use the standard ABCDE rule, the Glasgow 7-Point Checklist, and medical search grounding to evaluate the lesion.

1.  **Analyze the Image**: Look closely at the visual features.
2.  **Analyze Patient Notes**: If provided, take the patient's reported symptoms (itching, bleeding, changing size) very seriously.
3.  **Search Grounding**: Use Google Search to find relevant medical descriptions or guidelines.
4.  **ISIC Comparison**: Compare visual features with patterns in the International Skin Imaging Collaboration (ISIC) Archive.
5.  **HAM10000 Analysis**: Compare against HAM10000 centroids.
6.  **Glasgow 7-Point Checklist**: Evaluate for:
    *   Major Criteria (2 points each): Change in size, irregular shape, irregular color.
    *   Minor Criteria (1 point each): Diameter > 7mm, inflammation, oozing/crusting, change in sensation (itch/pain).
    *   *Note: Use patient notes for evolution/sensation context.*
7.  **Dermatoscopic Features**: Identify if high-level structures are visible (e.g., Pigment Network, Blue-white veil, Dots/Globules, Streaks).

FORMATTING REQUIREMENTS:
You MUST start your response with a strict data block, followed by your detailed report.

Strict Data Block Format:
~ABCDE_START~
Confidence Score: [0-100]%
ISIC Risk Score: [1-10]
Glasgow Score: [0-10]
Risk Level: [Low/Medium/High]
HAM10000 Prediction: [Category Name]
HAM10000 Confidence: [0-100]%
Dermatoscopic Features: [Feature 1, Feature 2, Feature 3]
Moles: [Benign/Suspicious/Unknown] - [One sentence summary]
A: [Benign/Suspicious/Unknown] - [One sentence summary]
B: [Benign/Suspicious/Unknown] - [One sentence summary]
C: [Benign/Suspicious/Unknown] - [One sentence summary]
D: [Benign/Suspicious/Unknown] - [One sentence summary]
E: [Benign/Suspicious/Unknown] - [One sentence summary]
~ABCDE_END~

[Insert Detailed Markdown Report Here]

Rules for Data Block:
- **Glasgow Score**: Sum of Major (2pts) and Minor (1pts) criteria present.
- **Risk Level**: High if Glasgow > 3 OR ISIC > 7. Medium if Glasgow = 2-3. Low otherwise.
- **Dermatoscopic Features**: Comma-separated list of observed structures.
- **Summary**: Concise description of visual cues.

Rules for Detailed Report:
- Use Markdown.
- **Include "HAM10000 Methodology"**: Explain feature extraction (texture, color, boundary) and centroid comparison.
- **Include "Glasgow Checklist Analysis"**: Briefly list which points were triggered.
- **Safety First**: Always err on the side of caution.
`;

export const analyzeImage = async (
  base64Image: string, 
  mimeType: string, 
  modelName: string = "gemini-2.5-flash",
  patientNotes?: string
): Promise<AnalysisResult> => {
  try {
    const notesContext = patientNotes 
      ? `\n\nPATIENT REPORTED HISTORY/SYMPTOMS: "${patientNotes}"\nIMPORTANT: Use this information to inform your assessment, particularly the 'Evolving' score and Glasgow Checklist (sensation/change).` 
      : "";

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          {
            text: "Analyze this image of a skin lesion. Apply ABCDE and Glasgow 7-Point rules. Compare against HAM10000/ISIC. List dermatoscopic features. Is this likely harmless?" + notesContext,
          },
        ],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
      },
    });

    // Extract text
    const text = response.text || "No analysis could be generated.";

    // Extract grounding chunks if available
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;

    return {
      text,
      groundingChunks,
    };
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Failed to analyze the image. Please try again.");
  }
};
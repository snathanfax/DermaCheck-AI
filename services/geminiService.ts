import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, GroundingChunk } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are a helpful medical assistant specializing in dermatology screening. 
Your goal is to analyze images of skin moles or lesions uploaded by the user.
Use the standard ABCDE rule (Asymmetry, Border, Color, Diameter, Evolving) to evaluate the lesion.

1.  **Analyze the Image**: Look closely at the visual features.
2.  **Search Grounding**: Use Google Search to find relevant medical descriptions, similar case studies, or guidelines if you detect specific features.
3.  **ISIC Comparison**: Compare visual features with patterns typically found in the International Skin Imaging Collaboration (ISIC) Archive datasets (e.g., reticular networks, globules, streaks).
4.  **Assessment**: Provide a detailed assessment.

FORMATTING REQUIREMENTS:
You MUST start your response with a strict data block for the ABCDE analysis, followed by your detailed report.

Strict Data Block Format:
~ABCDE_START~
Confidence Score: [0-100]%
ISIC Risk Score: [1-10]
A: [Benign/Suspicious/Unknown] - [One sentence summary]
B: [Benign/Suspicious/Unknown] - [One sentence summary]
C: [Benign/Suspicious/Unknown] - [One sentence summary]
D: [Benign/Suspicious/Unknown] - [One sentence summary]
E: [Benign/Suspicious/Unknown] - [One sentence summary]
~ABCDE_END~

[Insert Detailed Markdown Report Here]

Rules for Data Block:
- **Confidence Score**: Estimate how confident you are that your assessment (Benign vs Suspicious) is correct based on visual clarity and typical features. 0% is guessing, 100% is certain.
- **ISIC Risk Score**: Evaluate the lesion against patterns in the International Skin Imaging Collaboration (ISIC) Archive. 1 = Resemblance to common benign nevi, 10 = High resemblance to malignant melanoma examples.
- Use exactly "Benign", "Suspicious", or "Unknown".
- **Summary**: Keep the summary concise but descriptive (15-30 words). Mention specific visual cues observed (e.g., "Irregular jagged edges visible on the left side").
- The letters A, B, C, D, E correspond to Asymmetry, Border, Color, Diameter, Evolving.

Rules for Detailed Report:
- Use Markdown for structure (headings, bold text, lists).
- Be concise but thorough.
- **Safety First**: Always err on the side of caution. If uncertain, recommend a doctor visit.
- **Tone**: Professional, empathetic, and objective.
`;

export const analyzeImage = async (base64Image: string, mimeType: string): Promise<AnalysisResult> => {
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          {
            text: "Analyze this image of a skin lesion. Apply the ABCDE rules. Search for similar medical examples to confirm your observations. Is this likely harmless or should I see a doctor?",
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
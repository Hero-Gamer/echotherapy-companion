import { GoogleGenAI, Type, Schema, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    emotion: { type: Type.STRING, description: "The primary detected emotion." },
    distressScore: { type: Type.NUMBER, description: "A score from 0.0 (calm/happy) to 1.0 (severe crisis/suicidal ideation/extreme panic)." },
    empathySummary: { type: Type.STRING, description: "A one-sentence warm, empathetic summary of the user's state." },
    copingPlan: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "A 3-step personalized coping plan. MUST be culturally neutral and ultra-practical (e.g., breathing techniques, grounding exercises, cognitive reframing). Avoid generic advice like 'talk to a friend'."
    },
    flowerConfig: {
      type: Type.OBJECT,
      properties: {
        baseColor: { type: Type.STRING, description: "Hex color code." },
        intensity: { type: Type.NUMBER, description: "Intensity of emotion from 1 to 10." },
        bloomSpeed: { type: Type.NUMBER, description: "Speed of bloom animation from 1 (slow) to 5 (fast)." },
        style: { 
          type: Type.STRING, 
          enum: ['spiky', 'drooping', 'trembling', 'calm', 'particle'],
          description: "The visual style of the flower based on emotion."
        }
      },
      required: ["baseColor", "intensity", "bloomSpeed", "style"]
    },
    affirmationText: { type: Type.STRING, description: "A calming 10-second affirmation. Start with the user's name if they mentioned it, otherwise start with 'My friend'." }
  },
  required: ["emotion", "distressScore", "empathySummary", "copingPlan", "flowerConfig", "affirmationText"]
};

export const analyzeSession = async (mediaBase64: string, mimeType: string): Promise<AnalysisResult> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: mediaBase64
            }
          },
          {
            text: `Analyze the input for emotion, tone, and facial expressions.
            
            RULES FOR DISTRESS SCORE:
            - Rate from 0.0 to 1.0. 
            - > 0.8 indicates potential crisis (self-harm, extreme panic, hopelessness).
            
            RULES FOR FLOWER CONFIG:
            1. ANGER/FRUSTRATION: Set style='spiky', color='#EF4444' (Red tones).
            2. SADNESS/GRIEF: Set style='drooping', color='#6366F1' (Blue/Indigo tones).
            3. ANXIETY/FEAR: Set style='trembling', color='#8B5CF6' (Purple tones).
            4. CALM/NEUTRAL: Set style='calm', color='#10B981' (Green tones).
            5. HAPPINESS/HOPE/RELIEF: Set style='particle', color='#F59E0B' (Yellow/Gold tones).

            RULES FOR COPING PLAN:
            - Provide 3 distinct, actionable steps.
            - Focus on physiology (breath), grounding (senses), or CBT (reframing).
            - Keep it culturally neutral and universally applicable.

            RULES FOR AFFIRMATION:
            - If the user says their name, use it. E.g., "Sarah, you are..."
            - If no name, use "My friend, you are..."
            - Tone: Compassionate, slow, validating.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        systemInstruction: "You are EchoTherapy. You are a mirror that reflects the user's feelings with deep empathy and visual art.",
        // Adjust safety to allow users to express distress without blocking
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ],
      }
    });

    if (!response.text) {
      throw new Error("No response from Gemini");
    }

    return JSON.parse(response.text) as AnalysisResult;
  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
};

export const generateAffirmationAudio = async (text: string): Promise<ArrayBuffer> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: {
        parts: [{ text }]
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' } // Kore is generally warm/neutral
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio generated");
    }

    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error) {
    console.error("TTS generation failed:", error);
    throw error;
  }
};
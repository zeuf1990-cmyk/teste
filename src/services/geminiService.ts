import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";

export interface StorySegment {
  text: string;
  imagePrompt: string;
  imageUrl?: string;
}

export interface Story {
  title: string;
  segments: StorySegment[];
}

export const generateStoryStructure = async (script: string): Promise<Story> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Transform the following script into a children's story sequence of exactly 10 segments. 
    Each segment should have a short story text (1-3 sentences) and a detailed image prompt for an illustration.
    The story should be engaging for kids.
    
    Script: ${script}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          segments: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING, description: "The story text for this segment" },
                imagePrompt: { type: Type.STRING, description: "A detailed prompt for the illustration" }
              },
              required: ["text", "imagePrompt"]
            },
            minItems: 10,
            maxItems: 10
          }
        },
        required: ["title", "segments"]
      }
    }
  });

  return JSON.parse(response.text || "{}") as Story;
};

export const generateIllustration = async (prompt: string, size: "1K" | "2K" | "4K"): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: {
      parts: [{ text: `A whimsical, high-quality children's book illustration: ${prompt}` }]
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: size
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  
  throw new Error("Failed to generate image");
};

export const chatWithGemini = async (message: string, history: { role: string, parts: { text: string }[] }[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const chat = ai.chats.create({
    model: "gemini-3.1-pro-preview",
    config: {
      systemInstruction: "You are a helpful assistant for a children's storybook creator app. You help users refine their scripts or answer questions about storytelling.",
    },
  });

  // Note: sendMessage doesn't take history directly in this SDK version, 
  // but we can simulate it or just send the message.
  // The SDK docs show sendMessage({ message: "..." })
  const response = await chat.sendMessage({ message });
  return response.text;
};

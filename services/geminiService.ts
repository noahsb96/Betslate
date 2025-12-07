
import { GoogleGenAI, Type } from "@google/genai";
import { Bet, BetResult } from "../types";
import { v4 as uuidv4 } from 'uuid';

const SLATE_SYSTEM_INSTRUCTION = `
You are an expert sports betting assistant specialized in Table Tennis.
Your task is to analyze an image of a betting slate and extract the structured betting data.

The image typically contains rows with:
1. Time (e.g., 1:45 p.m.)
2. Player Names (Two players)
3. Bet Type (Usually "UNDER", "OVER", or "SPLIT"). 
4. Indicators of confidence/units (Hammers, Stars, Nuclear symbols).

CRITICAL RULES:
1. **Units**: 
   - Hammer icon = **1.5** units.
   - Nuclear/Radioactive icon = **2** units.
   - Star or no icon = **1** unit.
2. **Bet Type**: 
   - If the text explicitly says "UNDER", "OVER", or "SPLIT", use that.
   - **IMPORTANT**: If NO bet type text is found next to the players, assume the bet is **"OVER"**.
3. **League**:
   - Extract the league header.
   - **CLEANING**: If the league starts with "International: ", remove "International: ". (e.g., "International: TT Elite Series" -> "TT Elite Series").
   - If "Czech: Czech Liga Pro" -> "Czech Liga Pro".

Extract this into a JSON list.
`;

export const analyzeSlateImage = async (base64Image: string, apiKey: string): Promise<Bet[]> => {
  if (!apiKey) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey });
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/png", data: cleanBase64 } },
          { text: "Extract the table tennis bets from this image." },
        ],
      },
      config: {
        systemInstruction: SLATE_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              league: { type: Type.STRING },
              playerA: { type: Type.STRING },
              playerB: { type: Type.STRING },
              time: { type: Type.STRING },
              type: { type: Type.STRING },
              units: { type: Type.NUMBER },
            },
            required: ["league", "playerA", "playerB", "time", "type", "units"],
          },
        },
      },
    });

    const rawData = JSON.parse(response.text || "[]");

    return rawData.map((item: any) => ({
      id: uuidv4(),
      league: item.league || "Unknown League",
      playerA: item.playerA,
      playerB: item.playerB,
      time: item.time,
      type: item.type,
      units: item.units || 1,
      result: BetResult.PENDING,
      timestamp: Date.now(),
    }));

  } catch (error) {
    console.error("Error analyzing slate:", error);
    throw error;
  }
};

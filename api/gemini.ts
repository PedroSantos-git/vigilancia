import { GoogleGenAI } from "@google/genai";
import { VercelRequest, VercelResponse } from "@vercel/node";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, context } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    // Construir um system prompt rico baseado no contexto da aplicação
    const systemPrompt = `
      És um assistente especializado na gestão de vigilâncias de exames nacionais em Portugal.
      O teu objetivo é ajudar coordenadores de exames a planear, otimizar e resolver conflitos.
      
      Contexto atual da aplicação:
      ${JSON.stringify(context || {})}
      
      Responde sempre em Português de Portugal, de forma profissional e concisa.
      Se te pedirem para analisar alocações, verifica conflitos de disciplina, sobrecarga de professores e justiça na distribuição.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [systemPrompt, prompt],
    });

    return res.status(200).json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini AI Error:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}


import { GoogleGenAI, Type } from "@google/genai";
import { Point, PhysicsAnalysis, Force } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export async function analyzeMotion(frames: { data: string; timestamp: number }[]): Promise<PhysicsAnalysis> {
  // Convert frame data to parts for Gemini
  const frameParts = frames.map(f => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: f.data
    }
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      ...frameParts,
      {
        text: `Analyze this sequence of frames showing a moving object (likely a ball). 
        1. Identify the primary moving object.
        2. For each frame, provide the (x, y) coordinates of the center of the object as a percentage of the image width and height (0-100).
        3. Infer the physics of the situation (e.g., projectile motion, free fall, rolling).
        4. List the forces acting on the object at the MIDPOINT of the sequence (Gravity, Air Resistance, Normal Force, Friction, etc.) with relative magnitudes and directions in degrees (0 = right, 90 = up, 180 = left, 270 = down).
        5. Provide a summary of the motion.
        
        Return the result strictly as JSON.`
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          objectName: { type: Type.STRING },
          path: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER }
              },
              required: ["x", "y"]
            }
          },
          forces: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                magnitude: { type: Type.NUMBER },
                direction: { type: Type.NUMBER },
                color: { type: Type.STRING }
              },
              required: ["name", "magnitude", "direction"]
            }
          },
          summary: { type: Type.STRING },
          velocityInferred: { type: Type.NUMBER },
          accelerationInferred: { type: Type.NUMBER }
        },
        required: ["objectName", "path", "forces", "summary"]
      }
    }
  });

  const rawJson = response.text;
  const parsed = JSON.parse(rawJson);

  // Map timestamps back to the path
  const pathWithTimestamps: Point[] = (parsed.path || []).map((p: any, i: number) => ({
    x: p.x,
    y: p.y,
    timestamp: frames[i]?.timestamp || i * 0.1
  }));

  return {
    objectName: parsed.objectName,
    path: pathWithTimestamps,
    forces: parsed.forces.map((f: any) => ({
      ...f,
      color: f.color || (f.name.toLowerCase().includes('gravity') ? '#ef4444' : '#3b82f6')
    })),
    summary: parsed.summary,
    calculatedVelocity: parsed.velocityInferred || 0,
    calculatedAcceleration: parsed.accelerationInferred || 0
  };
}

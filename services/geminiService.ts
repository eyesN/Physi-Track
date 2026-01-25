
import { GoogleGenAI, Type } from "@google/genai";
import { Point, PhysicsAnalysis, Force } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function analyzeMotion(frames: { data: string; timestamp: number }[]): Promise<PhysicsAnalysis> {
  const frameParts = frames.map(f => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: f.data
    }
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        ...frameParts,
        {
          text: `Analyze this sequence of frames showing a moving object.
          1. Identify the moving object (e.g., "Ball", "Phone", "Car").
          2. For each frame, provide the center (x, y) of the object as percentages (0-100 of the frame width/height).
          3. For each frame, provide "angle" (tilt) of the object in degrees.
          4. Determine the primary physical forces acting on the object:
             - Gravity/Weight: Usually 270 degrees (straight down).
             - Normal Force: Perpendicular to the surface it's on (e.g., 90 degrees if on ground).
             - Friction/Drag: Opposite to the direction of motion.
             - Applied/Tension: In the direction of pull/push.
          5. Directions are in standard polar coordinates: 0=right, 90=up, 180=left, 270=down.
          6. Provide magnitudes as relative units (e.g., 9.8 for gravity, others relative to that).
          7. Summarize the physical principles (e.g., Projectile Motion, Constant Acceleration).
          
          Return valid JSON only.`
        }
      ]
    },
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
                y: { type: Type.NUMBER },
                angle: { type: Type.NUMBER }
              },
              required: ["x", "y", "angle"]
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

  const jsonStr = response.text?.trim() || "{}";
  const parsed = JSON.parse(jsonStr);

  const pathWithTimestamps: Point[] = (parsed.path || []).map((p: any, i: number) => ({
    x: p.x,
    y: p.y,
    angle: p.angle || 0,
    timestamp: frames[i]?.timestamp || i * 0.1
  }));

  return {
    objectName: parsed.objectName || "Unknown Object",
    path: pathWithTimestamps,
    forces: (parsed.forces || []).map((f: any) => ({
      ...f,
      // Ensure color exists if Gemini misses it
      color: f.color || (
        f.name.toLowerCase().includes('gravity') || f.name.toLowerCase().includes('weight') ? '#f87171' : 
        f.name.toLowerCase().includes('air') || f.name.toLowerCase().includes('drag') ? '#60a5fa' :
        f.name.toLowerCase().includes('friction') ? '#fbbf24' : 
        f.name.toLowerCase().includes('normal') ? '#10b981' : '#c084fc'
      )
    })),
    summary: parsed.summary || "",
    calculatedVelocity: parsed.velocityInferred || 0,
    calculatedAcceleration: parsed.accelerationInferred || 0
  };
}

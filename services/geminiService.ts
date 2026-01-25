
import { GoogleGenAI, Type } from "@google/genai";
import { Point, PhysicsAnalysis, Force } from "../types";

// Always use process.env.API_KEY directly in the named parameter.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function analyzeMotion(frames: { data: string; timestamp: number }[]): Promise<PhysicsAnalysis> {
  // Map frames to inlineData parts for the multi-modal request.
  const frameParts = frames.map(f => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: f.data
    }
  }));

  // Use the recommended contents structure with parts and correct model name.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        ...frameParts,
        {
          text: `Analyze this sequence of frames showing a moving object.
          1. Identify the moving object.
          2. For each frame, provide the center (x, y) coordinates of the object as percentages (0-100).
          3. For each frame, provide the "angle" (tilt) of the object in degrees (0 = upright/no tilt, positive = clockwise tilt).
          4. Determine the primary forces acting on the object during its main trajectory.
          5. Provide relative magnitudes and directions in degrees (0=right, 90=up, 180=left, 270=down).
          6. Summarize the physical principles observed.
          
          Return the result as JSON.`
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
                angle: { type: Type.NUMBER, description: "Rotation angle of the object" }
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

  // Extract text from response and parse as JSON. Access .text property directly.
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
      color: f.color || (
        f.name.toLowerCase().includes('gravity') || f.name.toLowerCase().includes('weight') ? '#f87171' : 
        f.name.toLowerCase().includes('air') || f.name.toLowerCase().includes('drag') ? '#60a5fa' :
        f.name.toLowerCase().includes('friction') ? '#fbbf24' : '#c084fc'
      )
    })),
    summary: parsed.summary || "",
    calculatedVelocity: parsed.velocityInferred || 0,
    calculatedAcceleration: parsed.accelerationInferred || 0
  };
}

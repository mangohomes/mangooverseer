import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { adminDb } from '@/lib/firebase/admin';

// Initialize Gemini client for Overseer
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

export async function POST(req: Request) {
  try {
    const { goal, userId } = await req.json();

    if (!goal) {
      return NextResponse.json({ error: 'Goal is required' }, { status: 400 });
    }

    const systemInstruction = `You are the Overseer Agent. Your job is to take a user\'s complex goal and break it down into smaller, actionable sub-tasks for specialized worker agents.

CRITICAL CONTEXT:
Today's Date is ${new Date().toISOString().split('T')[0]}. If a user asks to do something "today" or "tomorrow", use this exact date context to formulate your tasks.

Critically, you must classify each task into one of two categories:
1. "kitten": An on-demand task that should be run immediately just once.
2. "bee": A recurring scheduled task. If it is a bee, you MUST also provide a "schedule" field (e.g., "hourly", "daily", "weekly", "every morning", etc.).

Return your response purely as a JSON array of task objects. Each object MUST contain: "title", "description", "category" (either "kitten" or "bee"), and if category is "bee", a "schedule" string.`;

    // Overseer logic: Break down the goal into sub-tasks using Gemini
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: goal,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
      }
    });

    const overseerResponse = response.text;
    let tasks = [];
    
    try {
      const parsed = JSON.parse(overseerResponse || "{}");
      tasks = Array.isArray(parsed) ? parsed : parsed.tasks || Object.values(parsed)[0];
    } catch (e) {
      console.error("Failed to parse Overseer JSON:", e);
    }

    // Save tasks to Firebase Firestore
    const batch = adminDb.batch();
    const tasksCollection = adminDb.collection('tasks');
    
    const taskDocs = tasks.map((task: any) => {
      const docRef = tasksCollection.doc();
      batch.set(docRef, {
        ...task,
        category: task.category || 'kitten',
        schedule: task.schedule || null,
        status: 'pending',
        assignedTo: null,
        createdAt: new Date(),
        userId: userId || 'anonymous',
        parentGoal: goal
      });
      return { id: docRef.id, ...task };
    });

    await batch.commit();

    return NextResponse.json({ success: true, tasks: taskDocs });

  } catch (error: any) {
    console.error('Overseer Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { adminDb } from '@/lib/firebase/admin';

// Initialize Gemini client for the Bees
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

export async function GET(req: Request) {
  // We use GET so it can be easily triggered by a simple cron URL ping
  
  try {
    const beesSnapshot = await adminDb.collection('tasks')
      .where('category', '==', 'bee')
      .get();

    const executedBees = [];

    for (const doc of beesSnapshot.docs) {
      const bee = { id: doc.id, ...doc.data() } as any;
      
      // Basic check: Don't run if already in progress
      if (bee.status === 'in-progress') continue;

      // In a production app, you would parse bee.schedule (e.g. "hourly", "every morning") 
      // and compare it with bee.lastRunAt to see if it's due.
      // For this implementation, we will assume if we hit the trigger, we want to run them.
      
      // Update status to in-progress
      await adminDb.collection('tasks').doc(bee.id).update({
        status: 'in-progress',
        startedAt: new Date()
      });

      // Execute Bee Task
      try {
        const systemInstruction = `You are a scheduled Worker Bee Agent. Your task is to execute this recurring job. Keep it concise and focused.`;
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Bee Task Title: ${bee.title}\n\nTask Description: ${bee.description}\n\nPlease execute this task.`,
          config: {
            systemInstruction: systemInstruction,
          }
        });

        const result = response.text;

        await adminDb.collection('tasks').doc(bee.id).update({
          status: 'completed',
          result: result,
          lastRunAt: new Date(),
          completedAt: new Date()
        });

        executedBees.push(bee.title);

      } catch (beeError: any) {
        console.error(`Error running Bee ${bee.id}:`, beeError);
        await adminDb.collection('tasks').doc(bee.id).update({
          status: 'failed',
          error: beeError.message
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Triggered ${executedBees.length} bees.`,
      executedBees
    });

  } catch (error: any) {
    console.error('Bees Trigger Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

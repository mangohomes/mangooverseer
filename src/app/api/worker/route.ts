import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { adminDb } from '@/lib/firebase/admin';
import fs from 'fs';
import path from 'path';

// Initialize Gemini client
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

export async function POST(req: Request) {
  let taskId: string | undefined;
  try {
    const body = await req.json();
    taskId = body.taskId;
    const { taskTitle, taskDescription, chatHistory, kittenId } = body;

    if (!taskId || !taskDescription) {
      return NextResponse.json({ error: 'Missing task parameters' }, { status: 400 });
    }

    // Update task status in Firestore to 'in-progress'
    const taskRef = adminDb.collection('tasks').doc(taskId);
    await taskRef.set({
      status: 'in-progress',
      startedAt: new Date()
    }, { merge: true });

    let systemInstruction = '';
    let tools: any[] = [];

    if (kittenId === 'kitten-listing') {
      systemInstruction = `You are the Listing/Pricing Kitten, an expert AI assistant specializing in real estate listing strategies, property pricing, and offering advice.
      
CRITICAL CONTEXT:
Today's Date is ${new Date().toISOString().split('T')[0]}.

YOUR ROLE:
- You help real estate agents analyze comparable homes, calculate potential offer prices, and write listing descriptions.
- You have access to a mock MLS search tool. Use it if you need to fetch recent MLS data for Horry and Brunswick.
- Be highly analytical and professional. Provide exact numbers and clear reasoning for any pricing recommendations.`;

      tools = [{
        functionDeclarations: [
          {
            name: 'search_mls_data',
            description: 'Search the MLS database (Horry and Brunswick) for comparable properties.',
            parameters: {
              type: 'OBJECT',
              properties: {
                query: {
                  type: 'STRING',
                  description: 'Search query for the MLS (e.g. "3 bed 2 bath Myrtle Beach under 400k").'
                }
              },
              required: ['query']
            }
          }
        ]
      }];
    } else {
      // Default CRM Kitten Logic
      systemInstruction = `You are a specialized Worker Agent in a CRM system. You have been assigned a task to interact with the database.
You have tools to search for and update deals in Mango CRM.

CRITICAL CONTEXT:
Today's Date is ${new Date().toISOString().split('T')[0]}. If a user asks to update a date to "today", use this exact date.

CRITICAL SEARCH PROTOCOL:
When using search_crm_deals, provide ONLY the most distinct keyword (like their exact last name) to maximize matches. For example, if asked to update "the Smiths", search for "Smith". If asked for "Laurel Quinn", search for "Quinn". The database might format names backwards (e.g. "Quinn, Laurel"), so a single keyword is safest.

CRITICAL AMBIGUITY PROTOCOL:
If you search for a client and find MORE THAN ONE match (e.g. multiple "Smiths"), you MUST NOT proceed with the update.
Instead, return a message asking the user to clarify which specific client they meant, listing the options you found.
DO NOT guess or update multiple records unless explicitly instructed to do so.

BROADER QUESTIONS (e.g. "Who have I contacted recently?"):
If the user asks a question that requires scanning all records (like finding clients contacted in the last week), use search_crm_deals with an empty string ("") to fetch ALL deals, then filter the results yourself to answer the user's question.`;
      
      tools = [{
        functionDeclarations: [
          {
            name: 'search_crm_deals',
            description: 'Search the CRM database by client name to find their Deal ID and current info. Leave empty ("") to fetch ALL clients in the database.',
            parameters: {
              type: 'OBJECT',
              properties: {
                query: {
                  type: 'STRING',
                  description: 'The name or partial name of the client to search for. Leave empty ("") to fetch ALL clients in the database.'
                }
              },
              required: ['query']
            }
          },
          {
            name: 'update_crm_deal',
            description: 'Update specific fields of a CRM deal using its ID.',
            parameters: {
              type: 'OBJECT',
              properties: {
                dealId: {
                  type: 'STRING',
                  description: 'The exact ID of the deal document to update.'
                },
                updates: {
                  type: 'OBJECT',
                  description: 'Key-value pairs of fields to update. E.g. {"lastContactDate": "2026-07-01", "dealStage": "Contacted"}',
                }
              },
              required: ['dealId', 'updates']
            }
          }
        ]
      }];
    }

    let contents: any[] = [];
    
    if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0) {
      contents.push({ role: 'user', parts: [{ text: `Here is the recent conversation history for context:\n\n${chatHistory.join('\n\n---\n\n')}` }] });
      contents.push({ role: 'model', parts: [{ text: `Understood. I have reviewed the conversation history and will use it for context if needed.` }] });
    }

    contents.push({ role: 'user', parts: [{ text: `Task Title: ${taskTitle}\n\nTask Description: ${taskDescription}\n\nPlease execute this task using your tools if necessary.` }] });

    let result = '';
    
    // Loop for up to 20 tool calls to prevent infinite loops but allow batch processing
    for (let i = 0; i < 20; i++) {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction,
          tools
        }
      });

      if (response.functionCalls && response.functionCalls.length > 0) {
        // Add model's function calls to history
        contents.push({ role: 'model', parts: response.functionCalls.map(c => ({ functionCall: c })) });
        
        const functionResponseParts = [];
        
        for (const call of response.functionCalls) {
          try {
            if (call.name === 'search_crm_deals') {
              const queryStr = ((call.args as any).query || '').toLowerCase();
              const queryTerms = queryStr.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
              const snapshot = await adminDb.collection('deals').get();
              const matches = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter((d: any) => {
                  const targetName = (d.name || d.clientNames || '').toLowerCase();
                  // Match if every term in the query exists somewhere in the name
                  return queryTerms.every((term: string) => targetName.includes(term));
                });
              
              functionResponseParts.push({
                functionResponse: {
                  name: call.name,
                  response: { matches: matches.length > 0 ? matches : { error: "No matches found" } }
                }
              });
            } else if (call.name === 'update_crm_deal') {
              const { dealId, updates } = call.args as any;
              await adminDb.collection('deals').doc(dealId).update(updates);
              functionResponseParts.push({
                functionResponse: {
                  name: call.name,
                  response: { success: true, updatedDealId: dealId }
                }
              });
            } else if (call.name === 'search_mls_data') {
              const queryStr = (call.args as any).query;
              // Placeholder mock response for now since we don't have real MLS data yet
              functionResponseParts.push({
                functionResponse: {
                  name: call.name,
                  response: { 
                    notice: "Real MLS data export is not yet wired up. Using mock data.",
                    mockResults: [
                      { address: "123 Ocean Blvd", price: 350000, beds: 3, baths: 2, status: "Active" },
                      { address: "456 Palm Way", price: 385000, beds: 3, baths: 2, status: "Pending" },
                      { address: "789 Dune Ct", price: 340000, beds: 3, baths: 2, status: "Sold" }
                    ]
                  }
                }
              });
            } else {
              functionResponseParts.push({
                functionResponse: {
                  name: call.name,
                  response: { error: "Unknown function" }
                }
              });
            }
          } catch (e: any) {
            functionResponseParts.push({
              functionResponse: {
                name: call.name,
                response: { error: e.message }
              }
            });
          }
        }
        
        // Send the function responses back to the model as 'user' role
        contents.push({ role: 'user', parts: functionResponseParts });
      } else {
        // No more function calls, we have our final text
        result = response.text || "Task completed with no text output.";
        break;
      }
    }
    
    if (!result) {
      result = "I completed the actions but hit the execution limit before I could write a summary.";
    }

    // Update task status to 'completed' with the result
    await taskRef.set({
      status: 'completed',
      result: result,
      completedAt: new Date()
    }, { merge: true });

    return NextResponse.json({ success: true, result });

  } catch (error: any) {
    console.error('Worker Error:', error);
    try {
      fs.writeFileSync(path.join(process.cwd(), 'worker-error.txt'), error.stack || error.message);
    } catch(e){}
    
    // Attempt to mark task as failed if taskId is present
    try {
      if (taskId) {
        await adminDb.collection('tasks').doc(taskId).set({
          status: 'failed',
          error: error.message
        }, { merge: true });
      }
    } catch (e) {
      // Ignore inner error
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

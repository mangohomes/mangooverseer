"use client";

import { useState, useEffect, useRef } from "react";
import { collection, onSnapshot, query, orderBy, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export default function Dashboard() {
  const [goal, setGoal] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [firebaseError, setFirebaseError] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'kittens' | 'bees' | 'warehouse'>('kittens');
  const [selectedKittenId, setSelectedKittenId] = useState<string | null>('data-entry');
  const [selectedBeeId, setSelectedBeeId] = useState<string | null>(null);
  const [triggeringBees, setTriggeringBees] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const executingTasksRef = useRef<Set<string>>(new Set());

  // Intake Scanner State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [intakeData, setIntakeData] = useState<any>(null);
  const [syncingCRM, setSyncingCRM] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  useEffect(() => {
    try {
      if (!db) {
        setTimeout(() => setFirebaseError(true), 0);
        return;
      }
      const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const tasksData = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          hasPendingWrites: doc.metadata.hasPendingWrites,
          ...doc.data() 
        }));
        setTasks(tasksData);
        setFirebaseError(false);
      }, (error) => {
        console.warn("Firestore listener error (Likely missing config):", error);
        setFirebaseError(true);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Firebase not configured:", e);
      setTimeout(() => setFirebaseError(true), 0);
    }
  }, []);

  const handleRunWorker = async (task: any) => {
    try {
      const taskIndex = tasks.findIndex(t => t.id === task.id);
      const chatHistory = tasks
        .slice(taskIndex + 1)
        .filter(t => (t.category === 'kitten' || !t.category) && t.status === 'completed')
        .slice(0, 10)
        .reverse()
        .map(t => `Goal: ${t.title}\nDescription: ${t.description}\nResult: ${t.result}`);

      const res = await fetch("/api/worker", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ 
           taskId: task.id, 
           taskTitle: task.title, 
           taskDescription: task.description, 
           chatHistory,
           kittenId: task.category || 'kitten' 
         })
      });
      if (!res.ok) alert("Worker failed. Check your GEMINI_API_KEY.");
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    // Auto-execute pending kitten tasks (wait for server confirmation to avoid NOT_FOUND errors)
    const pendingKittens = tasks.filter(t => (t.category === 'kitten' || t.category === 'kitten-listing' || !t.category) && t.status === 'pending' && !t.hasPendingWrites);
    pendingKittens.forEach(task => {
      if (!executingTasksRef.current.has(task.id)) {
        executingTasksRef.current.add(task.id);
        handleRunWorker(task);
      }
    });
  }, [tasks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal) return;
    setLoading(true);
    try {
      const res = await fetch("/api/overseer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, userId: "demo-user" })
      });
      if (res.ok) setGoal("");
      else alert("Error sending to Overseer. Check if your GEMINI_API_KEY is set in .env.local.");
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !db) return;
    try {
      const res = await fetch("/api/task/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "User Reply",
          description: chatInput,
          category: selectedKittenId === 'data-entry' ? 'kitten' : selectedKittenId,
          status: "pending"
        })
      });
      if (res.ok) {
        setChatInput("");
      } else {
        console.error("Failed to create task", await res.text());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerBees = async () => {
    setTriggeringBees(true);
    try {
      const res = await fetch("/api/bees-trigger");
      if (!res.ok) alert("Failed to trigger bees.");
    } catch (error) {
      console.error(error);
    } finally {
      setTriggeringBees(false);
    }
  };

  const handleSimulateGeoScan = async (beeId: string) => {
    try {
      const res = await fetch("/api/bees-trigger-geo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beeId })
      });
      if (!res.ok) alert("Failed to trigger GEO scan.");
    } catch (error) {
      console.error(error);
    }
  };

  const handleSimulateGeminiUpdates = async (beeId: string) => {
    try {
      const res = await fetch("/api/bees-trigger-gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beeId })
      });
      if (!res.ok) alert("Failed to trigger Gemini updates scan.");
    } catch (error) {
      console.error(error);
    }
  };

  const handleSimulateDailyRun = async (beeId: string) => {
    try {
      const res = await fetch("/api/bees-trigger-daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beeId })
      });
      if (!res.ok) alert("Failed to trigger daily run.");
    } catch (error) {
      console.error(error);
    }
  };

  const handleSimulateWeeklyEmail = async (beeId: string) => {
    try {
      const res = await fetch("/api/bees-trigger-weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beeId })
      });
      if (!res.ok) alert("Failed to trigger weekly email.");
    } catch (error) {
      console.error(error);
    }
  };

  // Intake Scanner Functions
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingImage(true);
    setSyncSuccess(false);

    try {
      const images = await Promise.all(
        Array.from(files).map(file => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve({ base64Image: reader.result as string, mimeType: file.type });
          });
        })
      );
        
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images })
      });
      
      if (res.ok) {
        const { data } = await res.json();
        
        // Default to today's date if not extracted
        if (!data.intakeDate) {
          const today = new Date();
          const yyyy = today.getFullYear();
          const mm = String(today.getMonth() + 1).padStart(2, '0');
          const dd = String(today.getDate()).padStart(2, '0');
          data.intakeDate = `${yyyy}-${mm}-${dd}`;
        }
        
        setIntakeData(data);
      } else {
        alert("Failed to process images.");
      }
      setUploadingImage(false);
    } catch (error) {
      console.error(error);
      setUploadingImage(false);
    }
  };

  const handleCRMSync = async () => {
    setSyncingCRM(true);
    try {
      // We discovered both apps use the exact same Firebase database!
      // We can bypass Netlify entirely and just write directly to Mango CRM's 'deals' collection.
      if (db) {
        const commentText = `Phone: ${intakeData.phone || 'N/A'}
Email: ${intakeData.email || 'N/A'}
Budget: ${intakeData.budget || 'N/A'}
Location: ${intakeData.location || 'N/A'}
Timeframe: ${intakeData.timeframe || 'N/A'}
Upcoming Visit: ${intakeData.hasUpcomingVisit ? 'Yes' : 'No'}
Wants: ${Array.isArray(intakeData.wants) ? intakeData.wants.join(', ') : (intakeData.wants || 'N/A')}
Do Not Wants: ${Array.isArray(intakeData.doNotWants) ? intakeData.doNotWants.join(', ') : (intakeData.doNotWants || 'N/A')}`;

        await addDoc(collection(db, "deals"), {
          name: intakeData.clientNames || 'Unknown Client',
          dealStage: 'New',
          leadSource: 'Data Entry Kitten',
          phone: intakeData.phone || '',
          email: intakeData.email || '',
          budget: intakeData.budget || '',
          location: intakeData.location || '',
          timeframe: intakeData.timeframe || '',
          isUpcomingVisit: !!intakeData.hasUpcomingVisit,
          wants: intakeData.wants || [],
          doNotWants: intakeData.doNotWants || [],
          comments: [{ text: commentText }],
          createdAt: intakeData.intakeDate ? new Date(intakeData.intakeDate).toISOString() : new Date().toISOString(),
          tasks: [],
          automationsRun: ["New"]
        });
      }

      setSyncSuccess(true);
      setTimeout(() => {
        setIntakeData(null);
        setSyncSuccess(false);
      }, 3000);

    } catch (error) {
      console.error("Sync failed:", error);
      alert("Failed to sync to CRM.");
    } finally {
      setSyncingCRM(false);
    }
  };

  const kittens = tasks.filter(t => {
    if (selectedKittenId === 'data-entry') return t.category === 'kitten' || !t.category;
    if (selectedKittenId === 'kitten-listing') return t.category === 'kitten-listing';
    return false;
  });
  const bees = tasks.filter(t => t.category === 'bee');
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-5xl mx-auto space-y-12">
        
        {/* Header */}
        <header className="text-center space-y-4 pt-12">
          <h1 className="text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            Agentic Overseer
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Command your team of specialized AI agents. The Overseer will assign tasks to <b>The Kittens</b> (on-demand) or schedule them with <b>The Bees</b>.
          </p>
        </header>

        {firebaseError && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 text-center">
            <p className="text-red-400 font-medium">⚠️ Firebase is not fully configured.</p>
            <p className="text-sm text-red-400/80 mt-1">Please add your Firebase credentials to <code className="bg-black/20 px-1.5 py-0.5 rounded">.env.local</code> to enable real-time database syncing.</p>
          </div>
        )}

        {/* Input Section */}
        <form onSubmit={handleSubmit} className="relative group max-w-3xl mx-auto">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative flex items-center bg-[#111] rounded-2xl p-2 ring-1 ring-white/10 shadow-2xl">
            <input 
              type="text" 
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What would you like the Kittens or Bees to do?" 
              className="w-full bg-transparent px-6 py-4 text-lg outline-none placeholder:text-gray-600 focus:ring-0"
              disabled={loading}
            />
            <button 
              type="submit" 
              disabled={loading || !goal}
              className="px-8 py-4 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? "Processing..." : "Command"}
            </button>
          </div>
        </form>

        {/* Task Section */}
        <div className="space-y-6">
          {/* Tabs */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4 overflow-x-auto custom-scrollbar">
            <div className="flex justify-center border-b border-white/10 pb-1">
              <button 
                onClick={() => setActiveTab('kittens')}
                className={`px-6 py-2.5 rounded-full font-medium transition-all ${activeTab === 'kittens' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/50' : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'}`}
              >
                🐱 The Kittens ({kittens.length})
              </button>
              <button 
                onClick={() => setActiveTab('bees')}
                className={`px-6 py-2.5 rounded-full font-medium transition-all ml-4 ${activeTab === 'bees' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'}`}
              >
                🐝 The Bees ({bees.length})
              </button>
              <button 
                onClick={() => setActiveTab('warehouse')}
                className={`px-6 py-2.5 rounded-full font-medium transition-all ml-4 ${activeTab === 'warehouse' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'}`}
              >
                🗄️ Data Warehouse
              </button>
            </div>
            
            {activeTab === 'bees' && (
              <button 
                onClick={handleTriggerBees}
                disabled={triggeringBees}
                className="text-sm font-medium px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-xl transition-colors flex items-center gap-2 border border-yellow-500/20 whitespace-nowrap"
              >
                {triggeringBees ? "Waking Bees..." : "Wake All Bees Now"}
              </button>
            )}
          </div>

          {/* KITTENS TAB CONTENT */}
          {activeTab === 'kittens' && (
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Sidebar */}
              <div className="w-full lg:w-1/3 flex flex-col gap-3">
                <button
                  onClick={() => { setActiveTab('kittens'); setSelectedKittenId('kitten-listing'); }}
                  className={`p-3 rounded-xl text-left transition-all ${
                    activeTab === 'kittens' && selectedKittenId === 'kitten-listing'
                      ? 'bg-pink-600 shadow-md shadow-pink-500/20 text-white' 
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-sm">🐱 Listing/Pricing Kitten</div>
                  <div className="text-[10px] opacity-70 mt-1 line-clamp-1">Expert in offers, comps, and MLS analysis.</div>
                </button>
                <button
                  onClick={() => { setActiveTab('kittens'); setSelectedKittenId('data-entry'); }}
                  className={`p-3 rounded-xl text-left transition-all ${
                    activeTab === 'kittens' && selectedKittenId === 'data-entry'
                      ? 'bg-pink-600 shadow-md shadow-pink-500/20 text-white' 
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-sm">🐱 Data Entry / CRM Kitten</div>
                  <div className="text-[10px] opacity-70 mt-1 line-clamp-1">Dedicated bot for CRM forms and updates.</div>
                </button>
                <button
                  onClick={() => { setActiveTab('kittens'); setSelectedKittenId('new-kitten'); }}
                  className={`p-3 rounded-xl text-left transition-all border border-dashed ${
                    activeTab === 'kittens' && selectedKittenId === 'new-kitten'
                      ? 'bg-pink-600 border-pink-500 shadow-md shadow-pink-500/20 text-white' 
                      : 'border-white/10 text-gray-500 hover:bg-white/5 hover:text-gray-300'
                  }`}
                >
                  <div className="font-bold text-sm">+ Add New Kitten</div>
                </button>
              </div>

              {/* Main Workspace */}
              <div className="w-full lg:w-2/3">
                {!selectedKittenId ? (
                  <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
                    <div className="text-6xl mb-4 opacity-50">🐱</div>
                    <h2 className="text-xl font-bold text-white mb-2">Select a Kitten</h2>
                    <p className="text-gray-400">Choose a specialized Kitten from the roster on the left to view its workspace.</p>
                  </div>
                ) : (selectedKittenId === 'data-entry' || selectedKittenId === 'kitten-listing') ? (
                  <div className="bg-[#161616] border border-white/5 rounded-2xl flex flex-col h-[700px] overflow-hidden">
                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#1a1a1a]">
                      <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                          🐱 {selectedKittenId === 'data-entry' ? 'Data Entry / CRM Kitten' : 'Listing/Pricing Kitten'}
                        </h2>
                        <p className="text-xs text-gray-400">
                          {selectedKittenId === 'data-entry' ? 'Your dedicated bot for CRM forms and updates.' : 'Expert in offers, comps, and MLS analysis.'}
                        </p>
                      </div>
                      {selectedKittenId === 'data-entry' && (
                        <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-pink-600 hover:bg-pink-500 rounded-lg text-sm text-white font-medium shadow-lg transition-colors flex items-center gap-2">
                          {uploadingImage ? "Reading..." : "Scan Intake Form"}
                        </button>
                      )}
                    </div>

                    <input type="file" accept="image/*" multiple className="hidden" ref={fileInputRef} onChange={handleImageUpload} />

                    {/* Intake Form Result Area */}
                    {intakeData && (
                      <div className="p-4 border-b border-white/5 bg-[#111]">
                        <div className="flex justify-between items-center mb-3">
                          <h2 className="text-sm font-bold text-green-400 flex items-center gap-1">✓ Form Data Extracted!</h2>
                          <button onClick={() => setIntakeData(null)} className="text-xs text-gray-500 hover:text-white transition-colors">Clear</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Client Name</label>
                            <input type="text" value={Array.isArray(intakeData.clientNames) ? intakeData.clientNames.join(', ') : intakeData.clientNames || ''} onChange={e => setIntakeData({...intakeData, clientNames: e.target.value})} className="w-full bg-[#1a1a1a] border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-pink-500" />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Phone</label>
                            <input type="text" value={intakeData.phone || ''} onChange={e => setIntakeData({...intakeData, phone: e.target.value})} className="w-full bg-[#1a1a1a] border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-pink-500" />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          {syncSuccess ? (
                            <span className="text-green-400 font-bold text-xs">✓ Synced to CRM</span>
                          ) : (
                            <button onClick={handleCRMSync} disabled={syncingCRM} className="px-4 py-1.5 bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold rounded transition-all disabled:opacity-50">
                              {syncingCRM ? "Syncing..." : "Approve & Sync"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Chat Feed */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#0a0a0a]">
                      {kittens.slice().reverse().map(task => (
                        <div key={task.id} className="space-y-4">
                          <div className="flex justify-end">
                             <div className="bg-indigo-600/80 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] border border-indigo-500/30">
                               <div className="font-bold text-sm mb-1 text-indigo-100">{task.title || "User Request"}</div>
                               <div className="text-sm">{task.description}</div>
                             </div>
                          </div>
                          {(task.status === 'completed' || task.status === 'failed' || task.status === 'needs-clarification' || task.status === 'in-progress') && (
                            <div className="flex justify-start">
                               <div className={`rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] border ${task.status === 'failed' ? 'bg-red-500/10 border-red-500/20 text-red-200' : 'bg-[#161616] border-white/10 text-gray-200'}`}>
                                  <div className="text-[10px] font-bold text-pink-400 mb-1 uppercase tracking-wider">
                                    {selectedKittenId === 'data-entry' ? 'CRM Kitten' : 'Listing Kitten'}
                                  </div>
                                  {task.status === 'in-progress' ? (
                                    <div className="flex items-center gap-1.5 text-pink-400/70 text-sm">
                                      <span className="animate-pulse">●</span><span className="animate-pulse delay-75">●</span><span className="animate-pulse delay-150">●</span>
                                    </div>
                                  ) : (
                                    <div className="text-sm whitespace-pre-wrap leading-relaxed">{task.result || "No response provided."}</div>
                                  )}
                               </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Chat Input */}
                    <div className="p-4 border-t border-white/5 bg-[#1a1a1a]">
                      <div className="flex items-center bg-[#111] rounded-xl p-1.5 ring-1 ring-white/10 focus-within:ring-pink-500/50 transition-all">
                        <input 
                          type="text" 
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => { if(e.key === 'Enter'){ e.preventDefault(); handleSendChat(); } }}
                          placeholder="Reply to the Kitten..." 
                          className="w-full bg-transparent px-4 py-2 outline-none placeholder:text-gray-600 focus:ring-0 text-white"
                        />
                        <button 
                          onClick={handleSendChat}
                          className="px-6 py-2 bg-pink-600 hover:bg-pink-500 rounded-lg text-white font-medium transition-colors"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* BEES TAB CONTENT */}
          {activeTab === 'bees' && (
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Sidebar */}
              <div className="w-full lg:w-1/3 flex flex-col gap-3">
                {bees.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 border border-dashed border-white/10 rounded-2xl text-sm">
                    No active bees found.
                  </div>
                ) : (
                  bees.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => setSelectedBeeId(task.id)}
                      className={`p-3 rounded-xl text-left transition-all relative overflow-hidden ${
                        selectedBeeId === task.id
                          ? 'bg-yellow-600 shadow-md shadow-yellow-500/20 text-white' 
                          : 'bg-[#161616] text-gray-400 hover:bg-white/5 hover:text-white border border-white/5'
                      }`}
                    >
                      <div className={`absolute top-0 left-0 w-1 h-full ${task.status === 'completed' ? 'bg-green-500' : task.status === 'in-progress' ? 'bg-blue-500' : task.status === 'failed' ? 'bg-red-500' : 'bg-orange-500'}`} />
                      <div className="pl-2">
                        <div className="font-bold text-sm flex items-center justify-between">
                          <span className="truncate">🐝 {task.title || "Untitled Bee"}</span>
                          {task.schedule && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded ml-2 ${selectedBeeId === task.id ? 'bg-yellow-500/30 text-yellow-100' : 'bg-white/10 text-gray-400'}`}>
                              {task.schedule}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] opacity-70 mt-1 line-clamp-1">{task.description}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Main Workspace */}
              <div className="w-full lg:w-2/3">
                {!selectedBeeId ? (
                  <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
                    <div className="text-6xl mb-4 opacity-50">🐝</div>
                    <h2 className="text-xl font-bold text-white mb-2">Select a Bee</h2>
                    <p className="text-gray-400">Choose a scheduled Bee from the roster on the left to view its workspace.</p>
                  </div>
                ) : (
                  (() => {
                    const task = bees.find(b => b.id === selectedBeeId);
                    if (!task) return null;
                    return (
                      <div className="bg-[#161616] border border-white/5 rounded-2xl flex flex-col h-[700px] overflow-hidden">
                        <div className="p-4 border-b border-white/5 bg-[#1a1a1a]">
                          <div className="flex justify-between items-start mb-2">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                              🐝 {task.title || "Untitled Bee"}
                            </h2>
                            <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${task.status === 'completed' ? 'bg-green-500/10 text-green-400' : task.status === 'in-progress' ? 'bg-blue-500/10 text-blue-400' : task.status === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-orange-500/10 text-orange-400'}`}>
                              {task.status || "Pending"}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 leading-relaxed">{task.description}</p>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#0a0a0a]">
                          {task.beeType === 'new-construction' ? (
                            <div className="space-y-6">
                              <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-4">
                                <h4 className="text-sm font-bold text-pink-400 uppercase tracking-wider">Weekly Findings ({task.weeklyFindings?.length || 0})</h4>
                                {!task.weeklyFindings || task.weeklyFindings.length === 0 ? (
                                  <p className="text-sm text-gray-500 italic">No daily findings recorded yet this week.</p>
                                ) : (
                                  <div className="space-y-3">
                                    {task.weeklyFindings.map((finding: any, i: number) => (
                                      <div key={i} className="text-sm text-gray-300 border-l-2 border-indigo-500/50 pl-4 py-1 bg-white/[0.02] rounded-r-lg">
                                        <span className="font-bold text-indigo-300 block mb-1">{new Date(finding.date).toLocaleDateString()}</span>
                                        <div className="whitespace-pre-wrap">{finding.summary}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              {task.result && task.status === 'completed' && (
                                <div className="p-4 bg-blue-900/20 rounded-xl border border-blue-500/30">
                                  <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-3">Latest Weekly Email</h4>
                                  <p className="text-sm font-mono text-blue-100 whitespace-pre-wrap">{task.result}</p>
                                </div>
                              )}
                            </div>
                            ) : task.beeType === 'geo-optimization' ? (
                            <div className="space-y-6">
                              {task.result && task.status === 'completed' ? (
                                <div className="p-5 bg-purple-900/20 rounded-xl border border-purple-500/30">
                                  <h4 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span>🌐</span> Latest GEO Audit
                                  </h4>
                                  <div className="text-sm font-mono text-purple-100 whitespace-pre-wrap leading-relaxed">
                                    {task.result}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-12 text-gray-500 border border-dashed border-white/10 rounded-2xl text-sm">
                                  No GEO audit results yet. Click simulate below to run the first scan.
                                </div>
                              )}
                            </div>
                            ) : task.beeType === 'gemini-updates' ? (
                            <div className="space-y-6">
                              {task.result && task.status === 'completed' ? (
                                <div className="p-5 bg-teal-900/20 rounded-xl border border-teal-500/30">
                                  <h4 className="text-sm font-bold text-teal-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span>✨</span> Latest Gemini Alerts
                                  </h4>
                                  <div className="text-sm font-mono text-teal-100 whitespace-pre-wrap leading-relaxed">
                                    {task.result}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-12 text-gray-500 border border-dashed border-white/10 rounded-2xl text-sm">
                                  No AI updates fetched yet. Click simulate below to run the first check.
                                </div>
                              )}
                            </div>
                          ) : (
                            task.result && task.status === 'completed' && (
                              <div className="p-4 bg-black/40 rounded-xl border border-white/5">
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Latest Result</h4>
                                <p className="text-sm font-mono text-gray-300 whitespace-pre-wrap">{task.result}</p>
                              </div>
                            )
                          )}
                        </div>

                        {task.beeType === 'new-construction' && (
                          <div className="p-4 border-t border-white/5 bg-[#1a1a1a] flex gap-3">
                            <button onClick={() => handleSimulateDailyRun(task.id)} className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition-all text-center">
                              Simulate Daily Run
                            </button>
                            <button onClick={() => handleSimulateWeeklyEmail(task.id)} className="flex-1 px-4 py-3 bg-pink-600 hover:bg-pink-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-pink-500/20 transition-all text-center">
                              Simulate Weekly Email
                            </button>
                          </div>
                        )}
                        
                        {task.beeType === 'geo-optimization' && (
                          <div className="p-4 border-t border-white/5 bg-[#1a1a1a] flex gap-3">
                            <button onClick={() => handleSimulateGeoScan(task.id)} className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-purple-500/20 transition-all text-center">
                              Simulate Weekly GEO Scan
                            </button>
                          </div>
                        )}
                        
                        {task.beeType === 'gemini-updates' && (
                          <div className="p-4 border-t border-white/5 bg-[#1a1a1a] flex gap-3">
                            <button onClick={() => handleSimulateGeminiUpdates(task.id)} className="flex-1 px-4 py-3 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-teal-500/20 transition-all text-center">
                              Simulate Gemini Update Check
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          )}

          {/* DATA WAREHOUSE CONTENT */}
          {activeTab === 'warehouse' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="text-3xl">🏠</div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">MLS Export Cache</h2>
                    <p className="text-sm text-gray-400">Weekly upload zone for the Listing/Pricing Kitten.</p>
                  </div>
                </div>
                
                <div className="border-2 border-dashed border-white/10 hover:border-pink-500/30 bg-[#111] rounded-xl p-12 text-center transition-all cursor-pointer group">
                  <div className="text-4xl mb-3 opacity-50 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-300">📄</div>
                  <h3 className="text-lg font-semibold text-white mb-1">Drag & Drop MLS Export Here</h3>
                  <p className="text-sm text-gray-500">Supports CSV, XLS, XLSX</p>
                  <button className="mt-6 px-6 py-2 bg-pink-600/20 hover:bg-pink-600/40 text-pink-300 rounded-lg text-sm font-medium transition-colors border border-pink-500/30">
                    Browse Files
                  </button>
                </div>
              </div>

              <div className="bg-[#161616] border border-white/5 rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="text-3xl">🏗️</div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">New Construction Sources</h2>
                    <p className="text-sm text-gray-400">Target websites and Google Docs for the New Construction Bee to scrape.</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-[#111] rounded-xl p-1.5 ring-1 ring-white/10 focus-within:ring-yellow-500/50 transition-all">
                    <textarea 
                      placeholder="Paste Google Doc URLs or website links here (one per line)..." 
                      className="w-full bg-transparent px-4 py-3 outline-none placeholder:text-gray-600 focus:ring-0 text-white min-h-[150px] resize-y custom-scrollbar text-sm font-mono"
                      defaultValue={"https://horrycounty.org/planning/approvals\nhttps://drhorton.com/south-carolina/myrtle-beach"}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-yellow-500/20">
                      Save Sources
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-[#161616] border border-white/5 rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="text-3xl">🌐</div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Mango Homes Digital Footprint</h2>
                    <p className="text-sm text-gray-400">Social media profiles and websites for the GEO Bee to audit weekly.</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-[#111] rounded-xl p-1.5 ring-1 ring-white/10 focus-within:ring-purple-500/50 transition-all">
                    <textarea 
                      placeholder="Paste your Facebook, Instagram, LinkedIn, and website URLs here..." 
                      className="w-full bg-transparent px-4 py-3 outline-none placeholder:text-gray-600 focus:ring-0 text-white min-h-[150px] resize-y custom-scrollbar text-sm font-mono"
                      defaultValue={"https://mangohomes.com\nhttps://facebook.com/mangohomes\nhttps://instagram.com/mangohomes.sc"}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-purple-500/20">
                      Save Digital Footprint
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

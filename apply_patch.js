const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf8');

// Replace state
code = code.replace(
  "  const [activeTab, setActiveTab] = useState<'kittens' | 'bees'>('kittens');",
  "  const [activeTab, setActiveTab] = useState<'kittens' | 'bees'>('kittens');\n  const [selectedKittenId, setSelectedKittenId] = useState<string>('data-entry');"
);

// Get the block to replace
const startMarker = '          {/* INTAKE SCANNER (Housed under Kittens) */}';
const endMarker = '          {/* BEES TAB CONTENT */}'; // Wait, BEES TAB is missing. Let me find a better marker.

const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf('        </div>\n      </div>\n    </div>\n  );\n}\n');

if (startIdx === -1 || endIdx === -1) {
  console.log('Failed to find markers.');
  process.exit(1);
}

const replacement = `          {/* KITTENS TAB CONTENT */}
          {activeTab === 'kittens' && (
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Sidebar */}
              <div className="w-full lg:w-1/3 flex flex-col gap-3">
                <button 
                  onClick={() => setSelectedKittenId('data-entry')}
                  className={\`w-full text-left px-5 py-4 rounded-2xl transition-all border \${selectedKittenId === 'data-entry' ? 'bg-pink-500/10 text-pink-400 border-pink-500/30' : 'bg-[#161616] text-gray-400 hover:text-white border-white/5 hover:border-white/20'}\`}
                >
                  <div className="font-bold flex items-center gap-2 text-lg">📸 Data Entry Kitten</div>
                  <div className="text-sm mt-1 opacity-80">Process handwritten intake forms to CRM</div>
                </button>
                
                {kittens.map(task => (
                  <button 
                    key={task.id}
                    onClick={() => setSelectedKittenId(task.id)}
                    className={\`w-full text-left px-5 py-4 rounded-2xl transition-all border \${selectedKittenId === task.id ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-[#161616] text-gray-400 hover:text-white border-white/5 hover:border-white/20'}\`}
                  >
                    <div className="font-bold line-clamp-1">{task.title || "Untitled Task"}</div>
                    <div className="flex justify-between items-center mt-2">
                      <span className={\`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider \${task.status === 'completed' ? 'bg-green-500/20 text-green-400' : task.status === 'in-progress' ? 'bg-blue-500/20 text-blue-400' : task.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}\`}>
                        {task.status || "Pending"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Main Workspace */}
              <div className="w-full lg:w-2/3">
                {selectedKittenId === 'data-entry' ? (
                  <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 md:p-8">
                    {!intakeData ? (
                      <div className="text-center space-y-6">
                        <div className="w-20 h-20 bg-pink-500/10 text-pink-400 rounded-2xl flex items-center justify-center mx-auto text-3xl border border-pink-500/20">
                          📸
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-white">Data Entry Kitten</h2>
                          <p className="text-gray-400 mt-2">Upload photos of a handwritten intake sheet, and the Kitten will transcribe it directly into your CRM.</p>
                        </div>
                        
                        <input 
                          type="file" 
                          accept="image/*" 
                          multiple
                          className="hidden" 
                          ref={fileInputRef}
                          onChange={handleImageUpload}
                        />
                        
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                          className="px-8 py-4 bg-pink-600 hover:bg-pink-500 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
                        >
                          {uploadingImage ? "Kitten is reading images..." : "Upload Intake Photos"}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center border-b border-white/10 pb-4">
                          <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="text-green-400">✓</span> Data Extracted!
                          </h2>
                          <button 
                            onClick={() => setIntakeData(null)}
                            className="text-sm text-gray-400 hover:text-white transition-colors"
                          >
                            Clear & Scan Another
                          </button>
                        </div>

                        {/* Review Form */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Client Name(s)</label>
                            <input type="text" value={Array.isArray(intakeData.clientNames) ? intakeData.clientNames.join(', ') : intakeData.clientNames || ''} onChange={e => setIntakeData({...intakeData, clientNames: e.target.value})} className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-pink-500" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Phone</label>
                            <input type="text" value={intakeData.phone || ''} onChange={e => setIntakeData({...intakeData, phone: e.target.value})} className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-pink-500" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</label>
                            <input type="email" value={intakeData.email || ''} onChange={e => setIntakeData({...intakeData, email: e.target.value})} className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-pink-500" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Budget</label>
                            <input type="text" value={intakeData.budget || ''} onChange={e => setIntakeData({...intakeData, budget: e.target.value})} className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-pink-500" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Intake Date</label>
                            <input type="date" value={intakeData.intakeDate || ''} onChange={e => setIntakeData({...intakeData, intakeDate: e.target.value})} className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-pink-500" />
                          </div>
                          <div className="space-y-1 md:col-span-1">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Location / Timeframe</label>
                            <input type="text" value={\`\${intakeData.location || 'Unknown Location'} • \${intakeData.timeframe || 'Unknown Timeframe'}\`} onChange={e => {
                              const parts = e.target.value.split('•');
                              setIntakeData({...intakeData, location: parts[0]?.trim(), timeframe: parts[1]?.trim()})
                            }} className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-pink-500" />
                          </div>
                          <div className="space-y-1 md:col-span-2 flex items-center gap-3 bg-pink-500/10 p-3 rounded-lg border border-pink-500/20">
                            <input type="checkbox" id="upcomingVisit" checked={!!intakeData.hasUpcomingVisit} onChange={e => setIntakeData({...intakeData, hasUpcomingVisit: e.target.checked})} className="w-5 h-5 accent-pink-500" />
                            <label htmlFor="upcomingVisit" className="text-sm font-semibold text-pink-400 cursor-pointer">Upcoming Visit?</label>
                          </div>
                          
                          <div className="space-y-1 md:col-span-2 mt-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-green-400">Wants</label>
                            <textarea rows={3} value={Array.isArray(intakeData.wants) ? intakeData.wants.join('\\n') : intakeData.wants || ''} onChange={e => setIntakeData({...intakeData, wants: e.target.value.split('\\n')})} className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500" />
                          </div>
                          
                          <div className="space-y-1 md:col-span-2 mt-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-red-400">Do Not Wants</label>
                            <textarea rows={3} value={Array.isArray(intakeData.doNotWants) ? intakeData.doNotWants.join('\\n') : intakeData.doNotWants || ''} onChange={e => setIntakeData({...intakeData, doNotWants: e.target.value.split('\\n')})} className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500" />
                          </div>
                        </div>

                        <div className="pt-6 border-t border-white/10 flex justify-end">
                          {syncSuccess ? (
                            <div className="text-green-400 font-bold flex items-center gap-2 py-3 px-6 bg-green-500/10 rounded-xl">
                              ✓ Synced to Mango CRM & Firebase
                            </div>
                          ) : (
                            <button 
                              onClick={handleCRMSync}
                              disabled={syncingCRM}
                              className="px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                            >
                              {syncingCRM ? "Syncing..." : "Approve & Sync to CRM"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  (() => {
                    const task = kittens.find(k => k.id === selectedKittenId);
                    if (!task) return null;
                    return (
                      <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 md:p-8 flex flex-col min-h-[400px]">
                        <div className="flex justify-between items-start mb-6">
                          <h2 className="text-2xl font-bold text-white">{task.title || "Untitled Task"}</h2>
                          <span className={\`text-sm font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider \${task.status === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : task.status === 'in-progress' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : task.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}\`}>
                            {task.status || "Pending"}
                          </span>
                        </div>
                        
                        <div className="mb-8">
                          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Instructions</h3>
                          <p className="text-gray-300 text-lg leading-relaxed">
                            {task.description || "No description provided."}
                          </p>
                        </div>
                        
                        {task.status === 'completed' && task.result && (
                          <div className="mb-8">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Results</h3>
                            <div className="p-4 bg-black/40 rounded-xl border border-white/10 overflow-y-auto custom-scrollbar">
                              <p className="font-mono text-gray-300 whitespace-pre-wrap">{task.result}</p>
                            </div>
                          </div>
                        )}

                        {task.status === 'pending' && (
                          <button 
                            onClick={() => handleRunWorker(task)}
                            className="mt-auto w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-semibold rounded-xl transition-colors"
                          >
                            Execute Task (Assign to Gemini)
                          </button>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          )}

          {/* BEES TAB CONTENT */}
          {activeTab === 'bees' && (
            bees.length === 0 ? (
              <div className="text-center py-24 text-gray-500 border border-dashed border-white/10 rounded-2xl">
                No active bees found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bees.map((task) => (
                  <div key={task.id} className={\`bg-[#161616] border border-white/5 rounded-2xl p-6 hover:border-yellow-500/30 transition-all duration-300 flex flex-col group relative overflow-hidden\`}>
                    
                    <div className={\`absolute top-0 left-0 w-full h-1 \${task.status === 'completed' ? 'bg-green-500' : task.status === 'in-progress' ? 'bg-blue-500' : task.status === 'failed' ? 'bg-red-500' : 'bg-orange-500'}\`} />

                    <div className="flex justify-between items-start mb-4">
                      <span className={\`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider \${task.status === 'completed' ? 'bg-green-500/10 text-green-400' : task.status === 'in-progress' ? 'bg-blue-500/10 text-blue-400' : task.status === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-orange-500/10 text-orange-400'}\`}>
                        {task.status || "Pending"}
                      </span>
                      {task.schedule && (
                        <span className="text-xs px-2 py-1 bg-white/10 text-gray-300 rounded flex items-center gap-1">
                          ⏱️ {task.schedule}
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-semibold text-white mb-2 line-clamp-1">{task.title || "Untitled Task"}</h3>
                    <p className="text-sm text-gray-400 mb-6 flex-grow line-clamp-3 leading-relaxed">
                      {task.description || "No description provided."}
                    </p>
                    
                    {task.status === 'completed' && task.result && (
                      <div className="mt-4 p-3 bg-black/40 rounded-lg border border-white/5 max-h-32 overflow-y-auto custom-scrollbar">
                        <p className="text-xs font-mono text-gray-300 whitespace-pre-wrap">{task.result}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
\n`;

code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
fs.writeFileSync('src/app/page.tsx', code);
console.log("Successfully replaced UI layout");

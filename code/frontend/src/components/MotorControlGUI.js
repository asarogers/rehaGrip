import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  RotateCcw,
  RotateCw,
  AlertTriangle,
  Power,
  Lock,
  Unlock,
  Hand
} from 'lucide-react';

const API_BASE = 'http://localhost:3001/api/motor';

export default function MotorControlGUI() {
  const [targetPosition, setTargetPosition] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [velocity, setVelocity] = useState(50);
  const [isLocked, setIsLocked] = useState(false);
  const [torqueEnabled, setTorqueEnabled] = useState(true);
  const [loadReading, setLoadReading] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [handSelection, setHandSelection] = useState('right');
  const [statusMessages, setStatusMessages] = useState([]);
  const [lastVersion, setLastVersion] = useState(0);
  const logRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // helper to push to log
  const addStatusMessage = (message) => {
    const ts = new Date().toLocaleTimeString();
    setStatusMessages(m => [...m.slice(-9), `[${ts}] ${message}`]);
  };

  // generic POST helper
  const post = async (path, body) => {
    try {
      const res = await fetch(`${API_BASE}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (err) {
      addStatusMessage(`❌ ${path} error: ${err.message}`);
      console.error(path, err);
      throw err;
    }
  };

  // Optimized status checking with version tracking
  const checkStatus = async () => {
    try {
      const status = await post('status', { last_version: lastVersion });
      
      if (status.changed) {
        // Only update state when something actually changed
        setCurrentPosition(status.position);
        setLoadReading(status.load);
        setIsMoving(status.moving);
        setIsLocked(status.locked);
        setTorqueEnabled(status.torque);
        setEmergencyStop(status.emergency);
        setLastVersion(status.version);
        
        // Adjust polling frequency based on motor state
        if (status.moving && !pollIntervalRef.current?.fast) {
          startFastPolling();
        } else if (!status.moving && pollIntervalRef.current?.fast) {
          startSlowPolling();
        }
      }
    } catch (err) {
      // Silent fail for status checks to avoid spam
      console.error('Status check failed:', err);
    }
  };

  // Fast polling when motor is moving (100ms)
  const startFastPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current.id);
    }
    pollIntervalRef.current = {
      id: setInterval(checkStatus, 100),
      fast: true
    };
  };

  // Slow polling when motor is idle (1000ms)
  const startSlowPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current.id);
    }
    pollIntervalRef.current = {
      id: setInterval(checkStatus, 10000),
      fast: false
    };
  };

  // Initial status check and start polling
  useEffect(() => {
    checkStatus(); // Get initial state
    startSlowPolling(); // Start with slow polling
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current.id);
      }
    };
  }, []);

  // auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [statusMessages]);

  // Hand selection
  const handleHandSelection = async (hand) => {
    setHandSelection(hand);
    addStatusMessage(`🔄 Switching to ${hand} hand…`);
    try {
      await post('hand', { hand });
      addStatusMessage(`✅ Hand set to ${hand}`);
      // Force status update after hand change
      setTimeout(checkStatus, 100);
    } catch {}
  };

  // Move to target
  const moveToPosition = async () => {
    if (emergencyStop)       return addStatusMessage("❌ Emergency stop engaged");
    if (!torqueEnabled)      return addStatusMessage("❌ Torque disabled");
    if (isLocked)            return addStatusMessage("❌ Motor locked");

    addStatusMessage(`🎯 Moving to ${targetPosition}°`);
    try {
      await post('move', { position: targetPosition, hand: handSelection, velocity });
      addStatusMessage('✅ Move command sent');
      // Switch to fast polling since motor will start moving
      startFastPolling();
    } catch {}
  };

  // Increment / decrement
  const adjustTarget = async (delta) => {
    const newPos = Math.max(-360, Math.min(360, targetPosition + delta));
    setTargetPosition(newPos);
    addStatusMessage(`🎯 Target → ${newPos}°`);
    try {
      await post('move', { position: newPos, hand: handSelection, velocity });
      addStatusMessage('✅ Move command sent');
      startFastPolling();
    } catch {}
  };

  // Presets
  const setPresetPosition = (pos, name) => {
    setTargetPosition(pos);
    addStatusMessage(`📍 Preset: ${name} (${pos}°)`);
    post('move', { position: pos, hand: handSelection, velocity })
      .then(() => {
        addStatusMessage('✅ Move command sent');
        startFastPolling();
      })
      .catch(() => {});
  };

  // Lock toggle
  const toggleLock = async () => {
    const next = !isLocked;
    addStatusMessage(next ? '🔒 Locking…' : '🔓 Unlocking…');
    try {
      await post('lock', { locked: next, hand: handSelection });
      addStatusMessage(next ? '🔒 Locked' : '🔓 Unlocked');
      setTimeout(checkStatus, 100);
    } catch {}
  };

  // Torque toggle
  const toggleTorque = async () => {
    const next = !torqueEnabled;
    addStatusMessage(next ? '⚡ Enabling torque…' : '💤 Disabling torque…');
    try {
      await post('torque', { torque: next, hand: handSelection });
      addStatusMessage(next ? '⚡ Torque Enabled' : '💤 Torque Disabled');
      setTimeout(checkStatus, 100);
    } catch {}
  };

  // Emergency Stop
  const handleEmergencyStop = async () => {
    const next = !emergencyStop;
    addStatusMessage(next ? '🚨 EMERGENCY STOP!' : '▶️ Releasing STOP');
    try {
      await post('emergency', { stop: next, hand: handSelection });
      setTimeout(checkStatus, 100);
      // Emergency stop should immediately go to slow polling
      if (next) {
        startSlowPolling();
      }
    } catch {}
  };

  return (
    <div style={{
      maxWidth: 1200, margin: '0 auto', padding: 20,
      background: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui'
    }}>
      <h1 style={{
        fontSize: 28, fontWeight: 700, color: '#1e293b',
        textAlign: 'center', marginBottom: 24
      }}>Motor Control System</h1>

      {/* Polling indicator */}
      <div style={{
        position: 'fixed', top: 10, right: 10,
        padding: '4px 8px', borderRadius: 4,
        background: pollIntervalRef.current?.fast ? '#22c55e' : '#6b7280',
        color: 'white', fontSize: 12, fontWeight: 500,
        zIndex: 1000
      }}>
        {pollIntervalRef.current?.fast ? 'Fast Poll' : 'Slow Poll'}
      </div>

      {/* Hand Selection */}
      <div style={{
        background: '#eef2ff', border: '1px solid #c7d2fe',
        borderRadius: 12, padding: 16, marginBottom: 20
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 12, fontSize: 16, fontWeight: 600,
          color: '#3730a3'
        }}>
          <Hand size={18}/> Hand Configuration
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {['left','right'].map(hand => (
            <button key={hand}
              onClick={()=>handleHandSelection(hand)}
              style={{
                flex:1, padding:'10px 16px', borderRadius:8,
                border:'none', cursor:'pointer', fontWeight:500,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                background: handSelection===hand ? '#4f46e5':'#fff',
                color:      handSelection===hand ? '#fff':'#4f46e5',
                boxShadow:  handSelection===hand
                  ? '0 2px 4px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.05)'
              }}>
              <Hand size={18} style={hand==='left'?{transform:'scaleX(-1)'}:{}}/>
              {hand.charAt(0).toUpperCase()+hand.slice(1)} Hand
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{
        display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:20
      }}>
        {/* Left column: Position & Velocity */}
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {/* Position */}
          <div style={{
            background:'#eff6ff', border:'1px solid #bfdbfe',
            borderRadius:12, padding:16
          }}>
            <h3 style={{
              fontSize:18,fontWeight:600,color:'#1e40af',margin:'0 0 16px'
            }}>Position Control</h3>
            <label style={{
              display:'block',fontSize:14,fontWeight:500,
              color:'#374151',marginBottom:8
            }}>
              Target (°) – {handSelection.charAt(0).toUpperCase()+handSelection.slice(1)}
            </label>
            <input
              type="number"
              value={targetPosition}
              onChange={e=>setTargetPosition(+e.target.value||0)}
              style={{
                width:'100%',padding:'8px 12px',
                border:'1px solid #d1d5db',borderRadius:6,
                background:'#1f2937',color:'#fff'
              }}
            />
            <input
              type="range"
              value={targetPosition}
              onChange={e=>setTargetPosition(+e.target.value)}
              min={-360} max={360} step={0.1}
              style={{
                width:'100%',height:6,marginTop:8,
                background:'#e5e7eb',borderRadius:3,
                outline:'none',appearance:'none'
              }}
            />
            <button
              onClick={moveToPosition}
              disabled={emergencyStop||!torqueEnabled||isLocked}
              style={{
                width:'100%',padding:12,borderRadius:8,
                border:'none',cursor:emergencyStop||!torqueEnabled||isLocked
                  ?'not-allowed':'pointer',
                fontWeight:500,fontSize:16,margin:'12px 0',
                background:emergencyStop||!torqueEnabled||isLocked
                  ?'#d1d5db':'#2563eb',
                color:emergencyStop||!torqueEnabled||isLocked
                  ?'#6b7280':'#fff',
                display:'flex',justifyContent:'center',gap:8
              }}>
              <Play size={16}/> Move
            </button>
            {/* increments */}
            <div style={{ display:'flex', gap:4 }}>
              {[-1,-0.1,0.1,1].map(delta=>(
                <button key={delta}
                  onClick={()=>adjustTarget(delta)}
                  disabled={emergencyStop}
                  style={{
                    flex:1,padding:8,borderRadius:6,border:'none',
                    background:emergencyStop?'#d1d5db':'#475569',
                    color:'#fff',fontSize:12,fontWeight:500,
                    cursor:emergencyStop?'not-allowed':'pointer',
                    display:'flex',alignItems:'center',justifyContent:'center',gap:4
                  }}>
                  {delta<0?<RotateCcw size={12}/>:null}
                  {delta>0&&delta!==1?'+':''}{delta}°
                  {delta>0? <RotateCw size={12}/> : null}
                </button>
              ))}
            </div>
            {/* presets */}
            <div style={{ marginTop:12 }}>
              <div style={{
                fontSize:14,fontWeight:500,color:'#374151',marginBottom:8
              }}>Presets</div>
              <div style={{
                display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6
              }}>
                {[
                  {pos:0,name:'Home'},
                  {pos:90,name:'Open'},
                  {pos:-90,name:'Closed'}
                ].map(p=>(
                  <button key={p.name}
                    onClick={()=>setPresetPosition(p.pos,p.name)}
                    style={{
                      padding:8,borderRadius:6,border:'none',
                      background:'#bbf7d0',color:'#166534',
                      fontSize:12,fontWeight:500,cursor:'pointer'
                    }}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Velocity */}
          <div style={{
            background:'#fff7ed',border:'1px solid #fed7aa',
            borderRadius:12,padding:16
          }}>
            <h3 style={{
              fontSize:18,fontWeight:600,color:'#c2410c',margin:'0 0 12px'
            }}>Velocity Control</h3>
            <label style={{
              fontSize:14,fontWeight:500,color:'#374151',marginBottom:8
            }}>Speed: {velocity}%</label>
            <input
              type="range"
              value={velocity}
              onChange={e=>setVelocity(+e.target.value)}
              min={1} max={100}
              style={{
                width:'100%',height:6,background:'#e5e7eb',
                borderRadius:3,outline:'none',appearance:'none'
              }}
            />
          </div>
        </div>

        {/* Center */}
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {/* Current */}
          <div style={{
            background:'#f3f4f6',border:'2px solid #d1d5db',
            borderRadius:12,padding:20,textAlign:'center'
          }}>
            <h3 style={{
              fontSize:18,fontWeight:600,color:'#1f2937',
              margin:'0 0 8px'
            }}>Current Position</h3>
            <div style={{
              fontSize:36,fontWeight:700,color:'#2563eb',marginBottom:8
            }}>{currentPosition.toFixed(1)}°</div>
            <div style={{
              display:'inline-block',padding:'4px 12px',
              borderRadius:12,fontSize:14,fontWeight:500,
              background:isMoving?'#fef08a':'#bbf7d0',
              color:    isMoving?'#ca8a04':'#166534',
              marginBottom:4
            }}>
              {isMoving?'Moving':'Stationary'}
            </div>
            <div style={{ fontSize:12,color:'#6b7280' }}>
              {handSelection.charAt(0).toUpperCase()+handSelection.slice(1)} Hand
            </div>
          </div>
          {/* Load */}
          <div style={{
            background:'#faf5ff',border:'1px solid #e9d5ff',
            borderRadius:12,padding:16,textAlign:'center'
          }}>
            <h3 style={{
              fontSize:18,fontWeight:600,color:'#7c3aed',margin:'0 0 12px'
            }}>Load Cell Reading</h3>
            <div style={{
              fontSize:24,fontWeight:700,color:'#7c3aed',marginBottom:12
            }}>{loadReading.toFixed(2)} N</div>
            <div style={{
              width:'100%',background:'#e5e7eb',
              borderRadius:6,height:8,overflow:'hidden'
            }}>
              <div style={{
                background:'#7c3aed',height:'100%',
                borderRadius:6,
                width:`${Math.min(loadReading/50*100,100)}%`,
                transition:'width .3s'
              }}/>
            </div>
          </div>
          {/* Motor Status */}
          <div style={{
            background:'#f9fafb',border:'1px solid #e5e7eb',
            borderRadius:12,padding:16
          }}>
            <h3 style={{
              fontSize:18,fontWeight:600,color:'#1f2937',
              margin:'0 0 16px'
            }}>Motor Status</h3>
            <div style={{
              display:'grid',gridTemplateColumns:'1fr 1fr',gap:16
            }}>
              {/* Lock */}
              <div style={{ textAlign:'center' }}>
                <div style={{
                  fontSize:14,fontWeight:500,color:'#374151',marginBottom:8
                }}>Lock Status</div>
                <button onClick={toggleLock} style={{
                  width:'100%',padding:'8px 12px',borderRadius:6,
                  border:'none',cursor:'pointer',fontSize:14,
                  fontWeight:500,display:'flex',alignItems:'center',
                  justifyContent:'center',gap:6,
                  background:isLocked?'#fecaca':'#bbf7d0',
                  color:isLocked?'#b91c1c':'#166534'
                }}>
                  {isLocked?<Lock size={14}/>:<Unlock size={14}/>}
                  {isLocked?'Locked':'Free'}
                </button>
              </div>
              {/* Torque */}
              <div style={{ textAlign:'center' }}>
                <div style={{
                  fontSize:14,fontWeight:500,color:'#374151',marginBottom:8
                }}>Torque Control</div>
                <label style={{
                  width:'100%',padding:'8px 12px',borderRadius:6,
                  background:'#fff',border:'1px solid #d1d5db',
                  cursor:'pointer',display:'flex',alignItems:'center',
                  justifyContent:'center',gap:6
                }}>
                  <input type="checkbox"
                    checked={torqueEnabled}
                    onChange={toggleTorque}
                    style={{accentColor:'#2563eb',width:16,height:16}}/>
                  <span style={{
                    fontSize:14,fontWeight:500,
                    color:torqueEnabled?'#16a34a':'#dc2626'
                  }}>
                    {torqueEnabled?'Enabled':'Disabled'}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right */}
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {/* E-Stop */}
          <div style={{
            background:'#fee2e2',border:'1px solid #fecaca',
            borderRadius:12,padding:16
          }}>
            <button onClick={handleEmergencyStop} style={{
              width:'100%',padding:16,borderRadius:8,
              border:emergencyStop?'none':'2px solid #f87171',
              cursor:'pointer',fontWeight:700,fontSize:16,
              display:'flex',alignItems:'center',justifyContent:'center',
              gap:8,
              background:emergencyStop?'#dc2626':'#fee2e2',
              color:emergencyStop?'#fff':'#b91c1c'
            }}>
              {emergencyStop?<Power size={20}/>:<AlertTriangle size={20}/>}
              {emergencyStop?'RESUME':'EMERGENCY STOP'}
            </button>
          </div>
          {/* Log */}
          <div style={{
            background:'#f9fafb',border:'1px solid #e5e7eb',
            borderRadius:12,padding:16
          }}>
            <h3 style={{
              fontSize:18,fontWeight:600,color:'#1f2937',margin:'0 0 12px'
            }}>Status Log</h3>
            <div ref={logRef} style={{
              background:'#111827',color:'#4ade80',
              padding:12,borderRadius:8,height:140,
              overflowY:'auto',fontSize:12,fontFamily:'monospace'
            }}>
              {statusMessages.length===0
                ? <div style={{ color:'#6b7280' }}>System ready…</div>
                : statusMessages.map((m,i)=><div key={i} style={{marginBottom:4}}>{m}</div>)
              }
            </div>
          </div>
          {/* Sys Info */}
          <div style={{
            background:'#eff6ff',border:'1px solid #bfdbfe',
            borderRadius:12,padding:16
          }}>
            <h3 style={{
              fontSize:18,fontWeight:600,color:'#1e40af',margin:'0 0 12px'
            }}>System Info</h3>
            <div style={{ fontSize:14,lineHeight:1.6,color:'#374151' }}>
              <div><strong>Active:</strong> {handSelection.charAt(0).toUpperCase()+handSelection.slice(1)} Hand</div>
              <div>Range: -360° to +360°</div>
              <div>Precision: ±0.1°</div>
              <div>Max Speed: 100%</div>
              <div style={{
                fontWeight:600,
                color:emergencyStop?'#dc2626':'#16a34a',
                marginTop:8
              }}>
                Status: {emergencyStop?'STOPPED':'OPERATIONAL'}
              </div>
              <div style={{ fontSize:12, color:'#6b7280', marginTop:8 }}>
                Poll Rate: {pollIntervalRef.current?.fast ? '100ms' : '1000ms'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
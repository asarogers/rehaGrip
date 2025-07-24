import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, RotateCcw, RotateCw, AlertTriangle, Power, Lock, Unlock, Hand } from 'lucide-react';

const MotorControlGUI = () => {
  const [targetPosition, setTargetPosition] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [velocity, setVelocity] = useState(50);
  const [isLocked, setIsLocked] = useState(false);
  const [torqueEnabled, setTorqueEnabled] = useState(true);
  const [loadReading, setLoadReading] = useState(0.58);
  const [isMoving, setIsMoving] = useState(false);
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [handSelection, setHandSelection] = useState('right');
  const [statusMessages, setStatusMessages] = useState([]);
  const logRef = useRef(null);

  // Simulate motor movement
  useEffect(() => {
    if (!isMoving || emergencyStop) return;

    const interval = setInterval(() => {
      setCurrentPosition(prev => {
        const diff = targetPosition - prev;
        const step = Math.sign(diff) * Math.min(Math.abs(diff), velocity / 10);
        const newPos = prev + step;

        if (Math.abs(targetPosition - newPos) < 0.1) {
          setIsMoving(false);
          addStatusMessage(`Position reached: ${targetPosition.toFixed(1)}° (${handSelection} hand)`);
          return targetPosition;
        }
        return newPos;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isMoving, targetPosition, velocity, emergencyStop, handSelection]);

  // Simulate load cell readings
  useEffect(() => {
    const interval = setInterval(() => {
      if (!emergencyStop) {
        const baseLoad = isMoving ? Math.random() * 20 + 10 : Math.random() * 5 + 0.5;
        setLoadReading(baseLoad);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isMoving, emergencyStop]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [statusMessages]);

  const addStatusMessage = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setStatusMessages(prev => [...prev.slice(-9), `[${timestamp}] ${message}`]);
  };

  const handleHandSelection = (hand) => {
    setHandSelection(hand);
    addStatusMessage(`Hand selection changed to: ${hand.toUpperCase()} hand`);
    setTargetPosition(0);
    setCurrentPosition(0);
    addStatusMessage(`Position reset to home for ${hand} hand configuration`);
  };

  const moveToPosition = () => {
    if (emergencyStop) {
      addStatusMessage("Emergency stop active - cannot move");
      return;
    }
    if (!torqueEnabled) {
      addStatusMessage("Torque disabled - cannot move");
      return;
    }
    if (isLocked) {
      addStatusMessage("Motor locked - cannot move");
      return;
    }

    setIsMoving(true);
    addStatusMessage(`Moving to position: ${targetPosition}° (${handSelection} hand)`);
  };

  const incrementPosition = (delta) => {
    if (emergencyStop) return;
    const newPos = Math.max(-360, Math.min(360, targetPosition + delta));
    setTargetPosition(newPos);
    addStatusMessage(`Target position adjusted: ${newPos}° (${handSelection} hand)`);
  };

  const setPresetPosition = (position, name) => {
    setTargetPosition(position);
    addStatusMessage(`Preset selected: ${name} (${position}°) for ${handSelection} hand`);
  };

  const handleEmergencyStop = () => {
    setEmergencyStop(!emergencyStop);
    setIsMoving(false);
    if (!emergencyStop) {
      addStatusMessage("EMERGENCY STOP ACTIVATED");
    } else {
      addStatusMessage("Emergency stop released");
    }
  };

  const toggleLock = () => {
    setIsLocked(!isLocked);
    addStatusMessage(isLocked ? "Motor unlocked" : "Motor locked");
  };

  const toggleTorque = () => {
    setTorqueEnabled(!torqueEnabled);
    addStatusMessage(torqueEnabled ? "Torque disabled" : "Torque enabled");
  };

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px',
      background: '#f8fafc',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <h1 style={{
        fontSize: '28px',
        fontWeight: '700',
        color: '#1e293b',
        textAlign: 'center',
        marginBottom: '24px'
      }}>
        Motor Control System
      </h1>

      {/* Hand Selection */}
      <div style={{
        background: '#eef2ff',
        border: '1px solid #c7d2fe',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
          fontSize: '16px',
          fontWeight: '600',
          color: '#3730a3'
        }}>
          <Hand size={18} />
          <span>Hand Configuration</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => handleHandSelection('left')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: handSelection === 'left' ? '#4f46e5' : '#ffffff',
              color: handSelection === 'left' ? '#ffffff' : '#4f46e5',
              boxShadow: handSelection === 'left' ? '0 2px 4px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.2s'
            }}>
            <Hand size={18} style={{ transform: 'scaleX(-1)' }} />
            <span>Left Hand</span>
          </button>
          <button
            onClick={() => handleHandSelection('right')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: handSelection === 'right' ? '#4f46e5' : '#ffffff',
              color: handSelection === 'right' ? '#ffffff' : '#4f46e5',
              boxShadow: handSelection === 'right' ? '0 2px 4px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.2s'
            }}>
            <Hand size={18} />
            <span>Right Hand</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '20px'
      }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Position Control */}
          <div style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1e40af',
              marginBottom: '16px',
              marginTop: '0'
            }}>
              Position Control
            </h3>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Target Position (°) - {handSelection.charAt(0).toUpperCase() + handSelection.slice(1)} Hand
              </label>
              <input
                type="number"
                value={targetPosition}
                onChange={(e) => setTargetPosition(parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  background: '#1f2937',
                  color: '#ffffff'
                }}
                min="-360"
                max="360"
                step="0.1"
              />
              <input
                type="range"
                value={targetPosition}
                onChange={(e) => setTargetPosition(parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  height: '6px',
                  marginTop: '8px',
                  background: '#e5e7eb',
                  borderRadius: '3px',
                  outline: 'none',
                  appearance: 'none'
                }}
                min="-360"
                max="360"
                step="0.1"
              />
            </div>

            <button
              onClick={moveToPosition}
              disabled={emergencyStop || !torqueEnabled || isLocked}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                cursor: (emergencyStop || !torqueEnabled || isLocked) ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: (emergencyStop || !torqueEnabled || isLocked) ? '#d1d5db' : '#2563eb',
                color: (emergencyStop || !torqueEnabled || isLocked) ? '#6b7280' : '#ffffff',
                marginBottom: '12px'
              }}>
              <Play size={16} />
              <span>Move to Position</span>
            </button>

            {/* Increment buttons */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
              <button
                onClick={() => incrementPosition(-1)}
                disabled={emergencyStop}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: emergencyStop ? 'not-allowed' : 'pointer',
                  background: emergencyStop ? '#d1d5db' : '#475569',
                  color: emergencyStop ? '#6b7280' : '#ffffff',
                  fontSize: '12px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}>
                <RotateCcw size={12} />
                <span>-1°</span>
              </button>
              <button
                onClick={() => incrementPosition(-0.1)}
                disabled={emergencyStop}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: emergencyStop ? 'not-allowed' : 'pointer',
                  background: emergencyStop ? '#d1d5db' : '#64748b',
                  color: emergencyStop ? '#6b7280' : '#ffffff',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                -0.1°
              </button>
              <button
                onClick={() => incrementPosition(0.1)}
                disabled={emergencyStop}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: emergencyStop ? 'not-allowed' : 'pointer',
                  background: emergencyStop ? '#d1d5db' : '#64748b',
                  color: emergencyStop ? '#6b7280' : '#ffffff',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                +0.1°
              </button>
              <button
                onClick={() => incrementPosition(1)}
                disabled={emergencyStop}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: emergencyStop ? 'not-allowed' : 'pointer',
                  background: emergencyStop ? '#d1d5db' : '#475569',
                  color: emergencyStop ? '#6b7280' : '#ffffff',
                  fontSize: '12px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}>
                <RotateCw size={12} />
                <span>+1°</span>
              </button>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Preset Positions
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                <button
                  onClick={() => setPresetPosition(0, "Home")}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: '#bbf7d0',
                    color: '#166534',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                  Home
                </button>
                <button
                  onClick={() => setPresetPosition(90, "Open")}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: '#bbf7d0',
                    color: '#166534',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                  Open
                </button>
                <button
                  onClick={() => setPresetPosition(-90, "Closed")}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: '#bbf7d0',
                    color: '#166534',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                  Closed
                </button>
              </div>
            </div>
          </div>

          {/* Velocity Control */}
          <div style={{
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#c2410c',
              marginBottom: '12px',
              marginTop: '0'
            }}>
              Velocity Control
            </h3>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Speed: {velocity}%
            </label>
            <input
              type="range"
              value={velocity}
              onChange={(e) => setVelocity(parseInt(e.target.value))}
              style={{
                width: '100%',
                height: '6px',
                background: '#e5e7eb',
                borderRadius: '3px',
                outline: 'none',
                appearance: 'none'
              }}
              min="1"
              max="100"
            />
          </div>
        </div>

        {/* Center Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Current Position */}
          <div style={{
            background: '#f3f4f6',
            border: '2px solid #d1d5db',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '8px',
              marginTop: '0'
            }}>
              Current Position
            </h3>
            <div style={{
              fontSize: '36px',
              fontWeight: '700',
              color: '#2563eb',
              marginBottom: '8px'
            }}>
              {currentPosition.toFixed(1)}°
            </div>
            <div style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '500',
              background: isMoving ? '#fef08a' : '#bbf7d0',
              color: isMoving ? '#ca8a04' : '#166534',
              marginBottom: '4px'
            }}>
              {isMoving ? 'Moving' : 'Stationary'}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6b7280'
            }}>
              {handSelection.charAt(0).toUpperCase() + handSelection.slice(1)} Hand
            </div>
          </div>

          {/* Load Cell Reading */}
          <div style={{
            background: '#faf5ff',
            border: '1px solid #e9d5ff',
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'center'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#7c3aed',
              marginBottom: '12px',
              marginTop: '0'
            }}>
              Load Cell Reading
            </h3>
            <div style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#7c3aed',
              marginBottom: '12px'
            }}>
              {loadReading.toFixed(2)} N
            </div>
            <div style={{
              width: '100%',
              background: '#e5e7eb',
              borderRadius: '6px',
              height: '8px',
              overflow: 'hidden'
            }}>
              <div style={{
                background: '#7c3aed',
                height: '100%',
                borderRadius: '6px',
                width: `${Math.min(loadReading / 50 * 100, 100)}%`,
                transition: 'width 0.3s'
              }} />
            </div>
          </div>

          {/* Motor Status */}
          <div style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '16px',
              marginTop: '0'
            }}>
              Motor Status
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Lock Status
                </div>
                <button
                  onClick={toggleLock}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: isLocked ? '#fecaca' : '#bbf7d0',
                    color: isLocked ? '#b91c1c' : '#166534'
                  }}>
                  {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                  <span>{isLocked ? 'Locked' : 'Free'}</span>
                </button>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Torque Control
                </div>
                <label style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: '#ffffff',
                  border: '1px solid #d1d5db',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}>
                  <input
                    type="checkbox"
                    checked={torqueEnabled}
                    onChange={toggleTorque}
                    style={{
                      width: '16px',
                      height: '16px',
                      accentColor: '#2563eb'
                    }}
                  />
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: torqueEnabled ? '#16a34a' : '#dc2626'
                  }}>
                    {torqueEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Emergency Stop */}
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <button
              onClick={handleEmergencyStop}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '8px',
                border: emergencyStop ? 'none' : '2px solid #f87171',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: emergencyStop ? '#dc2626' : '#fee2e2',
                color: emergencyStop ? '#ffffff' : '#b91c1c'
              }}>
              {emergencyStop ? <Power size={20} /> : <AlertTriangle size={20} />}
              <span>{emergencyStop ? 'RESUME' : 'EMERGENCY STOP'}</span>
            </button>
          </div>

          {/* Status Log */}
          <div style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '12px',
              marginTop: '0'
            }}>
              Status Log
            </h3>
            <div
              ref={logRef}
              style={{
                background: '#111827',
                color: '#4ade80',
                padding: '12px',
                borderRadius: '8px',
                height: '140px',
                overflowY: 'auto',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}>
              {statusMessages.length === 0 ? (
                <div style={{ color: '#6b7280' }}>System ready...</div>
              ) : (
                statusMessages.map((message, index) => (
                  <div key={index} style={{ marginBottom: '4px' }}>
                    {message}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* System Info */}
          <div style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1e40af',
              marginBottom: '12px',
              marginTop: '0'
            }}>
              System Info
            </h3>
            <div style={{
              fontSize: '14px',
              lineHeight: '1.6',
              color: '#374151'
            }}>
              <div><strong>Active:</strong> {handSelection.charAt(0).toUpperCase() + handSelection.slice(1)} Hand</div>
              <div>Range: -360° to +360°</div>
              <div>Precision: ±0.1°</div>
              <div>Max Speed: 100%</div>
              <div style={{
                fontWeight: '600',
                color: emergencyStop ? '#dc2626' : '#16a34a',
                marginTop: '8px'
              }}>
                Status: {emergencyStop ? 'STOPPED' : 'OPERATIONAL'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MotorControlGUI;
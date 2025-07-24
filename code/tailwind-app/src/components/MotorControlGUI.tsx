import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, RotateCcw, RotateCw, AlertTriangle, Power, Lock, Unlock, Hand } from 'lucide-react';

const MotorControlGUI = () => {
  const [targetPosition, setTargetPosition] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [velocity, setVelocity] = useState(50);
  const [isLocked, setIsLocked] = useState(false);
  const [torqueEnabled, setTorqueEnabled] = useState(true);
  const [loadReading, setLoadReading] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [handSelection, setHandSelection] = useState('right'); // 'left' or 'right'
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
        const baseLoad = isMoving ? Math.random() * 20 + 10 : Math.random() * 5;
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
    // Reset position when switching hands for safety
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
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          Motor Control System
        </h1>
        
        {/* Hand Selection */}
        <div className="mb-6 bg-indigo-50 p-4 rounded-lg border border-indigo-200">
          <h2 className="text-lg font-semibold text-indigo-800 mb-3 flex items-center space-x-2">
            <Hand size={20} />
            <span>Hand Configuration</span>
          </h2>
          <div className="flex space-x-4">
            <button
              onClick={() => handleHandSelection('left')}
              className={`flex-1 px-4 py-3 rounded-md font-medium flex items-center justify-center space-x-2 transition-all ${
                handSelection === 'left'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-indigo-600 border-2 border-indigo-300 hover:bg-indigo-50'
              }`}
            >
              <Hand size={20} className="transform scale-x-[-1]" />
              <span>Left Hand</span>
            </button>
            <button
              onClick={() => handleHandSelection('right')}
              className={`flex-1 px-4 py-3 rounded-md font-medium flex items-center justify-center space-x-2 transition-all ${
                handSelection === 'right'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-indigo-600 border-2 border-indigo-300 hover:bg-indigo-50'
              }`}
            >
              <Hand size={20} />
              <span>Right Hand</span>
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Position Control */}
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h2 className="text-xl font-semibold text-blue-800 mb-4">Position Control</h2>
              
              {/* Target Position Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Target Position (°) - {handSelection.charAt(0).toUpperCase() + handSelection.slice(1)} Hand
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={targetPosition}
                    onChange={(e) => setTargetPosition(parseFloat(e.target.value) || 0)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="-360"
                    max="360"
                    step="0.1"
                  />
                </div>
                <input
                  type="range"
                  value={targetPosition}
                  onChange={(e) => setTargetPosition(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  min="-360"
                  max="360"
                  step="0.1"
                />
              </div>

              {/* Move Button */}
              <button
                onClick={moveToPosition}
                disabled={emergencyStop || !torqueEnabled || isLocked}
                className={`w-full mt-4 px-4 py-3 rounded-md font-medium flex items-center justify-center space-x-2 ${
                  emergencyStop || !torqueEnabled || isLocked
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <Play size={20} />
                <span>Move to Position</span>
              </button>

              {/* Increment/Decrement */}
              <div className="flex space-x-2 mt-4">
                <button
                  onClick={() => incrementPosition(-1)}
                  disabled={emergencyStop}
                  className="flex-1 px-3 py-2 bg-slate-600 hover:bg-slate-700 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-md flex items-center justify-center space-x-1 font-medium shadow-sm"
                >
                  <RotateCcw size={16} />
                  <span>-1°</span>
                </button>
                <button
                  onClick={() => incrementPosition(-0.1)}
                  disabled={emergencyStop}
                  className="flex-1 px-3 py-2 bg-slate-500 hover:bg-slate-600 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-md text-sm font-medium shadow-sm"
                >
                  -0.1°
                </button>
                <button
                  onClick={() => incrementPosition(0.1)}
                  disabled={emergencyStop}
                  className="flex-1 px-3 py-2 bg-slate-500 hover:bg-slate-600 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-md text-sm font-medium shadow-sm"
                >
                  +0.1°
                </button>
                <button
                  onClick={() => incrementPosition(1)}
                  disabled={emergencyStop}
                  className="flex-1 px-3 py-2 bg-slate-600 hover:bg-slate-700 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-md flex items-center justify-center space-x-1 font-medium shadow-sm"
                >
                  <RotateCw size={16} />
                  <span>+1°</span>
                </button>
              </div>

              {/* Preset Buttons */}
              <div className="mt-4 space-y-2">
                <label className="block text-sm font-medium text-gray-700">Preset Positions</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setPresetPosition(0, "Rest")}
                    className="px-3 py-2 bg-green-200 hover:bg-green-300 text-green-800 rounded-md text-sm font-medium"
                  >
                    Home
                  </button>
                  <button
                    onClick={() => setPresetPosition(90, "Open")}
                    className="px-3 py-2 bg-green-200 hover:bg-green-300 text-green-800 rounded-md text-sm font-medium"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => setPresetPosition(-90, "Closed")}
                    className="px-3 py-2 bg-green-200 hover:bg-green-300 text-green-800 rounded-md text-sm font-medium"
                  >
                    Closed
                  </button>
                </div>
              </div>
            </div>

            {/* Velocity Control */}
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <h3 className="text-lg font-semibold text-orange-800 mb-3">Velocity Control</h3>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Speed: {velocity}%
                </label>
                <input
                  type="range"
                  value={velocity}
                  onChange={(e) => setVelocity(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  min="1"
                  max="100"
                />
              </div>
            </div>
          </div>

          {/* Center Panel - Status Display */}
          <div className="space-y-6">
            {/* Current Position Display */}
            <div className="bg-gray-100 p-6 rounded-lg border-2 border-gray-300">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Current Position</h3>
              <div className="text-4xl font-bold text-blue-600 text-center">
                {currentPosition.toFixed(1)}°
              </div>
              <div className="text-center mt-2">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  isMoving ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'
                }`}>
                  {isMoving ? 'Moving' : 'Stationary'}
                </span>
                <div className="text-xs text-gray-600 mt-1">
                  {handSelection.charAt(0).toUpperCase() + handSelection.slice(1)} Hand
                </div>
              </div>
            </div>

            {/* Load/Force Display */}
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h3 className="text-lg font-semibold text-purple-800 mb-3">Load Cell Reading</h3>
              <div className="text-2xl font-bold text-purple-600 text-center">
                {loadReading.toFixed(2)} N
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mt-3">
                <div 
                  className="bg-purple-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(loadReading / 50 * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Motor Status */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Motor Status</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-700 mb-2">Lock Status</div>
                  <button
                    onClick={toggleLock}
                    className={`w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium ${
                      isLocked 
                        ? 'bg-red-200 text-red-800 hover:bg-red-300' 
                        : 'bg-green-200 text-green-800 hover:bg-green-300'
                    }`}
                  >
                    {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                    <span>{isLocked ? 'Locked' : 'Free'}</span>
                  </button>
                </div>
                
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-700 mb-2">Torque Control</div>
                  <label className="w-full flex items-center justify-center space-x-2 cursor-pointer px-3 py-2 rounded-md bg-white border border-gray-300 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={torqueEnabled}
                      onChange={toggleTorque}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className={`text-sm font-medium ${
                      torqueEnabled ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {torqueEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Controls & Log */}
          <div className="space-y-6">
            {/* Emergency Stop */}
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <button
                onClick={handleEmergencyStop}
                className={`w-full px-4 py-4 rounded-md font-bold text-lg flex items-center justify-center space-x-2 ${
                  emergencyStop
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-red-100 hover:bg-red-200 text-red-800 border-2 border-red-400'
                }`}
              >
                {emergencyStop ? <Power size={24} /> : <AlertTriangle size={24} />}
                <span>{emergencyStop ? 'RESUME' : 'EMERGENCY STOP'}</span>
              </button>
            </div>

            {/* Status Log */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Status Log</h3>
              <div 
                ref={logRef}
                className="bg-black text-green-400 p-3 rounded-md h-40 overflow-y-auto text-sm font-mono"
              >
                {statusMessages.length === 0 ? (
                  <div className="text-gray-500">System ready...</div>
                ) : (
                  statusMessages.map((message, index) => (
                    <div key={index} className="mb-1">
                      {message}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* System Info */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-800 mb-3">System Info</h3>
              <div className="text-sm space-y-1">
                <div><strong>Active:</strong> {handSelection.charAt(0).toUpperCase() + handSelection.slice(1)} Hand</div>
                <div>Range: -360° to +360°</div>
                <div>Precision: ±0.1°</div>
                <div>Max Speed: 100%</div>
                <div className={`font-medium ${
                  emergencyStop ? 'text-red-600' : 'text-green-600'
                }`}>
                  Status: {emergencyStop ? 'STOPPED' : 'OPERATIONAL'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MotorControlGUI;
import React, { useState, useRef } from "react";
import {
  Play,
  RotateCcw,
  RotateCw,
  AlertTriangle,
  Power,
  Lock,
  Unlock,
  Hand,
} from "lucide-react";

const API_BASE = "http://localhost:3001/api/motor";

export default function MotorControlGUI() {
  const [targetPosition, setTargetPosition] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [velocity, setVelocity] = useState(50);
  const [isLocked, setIsLocked] = useState(false);
  const [torqueEnabled, setTorqueEnabled] = useState(true);
  const [loadReading, setLoadReading] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [handSelection, setHandSelection] = useState("right");
  const [statusMessages, setStatusMessages] = useState([]);
  const logRef = useRef(null);

  // helper to push to log
  const addStatusMessage = (message) => {
    const ts = new Date().toLocaleTimeString();
    setStatusMessages((m) => [...m.slice(-9), `[${ts}] ${message}`]);
  };

  // generic POST helper
  const post = async (path, body = {}) => {
    try {
      const res = await fetch(`${API_BASE}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (err) {
      addStatusMessage(` ${path} error: ${err.message}`);
      console.error(path, err);
      throw err;
    }
  };

  const toggleEmergencyStop = async () => {
    try {
      const newState = !emergencyStop;
      await post("emergency", { stop: newState, hand: handSelection });
      setEmergencyStop(newState);
      addStatusMessage(
        newState
          ? " EMERGENCY STOP engaged — motor torque disabled"
          : " Emergency stop cleared — motor torque enabled"
      );
      // Refresh status
      requestStatus();
    } catch (err) {}
  };

  const moveToPosition = async () => {
    if (emergencyStop) return addStatusMessage("Emergency stop engaged");
    if (!torqueEnabled) return addStatusMessage("Torque disabled");
    if (isLocked) return addStatusMessage("Motor locked");

    addStatusMessage(` Moving to ${targetPosition}°`);
    try {
      await post("move", {
        position: targetPosition,
        hand: handSelection,
        velocity,
      });
      addStatusMessage(" Move command sent");
      requestStatus(); // Always fetch updated status after move
    } catch {}
  };

  // Request status from backend (on demand)
  const requestStatus = async () => {
    try {
      const status = await post("status");
      setCurrentPosition(status.position || 0);
      setLoadReading(status.load || 0);
      setIsMoving(status.moving || false);
      setIsLocked(status.locked || false);
      setTorqueEnabled(status.torque !== undefined ? status.torque : true);
      setEmergencyStop(status.emergency || false);
      addStatusMessage(" Status refreshed");
    } catch (err) {}
  };

  // auto-scroll log
  React.useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [statusMessages]);

  // -- UI (all controls except Move/Status are inert) --
  return (
    <div
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: 20,
        background: "#f8fafc",
        minHeight: "100vh",
        fontFamily: "system-ui",
      }}
    >
      <h1
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: "#1e293b",
          textAlign: "center",
          marginBottom: 24,
        }}
      >
        Motor Control System
      </h1>

      {/* Hand Selection (UI only) */}
      <div
        style={{
          background: "#eef2ff",
          border: "1px solid #c7d2fe",
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
            fontSize: 16,
            fontWeight: 600,
            color: "#3730a3",
          }}
        >
          <Hand size={18} /> Hand Configuration
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {["left", "right"].map((hand) => (
            <button
              key={hand}
              onClick={async () => {
                if (handSelection !== hand) {
                  setHandSelection(hand);
                  addStatusMessage(`Switching to ${hand} hand...`);
                  try {
                    await post("hand", { hand });
                    requestStatus();
                    addStatusMessage(`Hand switched to ${hand}.`);
                  } catch (err) {
                    addStatusMessage("Hand switch failed");
                  }
                }
              }}
              style={{
                flex: 1,
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                cursor: handSelection === hand ? "default" : "pointer",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: handSelection === hand ? "#4f46e5" : "#fff",
                color: handSelection === hand ? "#fff" : "#4f46e5",
                boxShadow:
                  handSelection === hand
                    ? "0 2px 4px rgba(0,0,0,0.1)"
                    : "0 1px 2px rgba(0,0,0,0.05)",
              }}
              disabled={handSelection === hand}
            >
              <Hand
                size={18}
                style={hand === "left" ? { transform: "scaleX(-1)" } : {}}
              />
              {hand.charAt(0).toUpperCase() + hand.slice(1)} Hand
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 20,
        }}
      >
        {/* Left column: Position & Velocity */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#1e40af",
                margin: "0 0 16px",
              }}
            >
              Position Control
            </h3>
            <label
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 500,
                color: "#374151",
                marginBottom: 8,
              }}
            >
              Target (°) –{" "}
              {handSelection.charAt(0).toUpperCase() + handSelection.slice(1)}
            </label>
            <input
              type="number"
              value={targetPosition}
              onChange={(e) => setTargetPosition(+e.target.value || 0)}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                background: "#1f2937",
                color: "#fff",
              }}
            />
            <input
              type="range"
              value={targetPosition}
              onChange={(e) => setTargetPosition(+e.target.value)}
              min={-60}
              max={60}
              step={1}
              style={{
                width: "100%",
                height: 6,
                marginTop: 8,
                background: "#e5e7eb",
                borderRadius: 3,
                outline: "none",
                appearance: "none",
              }}
            />

            <button
              onClick={moveToPosition}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 16,
                margin: "12px 0",
                background: "#2563eb",
                color: "#fff",
                display: "flex",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Play size={16} /> Move
            </button>
            {/* increments (UI only) */}
            <div style={{ display: "flex", gap: 4 }}>
              {[-5, -1, 1, 5].map((delta) => (
                <button
                  key={delta}
                  onClick={async () => {
                    // Update the value first
                    setTargetPosition((prev) => {
                      // Clamp between -60 and 60
                      const newVal = Math.max(-60, Math.min(60, prev + delta));
                      // Fire move command with new value
                      post("move", {
                        position: newVal,
                        hand: handSelection,
                        velocity,
                      })
                        .then(() => {
                          addStatusMessage(`Moved to ${newVal}°`);
                          requestStatus();
                        })
                        .catch(() => {
                          addStatusMessage("Increment move failed");
                        });
                      return newVal;
                    });
                  }}
                  style={{
                    flex: 1,
                    padding: 8,
                    borderRadius: 6,
                    border: "none",
                    background: "#d1d5db",
                    color: "#4b5563",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  {delta < 0 ? <RotateCcw size={12} /> : null}
                  {delta > 0 && delta !== 1 ? "+" : ""}
                  {delta}°{delta > 0 ? <RotateCw size={12} /> : null}
                </button>
              ))}
            </div>
            {/* PRESETS -- now clickable! */}
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#374151",
                  marginBottom: 8,
                }}
              >
                Presets
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 6,
                }}
              >
                {[
                  { pos: 0, name: "Neutral" },
                  { pos: 45, name: "Open" },
                  { pos: -45, name: "Closed" },
                ].map((p) => (
                  <button
                    key={p.name}
                    onClick={async () => {
                      setTargetPosition(p.pos);
                      addStatusMessage(
                        `Preset: Moving to "${p.name}" (${p.pos}°)`
                      );
                      try {
                        await post("move", {
                          position: p.pos,
                          hand: handSelection,
                          velocity,
                        });
                        addStatusMessage(" Move command sent");
                        requestStatus();
                      } catch (err) {
                        addStatusMessage("Preset move failed");
                      }
                    }}
                    style={{
                      padding: 8,
                      borderRadius: 6,
                      border: "none",
                      background:
                        targetPosition === p.pos ? "#6366f1" : "#d1d5db",
                      color: targetPosition === p.pos ? "#fff" : "#374151",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.1s",
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Velocity */}
          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#c2410c",
                margin: "0 0 12px",
              }}
            >
              Velocity Control
            </h3>
            <label
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "#374151",
                marginBottom: 8,
              }}
            >
              Speed: {velocity}%
            </label>
            <input
              type="range"
              value={velocity}
              onChange={(e) => setVelocity(+e.target.value)}
              min={1}
              max={100}
              style={{
                width: "100%",
                height: 6,
                background: "#e5e7eb",
                borderRadius: 3,
                outline: "none",
                appearance: "none",
              }}
            />
          </div>
        </div>

        {/* Center */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Current */}
          <div
            style={{
              background: "#f3f4f6",
              border: "2px solid #d1d5db",
              borderRadius: 12,
              padding: 20,
              textAlign: "center",
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#1f2937",
                margin: "0 0 8px",
              }}
            >
              Current Position
            </h3>
            <div
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: "#2563eb",
                marginBottom: 8,
              }}
            >
              {currentPosition.toFixed(1)}°
            </div>
            <div
              style={{
                display: "inline-block",
                padding: "4px 12px",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 500,
                background: isMoving ? "#fef08a" : "#bbf7d0",
                color: isMoving ? "#ca8a04" : "#166534",
                marginBottom: 4,
              }}
            >
              {isMoving ? "Moving" : "Stationary"}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              {handSelection.charAt(0).toUpperCase() + handSelection.slice(1)}{" "}
              Hand
            </div>
          </div>
          {/* Load */}
          <div
            style={{
              background: "#faf5ff",
              border: "1px solid #e9d5ff",
              borderRadius: 12,
              padding: 16,
              textAlign: "center",
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#7c3aed",
                margin: "0 0 12px",
              }}
            >
              Load Cell Reading
            </h3>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#7c3aed",
                marginBottom: 12,
              }}
            >
              {loadReading.toFixed(2)} N
            </div>
            <div
              style={{
                width: "100%",
                background: "#e5e7eb",
                borderRadius: 6,
                height: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background: "#7c3aed",
                  height: "100%",
                  borderRadius: 6,
                  width: `${Math.min((loadReading / 50) * 100, 100)}%`,
                  transition: "width .3s",
                }}
              />
            </div>
          </div>
          {/* Motor Status */}
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#1f2937",
                margin: "0 0 16px",
              }}
            >
              Motor Status
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              {/* Lock */}
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#374151",
                    marginBottom: 8,
                  }}
                >
                  Lock Status
                </div>
                <button
                  disabled
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "none",
                    cursor: "not-allowed",
                    fontSize: 14,
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    background: torqueEnabled ? "#fecaca" : "#bbf7d0",
                    color: torqueEnabled ? "#b91c1c" : "#166534",
                  }}
                >
                  {torqueEnabled ? <Lock size={14} /> : <Unlock size={14} />}
                  {torqueEnabled ? "Locked" : "Free"}
                </button>
              </div>
              {/* Torque */}
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#374151",
                    marginBottom: 8,
                  }}
                >
                  Torque Control
                </div>
                <label
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: "#fff",
                    border: "1px solid #d1d5db",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={torqueEnabled}
                    onChange={async (e) => {
                      const newTorque = e.target.checked;
                      setTorqueEnabled(newTorque);
                      addStatusMessage(
                        newTorque ? "Torque enabled" : "Torque disabled"
                      );
                      try {
                        await post("torque", {
                          torque: newTorque,
                          hand: handSelection,
                        });
                        requestStatus();
                      } catch {
                        addStatusMessage("Torque toggle failed");
                      }
                    }}
                    style={{ accentColor: "#2563eb", width: 16, height: 16 }}
                  />
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: torqueEnabled ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {torqueEnabled ? "Enabled" : "Disabled"}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* E-Stop */}
          <div
            style={{
              background: "#fee2e2",
              border: "1px solid #fecaca",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <button
              onClick={toggleEmergencyStop}
              style={{
                width: "100%",
                padding: 16,
                borderRadius: 8,
                border: emergencyStop ? "none" : "2px solid #f87171",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: emergencyStop ? "#dc2626" : "#fee2e2",
                color: emergencyStop ? "#fff" : "#b91c1c",
                transition: "all 0.2s",
              }}
            >
              {emergencyStop ? (
                <Power size={20} />
              ) : (
                <AlertTriangle size={20} />
              )}
              {emergencyStop ? "RESUME" : "EMERGENCY STOP"}
            </button>
          </div>
          {/* Log */}
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#1f2937",
                margin: "0 0 12px",
              }}
            >
              Status Log
            </h3>
            <div
              ref={logRef}
              style={{
                background: "#111827",
                color: "#4ade80",
                padding: 12,
                borderRadius: 8,
                height: 140,
                overflowY: "auto",
                fontSize: 12,
                fontFamily: "monospace",
              }}
            >
              {statusMessages.length === 0 ? (
                <div style={{ color: "#6b7280" }}>System ready…</div>
              ) : (
                statusMessages.map((m, i) => (
                  <div key={i} style={{ marginBottom: 4 }}>
                    {m}
                  </div>
                ))
              )}
            </div>
          </div>
          {/* Sys Info */}
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#1e40af",
                margin: "0 0 12px",
              }}
            >
              System Info
            </h3>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: "#374151" }}>
              <div>
                <strong>Active Hand:</strong>{" "}
                {handSelection.charAt(0).toUpperCase() + handSelection.slice(1)}
              </div>
              <div>
                <strong>Target Position:</strong> {targetPosition}°
              </div>
              <div>
                <strong>Actual Position:</strong> {currentPosition.toFixed(1)}°
              </div>
              <div>
                <strong>Range:</strong> -60° to +60°
              </div>
              <div>
                <strong>Speed:</strong> {velocity}%
              </div>
              <div>
                <strong>Torque:</strong>{" "}
                <span
                  style={{
                    color: torqueEnabled ? "#16a34a" : "#dc2626",
                    fontWeight: 600,
                  }}
                >
                  {torqueEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div>
                <strong>Lock Status:</strong>{" "}
                <span
                  style={{
                    color: torqueEnabled ? "#dc2626" : "#16a34a",
                    fontWeight: 600,
                  }}
                >
                  {torqueEnabled ? "Locked" : "Free"}
                </span>
              </div>
              <div>
                <strong>Emergency Stop:</strong>{" "}
                <span
                  style={{
                    color: emergencyStop ? "#dc2626" : "#16a34a",
                    fontWeight: 600,
                  }}
                >
                  {emergencyStop ? "ENGAGED" : "Clear"}
                </span>
              </div>

              {/* Stall Torque spec */}
              <div>
                <strong>Stall Torque:</strong> 1.4 N·m @ 11.1 V (~14.3 kg·cm)
              </div>

              <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                Last refreshed: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STATUS REQUEST BUTTON */}
      <div style={{ textAlign: "center", margin: "24px 0" }}>
        <button
          style={{
            padding: "10px 24px",
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 8,
            background: "#38bdf8",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 2px 8px #0af2",
          }}
          onClick={requestStatus}
        >
          Request Status
        </button>
      </div>
    </div>
  );
}

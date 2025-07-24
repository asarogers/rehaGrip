// ../backend/server.js

const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(bodyParser.json())

// ----- In-memory motor state -----
const state = {
  position: 0,     // current position (°)
  target: 0,       // target position (°)
  velocity: 50,    // speed %
  load: 0,         // simulated load reading (N)
  moving: false,   // whether motor is moving
  locked: false,
  torque: true,
  emergency: false,
  hand: 'right'
}

// ----- Simulation loop (100ms) -----
setInterval(() => {
  if (state.moving && !state.emergency) {
    const diff = state.target - state.position
    const step = Math.sign(diff) * Math.min(Math.abs(diff), state.velocity / 10)
    state.position += step

    if (Math.abs(state.target - state.position) < 0.1) {
      state.position = state.target
      state.moving = false
    }
  }

  // simple random load
  state.load = state.moving
    ? Math.random() * 20 + 10
    : Math.random() * 5 + 0.5

}, 100)

// ----- Endpoints -----

// POST /api/motor/status
// Returns { position, load, moving, locked, torque, emergency }
app.post('/api/motor/status', (req, res) => {
  res.json({
    position: state.position,
    load:     state.load,
    moving:   state.moving,
    locked:   state.locked,
    torque:   state.torque,
    emergency: state.emergency
  })
})

// POST /api/motor/move
// { position, velocity, hand }
app.post('/api/motor/move', (req, res) => {
  const { position, velocity, hand } = req.body
  state.target = position
  if (velocity !== undefined) state.velocity = velocity
  if (hand) state.hand = hand

  if (!state.emergency && !state.locked && state.torque) {
    state.moving = true
    return res.json({ ok: true })
  }
  return res.status(400).json({ error: 'Cannot move: locked/torque/emergency' })
})

// POST /api/motor/lock
// { locked, hand? }
app.post('/api/motor/lock', (req, res) => {
  state.locked = !!req.body.locked
  if (req.body.hand) state.hand = req.body.hand
  res.json({ ok: true })
})

// POST /api/motor/torque
// { torque, hand? }
app.post('/api/motor/torque', (req, res) => {
  state.torque = !!req.body.torque
  if (req.body.hand) state.hand = req.body.hand
  res.json({ ok: true })
})

// POST /api/motor/emergency
// { stop, hand? }
app.post('/api/motor/emergency', (req, res) => {
  state.emergency = !!req.body.stop
  if (state.emergency) state.moving = false
  if (req.body.hand) state.hand = req.body.hand
  res.json({ ok: true })
})

// POST /api/motor/hand
// { hand }
app.post('/api/motor/hand', (req, res) => {
  const { hand } = req.body
  if (hand === 'left' || hand === 'right') {
    state.hand = hand
    // reset positions on hand switch
    state.position = 0
    state.target   = 0
    state.moving   = false
    return res.json({ ok: true })
  }
  res.status(400).json({ error: 'Invalid hand value' })
})

// start server
app.listen(PORT, () => {
  console.log(`🚀 Motor API server listening on http://localhost:${PORT}`)
})

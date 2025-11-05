const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const DATA_FILE = path.join(__dirname, 'data.json');

const PIXUP_CLIENT_ID = process.env.PIXUP_CLIENT_ID || 'PIXUP_CLIENT_ID_PLACEHOLDER';
const PIXUP_CLIENT_SECRET = process.env.PIXUP_CLIENT_SECRET || 'PIXUP_CLIENT_SECRET_PLACEHOLDER';

// load/save simple JSON DB
let DB = { users: {}, rooms: {}, orders: {} };
if(fs.existsSync(DATA_FILE)) {
  try { DB = JSON.parse(fs.readFileSync(DATA_FILE)); } catch(e){}
}
function save(){ fs.writeFileSync(DATA_FILE, JSON.stringify(DB,null,2)); }

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname,'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Config
const BET_CENTS = 500; // R$5.00 fixed bet
const MULTIPLIER = 1.7; // winner receives bet * multiplier (per player's bet)

// Helpers
function ensureUser(name){
  if(!DB.users[name]) DB.users[name] = { name, balance: 0 };
  save();
  return DB.users[name];
}

// API: create user (simple)
app.post('/api/user', (req,res)=>{
  const { name } = req.body;
  if(!name) return res.status(400).json({error:'name required'});
  const u = ensureUser(name);
  res.json(u);
});

// API: request deposit (creates a simulated order)
// In production this should call PixUp to create a charge and return QR/pix payload
app.post('/api/deposit', (req,res)=>{
  const { user, roomId } = req.body;
  if(!user) return res.status(400).json({error:'user required'});
  const orderId = 'order_'+Date.now();
  DB.orders[orderId] = { id: orderId, user, roomId, amount: BET_CENTS, status: 'pending', createdAt: Date.now() };
  save();
  // Return a fake payload and order id. Replace with actual PixUp create-charge response.
  return res.json({ orderId, status: 'pending', pix_qr: 'PIX-QR-PLACEHOLDER' });
});

// API: simulate webhook (mark order paid) - only for testing
app.post('/api/webhook/simulate_paid', (req,res)=>{
  const { orderId } = req.body;
  const ord = DB.orders[orderId];
  if(!ord) return res.status(404).json({error:'order not found'});
  ord.status = 'paid';
  save();
  // mark player ready in room
  const room = DB.rooms[ord.roomId];
  if(room){
    if(!room.paid) room.paid = {};
    room.paid[ord.user] = true;
    // notify connected clients
    if(room.sockets) room.sockets.forEach(s=>{
      try{ s.send(JSON.stringify({ type:'player_paid', user: ord.user })); }catch(e){}
    });
    // if both paid, notify start
    const players = room.players || [];
    const allPaid = players.length>=2 && players.every(p=> room.paid && room.paid[p]);
    if(allPaid){
      room.status = 'ready';
      room.sockets.forEach(s=> s.send(JSON.stringify({ type:'room_ready', roomId: room.id })));
    }
  }
  res.json({ ok:true, order: ord });
});

// API: withdraw (create payout via PixUp - placeholder)
app.post('/api/withdraw', (req,res)=>{
  const { user, amount } = req.body;
  if(!user || !amount) return res.status(400).json({error:'user and amount required'});
  ensureUser(user);
  if(DB.users[user].balance < amount) return res.status(400).json({error:'insufficient balance'});
  // In production: call PixUp payout endpoint here with PIXUP_CLIENT_ID/SECRET and recipient pix key
  DB.users[user].balance -= amount;
  const payoutId = 'payout_'+Date.now();
  save();
  return res.json({ ok:true, payoutId, message: 'Saque processado (simulado). Em produção, PixUp API deve ser chamada.' });
});

// Simple list rooms
app.get('/api/rooms', (req,res)=> res.json(Object.values(DB.rooms)));

// WebSocket: rooms and game flow
wss.on('connection', ws => {
  ws.on('message', msg => {
    let data={};
    try{ data = JSON.parse(msg); }catch(e){}
    // create or join room
    if(data.type === 'join_room'){
      const { roomId, user } = data;
      if(!roomId) return;
      if(!DB.rooms[roomId]) DB.rooms[roomId] = { id: roomId, players: [], paid: {}, status:'waiting', sockets: [] };
      const room = DB.rooms[roomId];
      if(!room.players.includes(user)) room.players.push(user);
      room.sockets.push(ws);
      ws.roomId = roomId;
      ws.user = user;
      save();
      // notify
      room.sockets.forEach(s=> s.send(JSON.stringify({ type:'room_update', room })));
    }

    // handle move from a player
    if(data.type === 'move'){
      const room = DB.rooms[data.roomId];
      if(!room) return;
      // broadcast to other sockets in room
      room.sockets.forEach(s=>{
        if(s !== ws) s.send(JSON.stringify({ type:'move', from: data.from, to: data.to, user: ws.user }));
      });
    }

    // when game finished, server receives winner event
    if(data.type === 'game_end'){
      const { roomId, winner } = data;
      const room = DB.rooms[roomId];
      if(room){
        // credit winner: bet * multiplier (based on his own bet)
        const credit = Math.round(BET_CENTS * MULTIPLIER);
        ensureUser(winner);
        DB.users[winner].balance += credit;
        room.status = 'finished';
        room.sockets.forEach(s=> s.send(JSON.stringify({ type:'game_finished', winner, credit })));
        save();
      }
    }
  });

  ws.on('close', ()=>{
    const { roomId } = ws;
    if(roomId && DB.rooms[roomId]){
      DB.rooms[roomId].sockets = DB.rooms[roomId].sockets.filter(s=> s !== ws);
      save();
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, ()=> console.log('Server running on port', PORT));

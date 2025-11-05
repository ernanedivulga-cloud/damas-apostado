const ws = new WebSocket('ws://' + window.location.host);
let board = [];
const BET = 5.00; // R$5
const BET_CENTS = 500;
let currentRoom = null;
let currentUser = null;

document.getElementById('joinBtn').onclick = () => {
  const name = document.getElementById('name').value || 'Player'+Math.floor(Math.random()*1000);
  const room = document.getElementById('room').value || '1001';
  currentRoom = room; currentUser = name;
  ws.send(JSON.stringify({ type:'join_room', roomId: room, user: name }));
  initBoard(); renderBoard();
  document.getElementById('status').innerText = 'Sala: ' + room + ' | Jogador: ' + name + ' | Aposta fixa: R$' + BET.toFixed(2);
  // create order (simulate)
  fetch('/api/deposit', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ user: name, roomId: room }) })
    .then(r=>r.json()).then(j=> {
      alert('Cobrança criada (simulada). OrderId: ' + j.orderId + '\nUse o botão "Simular pagamento" no console para marcar como pago.');
      console.log('Order created', j);
    });
};

// Simulate clicking "I paid" by calling webhook simulate in console:
// fetch('/api/webhook/simulate_paid', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ orderId:'order_...'}) })
// After both paid, server will notify and players can play.

ws.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if(data.type === 'room_update') {
    console.log('room_update', data.room);
    // show players
  }
  if(data.type === 'player_paid') {
    console.log('player paid', data.user);
    document.getElementById('status').innerText += '\n' + data.user + ' pronto.';
  }
  if(data.type === 'room_ready') {
    alert('Ambos pagaram! Jogo liberado.');
  }
  if(data.type === 'move') {
    board[data.to.r][data.to.c] = board[data.from.r][data.from.c];
    board[data.from.r][data.from.c] = '';
    renderBoard();
  }
  if(data.type === 'game_finished') {
    alert('Partida finalizada. Vencedor: ' + data.winner + '\nCrédito: R$' + (data.credit/100).toFixed(2));
    refreshBalance();
  }
};

function initBoard(){
  board = [];
  for(let r=0;r<8;r++){
    board[r]=[];
    for(let c=0;c<8;c++){
      if(r<3 && (r+c)%2===1) board[r][c]='red';
      else if(r>4 && (r+c)%2===1) board[r][c]='white';
      else board[r][c]='';
    }
  }
}

function renderBoard(){
  const boardDiv = document.getElementById('board');
  boardDiv.innerHTML='';
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const cell = document.createElement('div');
      cell.className = 'cell ' + (((r+c)%2) ? 'dark' : 'light');
      if(board[r][c]){
        const p = document.createElement('div');
        p.className = 'piece ' + (board[r][c]==='red' ? 'red' : 'white');
        p.innerText = board[r][c]==='red' ? '●' : '○';
        cell.appendChild(p);
      }
      cell.onclick = ()=> onCellClick(r,c);
      boardDiv.appendChild(cell);
    }
  }
}

let selected = null;
function onCellClick(r,c){
  if(!selected && board[r][c]) selected = {r,c};
  else if(selected){
    // send move to server (will be broadcasted)
    ws.send(JSON.stringify({ type:'move', roomId: currentRoom, from: selected, to: {r,c} }));
    selected = null;
  }
}

function refreshBalance(){
  fetch('/api/rooms').then(r=>r.json()).then(rooms=>{
    // try to find user balance from server data.json via API user (not implemented)
    // For demo, we call /api/user to ensure user exists and parse file via server (simplified)
    fetch('/api/user', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name: currentUser})}).then(r=>r.json()).then(u=>{
      document.getElementById('balance').innerText = 'R$ ' + (u.balance/100 || 0).toFixed(2);
    });
  });
}

document.getElementById('withdrawBtn').onclick = ()=>{
  const amt = prompt('Quanto deseja sacar (R$)? Ex: 5.00');
  if(!amt) return;
  const cents = Math.round(parseFloat(amt)*100);
  fetch('/api/withdraw', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ user: currentUser, amount: cents }) })
    .then(r=>r.json()).then(j=>{
      if(j.error) alert('Erro: ' + j.error); else alert('Saque solicitado (simulado): ' + j.payoutId);
      refreshBalance();
    });
};

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const rooms = new Map();
app.use(express.static("."));
app.get("/health", (_req, res) => res.json({ ok: true, rooms: rooms.size }));
function code(){ return crypto.randomBytes(3).toString("hex").toUpperCase(); }
function leave(socket){
 const code = socket.data.room;
 if(!code) return;
 const room=rooms.get(code);
 if(room){ room.delete(socket.id); socket.to(code).emit("player-left",{id:socket.id}); io.to(code).emit("room-count",{count:room.size}); if(room.size===0) rooms.delete(code); }
 socket.leave(code); socket.data.room=null;
}
io.on("connection",socket=>{
 socket.on("create-room",()=>{
  leave(socket); let c=code(); while(rooms.has(c)) c=code();
  rooms.set(c,new Map([[socket.id,{id:socket.id}]])); socket.join(c);socket.data.room=c;
  socket.emit("room-created",{code:c});
 });
 socket.on("join-room",c=>{
  c=String(c||"").trim().toUpperCase();const room=rooms.get(c);
  if(!room){socket.emit("room-error",{message:"Sala não encontrada."});return;}
  if(room.size>=10){socket.emit("room-error",{message:"Sala cheia. Limite de 10 jogadores."});return;}
  leave(socket);room.set(socket.id,{id:socket.id});socket.join(c);socket.data.room=c;
  socket.emit("room-joined",{code:c,count:room.size});socket.to(c).emit("player-joined",{count:room.size});
  socket.emit("players",[...room.values()].filter(p=>p.id!==socket.id));
  io.to(c).emit("room-count",{count:room.size});
 });
 socket.on("player-state",p=>{
  const c=socket.data.room;if(!c||!rooms.has(c))return;
  const safe={id:socket.id,x:Number(p?.x)||0,y:Number(p?.y)||0,z:Number(p?.z)||0,yaw:Number(p?.yaw)||0};
  rooms.get(c).set(socket.id,safe);socket.to(c).emit("player-state",safe);
 });
 socket.on("player-shot",()=>{const c=socket.data.room;if(c)socket.to(c).emit("player-shot",{id:socket.id});});
 socket.on("disconnect",()=>leave(socket));
});
const PORT=process.env.PORT||3000;
server.listen(PORT,"0.0.0.0",()=>console.log("Arena Zero online na porta "+PORT));

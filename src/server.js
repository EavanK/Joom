import dotenv from "dotenv";
dotenv.config();
import http from "http";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));

app.get("/", (req, res) => res.render("home"));
app.get("/*", (req, res) => res.redirect("/"));

const handleListen = () => console.log(`Listening on http://localhost:3000`);

/* now we have access to the server before app.listen
  it's not mandatory (puting http server in WebSocket)
  const wss = new WebSocket (If I want to create only ws server)
  now, when http server starts, WebSocket server will also start
  reason I put server is for exposing the http server
  then create websocket server on top of the http server 
  so now http://localhost:3000 will also be able to handle 
  ws://localhost:3000 on the same port */
const httpServer = http.createServer(app);

// @socket.io/admin
const io = new Server(httpServer, {
  cors: {
    origin: ["https://admin.socket.io"],
    credentials: true,
  },
});

instrument(io, {
  auth: false,
});

// show all the public rooms
function publicRooms() {
  const { sids, rooms } = io.sockets.adapter;
  const publicRooms = [];
  rooms.forEach((_, key) => {
    if (!sids.get(key)) publicRooms.push(key);
  });
  return publicRooms;
}

function countRoom(roomName) {
  return io.sockets.adapter.rooms.get(roomName)?.size;
}

io.on("connection", (socket) => {
  socket["nickname"] = "Anonymous";
  socket.onAny((e) => {
    console.log(`Socket Event: ${e}`);
  });
  socket.on("enter_room", (roomName, done) => {
    socket.join(roomName);
    done(countRoom(roomName));
    socket.to(roomName).emit("welcome", socket.nickname, countRoom(roomName));
    io.sockets.emit("room_change", publicRooms());
  });
  socket.on("new_message", (msg, roomName, done) => {
    socket.to(roomName).emit("new_message", `${socket.nickname}: ${msg}`);
    done();
  });
  socket.on("nickname", (nickname) => (socket["nickname"] = nickname));

  // disconnecting means client is going to be disconnected (not hasn't left its rooms yet)
  socket.on("disconnecting", () => {
    socket.rooms.forEach((room) =>
      socket.to(room).emit("bye", socket.nickname, countRoom(room) - 1)
    );
  });

  socket.on("disconnect", () => {
    io.sockets.emit("room_change", publicRooms());
  });

  // webRTC
  socket.on("offer", (offer, roomName) => {
    socket.to(roomName).emit("offer", offer);
  });
  socket.on("answer", (answer, roomName) => {
    socket.to(roomName).emit("answer", answer);
  });
  socket.on("ice", (ice, roomName) => {
    socket.to(roomName).emit("ice", ice);
  });
});

httpServer.listen(PORT, handleListen);

/* WebSocket implementation

import WebSocket from "ws";
const wss = new WebSocket.Server({ server });
// each user connects to server, save the users in an array
const sockets = [];

// without connection from server, client can connect to server
// but server can't listen to client
wss.on("connection", (socket) => {
  sockets.push(socket);
  socket["nickname"] = "Anonymous";
  console.log("Connected to Browser ✅");
  socket.on("close", () => console.log("Disconnected from the Browser ❌"));
  socket.on("message", (msg) => {
    const message = JSON.parse(msg);
    switch (message.type) {
      case "new_message":
        return sockets.forEach((aSocket) =>
          aSocket.send(`${socket.nickname}: ${message.payload.toString()}`)
        );
      case "nickname":
        return (socket["nickname"] = message.payload.toString());
    }
  });
});
*/

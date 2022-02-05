import http from "http";
import WebSocket from "ws";
import express from "express";

const app = express();

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
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// each user connects to server, save the users in an array
const sockets = [];

// without connection from server, client can connect to server
// but server can't listen to client
wss.on("connection", (socket) => {
  sockets.push(socket);
  console.log("Connected to Browser ✅");
  socket.on("close", () => console.log("Disconnected from the Browser ❌"));
  socket.on("message", (message) => {
    sockets.forEach((aSocket) => aSocket.send(message.toString()));
  });
});

server.listen(3000, handleListen);

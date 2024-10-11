import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { setupWebSocket } from "./ws-handler";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const port = 3000;

setupWebSocket(wss);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/call", (req, res) => {
  console.log(req.body);
  res.send("Call received");
});

server.listen(port, () => {
  return console.log(`Server is running at http://localhost:${port}`);
});

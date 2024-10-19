import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { setupTwilioWebSocket } from "./twilio/twilio-websocket";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const port = 3000;

setupTwilioWebSocket(wss);

app.get("/", (req, res) => {
  res.send("AI Server is running");
});

app.post("/call", (req, res) => {
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                            <Response>
                            <Connect>
                                    <Stream url="wss://${req.headers.host}/call">
                                    <Parameter name="caller" value="${req.body.From}" />
                                    <Parameter name="called" value="${req.body.Called}" />
                                    </Stream>
                              </Connect>
                            </Response>`;

  res.type("text/xml").send(twimlResponse);
});

server.listen(port, () => {
  return console.log(`Server is running at http://localhost:${port}`);
});

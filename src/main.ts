import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { setupWebSocket } from "./ws-handler";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const port = 3000;

setupWebSocket(wss);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/call", (req, res) => {
  // TODO: Here in connect set the custom parameters like number etc
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                          <Response>
                              <Say>Please wait while we connect your call to the A. I. voice assistant, powered by Twilio and the Open-A.I. Realtime API</Say>
                              <Pause length="1"/>
                              <Say>O.K. you can start talking!</Say>
                              <Connect>
                                  <Stream url="wss://${req.headers.host}/media-stream">
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

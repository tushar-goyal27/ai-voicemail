import { WebSocket, WebSocketServer } from "ws";
import { OpenAiService } from "./openai/openai-service";
import { IStreamStartMessage } from "./twilio-types";

export function setupWebSocket(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket) => {
    console.log("A client connected");

    const openaiSvc = new OpenAiService(ws);

    ws.on("message", (message: Buffer) => {
      // console.log("Received from client JSON:", JSON.parse(data.toString()));
      // const message = data.toString("base64");
      // openaiSvc.sendAudioAndPromptResponse(message);

      const data = JSON.parse(message.toString());

      switch (data.event) {
        case "start": {
          const start = data.start as IStreamStartMessage;
          console.log("Incoming stream has started", start);
          openaiSvc.addCallMetadata(start.streamSid, start.customParameters);
          break;
        }
        case "media": {
          openaiSvc.sendCallAudio(data.media.payload);
          break;
        }
        default: {
          console.log("Received non-media event:", data);
          break;
        }
      }
    });

    ws.on("close", () => {
      console.log("Client disconnected");
      openaiSvc.disconnect();
    });

    ws.send("Welcome to the WebSocket server!");
  });
}

import { WebSocket, WebSocketServer } from "ws";
import { OpenAiService } from "../openai/openai-service";
import { IStreamStartMessage } from "./twilio-types";

export function setupTwilioWebSocket(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket) => {
    console.log("A client connected");

    const openaiSvc = new OpenAiService(ws);

    ws.on("message", (message: Buffer) => {
      const data = JSON.parse(message.toString());

      switch (data.event) {
        case "start": {
          const start = data.start as IStreamStartMessage;
          console.log("Incoming stream has started", start);
          openaiSvc.setCallMetadata(start.streamSid, start.customParameters);
          break;
        }
        case "media": {
          openaiSvc.sendCallAudio(data.media.payload);
          break;
        }
        case "mark": {
          // this means the audio playing is complete on twilio side
          openaiSvc.setAiAudioPlayingComplete();
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

    ws.send("Connected to AI Voice Mail");
  });
}

import { WebSocket, WebSocketServer } from "ws";
import { OpenAiService } from "./openai/openai-service";

export function setupWebSocket(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket) => {
    console.log("A client connected");

    const openaiSvc = new OpenAiService(ws);

    ws.on("message", (message: Buffer) => {
      console.log("Received from client:", message);
      openaiSvc.sendAudioAndPromptResponse(message);

      // const data = JSON.parse(message.toString());

      // switch (data.event) {
      //   case "media":
      //     if (openAiWs.readyState === WebSocket.OPEN) {
      //       const audioAppend = {
      //         type: "input_audio_buffer.append",
      //         audio: data.media.payload,
      //       };

      //       openAiWs.send(JSON.stringify(audioAppend));
      //     }
      //     break;
      //   case "start":
      //     console.log("Incoming stream has started", data.start);
      //     break;
      //   default:
      //     console.log("Received non-media event:", data);
      //     break;
      // }
    });

    ws.on("close", () => {
      console.log("Client disconnected");
    });

    ws.send("Welcome to the WebSocket server!");
  });
}

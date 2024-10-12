import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import fs from "fs";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

export const base64Pcm16ToWav = (
  base64: string,
  numChannels = 1,
  sampleRate = 24000,
  bitsPerSample = 16
) => {
  // Decode Base64 to binary string
  const binaryString = base64ToBinary(base64);

  // Convert binary string to ArrayBuffer (PCM data)
  const pcmBuffer = binaryStringToArrayBuffer(binaryString);

  // Create WAV header
  const wavHeader = createWavHeader(
    numChannels,
    sampleRate,
    bitsPerSample,
    pcmBuffer.byteLength
  );

  // Concatenate WAV header with PCM data
  const wavArrayBuffer = concatBuffers(wavHeader, pcmBuffer);

  return wavArrayBuffer; // This is the final WAV ArrayBuffer
};

export const base64ToBinary = (base64: string) => {
  return atob(base64); // Convert Base64 to binary string
};

export const binaryStringToArrayBuffer = (binary: string) => {
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
};

export const createWavHeader = (
  numChannels: number,
  sampleRate: number,
  bitsPerSample: number,
  dataSize: number
) => {
  const header = new ArrayBuffer(44); // WAV header is always 44 bytes
  const view = new DataView(header);

  // "RIFF" chunk descriptor
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true); // file size - 8 bytes
  writeString(view, 8, "WAVE");

  // "fmt " sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // sub-chunk size (16 for PCM)
  view.setUint16(20, 1, true); // PCM format (1 = Linear PCM)
  view.setUint16(22, numChannels, true); // number of channels (1 = mono, 2 = stereo)
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, (sampleRate * numChannels * bitsPerSample) / 8, true); // byte rate
  view.setUint16(32, (numChannels * bitsPerSample) / 8, true); // block align
  view.setUint16(34, bitsPerSample, true); // bits per sample

  // "data" sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true); // data size

  return header;
};

// Concatenate WAV header with PCM16 ArrayBuffer
export const concatBuffers = (header: ArrayBuffer, pcmBuffer: ArrayBuffer) => {
  const totalLength = header.byteLength + pcmBuffer.byteLength;
  const result = new Uint8Array(totalLength);
  result.set(new Uint8Array(header), 0);
  result.set(new Uint8Array(pcmBuffer), header.byteLength);
  return result.buffer; // Return concatenated ArrayBuffer
};

// Helper function to write strings into DataView
const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

export function convertToPCM16(inputBuffer: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const bn = base64ToBinary(inputBuffer);
    const buffer = binaryStringToArrayBuffer(bn);

    const chunks: Buffer[] = [];

    const tempFilePath = "output.m4a";
    fs.writeFileSync(tempFilePath, Buffer.from(buffer));

    ffmpeg(tempFilePath)
      .inputFormat("m4a")
      .audioCodec("pcm_s16le")
      .audioChannels(1)
      .audioFrequency(16000)
      .format("s16le")
      .on("start", (command) => {
        console.log("Command:", command);
      })
      .on("codecData", (data) => {
        console.log("Input is " + data.audio + " audio ");
      })
      .on("progress", (data) => {
        console.log("Progress", data);
      })
      .on("end", () => {
        fs.unlinkSync(tempFilePath);
        resolve(Buffer.concat(chunks));
      })
      .on("error", (err) => {
        console.error("FFmpeg error:", err);
        reject(err);
      })
      .pipe()
      .on("data", (chunk) => {
        chunks.push(chunk);
      });
  });
}

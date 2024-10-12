import {
  base64ToBinary,
  binaryStringToArrayBuffer,
  concatBuffers,
  createWavHeader,
} from "./audio-helpers";

export class AudioDeltaHandler {
  private pcmChunks: ArrayBuffer[] = [];

  constructor() {}

  appendDelta(base64: string) {
    const binaryString = base64ToBinary(base64);
    const pcmBuffer = binaryStringToArrayBuffer(binaryString);

    // Add the PCM buffer to the chunks array for later concatenation
    this.pcmChunks.push(pcmBuffer);
  }

  finalizeWavFromDeltas(
    numChannels = 1,
    sampleRate = 24000,
    bitsPerSample = 16
  ): ArrayBuffer {
    const concatenatedPCMBuffer = this.concatPCMChunks();

    const wavHeader = createWavHeader(
      numChannels,
      sampleRate,
      bitsPerSample,
      concatenatedPCMBuffer.byteLength
    );

    const wavArrayBuffer = concatBuffers(wavHeader, concatenatedPCMBuffer);

    return wavArrayBuffer; // This is the final WAV ArrayBuffer
  }

  private concatPCMChunks(): ArrayBuffer {
    let totalLength = 0;
    for (const chunk of this.pcmChunks) {
      totalLength += chunk.byteLength;
    }

    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      result.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    return result.buffer;
  }
}

export class AudioUtil {
  constructor() {}

  base64Pcm16ToWav(
    base64: string,
    numChannels = 1,
    sampleRate = 24000,
    bitsPerSample = 16
  ) {
    // Decode Base64 to binary string
    const binaryString = this.base64ToBinary(base64);

    // Convert binary string to ArrayBuffer (PCM data)
    const pcmBuffer = this.binaryStringToArrayBuffer(binaryString);

    // Create WAV header
    const wavHeader = this.createWavHeader(
      numChannels,
      sampleRate,
      bitsPerSample,
      pcmBuffer.byteLength
    );

    // Concatenate WAV header with PCM data
    const wavArrayBuffer = this.concatBuffers(wavHeader, pcmBuffer);

    return wavArrayBuffer; // This is the final WAV ArrayBuffer
  }

  base64ToBinary(base64: string) {
    return atob(base64); // Convert Base64 to binary string
  }

  binaryStringToArrayBuffer(binary: string) {
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
      view[i] = binary.charCodeAt(i);
    }
    return buffer;
  }

  createWavHeader(
    numChannels: number,
    sampleRate: number,
    bitsPerSample: number,
    dataSize: number
  ) {
    const header = new ArrayBuffer(44); // WAV header is always 44 bytes
    const view = new DataView(header);

    // "RIFF" chunk descriptor
    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true); // file size - 8 bytes
    this.writeString(view, 8, "WAVE");

    // "fmt " sub-chunk
    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // sub-chunk size (16 for PCM)
    view.setUint16(20, 1, true); // PCM format (1 = Linear PCM)
    view.setUint16(22, numChannels, true); // number of channels (1 = mono, 2 = stereo)
    view.setUint32(24, sampleRate, true); // sample rate
    view.setUint32(28, (sampleRate * numChannels * bitsPerSample) / 8, true); // byte rate
    view.setUint16(32, (numChannels * bitsPerSample) / 8, true); // block align
    view.setUint16(34, bitsPerSample, true); // bits per sample

    // "data" sub-chunk
    this.writeString(view, 36, "data");
    view.setUint32(40, dataSize, true); // data size

    return header;
  }

  // Concatenate WAV header with PCM16 ArrayBuffer
  concatBuffers(header: ArrayBuffer, pcmBuffer: ArrayBuffer) {
    const totalLength = header.byteLength + pcmBuffer.byteLength;
    const result = new Uint8Array(totalLength);
    result.set(new Uint8Array(header), 0);
    result.set(new Uint8Array(pcmBuffer), header.byteLength);
    return result.buffer; // Return concatenated ArrayBuffer
  }

  // Helper function to write strings into DataView
  private writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

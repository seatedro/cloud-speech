//Audio Worklet Node

class FloatToIntAudioProcessor extends AudioWorkletProcessor {
  //Buffer Size
  _bufferSize = 2048;
  //Track the current buffer Size
  _bytesWritten = 0;

  _buffer = new Float32Array(this._bufferSize);

  constructor() {
    super();
    this.initBuffer();
  }

  initBuffer() {
    this._bytesWritten = 0;
  }

  isBufferEmpty() {
    return this._bytesWritten === 0;
  }

  isBufferFull() {
    return this._bytesWritten === this._bufferSize;
  }

  /**
   *
   * @param {Float32Array[][]} inputs
   * @param {Float32Array[][]} outputs
   * @param {*} parameters
   * @returns boolean
   */
  process (inputs, outputs, parameters) {
    // Get the first channel of the input buffer
    this.append(inputs[0][0]);
    return true;
  }

  /**
   *
   * @param {Float32Array} channelData
   */
  append(channelData) {
    if (this.isBufferFull()) {
      this.flush();
    }
    if (!channelData) return;
    for (let i = 0; i < channelData.length; i++) {
      this._buffer[this._bytesWritten++] = channelData[i];
    }
  }

  flush() {
    //Trim buffer if ended prematurely
    const buffer = this._bytesWritten < this._bufferSize
      ? this._buffer.slice(0, this._bytesWritten)
      : this._buffer;
    const result = this.downSampleBuffer(buffer, 44100, 16000);
    this.port.postMessage(result);
    this.initBuffer();
  }


  /**
   *
   * @param {Float32Array} buffer
   * @param {number} sampleRate
   * @param {number} outSampleRate
   * @returns ArrayBufferLike
   */
  downSampleBuffer(buffer, sampleRate, outSampleRate) {
    if (outSampleRate == sampleRate) {
      return buffer;
    }
    else if (outSampleRate > sampleRate) {
      throw new Error("Down Sampling Rate must be less than original sample rate");
    }

    const sampleRateRatio = sampleRate / outSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Int16Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = Math.min(1, accum / count) * 0x7FFF;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result.buffer;
  }
}
registerProcessor('recorder.worklet', FloatToIntAudioProcessor);

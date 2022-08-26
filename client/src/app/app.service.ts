import { Injectable } from '@angular/core';
import { Socket } from 'socket.io-client';

// Stream Audio
let bufferSize = 2048,
  AudioContext;

//audioStream constraints
const constraints = {
  audio: true,
  video: false,
};

@Injectable({
  providedIn: 'root',
})
export class AudioStreamer {
  input!: MediaStreamAudioSourceNode | null;
  globalStream: MediaStream | undefined;
  processor!: AudioWorkletNode | null;
  audioContext!: AudioContext | null;
  socket!: Socket;

  set _socket(value: Socket) {
    this.socket = value;
  }
  /**
   * @param {function} onData Callback to run on data each time it's received
   * @param {function} onError Callback to run on an error if one is emitted.
   */
  initRecording(onData: (arg0: any) => void, onError: (arg0: string) => void) {
    this.socket.emit('startGoogleCloudStream', {
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'en-US',
        profanityFilter: false,
        enableWordTimeOffsets: true,
      },
      interimResults: true, // If you want interim results, set this to true
    }); //init socket Google Speech Connection
    AudioContext = window.AudioContext;
    this.audioContext = new AudioContext({
      latencyHint: 'interactive'
    });

    const handleSuccess = async (stream: MediaStream) => {
      this.globalStream = stream;
      this.input = this.audioContext!.createMediaStreamSource(stream);
      await this.audioContext!.audioWorklet.addModule(
        '/assets/audio-processor.js'
      );
      this.audioContext!.resume();
      this.processor = new AudioWorkletNode(
        this.audioContext!,
        'recorder.worklet'
      );
      this.processor.connect(this.audioContext!.destination);
      this.audioContext!.resume();
      this.input.connect(this.processor);

      this.processor.port.onmessage = (event: MessageEvent<ArrayBufferLike>) => {
        const audioData = event.data;
        this.sendAudio(audioData);
      }

    };

    navigator.mediaDevices.getUserMedia(constraints).then(handleSuccess);

    // Bind the data handler callback
    if (onData) {
      this.socket.on('speechData', (data) => {
        onData(data);
      });
    }

    this.socket.on('googleCloudStreamError', (error) => {
      if (onError) {
        onError('error');
      }
      // We don't want to emit another end stream event
      this.closeAll();
    });
  }

  sendQuestion(question: string) {
    return new Promise((resolve, reject) => {
      AudioContext = window.AudioContext;
      this.audioContext = new AudioContext({
        latencyHint: 'interactive'
      });
      this.socket.emit('speechQuestion', question);
      // Receive binary audio stream from socket and convert to audio buffer
      this.socket.on('ttsResponse', async (data) => {
        try {
          const source = this.audioContext!.createBufferSource();
          const buffer = await this.audioContext!.decodeAudioData(data);
          source.buffer = buffer;
          source.connect(this.audioContext!.destination);
          source.loop = false;
          source.start(0);
          source.onended = () => {
            source.stop();
            resolve(true)
            this.audioContext!.close().then(() => {
              this.input = null;
              this.audioContext = null;
              AudioContext = null;
            }).catch(error => {
              console.log(error);
            });
          }
        } catch (error) {
          reject(false);
        }
      })
    })

  }

  sendAudio(buffer: ArrayBufferLike) {
    this.socket.emit('binaryAudioData', buffer);
  }

  stopRecording() {
    this.socket.emit('endGoogleCloudStream', '');
    this.closeAll();
  }

  /**
   * Stops recording and closes everything down. Runs on error or on stop.
   */
  closeAll() {
    // Clear the listeners (prevents issue if opening and closing repeatedly)
    this.socket.off('speechData');
    this.socket.off('googleCloudStreamError');
    let tracks = this.globalStream ? this.globalStream.getTracks() : null;
    let track = tracks ? tracks[0] : null;
    if (track) {
      track.stop();
    }

    if (this.processor) {
      if (this.input) {
        try {
          this.input.disconnect(this.processor);
        } catch (error) {
          console.warn('Attempt to disconnect input failed.');
        }
      }
      this.processor.disconnect(this.audioContext!.destination);
    }
    if (this.audioContext) {
      this.audioContext.close().then(() => {
        this.input = null;
        this.audioContext = null;
        AudioContext = null;
      });
    }
  }
}

export default AudioStreamer;

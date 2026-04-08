/**
 * AudioWorkletProcessor for microphone capture and processing
 *
 * Runs at AudioContext sample rate; sends float32 to main thread for resample to agent rate (Issue #560).
 */
class MicrophoneProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // State
    this.isRecording = false;
    this.bufferSize = 4096;  // Buffer size in samples
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    
    // Set up message handler
    this.port.onmessage = (event) => this.onMessage(event.data);
  }
  
  /**
   * Handles messages from the main thread
   */
  onMessage(message) {
    if (message.type === 'start') {
      this.isRecording = true;
      this.port.postMessage({ type: 'started' });
    } else if (message.type === 'stop') {
      this.isRecording = false;
      this.port.postMessage({ type: 'stopped' });
    }
  }
  
  /**
   * Processes audio input and sends it to the main thread
   */
  process(inputs, outputs, parameters) {
    if (!this.isRecording || !inputs[0] || !inputs[0][0]) {
      return true;
    }
    
    const input = inputs[0][0];
    
    // Add input samples to our buffer
    for (let i = 0; i < input.length; i++) {
      this.buffer[this.bufferIndex++] = input[i];
      
      // When buffer is full, send it to the main thread
      if (this.bufferIndex >= this.bufferSize) {
        this.sendBufferToMainThread();
        this.bufferIndex = 0;
      }
    }
    
    return true;
  }
  
  sendBufferToMainThread() {
    const audioData = this.buffer.slice(0, this.bufferIndex);
    this.port.postMessage(
      { type: 'audio', data: audioData.buffer },
      [audioData.buffer]
    );
  }
}

// Register the processor
registerProcessor('microphone-processor', MicrophoneProcessor); 
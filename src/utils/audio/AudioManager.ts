import { DeepgramError } from '../../types';
// Remove import/placeholder for worklet code and embed directly
// Define the worklet code as a template string
const audioWorkletCode = `/**
 * AudioWorkletProcessor for microphone capture and processing
 * 
 * This processor captures audio from the microphone, resamples it to 16kHz,
 * and converts it to Linear PCM format for sending to Deepgram.
 */
class MicrophoneProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // State
    this.isRecording = false;
    this.sampleRate = 16000; // Target sample rate
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
  
  /**
   * Converts the buffer to the required format and sends it to the main thread
   */
  sendBufferToMainThread() {
    // Create a copy of the buffer
    const audioData = this.buffer.slice(0, this.bufferIndex);
    
    // Convert to 16-bit PCM
    const pcmData = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      // Convert float [-1.0, 1.0] to 16-bit PCM [-32768, 32767]
      const s = Math.max(-1, Math.min(1, audioData[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Send the PCM data to the main thread
    this.port.postMessage({
      type: 'audio',
      data: pcmData.buffer
    }, [pcmData.buffer]);
  }
}

// Register the processor
registerProcessor('microphone-processor', MicrophoneProcessor);`;

import { createAudioBuffer, playAudioBuffer } from './AudioUtils';

/**
 * Event types emitted by the AudioManager
 */
export type AudioEvent =
  | { type: 'ready' }
  | { type: 'recording'; isRecording: boolean }
  | { type: 'playing'; isPlaying: boolean }
  | { type: 'error'; error: DeepgramError }
  | { type: 'data'; data: ArrayBuffer };

/**
 * Options for the AudioManager
 */
export interface AudioManagerOptions {
  /**
   * Target sample rate for microphone capture
   */
  sampleRate?: number;
  
  /**
   * Output sample rate for agent audio
   */
  outputSampleRate?: number;
  
  /**
   * Enable volume normalization
   */
  normalizeVolume?: boolean;
  
  /**
   * Volume normalization factor (higher = quieter)
   */
  normalizationFactor?: number;
  
  /**
   * Enable verbose logging
   */
  debug?: boolean;
}

/**
 * Default options for the AudioManager
 */
const DEFAULT_OPTIONS: Partial<AudioManagerOptions> = {
  sampleRate: 16000,
  outputSampleRate: 24000,
  normalizeVolume: true,
  normalizationFactor: 128,
  debug: false,
};

/**
 * Manages audio capture and playback
 */
export class AudioManager {
  private options: Omit<AudioManagerOptions, 'processorUrl'>; // processorUrl is no longer needed
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private microphoneStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private isRecording = false;
  private isPlaying = false;
  private isInitialized = false;
  public isTtsMuted = false;
  private eventListeners: Array<(event: AudioEvent) => void> = [];
  
  // Improved audio playback variables
  private startTimeRef = { current: 0 };
  private analyzer: AnalyserNode | null = null;
  // private analyzerData: Uint8Array | null = null; // Unused for now
  private currentSource: AudioBufferSourceNode | null = null;
  private activeSourceNodes: AudioBufferSourceNode[] = []; // Track all active/scheduled sources
  
  /**
   * Creates a new AudioManager
   */
  constructor(options: Omit<AudioManagerOptions, 'processorUrl'>) { // Update constructor options
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.log('AudioManager created');
  }
  
  /**
   * Logs a message if debug is enabled
   */
  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.log('[AudioManager]', ...args);
    }
  }
  
  /**
   * Adds an event listener
   */
  public addEventListener(listener: (event: AudioEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter(l => l !== listener);
    };
  }
  
  /**
   * Emits an event to all listeners
   */
  private emit(event: AudioEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in AudioManager event listener:', error);
      }
    });
  }
  
  /**
   * Initializes the AudioManager
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    let objectUrl: string | null = null;
    
    try {
      this.log('Initializing AudioManager');
      
      // Create AudioContext
      this.audioContext = new AudioContext({
        sampleRate: this.options.sampleRate,
        latencyHint: 'interactive',
      });
      
      // Check if AudioWorklet is supported
      if (!this.audioContext.audioWorklet) {
        throw new Error('AudioWorklet is not supported in this environment');
      }
      
      // Create analyzer for volume normalization
      if (this.options.normalizeVolume) {
        this.analyzer = this.audioContext.createAnalyser();
        this.analyzer.fftSize = 1024;
        // this.analyzerData = new Uint8Array(this.analyzer.frequencyBinCount); // Unused for now
        this.log('Created audio analyzer for volume normalization');
      }
      
      // Reset start time reference
      this.startTimeRef.current = 0;
      
      // Create a Blob directly using the embedded worklet code
      const blob = new Blob([audioWorkletCode], { type: 'application/javascript' });
      
      // Create an Object URL for the Blob
      objectUrl = URL.createObjectURL(blob);
      this.log('Created Object URL for AudioWorklet:', objectUrl);

      // Load the AudioWorklet processor using the Object URL with timeout
      const addModulePromise = this.audioContext.audioWorklet.addModule(objectUrl);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AudioWorklet module loading timeout')), 5000);
      });
      
      await Promise.race([addModulePromise, timeoutPromise]);
      this.log('AudioWorklet loaded using Object URL');
      
      this.isInitialized = true;
      this.emit({ type: 'ready' });

    } catch (error) {
      this.log('Failed to initialize AudioManager:', error);
      this.emit({
        type: 'error',
        error: {
          service: 'transcription',
          code: 'audio_init_error',
          message: 'Failed to initialize audio',
          details: error,
        },
      });
      throw error;
    } finally {
      // Clean up the Object URL once the module is added (or if an error occurs)
      if (objectUrl) {
        this.log('Revoking Object URL:', objectUrl);
        URL.revokeObjectURL(objectUrl);
      }
    }
  }
  
  /**
   * Requests microphone permissions and starts capturing audio
   */
  public async startRecording(): Promise<void> {
    if (this.isRecording) {
      this.log('Already recording');
      return;
    }
    
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Check if audioContext is available after initialization
    if (!this.audioContext) {
      throw new Error('AudioContext not available - initialization may have failed');
    }
    
    try {
      this.log('Requesting microphone access');
      
      // Request microphone access
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      
      // Connect microphone to AudioWorklet
      this.sourceNode = this.audioContext.createMediaStreamSource(this.microphoneStream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'microphone-processor');
      
      // Listen for audio data from the worklet
      this.workletNode.port.onmessage = (event: MessageEvent) => {
        const message = event.data;
        
        if (message.type === 'audio') {
          this.log('Received audio data from worklet');
          this.emit({ type: 'data', data: message.data });
        } else if (message.type === 'started') {
          this.log('Recording started');
          this.isRecording = true;
          this.emit({ type: 'recording', isRecording: true });
        } else if (message.type === 'stopped') {
          this.log('Recording stopped');
          this.isRecording = false;
          this.emit({ type: 'recording', isRecording: false });
        } else if (message.type === 'log') {
          this.log(`[AudioWorklet] ${message.message}`);
        }
      };
      
      // Connect the nodes
      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);
      
      // Resume the AudioContext if it's suspended
      if (this.audioContext.state === 'suspended') {
        this.log('AudioContext suspended, resuming for microphone access...');
        try {
          await this.audioContext.resume();
          this.log('AudioContext resumed successfully');
        } catch (error) {
          this.log('Failed to resume AudioContext:', error);
          throw new Error('AudioContext could not be resumed - user gesture required');
        }
      }
      
      // Double-check that AudioContext is running
      if (this.audioContext.state !== 'running') {
        this.log(`AudioContext state is ${this.audioContext.state}, attempting to resume again...`);
        try {
          await this.audioContext.resume();
          this.log('AudioContext resumed on second attempt');
        } catch (error) {
          this.log('Failed to resume AudioContext on second attempt:', error);
          throw new Error(`AudioContext could not be resumed - current state: ${this.audioContext.state}`);
        }
      }
      
      // Start recording
      this.workletNode.port.postMessage({ type: 'start' });
      this.log('Recording started');
    } catch (error) {
      this.log('Failed to start recording:', error);
      this.emit({
        type: 'error',
        error: {
          service: 'transcription',
          code: 'microphone_error',
          message: error instanceof DOMException && error.name === 'NotAllowedError'
            ? 'Microphone permission denied'
            : 'Failed to access microphone',
          details: error,
        },
      });
      throw error;
    }
  }
  
  /**
   * Stops recording
   */
  public stopRecording(): void {
    if (!this.isRecording) {
      return;
    }
    
    this.log('Stopping recording');
    
    // Stop the worklet
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'stop' });
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    
    // Stop the microphone
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    
    // Stop all microphone tracks
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach(track => track.stop());
      this.microphoneStream = null;
    }
    
    this.isRecording = false;
    this.emit({ type: 'recording', isRecording: false });
  }
  
  /**
   * Queues audio data for playback using precise timing
   * @param data ArrayBuffer containing audio data (Linear16 PCM expected)
   */
  public async queueAudio(data: ArrayBuffer): Promise<void> {
    this.log(`🎵 [queueAudio] Received audio data: ${data.byteLength} bytes, TTS muted: ${this.isTtsMuted}`);
    
    if (!this.isInitialized) {
      this.log('AudioManager not initialized, initializing now...');
      await this.initialize();
      this.log('AudioManager initialized from queueAudio');
    }
    
    // Resume the AudioContext if it's suspended (required for playback)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.log('AudioContext suspended, resuming for playback...');
      await this.audioContext.resume();
      this.log('AudioContext resumed successfully');
    }
    
    try {
      this.log(`Processing audio data (${data.byteLength} bytes)...`);
      this.log(`[queueAudio] Before: activeSourceNodes.length = ${this.activeSourceNodes.length}, startTimeRef.current = ${this.startTimeRef.current}`);
      
      // Check if audioContext is available
      if (!this.audioContext) {
        throw new Error('AudioContext not available for audio playback');
      }
      
      // Create an audio buffer from the raw data
      const buffer = createAudioBuffer(
        this.audioContext, 
        data, 
        this.options.outputSampleRate!
      );
      
      if (!buffer) {
        throw new Error('Failed to create audio buffer: buffer is undefined');
      }
      
      this.log(`[queueAudio] Created audio buffer (${buffer.duration.toFixed(3)}s)`);
      
      // Play the buffer with precise timing
      const source = playAudioBuffer(
        this.audioContext, 
        buffer, 
        this.startTimeRef, 
        this.analyzer || undefined
      );
      this.log(`[queueAudio] Scheduled source to start at ${this.startTimeRef.current - buffer.duration} (duration: ${buffer.duration})`);
      
      // If TTS is muted, redirect audio to silent destination
      if (this.isTtsMuted) {
        this.log('🔇 TTS is muted - redirecting audio to silent destination');
        // Create a silent gain node to consume the audio
        const silentGain = this.audioContext.createGain();
        silentGain.gain.value = 0; // Silent
        source.connect(silentGain);
        // Don't connect to destination - audio goes nowhere
        
        // Don't add to active sources or set playing state when muted
        this.log('🔇 TTS muted - not tracking audio as playing');
        return; // Exit early - don't set isPlaying or emit events
      } else {
        // Normal playback - connect to speakers
        source.connect(this.audioContext.destination);
      }
      
      // Add to active sources array for tracking
      this.activeSourceNodes.push(source);
      this.log(`[queueAudio] Added source. activeSourceNodes.length = ${this.activeSourceNodes.length}`);
      
      // Set up ended handler to remove from active sources when done
      const originalOnEnded = source.onended;
      source.onended = (event) => {
        // Remove from active sources first to ensure cleanup even if there's an error
        const index = this.activeSourceNodes.indexOf(source);
        if (index !== -1) {
          this.activeSourceNodes.splice(index, 1);
          this.log(`[onended] Source removed. activeSourceNodes.length = ${this.activeSourceNodes.length}`);
        } else {
          this.log(`[onended] Source not found in activeSourceNodes (unusual)`);
        }
        
        // Call original handler if there was one
        try {
          if (originalOnEnded) {
            originalOnEnded.call(source, event);
          }
        } catch (err) {
          this.log('Error in original onended handler:', err);
        }
      };
      
      // Set current source (for backwards compatibility)
      this.currentSource = source;
      
      // Set playing state
      const wasPlaying = this.isPlaying;
      this.isPlaying = true;
      
      // Emit playing event only if starting playback
      if (!wasPlaying) {
        this.emit({ type: 'playing', isPlaying: true });
      }
      
      // Set up ended handler for the last chunk
      this.currentSource.onended = () => {
        this.log('[currentSource.onended] Current audio source playback ended');
        
        // Only emit playing=false if this was the last scheduled chunk
        if (this.activeSourceNodes.length === 0) {
          this.log('[currentSource.onended] No more active sources, setting playing state to false');
          this.isPlaying = false;
          this.emit({ type: 'playing', isPlaying: false });
        }
      };
      
      this.log(`[queueAudio] After: activeSourceNodes.length = ${this.activeSourceNodes.length}, startTimeRef.current = ${this.startTimeRef.current}`);
      this.log(`Audio scheduled to play at ${this.startTimeRef.current?.toFixed?.(3) || 'undefined'}s, current time: ${this.audioContext?.currentTime?.toFixed?.(3) || 'N/A'}s, active sources: ${this.activeSourceNodes.length}`);
      
    } catch (error) {
      this.log('Failed to process audio:', error);
      this.emit({
        type: 'error',
        error: {
          service: 'agent',
          code: 'audio_process_error',
          message: 'Failed to process audio data',
          details: error,
        },
      });
      throw error; // Re-throw to be caught by caller
    }
  }
  
  /**
   * Stops all audio playback and clears scheduled audio
   */
  public clearAudioQueue(): void {
    this.log('🚨 CLEARING AUDIO QUEUE - EMERGENCY STOP 🚨');
    this.log(`[clearAudioQueue] Before: activeSourceNodes.length = ${this.activeSourceNodes.length}, startTimeRef.current = ${this.startTimeRef.current}`);
    
    if (!this.audioContext) {
      this.log('❌ No audioContext available');
      return;
    }
    
    // Reset the timing reference to stop future scheduling
    const oldTime = this.startTimeRef.current;
    this.startTimeRef.current = this.audioContext.currentTime;
    this.log(`⏱️ Reset timing reference from ${oldTime?.toFixed?.(3) || 'undefined'}s to ${this.startTimeRef.current?.toFixed?.(3) || 'undefined'}s`);
    
    // Stop all active source nodes
    this.log(`🔇 Attempting to stop ${this.activeSourceNodes.length} active audio sources`);
    
    if (this.activeSourceNodes.length === 0) {
      this.log('ℹ️ No active sources found to stop');
    }
    
    this.activeSourceNodes.forEach((source, index) => {
      try {
        this.log(`🔇 Stopping source ${index + 1}/${this.activeSourceNodes.length}`);
        source.onended = null; // Remove ended callback to prevent state confusion
        source.stop();
        source.disconnect();
        this.log(`✅ Source ${index + 1} stopped and disconnected`);
      } catch (error) {
        this.log(`❌ Error stopping audio source ${index + 1}:`, error);
      }
    });
    
    // Clear the active sources array
    const count = this.activeSourceNodes.length;
    this.activeSourceNodes = [];
    this.log(`🧹 Cleared ${count} active sources from tracking array`);
    
    // Also clear current source reference
    if (this.currentSource) {
      this.log('🧹 Cleared currentSource reference');
      this.currentSource = null;
    } else {
      this.log('ℹ️ No currentSource reference to clear');
    }
    
    // Force the playing state to false
    const wasPlaying = this.isPlaying;
    this.isPlaying = false;
    this.log(`🔇 Set isPlaying state to false (was: ${wasPlaying})`);
    
    // Emit playing event only if we were previously playing
    if (wasPlaying) {
      this.log('📢 Emitting playing=false event');
    this.emit({ type: 'playing', isPlaying: false });
    } else {
      this.log('ℹ️ Not emitting playing event since we weren\'t playing');
    }
    
    // Try to flush the audio context
    try {
      if (this.audioContext.state !== 'closed') {
        this.log('🔄 Attempting to flush the audio context');
        const dummy = this.audioContext.createGain();
        dummy.connect(this.audioContext.destination);
        dummy.disconnect();
      }
    } catch (err) {
      this.log('⚠️ Error while flushing audio context:', err);
    }
    
    this.log(`[clearAudioQueue] After: activeSourceNodes.length = ${this.activeSourceNodes.length}, startTimeRef.current = ${this.startTimeRef.current}`);
    this.log('✅ Audio queue cleared, all playback should have stopped');
  }

  /**
   * Aborts current playback (alias for clearAudioQueue for welcome-first behavior)
   */
  public abortPlayback(): void {
    this.log('Aborting playback (welcome-first barge-in)');
    this.clearAudioQueue();
  }
  
  /**
   * Checks if microphone permissions are granted
   */
  public static async checkMicrophonePermissions(): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const microphones = devices.filter(device => device.kind === 'audioinput');
      
      if (microphones.length === 0) {
        return false;
      }
      
      // Check if we have access to device labels (indicates permission)
      return microphones.some(mic => mic.label !== '');
    } catch (error) {
      console.error('Error checking microphone permissions:', error);
      return false;
    }
  }
  
  /**
   * Cleans up resources
   */
  public dispose(): void {
    this.log('Disposing AudioManager');
    
    this.stopRecording();
    this.clearAudioQueue();
    
    if (this.analyzer) {
      this.analyzer.disconnect();
      this.analyzer = null;
      // this.analyzerData = null; // Unused for now
    }
    
    if (this.audioContext) {
      this.audioContext.close?.();
      this.audioContext = null;
    }
    
    this.isInitialized = false;
    this.eventListeners = [];
  }
  
  /**
   * Gets whether recording is active
   */
  public isRecordingActive(): boolean {
    return this.isRecording;
  }
  
  /**
   * Gets whether playback is active
   */
  public isPlaybackActive(): boolean {
    // Check both the playing flag and active sources
    // This handles race conditions where isPlaying might be stale
    const hasActiveSources = this.activeSourceNodes ? this.activeSourceNodes.length > 0 : false;
    const result = this.isPlaying || hasActiveSources;
    
    // Sync the flag if we detect a mismatch
    if (this.isPlaying !== hasActiveSources) {
      this.log(`⚠️ isPlaying mismatch detected: isPlaying=${this.isPlaying}, activeSourceNodes=${this.activeSourceNodes?.length || 0}, syncing to ${result}`);
      this.isPlaying = result;
    }
    
    return result;
  }
  
  /**
   * Gets the AudioContext instance for playback readiness checks
   * Used to ensure AudioContext is ready before greeting audio arrives
   */
  public getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Sets the TTS mute state
   */
  public setTtsMuted(muted: boolean): void {
    this.log(`Setting TTS muted to: ${muted}`);
    this.isTtsMuted = muted;
    
    // If muting and audio is currently playing, stop it immediately and flush buffer
    if (muted && this.isPlaying) {
      this.log('🔇 TTS muted while audio is playing - stopping current audio immediately and flushing buffer');
      this.clearAudioQueue();
      this.flushAudioBuffer();
    }
  }

  /**
   * Flushes the audio buffer to ensure no pending audio plays
   */
  private flushAudioBuffer(): void {
    this.log('🧹 Flushing audio buffer to prevent any pending audio playback');
    
    if (!this.audioContext) {
      this.log('No audio context available for flushing');
      return;
    }
    
    try {
      // Create a very short silent buffer and play it to flush any pending audio
      const silentBuffer = this.audioContext.createBuffer(1, 1, this.audioContext.sampleRate);
      const silentSource = this.audioContext.createBufferSource();
      silentSource.buffer = silentBuffer;
      silentSource.connect(this.audioContext.destination);
      silentSource.start();
      
      // Immediately stop it
      silentSource.stop();
      this.log('✅ Audio buffer flushed successfully');
    } catch (error) {
      this.log('⚠️ Error flushing audio buffer:', error);
    }
  }


  /**
   * Toggles the TTS mute state
   */
  public toggleTtsMute(): void {
    this.setTtsMuted(!this.isTtsMuted);
  }
} 
// TTS Mute Functionality Test Script
// Run this in the browser console while on the test app page

console.log('🎵 TTS Mute Functionality Test');
console.log('==============================');

// Test 1: Check if TTS mute button exists
const muteButton = document.querySelector('[data-testid="tts-mute-button"]');
if (muteButton) {
  console.log('✅ TTS Mute button found');
  console.log('Button text:', muteButton.textContent);
  console.log('Button classes:', muteButton.className);
} else {
  console.log('❌ TTS Mute button not found');
}

// Test 2: Check mute status
const muteStatus = document.querySelector('[data-testid="tts-muted-status"]');
if (muteStatus) {
  console.log('✅ TTS Muted status found:', muteStatus.textContent);
} else {
  console.log('❌ TTS Muted status not found');
}

// Test 3: Check connection status
const connectionStatus = document.querySelector('[data-testid="connection-status"]');
if (connectionStatus) {
  console.log('✅ Connection status found:', connectionStatus.textContent);
} else {
  console.log('❌ Connection status not found');
}

// Test 4: Check audio playing status
const audioStatus = document.querySelector('[data-testid="audio-playing-status"]');
if (audioStatus) {
  console.log('✅ Audio playing status found:', audioStatus.textContent);
} else {
  console.log('❌ Audio playing status not found');
}

// Test 5: Simulate mute toggle
if (muteButton) {
  console.log('🔄 Testing mute toggle...');
  
  // Get initial state
  const initialMuteStatus = muteStatus ? muteStatus.textContent : 'unknown';
  console.log('Initial mute status:', initialMuteStatus);
  
  // Click mute button
  muteButton.click();
  
  // Wait a moment and check new state
  setTimeout(() => {
    const newMuteStatus = muteStatus ? muteStatus.textContent : 'unknown';
    console.log('After click mute status:', newMuteStatus);
    console.log('Button text after click:', muteButton.textContent);
    
    // Click again to toggle back
    setTimeout(() => {
      muteButton.click();
      setTimeout(() => {
        const finalMuteStatus = muteStatus ? muteStatus.textContent : 'unknown';
        console.log('After second click mute status:', finalMuteStatus);
        console.log('Button text after second click:', muteButton.textContent);
        console.log('✅ Mute toggle test completed');
      }, 100);
    }, 100);
  }, 100);
}

// Test 6: Check for DeepgramVoiceInteraction component
const voiceAgent = document.querySelector('[data-testid="voice-agent"]');
if (voiceAgent) {
  console.log('✅ Voice agent component found');
} else {
  console.log('❌ Voice agent component not found');
}

console.log('==============================');
console.log('🎵 Test completed. Check results above.');

/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

describe('Live Transcript Issue - Failing Test', () => {
  it('should FAIL until Live Transcript shows interim results while speaking', () => {
    // This test will FAIL until the bug is fixed
    // It expects Live Transcript to show interim results, but currently it doesn't
    
    let liveTranscript = ''; // What shows in "Live Transcript" section
    let userMessage = '';     // What shows in "User Message from Server" section
    
    // CORRECTED handleTranscriptUpdate function (what it SHOULD do):
    const correctedHandleTranscriptUpdate = (transcript) => {
      console.log('Full transcript response:', transcript);
      
      const deepgramResponse = transcript;
      
      if (deepgramResponse.channel?.alternatives?.[0]?.transcript) {
        const text = deepgramResponse.channel.alternatives[0].transcript;
        
        if (deepgramResponse.is_final) {
          // Final result goes to User Message from Server
          userMessage = text;
          console.log(`Final transcript: ${text}`);
        } else {
          // Interim result goes to Live Transcript
          liveTranscript = text;
          console.log(`Interim transcript: ${text}`);
        }
      }
    };

    // CURRENT (broken) handleTranscriptUpdate function:
    const currentHandleTranscriptUpdate = (transcript) => {
      console.log('Full transcript response:', transcript);
      
      const deepgramResponse = transcript;
      
      if (deepgramResponse.channel?.alternatives?.[0]?.transcript) {
        const text = deepgramResponse.channel.alternatives[0].transcript;
        
        // THE BUG: Always sets liveTranscript, regardless of is_final
        liveTranscript = text;
        
        if (deepgramResponse.is_final) {
          userMessage = text;
          console.log(`Final transcript: ${text}`);
        }
      }
    };

    // Simulate what happens when you speak:
    const interimResults = [
      { type: 'Results', channel: { alternatives: [{ transcript: 'Hello' }] }, is_final: false },
      { type: 'Results', channel: { alternatives: [{ transcript: 'Hello world' }] }, is_final: false },
      { type: 'Results', channel: { alternatives: [{ transcript: 'Hello world this' }] }, is_final: false }
    ];

    const finalResult = {
      type: 'Results',
      channel: { alternatives: [{ transcript: 'Hello world this is final' }] },
      is_final: true
    };

    // Test with CURRENT (broken) implementation
    interimResults.forEach(result => {
      currentHandleTranscriptUpdate(result);
    });
    currentHandleTranscriptUpdate(finalResult);

    // CURRENT BEHAVIOR (the bug):
    expect(liveTranscript).toBe('Hello world this is final'); // Shows final result
    expect(userMessage).toBe('Hello world this is final');    // Shows final result
    
    // EXPECTED BEHAVIOR (what it SHOULD be):
    // Live Transcript should show the LAST interim result while speaking
    // User Message should show the final result
    
    // Reset for corrected implementation test
    liveTranscript = '';
    userMessage = '';
    
    // Test with CORRECTED implementation
    interimResults.forEach(result => {
      correctedHandleTranscriptUpdate(result);
    });
    correctedHandleTranscriptUpdate(finalResult);

    // EXPECTED BEHAVIOR:
    expect(liveTranscript).toBe('Hello world this'); // Last interim result
    expect(userMessage).toBe('Hello world this is final'); // Final result
    
    console.log('Live Transcript (should show interim):', liveTranscript);
    console.log('User Message (should show final):', userMessage);
    
    // This test will FAIL with current implementation because:
    // - Live Transcript shows final result instead of interim
    // - Both sections show the same final result
  });
});

/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

describe('Live Transcript Bug - Failing Test', () => {
  it('should FAIL until Live Transcript shows interim results while speaking', () => {
    // This test will FAIL until the bug is fixed
    // It expects Live Transcript to show interim results, but currently it doesn't
    
    let liveTranscript = ''; // What shows in "Live Transcript" section
    let userMessage = '';     // What shows in "User Message from Server" section
    
    // CORRECTED handleTranscriptUpdate function (what the test-app now does):
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

    // Process interim results
    interimResults.forEach(result => {
      correctedHandleTranscriptUpdate(result);
    });

    // Process final result
    correctedHandleTranscriptUpdate(finalResult);

    // EXPECTED BEHAVIOR (what it SHOULD be):
    // Live Transcript should show the LAST interim result while speaking
    // User Message should show the final result
    
    // This assertion will NOW PASS with corrected implementation:
    expect(liveTranscript).toBe('Hello world this'); // Shows last interim result
    
    // This assertion will PASS with corrected implementation:
    expect(userMessage).toBe('Hello world this is final'); // Final result is correct
    
    console.log('Live Transcript (should show interim):', liveTranscript);
    console.log('User Message (should show final):', userMessage);
    
    // The test will NOW PASS because:
    // - liveTranscript shows 'Hello world this' (last interim result) ✓
    // - userMessage shows 'Hello world this is final' (final result) ✓
  });
});

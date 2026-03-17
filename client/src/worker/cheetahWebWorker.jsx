import { Cheetah } from '@picovoice/cheetah-web';

let cheetah = null;
let transcriptBuffer = '';
let lastSendTime = 0;
const THROTTLE_MS = 300; // Send updates every 300ms max

self.onmessage = async (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'INIT':
      try {
        // Lazy-load Cheetah with your access key
        cheetah = await Cheetah.create(
          payload.accessKey,
          { 
            publicPath: payload.modelPath,  // Path to .pv model file
            forceWrite: true 
          },
          { enableAutomaticPunctuation: true }
        );
        self.postMessage({ type: 'READY' });
      } catch (error) {
        self.postMessage({ type: 'ERROR', error: error.message });
      }
      break;

    case 'PROCESS_AUDIO':
      if (!cheetah) return;
      
      try {
        const { partialTranscript, isEndpoint } = await cheetah.process(payload.audioFrame);
        
        if (partialTranscript) {
          transcriptBuffer += partialTranscript;
        }

        // Throttled updates - don't send every word
        const now = Date.now();
        if (isEndpoint || now - lastSendTime > THROTTLE_MS) {
          if (transcriptBuffer.trim()) {
            self.postMessage({ 
              type: 'TRANSCRIPT', 
              transcript: transcriptBuffer,
              isFinal: isEndpoint 
            });
          }
          lastSendTime = now;
        }

        // Flush on endpoint (sentence end)
        if (isEndpoint) {
          const { transcript: remaining } = await cheetah.flush();
          if (remaining) {
            self.postMessage({ 
              type: 'TRANSCRIPT', 
              transcript: remaining,
              isFinal: true 
            });
          }
          transcriptBuffer = '';
        }
      } catch (error) {
        self.postMessage({ type: 'ERROR', error: error.message });
      }
      break;

    case 'STOP':
      if (cheetah) {
        const { transcript: final } = await cheetah.flush();
        if (final || transcriptBuffer) {
          self.postMessage({ 
            type: 'TRANSCRIPT', 
            transcript: transcriptBuffer + (final || ''),
            isFinal: true 
          });
        }
        transcriptBuffer = '';
      }
      break;

    case 'RELEASE':
      if (cheetah) {
        await cheetah.release();
        cheetah = null;
      }
      break;
  }
};
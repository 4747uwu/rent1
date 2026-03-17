import { useState, useRef, useCallback, useEffect } from 'react';

// ✅ Use Web Speech API - FREE, no model file, works immediately
export function useCheetahSpeech() {
  const [isListening, setIsListening] = useState(false);
  const [isReady] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');

  const browserSupportsSpeechRecognition = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Initialize
  const getRecognition = useCallback(() => {
    if (recognitionRef.current) return recognitionRef.current;
    if (!browserSupportsSpeechRecognition) return null;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }

      if (finalTranscript) {
        finalTranscriptRef.current += finalTranscript;
        setTranscript(finalTranscriptRef.current);
      }
    };

    recognition.onerror = (event) => {
      console.error('🎤 [Speech] Error:', event.error);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`Speech error: ${event.error}`);
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still listening
      if (recognitionRef.current?._shouldListen) {
        try { recognition.start(); } catch (e) {}
      }
    };

    recognitionRef.current = recognition;
    return recognition;
  }, [browserSupportsSpeechRecognition]);

  const startListening = useCallback(async () => {
    console.log('🎤 [Speech] Starting...');
    setError(null);
    
    const recognition = getRecognition();
    if (!recognition) {
      setError('Speech recognition not supported');
      return;
    }

    try {
      recognition._shouldListen = true;
      recognition.start();
      setIsListening(true);
      console.log('🎤 [Speech] Listening!');
    } catch (err) {
      if (err.name !== 'InvalidStateError') {
        setError(err.message);
      }
    }
  }, [getRecognition]);

  const stopListening = useCallback(async () => {
    console.log('🎤 [Speech] Stopping...');
    if (recognitionRef.current) {
      recognitionRef.current._shouldListen = false;
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    finalTranscriptRef.current = '';
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current._shouldListen = false;
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  return {
    transcript,
    isListening,
    isReady,
    error,
    startListening,
    stopListening,
    resetTranscript,
    browserSupportsSpeechRecognition
  };
}
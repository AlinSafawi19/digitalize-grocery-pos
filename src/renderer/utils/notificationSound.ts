/**
 * Play notification sound
 * Uses Web Audio API to generate a simple beep sound
 */

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export async function playNotificationSound(volume: number = 0.5): Promise<void> {
  try {
    // Ensure volume is within valid range (0 to 1)
    const clampedVolume = Math.max(0, Math.min(1, volume));
    
    // If volume is 0, don't play anything
    if (clampedVolume === 0) {
      return;
    }
    
    const AudioContextClass = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    
    const audioContext = new AudioContextClass();
    
    // Resume audio context if it's suspended (required for autoplay policies)
    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch (resumeError) {
        console.error('Error resuming audio context:', resumeError);
        // Continue anyway - might work on some browsers
      }
    }
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800; // Frequency in Hz
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(clampedVolume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (error) {
    console.error('Error playing notification sound:', error);
    throw error; // Re-throw so caller can handle it
  }
}



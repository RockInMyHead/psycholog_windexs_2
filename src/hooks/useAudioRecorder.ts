import { useCallback, useRef, useState } from "react";

export interface UseAudioRecorderOptions {
  mimeType?: string;
}

export interface UseAudioRecorderResult {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
}

export const useAudioRecorder = (
  options?: UseAudioRecorderOptions
): UseAudioRecorderResult => {
  const [mimeType, setMimeType] = useState<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  const getBestMimeType = useCallback(() => {
    if (options?.mimeType) return options.mimeType;
    
    if (typeof MediaRecorder === "undefined") return "audio/webm";

    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4", 
      "audio/aac",
      "audio/ogg",
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log("Using mime type:", type);
        return type;
      }
    }
    return ""; // Let browser choose
  }, [options?.mimeType]);

  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setHasPermission(true);
      return true;
    } catch (error) {
      console.error("Microphone permission denied:", error);
      setHasPermission(false);
      return false;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) throw new Error("Microphone access denied.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];
    
    const selectedMimeType = getBestMimeType();
    setMimeType(selectedMimeType);
    
    const options = selectedMimeType ? { mimeType: selectedMimeType } : undefined;
    const mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    });

    mediaRecorder.start();
    setIsRecording(true);
  }, [hasPermission, getBestMimeType, requestPermission]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    const mediaRecorder = mediaRecorderRef.current;

    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      return null;
    }

    return new Promise((resolve) => {
      mediaRecorder.addEventListener(
        "stop",
        () => {
          // Use the actual mime type from the recorder if available, or the selected one
          const finalMimeType = mediaRecorder.mimeType || mimeType || "audio/webm";
          const blob = new Blob(chunksRef.current, { type: finalMimeType });
          mediaRecorder.stream
            .getTracks()
            .forEach((track) => track.stop());
          mediaRecorderRef.current = null;
          chunksRef.current = [];
          setIsRecording(false);
          resolve(blob);
        },
        { once: true }
      );

      mediaRecorder.stop();
    });
  }, [mimeType]);

  return {
    isRecording,
    hasPermission,
    startRecording,
    stopRecording,
    requestPermission,
  };
};


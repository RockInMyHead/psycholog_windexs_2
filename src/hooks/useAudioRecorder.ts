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
      console.log("[AudioRecorder] Requesting microphone permission...");

      // Для Huawei/Android устройств пробуем разные настройки
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          channelCount: 1,
          // Дополнительные настройки для мобильных устройств
          autoGainControl: true,
          latency: 0.01,
        }
      };

      console.log("[AudioRecorder] Using audio constraints:", constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Проверяем, что стрим активен
      if (stream.active && stream.getAudioTracks().length > 0) {
        console.log("[AudioRecorder] Stream is active, tracks:", stream.getAudioTracks().length);
        stream.getTracks().forEach((track) => {
          console.log("[AudioRecorder] Track settings:", track.getSettings());
          track.stop();
        });
        setHasPermission(true);
        return true;
      } else {
        console.warn("[AudioRecorder] Stream is not active or has no audio tracks");
        stream.getTracks().forEach((track) => track.stop());
        setHasPermission(false);
        return false;
      }
    } catch (error) {
      console.error("[AudioRecorder] Microphone permission denied:", error);
      setHasPermission(false);
      return false;
    }
  }, []);

  const startRecording = useCallback(async () => {
    console.log("[AudioRecorder] Starting recording...");

    if (!hasPermission) {
      console.log("[AudioRecorder] No permission, requesting...");
      const granted = await requestPermission();
      if (!granted) throw new Error("Microphone access denied.");
    }

    // Проверяем поддержку MediaRecorder
    if (typeof MediaRecorder === "undefined") {
      throw new Error("MediaRecorder is not supported in this browser.");
    }

    console.log("[AudioRecorder] Getting user media stream...");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
        channelCount: 1,
        autoGainControl: true,
        latency: 0.01,
      }
    });

    console.log("[AudioRecorder] Stream obtained, active:", stream.active);
    chunksRef.current = [];

    const selectedMimeType = getBestMimeType();
    setMimeType(selectedMimeType);
    console.log("[AudioRecorder] Selected mime type:", selectedMimeType);

    const options = selectedMimeType ? { mimeType: selectedMimeType } : undefined;
    console.log("[AudioRecorder] Creating MediaRecorder with options:", options);

    const mediaRecorder = new MediaRecorder(stream, options);
    console.log("[AudioRecorder] MediaRecorder created, state:", mediaRecorder.state);

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


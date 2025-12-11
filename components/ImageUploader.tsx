import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Upload, X, Camera, ZoomIn, ZoomOut, Wand2, Scissors, Check, Zap, ZapOff, Monitor, RefreshCw, Mic, MicOff, Trash2, RotateCcw, CheckCircle2, AlertCircle, PlayCircle, PauseCircle, Volume2, VolumeX } from 'lucide-react';
import Cropper from 'react-easy-crop';

interface ImageUploaderProps {
  onImageSelect: (base64: string, mimeType: string) => void;
  onClear: () => void;
  isAnalyzing: boolean;
  onNotesChange?: (notes: string) => void;
  notesValue: string;
}

// Extended interface for MediaTrackCapabilities to include zoom and torch
interface ExtendedMediaTrackCapabilities extends MediaTrackCapabilities {
  zoom?: {
    min: number;
    max: number;
    step: number;
  };
  torch?: boolean;
}

// Utility to create an image element from a URL
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

// Utility to crop the image using canvas
async function getCroppedImg(imageSrc: string, pixelCrop: any) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return canvas.toDataURL('image/jpeg', 0.95);
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelect, onClear, isAnalyzing, onNotesChange, notesValue }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Camera Controls State
  const [resolution, setResolution] = useState<'HD' | 'FHD' | '4K'>('FHD');
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [capabilities, setCapabilities] = useState<ExtendedMediaTrackCapabilities | null>(null);
  const [showResMenu, setShowResMenu] = useState(false);

  // Zoom/Pan State (Preview)
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Crop State
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  // Voice State
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const notesValueRef = useRef(notesValue); // Ref to track current notes value for event listeners
  const baseNotesRef = useRef(""); // Ref to store notes at start of recording session
  
  // Audio Playback State
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Update ref when prop changes
  useEffect(() => {
    notesValueRef.current = notesValue;
  }, [notesValue]);

  // Check Speech Support on Mount
  useEffect(() => {
    if ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) {
      setIsSpeechSupported(true);
    }
  }, []);

  // Clean up camera stream and audio object URLs when component unmounts
  useEffect(() => {
    return () => {
      stopCamera();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch(e) {}
      }
      if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
      }
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setCameraError(null);
    setTorch(false);
    setZoom(1);
  };

  const getResolutionConstraints = (res: 'HD' | 'FHD' | '4K') => {
    switch (res) {
      case '4K': return { width: { ideal: 3840 }, height: { ideal: 2160 } };
      case 'FHD': return { width: { ideal: 1920 }, height: { ideal: 1080 } };
      case 'HD': default: return { width: { ideal: 1280 }, height: { ideal: 720 } };
    }
  };

  const startCamera = async () => {
    // Stop any existing stream first
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
    }

    try {
      const constraints = {
        video: {
          facingMode: 'environment',
          ...getResolutionConstraints(resolution)
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Get capabilities for Zoom and Flash
      const track = stream.getVideoTracks()[0];
      if (track.getCapabilities) {
        const caps = track.getCapabilities() as ExtendedMediaTrackCapabilities;
        setCapabilities(caps);
        // Set initial zoom if available
        if (caps.zoom) {
            setZoom(caps.zoom.min || 1);
        }
      }
      setTorch(false); // Reset torch state on new stream

    } catch (err) {
      console.error("Camera error:", err);
      setCameraError("Unable to access camera. Please allow permissions.");
      setIsCameraOpen(false);
    }
  };

  // Initialize camera when isCameraOpen changes or resolution changes
  useEffect(() => {
    if (isCameraOpen) {
      startCamera();
    } else {
        stopCamera();
    }
  }, [isCameraOpen, resolution]);

  const toggleTorch = async () => {
    if (streamRef.current && capabilities?.torch) {
      const track = streamRef.current.getVideoTracks()[0];
      try {
        await track.applyConstraints({
          advanced: [{ torch: !torch }]
        } as any);
        setTorch(!torch);
      } catch (e) {
        console.error("Failed to toggle torch", e);
      }
    }
  };

  const handleZoomChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(e.target.value);
    setZoom(newZoom);
    if (streamRef.current && capabilities?.zoom) {
      const track = streamRef.current.getVideoTracks()[0];
      try {
        await track.applyConstraints({
          advanced: [{ zoom: newZoom }]
        } as any);
      } catch (e) {
        console.error("Failed to set zoom", e);
      }
    }
  };

  const resetCameraSettings = async () => {
    const defaultResolution = 'FHD';
    const defaultZoom = capabilities?.zoom?.min || 1;

    // If resolution is not default, changing it triggers useEffect -> startCamera -> resets everything
    if (resolution !== defaultResolution) {
      setResolution(defaultResolution);
      return;
    }

    // Resolution matches default, manually reset zoom and torch
    setZoom(defaultZoom);
    setTorch(false);
    
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      
      // Reset Torch
      if (capabilities?.torch) {
        try {
          await track.applyConstraints({
            advanced: [{ torch: false }]
          } as any);
        } catch (e) {
          console.error("Failed to reset torch", e);
        }
      }
      
      // Reset Zoom
      if (capabilities?.zoom) {
        try {
          await track.applyConstraints({
            advanced: [{ zoom: defaultZoom }]
          } as any);
        } catch (e) {
          console.error("Failed to reset zoom", e);
        }
      }
    }
  };

  const handleCapture = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      // Set canvas size to video actual size
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        
        const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const base64Data = match[2];
          setPreview(dataUrl);
          setOriginalImage(dataUrl);
          setIsEnhanced(false);
          resetZoom();
          onImageSelect(base64Data, mimeType);
          stopCamera();
        }
      }
    }
  };

  const handleFile = useCallback((file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const match = result.match(/^data:(.+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const base64Data = match[2];
          setPreview(result);
          setOriginalImage(result);
          setIsEnhanced(false);
          resetZoom();
          onImageSelect(base64Data, mimeType);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [onImageSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const clearImage = () => {
    setPreview(null);
    setOriginalImage(null);
    setIsEnhanced(false);
    resetZoom();
    setIsCropping(false);
    onNotesChange?.("");
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    onClear();
  };

  const toggleEnhance = useCallback(async () => {
    if (!originalImage) return;

    if (isEnhanced) {
      setPreview(originalImage);
      const match = originalImage.match(/^data:(.+);base64,(.+)$/);
      if (match) {
        onImageSelect(match[2], match[1]);
      }
      setIsEnhanced(false);
    } else {
      try {
        const img = await createImage(originalImage);
        
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Apply filters for mole optimization (contrast + brightness + saturation)
        // Slightly tuned for better visibility of skin textures
        ctx.filter = 'contrast(1.2) brightness(1.1) saturate(1.1)';
        ctx.drawImage(img, 0, 0);

        const enhancedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        setPreview(enhancedDataUrl);
        
        const match = enhancedDataUrl.match(/^data:(.+);base64,(.+)$/);
        if (match) {
          onImageSelect(match[2], match[1]);
        }
        setIsEnhanced(true);
      } catch (e) {
        console.error("Failed to enhance image:", e);
      }
    }
  }, [originalImage, isEnhanced, onImageSelect]);

  // Zoom Logic
  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale(prev => {
      const newScale = Math.max(prev - 0.5, 1);
      if (newScale === 1) setPosition({ x: 0, y: 0 });
      return newScale;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      e.preventDefault();
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Crop Logic
  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const performCrop = async () => {
    if (preview && croppedAreaPixels) {
      try {
        const croppedImage = await getCroppedImg(preview, croppedAreaPixels);
        if (croppedImage) {
          setPreview(croppedImage);
          setOriginalImage(croppedImage); // Update original so enhance works on cropped version
          setIsEnhanced(false); // Reset enhance state as we have a new "original"
          
          const match = croppedImage.match(/^data:(.+);base64,(.+)$/);
          if (match) {
            onImageSelect(match[2], match[1]);
          }
          setIsCropping(false);
          resetZoom();
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Voice Note Logic
  const startRecording = async () => {
    setVoiceError(null);
    if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
    }
    
    // Check Speech Recognition support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
        setVoiceError("Voice recognition not supported in this browser.");
        return;
    }

    // Abort existing STT
    if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch(e) { console.warn(e); }
        recognitionRef.current = null;
    }

    // Start MediaRecorder for audio playback (parallel to STT)
    try {
         const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
         
         const mediaRecorder = new MediaRecorder(stream);
         mediaRecorderRef.current = mediaRecorder;
         audioChunksRef.current = [];

         mediaRecorder.ondataavailable = (event) => {
             if (event.data.size > 0) audioChunksRef.current.push(event.data);
         };

         mediaRecorder.onstop = () => {
             const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
             const url = URL.createObjectURL(blob);
             setAudioUrl(url);
             // Stop stream tracks to release mic
             stream.getTracks().forEach(t => t.stop());
         };

         mediaRecorder.start();
    } catch (e) {
        console.warn("Audio recording initialization failed", e);
        setVoiceError("Microphone access failed for audio recording.");
        return;
    }

    // Start STT
    try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        baseNotesRef.current = notesValue || "";

        recognition.onstart = () => {
            setIsRecording(true);
            setVoiceError(null);
        };

        recognition.onresult = (event: any) => {
            // Reconstruct full session transcript
            let sessionTranscript = '';
            for (let i = 0; i < event.results.length; ++i) {
                sessionTranscript += event.results[i][0].transcript;
            }
            
            const currentBase = baseNotesRef.current;
            const separator = (currentBase && !/\s$/.test(currentBase)) ? ' ' : '';
            const newText = currentBase + separator + sessionTranscript;
            
            if (newText !== notesValueRef.current) {
                onNotesChange?.(newText);
            }
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error:", event.error);
            if (event.error === 'not-allowed' || event.error === 'permission-denied') {
                setVoiceError("Microphone access denied.");
                setIsRecording(false);
            } else if (event.error === 'no-speech') {
                // Ignore silent timeouts
            } else if (event.error === 'aborted') {
                setIsRecording(false);
            } else {
                setVoiceError(`Error: ${event.error}`);
                setIsRecording(false);
            }
        };

        recognition.onend = () => {
             setIsRecording(false);
             recognitionRef.current = null;
             // Ensure media recorder stops if STT stops naturally
             if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                 mediaRecorderRef.current.stop();
             }
        };

        recognitionRef.current = recognition;
        recognition.start();
    } catch (e) {
        console.error("Failed to start speech recognition", e);
        setVoiceError("Could not start voice recognition.");
        setIsRecording(false);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
             mediaRecorderRef.current.stop();
        }
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
        try {
            recognitionRef.current.stop();
        } catch (e) { console.error(e); }
        setIsRecording(false);
    }
    // Backup stop for MediaRecorder if event listener fails
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
  };

  // Audio Control Handlers
  const togglePlayback = () => {
      if (!audioRef.current || !audioUrl) return;
      if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
      } else {
          audioRef.current.play();
          setIsPlaying(true);
      }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
        audioRef.current.currentTime = 0;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      setIsMuted(vol === 0);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const newMute = !isMuted;
      setIsMuted(newMute);
      audioRef.current.muted = newMute;
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleNotesChangeLocal = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onNotesChange?.(e.target.value);
  };

  const handleClearNotes = () => {
      onNotesChange?.("");
      baseNotesRef.current = "";
      setVoiceError(null);
      if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
          setAudioUrl(null);
      }
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      if (isRecording) {
        stopRecording();
      }
  };

  const handleReRecord = () => {
      handleClearNotes();
      setTimeout(() => {
          startRecording();
      }, 100);
  };

  const renderNotesSection = () => (
    <div className={`mt-6 mb-2 relative z-20 transition-all duration-300 ${notesValue ? 'bg-emerald-50/50' : ''} rounded-xl p-2`}>
        <div className="mb-2 px-1">
            <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Mic className="w-4 h-4 text-blue-600" />
                    Patient Notes
                    {notesValue && !isRecording && (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Ready
                        </span>
                    )}
                    {isRecording && (
                         <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full animate-pulse border border-red-200">
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span> Listening...
                         </span>
                    )}
                </label>
            </div>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
               <span className="font-semibold text-slate-600">Tip:</span> Mention onset date, recent changes (shape, size, color), symptoms (itching, bleeding), and any family history of skin cancer.
            </p>
        </div>
        
        {voiceError && (
             <div className="mb-2 px-3 py-2 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100 flex items-center gap-2">
                <AlertCircle className="w-3 h-3" /> {voiceError}
             </div>
        )}

        {/* Audio Player Element (Hidden, Logic Only) */}
        <audio 
            ref={audioRef} 
            src={audioUrl || undefined} 
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleAudioEnded}
            className="hidden" 
        />

        <div className="relative group">
            <textarea
                value={notesValue}
                onChange={handleNotesChangeLocal}
                disabled={isRecording} 
                placeholder={isRecording ? "Listening..." : "Example: 'I noticed this mole 3 months ago on my arm. It has grown slightly darker and itches occasionally...'"}
                className={`w-full p-4 pr-12 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] resize-y shadow-sm transition-all outline-none ${
                    isRecording 
                      ? 'border-2 border-red-400 ring-2 ring-red-100 bg-red-50 text-slate-800'
                      : notesValue 
                        ? 'border-2 border-emerald-400 bg-white text-slate-800' 
                        : 'border border-slate-300 bg-white text-slate-600'
                }`}
            />
            
            {/* Controls */}
            <div className="absolute bottom-3 right-3 flex gap-2">
                {notesValue && !isRecording && (
                    <>
                        <button
                            type="button"
                            onClick={handleClearNotes}
                            className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors shadow-sm border border-slate-200"
                            title="Delete Notes"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={handleReRecord}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors shadow-sm border border-blue-200 text-xs font-bold"
                            title="Clear and Record New"
                        >
                            <RotateCcw className="w-3.5 h-3.5" /> Re-record
                        </button>
                    </>
                )}
                
                {isSpeechSupported ? (
                    <button
                        type="button"
                        onClick={toggleRecording}
                        className={`p-2 rounded-lg transition-all shadow-sm border flex items-center gap-2 ${
                            isRecording
                            ? 'bg-red-500 text-white border-red-600 hover:bg-red-600 animate-pulse'
                            : 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
                        }`}
                        title={isRecording ? "Stop Recording" : "Start Voice Recording"}
                    >
                        {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        {isRecording && <span className="text-xs font-bold pr-1">Stop</span>}
                    </button>
                ) : (
                    <button 
                        type="button" 
                        className="p-2 rounded-lg bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200" 
                        title="Voice recognition not supported"
                        disabled
                    >
                        <MicOff className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>

        {/* Custom Audio Player UI */}
        {audioUrl && !isRecording && (
            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-1">
                <button
                    type="button"
                    onClick={togglePlayback}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    {isPlaying ? <PauseCircle className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
                </button>

                <div className="flex-grow flex flex-col gap-1 min-w-0">
                    <input
                        type="range"
                        min="0"
                        max={duration || 100}
                        value={currentTime}
                        onChange={handleSeek}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-sm focus:outline-none"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-medium font-mono px-0.5">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 border-l border-slate-200 pl-3">
                     <button type="button" onClick={toggleMute} className="text-slate-400 hover:text-slate-600 transition-colors">
                        {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                     </button>
                     <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-16 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-slate-500 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-slate-600 focus:outline-none"
                     />
                </div>
            </div>
        )}
        
        {notesValue && !isRecording && (
            <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1.5 font-medium px-1">
                <Check className="w-3 h-3" /> Notes will be included in the analysis.
            </p>
        )}
    </div>
  );

  if (preview) {
    return (
      <div className="w-full max-w-md mx-auto flex flex-col">
        <div className="relative w-full rounded-2xl overflow-hidden shadow-xl border-4 border-[#DC143C] bg-slate-900 group select-none">
          
          {/* Crop Mode Overlay */}
          {isCropping ? (
            <div className="relative w-full h-[350px] bg-black">
                <Cropper
                  image={preview}
                  crop={crop}
                  zoom={cropZoom}
                  aspect={aspect}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setCropZoom}
                  objectFit="contain"
                />
                
                {/* Aspect Ratio Controls */}
                <div className="absolute bottom-16 left-0 right-0 z-50 flex items-center justify-center gap-2 pointer-events-none">
                  <div className="flex bg-black/60 backdrop-blur-md rounded-full p-1 border border-white/10 pointer-events-auto">
                      <button type="button" onClick={() => setAspect(undefined)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${aspect === undefined ? 'bg-white text-black' : 'text-white hover:bg-white/20'}`}>Free</button>
                      <button type="button" onClick={() => setAspect(1)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${aspect === 1 ? 'bg-white text-black' : 'text-white hover:bg-white/20'}`}>1:1</button>
                      <button type="button" onClick={() => setAspect(4/3)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${aspect === 4/3 ? 'bg-white text-black' : 'text-white hover:bg-white/20'}`}>4:3</button>
                  </div>
                </div>

                <div className="absolute bottom-4 left-0 right-0 z-50 flex items-center justify-center gap-4">
                  <button type="button" onClick={() => setIsCropping(false)} className="flex items-center gap-2 px-4 py-2 bg-[#DC143C]/90 text-white rounded-full shadow-lg hover:bg-[#DC143C] transition-colors backdrop-blur-sm text-sm font-medium"><X className="w-4 h-4" /> Cancel</button>
                  <button type="button" onClick={performCrop} className="flex items-center gap-2 px-4 py-2 bg-green-600/90 text-white rounded-full shadow-lg hover:bg-green-700 transition-colors backdrop-blur-sm text-sm font-medium"><Check className="w-4 h-4" /> Apply</button>
                </div>
            </div>
          ) : (
            <>
              {/* Zoom Controls Overlay */}
              {!isAnalyzing && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-900/70 backdrop-blur-md p-1.5 rounded-full border border-slate-700 shadow-lg transition-opacity duration-200">
                      <button type="button" onClick={handleZoomOut} className="p-1.5 text-white hover:bg-white/20 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={scale <= 1} title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
                      <span className="text-xs font-medium text-white min-w-[32px] text-center font-mono">{Math.round(scale * 100)}%</span>
                      <button type="button" onClick={handleZoomIn} className="p-1.5 text-white hover:bg-white/20 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={scale >= 4} title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
                  </div>
              )}

              <div 
                  className="overflow-hidden w-full h-full relative flex items-center justify-center bg-black"
                  style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default', minHeight: '180px' }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
              >
                  {/* Reduced Max Height for mobile optimization to show notes below */}
                  <img 
                  src={preview} 
                  alt="Upload preview" 
                  className="w-full h-auto object-contain max-h-[200px] sm:max-h-[260px] transition-transform duration-100 ease-out will-change-transform"
                  style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}
                  draggable={false}
                  />
              </div>

              {!isAnalyzing && (
              <>
                  <div className="absolute top-4 left-4 z-20 flex flex-col gap-3">
                      <button type="button" onClick={toggleEnhance} className={`p-2 rounded-full shadow-lg transition-all transform hover:scale-105 ${isEnhanced ? 'bg-blue-600 text-white hover:bg-blue-700 ring-2 ring-white/50' : 'bg-white/80 backdrop-blur-md text-slate-700 hover:bg-white'}`} title={isEnhanced ? "Revert to Original" : "Auto-Enhance Image"}><Wand2 className="w-4 h-4" /></button>
                      <button type="button" onClick={() => { setIsCropping(true); setCrop({ x: 0, y: 0 }); setCropZoom(1); setAspect(undefined); }} className="bg-white/80 backdrop-blur-md text-slate-700 hover:bg-white p-2 rounded-full shadow-lg transition-all transform hover:scale-105" title="Crop Image"><Scissors className="w-4 h-4" /></button>
                  </div>
                  <button type="button" onClick={clearImage} className="absolute top-4 right-4 z-20 bg-white/80 backdrop-blur-md hover:bg-white text-slate-700 p-2 rounded-full shadow-lg transition-all transform hover:scale-105" title="Clear Image"><X className="w-4 h-4" /></button>
              </>
              )}
            </>
          )}
        </div>
        {/* Notes Section - Rendered outside the overflow-hidden image card, ensuring it takes up space in flow */}
        {renderNotesSection()}
      </div>
    );
  }

  if (isCameraOpen) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="relative w-full rounded-2xl overflow-hidden shadow-xl bg-black border-4 border-[#DC143C] aspect-[3/4] md:aspect-video flex flex-col">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover flex-1" />
          
          <div className="absolute top-0 left-0 right-0 p-4 flex items-start justify-between z-20 bg-gradient-to-b from-black/60 to-transparent">
            <div className="relative">
                <button type="button" onClick={() => setShowResMenu(!showResMenu)} className="flex items-center gap-1.5 text-xs font-bold text-white bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 hover:bg-black/60 transition-colors"><Monitor className="w-3 h-3" /> {resolution}</button>
                {showResMenu && (
                    <div className="absolute top-full left-0 mt-2 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden flex flex-col shadow-xl animate-in fade-in zoom-in-95 duration-150">
                      {(['HD', 'FHD', '4K'] as const).map(res => (
                          <button key={res} type="button" onClick={() => { setResolution(res); setShowResMenu(false); }} className={`px-4 py-2 text-xs text-left hover:bg-white/20 transition-colors ${resolution === res ? 'text-blue-400 font-bold' : 'text-white'}`}>{res}</button>
                      ))}
                    </div>
                )}
            </div>
            <div className="flex gap-4">
                {capabilities?.torch && (
                    <button type="button" onClick={toggleTorch} className={`p-2 rounded-full transition-colors backdrop-blur-md ${torch ? 'bg-yellow-400 text-black shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'bg-black/40 text-white hover:bg-black/60'}`} title={torch ? "Turn Flash Off" : "Turn Flash On"}>{torch ? <Zap className="w-5 h-5 fill-black" /> : <ZapOff className="w-5 h-5" />}</button>
                )}
                <button type="button" onClick={resetCameraSettings} className="bg-black/40 text-white p-2 rounded-full hover:bg-black/60 transition-colors backdrop-blur-md" title="Reset Settings (Zoom, Flash, Resolution)"><RefreshCw className="w-5 h-5" /></button>
                <button type="button" onClick={stopCamera} className="bg-black/40 text-white p-2 rounded-full hover:bg-red-500/80 transition-colors backdrop-blur-md" title="Close Camera"><X className="w-5 h-5" /></button>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col items-center z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-12">
            {capabilities?.zoom && (
                <div className="w-full max-w-[200px] mb-6 flex items-center gap-3">
                    <span className="text-[10px] font-bold text-white bg-black/50 px-1.5 py-0.5 rounded">1x</span>
                    <input type="range" min={capabilities.zoom.min || 1} max={Math.min(capabilities.zoom.max || 4, 8)} step={0.1} value={zoom} onChange={handleZoomChange} className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg" />
                    <span className="text-[10px] font-bold text-white bg-black/50 px-1.5 py-0.5 rounded">{Math.round(zoom * 10) / 10}x</span>
                </div>
            )}
            <button type="button" onClick={handleCapture} className="group relative" aria-label="Capture photo">
              <div className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center transition-transform transform group-active:scale-95 shadow-lg">
                <div className="w-14 h-14 bg-white rounded-full border-2 border-slate-300 group-hover:bg-slate-100 transition-colors"></div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {cameraError && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 flex items-center gap-2">
            <X className="w-4 h-4" /> {cameraError}
        </div>
      )}

      <label
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ease-in-out ${dragActive ? 'border-blue-500 bg-blue-50 scale-[1.02]' : 'border-[#DC143C] bg-slate-50 hover:bg-white'}`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
          <div className="mb-3 p-3 bg-white rounded-full shadow-sm">
            <Upload className={`w-6 h-6 ${dragActive ? 'text-blue-500' : 'text-slate-400'}`} />
          </div>
          <p className="mb-1 text-sm text-slate-700 font-medium"><span className="font-semibold text-blue-600">Click to upload</span> or drag and drop</p>
          <p className="text-xs text-slate-500">JPEG or PNG</p>
        </div>
        <input type="file" className="hidden" onChange={handleChange} accept="image/*" />
      </label>

      <div className="flex items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="mx-4 text-xs text-slate-400 uppercase font-semibold">Or</span>
          <div className="flex-grow border-t border-slate-200"></div>
      </div>

      <button type="button" onClick={() => setIsCameraOpen(true)} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white border border-slate-300 text-slate-700 rounded-xl font-medium shadow-sm hover:bg-slate-50 hover:border-slate-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
        <Camera className="w-5 h-5" /> Take Photo
      </button>

      {/* Notes Section in default view */}
      {renderNotesSection()}
    </div>
  );
};
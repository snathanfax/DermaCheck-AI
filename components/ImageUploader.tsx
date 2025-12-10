import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Upload, X, Camera, ZoomIn, ZoomOut, Maximize, Move } from 'lucide-react';

interface ImageUploaderProps {
  onImageSelect: (base64: string, mimeType: string) => void;
  onClear: () => void;
  isAnalyzing: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelect, onClear, isAnalyzing }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Zoom/Pan State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Clean up camera stream when component unmounts
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Initialize camera stream when isCameraOpen becomes true
  useEffect(() => {
    if (isCameraOpen && !streamRef.current) {
      const initCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Camera error:", err);
          setCameraError("Unable to access camera. Please allow permissions.");
          setIsCameraOpen(false);
        }
      };
      initCamera();
    }
  }, [isCameraOpen]);

  const handleStopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setCameraError(null);
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
          resetZoom();
          onImageSelect(base64Data, mimeType);
          handleStopCamera();
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
    resetZoom();
    onClear();
  };

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

  const handleResetZoom = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    resetZoom();
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

  if (preview) {
    return (
      <div className="relative w-full max-w-md mx-auto rounded-2xl overflow-hidden shadow-xl border-4 border-white bg-slate-900 group select-none">
        {/* Zoom Controls Overlay */}
        {!isAnalyzing && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-900/70 backdrop-blur-md p-1.5 rounded-full border border-slate-700 shadow-lg transition-opacity duration-200">
                <button 
                  onClick={handleZoomOut} 
                  className="p-1.5 text-white hover:bg-white/20 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                  disabled={scale <= 1}
                  title="Zoom Out"
                >
                    <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-medium text-white min-w-[32px] text-center font-mono">
                  {Math.round(scale * 100)}%
                </span>
                <button 
                  onClick={handleZoomIn} 
                  className="p-1.5 text-white hover:bg-white/20 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                  disabled={scale >= 4}
                  title="Zoom In"
                >
                    <ZoomIn className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-slate-600 mx-1"></div>
                <button 
                  onClick={handleResetZoom} 
                  className="p-1.5 text-white hover:bg-white/20 rounded-full transition-colors" 
                  title="Reset View"
                >
                    <Maximize className="w-4 h-4" />
                </button>
            </div>
          )}

          <div 
            className="overflow-hidden w-full h-full relative flex items-center justify-center bg-black"
            style={{ 
                cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                minHeight: '300px'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
             <img 
               src={preview} 
               alt="Upload preview" 
               className="w-full h-auto object-contain max-h-[500px] transition-transform duration-100 ease-out will-change-transform"
               style={{ 
                 transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`
               }}
               draggable={false}
             />
          </div>

        {!isAnalyzing && (
          <button
            onClick={clearImage}
            className="absolute top-4 right-4 z-20 bg-white/80 backdrop-blur-md hover:bg-white text-slate-700 p-2 rounded-full shadow-lg transition-all transform hover:scale-105"
            title="Clear Image"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {scale > 1 && !isDragging && (
            <div className="absolute top-4 left-4 z-10 bg-black/40 backdrop-blur-sm text-white px-2 py-1 rounded text-[10px] pointer-events-none flex items-center gap-1 animate-in fade-in duration-300">
                <Move className="w-3 h-3" /> Drag to pan
            </div>
        )}
      </div>
    );
  }

  if (isCameraOpen) {
    return (
      <div className="relative w-full max-w-md mx-auto rounded-2xl overflow-hidden shadow-xl bg-black aspect-[3/4] md:aspect-video flex flex-col">
        <video 
          ref={videoRef}
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover flex-1"
        />
        
        {/* Camera Overlay Controls */}
        <div className="absolute top-4 right-4 z-10">
           <button
            onClick={handleStopCamera}
            className="bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10">
          <button
            onClick={handleCapture}
            className="group relative"
            aria-label="Capture photo"
          >
             <div className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center transition-transform transform group-active:scale-90">
               <div className="w-12 h-12 bg-white rounded-full"></div>
             </div>
          </button>
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

      {/* Drop Zone */}
      <label
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ease-in-out
          ${dragActive 
            ? 'border-blue-500 bg-blue-50 scale-[1.02]' 
            : 'border-slate-300 bg-slate-50 hover:bg-white hover:border-slate-400'
          }`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
          <div className="mb-3 p-3 bg-white rounded-full shadow-sm">
            <Upload className={`w-6 h-6 ${dragActive ? 'text-blue-500' : 'text-slate-400'}`} />
          </div>
          <p className="mb-1 text-sm text-slate-700 font-medium">
            <span className="font-semibold text-blue-600">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-slate-500">
            JPEG or PNG
          </p>
        </div>
        <input 
          type="file" 
          className="hidden" 
          onChange={handleChange} 
          accept="image/*"
        />
      </label>

      {/* Divider */}
      <div className="flex items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="mx-4 text-xs text-slate-400 uppercase font-semibold">Or</span>
          <div className="flex-grow border-t border-slate-200"></div>
      </div>

      {/* Camera Button */}
      <button
        onClick={() => setIsCameraOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white border border-slate-300 text-slate-700 rounded-xl font-medium shadow-sm hover:bg-slate-50 hover:border-slate-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
      >
        <Camera className="w-5 h-5" />
        Take Photo
      </button>
    </div>
  );
};

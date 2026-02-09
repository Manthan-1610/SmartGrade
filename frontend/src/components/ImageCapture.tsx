/**
 * ImageCapture Component
 * 
 * Handles image upload via file selection, drag-drop, or camera capture.
 * Shows processing state with progress indicator.
 */
import { useState, useRef, useCallback, memo } from 'react';
import { Upload, Camera, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button, ProgressBar } from '@/components/ui';

interface ImageCaptureProps {
  /** Callback when an image is selected */
  onImageSelect: (file: File) => void;
  /** Whether the image is being processed */
  isProcessing: boolean;
  /** Upload/processing progress (0-100) */
  progress: number;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_SIZE_MB = 10;

export const ImageCapture = memo(function ImageCapture({ 
  onImageSelect, 
  isProcessing, 
  progress 
}: ImageCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!file.type.startsWith('image/')) {
      return 'Please select an image file';
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `Unsupported format. Use JPG, PNG, or WebP`;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File too large. Maximum size is ${MAX_SIZE_MB}MB`;
    }
    return null;
  }, []);

  const handleFile = useCallback((file: File) => {
    setError(null);
    
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsDataURL(file);

    onImageSelect(file);
  }, [onImageSelect, validateFile]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const clearPreview = useCallback(() => {
    setPreview(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, []);

  const getProgressLabel = () => {
    if (progress < 30) return 'Uploading image...';
    if (progress < 60) return 'Preprocessing...';
    if (progress < 90) return 'Extracting text with AI...';
    return 'Finalizing...';
  };

  return (
    <div className="space-y-4">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Error Display */}
      {error && (
        <div 
          role="alert"
          className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm animate-fade-in"
        >
          {error}
        </div>
      )}

      {/* Preview or Upload Area */}
      {preview ? (
        <div className="relative animate-scale-in">
          {/* Image Preview */}
          <div className="relative rounded-xl overflow-hidden border border-border bg-bg-card">
            <img
              src={preview}
              alt="Selected exam paper preview"
              className="w-full max-h-[400px] object-contain"
            />
            
            {/* Processing Overlay */}
            {isProcessing && (
              <div 
                className="absolute inset-0 bg-bg-primary/90 flex flex-col items-center justify-center"
                role="status"
                aria-live="polite"
              >
                <div className="relative mb-6">
                  <Loader2 className="w-14 h-14 text-primary animate-spin" aria-hidden="true" />
                  <div className="absolute inset-0 animate-pulse-glow rounded-full" />
                </div>
                
                <p className="text-text-primary font-semibold text-lg mb-2">
                  Processing...
                </p>
                <p className="text-text-secondary text-sm mb-4">
                  {getProgressLabel()}
                </p>
                
                <div className="w-64">
                  <ProgressBar 
                    value={progress} 
                    variant="default"
                    size="md"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Clear Button */}
          {!isProcessing && (
            <button
              onClick={clearPreview}
              className="
                absolute top-3 right-3 p-2 
                bg-bg-primary/80 backdrop-blur-sm rounded-full 
                hover:bg-danger/20 transition-colors
                focus:outline-none focus:ring-2 focus:ring-danger
              "
              aria-label="Remove selected image"
            >
              <X className="w-5 h-5 text-text-primary hover:text-danger" aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        /* Drop Zone */
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          aria-label="Upload area. Click or drag an image here."
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`
            relative rounded-xl border-2 border-dashed p-10 transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
            focus:ring-offset-bg-primary cursor-pointer
            ${dragActive 
              ? 'border-primary bg-primary/10 scale-[1.01]' 
              : 'border-border hover:border-primary/50 hover:bg-bg-card/50'
            }
          `}
        >
          <div className="flex flex-col items-center text-center">
            <div className="p-4 bg-bg-card rounded-full mb-5 shadow-lg">
              <ImageIcon 
                className={`w-10 h-10 transition-colors ${dragActive ? 'text-primary' : 'text-text-muted'}`} 
                aria-hidden="true" 
              />
            </div>
            
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Upload Answer Sheet
            </h3>
            <p className="text-sm text-text-secondary mb-6 max-w-sm">
              Drag and drop an image here, or use the buttons below
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant="primary"
                onClick={() => fileInputRef.current?.click()}
                leftIcon={<Upload className="w-4 h-4" aria-hidden="true" />}
              >
                Choose File
              </Button>
              
              <Button
                type="button"
                variant="secondary"
                onClick={() => cameraInputRef.current?.click()}
                leftIcon={<Camera className="w-4 h-4" aria-hidden="true" />}
              >
                Take Photo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Supported Formats */}
      <p className="text-xs text-text-muted text-center">
        Supported: JPG, PNG, WebP • Max size: {MAX_SIZE_MB}MB
      </p>
    </div>
  );
});

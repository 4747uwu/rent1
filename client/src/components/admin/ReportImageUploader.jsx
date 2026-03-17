import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Upload, X, ZoomIn, ZoomOut, Check, Image as ImageIcon } from 'lucide-react';
import { getCroppedImg, readFile } from '../../utils/canvasUtils';
import toast from 'react-hot-toast';

const ReportImageUploader = ({ 
  label, 
  currentImage, 
  onSave, 
  aspectRatio = 5,
  type = 'header', // 'header' or 'footer'
  loading = false 
}) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. User selects file
  const onFileChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }

      try {
        const imageDataUrl = await readFile(file);
        setImageSrc(imageDataUrl);
        setIsModalOpen(true);
        setZoom(1);
        setCrop({ x: 0, y: 0 });
      } catch (error) {
        console.error('Error reading file:', error);
        toast.error('Failed to load image');
      }
    }
  };

  // 2. User adjusts the crop (YouTube style)
  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // 3. User clicks "Save"
  const handleSave = async () => {
    if (!croppedAreaPixels) {
      toast.error('Please select a crop area');
      return;
    }

    setIsProcessing(true);
    try {
      // Convert the crop area to a real image file (Blob)
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      
      // Send this 'croppedImageBlob' to your Backend/Wasabi function
      await onSave(croppedImageBlob, type);
      
      toast.success(`${label} updated successfully!`);
      setIsModalOpen(false);
      setImageSrc(null);
    } catch (error) {
      console.error('Error cropping image:', error);
      toast.error('Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setImageSrc(null);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  };

  return (
    <div className="border-2 border-gray-200 p-6 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-blue-600" />
          {label}
        </h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          Ratio {aspectRatio}:1
        </span>
      </div>
      
      {/* Current Preview */}
      <div 
        className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden relative mb-4 hover:border-blue-400 transition-colors"
        style={{ aspectRatio: aspectRatio, minHeight: '120px' }}
      >
        {currentImage ? (
          <>
            <img 
              src={currentImage} 
              alt={label} 
              className="w-full h-full object-contain p-2"
            />
            <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
              <Check className="w-3 h-3" />
              Active
            </div>
          </>
        ) : (
          <div className="text-center p-4">
            <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <span className="text-gray-400 text-sm block">No image uploaded</span>
            <span className="text-gray-300 text-xs">Upload to enable in reports</span>
          </div>
        )}
      </div>

      {/* Upload Button */}
      <div className="flex gap-2">
        <input 
          type="file" 
          accept="image/png,image/jpeg,image/jpg,image/webp" 
          onChange={onFileChange} 
          className="hidden" 
          id={`upload-${type}`}
          disabled={loading}
        />
        <label 
          htmlFor={`upload-${type}`}
          className={`flex-1 cursor-pointer bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-lg text-sm font-medium hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Upload className="w-4 h-4" />
          {currentImage ? 'Change Image' : 'Upload Image'}
        </label>
      </div>

      <p className="text-xs text-gray-500 mt-3 text-center">
        Max 5MB • PNG, JPG, WEBP • Will be cropped to {aspectRatio}:1 ratio
      </p>

      {/* Cropper Modal (YouTube Style) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
          {/* Header */}
          <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg">Crop {label}</h3>
              <p className="text-sm text-gray-400">Drag to reposition, scroll to zoom</p>
            </div>
            <button 
              onClick={handleCancel}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              disabled={isProcessing}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Cropper Area */}
          <div className="relative flex-1 bg-black">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspectRatio}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
              cropShape="rect"
              showGrid={true}
              style={{
                containerStyle: {
                  backgroundColor: '#000'
                },
                mediaStyle: {
                  maxWidth: '100%',
                  maxHeight: '100%'
                }
              }}
            />
          </div>

          {/* Controls Footer */}
          <div className="bg-gray-900 text-white p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <ZoomOut className="w-5 h-5 text-gray-400" />
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((zoom - 1) / 2) * 100}%, #374151 ${((zoom - 1) / 2) * 100}%, #374151 100%)`
                }}
              />
              <ZoomIn className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-400 ml-2 min-w-[60px]">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={handleCancel}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={isProcessing}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Apply & Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportImageUploader;
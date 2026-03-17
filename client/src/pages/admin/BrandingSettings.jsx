import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Sparkles, Eye, EyeOff, FileText, Search, X, Upload, Image as ImageIcon, Edit3, Trash2, Check, RotateCw, Move, Maximize2, Save } from 'lucide-react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import toast from 'react-hot-toast';

const BrandingSettings = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [labs, setLabs] = useState([]);
  const [selectedLab, setSelectedLab] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // ✅ UPDATED: Header/footer heights in PIXELS instead of mm
  const [headerHeight, setHeaderHeight] = useState(120); // ~30mm converted to pixels
  const [footerHeight, setFooterHeight] = useState(80);  // ~20mm converted to pixels
  const [isDragging, setIsDragging] = useState({ type: null, active: false });
  
  // ✅ NEW: Input field states for manual entry
  const [headerInput, setHeaderInput] = useState('120');
  const [footerInput, setFooterInput] = useState('80');
  
  // ✅ NEW: React Image Crop states - NO MORE CUSTOM CANVAS FLICKERING!
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropType, setCropType] = useState(null);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [crop, setCrop] = useState({
    unit: '%',
    x: 25,
    y: 25,
    width: 50,
    height: 50
  });
  const [completedCrop, setCompletedCrop] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  
  // ✅ NEW: Pending changes management with size tracking
  const [pendingChanges, setPendingChanges] = useState({
    header: null,
    footer: null
  });

  // ✅ NEW: Flash animation state for size matches 
  const [flashAnimation, setFlashAnimation] = useState({
    header: false,
    footer: false
  });
  
  const imgRef = useRef(null);
  const previewCanvasRef = useRef(null);
  
  const [brandingData, setBrandingData] = useState({
    headerImage: { url: '', width: 0, height: 0, size: 0 },
    footerImage: { url: '', width: 0, height: 0, size: 0 },
    showHeader: true,
    showFooter: true,
    paperSettings: {
      paperWidth: 816,    // 8.5" Letter width in pixels (215.9mm * 96/25.4)
      paperHeight: 1056,  // 11" Letter height in pixels (279.4mm * 96/25.4)
      marginTop: 96,      // 1 inch in pixels
      marginBottom: 96,
      marginLeft: 96,
      marginRight: 96,
      headerHeight: 120,  // ~30mm in pixels
      footerHeight: 80,   // ~20mm in pixels
      dpi: 96
    }
  });

  // ✅ UPDATED: A4 Paper calculations in PIXELS with FIXED positioning
  const LETTER_CONSTANTS = {
    WIDTH_PX: 816,     // 8.5 inches * 96 DPI = 816px (215.9mm)
    HEIGHT_PX: 1056,   // 11 inches * 96 DPI = 1056px (279.4mm)
    SCALE_FACTOR: 0.8, // Scale down for screen display
    MARGIN_PX: 96,     // 1 inch (25.4mm) in pixels
    FIXED_HEIGHT: 1056 * 0.8 // Keep paper at fixed height
  };

  const getDisplayDimensions = () => {
    const scale = LETTER_CONSTANTS.SCALE_FACTOR;
    return {
      paperWidth: LETTER_CONSTANTS.WIDTH_PX * scale,
      paperHeight: LETTER_CONSTANTS.FIXED_HEIGHT, // ✅ FIXED HEIGHT - no more shifting
      marginTop: LETTER_CONSTANTS.MARGIN_PX * scale,
      marginBottom: LETTER_CONSTANTS.MARGIN_PX * scale,
      marginLeft: LETTER_CONSTANTS.MARGIN_PX * scale,
      marginRight: LETTER_CONSTANTS.MARGIN_PX * scale,
      headerHeight: headerHeight * scale,
      footerHeight: footerHeight * scale,
    };
  };

  const displayDims = getDisplayDimensions();

  // ✅ NEW: Check if cropped image height matches slider height (±5px tolerance)
  const checkSizeMatch = (type) => {
    const pendingImage = pendingChanges[type];
    if (!pendingImage) return false;
    
    const targetHeight = type === 'header' ? headerHeight : footerHeight;
    const actualHeight = pendingImage.height;
    
    return Math.abs(actualHeight - targetHeight) <= 5; // 5px tolerance
  };

  // ✅ NEW: Trigger flash animation when size matches
  const triggerFlashAnimation = (type) => {
    setFlashAnimation(prev => ({ ...prev, [type]: true }));
    
    // Reset flash after animation completes
    setTimeout(() => {
      setFlashAnimation(prev => ({ ...prev, [type]: false }));
    }, 2000); // 2 seconds flash duration
  };

  // ✅ NEW: Sync input fields with slider values
  useEffect(() => {
    setHeaderInput(String(headerHeight));
  }, [headerHeight]);

  useEffect(() => {
    setFooterInput(String(footerHeight));
  }, [footerHeight]);

  const filteredLabs = labs.filter(lab => 
    lab.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lab.identifier.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Fetch labs for organization
  const fetchLabs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/labs');
      
      if (response.data.success) {
        const labsData = response.data.data || [];
        setLabs(labsData);
        
        if (labsData.length > 0 && !selectedLab) {
          setSelectedLab(labsData[0]._id);
        }
      }
    } catch (error) {
      console.error('Error fetching labs:', error);
      toast.error('Failed to load labs');
    } finally {
      setLoading(false);
    }
  }, [selectedLab]);

  const fetchBrandingData = useCallback(async (labId) => {
    if (!labId) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/branding/labs/${labId}/branding`);
      
      if (response.data.success && response.data.data) {
        const fetchedData = response.data.data;
        
        setBrandingData(prev => ({
          headerImage: fetchedData.headerImage || prev.headerImage,
          footerImage: fetchedData.footerImage || prev.footerImage,
          showHeader: fetchedData.showHeader !== undefined ? fetchedData.showHeader : prev.showHeader,
          showFooter: fetchedData.showFooter !== undefined ? fetchedData.showFooter : prev.showFooter,
          paperSettings: {
            ...prev.paperSettings,
            ...fetchedData.paperSettings
          }
        }));

        if (fetchedData.paperSettings) {
          // Convert from mm to pixels if data is in mm
          const headerPx = fetchedData.paperSettings.headerHeight > 50 
            ? fetchedData.paperSettings.headerHeight 
            : Math.round(fetchedData.paperSettings.headerHeight * 96 / 25.4);
          const footerPx = fetchedData.paperSettings.footerHeight > 50 
            ? fetchedData.paperSettings.footerHeight 
            : Math.round(fetchedData.paperSettings.footerHeight * 96 / 25.4);
            
          setHeaderHeight(headerPx || 120);
          setFooterHeight(footerPx || 80);
        }
      }
    } catch (error) {
      console.error('Error fetching branding data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabs();
  }, []);

  useEffect(() => {
    if (selectedLab) {
      fetchBrandingData(selectedLab);
    }
  }, [selectedLab, fetchBrandingData]);

  // ✅ FIXED: Handle drag resize with smoother movement and no wobbling
  const handleMouseDown = (type, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging({ type, active: true });
    
    const startY = e.clientY;
    const startHeight = type === 'header' ? headerHeight : footerHeight;

    const handleMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      
      const deltaY = moveEvent.clientY - startY;
      // Convert display delta to actual pixels with proper scaling
      const pixelDelta = deltaY / A4_CONSTANTS.SCALE_FACTOR;
      
      // Invert for footer (dragging down decreases height)
      const finalDelta = type === 'footer' ? -pixelDelta : pixelDelta;
      
      const newHeight = Math.max(20, Math.min(400, startHeight + finalDelta)); // Min 20px, Max 400px

      if (type === 'header') {
        setHeaderHeight(Math.round(newHeight));
      } else {
        setFooterHeight(Math.round(newHeight));
      }
    };

    const handleMouseUp = () => {
      setIsDragging({ type: null, active: false });
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      updatePaperSettings();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // ✅ NEW: Handle manual input change for header/footer height
  const handleHeightInputChange = (type, value) => {
    // Update input field
    if (type === 'header') {
      setHeaderInput(value);
    } else {
      setFooterInput(value);
    }
    
    // Parse and validate
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 20 && numValue <= 400) {
      if (type === 'header') {
        setHeaderHeight(numValue);
      } else {
        setFooterHeight(numValue);
      }
      updatePaperSettings();
    }
  };

  // ✅ NEW: Handle input blur - validate and fix invalid values
  const handleHeightInputBlur = (type) => {
    const currentValue = type === 'header' ? headerInput : footerInput;
    const numValue = parseInt(currentValue, 10);
    
    if (isNaN(numValue) || numValue < 20 || numValue > 400) {
      // Reset to current height if invalid
      const validValue = type === 'header' ? headerHeight : footerHeight;
      if (type === 'header') {
        setHeaderInput(String(validValue));
      } else {
        setFooterInput(String(validValue));
      }
      toast.error('Please enter a value between 20 and 400 pixels');
    }
  };

  // ✅ UPDATED: Save paper settings in pixels
  const updatePaperSettings = async () => {
    if (!selectedLab) return;

    try {
      await api.patch(`/branding/labs/${selectedLab}/branding/settings`, {
        paperSettings: {
          ...brandingData.paperSettings,
          headerHeight,
          footerHeight
        }
      });
    } catch (error) {
      console.error('Error updating paper settings:', error);
    }
  };

  // ✅ UPDATED: Open crop modal - either new file or re-crop existing
  const openCropModal = (type, isRecrop = false) => {
    if (isRecrop) {
      // ✅ NEW: Re-crop existing image
      const existingImageUrl = pendingChanges[type]?.url || brandingData[`${type}Image`]?.url;
      if (existingImageUrl) {
        setCropImageSrc(existingImageUrl);
        setCropType(type);
        setCrop({
          unit: '%',
          x: 10,
          y: 10,
          width: 80,
          height: type === 'header' ? 60 : 50
        });
        setCompletedCrop(null);
        setRotation(0);
        setScale(1);
        setShowCropModal(true);
        return;
      }
    }
    
    // Original file selection for new crop
    setCropType(type);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        handleFileSelectForCrop(file, type);
      }
    };
    input.click();
  };

  // ✅ NEW: Handle file selection for cropping
  const handleFileSelectForCrop = (file, type) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      toast.error('Please upload JPG, PNG, WEBP, or GIF images only');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setCropImageSrc(e.target.result);
      setCropType(type);
      setCrop({
        unit: '%',
        x: 25,
        y: 25,
        width: 50,
        height: type === 'header' ? 30 : 25
      });
      setCompletedCrop(null);
      setRotation(0);
      setScale(1);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  // ✅ FIXED: Generate cropped image at ACTUAL displayed crop size, not scaled natural size
  const generateCroppedImage = useCallback((image, crop, rotation = 0, scale = 1) => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !crop || !image) return null;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const ctx = canvas.getContext('2d');

    const cropX = crop.x * scaleX;
    const cropY = crop.y * scaleY;
    const cropWidth = crop.width * scaleX;
    const cropHeight = crop.height * scaleY;

    // ✅ FIXED: Create canvas at the DISPLAYED crop size, not natural size
    canvas.width = Math.round(crop.width);   // Use displayed dimensions
    canvas.height = Math.round(crop.height); // Use displayed dimensions

    ctx.save();

    // Apply transformations
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);

    // Draw from natural size to displayed size (resizing happens here)
    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      -canvas.width / 2,
      -canvas.height / 2,
      canvas.width,
      canvas.height
    );

    ctx.restore();

    return canvas;
  }, []);

  // ✅ UPDATED: Apply crop AND auto-set slider height to match cropped image height
  const applyCropToPending = () => {
    const image = imgRef.current;
    const croppedCanvas = generateCroppedImage(image, completedCrop, rotation, scale);
    
    if (croppedCanvas) {
      // ✅ CORRECT WORKFLOW: Use actual canvas dimensions from the crop
      const croppedWidth = Math.round(croppedCanvas.width);
      const croppedHeight = Math.round(croppedCanvas.height);
      const targetHeight = cropType === 'header' ? headerHeight : footerHeight;
      const isMatch = Math.abs(croppedHeight - targetHeight) <= 5;
      
      croppedCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        setPendingChanges(prev => ({
          ...prev,
          [cropType]: {
            blob,
            url,
            width: croppedWidth,   // ✅ Actual cropped width
            height: croppedHeight, // ✅ Actual cropped height
            type: cropType,
            isMatch
          }
        }));
        
        // ✅ CORRECT: Update slider to match the actual cropped dimensions
        if (cropType === 'header') {
          setHeaderHeight(croppedHeight);
          setHeaderInput(String(croppedHeight));
        } else {
          setFooterHeight(croppedHeight);
          setFooterInput(String(croppedHeight));
        }
        
        const matchText = isMatch ? ' (Size matched perfectly! ✅)' : ` (Slider adjusted to ${croppedHeight}px)`;
        toast.success(`${cropType === 'header' ? 'Header' : 'Footer'} cropped to ${croppedHeight}px!${matchText}`, {
          duration: 5000,
          className: 'border-green-400'
        });
        
        // ✅ Trigger flash animation if size matches
        if (isMatch) {
          triggerFlashAnimation(cropType);
        }
        
        setShowCropModal(false);
        setCropImageSrc(null);
        
        // Update backend with actual cropped height
        updatePaperSettings();
      }, 'image/png', 0.95);
    }
  };

  // ✅ NEW: Save all pending changes with actual dimensions
  const saveAllChanges = async () => {
    if (!selectedLab || (!pendingChanges.header && !pendingChanges.footer)) {
      toast.error('No changes to save');
      return;
    }

    try {
      setSaving(true);

      if (pendingChanges.header) {
        // ✅ NO B&W conversion — upload original color blob directly
        const formData = new FormData();
        formData.append('image', pendingChanges.header.blob, `header_${Date.now()}.png`);
        formData.append('type', 'header');
        formData.append('labId', selectedLab);
        formData.append('width', pendingChanges.header.width.toString());
        formData.append('height', pendingChanges.header.height.toString());

        const response = await api.post(`/branding/labs/${selectedLab}/branding/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (response.data.success) {
          setBrandingData(prev => ({
            ...prev,
            headerImage: response.data.data.headerImage
          }));
        }
      }

      if (pendingChanges.footer) {
        // ✅ NO B&W conversion — upload original color blob directly
        const formData = new FormData();
        formData.append('image', pendingChanges.footer.blob, `footer_${Date.now()}.png`);
        formData.append('type', 'footer');
        formData.append('labId', selectedLab);
        formData.append('width', pendingChanges.footer.width.toString());
        formData.append('height', pendingChanges.footer.height.toString());

        const response = await api.post(`/branding/labs/${selectedLab}/branding/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (response.data.success) {
          setBrandingData(prev => ({
            ...prev,
            footerImage: response.data.data.footerImage
          }));
        }
      }

      Object.values(pendingChanges).forEach(change => {
        if (change?.url) URL.revokeObjectURL(change.url);
      });
      setPendingChanges({ header: null, footer: null });

      toast.success('Branding images saved in full color successfully!');

    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // ✅ NEW: Discard pending changes
  const discardPendingChanges = () => {
    Object.values(pendingChanges).forEach(change => {
      if (change?.url) URL.revokeObjectURL(change.url);
    });
    setPendingChanges({ header: null, footer: null });
    toast.success('Pending changes discarded');
  };

  // Remove image
  const handleRemoveImage = async (type) => {
    if (!selectedLab) return;

    try {
      setSaving(true);
      
      const response = await api.delete(`/branding/labs/${selectedLab}/branding/${type}`);

      if (response.data.success) {
        setBrandingData(prev => ({
          ...prev,
          [`${type}Image`]: { url: '', width: 0, height: 0, size: 0 }
        }));
        
        toast.success(`${type === 'header' ? 'Header' : 'Footer'} image removed`);
      }
    } catch (error) {
      console.error('Error removing image:', error);
      toast.error('Failed to remove image');
    } finally {
      setSaving(false);
    }
  };

  // Handle toggle visibility
  const handleToggleVisibility = async (type) => {
    if (!selectedLab) return;

    try {
      const field = type === 'header' ? 'showHeader' : 'showFooter';
      const newValue = !brandingData[field];

      const response = await api.patch(`/branding/labs/${selectedLab}/branding/toggle`, {
        field,
        value: newValue
      });

      if (response.data.success) {
        setBrandingData(prev => ({
          ...prev,
          [field]: newValue
        }));
        toast.success(`${type === 'header' ? 'Header' : 'Footer'} ${newValue ? 'enabled' : 'disabled'}`);
      }
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast.error('Failed to update visibility');
    }
  };

  const getBackPath = () => {
    return currentUser?.role === 'admin' ? '/admin/dashboard' : '/lab/dashboard';
  };

  const currentLab = labs.find(lab => lab._id === selectedLab);
  const hasPendingChanges = pendingChanges.header || pendingChanges.footer;
  
  // ✅ NEW: Check for size matches
  const headerSizeMatch = checkSizeMatch('header');
  const footerSizeMatch = checkSizeMatch('footer');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex">
      {/* ✅ COMPACT LEFT SIDEBAR - Lab Selection (18% width) */}
      <div className="w-[18%] bg-white border-r border-gray-200 shadow-lg flex flex-col">
        <div className="border-b border-gray-200 p-3">
          <button
            onClick={() => navigate(getBackPath())}
            className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition-colors mb-3"
          >
            <ArrowLeft className="w-3 h-3" />
            <span className="font-medium text-xs">Back</span>
          </button>
          
          <div className="flex items-center space-x-1 mb-3">
            <Sparkles className="w-3 h-3 text-purple-500" />
            <h1 className="text-xs font-bold text-gray-900">Branding</h1>
          </div>

          {/* ✅ ENHANCED: Pending Changes Indicator with size match info */}
          {hasPendingChanges && (
            <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
              <div className="flex items-center gap-1 text-amber-700 font-medium mb-1">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                Pending Changes
              </div>
              <div className="space-y-1 text-amber-600">
                {pendingChanges.header && (
                  <div className={`flex items-center gap-1 ${headerSizeMatch ? 'text-green-600 font-medium' : ''}`}>
                    • Header: {pendingChanges.header.width}×{pendingChanges.header.height}px
                    {headerSizeMatch && <span className="text-green-600 font-medium">✅ Perfect match!</span>}
                  </div>
                )}
                {pendingChanges.footer && (
                  <div className={`flex items-center gap-1 ${footerSizeMatch ? 'text-green-600 font-medium' : ''}`}>
                    • Footer: {pendingChanges.footer.width}×{pendingChanges.footer.height}px
                    {footerSizeMatch && <span className="text-green-600 font-medium">✅ Perfect match!</span>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ✅ NEW: Manual Height Input Controls */}
          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs space-y-2">
            <div className="text-blue-700 font-medium mb-2">Precise Control</div>
            
            {/* Header Height Input */}
            <div>
              <label className="text-blue-600 font-medium block mb-1">Header Height (px)</label>
              <input
                type="number"
                min="20"
                max="400"
                value={headerInput}
                onChange={(e) => handleHeightInputChange('header', e.target.value)}
                onBlur={() => handleHeightInputBlur('header')}
                className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                placeholder="120"
              />
            </div>
            
            {/* Footer Height Input */}
            <div>
              <label className="text-blue-600 font-medium block mb-1">Footer Height (px)</label>
              <input
                type="number"
                min="20"
                max="400"
                value={footerInput}
                onChange={(e) => handleHeightInputChange('footer', e.target.value)}
                onBlur={() => handleHeightInputBlur('footer')}
                className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                placeholder="80"
              />
            </div>
            
            <p className="text-blue-500 text-xs italic mt-1">Range: 20-400px</p>
          </div>

          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-6 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading && labs.length === 0 ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
              <span className="ml-1 text-xs text-gray-600">Loading...</span>
            </div>
          ) : filteredLabs.length === 0 ? (
            <div className="text-center py-4">
              <Building2 className="w-6 h-6 text-gray-400 mx-auto mb-1" />
              <p className="text-xs text-gray-600">
                {searchQuery ? 'No labs found' : 'No labs available'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredLabs.map(lab => (
                <button
                  key={lab._id}
                  onClick={() => setSelectedLab(lab._id)}
                  className={`w-full p-2 rounded border transition-all text-left ${
                    selectedLab === lab._id
                      ? 'border-purple-500 bg-purple-50 shadow-sm'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-xs text-gray-900 truncate">{lab.name}</h4>
                      <p className="text-xs text-gray-500 font-mono bg-gray-100 px-1 py-0.5 rounded inline-block mt-0.5">
                        {lab.identifier}
                      </p>
                    </div>
                    {selectedLab === lab._id && (
                      <div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0 mt-0.5"></div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ✅ NEW: Save/Discard Actions at Bottom of Sidebar */}
        {hasPendingChanges && (
          <div className="border-t border-gray-200 p-3 space-y-2">
            <button
              onClick={saveAllChanges}
              disabled={saving}
              className="w-full px-3 py-2 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3 h-3" />
                  Save All Changes
                </>
              )}
            </button>
            <button
              onClick={discardPendingChanges}
              disabled={saving}
              className="w-full px-3 py-2 bg-gray-500 text-white rounded text-xs font-medium hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              <X className="w-3 h-3" />
              Discard Changes
            </button>
          </div>
        )}
      </div>

      {/* ✅ MAIN CONTENT AREA - Enlarged A4 Preview (82% width) */}
      <div className="flex-1 flex flex-col">
        {/* ✅ UPDATED: Header Info with PIXEL units */}
        {selectedLab && currentLab && (
          <div className="bg-white border-b border-gray-200 px-4 py-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">{currentLab.name}</h2>
                <p className="text-xs text-gray-600">Letter Paper Preview ({displayDims.paperWidth.toFixed(0)}×{displayDims.paperHeight.toFixed(0)}px display)</p>
              </div>
              
              <div className="flex items-center gap-3 text-xs text-gray-600">
                <span>📐 816×1056px (Letter 8.5"×11")</span>
                <span className={`${headerSizeMatch ? 'text-green-600 font-semibold' : ''}`}>
                  📏 Header: {headerHeight}px {headerSizeMatch && <span className="text-green-600">✅</span>}
                </span>
                <span className={`${footerSizeMatch ? 'text-green-600 font-semibold' : ''}`}>
                  📏 Footer: {footerHeight}px {footerSizeMatch && <span className="text-green-600">✅</span>}
                </span>
                {hasPendingChanges && (
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">
                    {Object.keys(pendingChanges).filter(k => pendingChanges[k]).length} pending
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ✅ FIXED: A4 Preview Area with CENTERED and FIXED positioning */}
        <div className="flex-1 bg-gray-100 p-3 overflow-auto">
          {selectedLab && currentLab ? (
            <div className="flex justify-center items-center min-h-full">
              {/* ✅ FIXED: A4 Paper Sheet with absolute positioning to prevent movement */}
              <div className="relative">
                <div 
                  className="bg-white shadow-2xl border border-gray-300 relative mx-auto"
                  style={{ 
                    width: `${displayDims.paperWidth}px`,
                    height: `${displayDims.paperHeight}px`,
                  }}
                >
                  
                  {/* Paper Guidelines */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div 
                      className="absolute border border-dashed border-gray-300 opacity-50"
                      style={{
                        top: `${displayDims.marginTop}px`,
                        left: `${displayDims.marginLeft}px`,
                        right: `${displayDims.marginRight}px`,
                        bottom: `${displayDims.marginBottom}px`
                      }}
                    />
                  </div>

                  {/* ✅ ENHANCED: Header Section with FLASH animation and PROMINENT SIZE MATCH highlighting */}
                  <div
                    className={`relative border-b border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 group overflow-hidden transition-all duration-500 ${
                      headerSizeMatch 
                        ? 'ring-4 ring-green-400 ring-opacity-100 shadow-lg shadow-green-200 animate-pulse bg-gradient-to-r from-green-50 to-emerald-50' 
                        : ''
                    } ${
                      flashAnimation.header 
                        ? 'ring-8 ring-green-500 ring-opacity-75 animate-ping bg-green-100' 
                        : ''
                    }`}
                    style={{
                      position: 'absolute',
                      top: `${displayDims.marginTop}px`,
                      left: `${displayDims.marginLeft}px`,
                      right: `${displayDims.marginRight}px`,
                      height: `${displayDims.headerHeight}px`
                    }}
                  >
                    {/* Header Content */}
                    <div className="absolute top-1 left-2 z-20">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded shadow-md transition-all duration-300 ${
                        headerSizeMatch 
                          ? 'text-green-800 bg-green-200 border border-green-400 animate-bounce' 
                          : 'text-purple-700 bg-white border border-purple-200'
                      }`}>
                        Header: {headerHeight}px {pendingChanges.header && '• Modified'} {headerSizeMatch && '🎯 Perfect!'}
                      </span>
                    </div>

                    <div className="absolute top-1 right-2 z-20 flex gap-1">
                      <button
                        onClick={() => handleToggleVisibility('header')}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                          brandingData.showHeader
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {brandingData.showHeader ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      </button>
                    </div>

                    {/* Display pending header or current header */}
                    {brandingData.showHeader && (
                      <>
                        {(pendingChanges.header?.url || brandingData.headerImage?.url) ? (
                          <div className="absolute inset-0 group">
                            <img 
                              src={pendingChanges.header?.url || brandingData.headerImage.url} 
                              alt="Header"
                              className={`w-full h-full object-cover transition-all duration-500 ${
                                pendingChanges.header 
                                  ? headerSizeMatch 
                                    ? 'ring-4 ring-green-400 ring-inset shadow-lg shadow-green-200 brightness-105' 
                                    : 'ring-3 ring-amber-400 ring-inset shadow-lg shadow-amber-200'
                                  : ''
                              }`}
                            />
                            
                            {/* ✅ UPDATED: Image Action Overlay with re-crop functionality */}
                            <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button
                                onClick={() => openCropModal('header', true)}
                                className="px-3 py-1 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600 flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                Re-crop
                              </button>
                              <button
                                onClick={() => openCropModal('header', false)}
                                className="px-3 py-1 bg-purple-500 text-white rounded text-xs font-medium hover:bg-purple-600 flex items-center gap-1"
                              >
                                <Upload className="w-3 h-3" />
                                New Image
                              </button>
                              <button
                                onClick={() => handleRemoveImage('header')}
                                className="px-3 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600 flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="absolute inset-0 border-2 border-dashed border-gray-300 bg-gray-50 hover:border-purple-400 hover:bg-purple-50 transition-colors cursor-pointer flex items-center justify-center"
                            onClick={() => openCropModal('header')}
                          >
                            <div className="text-center">
                              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                              <p className="text-xs text-gray-500 font-medium">Click to upload & crop header image</p>
                              <p className="text-xs text-gray-400">Target size: <span className="font-medium text-purple-600">{headerHeight}px height</span></p>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Resize Handle for Header */}
                    <div
                      className={`absolute bottom-0 left-0 w-full h-3 bg-purple-400 cursor-ns-resize hover:bg-purple-600 transition-colors z-10 ${
                        isDragging.type === 'header' && isDragging.active ? 'bg-purple-700' : ''
                      }`}
                      onMouseDown={(e) => handleMouseDown('header', e)}
                      title={`Drag to resize header height (current: ${headerHeight}px)`}
                    >
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-1 bg-white rounded opacity-70"></div>
                    </div>
                  </div>

                  {/* Content Area - FIXED positioning with proper calculations */}
                  <div 
                    className="bg-gray-50 border-l border-r border-dashed border-gray-300 relative overflow-hidden"
                    style={{
                      position: 'absolute',
                      top: `${displayDims.marginTop + displayDims.headerHeight}px`,
                      left: `${displayDims.marginLeft}px`,
                      right: `${displayDims.marginRight}px`,
                      height: `${displayDims.paperHeight - displayDims.marginTop - displayDims.marginBottom - displayDims.headerHeight - displayDims.footerHeight}px`
                    }}
                  >
                    {/* Enhanced Dummy Content */}
                    <div className="p-8 space-y-6">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-300 rounded w-48"></div>
                          <div className="h-3 bg-gray-200 rounded w-36"></div>
                          <div className="h-3 bg-gray-200 rounded w-40"></div>
                        </div>
                        <div className="space-y-2 text-right">
                          <div className="h-4 bg-gray-300 rounded w-32"></div>
                          <div className="h-3 bg-gray-200 rounded w-36"></div>
                        </div>
                      </div>
                      
                      <div className="space-y-3 pt-6">
                        <div className="h-3 bg-gray-200 rounded w-full"></div>
                        <div className="h-3 bg-gray-200 rounded w-full"></div>
                        <div className="h-3 bg-gray-200 rounded w-4/5"></div>
                        <div className="h-3 bg-gray-200 rounded w-full"></div>
                        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-full"></div>
                        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                      </div>

                      <div className="pt-8">
                        <div className="h-4 bg-gray-300 rounded w-48 mb-4"></div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="h-20 bg-gray-200 rounded"></div>
                          <div className="h-20 bg-gray-200 rounded"></div>
                        </div>
                      </div>
                    </div>

                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <div className="bg-white px-6 py-3 rounded-lg shadow-md border border-gray-200 flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-600">Document Content Area</span>
                      </div>
                    </div>
                  </div>

                  {/* ✅ ENHANCED: Footer Section with FLASH animation and PROMINENT SIZE MATCH highlighting */}
                  <div
                    className={`relative border-t border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 group overflow-hidden transition-all duration-500 ${
                      footerSizeMatch 
                        ? 'ring-4 ring-green-400 ring-opacity-100 shadow-lg shadow-green-200 animate-pulse bg-gradient-to-r from-green-50 to-emerald-50' 
                        : ''
                    } ${
                      flashAnimation.footer 
                        ? 'ring-8 ring-green-500 ring-opacity-75 animate-ping bg-green-100' 
                        : ''
                    }`}
                    style={{
                      position: 'absolute',
                      bottom: `${displayDims.marginBottom}px`,
                      left: `${displayDims.marginLeft}px`,
                      right: `${displayDims.marginRight}px`,
                      height: `${displayDims.footerHeight}px`
                    }}
                  >
                    {/* Resize Handle for Footer */}
                    <div
                      className={`absolute top-0 left-0 w-full h-3 bg-purple-400 cursor-ns-resize hover:bg-purple-600 transition-colors z-10 ${
                        isDragging.type === 'footer' && isDragging.active ? 'bg-purple-700' : ''
                      }`}
                      onMouseDown={(e) => handleMouseDown('footer', e)}
                      title={`Drag to resize footer height (current: ${footerHeight}px)`}
                    >
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-1 bg-white rounded opacity-70"></div>
                    </div>

                    <div className="absolute bottom-1 left-2 z-20">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded shadow-md transition-all duration-300 ${
                        footerSizeMatch 
                          ? 'text-green-800 bg-green-200 border border-green-400 animate-bounce' 
                          : 'text-purple-700 bg-white border border-purple-200'
                      }`}>
                        Footer: {footerHeight}px {pendingChanges.footer && '• Modified'} {footerSizeMatch && '🎯 Perfect!'}
                      </span>
                    </div>

                    <div className="absolute bottom-1 right-2 z-20 flex gap-1">
                      <button
                        onClick={() => handleToggleVisibility('footer')}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                          brandingData.showFooter
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {brandingData.showFooter ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      </button>
                    </div>

                    {/* Display pending footer or current footer */}
                    {brandingData.showFooter && (
                      <>
                        {(pendingChanges.footer?.url || brandingData.footerImage?.url) ? (
                          <div className="absolute inset-0 group">
                            <img 
                              src={pendingChanges.footer?.url || brandingData.footerImage.url} 
                              alt="Footer"
                              className={`w-full h-full object-cover transition-all duration-500 ${
                                pendingChanges.footer 
                                  ? footerSizeMatch 
                                    ? 'ring-4 ring-green-400 ring-inset shadow-lg shadow-green-200 brightness-105' 
                                    : 'ring-3 ring-amber-400 ring-inset shadow-lg shadow-amber-200'
                                  : ''
                              }`}
                            />
                            
                            {/* ✅ UPDATED: Image Action Overlay with re-crop functionality */}
                            <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button
                                onClick={() => openCropModal('footer', true)}
                                className="px-3 py-1 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600 flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                Re-crop
                              </button>
                              <button
                                onClick={() => openCropModal('footer', false)}
                                className="px-3 py-1 bg-purple-500 text-white rounded text-xs font-medium hover:bg-purple-600 flex items-center gap-1"
                              >
                                <Upload className="w-3 h-3" />
                                New Image
                              </button>
                              <button
                                onClick={() => handleRemoveImage('footer')}
                                className="px-3 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600 flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="absolute inset-0 border-2 border-dashed border-gray-300 bg-gray-50 hover:border-purple-400 hover:bg-purple-50 transition-colors cursor-pointer flex items-center justify-center"
                            onClick={() => openCropModal('footer')}
                          >
                            <div className="text-center">
                              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                              <p className="text-xs text-gray-500 font-medium">Click to upload & crop footer image</p>
                              <p className="text-xs text-gray-400">Target size: <span className="font-medium text-purple-600">{footerHeight}px height</span></p>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* ✅ Loading Overlay */}
                  {saving && (
                    <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
                      <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                        <span className="text-sm font-medium text-gray-700">Saving...</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Lab</h3>
                <p className="text-gray-600">Choose a lab from the sidebar to configure its report branding</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ✅ REACT IMAGE CROP MODAL - NO MORE FLICKERING! */}
      {showCropModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[95vh] overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Crop {cropType === 'header' ? 'Header' : 'Footer'} Image
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded">
                      Letter Paper Requirements
                    </span> • Min Width: <span className="font-bold text-blue-600">624px</span> • Target Height: <span className="font-bold text-purple-600">{cropType === 'header' ? headerHeight : footerHeight}px</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    📏 Content area: 624px wide (8.5" - 2" margins) • Drag to select crop area • Adjust corners to resize
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRotation(prev => (prev + 90) % 360)}
                    className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 flex items-center gap-1"
                  >
                    <RotateCw className="w-3 h-3" />
                    Rotate
                  </button>
                  
                  <button
                    onClick={() => {
                      setCrop({
                        unit: '%',
                        x: 10,
                        y: 10,
                        width: 80,
                        height: 80
                      });
                    }}
                    className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 flex items-center gap-1"
                  >
                    <Maximize2 className="w-3 h-3" />
                    Reset
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-gray-100 flex justify-center">
              <div className="max-w-full max-h-[70vh] overflow-auto">
                {cropImageSrc && (
                  <ReactCrop
                    crop={crop}
                    onChange={(newCrop) => setCrop(newCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={undefined}
                    minHeight={30}
                    minWidth={624}
                    maxWidth={816}
                  >
                    <img
                      ref={imgRef}
                      src={cropImageSrc}
                      alt="Crop preview"
                      style={{
                        transform: `rotate(${rotation}deg) scale(${scale})`,
                        transition: 'transform 0.2s ease-in-out',
                        display: 'block'
                      }}
                      onLoad={() => {
                        // Set initial crop when image loads
                        const image = imgRef.current;
                        if (image) {
                          setCrop({
                            unit: '%',
                            x: 25,
                            y: 25,
                            width: 50,
                            height: cropType === 'header' ? 30 : 25
                          });
                        }
                      }}
                    />
                  </ReactCrop>
                )}
              </div>
            </div>

            {/* Scale and Rotation Controls */}
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <label className="font-medium text-gray-700">Scale:</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-gray-600 w-8">{scale.toFixed(1)}x</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="font-medium text-gray-700">Rotation:</label>
                  <span className="text-gray-600 w-8">{rotation}°</span>
                </div>

                {completedCrop && (
                  <div className="text-gray-600">
                    <span className="font-medium">Crop Area:</span> {Math.round(completedCrop.width)}×{Math.round(completedCrop.height)}px
                  </div>
                )}

                {/* ✅ ENHANCED: Real-time size comparison with prominent feedback */}
                {completedCrop && (
                  <div className={`text-sm font-bold px-3 py-1 rounded transition-all duration-300 ${
                    Math.abs(Math.round(completedCrop.height) - (cropType === 'header' ? headerHeight : footerHeight)) <= 5
                      ? 'text-green-700 bg-green-100 border border-green-400 animate-bounce'
                      : 'text-amber-700 bg-amber-100 border border-amber-400'
                  }`}>
                    Target: {cropType === 'header' ? headerHeight : footerHeight}px height
                    {Math.abs(Math.round(completedCrop.height) - (cropType === 'header' ? headerHeight : footerHeight)) <= 5 && ' 🎯 Perfect Match!'}
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-white flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Professional image cropping • Aim for <span className="font-semibold text-purple-600">{cropType === 'header' ? headerHeight : footerHeight}px height</span> for perfect fit
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCropModal(false);
                    setCropImageSrc(null);
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={applyCropToPending}
                  disabled={!completedCrop}
                  className={`px-6 py-2 rounded flex items-center gap-2 transition-all ${
                    completedCrop && Math.abs(Math.round(completedCrop.height) - (cropType === 'header' ? headerHeight : footerHeight)) <= 5
                      ? 'bg-green-600 hover:bg-green-700 text-white animate-pulse'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Check className="w-4 h-4" />
                  {completedCrop && Math.abs(Math.round(completedCrop.height) - (cropType === 'header' ? headerHeight : footerHeight)) <= 5 
                    ? 'Perfect! Apply Crop' 
                    : 'Apply Crop'
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden canvas for crop processing */}
      <canvas ref={previewCanvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default BrandingSettings;

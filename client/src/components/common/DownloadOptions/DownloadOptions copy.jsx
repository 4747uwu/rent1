import React, { useState, useRef, useEffect } from 'react';
import { Download, Cloud, HardDrive, Loader2, FileArchive, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../services/api';

const DownloadOptions = ({ study, isOpen, onClose, position }) => {
  const [downloadingFrom, setDownloadingFrom] = useState(null);
  const [seriesData, setSeriesData] = useState([]);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const handleShowSeriesSelection = async () => {
    setLoadingSeries(true);
    try {
      const response = await api.get(`/download/study-series/${study._id}`);
      
      if (response.data.success) {
        console.log('✅ Series data received:', response.data.data.series);
        setSeriesData(response.data.data.series);
        setShowSeriesModal(true);
      } else {
        toast.error(response.data.message || 'Failed to load series');
      }
    } catch (error) {
      console.error('❌ Error fetching series:', error);
      toast.error(error.response?.data?.message || 'Failed to load series data');
    } finally {
      setLoadingSeries(false);
    }
  };

  const handleCloudflareDownload = async () => {
    setDownloadingFrom('cloudflare');
    try {
      const response = await api.get(`/download/cloudflare-zip/${study._id}`);
      
      if (response.data.success) {
        const zipUrl = response.data.data.zipUrl;
        
        const link = document.createElement('a');
        link.href = zipUrl;
        link.download = `${study.bharatPacsId || study._id}_study.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success('Download started from Cloudflare R2');
        onClose();
      } else {
        toast.error(response.data.message || 'ZIP not available');
      }
    } catch (error) {
      console.error('❌ Cloudflare download error:', error);
      toast.error(error.response?.data?.message || 'Failed to download from Cloudflare R2');
    } finally {
      setDownloadingFrom(null);
    }
  };

  // ✅ UPDATED: Download anonymized via backend proxy
  const handleAnonymizedDownload = async () => {
    setDownloadingFrom('orthanc-anon');
    const downloadToast = toast.loading('Creating anonymized study...');
    
    try {
      const response = await api.get(`/download/anonymized/${study._id}`, {
        responseType: 'blob' // ✅ Important: get as blob
      });
      
      // Create download URL from blob
      const blob = new Blob([response.data], { type: 'application/zip' });
      const downloadUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${study.bharatPacsId || study._id}_anonymized.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup
      window.URL.revokeObjectURL(downloadUrl);
      
      toast.success('Anonymized study downloaded!', { id: downloadToast });
      onClose();
    } catch (error) {
      console.error('❌ Download error:', error);
      toast.error('Failed to download', { id: downloadToast });
    } finally {
      setDownloadingFrom(null);
    }
  };

  // ✅ UPDATED: Download series via backend proxy
  const handleSeriesDownload = async (series) => {
    setDownloadingFrom(`series-${series.ID}`);
    const downloadToast = toast.loading(`Downloading ${series.MainDicomTags.SeriesDescription}...`);

    try {
      const downloadUrl = `/download/series/${study._id}/${series.ID}`;
      
      // ✅ Trigger browser download
      const link = document.createElement('a');
      link.href = `${api.defaults.baseURL}${downloadUrl}`;
      const cleanDesc = series.MainDicomTags.SeriesDescription.replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `${study.bharatPacsId || study._id}_${cleanDesc}.zip`;
      
      const token = localStorage.getItem('token');
      if (token) {
        link.href += `?token=${token}`;
      }
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Series "${series.MainDicomTags.SeriesDescription}" download started!`, { id: downloadToast });
      setShowSeriesModal(false);
      onClose();
    } catch (error) {
      console.error('❌ Series download error:', error);
      toast.error('Failed to download series', { id: downloadToast });
    } finally {
      setDownloadingFrom(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Download Options Dropdown */}
      <div
        ref={dropdownRef}
        className="fixed bg-white rounded-md shadow-2xl border border-gray-300 z-[10000]"
        style={{
          top: `${position?.top || 0}px`,
          left: `${position?.left || 0}px`,
          minWidth: '280px'
        }}
      >
        <div className="py-2">
          <button
            onClick={handleCloudflareDownload}
            disabled={downloadingFrom === 'cloudflare'}
            className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {downloadingFrom === 'cloudflare' ? (
              <Loader2 className="w-4 h-4 mr-3 animate-spin text-blue-600" />
            ) : (
              <Cloud className="w-4 h-4 mr-3 text-blue-600" />
            )}
            <div className="flex-1 text-left">
              <div className="font-medium">Cloudflare R2</div>
              <div className="text-xs text-gray-500">Fast CDN download</div>
            </div>
          </button>

          <button
            onClick={handleAnonymizedDownload}
            disabled={downloadingFrom === 'orthanc-anon'}
            className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {downloadingFrom === 'orthanc-anon' ? (
              <Loader2 className="w-4 h-4 mr-3 animate-spin text-green-600" />
            ) : (
              <HardDrive className="w-4 h-4 mr-3 text-green-600" />
            )}
            <div className="flex-1 text-left">
              <div className="font-medium">Anonymized (Orthanc)</div>
              <div className="text-xs text-gray-500">Remove patient data</div>
            </div>
          </button>

          <button
            onClick={handleShowSeriesSelection}
            disabled={loadingSeries}
            className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-t border-gray-200"
          >
            {loadingSeries ? (
              <Loader2 className="w-4 h-4 mr-3 animate-spin text-purple-600" />
            ) : (
              <FileArchive className="w-4 h-4 mr-3 text-purple-600" />
            )}
            <div className="flex-1 text-left">
              <div className="font-medium">Series-wise Download</div>
              <div className="text-xs text-gray-500">Choose specific series</div>
            </div>
          </button>
        </div>
      </div>

      {/* Series Selection Modal */}
      {showSeriesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001]">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b bg-purple-600 text-white flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Select Series to Download</h2>
                <p className="text-sm text-purple-100 mt-1">
                  {study.patientName} - {study.bharatPacsId || study._id}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowSeriesModal(false);
                  onClose();
                }}
                className="p-1 hover:bg-purple-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {seriesData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileArchive className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>No series found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {seriesData.map((series, index) => (
                    <button
                      key={series.ID}
                      onClick={() => handleSeriesDownload(series)}
                      disabled={downloadingFrom === `series-${series.ID}`}
                      className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center gap-4 flex-1 text-left">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 text-purple-600 font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {series.MainDicomTags?.SeriesDescription || 'Unnamed Series'}
                          </div>
                          <div className="text-sm text-gray-600">
                            Modality: {series.MainDicomTags?.Modality || 'Unknown'} • 
                            Series #{series.MainDicomTags?.SeriesNumber || '0'} • 
                            {series.InstanceCount || 0} images
                          </div>
                        </div>
                      </div>
                      {downloadingFrom === `series-${series.ID}` ? (
                        <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                      ) : (
                        <Download className="w-5 h-5 text-purple-600" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => {
                  setShowSeriesModal(false);
                  onClose();
                }}
                className="px-6 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DownloadOptions;
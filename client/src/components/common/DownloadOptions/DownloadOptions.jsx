import React, { useState, useRef, useEffect } from 'react';
import { Download, Cloud, HardDrive, Loader2, FileArchive, X } from 'lucide-react'; // ✅ ADD Cloud
import toast from 'react-hot-toast';
import api from '../../../services/api';

const DownloadOptions = ({ study, isOpen, onClose, position }) => {
  const [downloadingFrom, setDownloadingFrom] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [seriesData, setSeriesData] = useState([]);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const dropdownRef = useRef(null);
  const seriesModalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (seriesModalRef.current?.contains(event.target)) return;
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const handleShowSeriesSelection = async () => {
    setLoadingSeries(true);
    try {
      const response = await api.get(`/download/study-series/${study._id}`);
      if (response.data.success) {
        setSeriesData(response.data.data.series);
        setShowSeriesModal(true);
      } else {
        toast.error(response.data.message || 'Failed to load series');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load series data');
    } finally {
      setLoadingSeries(false);
    }
  };

  const directDownload = (url, filename) => {
    const token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
    
    if (!token) {
      console.error('❌ No token found in session');
      toast.error('Session expired — please log in again');
      return;
    }

    const fullUrl = `/api${url}?token=${token}`;
    
    const link = document.createElement('a');
    link.href = fullUrl;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAnonymizedDownload = async () => {
    setDownloadingFrom('anonymized');
    const toastId = toast.loading('Creating anonymized study... (this may take 1-2 mins)');
    try {
      directDownload(
        `/download/anonymized/${study._id}`,
        `${study.bharatPacsId || study._id}_anonymized.zip`
      );
      toast.success('Download started! Check your browser downloads.', { id: toastId, duration: 4000 });
      setTimeout(() => onClose(), 1000);
    } catch (e) {
      console.error('Anonymized download failed:', e);
      toast.error('Download failed', { id: toastId });
    } finally {
      setDownloadingFrom(null);
    }
  };

  const handleSeriesDownload = async (series, event) => {
    event?.stopPropagation?.();
    const key = `series-${series.ID}`;
    setDownloadingFrom(key);
    const desc = series.MainDicomTags.SeriesDescription.replace(/[^a-zA-Z0-9]/g, '_');
    const toastId = toast.loading(`Starting series download...`);
    try {
      directDownload(
        `/download/series/${study._id}/${series.ID}`,
        `${study.bharatPacsId || study._id}_${desc}.zip`
      );
      toast.success('Series download started!', { id: toastId, duration: 3000 });
    } catch (e) {
      console.error('Series download failed:', e);
      toast.error('Series download failed', { id: toastId });
    } finally {
      setDownloadingFrom(null);
    }
  };

  const handleCloudflareDownload = async () => {
    setDownloadingFrom('cloudflare');
    const toastId = toast.loading('Fetching Cloudflare download link...');
    try {
      const response = await api.get(`/download/cloudflare-zip/${study._id}`); // ✅ FIXED endpoint

      if (response.data.success) {
        const zipUrl = response.data.data.zipUrl; // ✅ FIXED: was response.data.data.downloadUrl

        const link = document.createElement('a');
        link.href = zipUrl;
        link.download = `${study.bharatPacsId || study._id}_study.zip`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success('Cloudflare download started!', { id: toastId, duration: 3000 });
        setTimeout(() => onClose(), 1000);
      } else {
        toast.error(response.data.message || 'ZIP not available', { id: toastId });
      }
    } catch (error) {
      console.error('❌ Cloudflare download failed:', error);
      if (error.response?.status === 404) {
        toast.error('ZIP file not found in Cloudflare R2', { id: toastId });
      } else if (error.response?.status === 410) {
        toast.error('ZIP file has expired — please regenerate', { id: toastId });
      } else {
        toast.error(error.response?.data?.message || 'Cloudflare download failed', { id: toastId });
      }
    } finally {
      setDownloadingFrom(null);
    }
  };

  const hasCloudflare = !!(
    study?.downloadOptions?.hasR2CDN ||
    study?._raw?.downloadOptions?.hasR2CDN ||
    study?.preProcessedDownload?.cloudflare?.zipUrl ||
    study?._raw?.preProcessedDownload?.cloudflare?.zipUrl
  );

  if (!isOpen) return null;

  return (
    <>
      <div
        ref={dropdownRef}
        className="fixed bg-white rounded border border-gray-900 shadow-2xl z-[10000] overflow-hidden"
        style={{
          top: `${position?.top || 0}px`,
          left: `${position?.left || 0}px`,
          minWidth: '220px'
        }}
      >
        {/* ✅ Cloudflare — always attempt, show availability from hasCloudflare */}
        <button
          onClick={handleCloudflareDownload}
          disabled={downloadingFrom === 'cloudflare'}
          className={`w-full flex items-center px-3 py-2.5 text-[10px] font-bold uppercase transition-colors border-b border-gray-200 disabled:opacity-50 ${
            hasCloudflare
              ? 'text-orange-800 hover:bg-orange-50'
              : 'text-orange-800 hover:bg-gray-50'
          }`}
          title={hasCloudflare ? 'Download from Cloudflare CDN' : 'Cloudflare ZIP may not be ready yet'}
        >
          {downloadingFrom === 'cloudflare' ? (
            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
          ) : (
            <Cloud className="w-3.5 h-3.5 mr-2 text-orange-500" />
          )}
          <div className="flex-1 text-left">
            <div className="flex items-center gap-1">
              Fast Download
              {/* {hasCloudflare
                ? <span className="px-1 py-0.5 bg-orange-100 text-orange-700 text-[8px] rounded font-bold">FAST</span>
                : <span className="px-1 py-0.5 bg-gray-100 text-gray-500 text-[8px] rounded font-bold">MAYBE</span>
              } */}
            </div>
            <div className={`text-[8px] ${hasCloudflare ? 'text-orange-600' : 'text-gray-400'}`}>
              {hasCloudflare ? 'Global CDN — fastest download' : 'ZIP may still be processing'}
            </div>
          </div>
        </button>

        {/* Anonymized Zip */}
        <button
          onClick={handleAnonymizedDownload}
          disabled={downloadingFrom === 'anonymized'}
          className="w-full flex items-center px-3 py-2.5 text-[10px] font-bold text-gray-800 hover:bg-gray-100 disabled:opacity-50 uppercase transition-colors border-b border-gray-200"
        >
          {downloadingFrom === 'anonymized' ? (
            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
          ) : (
            <HardDrive className="w-3.5 h-3.5 mr-2" />
          )}
          <div className="flex-1 text-left">
            <div>Anonymized Zip</div>
            <div className="text-[8px] text-gray-500">Remove patient data</div>
          </div>
        </button>

        {/* Series-wise Zip */}
        <button
          onClick={handleShowSeriesSelection}
          disabled={loadingSeries}
          className="w-full flex items-center px-3 py-2.5 text-[10px] font-bold text-gray-800 hover:bg-gray-100 disabled:opacity-50 uppercase transition-colors"
        >
          {loadingSeries ? (
            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
          ) : (
            <FileArchive className="w-3.5 h-3.5 mr-2" />
          )}
          <div className="flex-1 text-left">
            <div>Series-wise Zip</div>
            <div className="text-[8px] text-gray-500">Choose specific series</div>
          </div>
        </button>
      </div>

      {/* ✅ SERIES MODAL */}
      {showSeriesModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[10001] p-2"
          onClick={(e) => e.target === e.currentTarget && (setShowSeriesModal(false), onClose())}
        >
          <div 
            ref={seriesModalRef}
            className="bg-white rounded shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-3 py-2 bg-gray-900 text-white flex items-center justify-between">
              <div className="flex-1 pr-2 min-w-0">
                <h2 className="text-xs font-bold uppercase truncate">Select Series</h2>
                <p className="text-[9px] text-gray-300 mt-0.5 uppercase truncate">
                  {study.patientName} | {study.bharatPacsId || study._id}
                </p>
              </div>
              <button
                onClick={() => { setShowSeriesModal(false); onClose(); }}
                className="p-1 hover:bg-gray-700 rounded flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 bg-gray-50">
              {seriesData.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <FileArchive className="w-6 h-6 mx-auto mb-1 opacity-50" />
                  <p className="text-[10px] font-bold uppercase">No series found</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {seriesData.map((series, index) => {
                    const key = `series-${series.ID}`;
                    const pct = downloadProgress[key];
                    return (
                      <button
                        key={series.ID}
                        onClick={(e) => handleSeriesDownload(series, e)}
                        disabled={!!downloadingFrom}
                        className="w-full flex items-center justify-between p-2 bg-white border border-gray-200 rounded hover:border-gray-400 disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-center w-6 h-6 rounded bg-gray-100 text-[10px] font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-gray-900 uppercase truncate">
                              {series.MainDicomTags?.SeriesDescription || 'UNNAMED'}
                            </div>
                            <div className="text-[8px] text-gray-500 uppercase">
                              {series.MainDicomTags?.Modality} • {series.InstanceCount} images
                            </div>
                            {pct !== undefined && (
                              <div className="mt-1 w-full bg-gray-200 rounded h-1">
                                <div className="bg-gray-900 h-1 rounded" style={{ width: `${pct}%` }} />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="ml-2 flex-shrink-0">
                          {downloadingFrom === key ? (
                            <span className="text-[9px] font-bold">{pct ?? 0}%</span>
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t bg-white flex justify-end gap-2">
              <button
                onClick={() => { setShowSeriesModal(false); onClose(); }}
                className="px-4 py-1 text-[10px] font-bold bg-gray-100 text-gray-700 rounded"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DownloadOptions;
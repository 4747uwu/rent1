import React, { useState, useEffect } from 'react';
import { X, Upload, Trash2, AlertCircle, CheckCircle, Loader, Package, Info, FileImage, FolderArchive } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

const ManualStudyCreator = ({ isOpen, onClose, onSuccess }) => {
    const { currentUser } = useAuth();
    const isLabStaff = currentUser?.role === 'lab_staff';
    
    const [step, setStep] = useState(1);
    const [uploadMode, setUploadMode] = useState(null);
    const [availableLabs, setAvailableLabs] = useState([]);

    const [formData, setFormData] = useState({
        patientName: '', patientId: '', patientBirthDate: '', patientSex: 'M', patientAge: '',
        studyDescription: '', seriesDescription: '', modality: 'CT', bodyPartExamined: '',
        accessionNumber: '', clinicalHistory: '', referringPhysician: '', institutionName: 'XCENTIC Medical Center',
        urgency: 'routine'
    });
    
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [selectedZips, setSelectedZips] = useState([]); 
    const [zipQueue, setZipQueue] = useState([]); 

    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadResult, setUploadResult] = useState(null);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (isOpen) {
            if (isLabStaff && currentUser.lab) {
                setFormData(prev => ({
                    ...prev, labId: currentUser.lab._id, organizationId: currentUser.organization?._id || currentUser.organizationId,
                    institutionName: currentUser.lab.name || 'XCENTIC Medical Center'
                }));
            } else {
                fetchLabs();
            }
            resetForm();
        }
    }, [isOpen, isLabStaff, currentUser]);

    const fetchLabs = async () => {
        try {
            const response = await api.get('/admin/labs');
            if (response.data.success) {
                setAvailableLabs(response.data.data);
                if (response.data.data.length > 0 && !isLabStaff) {
                    setFormData(prev => ({
                        ...prev, labId: response.data.data[0]._id, organizationId: response.data.data[0].organization,
                        institutionName: response.data.data[0].name || 'XCENTIC Medical Center'
                    }));
                }
            }
        } catch (error) { console.error('Error fetching labs:', error); }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
    };

    const handleLabChange = (e) => {
        const labId = e.target.value;
        const selectedLab = availableLabs.find(lab => lab._id === labId);
        if (selectedLab) {
            setFormData(prev => ({ ...prev, labId, organizationId: selectedLab.organization, institutionName: selectedLab.name || 'XCENTIC Medical Center' }));
        }
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        setSelectedFiles(prev => [...prev, ...files]);
        setErrors(prev => ({ ...prev, files: null }));
    };

    const handleZipFileChange = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const invalid = files.filter(f => !f.name.toLowerCase().endsWith('.zip'));
        if (invalid.length > 0) {
            setErrors(prev => ({ ...prev, zip: `Invalid files: ${invalid.map(f => f.name).join(', ')} - only .zip allowed` }));
            return;
        }
        setSelectedZips(prev => [...prev, ...files.map(f => ({ file: f, id: `${f.name}_${Date.now()}_${Math.random()}` }))]);
        setErrors(prev => ({ ...prev, zip: null }));
        e.target.value = '';
    };

    const removeFile = (index) => setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    const removeZip = (id) => setSelectedZips(prev => prev.filter(z => z.id !== id));

    const validateForm = () => {
        const newErrors = {};
        if (uploadMode === 'images') {
            if (!formData.patientName.trim()) newErrors.patientName = 'Patient name is required';
            if (!formData.patientId.trim()) newErrors.patientId = 'Patient ID is required';
            if (!formData.labId) newErrors.labId = 'Lab selection is required';
            if (!formData.modality) newErrors.modality = 'Modality is required';
            if (selectedFiles.length === 0) newErrors.files = 'At least one image file is required';
        } else if (uploadMode === 'zip') {
            if (!formData.labId) newErrors.labId = 'Lab selection is required';
            if (selectedZips.length === 0) newErrors.zip = 'At least one ZIP file is required';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;
        setStep(3);
        setUploading(true);
        setUploadProgress(0);

        try {
            if (uploadMode === 'zip') {
                const initialQueue = selectedZips.map(z => ({ ...z, status: 'pending', result: null, error: null }));
                setZipQueue(initialQueue);
                const results = [];
                const errorsList = [];

                for (let i = 0; i < selectedZips.length; i++) {
                    const zipEntry = selectedZips[i];
                    setZipQueue(prev => prev.map(z => z.id === zipEntry.id ? { ...z, status: 'uploading' } : z));
                    setUploadProgress(0);

                    try {
                        const formDataToSend = new FormData();
                        formDataToSend.append('uploadMode', 'zip');
                        formDataToSend.append('labId', formData.labId);
                        formDataToSend.append('organizationId', formData.organizationId);
                        formDataToSend.append('zipFile', zipEntry.file);

                        const response = await api.post('/admin/create-manual-study', formDataToSend, {
                            headers: { 'Content-Type': 'multipart/form-data' },
                            onUploadProgress: (progressEvent) => {
                                setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
                            },
                            timeout: 600000 
                        });

                        setZipQueue(prev => prev.map(z => z.id === zipEntry.id ? { ...z, status: 'done', result: response.data } : z));
                        results.push({ file: zipEntry.file.name, ...response.data });
                    } catch (err) {
                        const errMsg = err.response?.data?.message || err.message || 'Upload failed';
                        setZipQueue(prev => prev.map(z => z.id === zipEntry.id ? { ...z, status: 'error', error: errMsg } : z));
                        errorsList.push({ file: zipEntry.file.name, error: errMsg });
                    }
                    setUploadProgress(Math.round(((i + 1) / selectedZips.length) * 100));
                }

                setUploading(false);
                const allSuccess = errorsList.length === 0;
                const someSuccess = results.length > 0;

                setUploadResult({
                    success: allSuccess || someSuccess,
                    isMultiZip: true,
                    message: allSuccess ? `All ${results.length} ZIP(s) processed successfully!` : someSuccess ? `${results.length} ZIP(s) succeeded, ${errorsList.length} failed` : `All ${errorsList.length} ZIP(s) failed`,
                    results, errors: errorsList
                });

                if (onSuccess && someSuccess) onSuccess({ multiZip: true, results });

            } else {
                const formDataToSend = new FormData();
                formDataToSend.append('uploadMode', uploadMode);
                formDataToSend.append('labId', formData.labId);
                formDataToSend.append('organizationId', formData.organizationId);
                Object.keys(formData).forEach(key => {
                    if (formData[key] && key !== 'labId' && key !== 'organizationId') formDataToSend.append(key, formData[key]);
                });
                selectedFiles.forEach(file => formDataToSend.append('images', file));

                const response = await api.post('/admin/create-manual-study', formDataToSend, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (progressEvent) => setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total))
                });

                setUploading(false);
                setUploadResult({ success: true, message: response.data.message, data: response.data.data });
                if (onSuccess) onSuccess(response.data.data);
            }
        } catch (error) {
            setUploading(false);
            setUploadResult({ success: false, message: error.response?.data?.message || 'Failed to create study.' });
        }
    };

    const resetForm = () => {
        setStep(1); setUploadMode(null);
        const baseFormData = {
            patientName: '', patientId: '', patientBirthDate: '', patientSex: 'M', patientAge: '',
            studyDescription: '', seriesDescription: '', modality: 'CT', bodyPartExamined: '',
            accessionNumber: '', clinicalHistory: '', referringPhysician: '', institutionName: 'XCENTIC Medical Center', urgency: 'routine'
        };
        
        if (isLabStaff && currentUser?.lab) {
            setFormData({ ...baseFormData, labId: currentUser.lab._id, organizationId: currentUser.organization?._id || currentUser.organizationId, institutionName: currentUser.lab.name || 'XCENTIC Medical Center' });
        } else {
            setFormData({ ...baseFormData, labId: availableLabs.length > 0 ? availableLabs[0]._id : '', organizationId: availableLabs.length > 0 ? availableLabs[0].organization : '' });
        }
        
        setSelectedFiles([]); setSelectedZips([]); setZipQueue([]); setUploading(false); setUploadProgress(0); setUploadResult(null); setErrors({});
    };

    const handleClose = () => { resetForm(); onClose(); };

    if (!isOpen) return null;

    return (
        // ✅ COMPACT: Tight backdrop & wrapper
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[10000] p-2">
            <div className="bg-white rounded w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col border border-gray-900 shadow-2xl">
                
                {/* ✅ COMPACT HEADER */}
                <div className="px-3 py-2 bg-gray-900 text-white flex items-center justify-between flex-shrink-0">
                    <div>
                        <h2 className="text-xs font-bold uppercase truncate">Create Manual Study</h2>
                        {isLabStaff && currentUser?.lab && (
                            <p className="text-[9px] text-gray-300 mt-0 uppercase truncate leading-tight">
                                LAB: {currentUser.lab.name}
                            </p>
                        )}
                    </div>
                    <button onClick={handleClose} className="p-1 hover:bg-gray-700 rounded transition-colors flex-shrink-0">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* ✅ COMPACT STEPPER */}
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                    <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-gray-900' : 'text-gray-400'}`}>
                        <div className={`w-4 h-4 flex items-center justify-center rounded-full text-[8px] font-bold ${step >= 1 ? 'bg-gray-900 text-white' : 'bg-gray-200'}`}>1</div>
                        <span className="text-[9px] font-bold uppercase">Mode</span>
                    </div>
                    <div className={`flex-1 h-px mx-2 ${step >= 2 ? 'bg-gray-900' : 'bg-gray-200'}`} />
                    <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-gray-900' : 'text-gray-400'}`}>
                        <div className={`w-4 h-4 flex items-center justify-center rounded-full text-[8px] font-bold ${step >= 2 ? 'bg-gray-900 text-white' : 'bg-gray-200'}`}>2</div>
                        <span className="text-[9px] font-bold uppercase">Upload</span>
                    </div>
                    <div className={`flex-1 h-px mx-2 ${step >= 3 ? 'bg-gray-900' : 'bg-gray-200'}`} />
                    <div className={`flex items-center gap-1.5 ${step >= 3 ? 'text-gray-900' : 'text-gray-400'}`}>
                        <div className={`w-4 h-4 flex items-center justify-center rounded-full text-[8px] font-bold ${step >= 3 ? 'bg-gray-900 text-white' : 'bg-gray-200'}`}>3</div>
                        <span className="text-[9px] font-bold uppercase">Done</span>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto bg-white p-3">
                    
                    {/* STEP 1: MODE */}
                    {step === 1 && (
                        <div className="space-y-3">
                            <div className="text-center mb-4 mt-2">
                                <h3 className="text-[11px] font-bold text-gray-800 uppercase">Select Upload Mode</h3>
                                <p className="text-[9px] text-gray-500 uppercase mt-0.5">Choose how you want to upload your study</p>
                            </div>

                            <button onClick={() => { setUploadMode('zip'); setStep(2); }} className="w-full flex items-center p-3 border border-gray-300 rounded hover:border-gray-900 bg-gray-50 transition-colors text-left group">
                                <div className="p-2 bg-gray-200 rounded group-hover:bg-gray-900 group-hover:text-white transition-colors">
                                    <FolderArchive className="w-5 h-5" />
                                </div>
                                <div className="ml-3 flex-1">
                                    <h4 className="text-[10px] font-bold text-gray-900 uppercase">ZIP File Upload <span className="ml-2 text-[8px] px-1.5 py-0.5 bg-green-100 text-green-800 rounded font-bold">RECOMMENDED</span></h4>
                                    <p className="text-[8px] text-gray-500 font-medium uppercase mt-0.5">Automatic extraction • Multiple ZIPs allowed</p>
                                </div>
                            </button>

                            <button onClick={() => { setUploadMode('images'); setStep(2); }} className="w-full flex items-center p-3 border border-gray-300 rounded hover:border-gray-900 bg-gray-50 transition-colors text-left group">
                                <div className="p-2 bg-gray-200 rounded group-hover:bg-gray-900 group-hover:text-white transition-colors">
                                    <FileImage className="w-5 h-5" />
                                </div>
                                <div className="ml-3 flex-1">
                                    <h4 className="text-[10px] font-bold text-gray-900 uppercase">Image Files Upload</h4>
                                    <p className="text-[8px] text-gray-500 font-medium uppercase mt-0.5">Manual data entry • Converts JPG/PNG to DICOM</p>
                                </div>
                            </button>
                        </div>
                    )}

                    {/* STEP 2: UPLOAD (ZIP MODE) */}
                    {step === 2 && uploadMode === 'zip' && (
                        <div className="space-y-3">
                            <div className="bg-gray-100 border border-gray-300 rounded p-2 flex items-center gap-2">
                                <FolderArchive className="w-4 h-4 text-gray-700 flex-shrink-0" />
                                <div className="text-[9px] text-gray-800 uppercase leading-tight font-medium">
                                    <span className="font-bold">ZIP Mode:</span> Data auto-extracted from DICOM tags.
                                </div>
                            </div>

                            {/* Lab Assignment */}
                            <div>
                                <label className="block text-[8px] font-bold text-gray-800 mb-1 uppercase">{isLabStaff ? 'Assigned Lab' : 'Select Lab'} <span className="text-red-500">*</span></label>
                                {isLabStaff ? (
                                    <div className="w-full px-2 py-1.5 border border-gray-300 bg-gray-50 rounded text-[10px] text-gray-900 font-bold flex items-center uppercase">
                                        <Package className="h-3.5 w-3.5 mr-1.5 text-gray-500" /> {currentUser?.lab?.name || 'Unknown Lab'}
                                    </div>
                                ) : (
                                    <select value={formData.labId} onChange={handleLabChange} className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 text-[10px] font-medium uppercase" required>
                                        <option value="">SELECT LAB...</option>
                                        {availableLabs.map(lab => <option key={lab._id} value={lab._id}>{lab.name}</option>)}
                                    </select>
                                )}
                                {errors.labId && <p className="text-red-500 text-[8px] font-bold uppercase mt-1">{errors.labId}</p>}
                            </div>

                            {/* ZIP Dropzone */}
                            <div>
                                <label className="block text-[8px] font-bold text-gray-800 mb-1 uppercase">Upload ZIP File(s) <span className="text-red-500">*</span> <span className="text-gray-500 font-medium">(MAX 500MB EA)</span></label>
                                <div className="border border-dashed border-gray-400 rounded p-4 text-center hover:border-gray-900 hover:bg-gray-50 transition-colors cursor-pointer bg-white">
                                    <input type="file" accept=".zip" multiple onChange={handleZipFileChange} className="hidden" id="zip-upload" />
                                    <label htmlFor="zip-upload" className="cursor-pointer block w-full h-full">
                                        <Upload className="mx-auto h-6 w-6 text-gray-500 mb-1" />
                                        <p className="text-[10px] text-gray-800 font-bold uppercase">Click to select ZIP(s)</p>
                                    </label>
                                </div>
                                {errors.zip && <p className="text-red-500 text-[8px] font-bold uppercase mt-1">{errors.zip}</p>}
                            </div>

                            {/* Selected Zips Queue */}
                            {selectedZips.length > 0 && (
                                <div className="mt-2 border border-gray-200 rounded overflow-hidden">
                                    <div className="bg-gray-100 px-2 py-1.5 flex justify-between items-center border-b border-gray-200">
                                        <span className="text-[9px] font-bold text-gray-800 uppercase">{selectedZips.length} File(s) Queued</span>
                                        <button onClick={() => setSelectedZips([])} className="text-[8px] font-bold text-red-600 hover:underline uppercase" type="button">CLEAR ALL</button>
                                    </div>
                                    <div className="max-h-32 overflow-y-auto p-1.5 space-y-1">
                                        {selectedZips.map((zipEntry, index) => (
                                            <div key={zipEntry.id} className="flex items-center justify-between bg-white border border-gray-200 p-1.5 rounded">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className="text-[8px] font-bold w-4 h-4 rounded bg-gray-200 text-gray-700 flex items-center justify-center flex-shrink-0">{index + 1}</span>
                                                    <div className="truncate">
                                                        <p className="text-[9px] font-bold text-gray-900 truncate uppercase">{zipEntry.file.name}</p>
                                                        <p className="text-[8px] text-gray-500 font-medium uppercase">{(zipEntry.file.size / 1024 / 1024).toFixed(1)} MB</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => removeZip(zipEntry.id)} className="text-red-500 hover:text-red-700 p-1" type="button"><Trash2 className="h-3.5 w-3.5" /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2: UPLOAD (IMAGES MODE) */}
                    {step === 2 && uploadMode === 'images' && (
                        <div className="space-y-3">
                            <div className="bg-gray-100 border border-gray-300 rounded p-2 flex items-center gap-2">
                                <FileImage className="w-4 h-4 text-gray-700 flex-shrink-0" />
                                <div className="text-[9px] text-gray-800 uppercase leading-tight font-medium">
                                    <span className="font-bold">Image Mode:</span> Manual patient & study data entry required.
                                </div>
                            </div>

                            {/* Images Grid Form */}
                            <div>
                                <h3 className="text-[10px] font-bold text-gray-900 border-b border-gray-200 pb-1 mb-2 uppercase">Patient Details</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[8px] font-bold text-gray-800 mb-0.5 uppercase">Name <span className="text-red-500">*</span></label>
                                        <input type="text" name="patientName" value={formData.patientName} onChange={handleInputChange} className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 text-[10px] font-medium uppercase" required />
                                        {errors.patientName && <p className="text-red-500 text-[8px] mt-0.5">{errors.patientName}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-[8px] font-bold text-gray-800 mb-0.5 uppercase">ID <span className="text-red-500">*</span></label>
                                        <input type="text" name="patientId" value={formData.patientId} onChange={handleInputChange} className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 text-[10px] font-medium uppercase" required />
                                        {errors.patientId && <p className="text-red-500 text-[8px] mt-0.5">{errors.patientId}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-[8px] font-bold text-gray-800 mb-0.5 uppercase">Gender</label>
                                        <select name="patientSex" value={formData.patientSex} onChange={handleInputChange} className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 text-[10px] font-medium uppercase">
                                            <option value="M">M</option><option value="F">F</option><option value="O">O</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[8px] font-bold text-gray-800 mb-0.5 uppercase">Age (Yrs)</label>
                                        <input type="number" name="patientAge" value={formData.patientAge} onChange={handleInputChange} className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 text-[10px] font-medium uppercase" />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-[10px] font-bold text-gray-900 border-b border-gray-200 pb-1 mb-2 uppercase">Study Details</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[8px] font-bold text-gray-800 mb-0.5 uppercase">{isLabStaff ? 'Assigned Lab' : 'Lab'} <span className="text-red-500">*</span></label>
                                        {isLabStaff ? (
                                            <div className="w-full px-2 py-1.5 border border-gray-300 bg-gray-50 rounded text-[10px] text-gray-900 font-bold uppercase truncate">{currentUser?.lab?.name || 'UNK'}</div>
                                        ) : (
                                            <select value={formData.labId} onChange={handleLabChange} className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 text-[10px] font-medium uppercase" required>
                                                <option value="">SELECT...</option>
                                                {availableLabs.map(lab => <option key={lab._id} value={lab._id}>{lab.name}</option>)}
                                            </select>
                                        )}
                                        {errors.labId && <p className="text-red-500 text-[8px] mt-0.5">{errors.labId}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-[8px] font-bold text-gray-800 mb-0.5 uppercase">Modality <span className="text-red-500">*</span></label>
                                        <select name="modality" value={formData.modality} onChange={handleInputChange} className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 text-[10px] font-medium uppercase" required>
                                            <option value="CT">CT</option><option value="MR">MR</option><option value="CR">CR</option><option value="DX">DX</option><option value="US">US</option><option value="XA">XA</option><option value="OT">OT</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[8px] font-bold text-gray-800 mb-0.5 uppercase">Study Desc.</label>
                                        <input type="text" name="studyDescription" value={formData.studyDescription} onChange={handleInputChange} className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 text-[10px] font-medium uppercase" />
                                    </div>
                                    <div>
                                        <label className="block text-[8px] font-bold text-gray-800 mb-0.5 uppercase">Accession #</label>
                                        <input type="text" name="accessionNumber" value={formData.accessionNumber} onChange={handleInputChange} className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 text-[10px] font-medium uppercase" placeholder="AUTO" />
                                    </div>
                                    <div>
                                        <label className="block text-[8px] font-bold text-gray-800 mb-0.5 uppercase">Ref. Physician</label>
                                        <input type="text" name="referringPhysician" value={formData.referringPhysician} onChange={handleInputChange} className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 text-[10px] font-medium uppercase" />
                                    </div>
                                </div>
                            </div>

                            {/* Images Dropzone */}
                            <div>
                                <label className="block text-[8px] font-bold text-gray-800 mb-1 uppercase">Images <span className="text-red-500">*</span></label>
                                <div className="border border-dashed border-gray-400 rounded p-4 text-center hover:border-gray-900 hover:bg-gray-50 transition-colors cursor-pointer bg-white">
                                    <input type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" id="image-upload" />
                                    <label htmlFor="image-upload" className="cursor-pointer block">
                                        <Upload className="mx-auto h-5 w-5 text-gray-500 mb-1" />
                                        <p className="text-[10px] text-gray-800 font-bold uppercase">Select Images</p>
                                    </label>
                                </div>
                                {errors.files && <p className="text-red-500 text-[8px] font-bold uppercase mt-1">{errors.files}</p>}
                                
                                {selectedFiles.length > 0 && (
                                    <div className="mt-2 max-h-24 overflow-y-auto border border-gray-200 rounded p-1 space-y-1 bg-gray-50">
                                        {selectedFiles.map((file, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-white p-1 rounded border border-gray-200">
                                                <span className="text-[9px] font-bold uppercase truncate">{file.name}</span>
                                                <button onClick={() => removeFile(idx)} className="text-red-500 p-0.5"><X className="w-3 h-3"/></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STEP 3: PROGRESS / COMPLETE */}
                    {step === 3 && (
                        <div className="flex flex-col items-center justify-center p-6 space-y-4">
                            {uploading && (
                                <div className="w-full text-center space-y-3">
                                    <Loader className="h-8 w-8 text-gray-900 animate-spin mx-auto" />
                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                        <div className="bg-gray-900 h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-600 uppercase">
                                        {uploadMode === 'zip' ? 'EXTRACTING & UPLOADING...' : 'CONVERTING & UPLOADING...'} {uploadProgress}%
                                    </p>
                                </div>
                            )}

                            {uploadResult && (
                                <div className={`w-full rounded p-4 border ${uploadResult.success ? 'bg-gray-50 border-gray-300' : 'bg-red-50 border-red-200'}`}>
                                    <div className="flex items-center gap-3">
                                        {uploadResult.success ? <CheckCircle className="h-8 w-8 text-gray-900" /> : <AlertCircle className="h-8 w-8 text-red-600" />}
                                        <div>
                                            <h3 className={`text-xs font-bold uppercase ${uploadResult.success ? 'text-gray-900' : 'text-red-800'}`}>
                                                {uploadResult.success ? 'UPLOAD SUCCESS' : 'UPLOAD FAILED'}
                                            </h3>
                                            <p className={`text-[9px] font-medium uppercase mt-0.5 ${uploadResult.success ? 'text-gray-600' : 'text-red-600'}`}>
                                                {uploadResult.message}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Extraction Summary */}
                                    {uploadResult.success && uploadResult.data?.extractedData && (
                                        <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-3 gap-2 text-[9px] font-bold text-gray-800 uppercase text-center">
                                            <div className="bg-white p-1.5 rounded border border-gray-200">
                                                Studies: {uploadResult.data.extractedData.totalStudies}
                                            </div>
                                            <div className="bg-white p-1.5 rounded border border-gray-200">
                                                Series: {uploadResult.data.extractedData.totalSeries}
                                            </div>
                                            <div className="bg-white p-1.5 rounded border border-gray-200">
                                                Images: {uploadResult.data.extractedData.totalInstances}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ✅ COMPACT FOOTER */}
                <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex justify-between items-center flex-shrink-0">
                    <div>
                        {step === 2 && (
                            <button onClick={() => { setStep(1); setUploadMode(null); }} className="px-3 py-1.5 text-[9px] font-bold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors uppercase">
                                Back
                            </button>
                        )}
                    </div>
                    
                    <div className="flex gap-2">
                        {step === 3 && uploadResult ? (
                            <>
                                {uploadResult.success && (
                                    <button onClick={resetForm} className="px-3 py-1.5 text-[9px] font-bold text-gray-700 bg-gray-200 border border-gray-300 rounded hover:bg-gray-300 transition-colors uppercase">
                                        Upload Another
                                    </button>
                                )}
                                <button onClick={handleClose} className="px-3 py-1.5 text-[9px] font-bold text-white bg-gray-900 rounded hover:bg-black transition-colors uppercase">
                                    Close
                                </button>
                            </>
                        ) : step === 2 ? (
                            <button
                                onClick={handleSubmit}
                                disabled={(uploadMode === 'images' && selectedFiles.length === 0) || (uploadMode === 'zip' && selectedZips.length === 0) || !formData.labId}
                                className="px-4 py-1.5 text-[10px] font-bold text-white bg-gray-900 rounded hover:bg-black transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                            >
                                <Upload className="h-3 w-3 mr-1.5" />
                                {uploadMode === 'zip' ? `UPLOAD ${selectedZips.length > 0 ? `(${selectedZips.length})` : ''}` : 'CREATE STUDY'}
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManualStudyCreator;
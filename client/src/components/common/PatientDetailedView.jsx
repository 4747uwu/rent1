import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    User, Calendar, FileText, Activity, 
    Save, X, AlertCircle, CheckCircle, 
    Eye, Hospital, Stethoscope, Hash, Clock,
    RefreshCw
} from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';

// ✅ UPDATED: DIRECTLY EDITABLE FIELD with teal theme
const DirectEditField = ({ label, value, onChange, name, type = "text", rows = 1, readOnly = false }) => {
    return (
        <div className="bg-teal-50 border border-teal-200 rounded p-2"> {/* ✅ UPDATED: Teal background and border */}
            <label className="block text-xs font-medium text-teal-700 mb-1">{label}</label> {/* ✅ UPDATED: Teal label */}
            {type === "textarea" ? (
                <textarea
                    value={value || ''}
                    onChange={(e) => onChange(name, e.target.value)}
                    className="w-full text-sm text-gray-900 bg-transparent border-0 focus:ring-0 focus:outline-none resize-none p-0"
                    rows={rows}
                    placeholder={`Enter ${label.toLowerCase()}...`}
                    readOnly={readOnly}
                />
            ) : type === "select" ? (
                <select
                    value={value || ''}
                    onChange={(e) => onChange(name, e.target.value)}
                    className="w-full text-sm text-gray-900 bg-transparent border-0 focus:ring-0 focus:outline-none p-0"
                    disabled={readOnly}
                >
                    <option value="">Select {label.toLowerCase()}...</option>
                    {name === 'gender' && (
                        <>
                            <option value="M">Male</option>
                            <option value="F">Female</option>
                            <option value="O">Other</option>
                        </>
                    )}
                    {name === 'priority' && (
                        <>
                            <option value="SELECT">SELECT</option>
                            <option value="Emergency Case">Emergency Case</option>
                            <option value="Meet referral doctor">Meet referral doctor</option>
                            <option value="MLC Case">MLC Case</option>
                            <option value="Study Exception">Study Exception</option>
                        </>
                    )}
                    {name === 'modality' && (
                        <>
                            <option value="CT">CT</option>
                            <option value="MRI">MRI</option>
                            <option value="XR">X-Ray</option>
                            <option value="US">Ultrasound</option>
                            <option value="DX">Digital X-Ray</option>
                            <option value="CR">Computed Radiography</option>
                            <option value="MG">Mammography</option>
                            <option value="NM">Nuclear Medicine</option>
                            <option value="PT">PET</option>
                        </>
                    )}
                </select>
            ) : (
                <input
                    type={type}
                    value={value || ''}
                    onChange={(e) => onChange(name, e.target.value)}
                    className="w-full text-sm text-gray-900 bg-transparent border-0 focus:ring-0 focus:outline-none p-0"
                    placeholder={`Enter ${label.toLowerCase()}...`}
                    readOnly={readOnly}
                />
            )}
        </div>
    );
};

// ✅ UPDATED: READ ONLY FIELD with teal theme
const ReadOnlyField = ({ label, value, icon: Icon }) => {
    return (
        <div className="bg-teal-50 border border-teal-200 rounded p-2"> {/* ✅ UPDATED: Teal background and border */}
            <label className="block text-xs font-medium text-teal-700 mb-1 flex items-center gap-1"> {/* ✅ UPDATED: Teal label */}
                {Icon && <Icon className="w-3 h-3" />}
                {label}
            </label>
            <div className="text-sm text-gray-900 font-medium">{value || 'N/A'}</div>
        </div>
    );
};

// ✅ UPDATED: UPDATE SECTION WITH SAVE BUTTON with teal theme
const UpdateSection = ({ title, icon: Icon, children, onSave, saving, hasChanges }) => {
    return (
        <div className="bg-white rounded-lg border border-teal-300 overflow-hidden"> {/* ✅ UPDATED: Teal border */}
            <div className="bg-teal-100 px-4 py-3 border-b border-teal-200 flex items-center justify-between"> {/* ✅ UPDATED: Teal header */}
                <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-teal-600" /> {/* ✅ UPDATED: Teal icon */}
                    <h3 className="font-semibold text-teal-800 text-sm">{title}</h3> {/* ✅ UPDATED: Teal title */}
                </div>
                <button
                    onClick={onSave}
                    disabled={saving || !hasChanges}
                    className={`px-3 py-1 text-xs font-medium rounded transition-all flex items-center gap-1 ${
                        saving 
                            ? 'bg-gray-200 text-gray-600 cursor-not-allowed' 
                            : hasChanges
                                ? 'bg-teal-600 text-white hover:bg-teal-700' // ✅ UPDATED: Teal button
                                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    {saving ? (
                        <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="w-3 h-3" />
                            Update {title}
                        </>
                    )}
                </button>
            </div>
            <div className="p-4">
                {children}
            </div>
        </div>
    );
};

// ✅ UPDATED: STATUS BADGE with teal accents
const StatusBadge = ({ status }) => {
    const getStatusConfig = () => {
        switch (status) {
            case 'report_finalized':
                return { bg: 'bg-green-100', text: 'text-green-800', label: 'Finalized', dot: 'bg-green-500' };
            case 'assigned_to_doctor':
                return { bg: 'bg-teal-100', text: 'text-teal-800', label: 'Assigned', dot: 'bg-teal-500' }; // ✅ UPDATED: Teal for assigned
            case 'pending_assignment':
                return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending', dot: 'bg-yellow-500' };
            default:
                return { bg: 'bg-gray-100', text: 'text-gray-800', label: status?.replace(/_/g, ' ') || 'Unknown', dot: 'bg-gray-500' };
        }
    };
    
    const config = getStatusConfig();
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
            {config.label}
        </span>
    );
};

// ✅ MODAL CONTENT COMPONENT (rest of the component logic remains the same, just updating the header and save buttons)
const StudyDetailedViewContent = ({ studyId, onClose }) => {
    const [originalStudy, setOriginalStudy] = useState(null);
    const [study, setStudy] = useState(null);
    const [metadata, setMetadata] = useState(null);
    const [relatedStudies, setRelatedStudies] = useState([]);
    const [permissions, setPermissions] = useState({});
    const [loading, setLoading] = useState(true);
    
    // Form states for each section
    const [patientForm, setPatientForm] = useState({});
    const [studyForm, setStudyForm] = useState({});
    const [clinicalForm, setClinicalForm] = useState({});
    
    // Saving states
    const [savingPatient, setSavingPatient] = useState(false);
    const [savingStudy, setSavingStudy] = useState(false);
    const [savingClinical, setSavingClinical] = useState(false);
    const [savingAll, setSavingAll] = useState(false);

    // ✅ FETCH STUDY DETAILED VIEW (unchanged)
    useEffect(() => {
        if (studyId) {
            fetchStudyDetails();
        }
    }, [studyId]);

    const fetchStudyDetails = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/data-extraction/study-detailed-view/${studyId}`);
            
            if (response.data.success) {
                const { study, metadata, relatedStudies, permissions } = response.data.data;
                setOriginalStudy(study);
                setStudy(study);
                setMetadata(metadata);
                setRelatedStudies(relatedStudies);
                setPermissions(permissions);
                
                // Initialize forms with current data
                setPatientForm({
                    patientID: study.patient?.patientID || '',
                    fullName: study.patient?.fullName || '',
                    age: study.patient?.age?.toString() || '',
                    gender: study.patient?.gender || '',
                    phone: study.patient?.phone || '',
                    email: study.patient?.email || ''
                });
                
                setStudyForm({
                    examDescription: study.studyDetails?.examDescription || '',
                    modality: study.studyDetails?.modality || '',
                    accessionNumber: study.accessionNumber || '',
                    priority: study.workflow?.priority || ''
                });
                
                setClinicalForm({
                    clinicalHistory: study.clinicalHistory?.clinicalHistory || '',
                    previousInjury: study.clinicalHistory?.previousInjury || '',
                    previousSurgery: study.clinicalHistory?.previousSurgery || ''
                });
            }
        } catch (error) {
            console.error('Error fetching study details:', error);
            toast.error('Failed to load study details');
        } finally {
            setLoading(false);
        }
    };

    // ✅ CHANGE HANDLERS (unchanged)
    const handlePatientChange = (name, value) => {
        setPatientForm(prev => ({ ...prev, [name]: value }));
    };

    const handleStudyChange = (name, value) => {
        setStudyForm(prev => ({ ...prev, [name]: value }));
    };

    const handleClinicalChange = (name, value) => {
        setClinicalForm(prev => ({ ...prev, [name]: value }));
    };

    // ✅ CHECK FOR CHANGES (unchanged)
    const hasPatientChanges = () => {
        return (
            patientForm.patientID !== (originalStudy?.patient?.patientID || '') ||
            patientForm.fullName !== (originalStudy?.patient?.fullName || '') ||
            patientForm.age !== (originalStudy?.patient?.age?.toString() || '') ||
            patientForm.gender !== (originalStudy?.patient?.gender || '') ||
            patientForm.phone !== (originalStudy?.patient?.phone || '') ||
            patientForm.email !== (originalStudy?.patient?.email || '')
        );
    };

    const hasStudyChanges = () => {
        return (
            studyForm.examDescription !== (originalStudy?.studyDetails?.examDescription || '') ||
            studyForm.modality !== (originalStudy?.studyDetails?.modality || '') ||
            studyForm.accessionNumber !== (originalStudy?.accessionNumber || '') ||
            studyForm.priority !== (originalStudy?.workflow?.priority || '')
        );
    };

    const hasClinicalChanges = () => {
        return (
            clinicalForm.clinicalHistory !== (originalStudy?.clinicalHistory?.clinicalHistory || '') ||
            clinicalForm.previousInjury !== (originalStudy?.clinicalHistory?.previousInjury || '') ||
            clinicalForm.previousSurgery !== (originalStudy?.clinicalHistory?.previousSurgery || '')
        );
    };

    // ✅ SAVE HANDLERS (unchanged)
    const handleSavePatient = async () => {
        try {
            setSavingPatient(true);
            const response = await api.put(`/data-extraction/study-patient-info/${studyId}`, patientForm);
            
            if (response.data.success) {
                toast.success('Patient information updated successfully');
                // Update original data to reflect saved state
                setOriginalStudy(prev => ({
                    ...prev,
                    patient: response.data.data.patient
                }));
            }
        } catch (error) {
            console.error('Error updating patient info:', error);
            toast.error('Failed to update patient information');
        } finally {
            setSavingPatient(false);
        }
    };

    const handleSaveStudy = async () => {
        try {
            setSavingStudy(true);
            const response = await api.put(`/data-extraction/study-details/${studyId}`, studyForm);
            
            if (response.data.success) {
                toast.success('Study details updated successfully');
                setOriginalStudy(prev => ({
                    ...prev,
                    studyDetails: response.data.data.studyDetails,
                    accessionNumber: response.data.data.accessionNumber,
                    workflow: response.data.data.workflow
                }));
            }
        } catch (error) {
            console.error('Error updating study details:', error);
            toast.error('Failed to update study details');
        } finally {
            setSavingStudy(false);
        }
    };

    const handleSaveClinical = async () => {
        try {
            setSavingClinical(true);
            const response = await api.put(`/data-extraction/study-clinical-history/${studyId}`, clinicalForm);
            
            if (response.data.success) {
                toast.success('Clinical history updated successfully');
                setOriginalStudy(prev => ({
                    ...prev,
                    clinicalHistory: response.data.data.clinicalHistory
                }));
            }
        } catch (error) {
            console.error('Error updating clinical history:', error);
            toast.error('Failed to update clinical history');
        } finally {
            setSavingClinical(false);
        }
    };

    // ✅ SAVE ALL CHANGES (unchanged)
    const handleSaveAll = async () => {
        if (!hasPatientChanges() && !hasStudyChanges() && !hasClinicalChanges()) {
            toast.info('No changes to save');
            return;
        }

        try {
            setSavingAll(true);
            const promises = [];

            if (hasPatientChanges()) {
                promises.push(api.put(`/data-extraction/study-patient-info/${studyId}`, patientForm));
            }
            if (hasStudyChanges()) {
                promises.push(api.put(`/data-extraction/study-details/${studyId}`, studyForm));
            }
            if (hasClinicalChanges()) {
                promises.push(api.put(`/data-extraction/study-clinical-history/${studyId}`, clinicalForm));
            }

            await Promise.all(promises);
            toast.success('All changes saved successfully!');
            
            // Refresh the data
            await fetchStudyDetails();
        } catch (error) {
            console.error('Error saving all changes:', error);
            toast.error('Failed to save some changes');
        } finally {
            setSavingAll(false);
        }
    };

    // ✅ HANDLE ESC KEY (unchanged)
    useEffect(() => {
        const handleEscKey = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscKey);
        return () => document.removeEventListener('keydown', handleEscKey);
    }, [onClose]);

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
                <div className="bg-white p-8 rounded-xl shadow-2xl">
                    <div className="animate-spin w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full mx-auto"></div> {/* ✅ UPDATED: Teal spinner */}
                    <p className="mt-4 text-sm text-gray-600 font-medium">Loading study details...</p>
                </div>
            </div>
        );
    }

    if (!study) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
                <div className="bg-white p-8 rounded-xl shadow-2xl text-center max-w-sm">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-gray-800 font-semibold text-lg mb-2">Study not found</p>
                    <p className="text-gray-600 text-sm mb-4">The requested study could not be loaded</p>
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    const hasAnyChanges = hasPatientChanges() || hasStudyChanges() || hasClinicalChanges();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4">
            <div className="bg-teal-25 rounded-xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl"> {/* ✅ UPDATED: Teal background */}
                
                {/* ✅ UPDATED: HEADER WITH SAVE ALL BUTTON with teal gradient */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-teal-600 to-green-600 text-white"> {/* ✅ UPDATED: Teal gradient */}
                    <div className="flex items-center space-x-3">
                        <Eye className="w-5 h-5" />
                        <div>
                            <h2 className="text-lg font-bold">Study Details</h2>
                            <p className="text-xs text-teal-100 truncate max-w-md"> {/* ✅ UPDATED: Teal text */}
                                {study.studyDetails?.examDescription || 'Detailed View'}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                        {hasAnyChanges && (
                            <button
                                onClick={handleSaveAll}
                                disabled={savingAll}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                                    savingAll 
                                        ? 'bg-white bg-opacity-20 text-white cursor-not-allowed' 
                                        : 'bg-green-600 text-white hover:bg-green-700 shadow-lg'
                                }`}
                            >
                                {savingAll ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Saving All...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Save All Changes
                                    </>
                                )}
                            </button>
                        )}
                        <StatusBadge status={study.workflow?.status} />
                        {metadata?.urgency === 'emergency' && (
                            <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                                🚨 URGENT
                            </span>
                        )}
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* ✅ CONTENT - SCROLLABLE (all the UpdateSection components already have teal theme applied above) */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* ✅ LEFT COLUMN - 2/3 */}
                        <div className="lg:col-span-2 space-y-6">
                            
                            {/* ✅ PATIENT INFORMATION */}
                            <UpdateSection 
                                title="Patient Information" 
                                icon={User}
                                onSave={handleSavePatient}
                                saving={savingPatient}
                                hasChanges={hasPatientChanges()}
                            >
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <DirectEditField
                                        label="Patient ID"
                                        value={patientForm.patientID}
                                        onChange={handlePatientChange}
                                        name="patientID"
                                    />
                                    <DirectEditField
                                        label="Patient Name"
                                        value={patientForm.fullName}
                                        onChange={handlePatientChange}
                                        name="fullName"
                                    />
                                    <DirectEditField
                                        label="Age"
                                        value={patientForm.age}
                                        onChange={handlePatientChange}
                                        name="age"
                                        type="number"
                                    />
                                    <DirectEditField
                                        label="Gender"
                                        value={patientForm.gender}
                                        onChange={handlePatientChange}
                                        name="gender"
                                        type="select"
                                    />
                                    <DirectEditField
                                        label="Phone"
                                        value={patientForm.phone}
                                        onChange={handlePatientChange}
                                        name="phone"
                                    />
                                    <DirectEditField
                                        label="Email"
                                        value={patientForm.email}
                                        onChange={handlePatientChange}
                                        name="email"
                                        type="email"
                                    />
                                </div>
                            </UpdateSection>

                            {/* ✅ STUDY DETAILS */}
                            <UpdateSection 
                                title="Study Details" 
                                icon={FileText}
                                onSave={handleSaveStudy}
                                saving={savingStudy}
                                hasChanges={hasStudyChanges()}
                            >
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <ReadOnlyField
                                        label="Study Date"
                                        value={study.studyDetails?.studyDate ? new Date(study.studyDetails.studyDate).toLocaleDateString() : 'N/A'}
                                        icon={Calendar}
                                    />
                                    <DirectEditField
                                        label="Modality"
                                        value={studyForm.modality}
                                        onChange={handleStudyChange}
                                        name="modality"
                                        type="select"
                                    />
                                    <ReadOnlyField
                                        label="Series/Images"
                                        value={study.studyDetails?.seriesImages}
                                    />
                                    <DirectEditField
                                        label="Accession No"
                                        value={studyForm.accessionNumber}
                                        onChange={handleStudyChange}
                                        name="accessionNumber"
                                    />
                                    <DirectEditField
                                        label="Priority"
                                        value={studyForm.priority}
                                        onChange={handleStudyChange}
                                        name="priority"
                                        type="select"
                                    />
                                    <ReadOnlyField
                                        label="Study UID"
                                        value={study.studyInstanceUID?.substring(0, 20) + '...'}
                                    />
                                </div>
                                <div className="mt-3">
                                    <DirectEditField
                                        label="Exam Description"
                                        value={studyForm.examDescription}
                                        onChange={handleStudyChange}
                                        name="examDescription"
                                        type="textarea"
                                        rows={2}
                                    />
                                </div>
                            </UpdateSection>

                            {/* ✅ CLINICAL HISTORY */}
                            <UpdateSection 
                                title="Clinical History" 
                                icon={Stethoscope}
                                onSave={handleSaveClinical}
                                saving={savingClinical}
                                hasChanges={hasClinicalChanges()}
                            >
                                <div className="space-y-3">
                                    <DirectEditField
                                        label="Clinical History"
                                        value={clinicalForm.clinicalHistory}
                                        onChange={handleClinicalChange}
                                        name="clinicalHistory"
                                        type="textarea"
                                        rows={3}
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <DirectEditField
                                            label="Previous Injury"
                                            value={clinicalForm.previousInjury}
                                            onChange={handleClinicalChange}
                                            name="previousInjury"
                                            type="textarea"
                                            rows={2}
                                        />
                                        <DirectEditField
                                            label="Previous Surgery"
                                            value={clinicalForm.previousSurgery}
                                            onChange={handleClinicalChange}
                                            name="previousSurgery"
                                            type="textarea"
                                            rows={2}
                                        />
                                    </div>
                                    {study.clinicalHistory?.lastModifiedAt && (
                                        <div className="text-xs text-teal-600 pt-2 border-t border-teal-200 flex items-center gap-1"> {/* ✅ UPDATED: Teal colors */}
                                            <Clock className="w-3 h-3" />
                                            Last updated: {new Date(study.clinicalHistory.lastModifiedAt).toLocaleString()}
                                            {study.clinicalHistory.lastModifiedBy?.fullName && 
                                             ` by ${study.clinicalHistory.lastModifiedBy.fullName}`}
                                        </div>
                                    )}
                                </div>
                            </UpdateSection>

                            {/* ✅ UPDATED: LAB INFO with teal theme */}
                            {study.lab && (
                                <div className="bg-white rounded-lg border border-teal-300 overflow-hidden"> {/* ✅ UPDATED: Teal border */}
                                    <div className="bg-teal-100 px-4 py-3 border-b border-teal-200 flex items-center gap-2"> {/* ✅ UPDATED: Teal header */}
                                        <Hospital className="w-4 h-4 text-teal-600" /> {/* ✅ UPDATED: Teal icon */}
                                        <h3 className="font-semibold text-teal-800 text-sm">Laboratory Information</h3> {/* ✅ UPDATED: Teal title */}
                                    </div>
                                    <div className="p-4 grid grid-cols-2 gap-3">
                                        <ReadOnlyField label="Lab Name" value={study.lab.name} />
                                        <ReadOnlyField label="Lab ID" value={study.lab.identifier} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ✅ RIGHT COLUMN - 1/3 (updating sidebar sections with teal theme) */}
                        <div className="space-y-4">
                            
                            {/* ✅ UPDATED: WORKFLOW STATUS with teal theme */}
                            <div className="bg-white rounded-lg border border-teal-300 overflow-hidden"> {/* ✅ UPDATED: Teal border */}
                                <div className="bg-teal-100 px-4 py-3 border-b border-teal-200 flex items-center gap-2"> {/* ✅ UPDATED: Teal header */}
                                    <Activity className="w-4 h-4 text-teal-600" /> {/* ✅ UPDATED: Teal icon */}
                                    <h3 className="font-semibold text-teal-800 text-sm">Workflow Status</h3> {/* ✅ UPDATED: Teal title */}
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-teal-700 font-medium">Current Status</span> {/* ✅ UPDATED: Teal text */}
                                        <StatusBadge status={study.workflow?.status} />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-teal-700 font-medium">Report Available</span> {/* ✅ UPDATED: Teal text */}
                                        {study.workflow?.reportAvailable ? (
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <Clock className="w-4 h-4 text-gray-400" />
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-teal-700 font-medium">Days Old</span> {/* ✅ UPDATED: Teal text */}
                                        <span className="text-sm font-medium">{metadata?.createdDaysAgo || 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* ✅ UPDATED: ASSIGNMENTS with teal theme */}
                            {study.assignments && study.assignments.length > 0 && (
                                <div className="bg-white rounded-lg border border-teal-300 overflow-hidden"> {/* ✅ UPDATED: Teal border */}
                                    <div className="bg-teal-100 px-4 py-3 border-b border-teal-200 flex items-center gap-2"> {/* ✅ UPDATED: Teal header */}
                                        <User className="w-4 h-4 text-teal-600" /> {/* ✅ UPDATED: Teal icon */}
                                        <h3 className="font-semibold text-teal-800 text-sm">Assignments ({study.assignments.length})</h3> {/* ✅ UPDATED: Teal title */}
                                    </div>
                                    <div className="p-4 space-y-2 max-h-40 overflow-y-auto">
                                        {study.assignments.map((assignment, index) => (
                                            <div key={index} className="bg-teal-50 p-3 rounded border border-teal-200"> {/* ✅ UPDATED: Teal background */}
                                                <p className="text-sm font-semibold text-gray-900 truncate">
                                                    {assignment.assignedTo?.name}
                                                </p>
                                                <p className="text-xs text-gray-600 truncate">{assignment.assignedTo?.email}</p>
                                                <div className="flex items-center justify-between mt-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                        assignment.priority === 'URGENT' ? 'bg-red-100 text-red-800' :
                                                        assignment.priority === 'HIGH' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-green-100 text-green-800'
                                                    }`}>
                                                        {assignment.priority}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {new Date(assignment.assignedAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ✅ UPDATED: STATISTICS with teal theme */}
                            <div className="bg-white rounded-lg border border-teal-300 overflow-hidden"> {/* ✅ UPDATED: Teal border */}
                                <div className="bg-teal-100 px-4 py-3 border-b border-teal-200 flex items-center gap-2"> {/* ✅ UPDATED: Teal header */}
                                    <Hash className="w-4 h-4 text-teal-600" /> {/* ✅ UPDATED: Teal icon */}
                                    <h3 className="font-semibold text-teal-800 text-sm">Statistics</h3> {/* ✅ UPDATED: Teal title */}
                                </div>
                                <div className="p-4 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-teal-700 font-medium">Reports</span> {/* ✅ UPDATED: Teal text */}
                                        <span className="text-sm font-bold">{metadata?.reportCount || 0}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-teal-700 font-medium">Discussions</span> {/* ✅ UPDATED: Teal text */}
                                        <span className="text-sm font-bold">{metadata?.discussionCount || 0}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-teal-700 font-medium">Status Changes</span> {/* ✅ UPDATED: Teal text */}
                                        <span className="text-sm font-bold">{metadata?.statusChanges || 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* ✅ UPDATED: RELATED STUDIES with teal theme */}
                            {relatedStudies?.length > 0 && (
                                <div className="bg-white rounded-lg border border-teal-300 overflow-hidden"> {/* ✅ UPDATED: Teal border */}
                                    <div className="bg-teal-100 px-4 py-3 border-b border-teal-200 flex items-center gap-2"> {/* ✅ UPDATED: Teal header */}
                                        <FileText className="w-4 h-4 text-teal-600" /> {/* ✅ UPDATED: Teal icon */}
                                        <h3 className="font-semibold text-teal-800 text-sm">Related Studies ({relatedStudies.length})</h3> {/* ✅ UPDATED: Teal title */}
                                    </div>
                                    <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                                        {relatedStudies.map((related) => (
                                            <div key={related._id} className="bg-teal-50 p-3 rounded border border-teal-200 hover:border-teal-300 transition-colors cursor-pointer"> {/* ✅ UPDATED: Teal background and hover */}
                                                <p className="text-xs font-semibold truncate text-gray-900">
                                                    {related.examDescription || 'Study'}
                                                </p>
                                                <div className="flex items-center justify-between mt-1">
                                                    <span className="text-xs text-gray-600">
                                                        {related.modality} • {new Date(related.studyDate).toLocaleDateString()}
                                                    </span>
                                                    {related.ReportAvailable && (
                                                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ✅ MAIN COMPONENT WITH PORTAL (unchanged)
const StudyDetailedView = ({ studyId, onClose }) => {
    if (!studyId) return null;
    
    return createPortal(
        <StudyDetailedViewContent studyId={studyId} onClose={onClose} />,
        document.body
    );
};

export default StudyDetailedView;
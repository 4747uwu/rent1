import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
    ArrowLeft, 
    UserPlus, 
    Mail, 
    Lock, 
    User, 
    Stethoscope, 
    Phone, 
    FileText,
    Upload,
    Save,
    CheckCircle,
    ChevronRight,
    ChevronLeft,
    Shield,
    Image,
    X,
    Award,
    Eye,
    EyeOff,
    Sparkles,
    Columns,
    IndianRupee,
    Landmark,
    Clock,
    Sun,
    Moon,
    CreditCard,
    Building
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import ColumnSelector from '../../components/common/ColumnSelector';
import { getDefaultColumnsForRole } from '../../constants/worklistColumns';

const TOTAL_STEPS = 7;

const MODALITY_OPTIONS = ['CT', 'MRI', 'MR', 'XR', 'CR', 'DX', 'US', 'MG', 'NM', 'PT', 'RF', 'OT'];
const SUBSPECIALTY_OPTIONS = ['Neuroradiology', 'Musculoskeletal', 'Body/Abdominal', 'Chest/Thoracic', 'Cardiac', 'Breast Imaging', 'Pediatric', 'Interventional', 'Emergency', 'Oncology'];

const CreateDoctor = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const fileInputRef = useRef(null);
    const panCardInputRef = useRef(null);
    const regCertInputRef = useRef(null);
    const mouInputRef = useRef(null);
    const otherDocsInputRef = useRef(null);
    
    // Form state
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    
    // Form data
    const [formData, setFormData] = useState({
        fullName: '',
        username: '',
        password: '',
        mobileNumber: '',
        emailId: '',
        specialization: '',
        licenseNumber: '',
        registrationNumber: '',
        department: '',
        qualifications: [],
        yearsOfExperience: '',
        contactPhoneOffice: '',
        requireReportVerification: true,
        visibleColumns: [],
        // Professional details
        reportingModalityExpertise: [],
        subSpecialtyTags: [],
        reportingAvailability: 'day', // day, night, both
        tatPreference: '',
        // Financial details
        panCardNumber: '',
        bankDetails: {
            accountHolderName: '',
            accountNumber: '',
            ifscCode: '',
            bankName: ''
        },
        // Charges
        perCaseCharges: '',
        modalityCharges: {
            CT: '',
            MRI: '',
            XR: '',
            US: '',
            OTHER: ''
        },
        emergencyNightCharges: ''
    });

    // Document uploads
    const [signatureImage, setSignatureImage] = useState(null);
    const [signaturePreview, setSignaturePreview] = useState(null);
    const [panCardFile, setPanCardFile] = useState(null);
    const [regCertFile, setRegCertFile] = useState(null);
    const [mouFile, setMouFile] = useState(null);
    const [otherDocs, setOtherDocs] = useState([]);

    // Verifiers
    const [availableVerifiers, setAvailableVerifiers] = useState([]);
    const [selectedVerifiers, setSelectedVerifiers] = useState([]);

    // Initialize default columns for radiologist role
    useEffect(() => {
        const defaultCols = getDefaultColumnsForRole(['radiologist']);
        setFormData(prev => ({ ...prev, visibleColumns: defaultCols }));
    }, []);

    // Fetch verifiers when verification is toggled ON
    useEffect(() => {
        if (formData.requireReportVerification && availableVerifiers.length === 0) {
            fetchVerifiers();
        }
    }, [formData.requireReportVerification]);

    const fetchVerifiers = async () => {
        try {
            const response = await api.get('/admin/user-management/role/verifier');
            setAvailableVerifiers(response.data.data || []);
        } catch (error) {
            console.error('Error fetching verifiers:', error);
        }
    };

    // Handle input changes
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: {
                    ...prev[parent],
                    [child]: type === 'checkbox' ? checked : value
                }
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            }));
        }
    };

    // Handle qualifications array
    const handleQualificationChange = (index, value) => {
        const newQualifications = [...formData.qualifications];
        newQualifications[index] = value;
        setFormData(prev => ({
            ...prev,
            qualifications: newQualifications
        }));
    };

    const addQualification = () => {
        setFormData(prev => ({
            ...prev,
            qualifications: [...prev.qualifications, '']
        }));
    };

    const removeQualification = (index) => {
        setFormData(prev => ({
            ...prev,
            qualifications: prev.qualifications.filter((_, i) => i !== index)
        }));
    };

    // Column selection
    const handleColumnToggle = (columnId) => {
        setFormData(prev => {
            const isSelected = prev.visibleColumns.includes(columnId);
            return {
                ...prev,
                visibleColumns: isSelected
                    ? prev.visibleColumns.filter(id => id !== columnId)
                    : [...prev.visibleColumns, columnId]
            };
        });
    };

    const handleSelectAllColumns = (columns) => {
        setFormData(prev => ({ ...prev, visibleColumns: columns }));
    };

    const handleClearAllColumns = () => {
        setFormData(prev => ({ ...prev, visibleColumns: [] }));
    };

    // Modality expertise toggle
    const toggleModality = (mod) => {
        setFormData(prev => ({
            ...prev,
            reportingModalityExpertise: prev.reportingModalityExpertise.includes(mod)
                ? prev.reportingModalityExpertise.filter(m => m !== mod)
                : [...prev.reportingModalityExpertise, mod]
        }));
    };

    // Sub-specialty toggle
    const toggleSubSpecialty = (tag) => {
        setFormData(prev => ({
            ...prev,
            subSpecialtyTags: prev.subSpecialtyTags.includes(tag)
                ? prev.subSpecialtyTags.filter(t => t !== tag)
                : [...prev.subSpecialtyTags, tag]
        }));
    };

    // Username handler
    const handleUsernameChange = (e) => {
        const value = e.target.value
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, '')
            .replace(/\s+/g, '');
        setFormData(prev => ({ ...prev, username: value }));
    };

    // Signature handling
    const handleSignatureUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast.error('Image size must be less than 5MB'); return; }
        if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return; }
        setSignatureImage(file);
        const reader = new FileReader();
        reader.onloadend = () => setSignaturePreview(reader.result);
        reader.readAsDataURL(file);
    };

    const removeSignature = () => {
        setSignatureImage(null);
        setSignaturePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Document uploads
    const handleDocUpload = (setter, ref) => (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 50 * 1024 * 1024) { toast.error('File must be less than 50MB'); return; }
        setter(file);
    };

    const handleOtherDocsUpload = (e) => {
        const files = Array.from(e.target.files).filter(f => f.size <= 50 * 1024 * 1024);
        setOtherDocs(prev => [...prev, ...files]);
    };

    const convertImageToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    // Form validation
    const validateStep = (step) => {
        if (step === 1) {
            return formData.fullName.trim() && formData.username.trim() && formData.password.trim();
        }
        return true;
    };

    // Form submission
    const handleCreateDoctor = async () => {
        if (!validateStep(1)) {
            toast.error('Please fill in Full Name, Username and Password');
            return;
        }

        setLoading(true);

        try {
            let signatureBase64 = null;
            if (signatureImage) {
                signatureBase64 = await convertImageToBase64(signatureImage);
            }

            const payload = {
                fullName: formData.fullName.trim(),
                email: formData.username.trim(),
                password: formData.password,
                specialization: formData.specialization?.trim() || 'General Radiology',
                licenseNumber: formData.licenseNumber?.trim() || undefined,
                registrationNumber: formData.registrationNumber?.trim() || undefined,
                department: formData.department?.trim() || undefined,
                qualifications: formData.qualifications.filter(q => q.trim()),
                yearsOfExperience: formData.yearsOfExperience ? parseInt(formData.yearsOfExperience) : undefined,
                contactPhoneOffice: formData.contactPhoneOffice?.trim() || undefined,
                mobileNumber: formData.mobileNumber?.trim() || undefined,
                emailId: formData.emailId?.trim() || undefined,
                signatureImageData: signatureBase64 || undefined,
                requireReportVerification: formData.requireReportVerification,
                visibleColumns: formData.visibleColumns,
                reportingModalityExpertise: formData.reportingModalityExpertise,
                subSpecialtyTags: formData.subSpecialtyTags,
                reportingAvailability: formData.reportingAvailability,
                tatPreference: formData.tatPreference?.trim() || undefined,
                panCardNumber: formData.panCardNumber?.trim() || undefined,
                bankDetails: formData.bankDetails.accountNumber ? formData.bankDetails : undefined,
                perCaseCharges: formData.perCaseCharges ? parseFloat(formData.perCaseCharges) : undefined,
                modalityCharges: Object.values(formData.modalityCharges).some(v => v) ? formData.modalityCharges : undefined,
                emergencyNightCharges: formData.emergencyNightCharges ? parseFloat(formData.emergencyNightCharges) : undefined
            };

            const response = await api.post('/admin/admin-crud/doctors', payload);

            if (response.data.success) {
                const newDoctorUserId = response.data.data?.user?._id;

                if (selectedVerifiers.length > 0 && newDoctorUserId) {
                    await Promise.allSettled(
                        selectedVerifiers.map(verifierId =>
                            api.put(`/admin/manage-users/${verifierId}/role-config`, {
                                roleConfig: {
                                    assignedRadiologists: [newDoctorUserId]
                                }
                            })
                        )
                    );
                    toast.success(`Doctor created and linked to ${selectedVerifiers.length} verifier(s)!`);
                } else {
                    toast.success(`Doctor created! Login: ${formData.username}@radivue.com`);
                }

                navigate('/admin/dashboard');
            }
        } catch (error) {
            console.error('Create doctor error:', error);
            toast.error(error.response?.data?.message || 'Failed to create doctor');
        } finally {
            setLoading(false);
        }
    };

    const nextStep = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => Math.min(prev + 1, TOTAL_STEPS));
        } else {
            toast.error('Please fill in all required fields');
        }
    };

    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    const steps = [
        { step: 1, label: 'Account', icon: User },
        { step: 2, label: 'Professional', icon: Stethoscope },
        { step: 3, label: 'Signature', icon: Award },
        { step: 4, label: 'Financial', icon: Landmark },
        { step: 5, label: 'Charges', icon: IndianRupee },
        { step: 6, label: 'Documents', icon: FileText },
        { step: 7, label: 'Columns', icon: Columns }
    ];

    const DocUploadBlock = ({ label, file, inputRef, onUpload, onRemove, accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png" }) => (
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
            {!file ? (
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors cursor-pointer" onClick={() => inputRef.current?.click()}>
                    <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-500">Click to upload (Max 50MB)</p>
                    <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onUpload} />
                </div>
            ) : (
                <div className="border border-blue-200 bg-blue-50 rounded-lg p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-medium text-blue-900 truncate max-w-[180px]">{file.name}</span>
                    </div>
                    <button type="button" onClick={onRemove} className="text-blue-600 hover:text-blue-800"><X className="w-4 h-4" /></button>
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
            {/* Floating background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-20 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                <div className="absolute top-40 right-20 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
            </div>

            <div className="relative min-h-screen flex items-center justify-center p-4">
                <div className="w-full max-w-4xl">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg mb-4">
                            <Stethoscope className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-800 mb-2">Create Radiologist Profile</h1>
                        <p className="text-slate-600">Add a new radiologist with complete professional and financial details</p>
                    </div>

                    {/* Progress Steps */}
                    <div className="mb-8 overflow-x-auto">
                        <div className="flex items-center justify-center space-x-2 min-w-max px-4">
                            {steps.map(({ step, label, icon: Icon }, index) => (
                                <React.Fragment key={step}>
                                    <div className="flex flex-col items-center cursor-pointer" onClick={() => { if (step <= currentStep || validateStep(currentStep)) setCurrentStep(step); }}>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                            currentStep >= step
                                                ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg'
                                                : 'bg-white text-slate-400 border-2 border-slate-200'
                                        }`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <span className={`text-[10px] mt-1.5 font-medium ${
                                            currentStep >= step ? 'text-blue-600' : 'text-slate-400'
                                        }`}>
                                            {label}
                                        </span>
                                    </div>
                                    {index < steps.length - 1 && (
                                        <div className={`w-10 h-0.5 rounded transition-all mt-[-12px] ${
                                            currentStep > step ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-slate-200'
                                        }`} />
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    {/* Form Card */}
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                        <form onSubmit={(e) => e.preventDefault()}>

                            {/* Step 1: Account Details */}
                            {currentStep === 1 && (
                                <div className="p-8 space-y-6">
                                    <div className="flex items-center space-x-3 mb-6">
                                        <div className="p-2 bg-blue-100 rounded-lg"><User className="w-5 h-5 text-blue-600" /></div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-800">Account Details</h2>
                                            <p className="text-sm text-slate-600">Basic login credentials and contact info</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Full Name <span className="text-red-500">*</span></label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Dr. Full Name" required />
                                            </div>
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Username <span className="text-red-500">*</span></label>
                                            <div className="flex rounded-lg border border-slate-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 overflow-hidden">
                                                <div className="relative flex-1 flex items-center">
                                                    <User className="absolute left-3 w-5 h-5 text-slate-400" />
                                                    <input type="text" value={formData.username} onChange={handleUsernameChange} className="w-full pl-10 pr-4 py-2.5 outline-none border-none focus:ring-0" placeholder="dr.name" required />
                                                </div>
                                                <span className="flex items-center px-3 bg-blue-50 text-blue-600 text-sm border-l border-slate-300 whitespace-nowrap font-medium">@radivue.com</span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded border border-gray-100 italic">Login: <strong>{formData.username || 'username'}@radivue.com</strong></p>
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Password <span className="text-red-500">*</span></label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleInputChange} className="w-full pl-10 pr-12 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Enter secure password" required />
                                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Mobile Number</label>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                <input type="tel" name="mobileNumber" value={formData.mobileNumber} onChange={handleInputChange} className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="+91 XXXXX XXXXX" />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Email ID</label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                <input type="email" name="emailId" value={formData.emailId} onChange={handleInputChange} className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="doctor@email.com" />
                                            </div>
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Specialization <span className="text-slate-400 text-xs ml-1">(optional — defaults to General Radiology)</span>
                                            </label>
                                            <div className="relative">
                                                <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                <input type="text" name="specialization" value={formData.specialization} onChange={handleInputChange} className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., Radiology, Cardiology (optional)" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Professional Details */}
                            {currentStep === 2 && (
                                <div className="p-8 space-y-6">
                                    <div className="flex items-center space-x-3 mb-6">
                                        <div className="p-2 bg-indigo-100 rounded-lg"><Stethoscope className="w-5 h-5 text-indigo-600" /></div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-800">Professional Details</h2>
                                            <p className="text-sm text-slate-600">Credentials, expertise, and availability</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Registration Number (MCI/State)</label>
                                            <input type="text" name="registrationNumber" value={formData.registrationNumber} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="MCI/State registration number" />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">License Number</label>
                                            <input type="text" name="licenseNumber" value={formData.licenseNumber} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Medical license number" />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Department</label>
                                            <input type="text" name="department" value={formData.department} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Department name" />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Years of Experience</label>
                                            <input type="number" name="yearsOfExperience" value={formData.yearsOfExperience} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="0" min="0" />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Office Phone</label>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                <input type="tel" name="contactPhoneOffice" value={formData.contactPhoneOffice} onChange={handleInputChange} className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="+91 (555) 123-4567" />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">TAT Preference</label>
                                            <div className="relative">
                                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                <input type="text" name="tatPreference" value={formData.tatPreference} onChange={handleInputChange} className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g., 2 hours, 24 hours" />
                                            </div>
                                        </div>

                                        {/* Reporting Modality Expertise */}
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Reporting Modality Expertise</label>
                                            <div className="flex flex-wrap gap-2">
                                                {MODALITY_OPTIONS.map(mod => (
                                                    <button key={mod} type="button" onClick={() => toggleModality(mod)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${formData.reportingModalityExpertise.includes(mod) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}>
                                                        {mod}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Sub-specialty Tags */}
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Sub-specialty Tags</label>
                                            <div className="flex flex-wrap gap-2">
                                                {SUBSPECIALTY_OPTIONS.map(tag => (
                                                    <button key={tag} type="button" onClick={() => toggleSubSpecialty(tag)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${formData.subSpecialtyTags.includes(tag) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-300 hover:border-purple-400'}`}>
                                                        {tag}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Reporting Availability */}
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Reporting Availability</label>
                                            <div className="flex gap-3">
                                                {[
                                                    { value: 'day', label: 'Day Shift', icon: Sun, color: 'amber' },
                                                    { value: 'night', label: 'Night Shift', icon: Moon, color: 'indigo' },
                                                    { value: 'both', label: 'Both', icon: Clock, color: 'teal' }
                                                ].map(({ value, label, icon: Icon, color }) => (
                                                    <button key={value} type="button" onClick={() => setFormData(prev => ({ ...prev, reportingAvailability: value }))} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all font-medium text-sm ${formData.reportingAvailability === value ? `border-${color}-500 bg-${color}-50 text-${color}-700` : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                                        <Icon className="w-4 h-4" />
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Qualifications</label>
                                            <div className="space-y-2">
                                                {formData.qualifications.map((qual, index) => (
                                                    <div key={index} className="flex space-x-2">
                                                        <input type="text" value={qual} onChange={(e) => handleQualificationChange(index, e.target.value)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g., MD, MBBS, Fellowship" />
                                                        <button type="button" onClick={() => removeQualification(index)} className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors">
                                                            <X className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button type="button" onClick={addQualification} className="w-full px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
                                                    + Add Qualification
                                                </button>
                                            </div>
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input type="checkbox" name="requireReportVerification" checked={formData.requireReportVerification} onChange={handleInputChange} className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                                                <div>
                                                    <div className="text-sm font-medium text-slate-700">Require Report Verification</div>
                                                    <div className="text-xs text-slate-500">Reports by this doctor will need verification before finalization</div>
                                                </div>
                                            </label>
                                        </div>

                                        {formData.requireReportVerification && (
                                            <div className="md:col-span-2 mt-2">
                                                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <CheckCircle className="w-4 h-4 text-indigo-600" />
                                                        <label className="text-sm font-semibold text-indigo-900">
                                                            Assign Verifier(s) <span className="ml-1 text-xs font-normal text-indigo-500">(optional — can be done later)</span>
                                                        </label>
                                                    </div>
                                                    {availableVerifiers.length === 0 ? (
                                                        <div className="text-center py-4 text-sm text-slate-500 border border-dashed border-indigo-300 rounded-lg">
                                                            No verifiers found.{' '}
                                                            <button type="button" onClick={() => navigate('/admin/create-user')} className="text-indigo-600 underline">Create one first</button>
                                                        </div>
                                                    ) : (
                                                        <div className="border border-indigo-200 rounded-lg divide-y divide-indigo-100 max-h-40 overflow-y-auto bg-white">
                                                            {availableVerifiers.map(v => (
                                                                <label key={v._id} className="flex items-center gap-3 px-3 py-2 hover:bg-indigo-50 cursor-pointer">
                                                                    <input type="checkbox" checked={selectedVerifiers.includes(v._id)} onChange={() => setSelectedVerifiers(prev => prev.includes(v._id) ? prev.filter(id => id !== v._id) : [...prev, v._id])} className="w-4 h-4 text-indigo-600 rounded border-gray-300" />
                                                                    <div>
                                                                        <div className="text-sm font-medium text-slate-800">{v.fullName}</div>
                                                                        <div className="text-xs text-slate-400">{v.email}</div>
                                                                    </div>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {selectedVerifiers.length > 0 && (
                                                        <p className="text-xs text-indigo-700 mt-2">✅ {selectedVerifiers.length} verifier(s) will be linked</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Signature Upload */}
                            {currentStep === 3 && (
                                <div className="p-8 space-y-6">
                                    <div className="flex items-center space-x-3 mb-6">
                                        <div className="p-2 bg-purple-100 rounded-lg"><Award className="w-5 h-5 text-purple-600" /></div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-800">Digital Signature</h2>
                                            <p className="text-sm text-slate-600">Upload signature for report authentication (optional)</p>
                                        </div>
                                    </div>
                                    {!signaturePreview ? (
                                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-8">
                                            <div className="text-center">
                                                <Upload className="mx-auto w-12 h-12 text-slate-400 mb-4" />
                                                <h3 className="text-sm font-medium text-slate-700 mb-2">Upload Signature Image</h3>
                                                <p className="text-xs text-slate-500 mb-4">PNG, JPG up to 5MB</p>
                                                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" id="signature-upload" />
                                                <label htmlFor="signature-upload" className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer transition-colors">
                                                    <Image className="w-4 h-4 mr-2" /> Choose Image
                                                </label>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center space-x-2">
                                                    <CheckCircle className="w-5 h-5 text-purple-600" />
                                                    <span className="text-sm font-medium text-purple-900">Signature Uploaded</span>
                                                </div>
                                                <button type="button" onClick={removeSignature} className="text-purple-600 hover:text-purple-800 transition-colors"><X className="w-5 h-5" /></button>
                                            </div>
                                            <div className="bg-white rounded-lg p-4 flex items-center justify-center">
                                                <img src={signaturePreview} alt="Signature preview" className="max-h-32 object-contain" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 4: Financial Details */}
                            {currentStep === 4 && (
                                <div className="p-8 space-y-6">
                                    <div className="flex items-center space-x-3 mb-6">
                                        <div className="p-2 bg-emerald-100 rounded-lg"><Landmark className="w-5 h-5 text-emerald-600" /></div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-800">Financial Details</h2>
                                            <p className="text-sm text-slate-600">PAN card and bank account information for payments</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-2">PAN Card Number</label>
                                            <div className="relative">
                                                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                <input type="text" name="panCardNumber" value={formData.panCardNumber} onChange={handleInputChange} className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 uppercase" placeholder="ABCDE1234F" maxLength={10} />
                                            </div>
                                        </div>

                                        <div className="md:col-span-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                                <Building className="w-4 h-4 text-slate-500" /> Bank Account Details
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">Account Holder Name</label>
                                                    <input type="text" name="bankDetails.accountHolderName" value={formData.bankDetails.accountHolderName} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm" placeholder="Name as on bank account" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">Account Number</label>
                                                    <input type="text" name="bankDetails.accountNumber" value={formData.bankDetails.accountNumber} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm" placeholder="Account number" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">IFSC Code</label>
                                                    <input type="text" name="bankDetails.ifscCode" value={formData.bankDetails.ifscCode} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm uppercase" placeholder="ABCD0123456" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">Bank Name</label>
                                                    <input type="text" name="bankDetails.bankName" value={formData.bankDetails.bankName} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm" placeholder="Bank name" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 5: Charges Configuration */}
                            {currentStep === 5 && (
                                <div className="p-8 space-y-6">
                                    <div className="flex items-center space-x-3 mb-6">
                                        <div className="p-2 bg-amber-100 rounded-lg"><IndianRupee className="w-5 h-5 text-amber-600" /></div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-800">Charges Configuration</h2>
                                            <p className="text-sm text-slate-600">Optional — set per-case and modality-wise charges</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Per Case Charges (₹)</label>
                                            <div className="relative">
                                                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                <input type="number" name="perCaseCharges" value={formData.perCaseCharges} onChange={handleInputChange} className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500" placeholder="0" min="0" />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Emergency / Night Charges (₹)</label>
                                            <div className="relative">
                                                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                <input type="number" name="emergencyNightCharges" value={formData.emergencyNightCharges} onChange={handleInputChange} className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500" placeholder="0" min="0" />
                                            </div>
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-3">Modality-wise Charges (₹)</label>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                {Object.keys(formData.modalityCharges).map(mod => (
                                                    <div key={mod} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                                        <label className="block text-xs font-bold text-slate-600 mb-1">{mod}</label>
                                                        <div className="relative">
                                                            <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                                            <input type="number" name={`modalityCharges.${mod}`} value={formData.modalityCharges[mod]} onChange={handleInputChange} className="w-full pl-7 pr-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500" placeholder="0" min="0" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 6: Document Uploads */}
                            {currentStep === 6 && (
                                <div className="p-8 space-y-6">
                                    <div className="flex items-center space-x-3 mb-6">
                                        <div className="p-2 bg-rose-100 rounded-lg"><FileText className="w-5 h-5 text-rose-600" /></div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-800">Document Upload</h2>
                                            <p className="text-sm text-slate-600">Upload supporting documents (optional)</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <DocUploadBlock label="PAN Card" file={panCardFile} inputRef={panCardInputRef} onUpload={handleDocUpload(setPanCardFile, panCardInputRef)} onRemove={() => { setPanCardFile(null); if(panCardInputRef.current) panCardInputRef.current.value=''; }} />
                                        <DocUploadBlock label="Medical Registration Certificate" file={regCertFile} inputRef={regCertInputRef} onUpload={handleDocUpload(setRegCertFile, regCertInputRef)} onRemove={() => { setRegCertFile(null); if(regCertInputRef.current) regCertInputRef.current.value=''; }} />
                                        <DocUploadBlock label="MOU / Agreement" file={mouFile} inputRef={mouInputRef} onUpload={handleDocUpload(setMouFile, mouInputRef)} onRemove={() => { setMouFile(null); if(mouInputRef.current) mouInputRef.current.value=''; }} />
                                        
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Other Supporting Documents</label>
                                            <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors cursor-pointer" onClick={() => otherDocsInputRef.current?.click()}>
                                                <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                                                <p className="text-xs text-slate-500">Click to upload (Multiple files)</p>
                                                <input ref={otherDocsInputRef} type="file" multiple className="hidden" onChange={handleOtherDocsUpload} />
                                            </div>
                                            {otherDocs.length > 0 && (
                                                <div className="mt-2 space-y-1">
                                                    {otherDocs.map((doc, i) => (
                                                        <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
                                                            <span className="text-xs text-slate-700 truncate max-w-[200px]">{doc.name}</span>
                                                            <button type="button" onClick={() => setOtherDocs(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 7: Column Selection */}
                            {currentStep === 7 && (
                                <div className="p-8 space-y-6">
                                    <div className="flex items-center space-x-3 mb-6">
                                        <div className="p-2 bg-teal-100 rounded-lg"><Columns className="w-5 h-5 text-teal-600" /></div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-800">Worklist Columns</h2>
                                            <p className="text-sm text-slate-600">Choose which columns this doctor can see</p>
                                        </div>
                                    </div>
                                    <ColumnSelector
                                        selectedColumns={formData.visibleColumns}
                                        onColumnToggle={handleColumnToggle}
                                        onSelectAll={handleSelectAllColumns}
                                        onClearAll={handleClearAllColumns}
                                        userRoles={['radiologist']}
                                        formData={formData}
                                        setFormData={setFormData}
                                        useMultiRole={false}
                                    />
                                </div>
                            )}

                            {/* Navigation Buttons */}
                            <div className="px-8 py-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                                <button type="button" onClick={() => navigate('/admin/dashboard')} className="flex items-center space-x-2 px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors">
                                    <ArrowLeft className="w-4 h-4" />
                                    <span>Cancel</span>
                                </button>

                                <div className="flex items-center space-x-3">
                                    {currentStep > 1 && (
                                        <button type="button" onClick={prevStep} className="flex items-center space-x-2 px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                                            <ChevronLeft className="w-4 h-4" />
                                            <span>Previous</span>
                                        </button>
                                    )}

                                    {currentStep < TOTAL_STEPS ? (
                                        <button type="button" onClick={nextStep} className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg">
                                            <span>Next</span>
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    ) : (
                                        <button type="button" onClick={handleCreateDoctor} disabled={loading} className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                                            {loading ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                    <span>Creating...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="w-4 h-4" />
                                                    <span>Create Doctor Profile</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateDoctor;
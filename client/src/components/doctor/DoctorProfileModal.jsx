import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Trash2, Save, User, Briefcase, FileText, Loader2, ImageIcon } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';

const DoctorProfileModal = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    department: '',
    licenseNumber: '',
    signature: ''
  });
  const [signaturePreview, setSignaturePreview] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) fetchDoctorProfile();
  }, [isOpen]);

  const fetchDoctorProfile = async () => {
    setLoading(true);
    try {
      const response = await api.get('/doctor/profile');
      if (response.data.success) {
        const data = response.data.data;
        setProfileData(data);
        setFormData({
          fullName: data.userAccount?.fullName || '',
          department: data.department || '',
          licenseNumber: data.licenseNumber || '',
          signature: data.signature || ''
        });
        setSignaturePreview(data.signature || '');
      }
    } catch (error) {
      console.error('Error fetching doctor profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size should be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      setSignaturePreview(base64String);
      setFormData((prev) => ({ ...prev, signature: base64String }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSignature = () => {
    setSignaturePreview('');
    setFormData((prev) => ({ ...prev, signature: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const payload = {
        department: formData.department,
        licenseNumber: formData.licenseNumber,
        signature: formData.signature
      };

      const response = await api.put('/doctor/profile', payload);
      if (response.data.success) {
        toast.success('Profile updated successfully!');
        if (onSuccess) onSuccess(response.data.data);
        onClose();
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-gray-200/60"
        style={{ maxHeight: 'min(88vh, 620px)' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-sm">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-gray-900 leading-tight">Doctor Profile</h2>
              <p className="text-[11px] text-gray-400 leading-tight">Credentials & signature</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Fields in a 2-col grid where possible */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Name */}
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    <User className="w-3 h-3" /> Full Name
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="w-full h-9 px-3 text-[13px] border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all outline-none"
                    placeholder="Dr. Full Name"
                  />
                </div>

                {/* Department */}
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    <Briefcase className="w-3 h-3" /> Department
                  </label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full h-9 px-3 text-[13px] border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all outline-none"
                    placeholder="e.g., Radiology"
                  />
                </div>

                {/* License */}
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    <FileText className="w-3 h-3" /> License No.
                  </label>
                  <input
                    type="text"
                    name="licenseNumber"
                    value={formData.licenseNumber}
                    onChange={handleInputChange}
                    className="w-full h-9 px-3 text-[13px] border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all outline-none font-mono"
                    placeholder="REG 06626"
                  />
                </div>
              </div>

              {/* DOCX Preview */}
              <div className="rounded-lg border border-gray-100 bg-gradient-to-br from-gray-50 to-slate-50 p-3">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-2">Report Footer Preview</p>
                <div className="text-[13px] leading-snug font-semibold text-gray-800 space-y-0.5">
                  <div>{formData.fullName || '—'}</div>
                  <div className="text-gray-500 font-medium">{formData.department || '—'}</div>
                  <div className="text-gray-400 font-mono text-[12px]">{formData.licenseNumber || '—'}</div>
                </div>
              </div>

              {/* Signature */}
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Digital Signature
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSignatureUpload}
                  className="hidden"
                />

                {signaturePreview ? (
                  <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Current</span>
                      <button
                        type="button"
                        onClick={handleRemoveSignature}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    </div>
                    <div className="p-3 flex items-center justify-center bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]">
                      <img src={signaturePreview} alt="Signature" className="max-h-16 object-contain" />
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-3 p-3 border-2 border-dashed border-gray-200 rounded-lg hover:border-teal-300 hover:bg-teal-50/30 transition-all group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-teal-100 flex items-center justify-center transition-colors shrink-0">
                      <Upload className="w-4.5 h-4.5 text-gray-400 group-hover:text-teal-600 transition-colors" />
                    </div>
                    <div className="text-left">
                      <p className="text-[12px] font-semibold text-gray-600 group-hover:text-teal-700 transition-colors">Upload signature image</p>
                      <p className="text-[10px] text-gray-400">PNG, JPG — max 2 MB</p>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-3.5 h-8 text-[12px] font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveProfile}
            disabled={saving || loading}
            className="flex items-center gap-1.5 px-4 h-8 text-[12px] font-bold text-white bg-gradient-to-r from-teal-600 to-teal-500 rounded-lg hover:from-teal-700 hover:to-teal-600 shadow-sm shadow-teal-200 transition-all disabled:opacity-50"
          >
            {saving ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
            ) : (
              <><Save className="w-3.5 h-3.5" /> Save Profile</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DoctorProfileModal;
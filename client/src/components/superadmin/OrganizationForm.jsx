import React, { useState } from 'react';
import { X, Save, RefreshCw, ChevronLeft, ChevronRight, Check, Building, User, Phone, MapPin, Settings } from 'lucide-react';

const OrganizationForm = ({ 
  isOpen, 
  onClose, 
  isEdit = false, 
  formData, 
  setFormData, 
  formErrors, 
  isSubmitting, 
  onSubmit 
}) => {
  const [currentStep, setCurrentStep] = useState(1);

  if (!isOpen) return null;

  const updateFormData = (path, value) => {
    const pathArray = path.split('.');
    const newFormData = { ...formData };
    let current = newFormData;
    
    for (let i = 0; i < pathArray.length - 1; i++) {
      if (!current[pathArray[i]]) {
        current[pathArray[i]] = {};
      }
      current = current[pathArray[i]];
    }
    
    current[pathArray[pathArray.length - 1]] = value;
    setFormData(newFormData);
  };

  const steps = [
    { 
      id: 1, 
      title: 'Basic', 
      icon: Building,
      description: 'Organization details'
    },
    { 
      id: 2, 
      title: 'Admin', 
      icon: User,
      description: 'Administrator account',
      hideInEdit: true
    },
    { 
      id: 3, 
      title: 'Contact', 
      icon: Phone,
      description: 'Contact information'
    },
    { 
      id: 4, 
      title: 'Address', 
      icon: MapPin,
      description: 'Location details'
    }
  ];

  const visibleSteps = isEdit ? steps.filter(step => !step.hideInEdit) : steps;
  const maxStep = visibleSteps.length;

  const nextStep = () => {
    if (currentStep < maxStep) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step) => {
    setCurrentStep(step);
  };

  const getStepErrors = (stepNumber) => {
    switch (stepNumber) {
      case 1:
        return ['name', 'identifier', 'displayName', 'companyType'].some(field => formErrors[field]);
      case 2:
        return ['adminEmail', 'adminPassword', 'adminFullName'].some(field => formErrors[field]);
      default:
        return false;
    }
  };

  const renderPreviewContent = () => {
    return (
      <div className="space-y-8">
        {/* Organization Header */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 text-white">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
              <Building className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">
                {formData.displayName || 'Organization Name'}
              </h3>
              <p className="text-gray-300 font-mono text-sm">
                {formData.identifier || 'IDENTIFIER'}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Type</p>
              <p className="font-medium capitalize">
                {formData.companyType?.replace('_', ' ') || 'Hospital'}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Status</p>
              <p className="font-medium text-green-400">Active</p>
            </div>
          </div>
        </div>

        {/* Contact Preview */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
            <Phone className="h-4 w-4 mr-2" />
            Primary Contact
          </h4>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-500">Name</p>
              <p className="font-medium">
                {formData.contactInfo?.primaryContact?.name || 'Not specified'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Email</p>
              <p className="font-medium">
                {formData.contactInfo?.primaryContact?.email || 'Not specified'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Phone</p>
              <p className="font-medium">
                {formData.contactInfo?.primaryContact?.phone || 'Not specified'}
              </p>
            </div>
          </div>
        </div>

        {/* Address Preview */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
            <MapPin className="h-4 w-4 mr-2" />
            Address
          </h4>
          <div className="text-sm text-gray-600">
            {formData.address?.street && (
              <p>{formData.address.street}</p>
            )}
            <p>
              {[
                formData.address?.city,
                formData.address?.state,
                formData.address?.zipCode
              ].filter(Boolean).join(', ')}
            </p>
            {formData.address?.country && (
              <p className="font-medium">{formData.address.country}</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    const actualStep = isEdit && currentStep >= 2 ? currentStep + 1 : currentStep;
    
    switch (actualStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {/* Organization Name */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Organization Name *
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => updateFormData('name', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all ${
                    formErrors.name ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Enter organization name"
                  disabled={isSubmitting}
                />
                {formErrors.name && <p className="text-sm text-red-600 mt-1">{formErrors.name}</p>}
              </div>

              {/* ✅ IDENTIFIER - Only show in EDIT mode, hide in CREATE mode */}
              {isEdit && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Identifier <span className="text-xs text-gray-500">(Auto-generated, cannot be changed)</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={formData.identifier || ''}
                      className="w-full px-4 py-3 border rounded-lg font-mono bg-gray-100 cursor-not-allowed border-gray-300 text-gray-600"
                      disabled
                      readOnly
                    />
                    <div className="flex-shrink-0 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg">
                      <span className="text-xs text-gray-500 font-medium">Auto-generated</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    This 4-letter code was automatically generated and cannot be modified
                  </p>
                </div>
              )}

              {/* ✅ ADD: Info message in CREATE mode */}
              {!isEdit && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-blue-800">Auto-generated Identifier</h4>
                      <p className="text-xs text-blue-700 mt-1">
                        A unique 4-letter code will be automatically generated for this organization
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Display Name *
                </label>
                <input
                  type="text"
                  value={formData.displayName || ''}
                  onChange={(e) => updateFormData('displayName', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all ${
                    formErrors.displayName ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Display name for the organization"
                  disabled={isSubmitting}
                />
                {formErrors.displayName && <p className="text-sm text-red-600 mt-1">{formErrors.displayName}</p>}
              </div>

              {/* Company Type */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Company Type *
                </label>
                <select
                  value={formData.companyType || 'hospital'}
                  onChange={(e) => updateFormData('companyType', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all ${
                    formErrors.companyType ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  disabled={isSubmitting}
                >
                  <option value="hospital">Hospital</option>
                  <option value="clinic">Clinic</option>
                  <option value="imaging_center">Imaging Center</option>
                  <option value="teleradiology">Teleradiology</option>
                  <option value="diagnostic_center">Diagnostic Center</option>
                </select>
                {formErrors.companyType && <p className="text-sm text-red-600 mt-1">{formErrors.companyType}</p>}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            {isEdit && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Admin credentials are displayed from the organization's primary administrator account.
                </p>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Admin Username * {isEdit && <span className="text-xs text-gray-500">(Read-only in edit mode)</span>}
              </label>
              <div className={`flex rounded-lg border overflow-hidden transition-all ${
                isEdit
                  ? 'bg-gray-100 border-gray-300'
                  : formErrors.adminEmail
                  ? 'border-red-500 bg-red-50 ring-2 ring-red-300'
                  : 'border-gray-300 focus-within:ring-2 focus-within:ring-black focus-within:border-black'
              }`}>
                <input
                  type="text"
                  value={formData.adminEmail || ''}
                  onChange={(e) => updateFormData('adminEmail', e.target.value.replace(/[@\s]/g, '').toLowerCase())}
                  className="flex-1 px-4 py-3 outline-none border-none bg-transparent focus:ring-0"
                  placeholder="username"
                  disabled={isEdit || isSubmitting}
                  readOnly={isEdit}
                />
                <span className="flex items-center px-3 bg-gray-100 text-gray-500 text-sm border-l border-gray-300 whitespace-nowrap">
                  @bharatpacs.com
                </span>
              </div>
              {!isEdit && formData.adminEmail && (
                <p className="text-xs text-gray-400 mt-1">Login: <strong>{formData.adminEmail}@bharatpacs.com</strong></p>
              )}
              {formErrors.adminEmail && <p className="text-sm text-red-600 mt-1">{formErrors.adminEmail}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Admin Password * {isEdit && <span className="text-xs text-gray-500">(Current password)</span>}
              </label>
              <input
                type="text"
                value={formData.adminPassword || ''}
                onChange={(e) => updateFormData('adminPassword', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg font-mono transition-all ${
                  isEdit
                    ? 'bg-gray-100 cursor-not-allowed border-gray-300 text-gray-600'
                    : formErrors.adminPassword 
                    ? 'border-red-500 bg-red-50 focus:outline-none focus:ring-2 focus:ring-black focus:border-black' 
                    : 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:border-black'
                }`}
                placeholder={isEdit ? "Current password" : "Strong password"}
                disabled={isEdit || isSubmitting}
                readOnly={isEdit}
              />
              {formErrors.adminPassword && <p className="text-sm text-red-600 mt-1">{formErrors.adminPassword}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Admin Full Name * {isEdit && <span className="text-xs text-gray-500">(Read-only in edit mode)</span>}
              </label>
              <input
                type="text"
                value={formData.adminFullName || ''}
                onChange={(e) => updateFormData('adminFullName', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg transition-all ${
                  isEdit
                    ? 'bg-gray-100 cursor-not-allowed border-gray-300 text-gray-600'
                    : formErrors.adminFullName 
                    ? 'border-red-500 bg-red-50 focus:outline-none focus:ring-2 focus:ring-black focus:border-black' 
                    : 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:border-black'
                }`}
                placeholder="Administrator's full name"
                disabled={isEdit || isSubmitting}
                readOnly={isEdit}
              />
              {formErrors.adminFullName && <p className="text-sm text-red-600 mt-1">{formErrors.adminFullName}</p>}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Primary Contact Name
              </label>
              <input
                type="text"
                value={formData.contactInfo?.primaryContact?.name || ''}
                onChange={(e) => updateFormData('contactInfo.primaryContact.name', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all"
                placeholder="Contact person name"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Primary Contact Email
              </label>
              <input
                type="email"
                value={formData.contactInfo?.primaryContact?.email || ''}
                onChange={(e) => updateFormData('contactInfo.primaryContact.email', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all"
                placeholder="contact@organization.com"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Primary Contact Phone
              </label>
              <input
                type="tel"
                value={formData.contactInfo?.primaryContact?.phone || ''}
                onChange={(e) => updateFormData('contactInfo.primaryContact.phone', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all"
                placeholder="+1-555-0000"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Designation
              </label>
              <input
                type="text"
                value={formData.contactInfo?.primaryContact?.designation || ''}
                onChange={(e) => updateFormData('contactInfo.primaryContact.designation', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all"
                placeholder="e.g., Chief Medical Officer"
                disabled={isSubmitting}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Street Address
              </label>
              <input
                type="text"
                value={formData.address?.street || ''}
                onChange={(e) => updateFormData('address.street', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all"
                placeholder="Street address"
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={formData.address?.city || ''}
                  onChange={(e) => updateFormData('address.city', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all"
                  placeholder="City"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  State
                </label>
                <input
                  type="text"
                  value={formData.address?.state || ''}
                  onChange={(e) => updateFormData('address.state', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all"
                  placeholder="State"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  ZIP Code
                </label>
                <input
                  type="text"
                  value={formData.address?.zipCode || ''}
                  onChange={(e) => updateFormData('address.zipCode', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all"
                  placeholder="ZIP Code"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Country
                </label>
                <select
                  value={formData.address?.country || 'USA'}
                  onChange={(e) => updateFormData('address.country', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all"
                  disabled={isSubmitting}
                >
                  <option value="USA">United States</option>
                  <option value="Canada">Canada</option>
                  <option value="UK">United Kingdom</option>
                  <option value="India">India</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden shadow-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
          
          {/* Left Side - Preview */}
          <div className="bg-gray-50 p-8 overflow-y-auto max-h-[95vh]">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {isEdit ? 'Edit Organization' : 'Create Organization'}
              </h2>
              <p className="text-gray-600">
                {isEdit ? 'Update organization details' : 'Set up a new organization with admin user'}
              </p>
            </div>

            {renderPreviewContent()}
          </div>

          {/* Right Side - Form */}
          <div className="flex flex-col h-full">
            {/* Header with Steps */}
            <div className="px-8 py-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  {visibleSteps.map((step, index) => {
                    const stepNumber = index + 1;
                    const isActive = currentStep === stepNumber;
                    const isCompleted = currentStep > stepNumber;
                    const hasError = getStepErrors(step.id);
                    
                    return (
                      <button
                        key={step.id}
                        onClick={() => goToStep(stepNumber)}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          isActive 
                            ? 'bg-black text-white' 
                            : isCompleted 
                            ? 'bg-green-100 text-green-700' 
                            : hasError
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        disabled={isSubmitting}
                      >
                        <step.icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{step.title}</span>
                        {isCompleted && <Check className="h-4 w-4" />}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  disabled={isSubmitting}
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              {/* Step Title */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {visibleSteps[currentStep - 1]?.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {visibleSteps[currentStep - 1]?.description}
                </p>
              </div>
            </div>

            {/* Form Content */}
            <div className="flex-1 px-8 py-6 overflow-y-auto">
              {renderStepContent()}
            </div>

            {/* Footer with Navigation */}
            <div className="px-8 py-6 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={prevStep}
                  className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    currentStep === 1
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={currentStep === 1 || isSubmitting}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>

                  {currentStep < maxStep ? (
                    <button
                      type="button"
                      onClick={nextStep}
                      className="flex items-center space-x-2 px-6 py-2 text-sm font-medium text-white bg-black border border-transparent rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all"
                      disabled={isSubmitting}
                    >
                      <span>Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={onSubmit}
                      className="flex items-center space-x-2 px-6 py-2 text-sm font-medium text-white bg-black border border-transparent rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          <span>{isEdit ? 'Update Organization' : 'Create Organization'}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationForm;
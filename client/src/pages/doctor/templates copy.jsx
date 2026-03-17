import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Navbar from '../../components/common/Navbar';
import api from '../../services/api';
import TextToHtmlService from '../../services/textToHtml.js'; // ✅ Import the service
import { 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  Eye, 
  Globe, 
  User, 
  FileText,
  Tag,
  Calendar,
  BarChart3,
  X,
  Save,
  ChevronDown,
  Code,
  Type,
  Zap // ✅ New icons for conversion features
} from 'lucide-react';
import toast from 'react-hot-toast';

const DoctorTemplates = () => {
  const { currentUser, currentOrganizationContext } = useAuth();
  
  // State management
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('all'); // 'all' or 'my-templates'
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Form state for create/edit
  const [formData, setFormData] = useState({
    title: '',
    category: 'General',
    htmlContent: '',
    description: '',
    tags: [],
    isDefault: false
  });

  const [formErrors, setFormErrors] = useState({});

  // Category options
  const categoryOptions = [
    'General', 'CT', 'CR', 'CT SCREENING FORMAT', 'ECHO', 
    'EEG-TMT-NCS', 'MR', 'MRI SCREENING FORMAT', 'PT', 'US', 'Other'
  ];

  // ✅ NEW: Text conversion state
  const [inputMode, setInputMode] = useState('text'); // 'text' or 'html'
  const [plainTextContent, setPlainTextContent] = useState('');
  const [conversionOptions, setConversionOptions] = useState({
    formatHeaders: true,
    formatLists: true,
    formatMedicalTerms: true,
    createParagraphs: true,
    addPageBreaks: false
  });
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = viewMode === 'my-templates' ? '/doctor/templates/my-templates' : '/doctor/templates/all';
      const params = {
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        search: searchTerm || undefined,
        page: currentPage,
        limit: 12
      };

      const response = await api.get(endpoint, { params });
      if (response.data.success) {
        setTemplates(response.data.templates);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  }, [viewMode, selectedCategory, searchTerm, currentPage]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get('/doctor/templates/categories');
      if (response.data.success) {
        setCategories(response.data.categories);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchTemplates();
    fetchCategories();
  }, [fetchTemplates, fetchCategories]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, selectedCategory, searchTerm]);

  // Handlers
  const handleSearch = useCallback((value) => {
    setSearchTerm(value);
  }, []);

  const handleCategoryChange = useCallback((category) => {
    setSelectedCategory(category);
  }, []);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  // ✅ ENHANCED: Handle create template with text conversion
  const handleCreateTemplate = useCallback(() => {
    setFormData({
      title: '',
      category: 'General',
      htmlContent: '',
      description: '',
      tags: [],
      isDefault: false
    });
    setPlainTextContent(''); // ✅ Reset text content
    setPreviewHtml(''); // ✅ Reset preview
    setInputMode('text'); // ✅ Default to text mode
    setShowPreview(false);
    setFormErrors({});
    setShowCreateModal(true);
  }, []);

  // ✅ ENHANCED: Handle edit template with HTML to text conversion option
  const handleEditTemplate = useCallback((template) => {
    setSelectedTemplate(template);
    setFormData({
      title: template.title,
      category: template.category,
      htmlContent: template.htmlContent,
      description: template.templateMetadata?.description || '',
      tags: template.templateMetadata?.tags || [],
      isDefault: template.templateMetadata?.isDefault || false
    });
    
    // ✅ Try to convert HTML back to text for editing
    try {
      const plainText = TextToHtmlService.htmlToText(template.htmlContent);
      setPlainTextContent(plainText);
      setInputMode('text'); // Start in text mode for easier editing
    } catch (error) {
      console.warn('Could not convert HTML to text, using HTML mode');
      setPlainTextContent('');
      setInputMode('html');
    }
    
    setPreviewHtml(template.htmlContent);
    setShowPreview(false);
    setFormErrors({});
    setShowEditModal(true);
  }, []);

  // ✅ NEW: Handle input mode change
  const handleInputModeChange = (mode) => {
    setInputMode(mode);
    
    if (mode === 'text' && formData.htmlContent) {
      // Convert HTML back to text when switching to text mode
      try {
        const plainText = TextToHtmlService.htmlToText(formData.htmlContent);
        setPlainTextContent(plainText);
      } catch (error) {
        console.warn('Could not convert HTML to text');
        setPlainTextContent('');
      }
    } else if (mode === 'html' && plainTextContent) {
      // Use converted HTML when switching to HTML mode
      handleTextToHtml();
    }
  };

  // Convert text to HTML in real-time
  const handleTextToHtml = useCallback(() => {
    if (!plainTextContent.trim()) {
      setPreviewHtml('');
      setFormData(prev => ({ ...prev, htmlContent: '' }));
      return;
    }

    try {
      const convertedHtml = TextToHtmlService.convertToHtml(plainTextContent, conversionOptions);
      setPreviewHtml(convertedHtml);
      setFormData(prev => ({ ...prev, htmlContent: convertedHtml }));
      
      toast.success('Text converted to HTML successfully!', { 
        duration: 2000,
        icon: '✨'
      });
    } catch (error) {
      console.error('Error converting text to HTML:', error);
      toast.error('Failed to convert text to HTML');
    }
  }, [plainTextContent, conversionOptions]);

  // Auto-convert on text change (debounced)
  useEffect(() => {
    if (inputMode === 'text' && plainTextContent.trim()) {
      const timer = setTimeout(() => {
        handleTextToHtml();
      }, 500); // Debounce for 500ms

      return () => clearTimeout(timer);
    }
  }, [plainTextContent, conversionOptions, inputMode, handleTextToHtml]);

  const validateForm = () => {
    const errors = {};

    if (!formData.title.trim()) {
      errors.title = 'Template title is required';
    } else if (formData.title.trim().length < 3) {
      errors.title = 'Template title must be at least 3 characters';
    }

    if (!formData.category) {
      errors.category = 'Category is required';
    }

    if (!formData.htmlContent.trim()) {
      errors.htmlContent = 'Template content is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ✅ ENHANCED: Submit template with conversion
  const handleSubmitTemplate = async (e) => {
    e.preventDefault();
    
    // ✅ Ensure HTML content is ready
    if (inputMode === 'text' && plainTextContent.trim() && !formData.htmlContent.trim()) {
      handleTextToHtml();
      // Wait a moment for conversion
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!validateForm()) {
      return;
    }

    try {
      const isEdit = showEditModal && selectedTemplate;
      const endpoint = isEdit 
        ? `/html-templates/${selectedTemplate._id}` 
        : '/html-templates';
      
      const method = isEdit ? 'put' : 'post';
      
      // ✅ Include conversion metadata
      const submissionData = {
        ...formData,
        templateMetadata: {
          description: formData.description,
          tags: formData.tags,
          isDefault: formData.isDefault,
          conversionOptions: inputMode === 'text' ? conversionOptions : null,
          originalInputMode: inputMode
        }
      };
      
      const response = await api[method](endpoint, submissionData);
      
      if (response.data.success) {
        toast.success(`Template ${isEdit ? 'updated' : 'created'} successfully`, {
          icon: '✅'
        });
        setShowCreateModal(false);
        setShowEditModal(false);
        fetchTemplates();
        fetchCategories();
      }
    } catch (error) {
      console.error(`Error ${showEditModal ? 'updating' : 'creating'} template:`, error);
      toast.error(error.response?.data?.message || `Failed to ${showEditModal ? 'update' : 'create'} template`);
    }
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleTagsChange = (value) => {
    const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
    handleFormChange('tags', tags);
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <Navbar
        title="Template Management"
        subtitle={`${currentOrganizationContext || 'Organization View'} • Report Templates`}
        showOrganizationSelector={false}
        onRefresh={fetchTemplates}
        additionalActions={[
          {
            label: 'Create Template',
            icon: Plus,
            onClick: handleCreateTemplate,
            variant: 'primary',
            tooltip: 'Create new template with text-to-HTML conversion'
          }
        ]}
        notifications={0}
      />

      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto">
          
          {/* Header Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              
              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-4 flex-1">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search templates..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="all">All Categories</option>
                  {categoryOptions.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => handleViewModeChange('all')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    viewMode === 'all'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Globe size={16} />
                  All Templates
                </button>
                <button
                  onClick={() => handleViewModeChange('my-templates')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    viewMode === 'my-templates'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <User size={16} />
                  My Templates
                </button>
              </div>
            </div>

            {/* Categories Overview */}
            {categories.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Template Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat.category}
                      onClick={() => handleCategoryChange(cat.category)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        selectedCategory === cat.category
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span>{cat.category}</span>
                      <span className="bg-white px-1.5 py-0.5 rounded-full text-xs">
                        {cat.totalCount}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Templates Grid */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {viewMode === 'my-templates' ? 'My Templates' : 'All Templates'}
                </h2>
                <span className="text-sm text-gray-500">
                  {templates.length} template{templates.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-500">Loading templates...</div>
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
                <p className="text-gray-500 text-center max-w-md">
                  {viewMode === 'my-templates' 
                    ? "You haven't created any templates yet. Create your first template to get started."
                    : "No templates match your current filters. Try adjusting your search or category filter."
                  }
                </p>
                {viewMode === 'my-templates' && (
                  <button
                    onClick={handleCreateTemplate}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Create Template
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                  {templates.map(template => (
                    <div key={template._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 mb-1 line-clamp-2">
                            {template.title}
                          </h3>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {template.category}
                            </span>
                            {template.templateScope === 'global' ? (
                              <Globe size={14} className="text-gray-400" title="Global Template" />
                            ) : (
                              <User size={14} className="text-gray-400" title="Personal Template" />
                            )}
                          </div>
                        </div>
                      </div>

                      {template.templateMetadata?.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {template.templateMetadata.description}
                        </p>
                      )}

                      {template.templateMetadata?.tags && template.templateMetadata.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {template.templateMetadata.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                              <Tag size={10} className="mr-1" />
                              {tag}
                            </span>
                          ))}
                          {template.templateMetadata.tags.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{template.templateMetadata.tags.length - 3} more
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                        <span>
                          Used {template.templateMetadata?.usageCount || 0} times
                        </span>
                        <span>
                          v{template.version}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewTemplate(template)}
                          className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors flex items-center justify-center gap-1"
                        >
                          <Eye size={12} />
                          View
                        </button>
                        
                        {template.templateScope === 'doctor_specific' && 
                         template.assignedDoctor?._id === currentUser._id && (
                          <>
                            <button
                              onClick={() => handleEditTemplate(template)}
                              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteTemplate(template._id)}
                              className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 p-6 border-t border-gray-200">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Template Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {showEditModal ? 'Edit Template' : 'Create New Template'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Paste your text and it will be automatically converted to HTML
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitTemplate} className="overflow-y-auto max-h-[calc(95vh-200px)]">
              <div className="flex">
                
                {/* ✅ LEFT PANEL: Form Fields */}
                <div className="w-1/3 p-6 border-r border-gray-200 space-y-4">
                  
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Template Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => handleFormChange('title', e.target.value)}
                      placeholder="Enter template title"
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                        formErrors.title ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.title && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>
                    )}
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => handleFormChange('category', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white ${
                        formErrors.category ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                    >
                      {categoryOptions.map(category => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleFormChange('description', e.target.value)}
                      placeholder="Brief description"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={formData.tags.join(', ')}
                      onChange={(e) => handleTagsChange(e.target.value)}
                      placeholder="chest, xray, normal"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  {/* ✅ Conversion Options (only in text mode) */}
                  {inputMode === 'text' && (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <h4 className="text-sm font-medium text-green-800 mb-3">Conversion Options</h4>
                      <div className="space-y-2">
                        {Object.entries({
                          formatHeaders: 'Format Headers',
                          formatLists: 'Format Lists',
                          formatMedicalTerms: 'Highlight Medical Terms',
                          createParagraphs: 'Create Paragraphs',
                          addPageBreaks: 'Add Page Breaks'
                        }).map(([key, label]) => (
                          <label key={key} className="flex items-center text-sm">
                            <input
                              type="checkbox"
                              checked={conversionOptions[key]}
                              onChange={(e) => setConversionOptions(prev => ({
                                ...prev,
                                [key]: e.target.checked
                              }))}
                              className="mr-2 text-green-600 focus:ring-green-500"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Default Template Checkbox */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isDefault"
                      checked={formData.isDefault}
                      onChange={(e) => handleFormChange('isDefault', e.target.checked)}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isDefault" className="ml-2 block text-sm text-gray-700">
                      Set as default template
                    </label>
                  </div>
                </div>

                {/* ✅ RIGHT PANEL: Content Input & Preview */}
                <div className="w-2/3 flex flex-col">
                  
                  {/* Input Mode Toggle */}
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex bg-white rounded-lg p-1 border border-gray-200">
                        <button
                          type="button"
                          onClick={() => handleInputModeChange('text')}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                            inputMode === 'text'
                              ? 'bg-green-600 text-white shadow-sm'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          <Type size={16} />
                          Plain Text
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInputModeChange('html')}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                            inputMode === 'html'
                              ? 'bg-green-600 text-white shadow-sm'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          <Code size={16} />
                          HTML Code
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {inputMode === 'text' && (
                          <button
                            type="button"
                            onClick={handleTextToHtml}
                            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
                          >
                            <Zap size={14} />
                            Convert Now
                          </button>
                        )}
                        
                        <button
                          type="button"
                          onClick={() => setShowPreview(!showPreview)}
                          className={`px-3 py-2 rounded-lg transition-colors text-sm flex items-center gap-2 ${
                            showPreview 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          <Eye size={14} />
                          {showPreview ? 'Hide Preview' : 'Show Preview'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Content Input Area */}
                  <div className="flex-1 flex">
                    
                    {/* Input Panel */}
                    <div className="w-full p-4">
                      {inputMode === 'text' ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Paste Your Text Here *
                          </label>
                          <textarea
                            value={plainTextContent}
                            onChange={(e) => setPlainTextContent(e.target.value)}
                            placeholder={`Paste your medical report text here...

Example:
CLINICAL HISTORY:
Patient presents with chest pain.

FINDINGS:
1. Chest X-ray shows normal lung fields
2. No acute cardiopulmonary abnormalities
3. Heart size within normal limits

IMPRESSION:
Normal chest radiograph.

RECOMMENDATIONS:
Clinical correlation recommended.`}
                            rows={20}
                            className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm resize-none ${
                              formErrors.htmlContent ? 'border-red-300 bg-red-50' : 'border-gray-300'
                            }`}
                            style={{ minHeight: '400px' }}
                          />
                          {plainTextContent.trim() && (
                            <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                              <Zap size={12} />
                              Auto-converting to HTML...
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            HTML Content *
                          </label>
                          <textarea
                            value={formData.htmlContent}
                            onChange={(e) => handleFormChange('htmlContent', e.target.value)}
                            placeholder="Enter your HTML template content here..."
                            rows={20}
                            className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm resize-none ${
                              formErrors.htmlContent ? 'border-red-300 bg-red-50' : 'border-gray-300'
                            }`}
                            style={{ minHeight: '400px' }}
                          />
                        </div>
                      )}
                      {formErrors.htmlContent && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.htmlContent}</p>
                      )}
                    </div>

                    {/* Preview Panel */}
                    {showPreview && (
                      <div className="w-full border-l border-gray-200 p-4 bg-gray-50">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          HTML Preview
                        </label>
                        <div 
                          className="border border-gray-200 rounded-lg bg-white p-4 prose max-w-none"
                          style={{ 
                            minHeight: '400px',
                            fontSize: '11pt',
                            fontFamily: 'Arial, sans-serif',
                            lineHeight: '1.5'
                          }}
                          dangerouslySetInnerHTML={{ 
                            __html: previewHtml || formData.htmlContent || '<p class="text-gray-400">No content to preview</p>' 
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                  }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inputMode === 'text' && !plainTextContent.trim()}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={16} />
                  {showEditModal ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Template Modal */}
      {showViewModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedTemplate.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {selectedTemplate.category}
                  </span>
                  <span className="text-xs text-gray-500">
                    {selectedTemplate.templateScope === 'global' ? 'Global Template' : 'Personal Template'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
              {selectedTemplate.templateMetadata?.description && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                  <p className="text-gray-600">{selectedTemplate.templateMetadata.description}</p>
                </div>
              )}

              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Template Content</h4>
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div 
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedTemplate.htmlContent }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Template Info</h4>
                  <div className="space-y-1 text-gray-600">
                    <p>Version: {selectedTemplate.version}</p>
                    <p>Usage Count: {selectedTemplate.templateMetadata?.usageCount || 0}</p>
                    <p>Created: {new Date(selectedTemplate.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                
                {selectedTemplate.templateMetadata?.tags && selectedTemplate.templateMetadata.tags.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedTemplate.templateMetadata.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorTemplates;
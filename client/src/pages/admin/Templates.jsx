// client/src/pages/admin/Templates.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Navbar from '../../components/common/Navbar';
import TextToHtmlService from '../../services/textToHtml';
import ReportEditor, { preprocessContent } from '../../components/OnlineReportingSystem/ReportEditorWithOhif';
import {
  Plus,
  Search,
  Filter,
  Edit3,
  Trash2,
  Eye,
  Globe,
  FileText,
  Tag,
  Calendar,
  BarChart3,
  X,
  Save,
  ChevronDown,
  Code,
  Type,
  Zap,
  Building2,
  ArrowLeft
} from 'lucide-react';

const AdminTemplates = () => {
  const { currentUser, currentOrganizationContext } = useAuth();
  const navigate = useNavigate();
  
  // State management
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
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

  // Text conversion state
  const [inputMode, setInputMode] = useState('text');
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
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(3);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        search: searchTerm || undefined,
        page: currentPage,
        limit: 20
      };

      const response = await api.get('/html-templates', { params });
      
      if (response.data.success) {
        setTemplates(response.data.data.templates);
        setTotalPages(response.data.data.pagination.pages);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchTerm, currentPage]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get('/html-templates/categories');
      if (response.data.success) {
        setCategories(response.data.data.categories);
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
  }, [selectedCategory, searchTerm]);

  // Handlers
  const handleSearch = useCallback((value) => {
    setSearchTerm(value);
  }, []);

  const handleCategoryChange = useCallback((category) => {
    setSelectedCategory(category);
  }, []);

  const handleCreateTemplate = useCallback(() => {
    setFormData({
      title: '',
      category: 'General',
      htmlContent: '',
      description: '',
      tags: [],
      isDefault: false
    });
    setPlainTextContent('');
    setPreviewHtml('');
    setInputMode('text');
    setShowPreview(false);
    setFormErrors({});
    setShowCreateModal(true);
  }, []);

  const handleEditTemplate = useCallback((template) => {
    // ✅ Pre-process the template HTML so Word-style bullets (·, •, ▪ …)
    // get converted to real <ul><li> before the editor ever mounts.
    const processedHtml = preprocessContent(template.htmlContent || '');

    setSelectedTemplate(template);
    setFormData({
      title: template.title,
      category: template.category,
      htmlContent: processedHtml,
      description: template.templateMetadata?.description || '',
      tags: template.templateMetadata?.tags || [],
      isDefault: template.templateMetadata?.isDefault || false
    });

    // Try to convert HTML back to plain text for editing
    try {
      const plainText = TextToHtmlService.htmlToText(processedHtml);
      setPlainTextContent(plainText);
      setInputMode('text');
    } catch (error) {
      console.error('Error converting HTML to text:', error);
      setInputMode('html');
    }

    setPreviewHtml(processedHtml);
    setShowPreview(false);
    setFormErrors({});
    setShowEditModal(true);
  }, []);

  const handleInputModeChange = (mode) => {
    setInputMode(mode);
    
    if (mode === 'text' && formData.htmlContent) {
      try {
        const plainText = TextToHtmlService.htmlToText(formData.htmlContent);
        setPlainTextContent(plainText);
      } catch (error) {
        console.error('Error converting HTML to text:', error);
        toast.error('Failed to convert HTML to text');
      }
    } else if (mode === 'html' && plainTextContent) {
      const html = TextToHtmlService.convertToHtml(plainTextContent, conversionOptions);
      setFormData(prev => ({ ...prev, htmlContent: html }));
    }
  };

  // ✅ Auto text-to-HTML conversion (debounced, loop-safe)
  //
  // Tracks the last HTML we produced so we don't re-convert our own output.
  // Only runs when:
  //   - In text mode
  //   - Content exists
  //   - Content does NOT already have rich formatting (headers/lists/bold etc.)
  //     — so we don't clobber a user's manual edits
  //   - Content differs from what we last converted (prevents loop)
  const lastConvertedHtmlRef = useRef(null);

  const hasRichFormatting = (html) => {
    if (!html) return false;
    return /<\s*(h[1-6]|ul|ol|strong|b|em|i|u|table|blockquote)\b/i.test(html);
  };

  const getPlainText = useCallback((html) => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').trim();
  }, []);

  useEffect(() => {
    if (inputMode !== 'text') return;
    const currentHtml = formData.htmlContent || '';
    if (!currentHtml.trim()) return;

    // Already in the "converted" state — don't re-run
    if (currentHtml === lastConvertedHtmlRef.current) return;

    // User already added rich formatting — don't overwrite their work
    if (hasRichFormatting(currentHtml)) {
      lastConvertedHtmlRef.current = currentHtml;
      return;
    }

    const plain = getPlainText(currentHtml);
    if (!plain) return;

    const timeoutId = setTimeout(() => {
      try {
        const converted = TextToHtmlService.convertToHtml(plain, conversionOptions);
        if (converted && converted !== currentHtml) {
          lastConvertedHtmlRef.current = converted;
          setFormData(prev => ({ ...prev, htmlContent: converted }));
          setPreviewHtml(converted);
        }
      } catch (error) {
        console.error('Auto text-to-HTML conversion failed:', error);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [formData.htmlContent, conversionOptions, inputMode, getPlainText]);

  // ✅ Strip HTML tags to get plain text for validation
  // (so a template with just "<p></p>" or "<div><br></div>" is treated as empty)
  const getPlainTextFromHtml = (html) => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').trim();
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.title.trim()) {
      errors.title = 'Template title is required';
    }

    if (!formData.category) {
      errors.category = 'Category is required';
    }

    // ✅ FIX: Always validate against formData.htmlContent (which is what
    // ReportEditor and HTML textarea both write to). Ignore plainTextContent —
    // it's a dead legacy state that's never updated when typing in ReportEditor.
    const plainText = getPlainTextFromHtml(formData.htmlContent);
    if (!plainText) {
      errors.content = 'Template content is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitTemplate = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fill in all required fields');
      return;
    }

    // ✅ FIX: Use formData.htmlContent directly. In text mode ReportEditor
    // already produces clean HTML; in HTML mode the textarea writes HTML
    // directly. The old code re-converted from plainTextContent which was
    // always empty → blank templates on submit.
    // Text-to-HTML conversion is still available via handleInputModeChange
    // when the user toggles between modes with legacy plain-text content.
    const finalHtmlContent = formData.htmlContent;

    const templateData = {
      title: formData.title.trim(),
      category: formData.category,
      htmlContent: finalHtmlContent,
      templateMetadata: {
        description: formData.description.trim(),
        tags: formData.tags,
        isDefault: formData.isDefault
      }
    };

    try {
      if (showEditModal && selectedTemplate) {
        const response = await api.put(`/html-templates/${selectedTemplate._id}`, templateData);
        if (response.data.success) {
          toast.success('Template updated successfully!');
          setShowEditModal(false);
          fetchTemplates();
        }
      } else {
        const response = await api.post('/html-templates', templateData);
        if (response.data.success) {
          toast.success('Template created successfully!');
          setShowCreateModal(false);
          fetchTemplates();
        }
      }
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(error.response?.data?.message || 'Failed to save template');
    }
  };

  const handleDeleteTemplate = async (template) => {
    if (!window.confirm(`Are you sure you want to delete "${template.title}"?`)) {
      return;
    }

    try {
      const response = await api.delete(`/html-templates/${template._id}`);
      if (response.data.success) {
        toast.success('Template deleted successfully!');
        fetchTemplates();
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const handleViewTemplate = (template) => {
    setSelectedTemplate(template);
    setShowViewModal(true);
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleTagsChange = (value) => {
    const tags = value.split(',').map(tag => tag.trim()).filter(Boolean);
    handleFormChange('tags', tags);
  };

  const insertTableToContent = () => {
    const rows = Math.max(1, parseInt(tableRows) || 2);
    const cols = Math.max(1, parseInt(tableCols) || 3);
    let html = '<table border="1" style="border-collapse:collapse;width:100%;margin:10px 0;">\n  <tr>\n';
    for (let c = 0; c < cols; c++) {
      html += `    <th style="border:1px solid #ddd;padding:8px;background:#f5f5f5;font-weight:bold;">Header ${c + 1}</th>\n`;
    }
    html += '  </tr>\n';
    for (let r = 0; r < rows - 1; r++) {
      html += '  <tr>\n';
      for (let c = 0; c < cols; c++) {
        html += '    <td style="border:1px solid #ddd;padding:8px;"> </td>\n';
      }
      html += '  </tr>\n';
    }
    html += '</table>\n';
    handleFormChange('htmlContent', formData.htmlContent + '\n' + html);
    setShowTableDialog(false);
  };

  const additionalActions = [
    {
      label: 'Back',
      icon: ArrowLeft,
      onClick: () => navigate(-1),
      variant: 'secondary',
      tooltip: 'Back to dashboard'
    },
    {
      label: 'Create Template',
      icon: Plus,
      onClick: handleCreateTemplate,
      variant: 'success',
      tooltip: 'Create new global template'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        title="Organization Templates"
        subtitle={`${currentOrganizationContext || 'Organization'} • Global Template Management`}
        onRefresh={fetchTemplates}
        additionalActions={additionalActions}
        theme="admin"
      />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header with Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Global Templates</h2>
              <p className="text-sm text-gray-600 mt-1">
                Create and manage HTML templates for your organization
              </p>
            </div>
            <button
              onClick={handleCreateTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Template
            </button>
          </div>

          <div className="flex gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="all">All Categories</option>
              {categoryOptions.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Templates Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No templates found</h3>
            <p className="text-gray-600 mb-4">Create your first global template to get started</p>
            <button
              onClick={handleCreateTemplate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <Plus className="w-5 h-5" />
              Create Template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template._id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{template.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Globe className="w-4 h-4" />
                      <span>{template.category}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewTemplate(template)}
                      className="p-2 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEditTemplate(template)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-sm text-gray-600 mb-4">
                  <p className="line-clamp-3">{template.templateMetadata?.description || 'No description'}</p>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(template.updatedAt).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />
                    {template.templateMetadata?.usageCount || 0} uses
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-[97vw] h-[96vh] max-w-none overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-teal-600 to-teal-700">
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">
                  {showEditModal ? 'Edit Global Template' : 'Create Global Template'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                }}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body — Two-column: form (left) + editor (right) */}
            <form onSubmit={handleSubmitTemplate} className="flex-1 flex min-h-0 overflow-hidden">

              {/* LEFT: Form fields */}
              <div className="w-[340px] shrink-0 border-r border-gray-200 bg-gray-50/50 overflow-y-auto p-4 space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleFormChange('title', e.target.value)}
                    className={`w-full h-8 px-2.5 text-[12px] border rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 outline-none ${
                      formErrors.title ? 'border-red-400' : 'border-gray-200'
                    }`}
                    placeholder="e.g., CT Head Standard Report"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleFormChange('category', e.target.value)}
                    className={`w-full h-8 px-2 text-[12px] border rounded-lg focus:ring-2 focus:ring-teal-500/20 outline-none ${
                      formErrors.category ? 'border-red-400' : 'border-gray-200'
                    }`}
                  >
                    {categoryOptions.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    rows={3}
                    className="w-full px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 outline-none resize-none"
                    placeholder="Brief description"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Tags</label>
                  <input
                    type="text"
                    value={formData.tags.join(', ')}
                    onChange={(e) => handleTagsChange(e.target.value)}
                    className="w-full h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 outline-none"
                    placeholder="head, CT, routine"
                  />
                  <p className="text-[9px] text-gray-400 mt-0.5">Comma-separated</p>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Input Mode</label>
                  <div className="flex bg-gray-100 rounded-lg p-0.5">
                    <button type="button" onClick={() => handleInputModeChange('text')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                        inputMode === 'text' ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}>
                      <Type className="w-3.5 h-3.5" /> Text
                    </button>
                    <button type="button" onClick={() => handleInputModeChange('html')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                        inputMode === 'html' ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}>
                      <Code className="w-3.5 h-3.5" /> HTML
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-400 mt-0.5 italic">
                    {inputMode === 'text' ? 'WYSIWYG editor' : 'Raw HTML textarea'}
                  </p>
                </div>

                {formErrors.content && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                    <p className="text-[10px] text-red-600 font-semibold">{formErrors.content}</p>
                  </div>
                )}

                {/* Form Actions */}
                <div className="pt-3 border-t border-gray-200 flex flex-col gap-2">
                  <button type="submit"
                    className="w-full flex items-center justify-center gap-1.5 px-4 h-9 text-[12px] font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-all">
                    <Save className="w-3.5 h-3.5" />
                    {showEditModal ? 'Update Template' : 'Create Template'}
                  </button>
                  <button type="button"
                    onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}
                    className="w-full px-3 h-9 text-[12px] font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all">
                    Cancel
                  </button>
                </div>
              </div>

              {/* RIGHT: Editor fills remaining space */}
              <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-white">
                <div className="px-4 py-2 border-b border-gray-200 bg-gray-50/50 shrink-0">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Content *</label>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  {inputMode === 'text' ? (
                    <ReportEditor
                      content={formData.htmlContent}
                      onChange={(html) => handleFormChange('htmlContent', html)}
                    />
                  ) : (
                    <textarea
                      value={formData.htmlContent}
                      onChange={(e) => handleFormChange('htmlContent', e.target.value)}
                      className={`w-full h-full px-4 py-3 text-[12px] border-0 font-mono resize-none focus:outline-none ${
                        formErrors.content ? 'bg-red-50' : ''
                      }`}
                      placeholder="Enter HTML content..."
                    />
                  )}
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-teal-600 to-teal-700">
              <div className="flex items-center gap-3">
                <Eye className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">{selectedTemplate.title}</h2>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4 flex gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Tag className="w-4 h-4" />
                  {selectedTemplate.category}
                </span>
                <span className="flex items-center gap-1">
                  <Globe className="w-4 h-4" />
                  Global Template
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(selectedTemplate.updatedAt).toLocaleDateString()}
                </span>
              </div>

              {selectedTemplate.templateMetadata?.description && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">{selectedTemplate.templateMetadata.description}</p>
                </div>
              )}

              <div className="border border-gray-300 rounded-lg p-6 bg-white">
                <div dangerouslySetInnerHTML={{ __html: selectedTemplate.htmlContent }} />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  handleEditTemplate(selectedTemplate);
                }}
                className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                <Edit3 className="w-5 h-5" />
                Edit Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTemplates;
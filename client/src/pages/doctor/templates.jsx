import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Navbar from '../../components/common/Navbar';
import api from '../../services/api';
import TextToHtmlService from '../../services/textToHtml.js';
import {
  Plus, Search, Trash2, Eye, Globe, User, FileText,
  Tag, X, Save, Code, Type, Zap, Loader2, ChevronLeft, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const DoctorTemplates = () => {
  const { currentUser, currentOrganizationContext } = useAuth();

  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [formData, setFormData] = useState({
    title: '', category: 'General', htmlContent: '',
    description: '', tags: [], isDefault: false
  });
  const [formErrors, setFormErrors] = useState({});

  const categoryOptions = [
    'General', 'CT', 'CR', 'CT SCREENING FORMAT', 'ECHO',
    'EEG-TMT-NCS', 'MR', 'MRI SCREENING FORMAT', 'PT', 'US', 'Other'
  ];

  const [inputMode, setInputMode] = useState('text');
  const [plainTextContent, setPlainTextContent] = useState('');
  const [conversionOptions, setConversionOptions] = useState({
    formatHeaders: true, formatLists: true, formatMedicalTerms: true,
    createParagraphs: true, addPageBreaks: false
  });
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(3);

  // ── Data fetching ──

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = viewMode === 'my-templates' ? '/doctor/templates/my-templates' : '/doctor/templates/all';
      const params = {
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        search: searchTerm || undefined,
        page: currentPage, limit: 12
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

  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get('/doctor/templates/categories');
      if (response.data.success) setCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  useEffect(() => { fetchTemplates(); fetchCategories(); }, [fetchTemplates, fetchCategories]);
  useEffect(() => { setCurrentPage(1); }, [viewMode, selectedCategory, searchTerm]);

  // ── Handlers ──

  const handleSearch = useCallback((value) => setSearchTerm(value), []);
  const handleCategoryChange = useCallback((cat) => setSelectedCategory(cat), []);
  const handleViewModeChange = useCallback((mode) => setViewMode(mode), []);

  const handleCreateTemplate = useCallback(() => {
    setFormData({ title: '', category: 'General', htmlContent: '', description: '', tags: [], isDefault: false });
    setPlainTextContent(''); setPreviewHtml(''); setInputMode('text');
    setShowPreview(false); setFormErrors({}); setShowCreateModal(true);
  }, []);

  const handleEditTemplate = useCallback((template) => {
    setSelectedTemplate(template);
    setFormData({
      title: template.title, category: template.category, htmlContent: template.htmlContent,
      description: template.templateMetadata?.description || '',
      tags: template.templateMetadata?.tags || [],
      isDefault: template.templateMetadata?.isDefault || false
    });
    try {
      setPlainTextContent(TextToHtmlService.htmlToText(template.htmlContent));
      setInputMode('text');
    } catch {
      setPlainTextContent(''); setInputMode('html');
    }
    setPreviewHtml(template.htmlContent); setShowPreview(false);
    setFormErrors({}); setShowEditModal(true);
  }, []);

  const handleViewTemplate = useCallback((template) => {
    setSelectedTemplate(template);
    setShowViewModal(true);
  }, []);

  const handleDeleteTemplate = useCallback(async (templateId) => {
    if (!window.confirm('Delete this template permanently?')) return;
    try {
      const response = await api.delete(`/html-templates/${templateId}`);
      if (response.data.success) {
        toast.success('Template deleted');
        fetchTemplates();
        fetchCategories();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete template');
    }
  }, [fetchTemplates, fetchCategories]);

  const handleInputModeChange = (mode) => {
    setInputMode(mode);
    if (mode === 'text' && formData.htmlContent) {
      try { setPlainTextContent(TextToHtmlService.htmlToText(formData.htmlContent)); }
      catch { setPlainTextContent(''); }
    } else if (mode === 'html' && plainTextContent) {
      handleTextToHtml();
    }
  };

  const handleTextToHtml = useCallback(() => {
    if (!plainTextContent.trim()) {
      setPreviewHtml(''); setFormData(prev => ({ ...prev, htmlContent: '' })); return;
    }
    try {
      const html = TextToHtmlService.convertToHtml(plainTextContent, conversionOptions);
      setPreviewHtml(html); setFormData(prev => ({ ...prev, htmlContent: html }));
      toast.success('Converted!', { duration: 1500, icon: '✨' });
    } catch (error) {
      toast.error('Conversion failed');
    }
  }, [plainTextContent, conversionOptions]);

  useEffect(() => {
    if (inputMode === 'text' && plainTextContent.trim()) {
      const timer = setTimeout(handleTextToHtml, 500);
      return () => clearTimeout(timer);
    }
  }, [plainTextContent, conversionOptions, inputMode, handleTextToHtml]);

  const validateForm = () => {
    const errors = {};
    if (!formData.title.trim()) errors.title = 'Title is required';
    else if (formData.title.trim().length < 3) errors.title = 'Min 3 characters';
    if (!formData.category) errors.category = 'Category is required';
    if (!formData.htmlContent.trim()) errors.htmlContent = 'Content is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitTemplate = async (e) => {
    e.preventDefault();
    if (inputMode === 'text' && plainTextContent.trim() && !formData.htmlContent.trim()) {
      handleTextToHtml();
      await new Promise(r => setTimeout(r, 100));
    }
    if (!validateForm()) return;

    try {
      const isEdit = showEditModal && selectedTemplate;
      const endpoint = isEdit ? `/html-templates/${selectedTemplate._id}` : '/html-templates';
      const method = isEdit ? 'put' : 'post';
      const submissionData = {
        ...formData,
        templateMetadata: {
          description: formData.description, tags: formData.tags,
          isDefault: formData.isDefault,
          conversionOptions: inputMode === 'text' ? conversionOptions : null,
          originalInputMode: inputMode
        }
      };
      const response = await api[method](endpoint, submissionData);
      if (response.data.success) {
        toast.success(`Template ${isEdit ? 'updated' : 'created'}!`, { icon: '✅' });
        setShowCreateModal(false); setShowEditModal(false);
        fetchTemplates(); fetchCategories();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to ${showEditModal ? 'update' : 'create'} template`);
    }
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors(prev => ({ ...prev, [field]: '' }));
  };
  const handleTagsChange = (value) => handleFormChange('tags', value.split(',').map(t => t.trim()).filter(Boolean));

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

  // ── Render ──

  return (
    <div className="h-screen bg-[#f5f6f8] flex flex-col">
      <Navbar
        title="Template Management"
        subtitle={`${currentOrganizationContext || 'Organization'} • Report Templates`}
        showOrganizationSelector={false}
        onRefresh={fetchTemplates}
        additionalActions={[{
          label: 'Create Template', icon: Plus, onClick: handleCreateTemplate,
          variant: 'primary', tooltip: 'Create new template'
        }]}
        notifications={0}
      />

      <div className="flex-1 overflow-auto px-4 py-4 lg:px-6">
        <div className="max-w-7xl mx-auto space-y-4">

          {/* ── Toolbar ── */}
          <div className="bg-white rounded-xl border border-gray-200/60 shadow-sm px-4 py-3">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              {/* Search + Category */}
              <div className="flex flex-1 gap-2">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search templates…"
                    className="w-full pl-9 pr-3 h-8 text-[13px] border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-gray-50/50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                >
                  <option value="all">All Categories</option>
                  {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* View toggle */}
              <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
                {[
                  { key: 'all', icon: Globe, label: 'All' },
                  { key: 'my-templates', icon: User, label: 'Mine' }
                ].map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => handleViewModeChange(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all
                      ${viewMode === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category pills */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
                {categories.map(cat => (
                  <button
                    key={cat.category}
                    onClick={() => handleCategoryChange(cat.category)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all
                      ${selectedCategory === cat.category
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {cat.category}
                    <span className={`px-1.5 py-0 rounded-full text-[9px] ${selectedCategory === cat.category ? 'bg-white/20' : 'bg-white'}`}>
                      {cat.totalCount}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Templates Grid ── */}
          <div className="bg-white rounded-xl border border-gray-200/60 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-[13px] font-bold text-gray-800">
                {viewMode === 'my-templates' ? 'My Templates' : 'All Templates'}
              </h2>
              <span className="text-[11px] text-gray-400 font-medium">
                {templates.length} result{templates.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <FileText className="w-10 h-10 text-gray-300 mb-3" />
                <h3 className="text-[14px] font-semibold text-gray-800 mb-1">No templates found</h3>
                <p className="text-[12px] text-gray-400 text-center max-w-sm">
                  {viewMode === 'my-templates'
                    ? "You haven't created any templates yet."
                    : "No templates match your filters."
                  }
                </p>
                {viewMode === 'my-templates' && (
                  <button onClick={handleCreateTemplate}
                    className="mt-4 flex items-center gap-1.5 px-3 h-8 bg-blue-600 text-white text-[12px] font-semibold rounded-lg hover:bg-blue-700 transition-all">
                    <Plus className="w-3.5 h-3.5" /> Create Template
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-3">
                  {templates.map(template => (
                    <div key={template._id}
                      className="group border border-gray-200/80 rounded-xl p-3.5 hover:shadow-md hover:border-gray-300 transition-all bg-white">
                      {/* Title + scope */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-[13px] font-semibold text-gray-900 line-clamp-1 flex-1">{template.title}</h3>
                        {template.templateScope === 'global'
                          ? <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                          : <User className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                        }
                      </div>

                      {/* Category badge */}
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">
                          {template.category}
                        </span>
                        {template.templateMetadata?.isDefault && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-600">DEFAULT</span>
                        )}
                      </div>

                      {/* Description */}
                      {template.templateMetadata?.description && (
                        <p className="text-[11px] text-gray-500 mb-2 line-clamp-2 leading-relaxed">
                          {template.templateMetadata.description}
                        </p>
                      )}

                      {/* Tags */}
                      {template.templateMetadata?.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {template.templateMetadata.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-gray-100 text-gray-500 font-medium">
                              <Tag className="w-2.5 h-2.5" /> {tag}
                            </span>
                          ))}
                          {template.templateMetadata.tags.length > 3 && (
                            <span className="text-[9px] text-gray-400">+{template.templateMetadata.tags.length - 3}</span>
                          )}
                        </div>
                      )}

                      {/* Meta row */}
                      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-3 pt-2 border-t border-gray-100">
                        <span>Used {template.templateMetadata?.usageCount || 0}×</span>
                        <span>v{template.version}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleViewTemplate(template)}
                          className="flex-1 flex items-center justify-center gap-1 h-7 text-[11px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                          <Eye className="w-3 h-3" /> View
                        </button>
                        {template.templateScope === 'doctor_specific' && template.assignedDoctor?._id === currentUser._id && (
                          <button onClick={() => handleDeleteTemplate(template._id)}
                            className="h-7 w-7 flex items-center justify-center text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-gray-100">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1 px-2.5 h-7 text-[11px] font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all"
                    >
                      <ChevronLeft className="w-3 h-3" /> Prev
                    </button>
                    <span className="text-[11px] text-gray-500 font-medium">{currentPage} / {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1 px-2.5 h-7 text-[11px] font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all"
                    >
                      Next <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Create/Edit Modal ── */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl border border-gray-200/60 flex flex-col" style={{ maxHeight: 'min(92vh, 780px)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-gray-900">{showEditModal ? 'Edit Template' : 'Create Template'}</h3>
                  <p className="text-[10px] text-gray-400">Paste text — auto-converts to HTML</p>
                </div>
              </div>
              <button onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitTemplate} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 flex overflow-hidden">

                {/* Left — Fields */}
                <div className="w-[280px] shrink-0 border-r border-gray-100 overflow-y-auto p-4 space-y-3">
                  {/* Title */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Title *</label>
                    <input
                      type="text" value={formData.title}
                      onChange={(e) => handleFormChange('title', e.target.value)}
                      placeholder="Template title"
                      className={`w-full h-8 px-2.5 text-[12px] border rounded-lg bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-green-500/20 focus:border-green-400 outline-none transition-all
                        ${formErrors.title ? 'border-red-300 bg-red-50/50' : 'border-gray-200'}`}
                    />
                    {formErrors.title && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.title}</p>}
                  </div>

                  {/* Category */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Category *</label>
                    <select
                      value={formData.category}
                      onChange={(e) => handleFormChange('category', e.target.value)}
                      className={`w-full h-8 px-2.5 text-[12px] border rounded-lg bg-gray-50/50 focus:ring-2 focus:ring-green-500/20 outline-none
                        ${formErrors.category ? 'border-red-300' : 'border-gray-200'}`}
                    >
                      {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleFormChange('description', e.target.value)}
                      placeholder="Brief description"
                      rows={2}
                      className="w-full px-2.5 py-2 text-[12px] border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-green-500/20 outline-none resize-none"
                    />
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Tags</label>
                    <input
                      type="text" value={formData.tags.join(', ')}
                      onChange={(e) => handleTagsChange(e.target.value)}
                      placeholder="chest, xray, normal"
                      className="w-full h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-green-500/20 outline-none"
                    />
                  </div>

                  {/* Conversion options */}
                  {inputMode === 'text' && (
                    <div className="rounded-lg border border-green-200 bg-green-50/50 p-3">
                      <h4 className="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-2">Conversion</h4>
                      <div className="space-y-1.5">
                        {Object.entries({
                          formatHeaders: 'Headers', formatLists: 'Lists',
                          formatMedicalTerms: 'Medical Terms', createParagraphs: 'Paragraphs',
                          addPageBreaks: 'Page Breaks'
                        }).map(([key, label]) => (
                          <label key={key} className="flex items-center gap-2 text-[11px] text-gray-600 cursor-pointer">
                            <input
                              type="checkbox" checked={conversionOptions[key]}
                              onChange={(e) => setConversionOptions(prev => ({ ...prev, [key]: e.target.checked }))}
                              className="w-3.5 h-3.5 text-green-600 rounded border-gray-300 focus:ring-green-500"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Default checkbox */}
                  <label className="flex items-center gap-2 text-[11px] text-gray-600 cursor-pointer pt-1">
                    <input
                      type="checkbox" checked={formData.isDefault}
                      onChange={(e) => handleFormChange('isDefault', e.target.checked)}
                      className="w-3.5 h-3.5 text-green-600 rounded border-gray-300 focus:ring-green-500"
                    />
                    <span className="font-medium">Set as default</span>
                  </label>
                </div>

                {/* Right — Content + Preview */}
                <div className="flex-1 flex flex-col min-w-0">
                  {/* Mode toggle bar */}
                  <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/30 shrink-0">
                    <div className="flex bg-white rounded-lg p-0.5 border border-gray-200">
                      {[
                        { key: 'text', icon: Type, label: 'Text' },
                        { key: 'html', icon: Code, label: 'HTML' }
                      ].map(({ key, icon: Icon, label }) => (
                        <button key={key} type="button" onClick={() => handleInputModeChange(key)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all
                            ${inputMode === key ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                          <Icon className="w-3.5 h-3.5" /> {label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {inputMode === 'text' && (
                        <button type="button" onClick={handleTextToHtml}
                          className="flex items-center gap-1 px-2.5 h-7 text-[10px] font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-all">
                          <Zap className="w-3 h-3" /> Convert
                        </button>
                      )}
                      <button type="button" onClick={() => setShowPreview(!showPreview)}
                        className={`flex items-center gap-1 px-2.5 h-7 text-[10px] font-bold rounded-lg transition-all
                          ${showPreview ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                        <Eye className="w-3 h-3" /> {showPreview ? 'Hide' : 'Preview'}
                      </button>
                    </div>
                  </div>

                  {/* Textarea + optional preview */}
                  <div className="flex-1 flex overflow-hidden">
                    <div className={`${showPreview ? 'w-1/2' : 'w-full'} p-3 overflow-y-auto`}>
                      {inputMode === 'text' ? (
                        <div className="h-full flex flex-col">
                          <textarea
                            value={plainTextContent}
                            onChange={(e) => setPlainTextContent(e.target.value)}
                            placeholder={`Paste your medical report text here...\n\nExample:\nCLINICAL HISTORY:\nPatient presents with chest pain.\n\nFINDINGS:\n1. Normal lung fields\n2. Heart size normal\n\nIMPRESSION:\nNormal chest radiograph.`}
                            className={`flex-1 w-full px-3 py-2.5 text-[12px] border rounded-lg font-mono resize-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 outline-none
                              ${formErrors.htmlContent ? 'border-red-300 bg-red-50/50' : 'border-gray-200 bg-gray-50/30'}`}
                          />
                          {plainTextContent.trim() && (
                            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-green-600">
                              <Zap className="w-3 h-3" /> Auto-converting…
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col h-full gap-1">
                          {/* Table insert toolbar */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {showTableDialog ? (
                              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                                <span className="text-[10px] text-gray-500 font-medium">Rows:</span>
                                <input type="number" min="1" max="20" value={tableRows}
                                  onChange={e => setTableRows(e.target.value)}
                                  className="w-10 px-1 py-0.5 text-[10px] border border-gray-300 rounded" />
                                <span className="text-[10px] text-gray-500 font-medium">Cols:</span>
                                <input type="number" min="1" max="10" value={tableCols}
                                  onChange={e => setTableCols(e.target.value)}
                                  className="w-10 px-1 py-0.5 text-[10px] border border-gray-300 rounded" />
                                <button type="button" onClick={insertTableToContent}
                                  className="px-2 py-0.5 text-[10px] font-semibold text-white bg-green-600 hover:bg-green-700 rounded">
                                  Insert
                                </button>
                                <button type="button" onClick={() => setShowTableDialog(false)}
                                  className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded">✕</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => setShowTableDialog(true)}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg transition-colors">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z"/>
                                </svg>
                                Insert Table
                              </button>
                            )}
                          </div>
                          <textarea
                            value={formData.htmlContent}
                            onChange={(e) => handleFormChange('htmlContent', e.target.value)}
                            placeholder="Enter HTML content…"
                            className={`flex-1 w-full px-3 py-2.5 text-[12px] border rounded-lg font-mono resize-none focus:ring-2 focus:ring-green-500/20 outline-none
                              ${formErrors.htmlContent ? 'border-red-300 bg-red-50/50' : 'border-gray-200 bg-gray-50/30'}`}
                          />
                        </div>
                      )}
                      {formErrors.htmlContent && <p className="text-[10px] text-red-500 mt-1">{formErrors.htmlContent}</p>}
                    </div>

                    {showPreview && (
                      <div className="w-1/2 border-l border-gray-100 p-3 overflow-y-auto bg-gray-50/30">
                        <div className="border border-gray-200 rounded-lg bg-white p-4 prose max-w-none"
                          style={{ fontSize: '11pt', fontFamily: 'Arial, sans-serif', lineHeight: '1.5', minHeight: '300px' }}
                          dangerouslySetInnerHTML={{ __html: previewHtml || formData.htmlContent || '<p style="color:#aaa">No content to preview</p>' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-gray-100 bg-gray-50/50 shrink-0">
                <button type="button"
                  onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}
                  className="px-3 h-8 text-[12px] font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-all">
                  Cancel
                </button>
                <button type="submit"
                  disabled={inputMode === 'text' && !plainTextContent.trim()}
                  className="flex items-center gap-1.5 px-4 h-8 text-[12px] font-bold text-white bg-gradient-to-r from-green-600 to-emerald-500 rounded-lg hover:from-green-700 hover:to-emerald-600 shadow-sm shadow-green-200 transition-all disabled:opacity-50">
                  <Save className="w-3.5 h-3.5" /> {showEditModal ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── View Template Modal ── */}
      {showViewModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl border border-gray-200/60 flex flex-col" style={{ maxHeight: 'min(88vh, 700px)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="text-[14px] font-bold text-gray-900">{selectedTemplate.title}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">
                    {selectedTemplate.category}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {selectedTemplate.templateScope === 'global' ? 'Global' : 'Personal'}
                  </span>
                </div>
              </div>
              <button onClick={() => setShowViewModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {selectedTemplate.templateMetadata?.description && (
                <div>
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Description</h4>
                  <p className="text-[12px] text-gray-600">{selectedTemplate.templateMetadata.description}</p>
                </div>
              )}

              <div>
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Content</h4>
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                  <div className="prose max-w-none" style={{ fontSize: '11pt', fontFamily: 'Arial, sans-serif', lineHeight: '1.5' }}
                    dangerouslySetInnerHTML={{ __html: selectedTemplate.htmlContent }}
                  />
                </div>
              </div>

              <div className="flex gap-6 pt-2">
                <div>
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Info</h4>
                  <div className="text-[11px] text-gray-500 space-y-0.5">
                    <p>Version: {selectedTemplate.version}</p>
                    <p>Used: {selectedTemplate.templateMetadata?.usageCount || 0}×</p>
                    <p>Created: {new Date(selectedTemplate.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                {selectedTemplate.templateMetadata?.tags?.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tags</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedTemplate.templateMetadata.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600 font-medium">{tag}</span>
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
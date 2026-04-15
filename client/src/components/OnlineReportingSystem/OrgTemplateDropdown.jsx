import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { ChevronDown, Search, Building, FileText, X, Check } from 'lucide-react';

const OrgTemplateDropdown = ({ onTemplateSelect, selectedTemplate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const dropdownRef = useRef(null);

  const categories = ['all','General','CT','CR','CT SCREENING FORMAT','ECHO','EEG-TMT-NCS','MR','MRI SCREENING FORMAT','PT','US','Other'];

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await api.get('/html-templates/doctor/org-templates', { params: { category: selectedCategory, search: searchTerm.trim(), limit: 100 } });
      if (res.data.success) setTemplates(res.data.data.templates);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { if (isOpen) fetchTemplates(); }, [isOpen, selectedCategory]);
  useEffect(() => { const t = setTimeout(() => { if (isOpen) fetchTemplates(); }, 300); return () => clearTimeout(t); }, [searchTerm]);
  useEffect(() => { const h = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);

  const total = Object.values(templates).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
  const isActive = selectedTemplate?.templateScope === 'global';

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 h-6 px-1.5 text-[10px] font-semibold rounded border transition-all
          ${isActive ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
        <Building size={10} />
        <span>Organisation</span>
        {total > 0 && <span className="bg-amber-100 text-amber-700 text-[9px] px-1 rounded-full font-bold">{total}</span>}
        <ChevronDown size={8} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-0.5 w-60 bg-white rounded-md shadow-xl border border-gray-200 z-50">
          <div className="p-1.5 border-b border-gray-100 space-y-1">
            <div className="relative">
              <Search size={9} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search..."
                className="w-full pl-5 pr-5 py-0.5 text-[10px] border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400" />
              {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-1 top-1/2 -translate-y-1/2"><X size={8} className="text-gray-400" /></button>}
            </div>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-[10px] border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-400">
              {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
            </select>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-2 text-center"><div className="animate-spin h-3 w-3 border-2 border-amber-500 border-t-transparent rounded-full mx-auto" /></div>
            ) : total === 0 ? (
              <div className="p-3 text-center"><FileText size={14} className="text-gray-300 mx-auto mb-1" /><p className="text-[10px] text-gray-400">{searchTerm ? 'No results' : 'No org templates'}</p></div>
            ) : (
              Object.entries(templates).map(([cat, list]) => (
                <div key={cat}>
                  <div className="px-2 py-0.5 bg-gray-50 text-[9px] font-bold text-gray-500 uppercase">{cat} ({list.length})</div>
                  {list.map(t => (
                    <button key={t._id} onClick={() => { onTemplateSelect(t); setIsOpen(false); }}
                      className={`w-full px-2 py-1 text-left text-[10px] hover:bg-amber-50 flex items-center gap-1.5 ${selectedTemplate?._id === t._id ? 'bg-amber-50 border-r-2 border-amber-500' : ''}`}>
                      <span className="flex-1 truncate font-medium text-gray-800">{t.title}</span>
                      {selectedTemplate?._id === t._id && <Check size={10} className="text-amber-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgTemplateDropdown;

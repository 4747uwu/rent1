import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, User } from 'lucide-react';
import toast from 'react-hot-toast';

const AssignmentModalContent = ({ 
  study, availableAssignees, onSubmit, onClose, position, searchTerm: externalSearchTerm = ''
}) => {
  const [selectedRadiologistIds, setSelectedRadiologistIds] = useState([]);
  const [currentlyAssignedIds, setCurrentlyAssignedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const modalRef = useRef(null);

  const searchTerm = externalSearchTerm;

  useEffect(() => {
    let assignedIds = [];
    if (study?.assignedToIds && Array.isArray(study.assignedToIds) && study.assignedToIds.length > 0) {
      assignedIds = [...study.assignedToIds];
    } else if (study?.assignedDoctors && Array.isArray(study.assignedDoctors) && study.assignedDoctors.length > 0) {
      assignedIds = study.assignedDoctors.map(doc => doc.id).filter(Boolean);
    } else if (study?.assignment?.assignedToIds && Array.isArray(study.assignment.assignedToIds)) {
      assignedIds = [...study.assignment.assignedToIds];
    } else if (study?._raw?.assignment && Array.isArray(study._raw.assignment)) {
      const sortedAssignments = study._raw.assignment.sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt));
      if (sortedAssignments.length > 0) {
        const latestAssignmentDate = sortedAssignments[0].assignedAt;
        const latestAssignments = sortedAssignments.filter(a => a.assignedAt === latestAssignmentDate);
        assignedIds = [...new Set(latestAssignments.map(a => a.assignedTo?.toString()).filter(Boolean))];
      }
    } else if (study?.assignment?.assignedToId) {
      assignedIds = [study.assignment.assignedToId.toString()];
    }
    setCurrentlyAssignedIds(assignedIds);
    setSelectedRadiologistIds(assignedIds);
  }, [study]);

  const filteredRadiologists = useMemo(() => {
    if (!availableAssignees?.radiologists) return [];
    const term = searchTerm.toLowerCase().trim();
    if (!term) return availableAssignees.radiologists;
    return availableAssignees.radiologists.filter(r =>
      r.email.toLowerCase().includes(term) ||
      r.fullName?.toLowerCase().includes(term) ||
      (r.firstName && r.lastName && `${r.firstName} ${r.lastName}`.toLowerCase().includes(term))
    );
  }, [availableAssignees?.radiologists, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event) => { if (modalRef.current && !modalRef.current.contains(event.target)) onClose(); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleEscKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [onClose]);

  const handleSelectRadiologist = (radiologistId) => {
    setSelectedRadiologistIds(prev => prev.includes(radiologistId) ? prev.filter(id => id !== radiologistId) : [...prev, radiologistId]);
  };

  const handleApplyAssignments = async () => {
    setLoading(true);
    try {
      const validPriority = study.priority === 'SELECT' ? 'NORMAL' : study.priority;
      await onSubmit({
        study, assignedToIds: selectedRadiologistIds, assigneeRole: 'radiologist', priority: validPriority || 'NORMAL',
        notes: `Assignment updated via modal - ${selectedRadiologistIds.length} radiologist(s) selected`,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      onClose();
    } catch (error) { toast.error('Failed to update assignment'); } 
    finally { setLoading(false); }
  };

  const newAssignments = selectedRadiologistIds.filter(id => !currentlyAssignedIds.includes(id)).length;
  const removedAssignments = currentlyAssignedIds.filter(id => !selectedRadiologistIds.includes(id)).length;
  const unchangedAssignments = selectedRadiologistIds.filter(id => currentlyAssignedIds.includes(id)).length;

  return (
    // ✅ COMPACT POPOVER MODAL
    <div 
      ref={modalRef}
      className="fixed bg-white border border-gray-900 rounded shadow-2xl z-[9999] flex flex-col"
      style={{
        top: `${position?.top || 0}px`, left: `${position?.left || 0}px`, width: `${position?.width || 350}px`,
        maxWidth: '400px', maxHeight: '400px'
      }}
    >
      {/* ✅ HEADER: Matched theme */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-900 text-white rounded-t">
        <div className="flex items-center gap-1.5 min-w-0">
          <User className="w-3.5 h-3.5 flex-shrink-0" />
          <div className="truncate">
            <div className="text-[10px] sm:text-xs font-bold uppercase">Assign Radiologists</div>
            {searchTerm && <div className="text-[8px] text-gray-300 mt-0 uppercase truncate">Search: "{searchTerm}"</div>}
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded transition-colors" disabled={loading}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ✅ STATUS BAR */}
      <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200">
        <div className="text-[9px] text-gray-800 uppercase font-semibold leading-tight">
          {selectedRadiologistIds.length === 0 ? <span className="text-red-600">No selection - Will unassign</span> : `${selectedRadiologistIds.length} selected`}
          {(newAssignments > 0 || removedAssignments > 0) && (
            <span className="ml-1 text-gray-500 font-medium">
              ({newAssignments > 0 && `+${newAssignments}`} {newAssignments > 0 && removedAssignments > 0 && '|'} {removedAssignments > 0 && `-${removedAssignments}`})
            </span>
          )}
        </div>
      </div>

      {/* ✅ RADIOLOGIST LIST */}
      <div className="overflow-y-auto flex-1 bg-white">
        {filteredRadiologists.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            <p className="text-[10px] font-bold uppercase">{searchTerm ? `No match for "${searchTerm}"` : 'No radiologists'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredRadiologists.map((radiologist) => {
              const isAssigned = currentlyAssignedIds.includes(radiologist._id?.toString());
              const isSelected = selectedRadiologistIds.includes(radiologist._id?.toString());
              const hasWorkload = radiologist.workload?.currentWorkload > 0;
              
              return (
                <div
                  key={radiologist._id} onClick={() => handleSelectRadiologist(radiologist._id.toString())}
                  className={`flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer transition-colors ${
                    isSelected ? 'bg-gray-50' : ''
                  }`}
                >
                  <input
                    type="checkbox" checked={isSelected} onChange={(e) => { e.stopPropagation(); handleSelectRadiologist(radiologist._id.toString()); }}
                    className="mr-2.5 h-3 w-3 text-gray-900 rounded-sm border-gray-300 focus:ring-gray-900" disabled={loading}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div className={`text-[10px] font-bold truncate uppercase ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                        {radiologist.fullName || radiologist.email.split('@')[0]}
                      </div>
                      
                      {/* Compact Badges */}
                      {isAssigned && !isSelected && <span className="px-1 py-0.5 bg-red-100 text-red-700 text-[7px] font-bold rounded uppercase">Remove</span>}
                      {isSelected && !isAssigned && <span className="px-1 py-0.5 bg-green-100 text-green-700 text-[7px] font-bold rounded uppercase">Add</span>}
                    </div>
                    
                    {radiologist.email && radiologist.fullName && (
                      <div className="text-[8px] text-gray-500 truncate">{radiologist.email}</div>
                    )}
                    
                    {hasWorkload && (
                      <div className="text-[8px] text-gray-500 mt-0.5 font-medium uppercase">
                        {radiologist.workload.currentWorkload} Active
                        {radiologist.workload.urgentCases > 0 && <span className="text-red-500 ml-1">• {radiologist.workload.urgentCases} Urgent</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ✅ FOOTER */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 rounded-b flex gap-2">
        <button onClick={onClose} disabled={loading} className="px-3 py-1 text-[9px] font-bold bg-gray-200 text-gray-700 rounded border border-gray-300 uppercase hover:bg-gray-300 w-1/3">
          Cancel
        </button>
        <button onClick={handleApplyAssignments} disabled={loading} className="px-3 py-1 text-[9px] font-bold bg-gray-900 text-white rounded border border-gray-900 uppercase hover:bg-black w-2/3">
          {loading ? 'APPLYING...' : 'APPLY CHANGES'}
        </button>
      </div>
    </div>
  );
};

const AssignmentModal = (props) => {
  return createPortal(<AssignmentModalContent {...props} />, document.body);
};

export default AssignmentModal;
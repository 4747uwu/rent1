import React, { useState } from 'react';
import { Users, CheckSquare, Square, Info, AlertCircle } from 'lucide-react';

/**
 * MultiAccountRoleSelector Component
 * Allows users to have multiple roles/account types
 * 
 * @param {Array} selectedRoles - Array of role strings that are currently selected
 * @param {Function} onRoleToggle - Callback when a role is toggled
 * @param {String} primaryRole - The primary role (required)
 * @param {Function} onPrimaryRoleChange - Callback when primary role changes
 */

const ROLE_DEFINITIONS = {
  admin: {
    label: 'Admin',
    description: 'Full company/center administration access',
    color: 'purple',
    icon: '👑',
    canHaveMultiple: false,
    conflictsWith: ['super_admin']
  },
  group_id: {
    label: 'Group ID',
    description: 'Can create and manage role groups',
    color: 'indigo',
    icon: '🔐',
    canHaveMultiple: true,
    conflictsWith: []
  },
  assignor: {
    label: 'Assignor',
    description: 'Assigns cases to radiologists and verifiers',
    color: 'teal',
    icon: '📋',
    canHaveMultiple: true,
    conflictsWith: []
  },
  radiologist: {
    label: 'Radiologist',
    description: 'Creates and edits medical reports',
    color: 'blue',
    icon: '👨‍⚕️',
    canHaveMultiple: true,
    conflictsWith: []
  },
  verifier: {
    label: 'Verifier',
    description: 'Reviews and finalizes reports',
    color: 'green',
    icon: '✓',
    canHaveMultiple: true,
    conflictsWith: []
  },
  physician: {
    label: 'Physician',
    description: 'Referral doctor with limited access',
    color: 'cyan',
    icon: '🩺',
    canHaveMultiple: true,
    conflictsWith: []
  },
  receptionist: {
    label: 'Receptionist',
    description: 'Patient registration and report printing',
    color: 'pink',
    icon: '📝',
    canHaveMultiple: true,
    conflictsWith: []
  },
  billing: {
    label: 'Billing',
    description: 'Billing and financial operations',
    color: 'yellow',
    icon: '💰',
    canHaveMultiple: true,
    conflictsWith: []
  },
  typist: {
    label: 'Typist',
    description: 'Report typing support for radiologists',
    color: 'orange',
    icon: '⌨️',
    canHaveMultiple: true,
    conflictsWith: []
  },
  dashboard_viewer: {
    label: 'Dashboard Viewer',
    description: 'Read-only dashboard access',
    color: 'gray',
    icon: '📊',
    canHaveMultiple: true,
    conflictsWith: []
  }
};

const MultiAccountRoleSelector = ({ 
  selectedRoles = [], 
  onRoleToggle,
  primaryRole,
  onPrimaryRoleChange
}) => {
  const [showInfo, setShowInfo] = useState(false);

  const handleRoleToggle = (roleKey) => {
    const roleDef = ROLE_DEFINITIONS[roleKey];
    
    // Check for conflicts
    if (!selectedRoles.includes(roleKey)) {
      const hasConflict = roleDef.conflictsWith.some(conflictRole => 
        selectedRoles.includes(conflictRole)
      );
      
      if (hasConflict) {
        alert(`Cannot add ${roleDef.label} role. It conflicts with another selected role.`);
        return;
      }
    }
    
    onRoleToggle(roleKey);
  };

  const isRoleSelected = (roleKey) => {
    return selectedRoles.includes(roleKey);
  };

  const canAddRole = (roleKey) => {
    const roleDef = ROLE_DEFINITIONS[roleKey];
    
    // Check if role conflicts with any selected role
    const hasConflict = roleDef.conflictsWith.some(conflictRole => 
      selectedRoles.includes(conflictRole)
    );
    
    return !hasConflict;
  };

  const getColorClasses = (color, isSelected) => {
    const colorMap = {
      purple: isSelected ? 'bg-purple-50 border-purple-400' : 'bg-white border-purple-200 hover:border-purple-300',
      indigo: isSelected ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-indigo-200 hover:border-indigo-300',
      teal: isSelected ? 'bg-teal-50 border-teal-400' : 'bg-white border-teal-200 hover:border-teal-300',
      blue: isSelected ? 'bg-blue-50 border-blue-400' : 'bg-white border-blue-200 hover:border-blue-300',
      green: isSelected ? 'bg-green-50 border-green-400' : 'bg-white border-green-200 hover:border-green-300',
      cyan: isSelected ? 'bg-cyan-50 border-cyan-400' : 'bg-white border-cyan-200 hover:border-cyan-300',
      pink: isSelected ? 'bg-pink-50 border-pink-400' : 'bg-white border-pink-200 hover:border-pink-300',
      yellow: isSelected ? 'bg-yellow-50 border-yellow-400' : 'bg-white border-yellow-200 hover:border-yellow-300',
      orange: isSelected ? 'bg-orange-50 border-orange-400' : 'bg-white border-orange-200 hover:border-orange-300',
      gray: isSelected ? 'bg-gray-50 border-gray-400' : 'bg-white border-gray-200 hover:border-gray-300'
    };
    return colorMap[color] || colorMap.gray;
  };

  return (
    <div className="space-y-4">
      {/* Header with info */}
      <div className="flex items-start justify-between bg-gradient-to-r from-slate-50 to-slate-100 p-4 rounded-lg border border-slate-200">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            Multi-Account Role Setup
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Select multiple roles for this user to access different features
          </p>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <Info className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Info panel */}
      {showInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 space-y-2">
              <p className="font-medium">About Multi-Account Setup:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Users can have multiple roles to access different features</li>
                <li>The primary role determines the default dashboard</li>
                <li>Permissions from all selected roles are combined</li>
                <li>Some roles cannot be combined due to conflicts</li>
                <li>Users can switch between their roles in the dashboard</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Primary role selection */}
      {selectedRoles.length > 1 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
          <label className="block text-sm font-medium text-amber-900 mb-2">
            Primary Role (Default Dashboard)
          </label>
          <select
            value={primaryRole}
            onChange={(e) => onPrimaryRoleChange(e.target.value)}
            className="w-full px-4 py-2 border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {selectedRoles.map(roleKey => (
              <option key={roleKey} value={roleKey}>
                {ROLE_DEFINITIONS[roleKey]?.label || roleKey}
              </option>
            ))}
          </select>
          <p className="text-xs text-amber-700 mt-2">
            This role will be used as the default when the user logs in
          </p>
        </div>
      )}

      {/* Roles grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(ROLE_DEFINITIONS).map(([roleKey, roleDef]) => {
          const isSelected = isRoleSelected(roleKey);
          const canAdd = canAddRole(roleKey);
          const isDisabled = !canAdd && !isSelected;

          return (
            <button
              key={roleKey}
              onClick={() => handleRoleToggle(roleKey)}
              disabled={isDisabled}
              className={`
                flex items-start gap-3 p-4 rounded-lg border-2 transition-all text-left
                ${getColorClasses(roleDef.color, isSelected)}
                ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
              `}
            >
              <div className="mt-1">
                {isSelected ? (
                  <CheckSquare className={`w-6 h-6 text-${roleDef.color}-600`} />
                ) : (
                  <Square className="w-6 h-6 text-slate-400" />
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{roleDef.icon}</span>
                  <h4 className="font-semibold text-slate-900">
                    {roleDef.label}
                  </h4>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {roleDef.description}
                </p>
                
                {isDisabled && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="w-3 h-3" />
                    <span>Conflicts with selected role</span>
                  </div>
                )}
                
                {isSelected && selectedRoles.length > 1 && primaryRole === roleKey && (
                  <div className="mt-2 px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded inline-block">
                    Primary Role
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 p-4 rounded-lg border border-teal-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-teal-900">
              Selected Roles: <span className="text-xl font-bold">{selectedRoles.length}</span>
            </p>
            <p className="text-xs text-teal-700 mt-1">
              User will have combined permissions from all selected roles
            </p>
          </div>
          {selectedRoles.length === 0 && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>At least one role is required</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MultiAccountRoleSelector;

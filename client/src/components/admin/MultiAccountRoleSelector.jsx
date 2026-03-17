// client/src/components/admin/MultiAccountRoleSelector.jsx
import React, { useMemo } from 'react';
import { Shield, Crown, Users, ClipboardCheck, Stethoscope, UserCheck, Info, ChevronRight } from 'lucide-react';

// ✅ ROLE HIERARCHY - Higher number = more dominant
const ROLE_HIERARCHY = {
  'super_admin': 100,
  'admin': 90,
  'group_id': 80,
  'assignor': 70,
  'radiologist': 60,
  'typist': 60, // Same level as radiologist
  'verifier': 50,
  'physician': 40,
  'receptionist': 30,
  'billing': 20,
  'dashboard_viewer': 10
};

// ✅ ROLE HIERARCHY TIERS for visual grouping
const ROLE_TIERS = [
  {
    tier: 1,
    label: 'Management & Control',
    color: 'red',
    roles: ['admin', 'group_id']
  },
  {
    tier: 2,
    label: 'Workflow Operations',
    color: 'blue',
    roles: ['assignor']
  },
  {
    tier: 3,
    label: 'Clinical Operations',
    color: 'green',
    roles: ['radiologist', 'typist']
  },
  {
    tier: 4,
    label: 'Quality Assurance',
    color: 'purple',
    roles: ['verifier']
  },
  {
    tier: 5,
    label: 'Support & Access',
    color: 'gray',
    roles: ['physician', 'receptionist', 'billing', 'dashboard_viewer']
  }
];

// ✅ ROLE METADATA
const ROLE_METADATA = {
  admin: {
    name: 'Admin',
    icon: <Shield className="w-5 h-5" />,
    description: 'Full system control and user management',
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200'
  },
  group_id: {
    name: 'Group Creator',
    icon: <Crown className="w-5 h-5" />,
    description: 'Can create users in their group',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200'
  },
  assignor: {
    name: 'Assignor',
    icon: <Users className="w-5 h-5" />,
    description: 'Assigns cases to radiologists',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200'
  },
  radiologist: {
    name: 'Radiologist',
    icon: <Stethoscope className="w-5 h-5" />,
    description: 'Creates and submits reports',
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200'
  },
  typist: {
    name: 'Typist',
    icon: <ClipboardCheck className="w-5 h-5" />,
    description: 'Assists radiologist with typing',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    border: 'border-teal-200'
  },
  verifier: {
    name: 'Verifier',
    icon: <UserCheck className="w-5 h-5" />,
    description: 'Reviews and finalizes reports',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200'
  },
  physician: {
    name: 'Physician',
    icon: <Stethoscope className="w-5 h-5" />,
    description: 'Views referred patient reports',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200'
  },
  receptionist: {
    name: 'Receptionist',
    icon: <Users className="w-5 h-5" />,
    description: 'Patient registration and reports',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200'
  },
  billing: {
    name: 'Billing',
    icon: <ClipboardCheck className="w-5 h-5" />,
    description: 'Manages billing and invoices',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200'
  },
  dashboard_viewer: {
    name: 'Dashboard Viewer',
    icon: <Info className="w-5 h-5" />,
    description: 'Read-only dashboard access',
    color: 'text-gray-600',
    bg: 'bg-gray-50',
    border: 'border-gray-200'
  }
};

// ✅ DETERMINE PRIMARY ROLE FROM SELECTED ROLES
const determinePrimaryRole = (selectedRoles) => {
  if (selectedRoles.length === 0) return null;
  if (selectedRoles.length === 1) return selectedRoles[0];
  
  return selectedRoles.sort((a, b) => {
    return (ROLE_HIERARCHY[b] || 0) - (ROLE_HIERARCHY[a] || 0);
  })[0];
};

const MultiAccountRoleSelector = ({ 
  selectedRoles = [], 
  primaryRole = '', 
  onRoleToggle, 
  onPrimaryRoleChange 
}) => {
  
  // ✅ Auto-determine primary role based on hierarchy
  const autoPrimaryRole = useMemo(() => {
    return determinePrimaryRole(selectedRoles);
  }, [selectedRoles]);

  // ✅ Update primary role when selection changes
  React.useEffect(() => {
    if (autoPrimaryRole && autoPrimaryRole !== primaryRole) {
      onPrimaryRoleChange(autoPrimaryRole);
    }
  }, [autoPrimaryRole, primaryRole, onPrimaryRoleChange]);

  const getTierColor = (color) => {
    const colors = {
      red: 'bg-red-50 border-red-200 text-red-900',
      blue: 'bg-blue-50 border-blue-200 text-blue-900',
      green: 'bg-green-50 border-green-200 text-green-900',
      purple: 'bg-purple-50 border-purple-200 text-purple-900',
      gray: 'bg-gray-50 border-gray-200 text-gray-900'
    };
    return colors[color] || colors.gray;
  };

  return (
    <div className="space-y-6">
      {/* Hierarchy Info Banner */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-indigo-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-indigo-900 mb-1">Role Hierarchy & Priority</h4>
            <p className="text-xs text-indigo-700 mb-2">
              When multiple roles are selected, the <strong>Primary Role</strong> is automatically determined by hierarchy. 
              This determines which dashboard the user sees first.
            </p>
            <div className="flex items-center space-x-2 text-xs">
              <span className="font-medium text-indigo-900">Priority Order:</span>
              <div className="flex items-center space-x-1">
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded">Admin</span>
                <ChevronRight className="w-3 h-3 text-gray-400" />
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Assignor</span>
                <ChevronRight className="w-3 h-3 text-gray-400" />
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">Radiologist</span>
                <ChevronRight className="w-3 h-3 text-gray-400" />
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">Verifier</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Role Display */}
      {autoPrimaryRole && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Crown className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-yellow-900">Primary Role (Auto-Selected)</h4>
              <p className="text-xs text-yellow-700 mt-0.5">
                User will be redirected to: <strong>{ROLE_METADATA[autoPrimaryRole]?.name}</strong> Dashboard
              </p>
            </div>
            <div className={`px-4 py-2 rounded-lg ${ROLE_METADATA[autoPrimaryRole]?.bg} ${ROLE_METADATA[autoPrimaryRole]?.border} border-2`}>
              <div className="flex items-center space-x-2">
                <div className={ROLE_METADATA[autoPrimaryRole]?.color}>
                  {ROLE_METADATA[autoPrimaryRole]?.icon}
                </div>
                <span className="font-semibold text-sm">{ROLE_METADATA[autoPrimaryRole]?.name}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role Selection by Tiers */}
      {ROLE_TIERS.map((tier) => (
        <div key={tier.tier} className={`border-2 rounded-lg ${getTierColor(tier.color)}`}>
          <div className="px-4 py-3 border-b-2 border-current/20">
            <h4 className="text-sm font-bold flex items-center space-x-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/50 text-xs font-bold">
                {tier.tier}
              </span>
              <span>{tier.label}</span>
            </h4>
          </div>
          
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tier.roles.map((roleKey) => {
                const roleMeta = ROLE_METADATA[roleKey];
                if (!roleMeta) return null;
                
                const isSelected = selectedRoles.includes(roleKey);
                const isPrimary = autoPrimaryRole === roleKey;
                
                return (
                  <div
                    key={roleKey}
                    onClick={() => onRoleToggle(roleKey)}
                    className={`relative p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                      isSelected 
                        ? `${roleMeta.border} ${roleMeta.bg} shadow-md` 
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-white' : roleMeta.bg}`}>
                        <div className={roleMeta.color}>
                          {roleMeta.icon}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h5 className="text-sm font-semibold text-gray-900">
                            {roleMeta.name}
                          </h5>
                          {isPrimary && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-800">
                              <Crown className="w-3 h-3 mr-1" />
                              PRIMARY
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          {roleMeta.description}
                        </p>
                      </div>
                    </div>
                    
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${roleMeta.bg}`}>
                          <svg className={`w-3 h-3 ${roleMeta.color}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      {/* Selection Summary */}
      {selectedRoles.length > 0 && (
        <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Selected Roles Summary</h4>
          <div className="flex flex-wrap gap-2">
            {selectedRoles.map((roleKey, index) => {
              const roleMeta = ROLE_METADATA[roleKey];
              const isPrimary = autoPrimaryRole === roleKey;
              
              return (
                <div
                  key={roleKey}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border-2 ${
                    isPrimary 
                      ? 'bg-yellow-50 border-yellow-300' 
                      : `${roleMeta.bg} ${roleMeta.border}`
                  }`}
                >
                  <div className={roleMeta.color}>
                    {roleMeta.icon}
                  </div>
                  <span className="text-sm font-medium">{roleMeta.name}</span>
                  {isPrimary && <Crown className="w-4 h-4 text-yellow-600" />}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-600 mt-3">
            <strong>{selectedRoles.length}</strong> role{selectedRoles.length !== 1 ? 's' : ''} selected. 
            Columns will be merged from all selected roles.
          </p>
        </div>
      )}
    </div>
  );
};

export default MultiAccountRoleSelector;
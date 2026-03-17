# Multi-Tenant Column & Account Management System
## Implementation Guide

This document outlines the three new features implemented for the order management system:

1. **Column-based Restriction**
2. **Multi-Account Setup (Multiple Roles)**
3. **Lab/Center Linking for Users**

---

## 📋 Feature 1: Column-based Restriction

### Overview
Users can now customize which columns they see in their worklist tables. During account creation or in user management, admins can select specific columns that should be visible to each user.

### Database Changes

#### User Model (`backend/models/userModel.js`)
```javascript
// ✅ NEW FEATURE 1: Column-based Restriction
visibleColumns: [{
    type: String,
    trim: true
}]
```

### Frontend Components Created

#### 1. Column Definitions (`client/src/constants/worklistColumns.js`)
- **Purpose**: Centralized definition of all available columns
- **Key Exports**:
  - `WORKLIST_COLUMNS`: Object containing all column definitions
  - `DEFAULT_COLUMNS_BY_ROLE`: Default columns for each user role
  - `COLUMN_CATEGORIES`: Grouped columns by category (Patient, Study, Workflow, etc.)
  - Helper functions: `getDefaultColumnsForRole()`, `getColumnsByCategory()`, etc.

**Column Categories**:
- 👤 Patient Information (Patient ID, Name, Age, Gender)
- 🔬 Study Details (Study Date, Name, Modality, Body Part)
- ⚡ Status & Workflow (Status, Priority, Workflow Status)
- 👥 Assignment Info (Assigned Radiologist, Verifier)
- 👨‍⚕️ Physician Details (Referring Physician)
- 🏥 Lab/Center Info (Lab Name, Location)
- 📄 Report Information (Report Status, Dates)
- ⏱️ Timing & TAT (Created At, TAT, Time Elapsed)
- 📋 Clinical Data (Clinical History, Notes, Diagnosis)
- 🔧 System Metadata (Study UID, Series Count, Images Count)
- ⚙️ Actions (Actions dropdown, Selection checkbox)

#### 2. Column Selector Component (`client/src/components/common/ColumnSelector.jsx`)
- **Purpose**: UI component for selecting visible columns
- **Features**:
  - Expandable categories with progress bars
  - Select All / Clear All functionality
  - Always-visible columns (cannot be deselected)
  - Visual feedback for selections
  - Category-based grouping with icons

**Usage Example**:
```jsx
import ColumnSelector from '../../components/common/ColumnSelector';
import { getDefaultColumnsForRole } from '../../constants/worklistColumns';

const [selectedColumns, setSelectedColumns] = useState(
  getDefaultColumnsForRole(userRole)
);

<ColumnSelector
  selectedColumns={selectedColumns}
  onColumnToggle={(columnId) => {
    setSelectedColumns(prev =>
      prev.includes(columnId)
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  }}
  onSelectAll={() => setSelectedColumns(allColumnIds)}
  onClearAll={() => setSelectedColumns(['selection', 'actions'])}
  userRole={userRole}
/>
```

### Integration Points

#### In User Creation Forms:
```jsx
// Add to CreateDoctor.jsx, CreateLab.jsx, UserManagement.jsx
const [formData, setFormData] = useState({
  // ... other fields
  visibleColumns: getDefaultColumnsForRole('radiologist')
});
```

#### In Worklist Tables:
```jsx
// Filter columns based on user's visibleColumns
const visibleColumnIds = currentUser?.visibleColumns || getDefaultColumnsForRole(currentUser?.role);
const shouldShowColumn = (columnId) => visibleColumnIds.includes(columnId);
```

---

## 👥 Feature 2: Multi-Account Setup (Multiple Roles)

### Overview
Users can now have multiple roles simultaneously. For example, a user can be both an Assignor and a Radiologist, giving them access to features from both roles.

### Database Changes

#### User Model (`backend/models/userModel.js`)
```javascript
// ✅ NEW FEATURE 2: Multi-Account Setup (Multiple Roles)
accountTypes: [{
    type: String,
    enum: [
        'super_admin', 'admin', 'group_id', 'assignor', 'radiologist', 
        'verifier', 'physician', 'receptionist', 'billing', 'typist', 
        'dashboard_viewer', 'lab_staff', 'doctor_account', 'owner'
    ]
}],

linkedAccounts: [{
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    role: {
        type: String,
        enum: ['super_admin', 'admin', ...], // same as above
        required: true
    },
    linkedAt: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    }
}]
```

**Indexes Added**:
```javascript
UserSchema.index({ 'linkedAccounts.userId': 1 });
```

### Frontend Components Created

#### Multi-Account Role Selector (`client/src/components/common/MultiAccountRoleSelector.jsx`)
- **Purpose**: UI for selecting multiple roles for a user
- **Features**:
  - Visual role cards with icons and descriptions
  - Primary role selection (determines default dashboard)
  - Conflict detection (some roles cannot be combined)
  - Combined permissions display
  - Color-coded roles for easy identification

**Role Definitions**:
```javascript
const ROLE_DEFINITIONS = {
  admin: {
    label: 'Admin',
    icon: '👑',
    color: 'purple',
    conflictsWith: ['super_admin']
  },
  assignor: {
    label: 'Assignor',
    icon: '📋',
    color: 'teal',
    canHaveMultiple: true
  },
  radiologist: {
    label: 'Radiologist',
    icon: '👨‍⚕️',
    color: 'blue',
    canHaveMultiple: true
  },
  // ... etc
};
```

**Usage Example**:
```jsx
import MultiAccountRoleSelector from '../../components/common/MultiAccountRoleSelector';

const [selectedRoles, setSelectedRoles] = useState(['radiologist']);
const [primaryRole, setPrimaryRole] = useState('radiologist');

<MultiAccountRoleSelector
  selectedRoles={selectedRoles}
  onRoleToggle={(roleKey) => {
    setSelectedRoles(prev =>
      prev.includes(roleKey)
        ? prev.filter(r => r !== roleKey)
        : [...prev, roleKey]
    );
  }}
  primaryRole={primaryRole}
  onPrimaryRoleChange={setPrimaryRole}
/>
```

### Backend Logic

#### Combined Permissions:
When a user has multiple roles, their permissions should be the union of all role permissions:

```javascript
// Backend: Calculate combined permissions
const calculateCombinedPermissions = (accountTypes) => {
  const combinedPermissions = {};
  
  accountTypes.forEach(role => {
    const rolePermissions = getPermissionsForRole(role);
    Object.assign(combinedPermissions, rolePermissions);
  });
  
  return combinedPermissions;
};
```

#### Dashboard Routing:
Users should be able to switch between their different role dashboards:

```javascript
// Frontend: Role switcher in header
const availableDashboards = user.accountTypes.map(role => ({
  role,
  route: getDashboardRouteForRole(role),
  label: getRoleLabelForRole(role)
}));
```

---

## 🏥 Feature 3: Lab/Center Linking for Users

### Overview
Admin and Assignor users can be linked to specific labs/centers. When they access their dashboard, they only see studies from those linked centers.

### Database Changes

#### User Model (`backend/models/userModel.js`)
```javascript
// ✅ NEW FEATURE 3: Linking to Centers/Labs
linkedLabs: [{
    labId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lab',
        required: true,
        index: true
    },
    labName: {
        type: String,
        trim: true
    },
    labIdentifier: {
        type: String,
        trim: true,
        uppercase: true
    },
    linkedAt: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    },
    labPermissions: {
        canViewStudies: { type: Boolean, default: true },
        canAssignStudies: { type: Boolean, default: false },
        canEditStudies: { type: Boolean, default: false }
    }
}]
```

**Indexes Added**:
```javascript
UserSchema.index({ 'linkedLabs.labId': 1 });
```

### Frontend Components Created

#### Lab Selector Component (`client/src/components/common/LabSelector.jsx`)
- **Purpose**: UI for selecting which labs a user can access
- **Features**:
  - Fetches labs from organization
  - Search functionality (by name, identifier, location)
  - Visual lab cards with details (location, staff count, contact info)
  - Active/inactive lab status display
  - Select All / Clear All functionality
  - Summary of selected labs

**Usage Example**:
```jsx
import LabSelector from '../../components/common/LabSelector';

const [selectedLabs, setSelectedLabs] = useState([]);

<LabSelector
  selectedLabs={selectedLabs}
  onLabToggle={(labId) => {
    setSelectedLabs(prev =>
      prev.includes(labId)
        ? prev.filter(id => id !== labId)
        : [...prev, labId]
    );
  }}
  onSelectAll={() => setSelectedLabs(allLabIds)}
  onClearAll={() => setSelectedLabs([])}
  organizationId={currentUser.organization}
/>
```

### Backend Implementation

#### Study Query Filtering:
When fetching studies for a user with linked labs:

```javascript
// Backend: Filter studies by linked labs
router.get('/studies', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    let query = {
      organizationIdentifier: user.organizationIdentifier
    };
    
    // If user has linked labs, filter by those labs
    if (user.linkedLabs && user.linkedLabs.length > 0) {
      const activeLinkedLabIds = user.linkedLabs
        .filter(ll => ll.isActive)
        .map(ll => ll.labId);
      
      query.lab = { $in: activeLinkedLabIds };
    }
    
    const studies = await DicomStudy.find(query)
      .populate('patient')
      .populate('lab')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, studies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

---

## 🔧 Integration Guide

### Step 1: Update User Creation Forms

#### For CreateDoctor.jsx:
```jsx
import ColumnSelector from '../../components/common/ColumnSelector';
import LabSelector from '../../components/common/LabSelector';
import { getDefaultColumnsForRole } from '../../constants/worklistColumns';

// Add to form state
const [formData, setFormData] = useState({
  // ... existing fields
  visibleColumns: getDefaultColumnsForRole('radiologist'),
  linkedLabs: []
});

// Add to form UI (Step 3 or new step)
<div className="space-y-6">
  <ColumnSelector
    selectedColumns={formData.visibleColumns}
    onColumnToggle={(columnId) => {
      setFormData(prev => ({
        ...prev,
        visibleColumns: prev.visibleColumns.includes(columnId)
          ? prev.visibleColumns.filter(id => id !== columnId)
          : [...prev.visibleColumns, columnId]
      }));
    }}
    onSelectAll={() => {/* implement */}}
    onClearAll={() => {/* implement */}}
    userRole="radiologist"
  />
  
  <LabSelector
    selectedLabs={formData.linkedLabs}
    onLabToggle={(labId) => {
      setFormData(prev => ({
        ...prev,
        linkedLabs: prev.linkedLabs.includes(labId)
          ? prev.linkedLabs.filter(id => id !== labId)
          : [...prev.linkedLabs, labId]
      }));
    }}
    onSelectAll={() => {/* implement */}}
    onClearAll={() => {/* implement */}}
    organizationId={currentUser.organization}
  />
</div>
```

#### For CreateLab.jsx (Staff User):
```jsx
import MultiAccountRoleSelector from '../../components/common/MultiAccountRoleSelector';

// Add to form state
const [selectedRoles, setSelectedRoles] = useState(['lab_staff']);
const [primaryRole, setPrimaryRole] = useState('lab_staff');

// Add to form UI
<MultiAccountRoleSelector
  selectedRoles={selectedRoles}
  onRoleToggle={(roleKey) => {/* implement */}}
  primaryRole={primaryRole}
  onPrimaryRoleChange={setPrimaryRole}
/>
```

#### For UserManagement.jsx:
Add all three components for comprehensive user management.

### Step 2: Update Worklist Tables

#### Example for WorklistTable.jsx:
```jsx
import { getColumnById } from '../../constants/worklistColumns';

const WorklistTable = ({ studies, currentUser, ...props }) => {
  // Get user's visible columns
  const visibleColumnIds = currentUser?.visibleColumns || 
    getDefaultColumnsForRole(currentUser?.role);
  
  const shouldShowColumn = (columnId) => {
    return visibleColumnIds.includes(columnId);
  };
  
  return (
    <table>
      <thead>
        <tr>
          {shouldShowColumn('selection') && <th>Select</th>}
          {shouldShowColumn('patientId') && <th>Patient ID</th>}
          {shouldShowColumn('patientName') && <th>Patient Name</th>}
          {/* ... other columns */}
        </tr>
      </thead>
      <tbody>
        {studies.map(study => (
          <tr key={study._id}>
            {shouldShowColumn('selection') && <td>...</td>}
            {shouldShowColumn('patientId') && <td>...</td>}
            {shouldShowColumn('patientName') && <td>...</td>}
            {/* ... other columns */}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

Apply similar changes to:
- `doctorWorklistTable.jsx`
- `verifierWorklistTable.jsx`
- Any other worklist tables

### Step 3: Update Backend Routes

#### Update user creation endpoint:
```javascript
// Backend: routes/admin.routes.js
router.post('/create-user', authMiddleware, async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      fullName,
      role,
      accountTypes,        // NEW
      visibleColumns,      // NEW
      linkedLabs,          // NEW
      // ... other fields
    } = req.body;
    
    const newUser = new User({
      organization: req.user.organization,
      organizationIdentifier: req.user.organizationIdentifier,
      username,
      email,
      password,
      fullName,
      role: role || (accountTypes && accountTypes[0]), // Primary role
      accountTypes: accountTypes || [role],             // NEW
      visibleColumns,                                   // NEW
      linkedLabs: linkedLabs?.map(labId => ({          // NEW
        labId,
        isActive: true
      })),
      createdBy: req.user._id
    });
    
    await newUser.save();
    
    res.json({
      success: true,
      message: 'User created successfully',
      user: newUser
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
```

#### Update study query endpoints:
```javascript
// Backend: Filter studies by linked labs
router.get('/studies', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    let query = {
      organizationIdentifier: user.organizationIdentifier
    };
    
    // NEW: Filter by linked labs if user has them
    if (user.linkedLabs && user.linkedLabs.length > 0) {
      const activeLinkedLabIds = user.linkedLabs
        .filter(ll => ll.isActive)
        .map(ll => ll.labId);
      
      if (activeLinkedLabIds.length > 0) {
        query.lab = { $in: activeLinkedLabIds };
      }
    }
    
    // Apply role-based filters
    if (user.role === 'radiologist') {
      query['assignment.assignedTo'] = user._id;
    } else if (user.role === 'verifier') {
      // Verifier logic
    }
    
    const studies = await DicomStudy.find(query)
      .populate('patient')
      .populate('lab')
      .populate('assignment.assignedTo')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, studies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

---

## 🎯 Summary of Files Created/Modified

### Created Files:
1. ✅ `client/src/constants/worklistColumns.js` - Column definitions
2. ✅ `client/src/components/common/ColumnSelector.jsx` - Column selection UI
3. ✅ `client/src/components/common/LabSelector.jsx` - Lab selection UI
4. ✅ `client/src/components/common/MultiAccountRoleSelector.jsx` - Multi-role UI

### Modified Files:
1. ✅ `backend/models/userModel.js` - Added new fields and indexes

### Files to be Modified (Integration):
1. `client/src/pages/admin/CreateDoctor.jsx`
2. `client/src/pages/admin/CreateLab.jsx`
3. `client/src/pages/admin/UserManagement.jsx`
4. `client/src/components/common/WorklistTable/WorklistTable.jsx`
5. `client/src/components/common/WorklistTable/doctorWorklistTable.jsx`
6. `client/src/components/common/WorklistTable/verifierWorklistTable.jsx`
7. `backend/routes/admin.routes.js`
8. `backend/routes/doctor.routes.js`
9. `backend/routes/assignor.routes.js`
10. Other route files that fetch studies

---

## 📝 Testing Checklist

### Feature 1: Column-based Restriction
- [ ] User can select/deselect columns during account creation
- [ ] Selected columns persist in database
- [ ] Worklist tables show only selected columns
- [ ] "Always visible" columns cannot be deselected
- [ ] Default columns are pre-selected based on role
- [ ] Column categories expand/collapse correctly

### Feature 2: Multi-Account Setup
- [ ] User can select multiple roles
- [ ] Primary role can be selected from available roles
- [ ] Conflicting roles are prevented
- [ ] User has combined permissions from all roles
- [ ] User can switch between role dashboards
- [ ] Role cards display correctly with icons

### Feature 3: Lab/Center Linking
- [ ] Admin can link user to specific labs
- [ ] Lab selection UI shows all available labs
- [ ] Search functionality works for labs
- [ ] User only sees studies from linked labs
- [ ] Lab permissions are respected
- [ ] Inactive labs are indicated clearly

---

## 🚀 Next Steps

1. **Integrate components into existing forms** - Add the new components to CreateDoctor, CreateLab, and UserManagement pages

2. **Update worklist tables** - Implement column filtering in all worklist table components

3. **Update backend routes** - Add lab filtering and multi-role support to study query endpoints

4. **Add role switcher** - Create a UI component for users to switch between their different roles

5. **Add column customization in settings** - Allow users to customize their visible columns from a settings page

6. **Testing** - Thoroughly test all three features with different user roles

7. **Documentation** - Update API documentation and user guides

---

## 💡 Future Enhancements

1. **Column Reordering**: Allow users to drag-and-drop to reorder columns
2. **Column Presets**: Save multiple column configurations as presets
3. **Lab-specific Permissions**: More granular permissions per lab
4. **Role Scheduling**: Time-based role switching (e.g., assignor during day, radiologist at night)
5. **Column Templates**: Admin-defined column templates for different scenarios
6. **Advanced Filtering**: Save custom filters per lab/role combination

---

## 📞 Support

For questions or issues with this implementation, please contact the development team.

---

**Last Updated**: December 29, 2025
**Version**: 1.0

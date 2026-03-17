# Quick Integration Reference

## 🎯 Quick Start: Integrating New Features

### 1. Column-based Restriction

#### Import:
```javascript
import ColumnSelector from '../../components/common/ColumnSelector';
import { getDefaultColumnsForRole, WORKLIST_COLUMNS } from '../../constants/worklistColumns';
```

#### Add to Form State:
```javascript
const [visibleColumns, setVisibleColumns] = useState(
  getDefaultColumnsForRole(userRole) // or formData.role
);
```

#### Add Component to Form:
```jsx
<ColumnSelector
  selectedColumns={visibleColumns}
  onColumnToggle={(columnId) => {
    setVisibleColumns(prev =>
      prev.includes(columnId)
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  }}
  onSelectAll={() => {
    const allColumns = Object.values(WORKLIST_COLUMNS).map(col => col.id);
    setVisibleColumns(allColumns);
  }}
  onClearAll={() => {
    setVisibleColumns(['selection', 'actions']); // Always keep these
  }}
  userRole={userRole}
/>
```

#### Include in API Call:
```javascript
const response = await axios.post('/api/admin/create-user', {
  // ... other fields
  visibleColumns: visibleColumns
});
```

---

### 2. Multi-Account Role Setup

#### Import:
```javascript
import MultiAccountRoleSelector from '../../components/common/MultiAccountRoleSelector';
```

#### Add to Form State:
```javascript
const [selectedRoles, setSelectedRoles] = useState(['radiologist']);
const [primaryRole, setPrimaryRole] = useState('radiologist');
```

#### Add Component to Form:
```jsx
<MultiAccountRoleSelector
  selectedRoles={selectedRoles}
  onRoleToggle={(roleKey) => {
    setSelectedRoles(prev =>
      prev.includes(roleKey)
        ? prev.filter(r => r !== roleKey)
        : [...prev, roleKey]
    );
    
    // Ensure primary role is in selected roles
    if (roleKey === primaryRole && prev.includes(roleKey)) {
      setPrimaryRole(selectedRoles.filter(r => r !== roleKey)[0] || '');
    }
  }}
  primaryRole={primaryRole}
  onPrimaryRoleChange={(newPrimaryRole) => {
    setPrimaryRole(newPrimaryRole);
  }}
/>
```

#### Include in API Call:
```javascript
const response = await axios.post('/api/admin/create-user', {
  // ... other fields
  role: primaryRole,           // Primary role
  accountTypes: selectedRoles  // All roles
});
```

---

### 3. Lab/Center Linking

#### Import:
```javascript
import LabSelector from '../../components/common/LabSelector';
```

#### Add to Form State:
```javascript
const [selectedLabs, setSelectedLabs] = useState([]);
```

#### Add Component to Form:
```jsx
<LabSelector
  selectedLabs={selectedLabs}
  onLabToggle={(labId) => {
    setSelectedLabs(prev =>
      prev.includes(labId)
        ? prev.filter(id => id !== labId)
        : [...prev, labId]
    );
  }}
  onSelectAll={() => {
    const allLabIds = labs.map(lab => lab._id);
    setSelectedLabs(allLabIds);
  }}
  onClearAll={() => {
    setSelectedLabs([]);
  }}
  organizationId={currentUser.organization}
/>
```

#### Include in API Call:
```javascript
const response = await axios.post('/api/admin/create-user', {
  // ... other fields
  linkedLabs: selectedLabs.map(labId => ({
    labId: labId,
    isActive: true,
    labPermissions: {
      canViewStudies: true,
      canAssignStudies: role === 'assignor',
      canEditStudies: false
    }
  }))
});
```

---

## 📊 Worklist Table Column Filtering

#### Import:
```javascript
import { getDefaultColumnsForRole } from '../../constants/worklistColumns';
```

#### Get User's Visible Columns:
```javascript
const WorklistTable = ({ studies, currentUser, ...props }) => {
  // Get user's visible columns or default for their role
  const visibleColumnIds = currentUser?.visibleColumns?.length > 0
    ? currentUser.visibleColumns
    : getDefaultColumnsForRole(currentUser?.role || 'dashboard_viewer');
  
  // Helper function to check if column should be shown
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
          {shouldShowColumn('patientAge') && <th>Age</th>}
          {shouldShowColumn('studyDate') && <th>Study Date</th>}
          {/* Add all other columns with conditional rendering */}
          {shouldShowColumn('actions') && <th>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {studies.map(study => (
          <tr key={study._id}>
            {shouldShowColumn('selection') && (
              <td>
                <input type="checkbox" />
              </td>
            )}
            {shouldShowColumn('patientId') && (
              <td>{study.patientId}</td>
            )}
            {/* Add all other column data */}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

---

## 🔧 Backend: Study Query with Lab Filtering

#### Update Study Routes:
```javascript
import User from '../models/userModel.js';

router.get('/studies', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Base query
    let query = {
      organizationIdentifier: user.organizationIdentifier
    };
    
    // ✅ NEW: Filter by linked labs
    if (user.linkedLabs && user.linkedLabs.length > 0) {
      const activeLinkedLabIds = user.linkedLabs
        .filter(ll => ll.isActive)
        .map(ll => ll.labId);
      
      if (activeLinkedLabIds.length > 0) {
        query.lab = { $in: activeLinkedLabIds };
      }
    }
    
    // Role-based filtering
    if (user.role === 'radiologist') {
      query['assignment.assignedTo'] = user._id;
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

## 🎨 Styling Tips

### Tailwind Color Schemes Used:
- **Teal** (`teal-*`): Primary actions, selections, success states
- **Slate** (`slate-*`): Neutral elements, borders, text
- **Amber/Orange** (`amber-*`, `orange-*`): Warnings, primary role indicators
- **Blue** (`blue-*`): Info messages, links
- **Red** (`red-*`): Errors, inactive states, urgent items
- **Purple** (`purple-*`): Admin-related elements
- **Green** (`green-*`): Success, verifier role

### Consistent Patterns:
```css
/* Selected state */
className="bg-teal-50 border-teal-400 shadow-md"

/* Hover state */
className="hover:bg-teal-100 hover:border-teal-300"

/* Disabled state */
className="opacity-50 cursor-not-allowed bg-slate-100"

/* Primary button */
className="bg-teal-600 hover:bg-teal-700 text-white"

/* Secondary button */
className="bg-slate-200 hover:bg-slate-300 text-slate-700"
```

---

## 🧪 Testing Snippets

### Test Column Selection:
```javascript
// In browser console
const testUser = {
  role: 'radiologist',
  visibleColumns: ['patientId', 'patientName', 'studyDate', 'actions']
};

console.log('Should show Patient ID:', testUser.visibleColumns.includes('patientId'));
console.log('Should hide Lab Name:', !testUser.visibleColumns.includes('labName'));
```

### Test Multi-Role:
```javascript
const testUser = {
  role: 'radiologist',
  accountTypes: ['radiologist', 'verifier'],
  linkedAccounts: [/* ... */]
};

console.log('Has multiple roles:', testUser.accountTypes.length > 1);
console.log('Can access radiologist features:', testUser.accountTypes.includes('radiologist'));
console.log('Can access verifier features:', testUser.accountTypes.includes('verifier'));
```

### Test Lab Filtering:
```javascript
const testUser = {
  linkedLabs: [
    { labId: 'lab1', isActive: true },
    { labId: 'lab2', isActive: false }
  ]
};

const activeLabIds = testUser.linkedLabs
  .filter(ll => ll.isActive)
  .map(ll => ll.labId);

console.log('Active lab IDs:', activeLabIds); // ['lab1']
```

---

## 📝 Common Pitfalls & Solutions

### Issue 1: Columns not persisting
**Solution**: Ensure `visibleColumns` is included in the API request body:
```javascript
const userData = {
  ...formData,
  visibleColumns: visibleColumns // Don't forget this!
};
```

### Issue 2: Lab selector not loading labs
**Solution**: Check organization ID is passed correctly:
```jsx
<LabSelector organizationId={currentUser?.organization?._id || currentUser?.organization} />
```

### Issue 3: Multi-role permissions not working
**Solution**: Backend needs to combine permissions from all roles:
```javascript
// In auth middleware
const allPermissions = {};
user.accountTypes.forEach(role => {
  const rolePerms = getPermissionsForRole(role);
  Object.assign(allPermissions, rolePerms);
});
req.user.permissions = allPermissions;
```

---

## 🔗 API Endpoints to Update

### Create User:
```
POST /api/admin/create-user
Body: {
  ...existing fields,
  visibleColumns: string[],
  accountTypes: string[],
  linkedLabs: { labId: string, isActive: boolean }[]
}
```

### Update User:
```
PUT /api/admin/update-user/:id
Body: {
  ...existing fields,
  visibleColumns: string[],
  accountTypes: string[],
  linkedLabs: { labId: string, isActive: boolean }[]
}
```

### Get Studies (with lab filtering):
```
GET /api/{role}/studies
Query: Automatically filtered by user's linkedLabs
Response: { studies: [...] }
```

---

## 🎯 Implementation Checklist

### Phase 1: Database & Backend
- [✅] Update User model with new fields
- [ ] Add indexes for new fields
- [ ] Update user creation routes
- [ ] Update user update routes
- [ ] Update study query routes with lab filtering
- [ ] Update authentication middleware for multi-role

### Phase 2: Frontend Components
- [✅] Create ColumnSelector component
- [✅] Create LabSelector component
- [✅] Create MultiAccountRoleSelector component
- [✅] Create column definitions constant

### Phase 3: Integration
- [ ] Update CreateDoctor.jsx
- [ ] Update CreateLab.jsx
- [ ] Update UserManagement.jsx
- [ ] Update WorklistTable.jsx
- [ ] Update doctorWorklistTable.jsx
- [ ] Update verifierWorklistTable.jsx

### Phase 4: Testing
- [ ] Test column selection persistence
- [ ] Test multi-role access
- [ ] Test lab filtering
- [ ] Test edge cases (no columns selected, no labs selected)
- [ ] Test permissions combining

### Phase 5: Documentation
- [✅] Create implementation guide
- [✅] Create quick reference
- [ ] Update API documentation
- [ ] Create user guide

---

**Need help?** Refer to `IMPLEMENTATION_GUIDE.md` for detailed documentation.

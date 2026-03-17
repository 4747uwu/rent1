# Implementation Checklist

## ✅ Phase 1: Database & Backend (COMPLETED)

- [x] Update User model with `visibleColumns` field
- [x] Update User model with `accountTypes` field
- [x] Update User model with `linkedAccounts` field
- [x] Update User model with `linkedLabs` field
- [x] Add database indexes for new fields
- [ ] Update user creation route in admin.routes.js
- [ ] Update user update route in admin.routes.js
- [ ] Add lab filtering to study queries
- [ ] Implement permission combining for multi-role users
- [ ] Add validation for new fields

**Commands to test:**
```bash
# No database migration needed - Mongoose will auto-create fields
# Just restart your backend server
cd backend
npm run dev
```

---

## ✅ Phase 2: Constants & Components (COMPLETED)

- [x] Create worklistColumns.js constant file
- [x] Create ColumnSelector.jsx component
- [x] Create LabSelector.jsx component
- [x] Create MultiAccountRoleSelector.jsx component
- [x] Create IMPLEMENTATION_GUIDE.md
- [x] Create QUICK_REFERENCE.md
- [x] Create ARCHITECTURE_DIAGRAM.md
- [x] Create FEATURES_SUMMARY.md

**Files created:**
```
client/src/constants/worklistColumns.js
client/src/components/common/ColumnSelector.jsx
client/src/components/common/LabSelector.jsx
client/src/components/common/MultiAccountRoleSelector.jsx
IMPLEMENTATION_GUIDE.md
QUICK_REFERENCE.md
ARCHITECTURE_DIAGRAM.md
FEATURES_SUMMARY.md
```

---

## 🔄 Phase 3: Frontend Integration (PENDING)

### A. Update CreateDoctor.jsx
- [ ] Import ColumnSelector component
- [ ] Import LabSelector component
- [ ] Import worklistColumns constants
- [ ] Add visibleColumns to form state
- [ ] Add linkedLabs to form state
- [ ] Add ColumnSelector to Step 3 or new step
- [ ] Add LabSelector to Step 3 or new step
- [ ] Include new fields in API request

**Location:** `client/src/pages/admin/CreateDoctor.jsx`

**Code to add:**
```javascript
// At top of file
import ColumnSelector from '../../components/common/ColumnSelector';
import LabSelector from '../../components/common/LabSelector';
import { getDefaultColumnsForRole } from '../../constants/worklistColumns';

// In form state
const [formData, setFormData] = useState({
  // ... existing fields
  visibleColumns: getDefaultColumnsForRole('radiologist'),
  linkedLabs: []
});

// In form rendering (new step or add to step 3)
<ColumnSelector ... />
<LabSelector ... />

// In API call
const response = await axios.post('/api/admin/create-doctor', {
  ...formData,
  visibleColumns: formData.visibleColumns,
  linkedLabs: formData.linkedLabs
});
```

---

### B. Update CreateLab.jsx
- [ ] Import ColumnSelector component
- [ ] Import MultiAccountRoleSelector component
- [ ] Import worklistColumns constants
- [ ] Add visibleColumns to staffUserDetails state
- [ ] Add selectedRoles and primaryRole states
- [ ] Add ColumnSelector to form
- [ ] Add MultiAccountRoleSelector to form
- [ ] Include new fields in API request

**Location:** `client/src/pages/admin/CreateLab.jsx`

**Code to add:**
```javascript
// At top of file
import ColumnSelector from '../../components/common/ColumnSelector';
import MultiAccountRoleSelector from '../../components/common/MultiAccountRoleSelector';
import { getDefaultColumnsForRole } from '../../constants/worklistColumns';

// In form state
const [selectedRoles, setSelectedRoles] = useState(['lab_staff']);
const [primaryRole, setPrimaryRole] = useState('lab_staff');
const [visibleColumns, setVisibleColumns] = useState(
  getDefaultColumnsForRole('lab_staff')
);

// In form rendering
<MultiAccountRoleSelector
  selectedRoles={selectedRoles}
  primaryRole={primaryRole}
  onRoleToggle={...}
  onPrimaryRoleChange={...}
/>
<ColumnSelector
  selectedColumns={visibleColumns}
  onColumnToggle={...}
  userRole={primaryRole}
/>

// In API call
const response = await axios.post('/api/admin/create-lab', {
  ...formData,
  staffUserDetails: {
    ...formData.staffUserDetails,
    accountTypes: selectedRoles,
    role: primaryRole,
    visibleColumns: visibleColumns
  }
});
```

---

### C. Update UserManagement.jsx
- [ ] Import all three components
- [ ] Add column management modal
- [ ] Add lab linking modal
- [ ] Add role management modal
- [ ] Add edit functionality for new fields
- [ ] Update user edit API calls

**Location:** `client/src/pages/admin/UserManagement.jsx`

**Add three new modals:**
1. Column Management Modal
2. Lab Linking Modal
3. Role Management Modal

**Action buttons to add:**
```javascript
<button onClick={() => openColumnModal(user)}>
  Manage Columns
</button>
<button onClick={() => openLabModal(user)}>
  Manage Labs
</button>
<button onClick={() => openRoleModal(user)}>
  Manage Roles
</button>
```

---

### D. Update WorklistTable.jsx
- [ ] Import getDefaultColumnsForRole
- [ ] Get user's visibleColumns from context/props
- [ ] Create shouldShowColumn helper function
- [ ] Wrap all column headers with conditional rendering
- [ ] Wrap all column cells with conditional rendering
- [ ] Test with different column configurations

**Location:** `client/src/components/common/WorklistTable/WorklistTable.jsx`

**Code pattern:**
```javascript
import { getDefaultColumnsForRole } from '../../../constants/worklistColumns';

const WorklistTable = ({ studies, currentUser, ...props }) => {
  const visibleColumnIds = currentUser?.visibleColumns?.length > 0
    ? currentUser.visibleColumns
    : getDefaultColumnsForRole(currentUser?.role);
  
  const shouldShowColumn = (columnId) => visibleColumnIds.includes(columnId);
  
  return (
    <table>
      <thead>
        <tr>
          {shouldShowColumn('selection') && <th>Select</th>}
          {shouldShowColumn('patientId') && <th>Patient ID</th>}
          {/* ... repeat for all columns ... */}
        </tr>
      </thead>
      <tbody>
        {studies.map(study => (
          <tr>
            {shouldShowColumn('selection') && <td>...</td>}
            {shouldShowColumn('patientId') && <td>...</td>}
            {/* ... repeat for all columns ... */}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

---

### E. Update doctorWorklistTable.jsx
- [ ] Import getDefaultColumnsForRole
- [ ] Implement column filtering
- [ ] Test with doctor role

**Location:** `client/src/components/common/WorklistTable/doctorWorklistTable.jsx`

Same pattern as WorklistTable.jsx

---

### F. Update verifierWorklistTable.jsx
- [ ] Import getDefaultColumnsForRole
- [ ] Implement column filtering
- [ ] Test with verifier role

**Location:** `client/src/components/common/WorklistTable/verifierWorklistTable.jsx`

Same pattern as WorklistTable.jsx

---

## 🔄 Phase 4: Backend Integration (PENDING)

### A. Update admin.routes.js
- [ ] Update POST /create-user endpoint
- [ ] Update PUT /update-user/:id endpoint
- [ ] Add validation for new fields
- [ ] Handle linkedLabs population

**Location:** `backend/routes/admin.routes.js`

**Code to add:**
```javascript
router.post('/create-user', authMiddleware, async (req, res) => {
  try {
    const {
      username, email, password, fullName,
      role, accountTypes, visibleColumns, linkedLabs
    } = req.body;
    
    const newUser = new User({
      // ... existing fields
      role: role || (accountTypes && accountTypes[0]),
      accountTypes: accountTypes || [role],
      visibleColumns: visibleColumns || getDefaultColumnsForRole(role),
      linkedLabs: linkedLabs?.map(labId => ({
        labId,
        isActive: true,
        labPermissions: {
          canViewStudies: true,
          canAssignStudies: role === 'assignor',
          canEditStudies: false
        }
      }))
    });
    
    await newUser.save();
    res.json({ success: true, user: newUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

---

### B. Update doctor.routes.js
- [ ] Add lab filtering to study queries
- [ ] Test with users linked to specific labs

**Location:** `backend/routes/doctor.routes.js`

**Code to add:**
```javascript
router.get('/studies', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    let query = {
      organizationIdentifier: user.organizationIdentifier,
      'assignment.assignedTo': user._id
    };
    
    // Add lab filtering
    if (user.linkedLabs && user.linkedLabs.length > 0) {
      const activeLabIds = user.linkedLabs
        .filter(ll => ll.isActive)
        .map(ll => ll.labId);
      
      if (activeLabIds.length > 0) {
        query.lab = { $in: activeLabIds };
      }
    }
    
    const studies = await DicomStudy.find(query)...
  }
});
```

---

### C. Update assignor.routes.js
- [ ] Add lab filtering to study queries
- [ ] Test with users linked to specific labs

**Location:** `backend/routes/assignor.routes.js`

Same pattern as doctor.routes.js

---

### D. Update verifier.routes.js
- [ ] Add lab filtering to study queries
- [ ] Test with users linked to specific labs

**Location:** `backend/routes/verifier.routes.js`

Same pattern as doctor.routes.js

---

### E. Update authMiddleware.js
- [ ] Add combined permission calculation
- [ ] Handle multi-role users
- [ ] Attach all permissions to req.user

**Location:** `backend/middleware/authMiddleware.js`

**Code to add:**
```javascript
// After user is loaded
if (user.accountTypes && user.accountTypes.length > 1) {
  // Combine permissions from all roles
  const combinedPermissions = {};
  user.accountTypes.forEach(roleType => {
    const roleUser = { role: roleType };
    roleUser.setPermissionsByRole();
    Object.assign(combinedPermissions, roleUser.permissions);
  });
  req.user.permissions = combinedPermissions;
} else {
  req.user.permissions = user.permissions;
}
```

---

## 🧪 Phase 5: Testing (PENDING)

### Feature 1: Column-based Restriction
- [ ] Create user with 5 columns selected
- [ ] Login and verify only 5 columns show
- [ ] Edit user to add more columns
- [ ] Verify changes persist
- [ ] Test "always visible" columns (actions, selection)
- [ ] Test default columns for new users

### Feature 2: Multi-Account Setup
- [ ] Create user with single role
- [ ] Create user with multiple roles (radiologist + verifier)
- [ ] Login and verify combined permissions
- [ ] Test role switching
- [ ] Test primary role dashboard
- [ ] Test conflicting roles prevention
- [ ] Verify permission inheritance

### Feature 3: Lab/Center Linking
- [ ] Create 3 labs (Lab A, Lab B, Lab C)
- [ ] Create user linked to Lab A and Lab C only
- [ ] Create studies in all 3 labs
- [ ] Login and verify only Lab A & C studies show
- [ ] Test lab search functionality
- [ ] Test active/inactive lab filtering
- [ ] Verify lab permissions work

### Combined Testing
- [ ] User with all 3 features enabled
- [ ] Multiple roles + custom columns + lab linking
- [ ] Verify no feature conflicts
- [ ] Test performance with large datasets
- [ ] Test with different browsers
- [ ] Mobile responsiveness check

---

## 📊 Phase 6: Performance Testing (PENDING)

- [ ] Test with 1000+ studies
- [ ] Test with 50+ labs
- [ ] Test with 100+ users
- [ ] Check database query performance
- [ ] Monitor frontend rendering time
- [ ] Check memory usage
- [ ] Optimize slow queries if needed

---

## 📝 Phase 7: Documentation Updates (PENDING)

- [ ] Update API documentation
- [ ] Create user training guide
- [ ] Create admin guide
- [ ] Record demo videos
- [ ] Update help center articles
- [ ] Create FAQ document

---

## 🚀 Phase 8: Deployment (PENDING)

### Pre-deployment
- [ ] All tests passing
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Backup current database
- [ ] Prepare rollback plan

### Deployment
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Run database migrations (if any)
- [ ] Verify deployment in staging
- [ ] Monitor error logs
- [ ] Test key user flows

### Post-deployment
- [ ] Monitor system performance
- [ ] Check error rates
- [ ] Gather user feedback
- [ ] Fix any bugs reported
- [ ] Update changelog

---

## 🎯 Success Criteria

- [ ] Users can customize visible columns
- [ ] Users can have multiple roles
- [ ] Users are restricted to linked labs
- [ ] No performance degradation
- [ ] No security vulnerabilities
- [ ] User satisfaction score > 8/10
- [ ] All tests passing
- [ ] Documentation complete

---

## 📞 Support Contacts

**For Technical Issues:**
- Check QUICK_REFERENCE.md first
- Review IMPLEMENTATION_GUIDE.md
- Contact: [Your Team Email]

**For Questions:**
- See FEATURES_SUMMARY.md
- Check ARCHITECTURE_DIAGRAM.md
- [Your Documentation Link]

---

## 🎉 Completion Status

**Overall Progress: 40%**

- ✅ Backend Models: 100% (1/1)
- ✅ Frontend Components: 100% (4/4)
- ✅ Documentation: 100% (4/4)
- ⏳ Frontend Integration: 0% (0/6)
- ⏳ Backend Integration: 0% (0/5)
- ⏳ Testing: 0%
- ⏳ Documentation Updates: 0%
- ⏳ Deployment: 0%

**Next Steps:**
1. Start with CreateDoctor.jsx integration
2. Test thoroughly
3. Move to CreateLab.jsx
4. Then UserManagement.jsx
5. Then worklist tables
6. Then backend routes

---

**Last Updated:** December 29, 2025
**Version:** 1.0

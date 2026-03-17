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
  'dashboard_viewer': 10,
  'lab_staff': 10,
  'doctor_account': 10,
  'owner': 10
};

// ✅ DETERMINE PRIMARY ROLE FROM ACCOUNT ROLES
export const determinePrimaryRole = (accountRoles = []) => {
  if (!accountRoles || accountRoles.length === 0) return null;
  if (accountRoles.length === 1) return accountRoles[0];
  
  // Sort by hierarchy (highest first)
  return accountRoles.sort((a, b) => {
    return (ROLE_HIERARCHY[b] || 0) - (ROLE_HIERARCHY[a] || 0);
  })[0];
};
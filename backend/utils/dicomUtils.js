// ========================================
// FILE: backend/utils/dicomUtils.js
// ========================================

export const generateUID = () => {
    const prefix = '1.2.826.0.1.3680043.8.498'; // Your organization root
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `${prefix}.${timestamp}.${random}`;
};
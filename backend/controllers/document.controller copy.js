// backend/controllers/document.controller.js
import { 
    PutObjectCommand, 
    GetObjectCommand, 
    DeleteObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { wasabiS3Client, wasabiConfig } from '../config/wasabi-s3.js';
import Document from '../models/documentModal.js';
import DicomStudy from '../models/dicomStudyModel.js';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import Report from '../models/reportModel.js'; 
// ✅ MULTER CONFIGURATION - Memory storage for S3 upload
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Allowed file types
    const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`File type ${file.mimetype} not allowed. Only images, PDFs, and documents are permitted.`), false);
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// ✅ HELPER: Generate unique S3 key with organization prefix
const generateS3Key = (organizationIdentifier, studyId, fileName) => {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9]/g, '_');
    
    return `${organizationIdentifier}/studies/${studyId}/${timestamp}_${randomString}_${baseName}${ext}`;
};

// ✅ 1. UPLOAD DOCUMENT TO STUDY
export const uploadDocument = async (req, res) => {
    try {
        const { studyId } = req.params;
        const { documentType = 'other' } = req.body;
        const user = req.user;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Verify study exists and user has access
        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: user.organizationIdentifier
        });

        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found or access denied'
            });
        }

        // Generate S3 key
        const s3Key = generateS3Key(
            user.organizationIdentifier,
            studyId,
            req.file.originalname
        );

        console.log(`📤 Uploading document to Wasabi: ${s3Key}`);

        // Upload to Wasabi S3
        const uploadCommand = new PutObjectCommand({
            Bucket: wasabiConfig.documentsBucket,
            Key: s3Key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            Metadata: {
                organizationIdentifier: user.organizationIdentifier,
                studyId: studyId.toString(),
                uploadedBy: user._id.toString(),
                originalName: req.file.originalname
            }
        });

        await wasabiS3Client.send(uploadCommand);

        // Create document record in MongoDB
        const document = new Document({
            organization: user.organization,
            organizationIdentifier: user.organizationIdentifier,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            contentType: req.file.mimetype,
            documentType,
            wasabiKey: s3Key,
            wasabiBucket: wasabiConfig.documentsBucket,
            patientId: study.patientInfo?.patientID,
            studyId: study._id,
            uploadedBy: user._id
        });

        await document.save();

        // Update study with attachment reference
        if (!study.attachments) {
            study.attachments = [];
        }

        study.attachments.push({
            documentId: document._id,
            fileName: document.fileName,
            fileSize: document.fileSize,
            contentType: document.contentType,
            uploadedAt: document.uploadedAt,
            uploadedBy: user._id
        });

        // ✅ UPDATE hasAttachments FLAG
        study.hasAttachments = true;

        // Initialize activityLog if it doesn't exist
        if (!study.activityLog) {
            study.activityLog = [];
        }

        // Log activity
        study.activityLog.push({
            action: 'ATTACHMENT_ADDED',
            performedBy: user._id,
            timestamp: new Date(),
            details: {
                fileName: document.fileName,
                fileSize: document.fileSize,
                documentId: document._id
            }
        });

        // Save once with both updates
        await study.save();

        console.log(`✅ Document uploaded successfully: ${document._id}`);

        // await study.save();

        // Log activity
        study.activityLog.push({
            action: 'ATTACHMENT_ADDED',
            performedBy: user._id,
            timestamp: new Date(),
            details: {
                fileName: document.fileName,
                fileSize: document.fileSize,
                documentId: document._id
            }
        });

        await study.save();

        console.log(`✅ Document uploaded successfully: ${document._id}`);

        res.status(201).json({
            success: true,
            message: 'Document uploaded successfully',
            data: {
                documentId: document._id,
                fileName: document.fileName,
                fileSize: document.fileSize,
                contentType: document.contentType,
                documentType: document.documentType,
                uploadedAt: document.uploadedAt
            }
        });

    } catch (error) {
        console.error('❌ Error uploading document:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload document',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ 2. GET DOCUMENTS FOR STUDY
export const getStudyDocuments = async (req, res) => {
    try {
        const { studyId } = req.params;
        const user = req.user;

        // Verify access
        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: user.organizationIdentifier
        });

        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found or access denied'
            });
        }

        // Get all documents for this study
        const documents = await Document.find({
            studyId,
            organizationIdentifier: user.organizationIdentifier,
            isActive: true
        })
        .populate('uploadedBy', 'fullName email')
        .sort({ uploadedAt: -1 })
        .lean();

        res.json({
            success: true,
            count: documents.length,
            data: documents
        });

    } catch (error) {
        console.error('❌ Error fetching documents:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch documents',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ 3. GET PRESIGNED URL FOR DOCUMENT DOWNLOAD/PREVIEW
export const getDocumentUrl = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { action = 'view' } = req.query; // 'view' or 'download'
        const user = req.user;

        // Get document
        const document = await Document.findOne({
            _id: documentId,
            organizationIdentifier: user.organizationIdentifier,
            isActive: true
        });

        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Document not found or access denied'
            });
        }

        // Generate presigned URL (valid for 1 hour)
        const command = new GetObjectCommand({
            Bucket: document.wasabiBucket,
            Key: document.wasabiKey,
            ResponseContentDisposition: action === 'download' 
                ? `attachment; filename="${document.fileName}"`
                : 'inline'
        });

        const presignedUrl = await getSignedUrl(wasabiS3Client, command, {
            expiresIn: 3600 // 1 hour
        });

        res.json({
            success: true,
            data: {
                url: presignedUrl,
                fileName: document.fileName,
                contentType: document.contentType,
                expiresIn: 3600
            }
        });

    } catch (error) {
        console.error('❌ Error generating presigned URL:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate document URL',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ 4. DELETE DOCUMENT
export const deleteDocument = async (req, res) => {
    try {
        const { documentId } = req.params;
        const user = req.user;

        // Get document
        const document = await Document.findOne({
            _id: documentId,
            organizationIdentifier: user.organizationIdentifier
        });

        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Document not found or access denied'
            });
        }

        // Check permissions (only uploader, admin, or super_admin can delete)
        if (
            document.uploadedBy.toString() !== user._id.toString() &&
            !['admin', 'super_admin'].includes(user.role)
        ) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to delete this document'
            });
        }

        // Delete from Wasabi S3
        const deleteCommand = new DeleteObjectCommand({
            Bucket: document.wasabiBucket,
            Key: document.wasabiKey
        });

        await wasabiS3Client.send(deleteCommand);

        // Mark as inactive (soft delete)
        document.isActive = false;
        await document.save();

        // Remove from study attachments
        if (document.studyId) {
            const study = await DicomStudy.findById(document.studyId);
            
            if (study) {
                // Remove attachment from array
                study.attachments = study.attachments.filter(
                    att => att.documentId.toString() !== document._id.toString()
                );
                
                // ✅ UPDATE hasAttachments FLAG
                study.hasAttachments = study.attachments.length > 0;
                
                // Log activity
                if (!study.activityLog) {
                    study.activityLog = [];
                }
                
                study.activityLog.push({
                    action: 'ATTACHMENT_DELETED',
                    performedBy: user._id,
                    timestamp: new Date(),
                    details: {
                        fileName: document.fileName,
                        documentId: document._id
                    }
                });
                
                await study.save();
            }
        }

        console.log(`✅ Document deleted: ${documentId}`);

        res.json({
            success: true,
            message: 'Document deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting document:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete document',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ 5. GET DOCUMENT METADATA
export const getDocumentMetadata = async (req, res) => {
    try {
        const { documentId } = req.params;
        const user = req.user;

        const document = await Document.findOne({
            _id: documentId,
            organizationIdentifier: user.organizationIdentifier,
            isActive: true
        })
        .populate('uploadedBy', 'fullName email role')
        .populate('studyId', 'bharatPacsId patientInfo.patientName')
        .lean();

        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        res.json({
            success: true,
            data: document
        });

    } catch (error) {
        console.error('❌ Error fetching document metadata:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch document metadata',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    upload,
    uploadDocument,
    getStudyDocuments,
    getDocumentUrl,
    deleteDocument,
    getDocumentMetadata
};
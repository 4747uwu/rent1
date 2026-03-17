import express from 'express';
import axios from 'axios';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import websocketService from '../config/webSocket.js';
// 🔧 FIXED: Import the correct service name
import CloudflareR2ZipService from '../services/wasabi.zip.service.js';
import { recordStudyAction, updateCategoryTracking, ACTION_TYPES } from '../utils/RecordAction.js';

// Import Mongoose Models
import DicomStudy from '../models/dicomStudyModel.js';
import Patient from '../models/patientModel.js';
import Lab from '../models/labModel.js';
import Organization from '../models/organisation.js';

const router = express.Router();

// --- Configuration ---
// const ORTHANC_BASE_URL = 'http://localhost:8045';
const ORTHANC_BASE_URL = 'http://orthanc-server:8042';

const ORTHANC_USERNAME = process.env.ORTHANC_USERNAME || 'alice';
const ORTHANC_PASSWORD = process.env.ORTHANC_PASSWORD || 'alicePassword';
const orthancAuth = 'Basic ' + Buffer.from(ORTHANC_USERNAME + ':' + ORTHANC_PASSWORD).toString('base64');

// --- Redis Setup ---
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  tls: {},
  lazyConnect: true,
});

// --- Simple Job Queue for Stable Studies ---
class StableStudyQueue {
  constructor() {
    this.jobs = new Map();
    this.processing = new Set();
    this.nextJobId = 1;
    this.isProcessing = false;
    this.concurrency = 10; // Process max 10 stable studies simultaneously
  }

  async add(jobData) {
    const jobId = this.nextJobId++;
    const job = {
      id: jobId,
      type: 'process-stable-study',
      data: jobData,
      status: 'waiting',
      createdAt: new Date(),
      progress: 0,
      result: null,
      error: null
    };
    
    this.jobs.set(jobId, job);
    console.log(`📝 Stable Study Job ${jobId} queued`);
    
    if (!this.isProcessing) {
      this.startProcessing();
    }
    
    return job;
  }

  async startProcessing() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    console.log('🚀 Stable Study Queue processor started');
    
    while (this.getWaitingJobs().length > 0 || this.processing.size > 0) {
      while (this.processing.size < this.concurrency && this.getWaitingJobs().length > 0) {
        const waitingJobs = this.getWaitingJobs();
        if (waitingJobs.length > 0) {
          const job = waitingJobs[0];
          this.processJob(job);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.isProcessing = false;
    console.log('⏹️ Stable Study Queue processor stopped');
  }

  async processJob(job) {
    this.processing.add(job.id);
    job.status = 'active';
    
    console.log(`🚀 Processing Stable Study Job ${job.id}`);
    
    try {
      job.result = await processStableStudy(job);
      job.status = 'completed';
      console.log(`✅ Stable Study Job ${job.id} completed successfully`);
      
    } catch (error) {
      job.error = error.message;
      job.status = 'failed';
      console.error(`❌ Stable Study Job ${job.id} failed:`, error.message);
      console.error(`❌ Stack:`, error.stack);
    } finally {
      this.processing.delete(job.id);
    }
  }

  getWaitingJobs() {
    return Array.from(this.jobs.values()).filter(job => job.status === 'waiting');
  }

  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  getJobByRequestId(requestId) {
    return Array.from(this.jobs.values()).find(job => job.data.requestId === requestId);
  }
}

const jobQueue = new StableStudyQueue();

// --- Helper Functions ---

function processDicomPersonName(dicomNameField) {
  if (!dicomNameField || typeof dicomNameField !== 'string') {
    return {
      fullName: 'Unknown Patient',
      firstName: '',
      lastName: 'Unknown',
      middleName: '',
      namePrefix: '',
      nameSuffix: '',
      originalDicomFormat: dicomNameField || '',
      formattedForDisplay: 'Unknown Patient'
    };
  }

  const nameString = dicomNameField.trim();
  
  // Handle empty or whitespace-only names
  if (nameString === '' || nameString === '^' || nameString === '^^^') {
    return {
      fullName: 'Anonymous Patient',
      firstName: '',
      lastName: 'Anonymous',
      middleName: '',
      namePrefix: '',
      nameSuffix: '',
      originalDicomFormat: nameString,
      formattedForDisplay: 'Anonymous Patient'
    };
  }

  // Split by ^ (DICOM person name format: Family^Given^Middle^Prefix^Suffix)
  const parts = nameString.split('^');
  const familyName = (parts[0] || '').trim();
  const givenName = (parts[1] || '').trim();
  const middleName = (parts[2] || '').trim();
  const namePrefix = (parts[3] || '').trim();
  const nameSuffix = (parts[4] || '').trim();

  // Create display name
  const nameParts = [];
  if (namePrefix) nameParts.push(namePrefix);
  if (givenName) nameParts.push(givenName);
  if (middleName) nameParts.push(middleName);
  if (familyName) nameParts.push(familyName);
  if (nameSuffix) nameParts.push(nameSuffix);

  const displayName = nameParts.length > 0 ? nameParts.join(' ') : 'Unknown Patient';

  return {
    fullName: displayName,
    firstName: givenName,
    lastName: familyName,
    middleName: middleName,
    namePrefix: namePrefix,
    nameSuffix: nameSuffix,
    originalDicomFormat: nameString,
    formattedForDisplay: displayName
  };
}

// 🔧 ENHANCED: Fix DICOM date parsing
function formatDicomDateToISO(dicomDate) {
  if (!dicomDate || typeof dicomDate !== 'string') return null;
  
  // Handle different DICOM date formats
  let cleanDate = dicomDate.trim();
  
  // Handle YYYYMMDD format (standard DICOM)
  if (cleanDate.length === 8 && /^\d{8}$/.test(cleanDate)) {
    try {
      const year = cleanDate.substring(0, 4);
      const month = cleanDate.substring(4, 6);
      const day = cleanDate.substring(6, 8);
      
      // Validate date components
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      const dayNum = parseInt(day);
      
      if (yearNum >= 1900 && yearNum <= 2100 && monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
        return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
      }
    } catch (error) {
      console.warn('Error parsing DICOM date:', dicomDate, error);
    }
  }
  
  // Handle other formats or return current date as fallback
  try {
    const parsed = new Date(cleanDate);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) {
      return parsed;
    }
  } catch (error) {
    console.warn('Error parsing date:', dicomDate, error);
  }
  
  // Return current date as fallback
  return new Date();
}

// 🆕 NEW: Find or create organization from DICOM tags
async function findOrCreateOrganizationFromTags(tags) {
  const DEFAULT_ORG = {
    name: 'Test Organization',
    identifier: 'TEST_ORG',
    displayName: 'Test Organization',
    companyType: 'hospital',
    status: 'active'
  };

  try {
    // 🎯 CHECK ORGANIZATION TAGS: 0021,0010 and 0043,0010
    const organizationTags = ["0021,0010", "0043,0010"];
    
    console.log(`[Organization] 🏢 Checking organization tags...`);
    console.log(`[Organization] 📋 Available organization tags:`, {
      "0021,0010": tags["0021,0010"] || 'NOT_FOUND',
      "0043,0010": tags["0043,0010"] || 'NOT_FOUND'
    });
    
    for (const tag of organizationTags) {
      const tagValue = tags[tag];
      
      if (tagValue && tagValue.trim() !== '' && tagValue !== 'xcenticlab') {
        const orgIdentifier = tagValue.trim();
        console.log(`[Organization] ✅ Found organization identifier in tag [${tag}]: ${orgIdentifier}`);
        
        try {
          // Direct lookup by identifier field (case insensitive)
          const orgByIdentifier = await Organization.findOne({ 
            identifier: { $regex: new RegExp(`^${escapeRegex(orgIdentifier)}$`, 'i') },
            status: 'active'
          });
          
          if (orgByIdentifier) {
            console.log(`[Organization] ✅ Found organization: ${orgByIdentifier.name} (${orgByIdentifier.identifier})`);
            return orgByIdentifier;
          } else {
            console.warn(`[Organization] ⚠️ No organization found with identifier: ${orgIdentifier}`);
            
            // 🔧 CREATE ORGANIZATION: Auto-create organization if identifier is found but org doesn't exist
            console.log(`[Organization] 🆕 Creating new organization with identifier: ${orgIdentifier}`);
            const newOrg = new Organization({
              name: `${orgIdentifier} Organization`,
              identifier: orgIdentifier.toUpperCase(),
              displayName: `${orgIdentifier} Organization`,
              companyType: 'hospital',
              status: 'active',
              contactInfo: {
                primaryContact: {
                  name: 'System Admin',
                  email: `admin@${orgIdentifier.toLowerCase()}.com`,
                  phone: '',
                  designation: 'Administrator'
                }
              },
              address: {
                street: '',
                city: '',
                state: '',
                zipCode: '',
                country: 'USA'
              },
              subscription: {
                plan: 'basic',
                maxUsers: 10,
                maxStudiesPerMonth: 1000,
                maxStorageGB: 100
              },
              features: {
                aiAnalysis: false,
                advancedReporting: false,
                multiModalitySupport: true,
                cloudStorage: true,
                mobileAccess: true,
                apiAccess: false,
                whiteLabeling: false
              },
              compliance: {
                hipaaCompliant: false,
                dicomCompliant: true,
                hl7Integration: false,
                fda510k: false
              },
              // Use a system user ID or create a default one
              createdBy: new mongoose.Types.ObjectId('000000000000000000000000'), // Default system user
              notes: `Auto-created from DICOM tag [${tag}] with value "${orgIdentifier}" on ${new Date().toISOString()}`
            });
            
            await newOrg.save();
            console.log(`[Organization] ✅ Created new organization: ${newOrg.name} (${newOrg.identifier})`);
            return newOrg;
          }
          
        } catch (orgLookupError) {
          console.error(`[Organization] ❌ Error looking up organization with identifier ${orgIdentifier}:`, orgLookupError.message);
        }
      } else {
        console.log(`[Organization] 📋 Tag [${tag}] is empty or contains default value: ${tagValue || 'EMPTY'}`);
      }
    }
    
    // 🚫 NO ORGANIZATION FOUND - Create/use test organization
    console.warn(`[Organization] ⚠️ No valid organization identifier found in tags [0021,0010], [0043,0010]`);
    
    // Find or create the test organization
    let testOrg = await Organization.findOne({ identifier: DEFAULT_ORG.identifier });
    
    if (!testOrg) {
      console.log(`[Organization] 🆕 Creating test organization: ${DEFAULT_ORG.name}`);
      testOrg = new Organization({
        ...DEFAULT_ORG,
        contactInfo: {
          primaryContact: {
            name: 'Test Admin',
            email: 'admin@testorg.com',
            phone: '+1-555-0000',
            designation: 'System Administrator'
          }
        },
        address: {
          street: '123 Test Street',
          city: 'Test City',
          state: 'Test State',
          zipCode: '12345',
          country: 'USA'
        },
        subscription: {
          plan: 'basic',
          maxUsers: 10,
          maxStudiesPerMonth: 1000,
          maxStorageGB: 100
        },
        features: {
          aiAnalysis: false,
          advancedReporting: false,
          multiModalitySupport: true,
          cloudStorage: true,
          mobileAccess: true,
          apiAccess: false,
          whiteLabeling: false
        },
        compliance: {
          hipaaCompliant: false,
          dicomCompliant: true,
          hl7Integration: false,
          fda510k: false
        },
        createdBy: new mongoose.Types.ObjectId('000000000000000000000000'), // Default system user
        notes: `Test organization created because no valid organization identifier was found in DICOM tags [0021,0010], [0043,0010]. Created on ${new Date().toISOString()}`
      });
      await testOrg.save();
    }

    console.log(`[Organization] 🔄 Using test organization: ${testOrg.name}`);
    return testOrg;

  } catch (error) {
    console.error('❌ Error in findOrCreateOrganizationFromTags:', error);
    
    // Emergency fallback - find any active organization
    let emergencyOrg = await Organization.findOne({ status: 'active' });
    if (!emergencyOrg) {
      emergencyOrg = new Organization({
        name: 'Emergency Default Organization',
        identifier: 'EMERGENCY_DEFAULT',
        displayName: 'Emergency Default Organization',
        companyType: 'hospital',
        status: 'active',
        contactInfo: {
          primaryContact: {
            name: 'Emergency Admin',
            email: 'admin@emergency.com',
            phone: '+1-555-0000',
            designation: 'Emergency Administrator'
          }
        },
        subscription: {
          plan: 'basic',
          maxUsers: 10,
          maxStudiesPerMonth: 1000,
          maxStorageGB: 100
        },
        createdBy: new mongoose.Types.ObjectId('000000000000000000000000'), // Default system user
        notes: `Emergency organization created due to system error. Created on ${new Date().toISOString()}`
      });
      await emergencyOrg.save();
    }
    
    console.log(`[Organization] 🚨 Using emergency organization: ${emergencyOrg.name}`);
    return emergencyOrg;
  }
}

// 🔧 UPDATED: Modified to work with organization context
async function findOrCreatePatientFromTags(tags, organization) {
  const patientIdDicom = tags.PatientID;
  const nameInfo = processDicomPersonName(tags.PatientName);
  const patientSex = tags.PatientSex;
  const patientBirthDate = tags.PatientBirthDate;

  if (!patientIdDicom && !nameInfo.fullName) {
    let unknownPatient = await Patient.findOne({ 
      mrn: 'UNKNOWN_STABLE_STUDY',
      organization: organization._id 
    });
    
    if (!unknownPatient) {
      unknownPatient = await Patient.create({
        organization: organization._id,
        organizationIdentifier: organization.identifier,
        mrn: 'UNKNOWN_STABLE_STUDY',
        patientID: 'UNKNOWN_PATIENT',
        patientNameRaw: 'Unknown Patient (Stable Study)',
        firstName: '',
        lastName: '',
        gender: patientSex || '',
        dateOfBirth: patientBirthDate || '',
        isAnonymous: true
      });
    }
    return unknownPatient;
  }

  // Look for patient within organization scope
  let patient = await Patient.findOne({ 
    mrn: patientIdDicom,
    organization: organization._id 
  });

  // If patient exists but name doesn't match, create a new unique patient
  if (patient && patient.patientNameRaw && nameInfo.formattedForDisplay) {
    const existingName = patient.patientNameRaw.trim().toUpperCase();
    const newName = nameInfo.formattedForDisplay.trim().toUpperCase();
    
    if (existingName !== newName) {
      console.log(`⚠️ Patient MRN collision detected!`);
      console.log(`   - MRN: ${patientIdDicom}`);
      console.log(`   - Existing: ${patient.patientNameRaw}`);
      console.log(`   - New Study: ${nameInfo.formattedForDisplay}`);
      console.log(`   - Creating separate patient record with modified MRN`);
      
      // Create new patient with modified MRN to avoid collision
      patient = null; // Force creation of new patient below
      patientIdDicom = `${patientIdDicom}_${nameInfo.lastName || Date.now()}`;
    }
  }

  if (!patient) {
    patient = new Patient({
      organization: organization._id,
      organizationIdentifier: organization.identifier,
      mrn: patientIdDicom || `ANON_${Date.now()}`,
      patientID: patientIdDicom || `ANON_${Date.now()}`,
      patientNameRaw: nameInfo.formattedForDisplay,
      firstName: nameInfo.firstName,
      lastName: nameInfo.lastName,
      ageString: tags.PatientAge || 'N/A',  
      computed: {
        fullName: nameInfo.formattedForDisplay,
        namePrefix: nameInfo.namePrefix,
        nameSuffix: nameInfo.nameSuffix,
        originalDicomName: nameInfo.originalDicomFormat
      },
      gender: patientSex || '',
      dateOfBirth: patientBirthDate ? formatDicomDateToISO(patientBirthDate) : ''
    });
    
    await patient.save();
    console.log(`👤 Created patient in ${organization.name}: ${nameInfo.formattedForDisplay} (${patientIdDicom})`);
  } else {
    // Update existing patient if name format has improved
    if (patient.patientNameRaw && patient.patientNameRaw.includes('^') && nameInfo.formattedForDisplay && !nameInfo.formattedForDisplay.includes('^')) {
      console.log(`🔄 Updating patient name format from "${patient.patientNameRaw}" to "${nameInfo.formattedForDisplay}"`);
      
      patient.patientNameRaw = nameInfo.formattedForDisplay;
      patient.firstName = nameInfo.firstName;
      patient.lastName = nameInfo.lastName;
      
      if (!patient.computed) patient.computed = {};
      patient.computed.fullName = nameInfo.formattedForDisplay;
      patient.computed.originalDicomName = nameInfo.originalDicomFormat;
      
      await patient.save();
    }
  }
  
  return patient;
}

// 🔧 UPDATED: Modified to work with organization context  
async function findOrCreateSourceLab(tags, organization) {
  const DEFAULT_LAB = {
    name: 'Unknown Lab (No Identifier Found)',
    identifier: 'UNKNOWN_LAB',
    isActive: true,
  };

  try {
    // 🎯 CHECK LAB TAGS: 0013,0010 and 0015,0010 (separated from org tags)
    const labTags = ["0013,0010", "0015,0010"];
    
    console.log(`[Lab] 🔬 Checking lab tags for organization ${organization.name}...`);
    console.log(`[Lab] 📋 Available lab tags:`, {
      "0013,0010": tags["0013,0010"] || 'NOT_FOUND',
      "0015,0010": tags["0015,0010"] || 'NOT_FOUND'
    });
    
    for (const tag of labTags) {
      if (tags[tag] && tags[tag].trim() !== '') {
        const labIdentifierFromTag = tags[tag].trim().toUpperCase();
        
        console.log(`[Lab] 🔍 Found lab identifier in tag ${tag}: ${labIdentifierFromTag}`);
        
        let lab = await Lab.findOne({ 
          identifier: labIdentifierFromTag,
          organization: organization._id 
        });
        
        if (lab) {
          console.log(`[Lab] ✅ Found existing lab: ${lab.name} (${lab.identifier})`);
          
          // ✅ Extract lab location from lab's address field in database
          let labLocation = '';
          
          if (lab.address) {
            const addressParts = [];
            if (lab.address.street) addressParts.push(lab.address.street);
            if (lab.address.city) addressParts.push(lab.address.city);
            if (lab.address.state) addressParts.push(lab.address.state);
            if (lab.address.zipCode) addressParts.push(lab.address.zipCode);
            if (lab.address.country) addressParts.push(lab.address.country);
            
            labLocation = addressParts.filter(part => part && part.trim() !== '').join(', ');
          }
          
          if (labLocation) {
            console.log(`[Lab] 📍 Lab location from DB: ${labLocation}`);
          } else {
            console.log(`[Lab] ⚠️ No address information available in lab database record`);
          }
          
          return { lab, labLocation };
        }
        
        // Create new lab if not found
        lab = new Lab({
          organization: organization._id,
          organizationIdentifier: organization.identifier,
          name: `${labIdentifierFromTag} Laboratory`,
          identifier: labIdentifierFromTag,
          isActive: true
        });
        
        await lab.save();
        console.log(`[Lab] ✨ Created new lab: ${lab.name} (${lab.identifier})`);
        console.log(`[Lab] 📍 New lab has no address yet`);
        
        return { lab, labLocation: '' };
      }
    }
    
    // 🚫 NO LAB FOUND - Use unknown lab within organization
    console.warn(`[Lab] ⚠️ No valid lab identifier found in lab tags [0013,0010], [0015,0010]`);
    
    let unknownLab = await Lab.findOne({ 
      identifier: DEFAULT_LAB.identifier,
      organization: organization._id 
    });
    
    if (!unknownLab) {
      unknownLab = new Lab({
        organization: organization._id,
        organizationIdentifier: organization.identifier,
        ...DEFAULT_LAB
      });
      await unknownLab.save();
    }
    
    // Extract location from unknown lab if available
    let unknownLabLocation = '';
    if (unknownLab.address) {
      const addressParts = [];
      if (unknownLab.address.street) addressParts.push(unknownLab.address.street);
      if (unknownLab.address.city) addressParts.push(unknownLab.address.city);
      if (unknownLab.address.state) addressParts.push(unknownLab.address.state);
      if (unknownLab.address.zipCode) addressParts.push(unknownLab.address.zipCode);
      if (unknownLab.address.country) addressParts.push(unknownLab.address.country);
      
      unknownLabLocation = addressParts.filter(part => part && part.trim() !== '').join(', ');
    }

    console.log(`[Lab] 🔄 Using unknown lab in ${organization.name}: ${unknownLab.name}`);
    console.log(`[Lab] 📍 Unknown lab location: ${unknownLabLocation || 'Not available'}`);
    
    return { lab: unknownLab, labLocation: unknownLabLocation };

  } catch (error) {
    console.error('❌ Error in findOrCreateSourceLab:', error);
    
    let emergencyLab = await Lab.findOne({ 
      organization: organization._id,
      isActive: true 
    });
    
    if (!emergencyLab) {
      emergencyLab = new Lab({
        organization: organization._id,
        organizationIdentifier: organization.identifier,
        ...DEFAULT_LAB
      });
      await emergencyLab.save();
    }
    
    // Extract location from emergency lab if available
    let emergencyLabLocation = '';
    if (emergencyLab.address) {
      const addressParts = [];
      if (emergencyLab.address.street) addressParts.push(emergencyLab.address.street);
      if (emergencyLab.address.city) addressParts.push(emergencyLab.address.city);
      if (emergencyLab.address.state) addressParts.push(emergencyLab.address.state);
      if (emergencyLab.address.zipCode) addressParts.push(emergencyLab.address.zipCode);
      if (emergencyLab.address.country) addressParts.push(emergencyLab.address.country);
      
      emergencyLabLocation = addressParts.filter(part => part && part.trim() !== '').join(', ');
    }
    
    console.log(`[Lab] 🚨 Using emergency lab in ${organization.name}: ${emergencyLab.name}`);
    console.log(`[Lab] 📍 Emergency lab location: ${emergencyLabLocation || 'Not available'}`);
    
    return { lab: emergencyLab, labLocation: emergencyLabLocation };
  }
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- Main Processing Function ---
async function processStableStudy(job) {
  const { orthancStudyId, requestId } = job.data;
  const startTime = Date.now();
  
  try {
    console.log(`[StableStudy] 🚀 Processing stable study: ${orthancStudyId}`);
    job.progress = 10;
    
    // 🔧 STEP 1: Get study-level info to extract StudyInstanceUID
    const studyInfoUrl = `${ORTHANC_BASE_URL}/studies/${orthancStudyId}`;
    console.log(`[StableStudy] 🌐 Fetching study info from: ${studyInfoUrl}`);
    
    const studyInfoResponse = await axios.get(studyInfoUrl, {
      headers: { 'Authorization': orthancAuth },
      timeout: 10000
    });
    
    const studyInfo = studyInfoResponse.data;
    const studyInstanceUID = studyInfo.MainDicomTags?.StudyInstanceUID || orthancStudyId;
    
    console.log(`[StableStudy] 📊 Study Instance UID: ${studyInstanceUID}`);
    
    job.progress = 20;
    
    // 🔧 STEP 2: Get series info
    const seriesUrl = `${ORTHANC_BASE_URL}/studies/${orthancStudyId}/series`;
    console.log(`[StableStudy] 🌐 Fetching series from: ${seriesUrl}`);
    
    const seriesResponse = await axios.get(seriesUrl, {
      headers: { 'Authorization': orthancAuth },
      timeout: 10000
    });
    
    const allSeries = seriesResponse.data;
    console.log(`[StableStudy] 📊 Found ${allSeries.length} series`);
    
    job.progress = 30;
    
    // 🔧 OPTIMIZED: Extract modalities and counts from series data
    const modalitiesSet = new Set();
    let totalInstances = 0;
    let firstInstanceId = null;
    
    // Process all series to get modalities and instance counts
    for (const series of allSeries) {
      const seriesModality = series.MainDicomTags?.Modality;
      if (seriesModality) {
        modalitiesSet.add(seriesModality);
      }
      
      const instanceCount = series.Instances?.length || 0;
      totalInstances += instanceCount;
      
      if (!firstInstanceId && series.Instances && series.Instances.length > 0) {
        firstInstanceId = series.Instances[0];
      }
    }
    
    console.log(`[StableStudy] 📊 Optimized counts - Series: ${allSeries.length}, Total Instances: ${totalInstances}`);
    console.log(`[StableStudy] 📊 Modalities found: ${Array.from(modalitiesSet).join(', ')}`);
    
    job.progress = 50;
    
    // 🔧 OPTIMIZED: Single API call to get tags from first instance only
    let tags = {};
    
    if (firstInstanceId) {
      console.log(`[StableStudy] 🔍 Getting tags from single instance: ${firstInstanceId}`);
      
      try {
        const metadataUrl = `${ORTHANC_BASE_URL}/instances/${firstInstanceId}/tags`;
        const metadataResponse = await axios.get(metadataUrl, {
          headers: { 'Authorization': orthancAuth },
          timeout: 8000
        });
        
        const rawTags = metadataResponse.data;
        
        // 🔧 OPTIMIZED: Extract all necessary tags in one pass
        tags = {};
        for (const [tagKey, tagData] of Object.entries(rawTags)) {
          if (tagData && typeof tagData === 'object' && tagData.Value !== undefined) {
            tags[tagKey] = tagData.Value;
          } else if (typeof tagData === 'string') {
            tags[tagKey] = tagData;
          }
        }
        
        // Map common DICOM fields
        tags.PatientName = rawTags["0010,0010"]?.Value || tags.PatientName;
        tags.PatientID = rawTags["0010,0020"]?.Value || tags.PatientID;
        tags.PatientSex = rawTags["0010,0040"]?.Value || tags.PatientSex;
        tags.PatientBirthDate = rawTags["0010,0030"]?.Value || tags.PatientBirthDate;
        tags.PatientAge = rawTags["0010,1010"]?.Value || tags.PatientAge; 
        tags.StudyDescription = rawTags["0008,1030"]?.Value || tags.StudyDescription;
        tags.StudyDate = rawTags["0008,0020"]?.Value || tags.StudyDate;
        tags.StudyTime = rawTags["0008,0030"]?.Value || tags.StudyTime;
        tags.AccessionNumber = rawTags["0008,0050"]?.Value || tags.AccessionNumber;
        tags.InstitutionName = rawTags["0008,0080"]?.Value || tags.InstitutionName;
        tags.ReferringPhysicianName = rawTags["0008,0090"]?.Value || tags.ReferringPhysicianName;
        
        // 🔧 CRITICAL: Extract private tags for organization and lab identification  
        tags["0013,0010"] = rawTags["0013,0010"]?.Value || null; // Lab identifier
        tags["0015,0010"] = rawTags["0015,0010"]?.Value || null; // Lab identifier
        tags["0021,0010"] = rawTags["0021,0010"]?.Value || null; // Organization identifier
        tags["0043,0010"] = rawTags["0043,0010"]?.Value || null; // Organization identifier
        
        console.log(`[StableStudy] ✅ Got tags from single instance:`, {
          PatientName: tags.PatientName,
          PatientID: tags.PatientID,
          StudyDescription: tags.StudyDescription,
          LabTags: {
            "0013,0010": tags["0013,0010"],
            "0015,0010": tags["0015,0010"]
          },
          OrganizationTags: {
            "0021,0010": tags["0021,0010"],
            "0043,0010": tags["0043,0010"]
          }
        });
        
      } catch (metadataError) {
        console.warn(`[StableStudy] ⚠️ Could not get instance metadata:`, metadataError.message);
        
        // 🔧 FALLBACK: Try simplified-tags if /tags fails
        try {
          const simplifiedUrl = `${ORTHANC_BASE_URL}/instances/${firstInstanceId}/simplified-tags`;
          const simplifiedResponse = await axios.get(simplifiedUrl, {
            headers: { 'Authorization': orthancAuth },
            timeout: 8000
          });
          
          tags = { ...simplifiedResponse.data };
          console.log(`[StableStudy] ✅ Got simplified metadata as fallback`);
        } catch (simplifiedError) {
          console.warn(`[StableStudy] ⚠️ Simplified tags also failed:`, simplifiedError.message);
        }
      }
    } else {
      console.warn(`[StableStudy] ⚠️ No instances found in any series, using empty tags`);
      tags = {};
    }
    
    // Fallback for empty modalities
    if (modalitiesSet.size === 0) {
      modalitiesSet.add(tags.Modality || 'OT');
    }
    
    job.progress = 60;
    
    // 🆕 STEP 2.5: Check if study already exists in database
    console.log(`[StableStudy] 🔍 Checking if study already exists with StudyInstanceUID: ${studyInstanceUID}`);
    const existingStudy = await DicomStudy.findOne({ studyInstanceUID: studyInstanceUID });
    
    let organizationRecord, patientRecord, labRecord, labLocation;
    let preservedFields = {};
    
    if (existingStudy) {
      console.log(`[StableStudy] ✅ Found existing study in database: ${existingStudy._id}`);
      console.log(`[StableStudy] 🔒 Preserving critical fields:`);
      console.log(`  - Organization: ${existingStudy.organizationIdentifier}`);
      console.log(`  - Source Lab: ${existingStudy.sourceLab}`);
      console.log(`  - Identifier: ${existingStudy.identifier}`);
      
      // Preserve critical fields from existing study
      preservedFields = {
        organization: existingStudy.organization,
        organizationIdentifier: existingStudy.organizationIdentifier,
        sourceLab: existingStudy.sourceLab,
        identifier: existingStudy.identifier
      };
      
      // Load the preserved organization and lab
      organizationRecord = await Organization.findById(existingStudy.organization);
      if (!organizationRecord) {
        console.warn(`[StableStudy] ⚠️ Preserved organization not found, extracting from DICOM`);
        organizationRecord = await findOrCreateOrganizationFromTags(tags);
        preservedFields.organization = organizationRecord._id;
        preservedFields.organizationIdentifier = organizationRecord.identifier;
      }
      
      labRecord = await Lab.findById(existingStudy.sourceLab);
      if (!labRecord) {
        console.warn(`[StableStudy] ⚠️ Preserved lab not found, extracting from DICOM`);
        const labResult = await findOrCreateSourceLab(tags, organizationRecord);
        labRecord = labResult.lab;
        labLocation = labResult.labLocation;
        preservedFields.sourceLab = labRecord._id;
      } else {
        // Extract location from preserved lab
        labLocation = '';
        if (labRecord.address) {
          const addressParts = [];
          if (labRecord.address.street) addressParts.push(labRecord.address.street);
          if (labRecord.address.city) addressParts.push(labRecord.address.city);
          if (labRecord.address.state) addressParts.push(labRecord.address.state);
          if (labRecord.address.zipCode) addressParts.push(labRecord.address.zipCode);
          if (labRecord.address.country) addressParts.push(labRecord.address.country);
          labLocation = addressParts.join(', ');
        }
      }
      
      // Get patient from existing study or create new
      patientRecord = await Patient.findById(existingStudy.patient);
      if (!patientRecord) {
        console.warn(`[StableStudy] ⚠️ Patient not found, creating from DICOM tags`);
        patientRecord = await findOrCreatePatientFromTags(tags, organizationRecord);
      }
      
    } else {
      console.log(`[StableStudy] 🆕 New study - extracting organization, patient, and lab from DICOM tags`);
      
      // NEW STUDY: Find or create organization FIRST
      console.log(`[StableStudy] 🏢 Finding/creating organization from DICOM tags...`);
      organizationRecord = await findOrCreateOrganizationFromTags(tags);
      console.log(`[StableStudy] 🏢 Organization: ${organizationRecord.name} (${organizationRecord.identifier})`);
      
      job.progress = 70;
      
      // Continue with patient and lab creation within organization context
      patientRecord = await findOrCreatePatientFromTags(tags, organizationRecord);
      const labResult = await findOrCreateSourceLab(tags, organizationRecord);
      labRecord = labResult.lab;
      labLocation = labResult.labLocation;
    }
    
    job.progress = 75;
    
    // Extract all study information from tags
    const studyDate = formatDicomDateToISO(tags.StudyDate);
    const studyDescription = tags.StudyDescription || 'No Description';
    const accessionNumber = tags.AccessionNumber || `ACC_${Date.now()}`;
    const referringPhysicianName = tags.ReferringPhysicianName || '';
    const institutionName = tags.InstitutionName || '';
    
    console.log(`[StableStudy] 📊 Study Details:`, {
      date: studyDate,
      description: studyDescription,
      accessionNumber: accessionNumber,
      physician: referringPhysicianName,
      institution: institutionName
    });
    
    job.progress = 80;
    
    // Prepare study data
    const studyData = {
      organization: organizationRecord._id,
      organizationIdentifier: organizationRecord.identifier,
      
      studyInstanceUID: studyInstanceUID,
      orthancStudyID: orthancStudyId,
      
      accessionNumber: accessionNumber,
      patient: patientRecord._id,
      patientId: patientRecord.patientID,
      sourceLab: labRecord._id,
      labLocation: labLocation,
      
      studyDate: studyDate,
      studyTime: tags.StudyTime || '',
      modalitiesInStudy: Array.from(modalitiesSet),
      examDescription: studyDescription,  // ✅ CHANGED from studyDescription to examDescription
      institutionName: institutionName,
      workflowStatus: totalInstances > 0 ? 'new_study_received' : 'new_metadata_only',
      
      seriesCount: allSeries.length,  // ✅ ADDED
      instanceCount: totalInstances,  // ✅ ADDED
      seriesImages: `${allSeries.length}/${totalInstances}`,  // ✅ ADDED
      
      patientInfo: {
        patientID: patientRecord.patientID,
        patientName: patientRecord.patientNameRaw,
        age: tags.PatientAge || patientRecord.age || 'N/A',  // ✅ CHANGED: Add age from DICOM tag
        gender: patientRecord.gender || '',
        dateOfBirth: tags.PatientBirthDate || ''
      },
      
      referringPhysicianName: referringPhysicianName,
      physicians: {
        referring: {
          name: referringPhysicianName,
          email: '',
          mobile: tags.ReferringPhysicianTelephoneNumbers || '',
          institution: tags.ReferringPhysicianAddress || ''
        },
        requesting: {
          name: tags.RequestingPhysician || '',
          email: '',
          mobile: '',
          institution: tags.RequestingService || ''
        }
      },
      
      technologist: {
        name: tags.OperatorName || tags.PerformingPhysicianName || '',
        mobile: '',
        comments: '',
        reasonToSend: tags.ReasonForStudy || tags.RequestedProcedureDescription || ''
      },
      
      studyPriority: tags.StudyPriorityID || 'SELECT',
      caseType: tags.RequestPriority || 'routine',
      
      equipment: {
        manufacturer: tags.Manufacturer || '',
        model: tags.ManufacturerModelName || '',
        stationName: tags.StationName || '',
        softwareVersion: tags.SoftwareVersions || ''
      },
      
      protocolName: tags.ProtocolName || '',
      bodyPartExamined: tags.BodyPartExamined || '',
      contrastBolusAgent: tags.ContrastBolusAgent || '',
      contrastBolusRoute: tags.ContrastBolusRoute || '',
      acquisitionDate: tags.AcquisitionDate || '',
      acquisitionTime: tags.AcquisitionTime || '',
      studyComments: tags.StudyComments || '',
      additionalPatientHistory: tags.AdditionalPatientHistory || '',
      
      customLabInfo: {
        organizationId: organizationRecord._id,
        organizationIdentifier: organizationRecord.identifier,
        organizationName: organizationRecord.name,
        labId: labRecord._id,
        labIdentifier: labRecord.identifier,
        labName: labRecord.name,
        labIdSource: (tags["0013,0010"] || tags["0015,0010"]) ? 'dicom_lab_tags' : 'default_unknown_lab',
        orgIdSource: (tags["0021,0010"] || tags["0043,0010"]) ? 'dicom_org_tags' : 'default_test_org',
        detectionMethod: 'separated_tag_lookup'
      },
      
      storageInfo: {
        type: 'orthanc',
        orthancStudyId: orthancStudyId,
        studyInstanceUID: studyInstanceUID,
        receivedAt: new Date(),
        isStableStudy: true,
        instancesFound: totalInstances,
        processingMethod: totalInstances > 0 ? 'optimized_with_instances' : 'metadata_only',
        debugInfo: {
          apiCallsUsed: 3,
          studyInfoUsed: true,
          seriesApiUsed: true,
          singleInstanceTagsUsed: true,
          modalitiesExtracted: Array.from(modalitiesSet),
          organizationTagsFound: {
            "0021,0010": tags["0021,0010"] || null,
            "0043,0010": tags["0043,0010"] || null
          },
          labTagsFound: {
            "0013,0010": tags["0013,0010"] || null,
            "0015,0010": tags["0015,0010"] || null
          }
        }
      }
    };
    
    // ✅ CHANGED: Remove the conditional logic and always create or update
    let dicomStudyDoc = await DicomStudy.findOne({ studyInstanceUID: studyInstanceUID });
    
    if (dicomStudyDoc) {
      console.log(`[StableStudy] 📝 Updating existing study with UID: ${studyInstanceUID}`);
      Object.assign(dicomStudyDoc, studyData);
      dicomStudyDoc.statusHistory.push({
        status: studyData.workflowStatus,
        changedAt: new Date(),
        note: `Study updated: ${allSeries.length} series, ${totalInstances} instances. UID: ${studyInstanceUID}`
      });
    } else {
      console.log(`[StableStudy] 🆕 Creating new study with UID: ${studyInstanceUID}`);
      dicomStudyDoc = new DicomStudy({
        ...studyData,
        statusHistory: [{
          status: studyData.workflowStatus,
          changedAt: new Date(),
          note: `Study created: ${allSeries.length} series, ${totalInstances} instances. UID: ${studyInstanceUID}`
        }]
      });
    }
    
    await dicomStudyDoc.save();
    console.log(`[StableStudy] ✅ Study saved with ID: ${dicomStudyDoc._id}, UID: ${studyInstanceUID}`);
    
    job.progress = 90;
    
    // Create ZIP file and upload to R2
    // 🔧 CRITICAL: ALWAYS create ZIP regardless of study existence or instance count
console.log(`[StableStudy] 📦 Queuing ZIP creation for study: ${orthancStudyId}`);

try {
    const zipJob = await CloudflareR2ZipService.addZipJob({
        orthancStudyId: orthancStudyId,
        studyDatabaseId: dicomStudyDoc._id,
        studyInstanceUID: dicomStudyDoc.studyInstanceUID || orthancStudyId,
        instanceCount: totalInstances,
        seriesCount: allSeries.length
    });
    
    console.log(`[StableStudy] 📦 ZIP Job ${zipJob.id} queued for study: ${orthancStudyId}`);
} catch (zipError) {
    console.error(`[StableStudy] ❌ Failed to queue ZIP job:`, zipError.message);
    // Don't fail the study processing if ZIP queueing fails
}
    
    job.progress = 100;
    job.status = 'completed';
    job.result = {
      success: true,
      studyId: dicomStudyDoc._id.toString(),
      studyInstanceUID: studyInstanceUID,
      action: existingStudy ? 'updated' : 'created',
      preservedFields: existingStudy ? Object.keys(preservedFields) : [],
      patient: {
        id: patientRecord._id.toString(),
        name: patientRecord.patientNameRaw || patientRecord.computed?.fullName,
        mrn: patientRecord.mrn
      },
      organization: {
        id: organizationRecord._id.toString(),
        name: organizationRecord.name,
        identifier: organizationRecord.identifier
      },
      lab: {
        id: labRecord._id.toString(),
        name: labRecord.name,
        identifier: labRecord.identifier
      },
      processingTime: Date.now() - startTime
    };
    
    console.log(`[StableStudy] ✅ Study processed successfully in ${Date.now() - startTime}ms`);
    console.log(`[StableStudy] 📊 Final Result:`, job.result);
    
    return job.result;
    
  } catch (error) {
    console.error(`[StableStudy] ❌ Error processing stable study:`, error);
    job.status = 'failed';
    job.error = error.message;
    job.result = {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime
    };
    throw error;
  }
}

// --- Redis Connection Setup ---
redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redis.on('ready', () => {
  console.log('✅ Redis is ready for operations');
});

redis.on('error', (error) => {
  console.error('❌ Redis connection error:', error.message);
});

// Test Redis connection
console.log('🧪 Testing Redis connection...');
redis.ping()
  .then(() => {
    console.log('✅ Redis ping successful');
    return redis.set('startup-test', 'stable-study-system');
  })
  .then(() => {
    console.log('✅ Redis write test successful');
    return redis.get('startup-test');
  })
  .then((value) => {
    console.log('✅ Redis read test successful, value:', value);
    return redis.del('startup-test');
  })
  .then(() => {
    console.log('✅ All Redis tests passed');
  })
  .catch(error => {
    console.error('❌ Redis test failed:', error.message);
  });

// --- Routes ---

// Test connection route
router.get('/test-connection', async (req, res) => {
  try {
    // Test Redis
    await redis.set('test-key', `test-${Date.now()}`);
    const redisResult = await redis.get('test-key');
    await redis.del('test-key');
    
    // Test Orthanc
    const orthancResponse = await axios.get(`${ORTHANC_BASE_URL}/system`, {
      headers: { 'Authorization': orthancAuth },
      timeout: 5000
    });
    
    res.json({
      redis: 'working',
      redisValue: redisResult,
      orthanc: 'working',
      orthancVersion: orthancResponse.data.Version,
      queue: 'working',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Connection test failed:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Main stable study route
router.post('/stable-study', async (req, res) => {
  console.log('[StableStudy] 📋 Received stable study notification');
  console.log('[StableStudy] 📋 Body type:', typeof req.body);
  console.log('[StableStudy] 📋 Body content:', req.body);
  
  let orthancStudyId = null; 
  try {
    // Extract Orthanc study ID from request
    if (typeof req.body === 'string') {
      orthancStudyId = req.body.trim();
      console.log('[StableStudy] 📋 Extracted from string:', orthancStudyId);
    } else if (req.body && typeof req.body === 'object') {
      // Handle the case where body is an object like { '9442d79e-...': '' }
      const keys = Object.keys(req.body);
      if (keys.length > 0) {
        orthancStudyId = keys[0]; // Take the first key as the study ID
        console.log('[StableStudy] 📋 Extracted from object key:', orthancStudyId);
      } else if (req.body.studyId) {
        orthancStudyId = req.body.studyId;
        console.log('[StableStudy] 📋 Extracted from studyId field:', orthancStudyId);
      } else if (req.body.ID) {
        orthancStudyId = req.body.ID;
        console.log('[StableStudy] 📋 Extracted from ID field:', orthancStudyId);
      }
    }
    
    console.log('[StableStudy] 📋 Final extracted ID:', orthancStudyId);
    
    if (!orthancStudyId || orthancStudyId.trim() === '') {
      console.error('[StableStudy] ❌ No valid Orthanc Study ID found');
      return res.status(400).json({ 
        error: 'Invalid or missing Orthanc Study ID',
        receivedBody: req.body,
        bodyType: typeof req.body,
        keys: typeof req.body === 'object' ? Object.keys(req.body) : 'N/A'
      });
    }
    
    // Clean the study ID
    orthancStudyId = orthancStudyId.trim();
    console.log('[StableStudy] 📋 Using study ID:', orthancStudyId);
    
    const requestId = `stable_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('[StableStudy] 📋 Generated request ID:', requestId);
    
    // Add job to process the complete stable study
    const job = await jobQueue.add({
      orthancStudyId: orthancStudyId,
      requestId: requestId,
      submittedAt: new Date(),
      originalBody: req.body
    });
    
    console.log(`[StableStudy] ✅ Job ${job.id} queued for stable study: ${orthancStudyId}`);
    
    // Immediate response
    res.status(202).json({
      message: 'Stable study queued for processing with multi-tenant support',
      jobId: job.id,
      requestId: requestId,
      orthancStudyId: orthancStudyId,
      status: 'queued',
      checkStatusUrl: `/orthanc/job-status/${requestId}`
    });
    
  } catch (error) {
    console.error('[StableStudy] ❌ Error in route handler:', error);
    console.error('[StableStudy] ❌ Error stack:', error.stack);
    res.status(500).json({
      message: 'Error queuing stable study for processing',
      error: error.message,
      receivedBody: req.body,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Job status route
router.get('/job-status/:requestId', async (req, res) => {
  const { requestId } = req.params;
  
  try {
    // Check Redis first
    const resultData = await redis.get(`job:result:${requestId}`);
    
    if (resultData) {
      const result = JSON.parse(resultData);
      res.json({
        status: result.success ? 'completed' : 'failed',
        result: result,
        requestId: requestId
      });
    } else {
      // Check in-memory queue
      const job = jobQueue.getJobByRequestId(requestId);
      
      if (job) {
        res.json({
          status: job.status,
          progress: job.progress,
          requestId: requestId,
          jobId: job.id,
          createdAt: job.createdAt,
          error: job.error
        });
      } else {
        res.status(404).json({
          status: 'not_found',
          message: 'Job not found or expired',
          requestId: requestId
        });
      }
    }
  } catch (error) {
    console.error('Error checking job status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error checking job status',
      error: error.message
    });
  }
});

// 🆕 NEW: Manual ZIP creation endpoint
router.post('/create-zip/:orthancStudyId', async (req, res) => {
    try {
        const { orthancStudyId } = req.params;
        
        console.log(`[Manual ZIP] 📦 Manual ZIP creation requested for: ${orthancStudyId}`);
        
        // Find study in database
        const study = await DicomStudy.findOne({ orthancStudyID: orthancStudyId });
        
        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found in database'
            });
        }
        
        // Check if ZIP is already being processed or completed
        if (study.preProcessedDownload?.zipStatus === 'processing') {
            return res.json({
                success: false,
                message: 'ZIP creation already in progress',
                status: 'processing',
                jobId: study.preProcessedDownload.zipJobId
            });
        }
        
        if (study.preProcessedDownload?.zipStatus === 'completed' && study.preProcessedDownload?.zipUrl) {
            return res.json({
                success: true,
                message: 'ZIP already exists',
                status: 'completed',
                zipUrl: study.preProcessedDownload.zipUrl,
                zipSizeMB: study.preProcessedDownload.zipSizeMB,
                createdAt: study.preProcessedDownload.zipCreatedAt
            });
        }
        
        // Queue new ZIP creation job
        const zipJob = await CloudflareR2ZipService.addZipJob({
            orthancStudyId: orthancStudyId,
            studyDatabaseId: study._id,
            studyInstanceUID: study.studyInstanceUID || orthancStudyId,
            instanceCount: study.instanceCount || 0,
            seriesCount: study.seriesCount || 0
        });
        
        res.json({
            success: true,
            message: 'ZIP creation queued',
            jobId: zipJob.id,
            status: 'queued',
            checkStatusUrl: `/orthanc/zip-status/${zipJob.id}`
        });
        
    } catch (error) {
        console.error('[Manual ZIP] ❌ Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to queue ZIP creation',
            error: error.message
        });
    }
});

// 🆕 NEW: ZIP job status endpoint
router.get('/zip-status/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = CloudflareR2ZipService.getJob(parseInt(jobId));
        
        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'ZIP job not found'
            });
        }
        
        res.json({
            success: true,
            jobId: job.id,
            status: job.status,
            progress: job.progress,
            createdAt: job.createdAt,
            result: job.result,
            error: job.error
        });
        
    } catch (error) {
        console.error('[ZIP Status] ❌ Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get ZIP status',
            error: error.message
        });
    }
});

// 🆕 NEW: Initialize R2 bucket on startup
router.get('/init-r2', async (req, res) => {
    try {
        await CloudflareR2ZipService.ensureR2Bucket();
        res.json({
            success: true,
            message: 'R2 bucket initialized successfully'
        });
    } catch (error) {
        console.error('[R2 Init] ❌ Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initialize R2 bucket',
            error: error.message
        });
    }
});

export default router;
const { User, Location, Project, Scheme, Beneficiary, Application, Interview } = require('../models');
const bcrypt = require('bcryptjs');
const orgConfig = require('../config/orgConfig');

// Derive email domain from org config (e.g., 'baithuzzakath.org' from 'https://baithuzzakath.org')
const emailDomain = orgConfig.email.split('@')[1] || 'example.org';

/**
 * Seed initial data for development and testing
 */
class SeedData {
  /**
   * Seed Kerala location hierarchy
   */
  static async seedLocations() {
    try {
      console.log('🌱 Seeding location data...');

      // Check if locations already exist
      const existingLocations = await Location.countDocuments();
      if (existingLocations > 0) {
        console.log('📍 Locations already exist, skipping seed');
        return;
      }

      // Create Kerala state
      const kerala = new Location({
        name: 'Kerala',
        type: 'state',
        code: 'KL',
        parent: null,
        coordinates: {
          latitude: 10.8505,
          longitude: 76.2711
        },
        population: 33406061,
        area: 38852
      });
      await kerala.save();

      // Create districts
      const districts = [
        { name: 'Thiruvananthapuram', code: 'TVM', lat: 8.5241, lng: 76.9366 },
        { name: 'Kollam', code: 'KLM', lat: 8.8932, lng: 76.6141 },
        { name: 'Pathanamthitta', code: 'PTA', lat: 9.2648, lng: 76.7870 },
        { name: 'Alappuzha', code: 'ALP', lat: 9.4981, lng: 76.3388 },
        { name: 'Kottayam', code: 'KTM', lat: 9.5916, lng: 76.5222 },
        { name: 'Idukki', code: 'IDK', lat: 9.8560, lng: 76.9740 },
        { name: 'Ernakulam', code: 'EKM', lat: 9.9312, lng: 76.2673 },
        { name: 'Thrissur', code: 'TSR', lat: 10.5276, lng: 76.2144 },
        { name: 'Palakkad', code: 'PKD', lat: 10.7867, lng: 76.6548 },
        { name: 'Malappuram', code: 'MPM', lat: 11.0410, lng: 76.0788 },
        { name: 'Kozhikode', code: 'KZK', lat: 11.2588, lng: 75.7804 },
        { name: 'Wayanad', code: 'WYD', lat: 11.6854, lng: 76.1320 },
        { name: 'Kannur', code: 'KNR', lat: 11.8745, lng: 75.3704 },
        { name: 'Kasaragod', code: 'KSD', lat: 12.4996, lng: 74.9869 }
      ];

      const createdDistricts = [];
      for (const districtData of districts) {
        const district = new Location({
          name: districtData.name,
          type: 'district',
          code: districtData.code,
          parent: kerala._id,
          coordinates: {
            latitude: districtData.lat,
            longitude: districtData.lng
          }
        });
        await district.save();
        createdDistricts.push(district);
      }

      // Create sample areas for Thiruvananthapuram district
      const tvm = createdDistricts[0];
      const areas = [
        { name: 'Thiruvananthapuram City', code: 'TVM_CITY' },
        { name: 'Neyyattinkara', code: 'TVM_NYY' },
        { name: 'Varkala', code: 'TVM_VRK' },
        { name: 'Attingal', code: 'TVM_ATG' }
      ];

      const createdAreas = [];
      for (const areaData of areas) {
        const area = new Location({
          name: areaData.name,
          type: 'area',
          code: areaData.code,
          parent: tvm._id
        });
        await area.save();
        createdAreas.push(area);
      }

      // Create sample units for Thiruvananthapuram City area
      const tvmCity = createdAreas[0];
      const units = [
        { name: 'Pettah Unit', code: 'TVM_CITY_PTH' },
        { name: 'Fort Unit', code: 'TVM_CITY_FRT' },
        { name: 'Palayam Unit', code: 'TVM_CITY_PLM' }
      ];

      for (const unitData of units) {
        const unit = new Location({
          name: unitData.name,
          type: 'unit',
          code: unitData.code,
          parent: tvmCity._id
        });
        await unit.save();
      }

      console.log('✅ Location data seeded successfully');
    } catch (error) {
      console.error('❌ Error seeding locations:', error);
      throw error;
    }
  }

  /**
   * Seed initial admin users
   */
  static async seedUsers() {
    try {
      console.log('🌱 Seeding user data...');

      // Check if users already exist
      const existingUsers = await User.countDocuments();
      if (existingUsers > 0) {
        console.log('👥 Users already exist, skipping seed');
        return;
      }

      // Get Kerala and Thiruvananthapuram for admin scope
      const kerala = await Location.findOne({ type: 'state', code: 'KL' });
      const tvm = await Location.findOne({ type: 'district', code: 'TVM' });
      const tvmCity = await Location.findOne({ type: 'area', code: 'TVM_CITY' });
      const pettahUnit = await Location.findOne({ type: 'unit', code: 'TVM_CITY_PTH' });

      if (!kerala || !tvm || !tvmCity || !pettahUnit) {
        throw new Error('Required locations not found. Please seed locations first.');
      }

      // Create State Admin
      const stateAdmin = new User({
        name: 'State Administrator',
        email: `admin@${emailDomain}`,
        phone: '9876543210',
        password: 'Admin@123',
        role: 'state_admin',
        adminScope: {
          level: 'state',
          regions: [kerala._id]
        },
        profile: {
          gender: 'male',
          address: {
            street: 'Secretariat',
            area: 'Thiruvananthapuram',
            district: 'Thiruvananthapuram',
            state: 'Kerala',
            pincode: '695001'
          }
        },
        isVerified: true,
        isActive: true
      });
      await stateAdmin.save();

      // Create District Admin
      const districtAdmin = new User({
        name: 'District Administrator TVM',
        email: `district.tvm@${emailDomain}`,
        phone: '9876543211',
        password: 'Admin@123',
        role: 'district_admin',
        adminScope: {
          level: 'district',
          regions: [tvm._id]
        },
        profile: {
          gender: 'male',
          address: {
            street: 'District Collectorate',
            area: 'Thiruvananthapuram',
            district: 'Thiruvananthapuram',
            state: 'Kerala',
            pincode: '695033'
          }
        },
        isVerified: true,
        isActive: true,
        createdBy: stateAdmin._id
      });
      await districtAdmin.save();

      // Create Area Admin
      const areaAdmin = new User({
        name: 'Area Administrator TVM City',
        email: `area.tvmcity@${emailDomain}`,
        phone: '9876543212',
        password: 'Admin@123',
        role: 'area_admin',
        adminScope: {
          level: 'area',
          regions: [tvmCity._id]
        },
        profile: {
          gender: 'female',
          address: {
            street: 'Corporation Office',
            area: 'Thiruvananthapuram City',
            district: 'Thiruvananthapuram',
            state: 'Kerala',
            pincode: '695001'
          }
        },
        isVerified: true,
        isActive: true,
        createdBy: districtAdmin._id
      });
      await areaAdmin.save();

      // Create Unit Admin
      const unitAdmin = new User({
        name: 'Unit Administrator Pettah',
        email: `unit.pettah@${emailDomain}`,
        phone: '9876543213',
        password: 'Admin@123',
        role: 'unit_admin',
        adminScope: {
          level: 'unit',
          regions: [pettahUnit._id]
        },
        profile: {
          gender: 'male',
          address: {
            street: 'Pettah Junction',
            area: 'Pettah',
            district: 'Thiruvananthapuram',
            state: 'Kerala',
            pincode: '695024'
          }
        },
        isVerified: true,
        isActive: true,
        createdBy: areaAdmin._id
      });
      await unitAdmin.save();

      // Create Sample Beneficiary
      const beneficiary = new User({
        name: 'Sample Beneficiary',
        email: 'beneficiary@example.com',
        phone: '9876543214',
        password: 'User@123',
        role: 'beneficiary',
        profile: {
          gender: 'male',
          dateOfBirth: new Date('1990-01-01'),
          address: {
            street: 'Sample Street',
            area: 'Pettah',
            district: 'Thiruvananthapuram',
            state: 'Kerala',
            pincode: '695024'
          }
        },
        isVerified: true,
        isActive: true
      });
      await beneficiary.save();

      console.log('✅ User data seeded successfully');
      console.log('📋 Default login credentials:');
      console.log(`   State Admin: admin@${emailDomain} / Admin@123`);
      console.log(`   District Admin: district.tvm@${emailDomain} / Admin@123`);
      console.log(`   Area Admin: area.tvmcity@${emailDomain} / Admin@123`);
      console.log(`   Unit Admin: unit.pettah@${emailDomain} / Admin@123`);
      console.log('   Beneficiary: beneficiary@example.com / User@123');
    } catch (error) {
      console.error('❌ Error seeding users:', error);
      throw error;
    }
  }

  /**
   * Seed project data
   */
  static async seedProjects() {
    try {
      console.log('🌱 Seeding project data...');

      // Check if projects already exist
      const existingProjects = await Project.countDocuments();
      if (existingProjects > 0) {
        console.log('📊 Projects already exist, skipping seed');
        return;
      }

      // Get required data
      const stateAdmin = await User.findOne({ email: `admin@${emailDomain}` });
      const districtAdmin = await User.findOne({ email: `district.tvm@${emailDomain}` });
      const kerala = await Location.findOne({ name: 'Kerala', type: 'state' });
      const tvm = await Location.findOne({ name: 'Thiruvananthapuram', type: 'district' });

      if (!stateAdmin || !districtAdmin || !kerala || !tvm) {
        throw new Error('Required users or locations not found. Please seed users and locations first.');
      }

      // Create sample projects
      const projects = [
        {
          name: 'Kerala Education Support Program',
          code: 'KESP-2025',
          description: 'Comprehensive education support program providing scholarships, books, and educational materials to underprivileged students across Kerala.',
          category: 'education',
          priority: 'high',
          scope: 'state',
          targetRegions: [kerala._id],
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-12-31'),
          budget: {
            total: 5000000,
            allocated: 2000000,
            spent: 500000
          },
          coordinator: stateAdmin._id,
          status: 'active',
          progress: {
            percentage: 25,
            milestones: [
              {
                name: 'Project Launch',
                description: 'Official project launch and team formation',
                targetDate: new Date('2025-01-15'),
                completedDate: new Date('2025-01-15'),
                status: 'completed'
              },
              {
                name: 'Beneficiary Registration',
                description: 'Complete registration of eligible beneficiaries',
                targetDate: new Date('2025-03-31'),
                status: 'in_progress'
              },
              {
                name: 'First Distribution',
                description: 'First round of educational material distribution',
                targetDate: new Date('2025-06-30'),
                status: 'pending'
              }
            ]
          },
          targetBeneficiaries: {
            estimated: 10000,
            actual: 2500,
            demographics: {
              ageGroups: {
                children: 6000,
                youth: 4000,
                adults: 0,
                elderly: 0
              },
              gender: {
                male: 5200,
                female: 4800,
                other: 0
              }
            }
          },
          createdBy: stateAdmin._id
        },
        {
          name: 'Healthcare Access Initiative',
          code: 'HAI-2025',
          description: 'Mobile healthcare units and medical camps to provide healthcare services to remote areas in Kerala.',
          category: 'healthcare',
          priority: 'critical',
          scope: 'state',
          targetRegions: [kerala._id],
          startDate: new Date('2025-02-01'),
          endDate: new Date('2026-01-31'),
          budget: {
            total: 8000000,
            allocated: 3000000,
            spent: 750000
          },
          coordinator: stateAdmin._id,
          status: 'active',
          progress: {
            percentage: 15,
            milestones: [
              {
                name: 'Equipment Procurement',
                description: 'Purchase and setup of mobile healthcare units',
                targetDate: new Date('2025-03-15'),
                status: 'in_progress'
              },
              {
                name: 'Staff Training',
                description: 'Training of medical staff and volunteers',
                targetDate: new Date('2025-04-30'),
                status: 'pending'
              }
            ]
          },
          targetBeneficiaries: {
            estimated: 50000,
            actual: 5000,
            demographics: {
              ageGroups: {
                children: 15000,
                youth: 10000,
                adults: 15000,
                elderly: 10000
              },
              gender: {
                male: 24000,
                female: 26000,
                other: 0
              }
            }
          },
          createdBy: stateAdmin._id
        },
        {
          name: 'Thiruvananthapuram Housing Project',
          code: 'TVM-HOUSE-2025',
          description: 'Affordable housing project for low-income families in Thiruvananthapuram district.',
          category: 'housing',
          priority: 'high',
          scope: 'district',
          targetRegions: [tvm._id],
          startDate: new Date('2025-03-01'),
          endDate: new Date('2026-02-28'),
          budget: {
            total: 12000000,
            allocated: 4000000,
            spent: 1000000
          },
          coordinator: districtAdmin._id,
          status: 'active',
          progress: {
            percentage: 10,
            milestones: [
              {
                name: 'Land Acquisition',
                description: 'Acquire suitable land for housing project',
                targetDate: new Date('2025-05-31'),
                status: 'in_progress'
              },
              {
                name: 'Construction Phase 1',
                description: 'Begin construction of first 50 houses',
                targetDate: new Date('2025-09-30'),
                status: 'pending'
              }
            ]
          },
          targetBeneficiaries: {
            estimated: 200,
            actual: 25,
            demographics: {
              ageGroups: {
                children: 80,
                youth: 40,
                adults: 60,
                elderly: 20
              },
              gender: {
                male: 100,
                female: 100,
                other: 0
              }
            }
          },
          createdBy: districtAdmin._id
        },
        {
          name: 'Livelihood Development Program',
          code: 'LDP-2025',
          description: 'Skill development and microfinance program to support sustainable livelihoods for unemployed youth and women.',
          category: 'livelihood',
          priority: 'medium',
          scope: 'state',
          targetRegions: [kerala._id],
          startDate: new Date('2025-04-01'),
          endDate: new Date('2025-12-31'),
          budget: {
            total: 3000000,
            allocated: 1000000,
            spent: 200000
          },
          coordinator: stateAdmin._id,
          status: 'approved',
          progress: {
            percentage: 5,
            milestones: [
              {
                name: 'Training Center Setup',
                description: 'Establish training centers across districts',
                targetDate: new Date('2025-05-31'),
                status: 'pending'
              },
              {
                name: 'Curriculum Development',
                description: 'Develop skill training curriculum',
                targetDate: new Date('2025-06-15'),
                status: 'pending'
              }
            ]
          },
          targetBeneficiaries: {
            estimated: 5000,
            actual: 0,
            demographics: {
              ageGroups: {
                children: 0,
                youth: 3500,
                adults: 1500,
                elderly: 0
              },
              gender: {
                male: 2000,
                female: 3000,
                other: 0
              }
            }
          },
          createdBy: stateAdmin._id
        },
        {
          name: 'Emergency Relief Fund',
          code: 'ERF-2025',
          description: 'Emergency relief and rehabilitation support for natural disaster victims and emergency situations.',
          category: 'emergency_relief',
          priority: 'critical',
          scope: 'state',
          targetRegions: [kerala._id],
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-12-31'),
          budget: {
            total: 10000000,
            allocated: 2000000,
            spent: 500000
          },
          coordinator: stateAdmin._id,
          status: 'active',
          progress: {
            percentage: 20,
            milestones: [
              {
                name: 'Emergency Response Team',
                description: 'Form and train emergency response teams',
                targetDate: new Date('2025-02-28'),
                completedDate: new Date('2025-02-25'),
                status: 'completed'
              },
              {
                name: 'Relief Material Stockpile',
                description: 'Build stockpile of emergency relief materials',
                targetDate: new Date('2025-04-30'),
                status: 'in_progress'
              }
            ]
          },
          targetBeneficiaries: {
            estimated: 25000,
            actual: 3000,
            demographics: {
              ageGroups: {
                children: 8000,
                youth: 6000,
                adults: 8000,
                elderly: 3000
              },
              gender: {
                male: 12000,
                female: 13000,
                other: 0
              }
            }
          },
          createdBy: stateAdmin._id
        }
      ];

      // Insert projects
      for (const projectData of projects) {
        const project = new Project(projectData);
        await project.save();
      }

      console.log('✅ Project data seeded successfully');
      console.log(`📊 Created ${projects.length} sample projects`);
    } catch (error) {
      console.error('❌ Error seeding projects:', error);
      throw error;
    }
  }

  /**
   * Seed scheme data
   */
  static async seedSchemes() {
    try {
      console.log('🌱 Seeding scheme data...');

      // Check if schemes already exist
      const existingSchemes = await Scheme.countDocuments();
      if (existingSchemes > 0) {
        console.log('📊 Schemes already exist, skipping seed');
        return;
      }

      // Get required data
      const stateAdmin = await User.findOne({ email: `admin@${emailDomain}` });
      const educationProject = await Project.findOne({ code: 'KESP-2025' });
      const healthcareProject = await Project.findOne({ code: 'HAI-2025' });
      const housingProject = await Project.findOne({ code: 'TVM-HOUSE-2025' });
      const kerala = await Location.findOne({ name: 'Kerala', type: 'state' });
      const tvm = await Location.findOne({ name: 'Thiruvananthapuram', type: 'district' });

      if (!stateAdmin || !educationProject || !kerala) {
        throw new Error('Required data not found. Please seed projects and locations first.');
      }

      // Create sample schemes
      const schemes = [
        {
          name: 'Merit Scholarship Program',
          code: 'MSP-2025',
          description: 'Merit-based scholarships for outstanding students from economically disadvantaged backgrounds pursuing higher education in Kerala.',
          category: 'education',
          priority: 'high',
          status: 'active',
          project: educationProject._id,
          targetRegions: [kerala._id],
          eligibility: {
            ageRange: { min: 17, max: 25 },
            gender: 'any',
            incomeLimit: 200000,
            educationLevel: 'higher_secondary',
            documents: [
              { type: 'aadhaar', required: true, description: 'Aadhaar card for identity verification' },
              { type: 'income_certificate', required: true, description: 'Family income certificate' },
              { type: 'caste_certificate', required: false, description: 'Caste certificate if applicable' }
            ]
          },
          budget: {
            total: 2000000,
            allocated: 800000,
            spent: 300000
          },
          benefits: {
            type: 'scholarship',
            amount: 25000,
            frequency: 'yearly',
            duration: 48,
            description: 'Annual scholarship of ₹25,000 for up to 4 years of study'
          },
          applicationSettings: {
            startDate: new Date('2025-01-01'),
            endDate: new Date('2025-06-30'),
            maxApplications: 500,
            maxBeneficiaries: 80,
            autoApproval: false,
            requiresInterview: true,
            allowMultipleApplications: false
          },
          statistics: {
            totalApplications: 156,
            approvedApplications: 45,
            rejectedApplications: 23,
            pendingApplications: 88,
            totalBeneficiaries: 45,
            totalAmountDisbursed: 1125000
          },
          createdBy: stateAdmin._id
        },
        {
          name: 'Emergency Medical Assistance',
          code: 'EMA-2025',
          description: 'Emergency financial assistance for critical medical treatments and surgeries for families below poverty line.',
          category: 'healthcare',
          priority: 'critical',
          status: 'active',
          project: healthcareProject ? healthcareProject._id : educationProject._id,
          targetRegions: [kerala._id],
          eligibility: {
            ageRange: { min: 0, max: 100 },
            gender: 'any',
            incomeLimit: 150000,
            documents: [
              { type: 'aadhaar', required: true, description: 'Patient Aadhaar card' },
              { type: 'income_certificate', required: true, description: 'Family income certificate' },
              { type: 'other', required: true, description: 'Medical reports and treatment estimates' }
            ]
          },
          budget: {
            total: 3000000,
            allocated: 1200000,
            spent: 450000
          },
          benefits: {
            type: 'cash',
            amount: 50000,
            frequency: 'one_time',
            duration: 1,
            description: 'One-time financial assistance up to ₹50,000 for medical treatment'
          },
          applicationSettings: {
            startDate: new Date('2025-01-01'),
            endDate: new Date('2025-12-31'),
            maxApplications: 1000,
            maxBeneficiaries: 200,
            autoApproval: false,
            requiresInterview: false,
            allowMultipleApplications: true
          },
          statistics: {
            totalApplications: 89,
            approvedApplications: 67,
            rejectedApplications: 12,
            pendingApplications: 10,
            totalBeneficiaries: 67,
            totalAmountDisbursed: 2350000
          },
          createdBy: stateAdmin._id
        },
        {
          name: 'Skill Development Training',
          code: 'SDT-2025',
          description: 'Vocational training programs for unemployed youth to enhance employability and entrepreneurship skills.',
          category: 'livelihood',
          priority: 'medium',
          status: 'active',
          project: educationProject._id,
          targetRegions: [kerala._id],
          eligibility: {
            ageRange: { min: 18, max: 35 },
            gender: 'any',
            incomeLimit: 300000,
            employmentStatus: 'unemployed',
            educationLevel: 'secondary',
            documents: [
              { type: 'aadhaar', required: true, description: 'Aadhaar card for identity verification' },
              { type: 'income_certificate', required: true, description: 'Family income certificate' },
              { type: 'other', required: false, description: 'Educational certificates' }
            ]
          },
          budget: {
            total: 1500000,
            allocated: 600000,
            spent: 200000
          },
          benefits: {
            type: 'service',
            amount: 0,
            frequency: 'one_time',
            duration: 6,
            description: '6-month vocational training with placement assistance and monthly stipend of ₹3,000'
          },
          applicationSettings: {
            startDate: new Date('2025-02-01'),
            endDate: new Date('2025-08-31'),
            maxApplications: 300,
            maxBeneficiaries: 100,
            autoApproval: false,
            requiresInterview: true,
            allowMultipleApplications: false
          },
          statistics: {
            totalApplications: 234,
            approvedApplications: 78,
            rejectedApplications: 45,
            pendingApplications: 111,
            totalBeneficiaries: 78,
            totalAmountDisbursed: 1404000
          },
          createdBy: stateAdmin._id
        },
        {
          name: 'Housing Assistance Program',
          code: 'HAP-2025',
          description: 'Financial assistance for construction and renovation of houses for homeless and inadequately housed families.',
          category: 'housing',
          priority: 'high',
          status: 'active',
          project: housingProject ? housingProject._id : educationProject._id,
          targetRegions: tvm ? [tvm._id] : [kerala._id],
          eligibility: {
            ageRange: { min: 21, max: 60 },
            gender: 'any',
            incomeLimit: 180000,
            familySize: { min: 2, max: 8 },
            documents: [
              { type: 'aadhaar', required: true, description: 'Aadhaar card of applicant' },
              { type: 'income_certificate', required: true, description: 'Family income certificate' },
              { type: 'other', required: true, description: 'Land ownership documents or lease agreement' }
            ]
          },
          budget: {
            total: 5000000,
            allocated: 2000000,
            spent: 800000
          },
          benefits: {
            type: 'cash',
            amount: 200000,
            frequency: 'one_time',
            duration: 1,
            description: 'One-time financial assistance up to ₹2,00,000 for house construction/renovation'
          },
          applicationSettings: {
            startDate: new Date('2025-03-01'),
            endDate: new Date('2025-10-31'),
            maxApplications: 150,
            maxBeneficiaries: 25,
            autoApproval: false,
            requiresInterview: true,
            allowMultipleApplications: false
          },
          statistics: {
            totalApplications: 67,
            approvedApplications: 18,
            rejectedApplications: 15,
            pendingApplications: 34,
            totalBeneficiaries: 18,
            totalAmountDisbursed: 3600000
          },
          createdBy: stateAdmin._id
        },
        {
          name: 'Women Empowerment Initiative',
          code: 'WEI-2025',
          description: 'Comprehensive program for women empowerment through skill training, microfinance, and entrepreneurship support.',
          category: 'social_welfare',
          priority: 'high',
          status: 'active',
          project: educationProject._id,
          targetRegions: [kerala._id],
          eligibility: {
            ageRange: { min: 18, max: 50 },
            gender: 'female',
            incomeLimit: 250000,
            documents: [
              { type: 'aadhaar', required: true, description: 'Aadhaar card for identity verification' },
              { type: 'income_certificate', required: true, description: 'Family income certificate' },
              { type: 'bank_passbook', required: true, description: 'Bank account details' }
            ]
          },
          budget: {
            total: 2500000,
            allocated: 1000000,
            spent: 350000
          },
          benefits: {
            type: 'loan',
            amount: 25000,
            frequency: 'one_time',
            duration: 36,
            description: 'Interest-free loan up to ₹25,000 for starting small business with 3-year repayment'
          },
          applicationSettings: {
            startDate: new Date('2025-01-15'),
            endDate: new Date('2025-09-15'),
            maxApplications: 400,
            maxBeneficiaries: 100,
            autoApproval: false,
            requiresInterview: true,
            allowMultipleApplications: false
          },
          statistics: {
            totalApplications: 178,
            approvedApplications: 56,
            rejectedApplications: 34,
            pendingApplications: 88,
            totalBeneficiaries: 56,
            totalAmountDisbursed: 1400000
          },
          createdBy: stateAdmin._id
        }
      ];

      // Insert schemes
      for (const schemeData of schemes) {
        const scheme = new Scheme(schemeData);
        await scheme.save();
      }

      console.log('✅ Scheme data seeded successfully');
      console.log(`📊 Created ${schemes.length} sample schemes`);
    } catch (error) {
      console.error('❌ Error seeding schemes:', error);
      throw error;
    }
  }

  /**
   * Seed beneficiary data
   */
  static async seedBeneficiaries() {
    try {
      console.log('🌱 Seeding beneficiary data...');

      // Check if beneficiaries already exist
      const existingBeneficiaries = await Beneficiary.countDocuments();
      if (existingBeneficiaries > 0) {
        console.log('👥 Beneficiaries already exist, skipping seed');
        return;
      }

      // Get required locations and admin user
      const kerala = await Location.findOne({ name: 'Kerala', type: 'state' });
      const tvm = await Location.findOne({ name: 'Thiruvananthapuram', type: 'district' });
      const tvmCity = await Location.findOne({ name: 'Thiruvananthapuram City', type: 'area' });
      const pettahUnit = await Location.findOne({ name: 'Pettah Unit', type: 'unit' });
      const kollam = await Location.findOne({ name: 'Kollam', type: 'district' });
      const ernakulam = await Location.findOne({ name: 'Ernakulam', type: 'district' });
      const stateAdmin = await User.findOne({ email: `admin@${emailDomain}` });

      if (!kerala || !tvm || !tvmCity || !pettahUnit || !stateAdmin) {
        throw new Error('Required locations or admin user not found. Please seed locations and users first.');
      }

      // Create sample beneficiaries
      const beneficiaries = [
        {
          name: 'Zainab Khatoon',
          phone: '9876543215',
          email: 'zainab.khatoon@example.com',
          state: kerala._id,
          district: tvm._id,
          area: tvmCity._id,
          unit: pettahUnit._id,
          profile: {
            gender: 'female',
            dateOfBirth: new Date('1985-03-15'),
            fatherName: 'Abdul Rahman',
            motherName: 'Fatima Beevi',
            maritalStatus: 'married',
            occupation: 'homemaker',
            education: 'secondary',
            familySize: 4,
            monthlyIncome: 15000,
            address: {
              street: 'TC 25/1456, Pettah Road',
              area: 'Pettah',
              district: 'Thiruvananthapuram',
              state: 'Kerala',
              pincode: '695024'
            },
            bankDetails: {
              accountNumber: '1234567890123456',
              ifscCode: 'SBIN0000123',
              bankName: 'State Bank of India',
              branchName: 'Pettah Branch',
              accountHolderName: 'Zainab Khatoon'
            }
          },
          status: 'active',
          isVerified: true,
          verifiedAt: new Date(),
          applications: [],
          createdBy: stateAdmin._id
        },
        {
          name: 'Mohammed Farhan',
          phone: '9876543216',
          email: 'mohammed.farhan@example.com',
          state: kerala._id,
          district: tvm._id,
          area: tvmCity._id,
          unit: pettahUnit._id,
          profile: {
            gender: 'male',
            dateOfBirth: new Date('2002-08-22'),
            fatherName: 'Mohammed Rashid',
            motherName: 'Ayesha Beevi',
            maritalStatus: 'single',
            occupation: 'student',
            education: 'higher_secondary',
            familySize: 5,
            monthlyIncome: 12000,
            address: {
              street: 'TC 15/892, Fort Road',
              area: 'Fort',
              district: 'Thiruvananthapuram',
              state: 'Kerala',
              pincode: '695023'
            },
            bankDetails: {
              accountNumber: '2345678901234567',
              ifscCode: 'CANR0000456',
              bankName: 'Canara Bank',
              branchName: 'Fort Branch',
              accountHolderName: 'Mohammed Farhan'
            }
          },
          status: 'active',
          isVerified: true,
          verifiedAt: new Date(),
          applications: [],
          createdBy: stateAdmin._id
        },
        {
          name: 'Amina Sultana',
          phone: '9876543217',
          email: 'amina.sultana@example.com',
          state: kerala._id,
          district: kollam || tvm._id,
          area: tvmCity._id,
          unit: pettahUnit._id,
          profile: {
            gender: 'female',
            dateOfBirth: new Date('1978-12-10'),
            fatherName: 'Ibrahim Sahib',
            motherName: 'Khadija Beevi',
            maritalStatus: 'widowed',
            occupation: 'tailor',
            education: 'primary',
            familySize: 3,
            monthlyIncome: 8000,
            address: {
              street: 'House No. 45, Kollam Road',
              area: 'Kollam',
              district: 'Kollam',
              state: 'Kerala',
              pincode: '691001'
            },
            bankDetails: {
              accountNumber: '3456789012345678',
              ifscCode: 'IDIB000K001',
              bankName: 'Indian Bank',
              branchName: 'Kollam Branch',
              accountHolderName: 'Amina Sultana'
            }
          },
          status: 'active',
          isVerified: true,
          verifiedAt: new Date(),
          applications: [],
          createdBy: stateAdmin._id
        },
        {
          name: 'Abdul Karim',
          phone: '9876543218',
          email: 'abdul.karim@example.com',
          state: kerala._id,
          district: ernakulam || tvm._id,
          area: tvmCity._id,
          unit: pettahUnit._id,
          profile: {
            gender: 'male',
            dateOfBirth: new Date('1990-05-18'),
            fatherName: 'Mohammed Ali',
            motherName: 'Raheema Beevi',
            maritalStatus: 'married',
            occupation: 'auto_driver',
            education: 'secondary',
            familySize: 6,
            monthlyIncome: 18000,
            address: {
              street: 'Flat 2B, Ernakulam Apartments',
              area: 'Ernakulam',
              district: 'Ernakulam',
              state: 'Kerala',
              pincode: '682001'
            },
            bankDetails: {
              accountNumber: '4567890123456789',
              ifscCode: 'HDFC0000789',
              bankName: 'HDFC Bank',
              branchName: 'Ernakulam Branch',
              accountHolderName: 'Abdul Karim'
            }
          },
          status: 'active',
          isVerified: true,
          verifiedAt: new Date(),
          applications: [],
          createdBy: stateAdmin._id
        },
        {
          name: 'Fathima Nasreen',
          phone: '9876543219',
          email: 'fathima.nasreen@example.com',
          state: kerala._id,
          district: tvm._id,
          area: tvmCity._id,
          unit: pettahUnit._id,
          profile: {
            gender: 'female',
            dateOfBirth: new Date('1995-11-25'),
            fatherName: 'Usman Sahib',
            motherName: 'Mariam Beevi',
            maritalStatus: 'single',
            occupation: 'teacher',
            education: 'graduation',
            familySize: 4,
            monthlyIncome: 22000,
            address: {
              street: 'TC 18/567, Palayam Road',
              area: 'Palayam',
              district: 'Thiruvananthapuram',
              state: 'Kerala',
              pincode: '695033'
            },
            bankDetails: {
              accountNumber: '5678901234567890',
              ifscCode: 'SBIN0000456',
              bankName: 'State Bank of India',
              branchName: 'Palayam Branch',
              accountHolderName: 'Fathima Nasreen'
            }
          },
          status: 'active',
          isVerified: true,
          verifiedAt: new Date(),
          applications: [],
          createdBy: stateAdmin._id
        }
      ];

      // Insert beneficiaries
      const createdBeneficiaries = [];
      for (const beneficiaryData of beneficiaries) {
        const beneficiary = new Beneficiary(beneficiaryData);
        await beneficiary.save();
        createdBeneficiaries.push(beneficiary);
      }

      console.log('✅ Beneficiary data seeded successfully');
      console.log(`👥 Created ${createdBeneficiaries.length} sample beneficiaries`);
      return createdBeneficiaries;
    } catch (error) {
      console.error('❌ Error seeding beneficiaries:', error);
      throw error;
    }
  }

  /**
   * Seed application data
   */
  static async seedApplications() {
    try {
      console.log('🌱 Seeding application data...');

      // Check if applications already exist
      const existingApplications = await Application.countDocuments();
      if (existingApplications > 0) {
        console.log('📄 Applications already exist, skipping seed');
        return;
      }

      // Get required data
      const beneficiaries = await Beneficiary.find().limit(5);
      const schemes = await Scheme.find();
      const projects = await Project.find();
      const stateAdmin = await User.findOne({ email: `admin@${emailDomain}` });
      const districtAdmin = await User.findOne({ email: `district.tvm@${emailDomain}` });

      if (beneficiaries.length === 0 || schemes.length === 0 || projects.length === 0) {
        throw new Error('Required data not found. Please seed beneficiaries, schemes, and projects first.');
      }

      // Create applications for different schemes and projects
      const applications = [];
      let applicationCounter = 1;

      for (let i = 0; i < beneficiaries.length; i++) {
        const beneficiary = beneficiaries[i];
        
        // Create 2-3 applications per beneficiary for different schemes
        const numApplications = Math.floor(Math.random() * 2) + 2; // 2-3 applications
        
        for (let j = 0; j < numApplications && j < schemes.length; j++) {
          const scheme = schemes[j];
          const project = projects.find(p => p._id.equals(scheme.project)) || projects[0];
          
          const year = new Date().getFullYear();
          const applicationNumber = `APP${year}${String(applicationCounter).padStart(6, '0')}`;
          applicationCounter++;

          // Vary application status for testing
          const statuses = ['pending', 'under_review', 'approved', 'rejected'];
          const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
          
          // Vary requested amounts within scheme limits
          const baseAmount = scheme.benefits.amount || 25000;
          const requestedAmount = baseAmount + (Math.floor(Math.random() * 10000) - 5000);

          const application = {
            applicationNumber,
            beneficiary: beneficiary._id,
            scheme: scheme._id,
            project: project._id,
            state: beneficiary.state,
            district: beneficiary.district,
            area: beneficiary.area,
            unit: beneficiary.unit,
            requestedAmount: Math.max(requestedAmount, 5000), // Minimum 5000
            status: randomStatus,
            priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
            documents: [
              {
                type: 'aadhaar',
                name: 'Aadhaar Card',
                url: `/documents/aadhaar_${beneficiary.phone}.pdf`,
                uploadedAt: new Date(),
                verified: true
              },
              {
                type: 'income_certificate',
                name: 'Income Certificate',
                url: `/documents/income_${beneficiary.phone}.pdf`,
                uploadedAt: new Date(),
                verified: true
              }
            ],
            timeline: [
              {
                status: 'submitted',
                date: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000), // Random date within last 30 days
                user: beneficiary._id,
                comments: 'Application submitted by beneficiary'
              }
            ],
            createdBy: beneficiary._id,
            createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000)
          };

          // Add additional timeline entries for non-pending applications
          if (randomStatus !== 'pending') {
            application.timeline.push({
              status: 'under_review',
              date: new Date(application.createdAt.getTime() + Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000),
              user: districtAdmin._id,
              comments: 'Application moved to review'
            });

            if (randomStatus === 'approved') {
              application.approvedAmount = application.requestedAmount;
              application.approvedBy = stateAdmin._id;
              application.approvedAt = new Date(application.createdAt.getTime() + Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000);
              application.timeline.push({
                status: 'approved',
                date: application.approvedAt,
                user: stateAdmin._id,
                comments: 'Application approved after review'
              });
            } else if (randomStatus === 'rejected') {
              application.rejectedBy = stateAdmin._id;
              application.rejectedAt = new Date(application.createdAt.getTime() + Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000);
              application.timeline.push({
                status: 'rejected',
                date: application.rejectedAt,
                user: stateAdmin._id,
                comments: 'Application rejected due to incomplete documentation'
              });
            }
          }

          applications.push(application);
        }
      }

      // Insert applications
      const createdApplications = [];
      for (const applicationData of applications) {
        const application = new Application(applicationData);
        await application.save();
        createdApplications.push(application);

        // Update beneficiary's applications array
        await Beneficiary.findByIdAndUpdate(
          applicationData.beneficiary,
          { $push: { applications: application._id } }
        );
      }

      console.log('✅ Application data seeded successfully');
      console.log(`📄 Created ${createdApplications.length} sample applications`);
      console.log(`📊 Status distribution:`);
      
      const statusCounts = {};
      createdApplications.forEach(app => {
        statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
      });
      
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });

      return createdApplications;
    } catch (error) {
      console.error('❌ Error seeding applications:', error);
      throw error;
    }
  }

  /**
   * Seed interview data for some applications
   */
  static async seedInterviews() {
    try {
      console.log('🌱 Seeding interview data...');

      // Check if interviews already exist
      const existingInterviews = await Interview.countDocuments();
      if (existingInterviews > 0) {
        console.log('📅 Interviews already exist, skipping seed');
        return;
      }

      // Get applications that require interviews (approved or under_review)
      const applications = await Application.find({
        status: { $in: ['approved', 'under_review'] }
      }).populate('beneficiary scheme project state district area unit');

      if (applications.length === 0) {
        console.log('📅 No applications found for interviews');
        return;
      }

      const stateAdmin = await User.findOne({ email: `admin@${emailDomain}` });
      const districtAdmin = await User.findOne({ email: `district.tvm@${emailDomain}` });

      // Create interviews for some applications
      const interviews = [];
      let interviewCounter = 1;

      for (let i = 0; i < Math.min(applications.length, 8); i++) { // Create max 8 interviews
        const application = applications[i];
        const year = new Date().getFullYear();
        const interviewNumber = `INT${year}${String(interviewCounter).padStart(6, '0')}`;
        interviewCounter++;

        // Vary interview status and dates
        const statuses = ['scheduled', 'completed', 'cancelled'];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        
        const scheduledDate = new Date(Date.now() + Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000); // Next 14 days
        const scheduledTime = ['10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM'][Math.floor(Math.random() * 4)];

        const interview = {
          interviewNumber,
          application: application._id,
          scheduledDate,
          scheduledTime,
          type: Math.random() > 0.5 ? 'offline' : 'online',
          location: 'District Office, Thiruvananthapuram',
          meetingLink: 'https://meet.google.com/abc-defg-hij',
          status: randomStatus,
          interviewers: [stateAdmin._id, districtAdmin._id],
          scheduledBy: districtAdmin._id,
          createdBy: districtAdmin._id
        };

        // Add completion details for completed interviews
        if (randomStatus === 'completed') {
          interview.result = Math.random() > 0.3 ? 'passed' : 'failed'; // 70% pass rate
          interview.completedAt = new Date(scheduledDate.getTime() + 60 * 60 * 1000); // 1 hour after scheduled
          interview.completedBy = stateAdmin._id;
          interview.notes = interview.result === 'passed' ? 
            'Candidate demonstrated good understanding of the scheme requirements and financial need.' :
            'Candidate did not meet the eligibility criteria during verification.';
        } else if (randomStatus === 'cancelled') {
          interview.rescheduleReason = 'Beneficiary requested rescheduling due to personal emergency';
        }

        interviews.push(interview);
      }

      // Insert interviews
      const createdInterviews = [];
      for (const interviewData of interviews) {
        const interview = new Interview(interviewData);
        await interview.save();
        createdInterviews.push(interview);
      }

      console.log('✅ Interview data seeded successfully');
      console.log(`📅 Created ${createdInterviews.length} sample interviews`);
      
      const statusCounts = {};
      createdInterviews.forEach(interview => {
        statusCounts[interview.status] = (statusCounts[interview.status] || 0) + 1;
      });
      
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });

      return createdInterviews;
    } catch (error) {
      console.error('❌ Error seeding interviews:', error);
      throw error;
    }
  }

  /**
   * Run all seed operations
   */
  static async seedAll() {
    try {
      console.log('🚀 Starting database seeding...');
      
      await this.seedLocations();
      await this.seedUsers();
      await this.seedProjects();
      await this.seedSchemes();
      await this.seedBeneficiaries();
      await this.seedApplications();
      await this.seedInterviews();
      
      console.log('🎉 Database seeding completed successfully!');
    } catch (error) {
      console.error('❌ Database seeding failed:', error);
      throw error;
    }
  }

  /**
   * Clear all data
   */
  static async clearAll() {
    try {
      console.log('🧹 Clearing all data...');
      
      await Interview.deleteMany({});
      await Application.deleteMany({});
      await Beneficiary.deleteMany({});
      await Scheme.deleteMany({});
      await Project.deleteMany({});
      await User.deleteMany({});
      await Location.deleteMany({});
      
      console.log('✅ All data cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing data:', error);
      throw error;
    }
  }
}

module.exports = SeedData;
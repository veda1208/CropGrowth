const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Fertilizer = require('../models/Fertilizer');
const Crop = require('../models/Crop');
const Rule = require('../models/Rule');

const initialFertilizers = [
  {
    fertilizerId: 'urea',
    name: 'Urea',
    nutrientComposition: { N: 46, P: 0, K: 0, label: '46-0-0' },
    type: 'Urea',
    instructions: 'Apply in split doses (basal + vegetative top-dressing). Avoid applying on standing water or just before heavy rain.'
  },
  {
    fertilizerId: 'dap',
    name: 'DAP',
    nutrientComposition: { N: 18, P: 46, K: 0, label: '18-46-0' },
    type: 'DAP',
    instructions: 'Best applied as basal dose at sowing/transplanting near the root zone for early root establishment.'
  },
  {
    fertilizerId: 'mop',
    name: 'MOP (Potash)',
    nutrientComposition: { N: 0, P: 0, K: 60, label: '0-0-60' },
    type: 'Potash',
    instructions: 'Apply during basal and flowering/fruiting stages to improve grain filling, fruit quality, and disease resistance.'
  },
  {
    fertilizerId: 'organic_fym',
    name: 'Vermicompost / FYM',
    nutrientComposition: { N: 1.5, P: 1.0, K: 1.5, label: 'Organic' },
    type: 'Organic',
    instructions: 'Incorporate into soil 2-3 weeks before sowing to improve soil structure and microbial activity.'
  }
];

const initialCrops = [
  {
    cropId: 'rice',
    cropName: 'Rice / Paddy',
    emoji: '🌾',
    typicalNPK: {
      summary: 'Nitrogen-focused; balanced phosphorus and potassium',
      N: 120,
      P: 60,
      K: 40
    },
    notes: 'Split nutrient applications are commonly used in paddy. Follow local soil-test recommendations and water-management advice.',
    recommendedFertilizers: [
      { fertilizerId: 'urea', name: 'Urea', rate: 45, unit: 'kg/acre', why: 'Nitrogen source; use only as advised for the crop stage.' },
      { fertilizerId: 'dap', name: 'DAP', rate: 20, unit: 'kg/acre', why: 'Provides phosphorus and some nitrogen.' },
      { fertilizerId: 'mop', name: 'MOP (Potash)', rate: 15, unit: 'kg/acre', why: 'Potassium source where required.' }
    ]
  },
  {
    cropId: 'maize',
    cropName: 'Maize',
    emoji: '🌽',
    typicalNPK: {
      summary: 'Balanced N-P-K; nitrogen demand increases during vegetative growth',
      N: 120,
      P: 60,
      K: 50
    },
    notes: 'Nutrient needs vary with hybrid, season, soil and irrigation. Split nitrogen as advised locally.',
    recommendedFertilizers: [
      { fertilizerId: 'urea', name: 'Urea', rate: 40, unit: 'kg/acre', why: 'Nitrogen source; timing should match crop stage.' },
      { fertilizerId: 'dap', name: 'DAP', rate: 18, unit: 'kg/acre', why: 'Phosphorus source, generally considered near planting.' },
      { fertilizerId: 'mop', name: 'MOP (Potash)', rate: 12, unit: 'kg/acre', why: 'Potassium source where required.' }
    ]
  },
  {
    cropId: 'cotton',
    cropName: 'Cotton',
    emoji: '☁️',
    typicalNPK: {
      summary: 'Balanced N-P-K with attention to potassium',
      N: 90,
      P: 45,
      K: 45
    },
    notes: 'Avoid excess nitrogen. Adjust nutrient plan to soil test, variety and local agricultural guidance.',
    recommendedFertilizers: [
      { fertilizerId: 'urea', name: 'Urea', rate: 30, unit: 'kg/acre', why: 'Nitrogen source; avoid over-application.' },
      { fertilizerId: 'dap', name: 'DAP', rate: 18, unit: 'kg/acre', why: 'Phosphorus source.' },
      { fertilizerId: 'mop', name: 'MOP (Potash)', rate: 18, unit: 'kg/acre', why: 'Potassium source where required.' }
    ]
  },
  {
    cropId: 'chilli',
    cropName: 'Chilli',
    emoji: '🌶️',
    typicalNPK: {
      summary: 'Balanced nutrition; potassium is important during flowering and fruiting',
      N: 100,
      P: 50,
      K: 50
    },
    notes: 'Use split applications and avoid fertilizer contact with stems or leaves. Confirm rates locally.',
    recommendedFertilizers: [
      { fertilizerId: 'urea', name: 'Urea', rate: 25, unit: 'kg/acre', why: 'Nitrogen source; split application may be appropriate.' },
      { fertilizerId: 'dap', name: 'DAP', rate: 15, unit: 'kg/acre', why: 'Phosphorus source.' },
      { fertilizerId: 'mop', name: 'MOP (Potash)', rate: 15, unit: 'kg/acre', why: 'Potassium source where required.' }
    ]
  },
  {
    cropId: 'tomato',
    cropName: 'Tomato',
    emoji: '🍅',
    typicalNPK: {
      summary: 'Balanced N-P-K; potassium demand is important during fruiting',
      N: 100,
      P: 60,
      K: 60
    },
    notes: 'Avoid excess nitrogen during fruiting. Base final rates on soil test and local horticulture advice.',
    recommendedFertilizers: [
      { fertilizerId: 'urea', name: 'Urea', rate: 22, unit: 'kg/acre', why: 'Nitrogen source; use carefully during fruiting.' },
      { fertilizerId: 'dap', name: 'DAP', rate: 15, unit: 'kg/acre', why: 'Phosphorus source.' },
      { fertilizerId: 'mop', name: 'MOP (Potash)', rate: 18, unit: 'kg/acre', why: 'Potassium source where required.' }
    ]
  }
];

const initialRules = [
  {
    ruleId: 'rule_rice_veg_low_n',
    cropId: 'rice',
    condition: { minPh: 5.5, maxPh: 8.0, nLevel: 'low', pLevel: 'any', kLevel: 'any', growthStage: 'vegetative' },
    recommendations: [
      {
        fertilizerId: 'urea',
        name: 'Urea',
        quantityPerHa: 120,
        timing: 'Apply 50% now at active tillering and 50% after 21 days',
        notes: 'Example hackathon rule: Rice + Low N + Vegetative stage -> Urea split application'
      }
    ]
  },
  {
    ruleId: 'rule_maize_veg_low_n',
    cropId: 'maize',
    condition: { minPh: 5.5, maxPh: 8.0, nLevel: 'low', pLevel: 'any', kLevel: 'any', growthStage: 'vegetative' },
    recommendations: [
      {
        fertilizerId: 'urea',
        name: 'Urea',
        quantityPerHa: 105,
        timing: 'Side-dress at knee-high stage and repeat before tasseling',
        notes: 'Maize vegetative nitrogen boost'
      }
    ]
  }
];

async function ensureSeedData() {
  // 1. Seed default Admin / Agronomist account
  const adminEmail = 'admin@cropgrowth.demo';
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('Admin123', 10);
    await User.create({
      name: 'CropGrowth Admin',
      email: adminEmail,
      passwordHash,
      role: 'admin',
      phone: '9876543210',
      location: 'Telangana'
    });
    console.log('✅ Seeded default Admin account: admin@cropgrowth.demo / Admin123');
  }

  // 2. Seed Fertilizers
  const fertCount = await Fertilizer.countDocuments();
  if (fertCount === 0) {
    await Fertilizer.insertMany(initialFertilizers);
    console.log('✅ Seeded Fertilizers collection');
  }

  // 3. Seed Crops
  const cropCount = await Crop.countDocuments();
  if (cropCount === 0) {
    await Crop.insertMany(initialCrops);
    console.log('✅ Seeded Crops collection');
  }

  // 4. Seed Rules
  const ruleCount = await Rule.countDocuments();
  if (ruleCount === 0) {
    await Rule.insertMany(initialRules);
    console.log('✅ Seeded Rules collection');
  }
}

module.exports = { ensureSeedData, initialCrops, initialFertilizers, initialRules };

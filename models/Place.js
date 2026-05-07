const mongoose = require('mongoose');

const placeSchema = new mongoose.Schema({
  id:            { type: String, unique: true, sparse: true },
  name:          { type: String, required: true },
  kind:          { type: String, enum: ['diem-du-lich', 'trai-nghiem', 'khach-san', 'nha-hang', 'giai-tri', 'tien-ich'], default: 'diem-du-lich' },
  // Tour-specific fields
  isTour:        { type: Boolean, default: false },
  isUtility:     { type: Boolean, default: false },
  tourDuration:  { type: String, default: '' },        // VD: '3N2Đ'
  tourIncludes:  [String],                              // Bao gồm: ăn sáng, xe đón...
  tourGroupSize: { type: Number, default: null },       // Số khách tối đa
  tourDifficulty:{ type: String, enum: ['easy','medium','hard'], default: 'easy' },
  tourItinerary: [{ day: Number, title: String, detail: String }], // Lịch trình theo ngày
  region:        { type: String, default: '' },
  address:       { type: String, default: '' },
  description:   { type: String, default: '' },
  overview:      { type: String, default: '' },
  highlights:    [String],
  experience:    { type: String, default: '' },
  themeColor:    { type: String, default: '#3b82f6' },
  text:          { type: String, default: '' }, // Legacy, used by some features
  meta:          { type: String, default: '' },
  image:         { type: String, default: '' },
  images:        [String],
  tags:          [String],
  interests:     [String],
  habits:        [String],
  budget:        { type: Number, default: 2 },
  pace:          { type: String, default: 'vua' },
  top:           { type: Boolean, default: false },
  verified:      { type: Boolean, default: false },
  ownerId:       { type: String, default: null },   // userId string from JWT
  status:        { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  source:        { type: String, enum: ['system', 'partner'], default: 'system' },
  rejectionReason: { type: String, default: '' },

  // Business-specific fields
  priceFrom:     { type: Number, default: null },
  priceTo:       { type: Number, default: null },
  openTime:      { type: String, default: '' },
  closeTime:     { type: String, default: '' },
  openDays:      { type: String, default: '' },
  amenities:     [String],
  contactPhone:  { type: String, default: '' },
  contactEmail:  { type: String, default: '' },
  website:       { type: String, default: '' },

  // Source info
  sourceName:    { type: String, default: '' },
  sourceUrl:     { type: String, default: '' },
  videoUrl:      { type: String, default: '' }, // Thêm trường này
  transportTips: { type: String, default: '' },

  // Nested details (kept for backward compat)
  activities: [{ dayPart: String, title: String, tip: String }],
  amusementPlaces: [{
    name: String, image: String,
    rating: { type: Number, default: 0 },
    description: String, ticketPrice: String,
    openingHours: String, address: String
  }],
  accommodations: [{
    name: String, image: String,
    rating: { type: Number, default: 0 },
    description: String, priceRange: String, address: String
  }],
  diningPlaces: [{
    name: String, image: String,
    rating: { type: Number, default: 0 },
    description: String, priceRange: String, address: String
  }],
  checkInSpots: [{
    name: String, image: String,
    rating: { type: Number, default: 0 },
    description: String, address: String
  }],

  // User interaction
  favoritesCount: { type: Number, default: 0 },
  ratingAvg:      { type: String, default: '0' },
  reviewCount:    { type: Number, default: 0 },
  reviews: [{
    userId:    String,
    userName:  { type: String, default: 'Khách' },
    rating:    { type: Number, min: 1, max: 5 },
    text:      String,
    createdAt: { type: Date, default: Date.now }
  }],

  // Geographic
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },

  createdAt: { type: Date, default: Date.now }
});

// Indexes for fast lookup
placeSchema.index({ region: 1 });
placeSchema.index({ tags: 1 });
placeSchema.index({ name: 'text' });
placeSchema.index({ ownerId: 1 });

module.exports = mongoose.model('Place', placeSchema);

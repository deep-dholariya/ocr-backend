import mongoose from "mongoose";

const businessCardSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    imagePath: {
      type: String,
      required: true,
      trim: true,
    },

    extractedText: {
      type: String,
      default: "",
      trim: true,
    },

    rawLines: {
      type: [String],
      default: [],
    },

    name: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    company: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    designation: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    email: {
      type: String,
      default: "",
      lowercase: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    website: {
      type: String,
      default: "",
      trim: true,
    },

    address: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    // Complete parsed object
    structuredData: {
      type: Object,
      default: {},
    },

    status: {
      type: String,
      enum: ["pending", "processed", "failed"],
      default: "processed",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * --------------------------------------------------------------------------
 * Indexes
 * --------------------------------------------------------------------------
 */

// NOTE: name, company, designation, email, phone, and address already get
// a single-field index from `index: true` on their schema definitions
// above — redeclaring `schema.index({ field: 1 })` for the same field
// causes Mongoose "Duplicate schema index" warnings at startup and creates
// two identical indexes in MongoDB. Only compound / non-field-level
// indexes are declared here.
businessCardSchema.index({ user: 1, createdAt: -1 });
businessCardSchema.index({ createdAt: -1 });

/**
 * Optional Text Search Index
 * Allows searching across all major fields
 */
businessCardSchema.index({
  name: "text",
  company: "text",
  designation: "text",
  email: "text",
  phone: "text",
  website: "text",
  address: "text",
});

/**
 * --------------------------------------------------------------------------
 * Virtual
 * --------------------------------------------------------------------------
 */

businessCardSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

/**
 * --------------------------------------------------------------------------
 * Schema Options
 * --------------------------------------------------------------------------
 */

businessCardSchema.set("toJSON", {
  virtuals: true,
});

businessCardSchema.set("toObject", {
  virtuals: true,
});

const BusinessCard = mongoose.model(
  "BusinessCard",
  businessCardSchema
);

export default BusinessCard;
const mongoose = require("mongoose");

/* ============================================================
   DELIVERY SCHEMA
============================================================ */

const deliverySchema = new mongoose.Schema(
  {
    min: {
      type: Number,
      required: true,
      min: 0,
      default: 2,
    },

    max: {
      type: Number,
      required: true,
      min: 0,
      default: 4,
    },

    unit: {
      type: String,
      enum: ["hours", "days", "weeks"],
      default: "days",
      trim: true,
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   SHIPPING METHOD SCHEMA
============================================================ */

const shippingMethodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },

    code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 1,
      maxlength: 50,
    },

    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: "MAD",
      maxlength: 10,
    },

    delivery: {
      type: deliverySchema,
      default: () => ({}),
    },

    /*
     * هل هذه الطريقة تستفيد من الشحن المجاني
     * عندما يصل الطلب إلى الحد الأدنى؟
     */
    freeShippingEligible: {
      type: Boolean,
      default: true,
    },

    /*
     * هل طريقة الشحن متاحة للزبائن؟
     */
    enabled: {
      type: Boolean,
      default: true,
    },

    /*
     * ترتيب ظهور طريقة الشحن في Checkout
     */
    sortOrder: {
      type: Number,
      min: 0,
      default: 0,
    },

    /*
     * Soft Delete
     */
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    createdBy: {
      type: String,
      trim: true,
      default: null,
    },

    updatedBy: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/* ============================================================
   INDEXES
============================================================ */

shippingMethodSchema.index({
  code: 1,
});

shippingMethodSchema.index({
  enabled: 1,
  isDeleted: 1,
  sortOrder: 1,
});

shippingMethodSchema.index({
  isDeleted: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "ShippingMethod",
  shippingMethodSchema
);
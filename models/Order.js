const mongoose = require("mongoose");

/* ============================================================
   ORDER ITEM
============================================================ */

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      default: "",
      trim: true,
    },

    thumbnail: {
      type: String,
      default: "",
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    color: {
      type: String,
      default: null,
      trim: true,
    },

    size: {
      type: String,
      default: null,
      trim: true,
    },

    volume: {
      type: Number,
      default: null,
      min: 0,
    },

    volumeUnit: {
      type: String,
      default: null,
      trim: true,
    },

    variantId: {
      type: String,
      default: null,
      trim: true,
    },

    sku: {
      type: String,
      default: null,
      trim: true,
    },

    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   CUSTOMER
============================================================ */

const customerSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },

    email: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   SHIPPING ADDRESS
============================================================ */

const shippingAddressSchema = new mongoose.Schema(
  {
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   SHIPPING
============================================================ */

const shippingSchema = new mongoose.Schema(
  {
    methodId: {
      type: String,
      required: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    code: {
      type: String,
      default: "",
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "MAD",
      trim: true,
      uppercase: true,
    },

    delivery: {
      min: {
        type: Number,
        min: 0,
        default: null,
      },

      max: {
        type: Number,
        min: 0,
        default: null,
      },

      unit: {
        type: String,
        default: "days",
        trim: true,
      },
    },

    freeShippingApplied: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   PAYMENT
============================================================ */

const paymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ["cod"],
      required: true,
      default: "cod",
    },

    status: {
      type: String,
      enum: [
        "pending",
        "paid",
        "failed",
        "refunded",
      ],
      default: "pending",
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   PRICING
============================================================ */

const pricingSchema = new mongoose.Schema(
  {
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    shipping: {
      type: Number,
      required: true,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "MAD",
      trim: true,
      uppercase: true,
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   STATUS HISTORY
============================================================ */

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "returned",
      ],
      required: true,
    },

    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    changedBy: {
      type: String,
      default: "system",
      trim: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   ORDER SCHEMA
============================================================ */

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    customer: {
      type: customerSchema,
      required: true,
    },

    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },

    shipping: {
      type: shippingSchema,
      required: true,
    },

    payment: {
      type: paymentSchema,
      required: true,
    },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: function (items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: "Order must contain at least one item.",
      },
    },

    pricing: {
      type: pricingSchema,
      required: true,
    },

    itemsCount: {
      type: Number,
      required: true,
      min: 1,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "returned",
      ],
      default: "pending",
      index: true,
    },

    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancellationReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    inventoryRestored: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: String,
      default: "customer",
      trim: true,
    },

    updatedBy: {
      type: String,
      default: "customer",
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ============================================================
   INDEXES
============================================================ */

orderSchema.index({
  "customer.phone": 1,
});

orderSchema.index({
  "customer.email": 1,
});

orderSchema.index({
  status: 1,
  createdAt: -1,
});

orderSchema.index({
  createdAt: -1,
});

module.exports = mongoose.model("Order", orderSchema);
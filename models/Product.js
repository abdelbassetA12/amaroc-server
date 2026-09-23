const mongoose = require("mongoose");

/* ============================================================
   VARIANT SCHEMA
   يدعم:
   - المنتجات العادية: color + size
   - العطور: volume + volumeUnit
============================================================ */
 
const variantSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },

    color: {
      type: String,
      trim: true,
      default: null,
    },

    colorValue: {
      type: String,
      trim: true,
      default: null,
    },

    size: {
      type: String,
      trim: true,
      default: null,
    },

    sizeValue: {
      type: String,
      trim: true,
      default: null,
    },

    volume: {
      type: Number,
      min: 0,
      default: null,
    },

    volumeUnit: {
      type: String,
      trim: true,
      default: null,
    },

    sku: {
      type: String,
      trim: true,
      default: null,
    },

    price: {
      type: Number,
      min: 0,
      default: null,
    },

    quantity: {
      type: Number,
      min: 0,
      default: 0,
    },

    image: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   IMAGE SCHEMA
============================================================ */

const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },

    alt: {
      type: String,
      trim: true,
      default: "",
    },

    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   CATEGORY SCHEMA
============================================================ */

const categorySchema = new mongoose.Schema(
  {
    id: {
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
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   SUBCATEGORY SCHEMA
============================================================ */

const subcategorySchema = new mongoose.Schema(
  {
    id: {
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
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   PRICING SCHEMA
============================================================ */

const pricingSchema = new mongoose.Schema(
  {
    regularPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    salePrice: {
      type: Number,
      default: null,
      min: 0,
    },

    currency: {
      type: String,
      default: "MAD",
      trim: true,
    },

    discount: {
      enabled: {
        type: Boolean,
        default: false,
      },

      type: {
        type: String,
        enum: ["percentage", "fixed", null],
        default: null,
      },

      value: {
        type: Number,
        min: 0,
        default: 0,
      },

      startDate: {
        type: Date,
        default: null,
      },

      endDate: {
        type: Date,
        default: null,
      },
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   INVENTORY SCHEMA
============================================================ */

const inventorySchema = new mongoose.Schema(
  {
    quantity: {
      type: Number,
      min: 0,
      default: 0,
    },

    trackQuantity: {
      type: Boolean,
      default: true,
    },

    lowStockThreshold: {
      type: Number,
      min: 0,
      default: 5,
    },

    status: {
      type: String,
      enum: [
        "in_stock",
        "low_stock",
        "out_of_stock",
      ],
      default: "in_stock",
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   DIMENSIONS SCHEMA
============================================================ */

const dimensionsSchema = new mongoose.Schema(
  {
    length: {
      type: Number,
      min: 0,
      default: null,
    },

    width: {
      type: Number,
      min: 0,
      default: null,
    },

    height: {
      type: Number,
      min: 0,
      default: null,
    },

    unit: {
      type: String,
      trim: true,
      default: "cm",
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   WEIGHT SCHEMA
============================================================ */

const weightSchema = new mongoose.Schema(
  {
    value: {
      type: Number,
      min: 0,
      default: null,
    },

    unit: {
      type: String,
      trim: true,
      default: "kg",
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   STATUS SCHEMA
============================================================ */

const statusSchema = new mongoose.Schema(
  {
    active: {
      type: Boolean,
      default: true,
    },

    published: {
      type: Boolean,
      default: false,
    },

    featured: {
      type: Boolean,
      default: false,
    },

    bestseller: {
      type: Boolean,
      default: false,
    },

    newProduct: {
      type: Boolean,
      default: false,
    },

    archived: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   BADGE SCHEMA
============================================================ */

const badgeSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },

    type: {
      type: String,
      trim: true,
      default: null,
    },

    text: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   RATING SCHEMA
============================================================ */

const ratingSchema = new mongoose.Schema(
  {
    average: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },

    count: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   SALES SCHEMA
============================================================ */

const salesSchema = new mongoose.Schema(
  {
    orders: {
      type: Number,
      min: 0,
      default: 0,
    },

    unitsSold: {
      type: Number,
      min: 0,
      default: 0,
    },

    views: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   DETAILS SCHEMA
============================================================ */

const detailsSchema = new mongoose.Schema(
  {
    material: {
      type: String,
      trim: true,
      default: null,
    },

    gender: {
      type: String,
      trim: true,
      default: null,
    },

    style: {
      type: String,
      trim: true,
      default: null,
    },

    season: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    countryOfOrigin: {
      type: String,
      trim: true,
      default: null,
    },

    warranty: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   SHIPPING SCHEMA
============================================================ */

const shippingSchema = new mongoose.Schema(
  {
    available: {
      type: Boolean,
      default: true,
    },

    freeShipping: {
      type: Boolean,
      default: false,
    },

    defaultPrice: {
      type: Number,
      min: 0,
      default: 0,
    },

    estimatedDelivery: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   SEO SCHEMA
============================================================ */

const seoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    keywords: {
      type: [String],
      default: [],
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   PERFUME SCHEMA
============================================================ */

const perfumeSchema = new mongoose.Schema(
  {
    gender: {
      type: String,
      trim: true,
      default: null,
    },

    concentration: {
      type: String,
      trim: true,
      default: null,
    },

    fragranceFamily: {
      type: String,
      trim: true,
      default: null,
    },

    topNotes: {
      type: [String],
      default: [],
    },

    middleNotes: {
      type: [String],
      default: [],
    },

    baseNotes: {
      type: [String],
      default: [],
    },

    longevity: {
      type: String,
      trim: true,
      default: null,
    },

    sillage: {
      type: String,
      trim: true,
      default: null,
    },

    season: {
      type: [String],
      default: [],
    },

    occasion: {
      type: [String],
      default: [],
    },
  },
  {
    _id: false,
  }
);

/* ============================================================
   PRODUCT SCHEMA
============================================================ */

const productSchema = new mongoose.Schema(
  {
    /*
      نستخدم String هنا عمداً
      للحفاظ على IDs الحالية مثل:
      product-001
      product-002
      009
    */
    _id: {
      type: String,
      required: true,
    },

    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    shortDescription: {
      type: String,
      default: "",
      trim: true,
    },

    brand: {
      type: String,
      default: "",
      trim: true,
    },

    category: {
      type: categorySchema,
      required: true,
    },

    subcategory: {
      type: subcategorySchema,
      default: null,
    },

    tags: {
      type: [String],
      default: [],
    },

    features: {
      type: [String],
      default: [],
    },

    images: {
      type: [imageSchema],
      default: [],
    },

    thumbnail: {
      type: String,
      default: "",
      trim: true,
    },

    pricing: {
      type: pricingSchema,
      required: true,
    },

    inventory: {
      type: inventorySchema,
      default: () => ({}),
    },

    variants: {
      type: [variantSchema],
      default: [],
    },

    dimensions: {
      type: dimensionsSchema,
      default: () => ({}),
    },

    weight: {
      type: weightSchema,
      default: () => ({}),
    },

    status: {
      type: statusSchema,
      default: () => ({}),
    },

    badge: {
      type: badgeSchema,
      default: () => ({}),
    },

    rating: {
      type: ratingSchema,
      default: () => ({}),
    },

    sales: {
      type: salesSchema,
      default: () => ({}),
    },

    details: {
      type: detailsSchema,
      default: () => ({}),
    },

    shipping: {
      type: shippingSchema,
      default: () => ({}),
    },

    relatedProducts: {
      type: [String],
      default: [],
    },

    careInstructions: {
      type: [String],
      default: [],
    },

    seo: {
      type: seoSchema,
      default: () => ({}),
    },

    /*
      نخزن ID الأدمن كنص حتى نستطيع
      أيضاً الحفاظ على الشكل القديم:
      "admin"
      "admin-user-001"
    */
    createdBy: {
      type: String,
      default: null,
      trim: true,
    },

    updatedBy: {
      type: String,
      default: null,
      trim: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
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

productSchema.index({
  name: "text",
  description: "text",
  shortDescription: "text",
  sku: "text",
  tags: "text",
});

productSchema.index({
  "category.id": 1,
});

productSchema.index({
  "category.slug": 1,
});

productSchema.index({
  "subcategory.id": 1,
});

productSchema.index({
  "subcategory.slug": 1,
});

productSchema.index({
  "status.active": 1,
  "status.published": 1,
});

productSchema.index({
  "status.featured": 1,
});

productSchema.index({
  "inventory.status": 1,
});

/* ============================================================
   EXPORT
============================================================ */

module.exports = mongoose.model("Product", productSchema);
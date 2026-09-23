const express = require("express");
const Joi = require("joi");
const Product = require("../models/Product");
const protect = require("../middleware/auth");

const router = express.Router();

/* ============================================================
   HELPERS
============================================================ */
 
/*
  تحديد حالة المخزون تلقائياً
*/
const calculateInventoryStatus = (
  quantity,
  lowStockThreshold = 5,
  trackQuantity = true
) => {
  if (!trackQuantity) {
    return "in_stock";
  }

  if (quantity <= 0) {
    return "out_of_stock";
  }

  if (quantity <= lowStockThreshold) {
    return "low_stock";
  }

  return "in_stock";
};

/*
  تحديث كمية المنتج من الـ variants
*/
const calculateVariantQuantity = (variants = []) => {
  if (!Array.isArray(variants) || variants.length === 0) {
    return null;
  }

  return variants.reduce((total, variant) => {
    return total + Number(variant.quantity || 0);
  }, 0);
};

/*
  تجهيز بيانات المنتج قبل الحفظ
*/
const normalizeProductData = (data, adminId) => {
  const product = {
    ...data,
  };

  /*
    إذا كان هناك variants
    فالـ inventory quantity يجب أن يعكس مجموعها.
  */
  if (
    Array.isArray(product.variants) &&
    product.variants.length > 0
  ) {
    const variantQuantity =
      calculateVariantQuantity(product.variants);

    product.inventory = {
      ...(product.inventory || {}),
      quantity: variantQuantity,
    };
  }

  const inventory = product.inventory || {};

  inventory.status = calculateInventoryStatus(
    Number(inventory.quantity || 0),
    Number(inventory.lowStockThreshold ?? 5),
    inventory.trackQuantity !== false
  );

  product.inventory = inventory;

  /*
    إذا لم توجد صورة Primary،
    نجعل أول صورة هي Primary.
  */
  if (
    Array.isArray(product.images) &&
    product.images.length > 0
  ) {
    const hasPrimary = product.images.some(
      (image) => image.isPrimary === true
    );

    if (!hasPrimary) {
      product.images[0].isPrimary = true;
    }
  }

  /*
    createdBy / updatedBy
  */
  if (adminId) {
    product.updatedBy = String(adminId);
  }

  return product;
};

/* ============================================================
   VALIDATION
============================================================ */

const productSchema = Joi.object({
  _id: Joi.string().trim().min(1).max(100),

  sku: Joi.string().trim().min(1).max(100).required(),

  name: Joi.string().trim().min(1).max(300).required(),

  slug: Joi.string().trim().min(1).max(300).required(),

  description: Joi.string().allow("").default(""),

  shortDescription: Joi.string().allow("").default(""),

  brand: Joi.string().allow("").default(""),

  category: Joi.object({
    id: Joi.string().trim().required(),
    name: Joi.string().trim().required(),
    slug: Joi.string().trim().required(),
  }).required(),

  subcategory: Joi.object({
    id: Joi.string().trim().required(),
    name: Joi.string().trim().required(),
    slug: Joi.string().trim().required(),
  }).allow(null),

  tags: Joi.array()
    .items(Joi.string().trim())
    .default([]),

  features: Joi.array()
    .items(Joi.string().trim())
    .default([]),

  images: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().trim().required(),
        alt: Joi.string().allow("").default(""),
        isPrimary: Joi.boolean().default(false),
      })
    )
    .default([]),

  thumbnail: Joi.string().allow("").default(""),

  pricing: Joi.object({
    regularPrice: Joi.number().min(0).required(),

    salePrice: Joi.number().min(0).allow(null),

    currency: Joi.string().trim().default("MAD"),

    discount: Joi.object({
      enabled: Joi.boolean().default(false),

      type: Joi.string()
        .valid("percentage", "fixed")
        .allow(null),

      value: Joi.number().min(0).default(0),

      startDate: Joi.date().allow(null),

      endDate: Joi.date().allow(null),
    }).default({}),
  }).required(),

  inventory: Joi.object({
    quantity: Joi.number().min(0).default(0),

    trackQuantity: Joi.boolean().default(true),

    lowStockThreshold: Joi.number()
      .min(0)
      .default(5),

    status: Joi.string()
      .valid(
        "in_stock",
        "low_stock",
        "out_of_stock"
      ),
  }).default({}),

  variants: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().trim().required(),

        color: Joi.string()
          .trim()
          .allow(null, ""),

        colorValue: Joi.string()
          .trim()
          .allow(null, ""),

        size: Joi.string()
          .trim()
          .allow(null, ""),

        sizeValue: Joi.string()
          .trim()
          .allow(null, ""),

        volume: Joi.number()
          .min(0)
          .allow(null),

        volumeUnit: Joi.string()
          .trim()
          .allow(null, ""),

        sku: Joi.string()
          .trim()
          .allow(null, ""),

        price: Joi.number()
          .min(0)
          .allow(null),

        quantity: Joi.number()
          .min(0)
          .default(0),

        image: Joi.string()
          .trim()
          .allow(null, ""),
      })
    )
    .default([]),

  dimensions: Joi.object({
    length: Joi.number().min(0).allow(null),
    width: Joi.number().min(0).allow(null),
    height: Joi.number().min(0).allow(null),
    unit: Joi.string().trim().default("cm"),
  }).default({}),

  weight: Joi.object({
    value: Joi.number().min(0).allow(null),
    unit: Joi.string().trim().default("kg"),
  }).default({}),

  status: Joi.object({
    active: Joi.boolean().default(true),
    published: Joi.boolean().default(false),
    featured: Joi.boolean().default(false),
    bestseller: Joi.boolean().default(false),
    newProduct: Joi.boolean().default(false),
    archived: Joi.boolean().default(false),
  }).default({}),

  badge: Joi.object({
    enabled: Joi.boolean().default(false),
    type: Joi.string().trim().allow(null, ""),
    text: Joi.string().trim().allow(null, ""),
  }).default({}),

  rating: Joi.object({
    average: Joi.number().min(0).max(5).default(0),
    count: Joi.number().min(0).default(0),
  }).default({}),

  sales: Joi.object({
    orders: Joi.number().min(0).default(0),
    unitsSold: Joi.number().min(0).default(0),
    views: Joi.number().min(0).default(0),
  }).default({}),

  details: Joi.object({
    material: Joi.string().trim().allow(null, ""),
    gender: Joi.string().trim().allow(null, ""),
    style: Joi.string().trim().allow(null, ""),
    season: Joi.any().allow(null),
    countryOfOrigin: Joi.string()
      .trim()
      .allow(null, ""),
    warranty: Joi.string()
      .trim()
      .allow(null, ""),
  }).default({}),

  shipping: Joi.object({
    available: Joi.boolean().default(true),

    freeShipping: Joi.boolean().default(false),

    defaultPrice: Joi.number().min(0).default(0),

    estimatedDelivery: Joi.string()
      .trim()
      .allow(null, ""),
  }).default({}),

  relatedProducts: Joi.array()
    .items(Joi.string().trim())
    .default([]),

  careInstructions: Joi.array()
    .items(Joi.string().trim())
    .default([]),

  seo: Joi.object({
    title: Joi.string().allow("").default(""),

    description: Joi.string()
      .allow("")
      .default(""),

    keywords: Joi.array()
      .items(Joi.string().trim())
      .default([]),
  }).default({}),

  createdBy: Joi.string().trim().allow(null, ""),

  updatedBy: Joi.string().trim().allow(null, ""),

  isDeleted: Joi.boolean().default(false),
}).unknown(false);

/* ============================================================
   POST /api/products
   CREATE PRODUCT
============================================================ */

router.post("/", protect, async (req, res) => {
  try {
    const { error, value } =
      productSchema.validate(req.body, {
        abortEarly: true,
        stripUnknown: false,
      });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    /*
      إذا لم يرسل frontend _id
      ننشئ ID جديداً.
    */
    if (!value._id) {
      value._id = `product-${Date.now()}`;
    }

    /*
      createdBy و updatedBy من الأدمن المسجل
    */
    value.createdBy = String(req.admin._id);
    value.updatedBy = String(req.admin._id);

    /*
      المنتجات الجديدة ليست محذوفة
      إلا إذا كان هناك سبب صريح لاحقاً.
    */
    value.isDeleted = false;

    const normalizedData = normalizeProductData(
      value,
      req.admin._id
    );

    /*
      منع تكرار SKU
    */
    const existingSku = await Product.findOne({
      sku: normalizedData.sku,
    });

    if (existingSku) {
      return res.status(409).json({
        success: false,
        message: "Product SKU already exists",
      });
    }

    /*
      منع تكرار slug
    */
    const existingSlug = await Product.findOne({
      slug: normalizedData.slug,
    });

    if (existingSlug) {
      return res.status(409).json({
        success: false,
        message: "Product slug already exists",
      });
    }

    /*
      منع تكرار ID
    */
    const existingId = await Product.findById(
      normalizedData._id
    );

    if (existingId) {
      return res.status(409).json({
        success: false,
        message: "Product ID already exists",
      });
    }

    const product = await Product.create(
      normalizedData
    );

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("CREATE PRODUCT ERROR:", error);

    /*
      Mongo duplicate key
    */
    if (error.code === 11000) {
      const field = Object.keys(
        error.keyPattern || {}
      )[0];

      return res.status(409).json({
        success: false,
        message: `${field || "Product"} already exists`,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* ============================================================
   GET /api/products
   GET PRODUCTS
============================================================ */

router.get("/", async (req, res) => {
  try {
    const {
      search,
      category,
      subcategory,
      status,
      featured,
      bestseller,
      newProduct,
      published,
      active,
      archived,
      deleted,
      inventoryStatus,
      page = 1,
      limit = 20,
      sort = "-createdAt",
    } = req.query;

    const query = {};

    /*
      المنتجات المحذوفة لا تظهر افتراضياً
    */
    if (deleted === "true") {
      query.isDeleted = true;
    } else if (deleted === "false") {
      query.isDeleted = false;
    } else {
      query.isDeleted = false;
    }

    /*
      Search
    */
    if (search && search.trim()) {
      const searchRegex = new RegExp(
        search.trim(),
        "i"
      );

      query.$or = [
        { name: searchRegex },
        { sku: searchRegex },
        { slug: searchRegex },
        { description: searchRegex },
        { shortDescription: searchRegex },
        { brand: searchRegex },
        { tags: searchRegex },
      ];
    }

    /*
      Category
    */
    if (category) {
      query.$or = [
        {
          "category.id": category,
        },
        {
          "category.slug": category,
        },
      ];
    }

    /*
      Subcategory
    */
    if (subcategory) {
      query.$or = [
        {
          "subcategory.id": subcategory,
        },
        {
          "subcategory.slug": subcategory,
        },
      ];
    }

    /*
      Inventory status
    */
    if (inventoryStatus) {
      query["inventory.status"] =
        inventoryStatus;
    }

    /*
      Product status
    */
    if (status) {
      if (status === "active") {
        query["status.active"] = true;
      }

      if (status === "inactive") {
        query["status.active"] = false;
      }

      if (status === "published") {
        query["status.published"] = true;
      }

      if (status === "draft") {
        query["status.published"] = false;
      }

      if (status === "archived") {
        query["status.archived"] = true;
      }
    }

    if (featured !== undefined) {
      query["status.featured"] =
        featured === "true";
    }

    if (bestseller !== undefined) {
      query["status.bestseller"] =
        bestseller === "true";
    }

    if (newProduct !== undefined) {
      query["status.newProduct"] =
        newProduct === "true";
    }

    if (published !== undefined) {
      query["status.published"] =
        published === "true";
    }

    if (active !== undefined) {
      query["status.active"] =
        active === "true";
    }

    if (archived !== undefined) {
      query["status.archived"] =
        archived === "true";
    }

    /*
      Pagination
    */
    const currentPage = Math.max(
      Number(page) || 1,
      1
    );

    const perPage = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    const skip =
      (currentPage - 1) * perPage;

    /*
      Count
    */
    const total =
      await Product.countDocuments(query);

    /*
      Products
    */
    const products =
      await Product.find(query)
        .sort(sort)
        .skip(skip)
        .limit(perPage)
        .lean();

    return res.status(200).json({
      success: true,

      products,

      pagination: {
        page: currentPage,
        limit: perPage,
        total,
        pages: Math.ceil(total / perPage),
        hasNextPage:
          currentPage <
          Math.ceil(total / perPage),
        hasPreviousPage:
          currentPage > 1,
      },
    });
  } catch (error) {
    console.error("GET PRODUCTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* ============================================================
   GET /api/products/:id
   GET SINGLE PRODUCT
============================================================ */

router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isDeleted: false,
    }).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error(
      "GET PRODUCT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* ============================================================
   PUT /api/products/:id
   UPDATE PRODUCT
============================================================ */

router.put("/:id", protect, async (req, res) => {
  try {
    const existingProduct =
      await Product.findById(req.params.id);

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const { error, value } =
      productSchema.validate(req.body, {
        abortEarly: true,
        stripUnknown: false,
      });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    /*
      لا نسمح بتغيير _id
    */
    delete value._id;

    /*
      createdBy لا يتغير
    */
    delete value.createdBy;

    /*
      isDeleted يتم التحكم فيه من خلال
      DELETE / restore
    */
    delete value.isDeleted;

    /*
      تحديث admin
    */
    value.updatedBy = String(
      req.admin._id
    );

    /*
      إعادة حساب inventory
    */
    const normalizedData =
      normalizeProductData(
        value,
        req.admin._id
      );

    /*
      SKU duplicate check
    */
    if (normalizedData.sku) {
      const duplicateSku =
        await Product.findOne({
          sku: normalizedData.sku,
          _id: {
            $ne: req.params.id,
          },
        });

      if (duplicateSku) {
        return res.status(409).json({
          success: false,
          message: "Product SKU already exists",
        });
      }
    }

    /*
      Slug duplicate check
    */
    if (normalizedData.slug) {
      const duplicateSlug =
        await Product.findOne({
          slug: normalizedData.slug,
          _id: {
            $ne: req.params.id,
          },
        });

      if (duplicateSlug) {
        return res.status(409).json({
          success: false,
          message: "Product slug already exists",
        });
      }
    }

    const updatedProduct =
      await Product.findByIdAndUpdate(
        req.params.id,
        {
          $set: normalizedData,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error(
      "UPDATE PRODUCT ERROR:",
      error
    );

    if (error.code === 11000) {
      const field = Object.keys(
        error.keyPattern || {}
      )[0];

      return res.status(409).json({
        success: false,
        message: `${field || "Product"} already exists`,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* ============================================================
   DELETE /api/products/:id
   SOFT DELETE
============================================================ */

router.delete(
  "/:id",
  protect,
  async (req, res) => {
    try {
      const product =
        await Product.findById(
          req.params.id
        );

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      if (product.isDeleted) {
        return res.status(400).json({
          success: false,
          message: "Product is already deleted",
        });
      }

      product.isDeleted = true;

      product.status.active = false;
      product.status.published = false;
      product.status.archived = true;

      product.updatedBy = String(
        req.admin._id
      );

      await product.save();

      return res.status(200).json({
        success: true,
        message: "Product deleted successfully",
        product,
      });
    } catch (error) {
      console.error(
        "DELETE PRODUCT ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

/* ============================================================
   PATCH /api/products/:id/restore
   RESTORE PRODUCT
============================================================ */

router.patch(
  "/:id/restore",
  protect,
  async (req, res) => {
    try {
      const product =
        await Product.findById(
          req.params.id
        );

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      if (!product.isDeleted) {
        return res.status(400).json({
          success: false,
          message: "Product is not deleted",
        });
      }

      product.isDeleted = false;

      /*
        لا نقوم بتفعيل المنتج ونشره تلقائياً.
        فقط نزيل حالة الحذف والأرشفة.
      */
      product.status.archived = false;

      product.updatedBy = String(
        req.admin._id
      );

      await product.save();

      return res.status(200).json({
        success: true,
        message: "Product restored successfully",
        product,
      });
    } catch (error) {
      console.error(
        "RESTORE PRODUCT ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

module.exports = router;
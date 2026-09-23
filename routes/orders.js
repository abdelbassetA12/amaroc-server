const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const Joi = require("joi");

const Order = require("../models/Order");
const Product = require("../models/Product");
const ShippingMethod = require("../models/ShippingMethod");
const ShippingSettings = require("../models/ShippingSettings");

const protect = require("../middleware/auth");

const router = express.Router();

/* ============================================================
   CONSTANTS
============================================================ */

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
];

const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "refunded",
];

/* ============================================================
   VALIDATION
============================================================ */

const createOrderSchema = Joi.object({
  customer: Joi.object({
    firstName: Joi.string().trim().min(2).max(100).required(),
    lastName: Joi.string().trim().min(2).max(100).required(),

    phone: Joi.string()
      .trim()
      .pattern(/^(?:\+212|0)([5-7]\d{8})$/)
      .required(),

    email: Joi.string()
      .trim()
      .email()
      .max(200)
      .allow("", null)
      .default(null),
  }).required(),

  shippingAddress: Joi.object({
    city: Joi.string().trim().min(2).max(150).required(),

    address: Joi.string().trim().min(5).max(500).required(),

    notes: Joi.string()
      .trim()
      .max(1000)
      .allow("", null)
      .default(""),
  }).required(),

  shipping: Joi.object({
    methodId: Joi.string().trim().required(),
  }).required(),

  payment: Joi.object({
    method: Joi.string()
      .valid("cod")
      .required(),
  }).required(),

  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().trim().required(),

        quantity: Joi.number()
          .integer()
          .min(1)
          .max(100)
          .required(),

        color: Joi.string()
          .trim()
          .allow("", null)
          .default(null),

        size: Joi.string()
          .trim()
          .allow("", null)
          .default(null),

        volume: Joi.number()
          .min(0)
          .allow(null)
          .default(null),

        volumeUnit: Joi.string()
          .trim()
          .allow("", null)
          .default(null),

        variantId: Joi.string()
          .trim()
          .allow("", null)
          .default(null),
      })
    )
    .min(1)
    .max(100)
    .required(),
});

/* ============================================================
   HELPERS
============================================================ */

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/* ------------------------------------------------------------
   Generate order number
------------------------------------------------------------ */

function generateOrderNumber() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const random = crypto
    .randomBytes(4)
    .readUInt32BE(0)
    .toString()
    .slice(0, 6)
    .padStart(6, "0");

  return `AM-${year}${month}${day}-${random}`;
}

/* ------------------------------------------------------------
   Active product price
------------------------------------------------------------ */

function getProductPrice(product) {
  const now = new Date();

  const saleEnabled =
    product.pricing &&
    product.pricing.discount &&
    product.pricing.discount.enabled === true;

  const saleStart =
    product.pricing &&
    product.pricing.discount &&
    product.pricing.discount.startDate;

  const saleEnd =
    product.pricing &&
    product.pricing.discount &&
    product.pricing.discount.endDate;

  const withinStart =
    !saleStart || now >= new Date(saleStart);

  const withinEnd =
    !saleEnd || now <= new Date(saleEnd);

  const saleIsActive =
    saleEnabled &&
    withinStart &&
    withinEnd &&
    product.pricing.salePrice !== null &&
    product.pricing.salePrice !== undefined;

  if (saleIsActive) {
    return Number(product.pricing.salePrice);
  }

  return Number(product.pricing.regularPrice);
}

/* ------------------------------------------------------------
   Product thumbnail
------------------------------------------------------------ */

function getProductThumbnail(product, variant = null) {
  if (variant && variant.image) {
    return variant.image;
  }

  if (product.thumbnail) {
    return product.thumbnail;
  }

  if (
    Array.isArray(product.images) &&
    product.images.length > 0
  ) {
    const primary = product.images.find(
      (image) => image.isPrimary
    );

    return primary
      ? primary.url
      : product.images[0].url;
  }

  return "";
}

/* ------------------------------------------------------------
   Variant finder
------------------------------------------------------------ */

function findVariant(product, variantId) {
  if (!variantId) {
    return null;
  }

  if (!Array.isArray(product.variants)) {
    return null;
  }

  return (
    product.variants.find(
      (variant) => variant.id === variantId
    ) || null
  );
}

/* ------------------------------------------------------------
   Product availability
------------------------------------------------------------ */

function isProductAvailable(product) {
  if (product.isDeleted) {
    return false;
  }

  if (!product.status || product.status.active !== true) {
    return false;
  }

  if (
    product.status.published !== undefined &&
    product.status.published !== true
  ) {
    return false;
  }

  return true;
}

/* ------------------------------------------------------------
   Get / create shipping settings
------------------------------------------------------------ */

async function getShippingSettings() {
  let settings =
    await ShippingSettings.findOne({
      key: "default",
    }).lean();

  if (!settings) {
    settings = await ShippingSettings.create({
      key: "default",
      enabled: true,
      freeShipping: {
        enabled: true,
        minimumOrder: 500,
      },
      currency: "MAD",
    });

    settings = settings.toObject();
  }

  return settings;
}

/* ------------------------------------------------------------
   Restore inventory
------------------------------------------------------------ */

async function restoreInventory(order, session) {
  if (order.inventoryRestored) {
    return;
  }

  for (const item of order.items) {
    const product = await Product.findOne({
      _id: item.productId,
      isDeleted: false,
    }).session(session);

    if (!product) {
      continue;
    }

    if (item.variantId) {
      const variant = product.variants.find(
        (v) => v.id === item.variantId
      );

      if (variant) {
        variant.quantity =
          Number(variant.quantity || 0) +
          Number(item.quantity);
      }
    } else if (
      product.inventory &&
      product.inventory.trackQuantity !== false
    ) {
      product.inventory.quantity =
        Number(product.inventory.quantity || 0) +
        Number(item.quantity);

      const threshold =
        Number(
          product.inventory.lowStockThreshold || 5
        );

      if (product.inventory.quantity <= 0) {
        product.inventory.status = "out_of_stock";
      } else if (
        product.inventory.quantity <= threshold
      ) {
        product.inventory.status = "low_stock";
      } else {
        product.inventory.status = "in_stock";
      }
    }

    await product.save({ session });
  }

  order.inventoryRestored = true;
}

/* ============================================================
   PUBLIC
   CREATE ORDER
============================================================ */

router.post("/", async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { error, value } =
      createOrderSchema.validate(req.body, {
        abortEarly: false,
      });

    if (error) {
      return res.status(400).json({
        success: false,
        message: "بيانات الطلب غير صحيحة.",
        errors: error.details.map(
          (detail) => detail.message
        ),
      });
    }

    await session.startTransaction();

    const data = value;

    /* ========================================================
       SHIPPING
    ======================================================== */

    if (
      !mongoose.Types.ObjectId.isValid(
        data.shipping.methodId
      )
    ) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "طريقة الشحن غير صحيحة.",
      });
    }

    const shippingMethod =
      await ShippingMethod.findOne({
        _id: data.shipping.methodId,
        enabled: true,
        isDeleted: false,
      })
        .session(session)
        .lean();

    if (!shippingMethod) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "طريقة الشحن غير متاحة.",
      });
    }

    const shippingSettings =
      await getShippingSettings();

    if (shippingSettings.enabled === false) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "الشحن غير متاح حاليًا.",
      });
    }

    /* ========================================================
       PRODUCTS
    ======================================================== */

    const requestedItems = data.items;

    const productIds = [
      ...new Set(
        requestedItems.map(
          (item) => item.productId
        )
      ),
    ];

    const products = await Product.find({
      _id: {
        $in: productIds,
      },
      isDeleted: false,
    }).session(session);

    const productMap = new Map();

    for (const product of products) {
      productMap.set(product._id, product);
    }

    /* ========================================================
       BUILD ORDER ITEMS
    ======================================================== */

    const orderItems = [];

    let subtotal = 0;
    let itemsCount = 0;

    for (const requestedItem of requestedItems) {
      const product =
        productMap.get(
          requestedItem.productId
        );

      if (!product) {
        throw new Error(
          `PRODUCT_NOT_FOUND:${requestedItem.productId}`
        );
      }

      if (!isProductAvailable(product)) {
        throw new Error(
          `PRODUCT_NOT_AVAILABLE:${product.name}`
        );
      }

      const quantity =
        Number(requestedItem.quantity);

      const variant =
        findVariant(
          product,
          requestedItem.variantId
        );

      /* ------------------------------------------------------
         If variant was requested, it MUST exist
      ------------------------------------------------------ */

      if (
        requestedItem.variantId &&
        !variant
      ) {
        throw new Error(
          `VARIANT_NOT_FOUND:${product.name}`
        );
      }

      /* ------------------------------------------------------
         Variant stock
      ------------------------------------------------------ */

      if (variant) {
        const variantQuantity =
          Number(variant.quantity || 0);

        if (
          variantQuantity < quantity
        ) {
          throw new Error(
            `INSUFFICIENT_STOCK:${product.name}`
          );
        }
      } else if (
        product.inventory &&
        product.inventory.trackQuantity !== false
      ) {
        const availableQuantity =
          Number(
            product.inventory.quantity || 0
          );

        if (
          availableQuantity < quantity
        ) {
          throw new Error(
            `INSUFFICIENT_STOCK:${product.name}`
          );
        }
      }

      /* ------------------------------------------------------
         Price comes from database
      ------------------------------------------------------ */

      let unitPrice;

      if (
        variant &&
        variant.price !== null &&
        variant.price !== undefined
      ) {
        unitPrice =
          Number(variant.price);
      } else {
        unitPrice =
          getProductPrice(product);
      }

      const lineTotal = roundMoney(
        unitPrice * quantity
      );

      subtotal = roundMoney(
        subtotal + lineTotal
      );

      itemsCount += quantity;

      orderItems.push({
        productId: product._id,

        name: product.name,

        slug: product.slug,

        thumbnail:
          getProductThumbnail(
            product,
            variant
          ),

        price: unitPrice,

        quantity,

        color:
          requestedItem.color ??
          (variant
            ? variant.color
            : null),

        size:
          requestedItem.size ??
          (variant
            ? variant.size
            : null),

        volume:
          requestedItem.volume ??
          (variant
            ? variant.volume
            : null),

        volumeUnit:
          requestedItem.volumeUnit ??
          (variant
            ? variant.volumeUnit
            : null),

        variantId:
          requestedItem.variantId ??
          null,

        sku:
          variant && variant.sku
            ? variant.sku
            : product.sku,

        lineTotal,
      });
    }

    /* ========================================================
       SHIPPING PRICE
    ======================================================== */

    let shippingPrice =
      Number(shippingMethod.price || 0);

    let freeShippingApplied = false;

    const freeShipping =
      shippingSettings.freeShipping;

    if (
      freeShipping &&
      freeShipping.enabled === true &&
      Number(freeShipping.minimumOrder || 0) <=
        subtotal &&
      shippingMethod.freeShippingEligible === true
    ) {
      shippingPrice = 0;
      freeShippingApplied = true;
    }

    const total = roundMoney(
      subtotal + shippingPrice
    );

    /* ========================================================
       DECREASE INVENTORY
    ======================================================== */

    for (const orderItem of orderItems) {
      const product =
        productMap.get(
          orderItem.productId
        );

      if (!product) {
        throw new Error(
          `PRODUCT_NOT_FOUND:${orderItem.productId}`
        );
      }

      if (orderItem.variantId) {
        const variant =
          product.variants.find(
            (v) =>
              v.id ===
              orderItem.variantId
          );

        if (!variant) {
          throw new Error(
            `VARIANT_NOT_FOUND:${product.name}`
          );
        }

        if (
          Number(variant.quantity || 0) <
          orderItem.quantity
        ) {
          throw new Error(
            `INSUFFICIENT_STOCK:${product.name}`
          );
        }

        variant.quantity =
          Number(variant.quantity || 0) -
          orderItem.quantity;
      } else if (
        product.inventory &&
        product.inventory.trackQuantity !== false
      ) {
        product.inventory.quantity =
          Number(
            product.inventory.quantity || 0
          ) - orderItem.quantity;

        const threshold =
          Number(
            product.inventory.lowStockThreshold ||
              5
          );

        if (
          product.inventory.quantity <= 0
        ) {
          product.inventory.status =
            "out_of_stock";
        } else if (
          product.inventory.quantity <=
          threshold
        ) {
          product.inventory.status =
            "low_stock";
        } else {
          product.inventory.status =
            "in_stock";
        }
      }

      await product.save({
        session,
      });
    }

    /* ========================================================
       ORDER NUMBER
    ======================================================== */

    let orderNumber = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate =
        generateOrderNumber();

      const exists =
        await Order.exists({
          orderNumber: candidate,
        });

      if (!exists) {
        orderNumber = candidate;
        break;
      }
    }

    if (!orderNumber) {
      throw new Error(
        "ORDER_NUMBER_GENERATION_FAILED"
      );
    }

    /* ========================================================
       CREATE ORDER
    ======================================================== */

    const order =
      new Order({
        orderNumber,

        customer: {
          firstName:
            data.customer.firstName,

          lastName:
            data.customer.lastName,

          phone:
            data.customer.phone,

          email:
            data.customer.email || null,
        },

        shippingAddress: {
          city:
            data.shippingAddress.city,

          address:
            data.shippingAddress.address,

          notes:
            data.shippingAddress.notes || "",
        },

        shipping: {
          methodId:
            String(
              shippingMethod._id
            ),

          name:
            shippingMethod.name,

          code:
            shippingMethod.code || "",

          price:
            shippingPrice,

          currency:
            shippingMethod.currency ||
            shippingSettings.currency ||
            "MAD",

          delivery:
            shippingMethod.delivery || {},

          freeShippingApplied,
        },

        payment: {
          method:
            data.payment.method,

          status: "pending",
        },

        items: orderItems,

        pricing: {
          subtotal,

          shipping:
            shippingPrice,

          discount: 0,

          total,

          currency:
            shippingSettings.currency ||
            "MAD",
        },

        itemsCount,

        status: "pending",

        statusHistory: [
          {
            status: "pending",

            note:
              "تم إنشاء الطلب بنجاح.",

            changedBy: "customer",

            createdAt: new Date(),
          },
        ],

        createdBy: "customer",

        updatedBy: "customer",
      });

    await order.save({
      session,
    });

    await session.commitTransaction();

    return res.status(201).json({
      success: true,

      message:
        "تم إنشاء الطلب بنجاح.",

      order: {
        _id: order._id,

        orderNumber:
          order.orderNumber,

        status:
          order.status,

        payment:
          order.payment,

        pricing:
          order.pricing,

        itemsCount:
          order.itemsCount,

        createdAt:
          order.createdAt,
      },
    });
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch (_) {}

    console.error(
      "CREATE ORDER ERROR:",
      error
    );

    const message =
      error.message || "";

    if (
      message.startsWith(
        "PRODUCT_NOT_FOUND:"
      )
    ) {
      return res.status(404).json({
        success: false,
        message:
          "أحد المنتجات لم يعد متاحًا.",
      });
    }

    if (
      message.startsWith(
        "PRODUCT_NOT_AVAILABLE:"
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "أحد المنتجات غير متاح حاليًا.",
      });
    }

    if (
      message.startsWith(
        "VARIANT_NOT_FOUND:"
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "أحد خيارات المنتج لم يعد متاحًا.",
      });
    }

    if (
      message.startsWith(
        "INSUFFICIENT_STOCK:"
      )
    ) {
      return res.status(409).json({
        success: false,
        message:
          "الكمية المطلوبة من أحد المنتجات غير متوفرة.",
      });
    }

    if (
      message ===
      "ORDER_NUMBER_GENERATION_FAILED"
    ) {
      return res.status(500).json({
        success: false,
        message:
          "تعذر إنشاء رقم الطلب.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "تعذر إنشاء الطلب حاليًا.",
    });
  } finally {
    await session.endSession();
  }
});

/* ============================================================
   PUBLIC
   TRACK ORDER
============================================================ */

router.post("/track", async (req, res) => {
  try {
    const schema = Joi.object({
      orderNumber: Joi.string()
        .trim()
        .required(),

      phone: Joi.string()
        .trim()
        .required(),
    });

    const { error, value } =
      schema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message:
          "رقم الطلب ورقم الهاتف مطلوبان.",
      });
    }

    const order =
      await Order.findOne({
        orderNumber:
          value.orderNumber
            .toUpperCase()
            .trim(),

        "customer.phone":
          value.phone.trim(),
      }).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message:
          "لم يتم العثور على الطلب.",
      });
    }

    return res.json({
      success: true,

      order: {
        orderNumber:
          order.orderNumber,

        status:
          order.status,

        payment:
          order.payment,

        shipping:
          order.shipping,

        pricing:
          order.pricing,

        items:
          order.items,

        itemsCount:
          order.itemsCount,

        statusHistory:
          order.statusHistory,

        createdAt:
          order.createdAt,

        updatedAt:
          order.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      "TRACK ORDER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "تعذر تتبع الطلب.",
    });
  }
});

/* ============================================================
   ADMIN
   GET ORDERS
============================================================ */

router.get("/admin", protect, async (req, res) => {
  try {
    const {
      search = "",
      status = "",
      page = 1,
      limit = 20,
    } = req.query;

    const currentPage = Math.max(
      Number(page) || 1,
      1
    );

    const perPage = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    const query = {};

    if (
      status &&
      ORDER_STATUSES.includes(status)
    ) {
      query.status = status;
    }

    if (search.trim()) {
      const searchValue =
        search.trim();

      query.$or = [
        {
          orderNumber: {
            $regex: searchValue,
            $options: "i",
          },
        },
        {
          "customer.firstName": {
            $regex: searchValue,
            $options: "i",
          },
        },
        {
          "customer.lastName": {
            $regex: searchValue,
            $options: "i",
          },
        },
        {
          "customer.phone": {
            $regex: searchValue,
            $options: "i",
          },
        },
        {
          "customer.email": {
            $regex: searchValue,
            $options: "i",
          },
        },
      ];
    }

    const skip =
      (currentPage - 1) *
      perPage;

    const [orders, total] =
      await Promise.all([
        Order.find(query)
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(perPage)
          .lean(),

        Order.countDocuments(query),
      ]);

    return res.json({
      success: true,

      orders,

      pagination: {
        page: currentPage,

        limit: perPage,

        total,

        pages: Math.ceil(
          total / perPage
        ),
      },
    });
  } catch (error) {
    console.error(
      "ADMIN GET ORDERS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "تعذر تحميل الطلبات.",
    });
  }
});

/* ============================================================
   ADMIN
   GET SINGLE ORDER
============================================================ */

router.get(
  "/admin/:id",
  protect,
  async (req, res) => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "معرف الطلب غير صحيح.",
        });
      }

      const order =
        await Order.findById(
          req.params.id
        ).lean();

      if (!order) {
        return res.status(404).json({
          success: false,
          message:
            "الطلب غير موجود.",
        });
      }

      return res.json({
        success: true,
        order,
      });
    } catch (error) {
      console.error(
        "ADMIN GET ORDER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "تعذر تحميل الطلب.",
      });
    }
  }
);

/* ============================================================
   ADMIN
   UPDATE ORDER STATUS
============================================================ */

router.patch(
  "/admin/:id/status",
  protect,
  async (req, res) => {
    const session =
      await mongoose.startSession();

    try {
      const schema = Joi.object({
        status: Joi.string()
          .valid(...ORDER_STATUSES)
          .required(),

        note: Joi.string()
          .trim()
          .max(1000)
          .allow("")
          .default(""),
      });

      const { error, value } =
        schema.validate(req.body);

      if (error) {
        return res.status(400).json({
          success: false,
          message:
            "حالة الطلب غير صحيحة.",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "معرف الطلب غير صحيح.",
        });
      }

      await session.startTransaction();

      const order =
        await Order.findById(
          req.params.id
        ).session(session);

      if (!order) {
        await session.abortTransaction();

        return res.status(404).json({
          success: false,
          message:
            "الطلب غير موجود.",
        });
      }

      const previousStatus =
        order.status;

      const nextStatus =
        value.status;

      if (
        previousStatus ===
        nextStatus
      ) {
        await session.commitTransaction();

        return res.json({
          success: true,
          message:
            "الطلب بالفعل في هذه الحالة.",
          order,
        });
      }

      /* ------------------------------------------------------
         Delivered / cancelled / returned
         rules
      ------------------------------------------------------ */

      if (
        previousStatus ===
          "delivered" ||
        previousStatus ===
          "cancelled" ||
        previousStatus ===
          "returned"
      ) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message:
            "لا يمكن تغيير حالة هذا الطلب بعد إغلاقه.",
        });
      }

      if (
        nextStatus ===
          "cancelled" ||
        nextStatus ===
          "returned"
      ) {
        await restoreInventory(
          order,
          session
        );

        order.cancelledAt =
          new Date();

        order.cancellationReason =
          value.note || "";

        order.inventoryRestored =
          true;
      }

      order.status =
        nextStatus;

      order.updatedBy =
        String(
          req.admin?._id ||
            "admin"
        );

      order.statusHistory.push({
        status:
          nextStatus,

        note:
          value.note || "",

        changedBy:
          String(
            req.admin?._id ||
              "admin"
          ),

        createdAt:
          new Date(),
      });

      await order.save({
        session,
      });

      await session.commitTransaction();

      return res.json({
        success: true,

        message:
          "تم تحديث حالة الطلب.",

        order,
      });
    } catch (error) {
      try {
        await session.abortTransaction();
      } catch (_) {}

      console.error(
        "UPDATE ORDER STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "تعذر تحديث حالة الطلب.",
      });
    } finally {
      await session.endSession();
    }
  }
);

/* ============================================================
   ADMIN
   UPDATE PAYMENT
============================================================ */

router.patch(
  "/admin/:id/payment",
  protect,
  async (req, res) => {
    try {
      const schema = Joi.object({
        status: Joi.string()
          .valid(
            ...PAYMENT_STATUSES
          )
          .required(),
      });

      const { error, value } =
        schema.validate(req.body);

      if (error) {
        return res.status(400).json({
          success: false,
          message:
            "حالة الدفع غير صحيحة.",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "معرف الطلب غير صحيح.",
        });
      }

      const order =
        await Order.findById(
          req.params.id
        );

      if (!order) {
        return res.status(404).json({
          success: false,
          message:
            "الطلب غير موجود.",
        });
      }

      order.payment.status =
        value.status;

      order.updatedBy =
        String(
          req.admin?._id ||
            "admin"
        );

      await order.save();

      return res.json({
        success: true,

        message:
          "تم تحديث حالة الدفع.",

        order,
      });
    } catch (error) {
      console.error(
        "UPDATE PAYMENT ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "تعذر تحديث حالة الدفع.",
      });
    }
  }
);

/* ============================================================
   ADMIN
   CANCEL ORDER
============================================================ */

router.patch(
  "/admin/:id/cancel",
  protect,
  async (req, res) => {
    const session =
      await mongoose.startSession();

    try {
      const schema = Joi.object({
        reason: Joi.string()
          .trim()
          .max(1000)
          .allow("")
          .default(""),
      });

      const { error, value } =
        schema.validate(
          req.body || {}
        );

      if (error) {
        return res.status(400).json({
          success: false,
          message:
            "سبب الإلغاء غير صحيح.",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "معرف الطلب غير صحيح.",
        });
      }

      await session.startTransaction();

      const order =
        await Order.findById(
          req.params.id
        ).session(session);

      if (!order) {
        await session.abortTransaction();

        return res.status(404).json({
          success: false,
          message:
            "الطلب غير موجود.",
        });
      }

      if (
        [
          "delivered",
          "cancelled",
          "returned",
        ].includes(order.status)
      ) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message:
            "لا يمكن إلغاء هذا الطلب.",
        });
      }

      await restoreInventory(
        order,
        session
      );

      order.status =
        "cancelled";

      order.cancelledAt =
        new Date();

      order.cancellationReason =
        value.reason || "";

      order.inventoryRestored =
        true;

      order.updatedBy =
        String(
          req.admin?._id ||
            "admin"
        );

      order.statusHistory.push({
        status: "cancelled",

        note:
          value.reason ||
          "تم إلغاء الطلب.",

        changedBy:
          String(
            req.admin?._id ||
              "admin"
          ),

        createdAt:
          new Date(),
      });

      await order.save({
        session,
      });

      await session.commitTransaction();

      return res.json({
        success: true,

        message:
          "تم إلغاء الطلب وإرجاع المخزون.",

        order,
      });
    } catch (error) {
      try {
        await session.abortTransaction();
      } catch (_) {}

      console.error(
        "CANCEL ORDER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "تعذر إلغاء الطلب.",
      });
    } finally {
      await session.endSession();
    }
  }
);

module.exports = router;
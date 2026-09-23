const express = require("express");
const Joi = require("joi");

const ShippingMethod = require("../models/ShippingMethod");
const ShippingSettings = require("../models/ShippingSettings");
const protect = require("../middleware/auth");

const router = express.Router();

/* ============================================================
   HELPERS
============================================================ */

/**
 * تحويل بيانات Shipping Method إلى الشكل المناسب للـ API
 */
const formatShippingMethod = (method) => {
  if (!method) return null;

  return {
    _id: method._id,
    name: method.name,
    code: method.code,
    description: method.description,
    price: Number(method.price || 0),
    currency: method.currency || "MAD",

    delivery: {
      min: Number(method.delivery?.min || 0),
      max: Number(method.delivery?.max || 0),
      unit: method.delivery?.unit || "days",
    },

    freeShippingEligible:
      method.freeShippingEligible !== false,

    enabled: method.enabled !== false,

    sortOrder: Number(method.sortOrder || 0),

    createdAt: method.createdAt,
    updatedAt: method.updatedAt,
  };
};

/**
 * تحويل إعدادات الشحن إلى الشكل المناسب للـ API
 */
const formatShippingSettings = (settings) => {
  if (!settings) return null;

  return {
    _id: settings._id,

    enabled: settings.enabled !== false,

    freeShipping: {
      enabled:
        settings.freeShipping?.enabled !== false,

      minimumOrder: Number(
        settings.freeShipping?.minimumOrder || 0
      ),
    },

    currency: settings.currency || "MAD",

    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
};

/**
 * الحصول على إعدادات الشحن.
 *
 * إذا لم تكن موجودة، ننشئ الإعدادات الافتراضية.
 */
const getOrCreateShippingSettings = async (adminId = null) => {
  let settings = await ShippingSettings.findOne({
    key: "default",
  });

  if (!settings) {
    settings = await ShippingSettings.create({
      key: "default",
      enabled: true,

      freeShipping: {
        enabled: true,
        minimumOrder: 500,
      },

      currency: "MAD",

      createdBy: adminId
        ? String(adminId)
        : null,

      updatedBy: adminId
        ? String(adminId)
        : null,
    });
  }

  return settings;
};

/* ============================================================
   VALIDATION
============================================================ */

const deliverySchema = Joi.object({
  min: Joi.number()
    .min(0)
    .required(),

  max: Joi.number()
    .min(0)
    .required()
    .custom((value, helpers) => {
      const min = helpers.state.ancestors[0].min;

      if (value < min) {
        return helpers.message(
          '"max" must be greater than or equal to "min"'
        );
      }

      return value;
    }),

  unit: Joi.string()
    .trim()
    .valid("hours", "days", "weeks")
    .default("days"),
});

const shippingMethodSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required(),

  code: Joi.string()
    .trim()
    .lowercase()
    .min(1)
    .max(50)
    .pattern(/^[a-z0-9_-]+$/)
    .required(),

  description: Joi.string()
    .trim()
    .allow("")
    .max(500)
    .default(""),

  price: Joi.number()
    .min(0)
    .required(),

  currency: Joi.string()
    .trim()
    .uppercase()
    .max(10)
    .default("MAD"),

  delivery: deliverySchema.required(),

  freeShippingEligible: Joi.boolean()
    .default(true),

  enabled: Joi.boolean()
    .default(true),

  sortOrder: Joi.number()
    .min(0)
    .default(0),
}).unknown(false);

const shippingSettingsSchema = Joi.object({
  enabled: Joi.boolean()
    .default(true),

  freeShipping: Joi.object({
    enabled: Joi.boolean()
      .default(true),

    minimumOrder: Joi.number()
      .min(0)
      .required(),
  }).required(),

  currency: Joi.string()
    .trim()
    .uppercase()
    .max(10)
    .default("MAD"),
}).unknown(false);

/* ============================================================
   PUBLIC API
   GET /api/shipping
============================================================ */

/*
 * هذا endpoint هو الذي سيستخدمه Checkout.
 *
 * يعرض:
 * - نظام الشحن
 * - طرق الشحن المفعلة فقط
 * - إعداد الشحن المجاني
 */
router.get("/", async (req, res) => {
  try {
    const settings =
      await getOrCreateShippingSettings();

    const methods =
      await ShippingMethod.find({
        enabled: true,
        isDeleted: false,
      })
        .sort({
          sortOrder: 1,
          createdAt: 1,
        })
        .lean();

    return res.status(200).json({
      success: true,

      shipping: {
        enabled: settings.enabled !== false,

        currency:
          settings.currency || "MAD",

        freeShipping: {
          enabled:
            settings.freeShipping?.enabled !== false,

          minimumOrder: Number(
            settings.freeShipping?.minimumOrder || 0
          ),
        },

        methods: methods.map(
          formatShippingMethod
        ),
      },
    });
  } catch (error) {
    console.error(
      "GET PUBLIC SHIPPING ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* ============================================================
   ADMIN
   GET /api/shipping/admin
   GET ALL SHIPPING METHODS
============================================================ */

router.get(
  "/admin",
  protect,
  async (req, res) => {
    try {
      const {
        search,
        enabled,
        deleted,
        page = 1,
        limit = 20,
      } = req.query;

      const query = {};

      /* --------------------------------------------------------
         Deleted
      -------------------------------------------------------- */

      if (deleted === "true") {
        query.isDeleted = true;
      } else if (deleted === "false") {
        query.isDeleted = false;
      } else {
        query.isDeleted = false;
      }

      /* --------------------------------------------------------
         Search
      -------------------------------------------------------- */

      if (search && search.trim()) {
        const searchRegex = new RegExp(
          search.trim(),
          "i"
        );

        query.$or = [
          {
            name: searchRegex,
          },
          {
            code: searchRegex,
          },
          {
            description: searchRegex,
          },
        ];
      }

      /* --------------------------------------------------------
         Enabled
      -------------------------------------------------------- */

      if (enabled !== undefined) {
        query.enabled =
          enabled === "true";
      }

      /* --------------------------------------------------------
         Pagination
      -------------------------------------------------------- */

      const currentPage = Math.max(
        Number(page) || 1,
        1
      );

      const perPage = Math.min(
        Math.max(
          Number(limit) || 20,
          1
        ),
        100
      );

      const skip =
        (currentPage - 1) * perPage;

      /* --------------------------------------------------------
         Count
      -------------------------------------------------------- */

      const total =
        await ShippingMethod.countDocuments(
          query
        );

      /* --------------------------------------------------------
         Methods
      -------------------------------------------------------- */

      const methods =
        await ShippingMethod.find(query)
          .sort({
            sortOrder: 1,
            createdAt: 1,
          })
          .skip(skip)
          .limit(perPage)
          .lean();

      return res.status(200).json({
        success: true,

        methods: methods.map(
          formatShippingMethod
        ),

        pagination: {
          page: currentPage,
          limit: perPage,
          total,

          pages: Math.ceil(
            total / perPage
          ),

          hasNextPage:
            currentPage <
            Math.ceil(
              total / perPage
            ),

          hasPreviousPage:
            currentPage > 1,
        },
      });
    } catch (error) {
      console.error(
        "GET ADMIN SHIPPING ERROR:",
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
   ADMIN
   GET /api/shipping/admin/settings
   GET SHIPPING SETTINGS
============================================================ */

router.get(
  "/admin/settings",
  protect,
  async (req, res) => {
    try {
      const settings =
        await getOrCreateShippingSettings(
          req.admin?._id
        );

      return res.status(200).json({
        success: true,

        settings:
          formatShippingSettings(
            settings
          ),
      });
    } catch (error) {
      console.error(
        "GET SHIPPING SETTINGS ERROR:",
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
   ADMIN
   POST /api/shipping/admin
   CREATE SHIPPING METHOD
============================================================ */

router.post(
  "/admin",
  protect,
  async (req, res) => {
    try {
      const { error, value } =
        shippingMethodSchema.validate(
          req.body,
          {
            abortEarly: true,
            stripUnknown: false,
          }
        );

      if (error) {
        return res.status(400).json({
          success: false,
          message:
            error.details[0].message,
        });
      }

      /* --------------------------------------------------------
         Prevent duplicate code
      -------------------------------------------------------- */

      const existingMethod =
        await ShippingMethod.findOne({
          code: value.code,
          isDeleted: false,
        });

      if (existingMethod) {
        return res.status(409).json({
          success: false,
          message:
            "Shipping method code already exists",
        });
      }

      /* --------------------------------------------------------
         Create
      -------------------------------------------------------- */

      const method =
        await ShippingMethod.create({
          ...value,

          createdBy: String(
            req.admin._id
          ),

          updatedBy: String(
            req.admin._id
          ),

          isDeleted: false,
        });

      return res.status(201).json({
        success: true,

        message:
          "Shipping method created successfully",

        method:
          formatShippingMethod(
            method
          ),
      });
    } catch (error) {
      console.error(
        "CREATE SHIPPING METHOD ERROR:",
        error
      );

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message:
            "Shipping method code already exists",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

/* ============================================================
   ADMIN
   PUT /api/shipping/admin/:id
   UPDATE SHIPPING METHOD
============================================================ */

router.put(
  "/admin/:id",
  protect,
  async (req, res) => {
    try {
      const existingMethod =
        await ShippingMethod.findOne({
          _id: req.params.id,
          isDeleted: false,
        });

      if (!existingMethod) {
        return res.status(404).json({
          success: false,
          message:
            "Shipping method not found",
        });
      }

      const { error, value } =
        shippingMethodSchema.validate(
          req.body,
          {
            abortEarly: true,
            stripUnknown: false,
          }
        );

      if (error) {
        return res.status(400).json({
          success: false,
          message:
            error.details[0].message,
        });
      }

      /* --------------------------------------------------------
         Duplicate code
      -------------------------------------------------------- */

      const duplicateMethod =
        await ShippingMethod.findOne({
          code: value.code,

          _id: {
            $ne: req.params.id,
          },

          isDeleted: false,
        });

      if (duplicateMethod) {
        return res.status(409).json({
          success: false,
          message:
            "Shipping method code already exists",
        });
      }

      /* --------------------------------------------------------
         Update
      -------------------------------------------------------- */

      value.updatedBy = String(
        req.admin._id
      );

      const updatedMethod =
        await ShippingMethod.findByIdAndUpdate(
          req.params.id,

          {
            $set: value,
          },

          {
            new: true,
            runValidators: true,
          }
        );

      return res.status(200).json({
        success: true,

        message:
          "Shipping method updated successfully",

        method:
          formatShippingMethod(
            updatedMethod
          ),
      });
    } catch (error) {
      console.error(
        "UPDATE SHIPPING METHOD ERROR:",
        error
      );

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message:
            "Shipping method code already exists",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

/* ============================================================
   ADMIN
   PATCH /api/shipping/admin/:id/toggle
   ENABLE / DISABLE
============================================================ */

router.patch(
  "/admin/:id/toggle",
  protect,
  async (req, res) => {
    try {
      const method =
        await ShippingMethod.findOne({
          _id: req.params.id,
          isDeleted: false,
        });

      if (!method) {
        return res.status(404).json({
          success: false,
          message:
            "Shipping method not found",
        });
      }

      method.enabled =
        !method.enabled;

      method.updatedBy =
        String(req.admin._id);

      await method.save();

      return res.status(200).json({
        success: true,

        message: method.enabled
          ? "Shipping method enabled successfully"
          : "Shipping method disabled successfully",

        method:
          formatShippingMethod(
            method
          ),
      });
    } catch (error) {
      console.error(
        "TOGGLE SHIPPING METHOD ERROR:",
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
   ADMIN
   DELETE /api/shipping/admin/:id
   SOFT DELETE
============================================================ */

router.delete(
  "/admin/:id",
  protect,
  async (req, res) => {
    try {
      const method =
        await ShippingMethod.findOne({
          _id: req.params.id,
          isDeleted: false,
        });

      if (!method) {
        return res.status(404).json({
          success: false,
          message:
            "Shipping method not found",
        });
      }

      method.isDeleted = true;
      method.enabled = false;

      method.updatedBy =
        String(req.admin._id);

      await method.save();

      return res.status(200).json({
        success: true,

        message:
          "Shipping method deleted successfully",

        method:
          formatShippingMethod(
            method
          ),
      });
    } catch (error) {
      console.error(
        "DELETE SHIPPING METHOD ERROR:",
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
   ADMIN
   PATCH /api/shipping/admin/:id/restore
   RESTORE
============================================================ */

router.patch(
  "/admin/:id/restore",
  protect,
  async (req, res) => {
    try {
      const method =
        await ShippingMethod.findOne({
          _id: req.params.id,
          isDeleted: true,
        });

      if (!method) {
        return res.status(404).json({
          success: false,
          message:
            "Deleted shipping method not found",
        });
      }

      /*
       * نتأكد من عدم وجود طريقة أخرى
       * بنفس code
       */
      const duplicateMethod =
        await ShippingMethod.findOne({
          code: method.code,

          isDeleted: false,

          _id: {
            $ne: method._id,
          },
        });

      if (duplicateMethod) {
        return res.status(409).json({
          success: false,
          message:
            "Cannot restore. Another shipping method uses the same code.",
        });
      }

      method.isDeleted = false;

      method.updatedBy =
        String(req.admin._id);

      await method.save();

      return res.status(200).json({
        success: true,

        message:
          "Shipping method restored successfully",

        method:
          formatShippingMethod(
            method
          ),
      });
    } catch (error) {
      console.error(
        "RESTORE SHIPPING METHOD ERROR:",
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
   ADMIN
   PUT /api/shipping/admin/settings
   UPDATE SHIPPING SETTINGS
============================================================ */

router.put(
  "/admin/settings",
  protect,
  async (req, res) => {
    try {
      const { error, value } =
        shippingSettingsSchema.validate(
          req.body,
          {
            abortEarly: true,
            stripUnknown: false,
          }
        );

      if (error) {
        return res.status(400).json({
          success: false,
          message:
            error.details[0].message,
        });
      }

      const settings =
        await getOrCreateShippingSettings(
          req.admin._id
        );

      settings.enabled =
        value.enabled;

      settings.freeShipping =
        value.freeShipping;

      settings.currency =
        value.currency;

      settings.updatedBy =
        String(req.admin._id);

      await settings.save();

      return res.status(200).json({
        success: true,

        message:
          "Shipping settings updated successfully",

        settings:
          formatShippingSettings(
            settings
          ),
      });
    } catch (error) {
      console.error(
        "UPDATE SHIPPING SETTINGS ERROR:",
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
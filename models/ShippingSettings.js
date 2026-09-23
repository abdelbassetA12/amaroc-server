const mongoose = require("mongoose");

/* ============================================================
   SHIPPING SETTINGS SCHEMA
============================================================ */

const shippingSettingsSchema = new mongoose.Schema(
  {
    /*
     * Singleton
     *
     * سيكون لدينا إعداد عام واحد فقط للمتجر.
     */
    key: {
      type: String,
      required: true,
      unique: true,
      default: "default",
      immutable: true,
    },

    /*
     * تفعيل نظام الشحن بالكامل
     */
    enabled: {
      type: Boolean,
      default: true,
    },

    /*
     * إعدادات الشحن المجاني
     */
    freeShipping: {
      enabled: {
        type: Boolean,
        default: true,
      },

      /*
       * الحد الأدنى لقيمة المنتجات للحصول
       * على الشحن المجاني
       */
      minimumOrder: {
        type: Number,
        min: 0,
        default: 500,
      },
    },

    /*
     * العملة العامة للشحن
     */
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: "MAD",
      maxlength: 10,
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

module.exports = mongoose.model(
  "ShippingSettings",
  shippingSettingsSchema
);
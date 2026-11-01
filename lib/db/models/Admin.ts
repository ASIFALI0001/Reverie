import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Every admin action, and every time an admin opens a user's data, lands here. Admins can
 * see private data, so access has to be traceable. Kept when an account is deleted.
 */
const AdminAuditLogSchema = new Schema(
  {
    adminUid: { type: String, required: true },
    adminEmail: { type: String, default: null },
    /** "user.view", "user.block", "user.unblock", "users.list"… */
    action: { type: String, required: true },
    targetUid: { type: String, default: null },
    details: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    at: { type: Date, default: () => new Date() },
  },
  { collection: "adminAuditLogs", versionKey: false },
);
AdminAuditLogSchema.index({ at: -1 });
AdminAuditLogSchema.index({ targetUid: 1, at: -1 });
AdminAuditLogSchema.index({ adminUid: 1, at: -1 });

export type AdminAuditLogDoc = InferSchemaType<typeof AdminAuditLogSchema> & { _id: unknown };
export const AdminAuditLog: Model<AdminAuditLogDoc> =
  (models.AdminAuditLog as Model<AdminAuditLogDoc>) ?? model<AdminAuditLogDoc>("AdminAuditLog", AdminAuditLogSchema);

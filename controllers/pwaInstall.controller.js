import { Op, fn, col } from "sequelize";
import PwaInstall from "../models/pwaInstall.model.js";

const PLATFORMS = ["android", "ios", "windows", "mac", "linux", "other"];

/**
 * POST /api/pwa/installs  { device_id, platform }
 * The app calls this when it is installed or opened as an installed app.
 * One row per device: the first report creates it, later ones refresh
 * last_seen_at and the signed-in user.
 */
export const reportInstall = async (req, res) => {
  try {
    const deviceId =
      typeof req.body.device_id === "string" ? req.body.device_id.trim() : "";
    if (!/^[A-Za-z0-9-]{8,64}$/.test(deviceId)) {
      return res.status(400).json({ success: false, message: "A valid device_id is required." });
    }
    const platform = PLATFORMS.includes(req.body.platform) ? req.body.platform : "other";
    const userAgent = String(req.headers["user-agent"] || "").slice(0, 500) || null;
    const now = new Date();

    const existing = await PwaInstall.findOne({ where: { device_id: deviceId } });
    if (existing) {
      await existing.update({
        user_id: req.user?.id ?? existing.user_id,
        platform,
        user_agent: userAgent,
        last_seen_at: now,
      });
      return res.json({ success: true, data: { first: false } });
    }

    await PwaInstall.create({
      device_id: deviceId,
      user_id: req.user?.id ?? null,
      platform,
      user_agent: userAgent,
      installed_at: now,
      last_seen_at: now,
    });
    return res.status(201).json({ success: true, data: { first: true } });
  } catch (error) {
    console.error("Report PWA install error:", error);
    return res.status(500).json({ success: false, message: "Failed to record the install." });
  }
};

/**
 * GET /api/pwa/installs/summary (Admin)
 * { users, devices, last_7_days, by_platform: { android: n, ... } }
 */
export const getInstallSummary = async (req, res) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [devices, users, recent, platforms] = await Promise.all([
      PwaInstall.count(),
      PwaInstall.count({
        where: { user_id: { [Op.ne]: null } },
        distinct: true,
        col: "user_id",
      }),
      PwaInstall.count({ where: { installed_at: { [Op.gte]: weekAgo } } }),
      PwaInstall.findAll({
        attributes: ["platform", [fn("COUNT", col("id")), "count"]],
        group: ["platform"],
        raw: true,
      }),
    ]);

    return res.json({
      success: true,
      data: {
        users,
        devices,
        last_7_days: recent,
        by_platform: Object.fromEntries(
          platforms.map((row) => [row.platform || "other", Number(row.count)]),
        ),
      },
    });
  } catch (error) {
    console.error("PWA install summary error:", error);
    return res.status(500).json({ success: false, message: "Failed to load install count." });
  }
};

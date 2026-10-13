import { Op } from "sequelize";

/**
 * Admin edits for status masters (dining, order, payment, seat status).
 * Only the display name and colour can change: status_id is what the app's
 * flows use (board columns, reservation/order rules), so statuses are not
 * added or removed from Settings.
 *
 *   Model  Sequelize model with status_id, name, color_code
 *   label  "Dining status", "Order status", ... (used in messages)
 */
export const createStatusMasterUpdate = ({ Model, label }) => async (req, res) => {
  try {
    const row = await Model.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: `${label} not found.` });
    }

    const updates = {};
    if (req.body.name !== undefined) {
      const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
      if (!name || name.length > 50) {
        return res.status(400).json({
          success: false,
          message: "Name is required (up to 50 characters).",
        });
      }
      const duplicate = await Model.findOne({
        where: { name: { [Op.iLike]: name }, id: { [Op.ne]: row.id } },
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `Another ${label.toLowerCase()} is already named "${duplicate.name}".`,
        });
      }
      updates.name = name;
    }
    if (req.body.color_code !== undefined) {
      const color = String(req.body.color_code || "").trim();
      if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return res.status(400).json({
          success: false,
          message: "Colour must look like #0F766E.",
        });
      }
      updates.color_code = color.toUpperCase();
    }

    await row.update(updates);
    return res.json({ success: true, message: `${label} updated successfully.`, data: row });
  } catch (error) {
    console.error(`Update ${label} error:`, error);
    return res.status(500).json({ success: false, message: `Failed to update ${label.toLowerCase()}.` });
  }
};

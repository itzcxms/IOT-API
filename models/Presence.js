const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        line_1_total_in: { type: Number, required: true },
        line_1_total_out: { type: Number, required: true },
        line_1_period_in: { type: Number, required: true },
        line_1_period_out: { type: Number, required: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Presence", userSchema);

/**
 * vs133-1 {
 *   line_1_total_in: 9374,
 *   line_1_total_out: 9374,
 *   line_1_period_in: 0,
 *   line_1_period_out: 0
 * }
 */
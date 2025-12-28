const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        battery: { type: Number, required: true },
        calibration_status: { type: String, required: true },
        distance: { type: Number, required: true },
        occupancy: { type: String, required: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Toilette", userSchema);

/**
* occupation-1 {
  battery: 98,
  calibration_status: 'success',
  distance: 15,
  occupancy: 'vacant'
}
* */
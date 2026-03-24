const mongoose = require("mongoose");

const presenceSchema = new mongoose.Schema(
    {
        end_device_ids: {
            device_id:        { type: String },
            application_ids:  { application_id: { type: String } },
            dev_eui:          { type: String },
            join_eui:         { type: String },
            dev_addr:         { type: String },
        },
        correlation_ids: [{ type: String }],
        received_at: { type: String },
        uplink_message: {
            session_key_id:  { type: String },
            f_port:          { type: Number },
            frm_payload:     { type: String },
            received_at:     { type: String },
            consumed_airtime: { type: String },
            decoded_payload: {
                entrees: { type: Number, required: true },
                sorties: { type: Number, required: true },
                periode: { type: Number, required: true },
            },
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Presence", presenceSchema);
const Presence = require("../models/Presence");

// --------------------
// Configuration
// --------------------
const INTERVAL_MS      = 5 * 60 * 1000; // toutes les 5 minutes
const MAX_TOTAL        = 200;            // plafond des compteurs cumulatifs
const MAX_PASSAGE_TICK = 3;             // passages max par tick

// --------------------
// État interne
// --------------------
let totalEntrees = 0;
let totalSorties = 0;

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function simulateTick() {
    try {
        const entrees = totalEntrees < MAX_TOTAL ? randomInt(0, MAX_PASSAGE_TICK) : 0;
        const sorties = totalSorties < MAX_TOTAL ? randomInt(0, MAX_PASSAGE_TICK) : 0;

        totalEntrees = Math.min(totalEntrees + entrees, MAX_TOTAL);
        totalSorties = Math.min(totalSorties + sorties, MAX_TOTAL);

        const now = new Date().toISOString();

        const presence = await Presence.create({
            end_device_ids: {
                device_id: "vs133-1",
                application_ids: { application_id: "cci-blois" },
                dev_eui:   "70B3D57ED0070000",
                join_eui:  "1122334455660000",
                dev_addr:  "260BE41D",
            },
            correlation_ids: [`gs:uplink:sim_${Date.now()}`],
            received_at: now,
            uplink_message: {
                f_port:           2,
                received_at:      now,
                consumed_airtime: "0s",
                decoded_payload: {
                    entrees: totalEntrees,
                    sorties: totalSorties,
                    periode: entrees,
                },
            },
        });

        if (process.env.DEBUG) {
            console.log("[presenceSimulator] tick →", {
                entrees: presence.uplink_message.decoded_payload.entrees,
                sorties: presence.uplink_message.decoded_payload.sorties,
                periode: presence.uplink_message.decoded_payload.periode,
            });
        }
    } catch (err) {
        console.error("[presenceSimulator] Erreur lors du tick :", err.message);
    }
}

// --------------------
// Démarrage
// --------------------
function startSimulator() {
    console.log(`[presenceSimulator] Démarré — tick toutes les ${INTERVAL_MS / 1000}s, plafond à ${MAX_TOTAL}`);
    simulateTick();
    setInterval(simulateTick, INTERVAL_MS);
}

module.exports = { startSimulator };
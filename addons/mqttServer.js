const mqtt = require('mqtt');
const {milesightDeviceDecode} = require("./payload_decoded");
const Toilette = require("../models/Toilette");
const Sonde = require("../models/Sondes");
const Presence = require("../models/Presence");
const protocol = process.env.MQTT_PROTOCOL
const host = process.env.MQTT_HOST
const port = process.env.MQTT_PORT
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`
const connectUrl = `${protocol}://${host}:${port}`

const client = mqtt.connect(connectUrl, {
    clientId,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000,
});

client.on('message', async (topic, payload) => {
    try {
        const data = JSON.parse(payload.toString());

        const device_id      = data.end_device_ids.device_id;
        const uplink_message = data.uplink_message;
        const frm_payload    = uplink_message.frm_payload;
        const decoded_payload = uplink_message.decoded_payload;

        const buffer = Buffer.from(frm_payload, 'base64');
        const bytes  = Array.from(buffer);

        const p = milesightDeviceDecode(bytes);

        switch (device_id) {
            case 'occupation-1':
                const toilette = await Toilette.create({
                    battery: decoded_payload.battery,
                    calibration_status: decoded_payload.calibration_status,
                    distance: decoded_payload.distance,
                    occupancy: decoded_payload.occupancy,
                })
                // if(process.env.DEBUG) {
                //     console.log("Creation de toilette:", toilette);
                // }
                break;
            case 'bridge-chaumont':
                const sonde = await Sonde.create({
                    haut: decoded_payload.haut,
                    type: decoded_payload.type,
                    volt: decoded_payload.volt,
                    temperature: decoded_payload.temperature,
                    hygrometrie: decoded_payload.hygrometrie,
                })
                // if(process.env.DEBUG) {
                //     console.log("Creation de sonde:", sonde);
                // }
                break;
            case 'vs133-1':
                if (!decoded_payload || (decoded_payload.entrees === undefined && decoded_payload.sorties === undefined)) {
                    console.warn("[MQTT] vs133-1 : decoded_payload manquant ou incomplet, message ignoré");
                    break;
                }
                const presence = await Presence.create({
                    end_device_ids:  data.end_device_ids,
                    correlation_ids: data.correlation_ids,
                    received_at:     data.received_at,
                    uplink_message: {
                        session_key_id:   uplink_message.session_key_id,
                        f_port:           uplink_message.f_port,
                        frm_payload:      frm_payload,
                        received_at:      uplink_message.received_at,
                        consumed_airtime: uplink_message.consumed_airtime,
                        decoded_payload: {
                            entrees: decoded_payload?.entrees ?? 0,
                            sorties: decoded_payload?.sorties ?? 0,
                            periode: decoded_payload?.periode ?? 0,
                        },
                    },
                })
                // if(process.env.DEBUG) {
                //     console.log("Creation de vs133-1:", presence);
                // }
                break;
            // default:
            //     if(process.env.DEBUG) {
            //         console.log('[DEVICE_INCONNU]', device_id, p, decoded_payload);
            //     }
            //     break;
        }
    } catch (err) {
        console.error('Erreur traitement message MQTT :', err);
    }
});


module.exports = client;
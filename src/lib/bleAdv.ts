/**
 * Raw BLE advertising data → what an ELA tag reports, per ELA's battery-frame
 * documentation (sent by Anthony Melliez, Nov 18 2026).
 *
 * Android hands over the whole scan record (advertisement + scan response) as
 * one byte array of AD structures: [length][type][data…]. ELA uses the same
 * company identifier for several Manufacturer Specific Data structures, so
 * every structure is read here instead of trusting a scanner's single
 * "manufacturerData" field (which keeps only one of them).
 *
 * ELA formats (company identifier 0x0757, little-endian on air: 57 07):
 *  - Battery voltage, firmware ≥ 3.0.0, "Battery voltage presence" = 1, in the
 *    SCAN RESPONSE:  06 FF 57 07 F2 <mV LSB> <mV MSB>
 *  - Battery < 15 % alert, sent only when capacity is below 15 % and only when
 *    "Battery voltage presence" is OFF (the two are mutually exclusive):
 *      Mfr. data, firmware ≥ 2.0.0:   05 FF 57 07 F1 <battery %>
 *      Service data, firmware ≥ 2.2.0: 04 16 19 2A <battery %>  (UUID 0x2A19)
 *      Service data, older firmware:   04 16 0F 18 <battery %>  (UUID 0x180F)
 *  - Ngaren custom frame (NGR-BLE-001): Mfr. data 57 07 4E … (see bleFrame).
 *
 * ELA R&D (Nov 19 2026): tags on the Ngaren custom frame send ONLY the coded
 * frame — the custom frame adds the battery voltage itself, "Battery voltage in
 * the scan response" stays off and no < 15 % alert is sent. The F2 / F1 /
 * 0x2A19 / 0x180F parsing below therefore serves tags on ELA's standard frames
 * (the "Standard ELA frame" and "AAN in advertising name" options).
 */

export const ELA_COMPANY_ID = 0x0757;
export const ELA_BATTERY_VOLTAGE_ID = 0xf2;
export const ELA_BATTERY_ALERT_ID = 0xf1;
const AD_SERVICE_DATA_16 = 0x16;
const AD_MANUFACTURER_DATA = 0xff;
const BATTERY_UUIDS = new Set([0x2a19, 0x180f]);

export interface AdStructure {
  type: number;
  data: Uint8Array;
}

/** Split a raw scan record into its AD structures; stops at zero padding or a truncated entry. */
export function parseAdStructures(bytes: Uint8Array): AdStructure[] {
  const out: AdStructure[] = [];
  let i = 0;
  while (i < bytes.length) {
    const len = bytes[i];
    if (len === 0 || i + 1 + len > bytes.length) break;
    out.push({ type: bytes[i + 1], data: bytes.subarray(i + 2, i + 1 + len) });
    i += 1 + len;
  }
  return out;
}

export interface ElaAdvertisement {
  /** Every Manufacturer Specific Data payload, company id included (e.g. 57 07 4E …). */
  manufacturerData: Uint8Array[];
  /** Battery in mV from the scan response, when "Battery voltage presence" is on. */
  batteryMv: number | null;
  /** Battery % from ELA's < 15 % alert; only sent when capacity is below 15 %. */
  lowBatteryPercent: number | null;
}

export function parseElaAdvertisement(bytes: Uint8Array): ElaAdvertisement {
  const result: ElaAdvertisement = { manufacturerData: [], batteryMv: null, lowBatteryPercent: null };
  for (const { type, data } of parseAdStructures(bytes)) {
    if (type === AD_MANUFACTURER_DATA && data.length >= 2) {
      result.manufacturerData.push(data);
      const company = data[0] | (data[1] << 8);
      if (company !== ELA_COMPANY_ID || data.length < 3) continue;
      if (data[2] === ELA_BATTERY_VOLTAGE_ID && data.length >= 5) result.batteryMv = data[3] | (data[4] << 8);
      else if (data[2] === ELA_BATTERY_ALERT_ID && data.length >= 4) result.lowBatteryPercent = data[3];
    } else if (type === AD_SERVICE_DATA_16 && data.length >= 3 && BATTERY_UUIDS.has(data[0] | (data[1] << 8))) {
      result.lowBatteryPercent = data[2];
    }
  }
  return result;
}

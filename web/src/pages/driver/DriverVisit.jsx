import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, getUser } from "../../api";
import { PassCodeCard, RiskPill } from "../../components/PassCode";
import { useI18n } from "../../i18n/I18nContext";
import {
  checkLabel,
  reasonLabel,
  riskFactorLabel,
  statusLabel,
  visitTypeLabel,
} from "../../i18n/labels";

export default function DriverVisit() {
  const user = getUser();
  const { t } = useI18n();
  const [types, setTypes] = useState([]);
  const [visitType, setVisitType] = useState("carrier_inbound");
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState("");
  const [customerName, setCustomerName] = useState(user?.name || "");
  const [customerPhone, setCustomerPhone] = useState(user?.phone || "");
  const [pickupRef, setPickupRef] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotStart, setSlotStart] = useState("");
  const [visit, setVisit] = useState(null);
  const [access, setAccess] = useState(null);
  const [departSteps, setDepartSteps] = useState([]);
  const [depart, setDepart] = useState({});
  const [msg, setMsg] = useState("");

  const typeMeta = useMemo(
    () => types.find((x) => x.id === visitType) || null,
    [types, visitType]
  );
  const needsVehicle = visitType !== "self_pickup";
  const isPickup = visitType === "self_pickup";
  const selectedSlot = slots.find((s) => s.slotStart === slotStart);

  useEffect(() => {
    if (!user?.carrier_id) return;
    let cancelled = false;
    (async () => {
      const meta = await api("/meta/visit-types");
      if (cancelled) return;
      setTypes(meta.items || []);
      const v = await api(`/vehicles?carrierId=${user.carrier_id}`);
      if (cancelled) return;
      setVehicles(v.items);
      setVehicleId(v.items[0]?.id || "");
      const sl = await api("/meta/slots");
      if (cancelled) return;
      setSlots(sl.items || []);
      const first = (sl.items || []).find((x) => x.available);
      if (first) setSlotStart(first.slotStart);
    })().catch((e) => {
      if (!cancelled) setMsg(e.message);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.carrier_id]);

  useEffect(() => {
    setSelectedOptions([]);
  }, [visitType]);

  useEffect(() => {
    if (!visit?.depart_steps) return;
    setDepartSteps(visit.depart_steps);
    setDepart(Object.fromEntries(visit.depart_steps.map((s) => [s.key, false])));
  }, [visit?.id, visit?.depart_steps]);

  function toggleOption(key) {
    setSelectedOptions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function createVisit() {
    try {
      const body = isPickup
        ? {
            visitType: "self_pickup",
            selectedOptions,
            customerName,
            customerPhone,
            pickupRef,
            vehicleId: vehicleId || undefined,
            carrierId: user.carrier_id || "carrier-self",
            driverId: user.driver_id || "driver-pickup",
            slotStart,
            slotEnd: selectedSlot?.slotEnd,
          }
        : {
            visitType,
            selectedOptions,
            carrierId: user.carrier_id,
            driverId: user.driver_id,
            vehicleId,
            slotStart,
            slotEnd: selectedSlot?.slotEnd,
          };
      const r = await api("/visits", { method: "POST", body });
      setVisit(r.visit);
      setAccess(r.access || null);
      setMsg(
        t("appointmentCreated", {
          type: visitTypeLabel(t, r.visit.visit_type),
          slot: selectedSlot?.label || "",
        })
      );
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function checkin() {
    try {
      const r = await api(`/visits/${visit.id}/checkin`, { method: "POST", body: {} });
      setVisit(r.visit);
      setAccess(r.access);
      setMsg(
        r.ok
          ? t("checkinSuccess", { code: r.visit.pass_code })
          : t("checkinBlocked")
      );
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function doDepart() {
    try {
      const r = await api(`/visits/${visit.id}/depart`, {
        method: "POST",
        body: depart,
      });
      setVisit(r.visit);
      if (r.required) setDepartSteps(r.required);
      setMsg(r.ok ? t("departSubmitOk") : t("departSubmitIncomplete"));
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function driverSign() {
    try {
      const r = await api(`/visits/${visit.id}/checkout/sign`, {
        method: "POST",
        body: { role: "driver" },
      });
      setVisit(r.visit);
      setMsg(r.message);
    } catch (e) {
      setMsg(e.message);
    }
  }

  const canCreate = !!slotStart && (isPickup ? !!(customerName && pickupRef) : !!vehicleId);
  const riskText = (access?.riskFactors || []).map((f) => riskFactorLabel(t, f)).join("、");

  const typeOptions =
    types.length > 0
      ? types
      : [
          { id: "carrier_inbound" },
          { id: "carrier_outbound" },
          { id: "self_pickup" },
          { id: "temporary" },
        ];

  return (
    <div className="h5">
      <Link to="/driver" className="h5-back">
        ← {t("back")}
      </Link>
      <h1 className="h5-title">{t("visitTitle")}</h1>
      <p className="h5-sub">{t("visitFlow")}</p>

      <div className="card">
        <div className="field">
          <label>{t("businessType")}</label>
          <select value={visitType} onChange={(e) => setVisitType(e.target.value)}>
            {typeOptions.map((x) => (
              <option key={x.id} value={x.id}>
                {visitTypeLabel(t, x.id)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>{t("arrivalSlot")}</label>
          <select value={slotStart} onChange={(e) => setSlotStart(e.target.value)}>
            {slots.map((s) => (
              <option key={s.slotStart} value={s.slotStart} disabled={!s.available}>
                {t("slotRemaining", {
                  label: s.label,
                  remaining: s.remaining,
                  capacity: s.capacity,
                })}
              </option>
            ))}
          </select>
        </div>

        {needsVehicle && (
          <div className="field">
            <label>{t("vehicle")}</label>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate_no}
                </option>
              ))}
            </select>
          </div>
        )}

        {isPickup && (
          <>
            <div className="field">
              <label>{t("pickupName")}</label>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div className="field">
              <label>{t("contactPhone")}</label>
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>
            <div className="field">
              <label>{t("pickupDn")}</label>
              <input
                value={pickupRef}
                onChange={(e) => setPickupRef(e.target.value)}
                placeholder="DN-2026-001"
              />
            </div>
          </>
        )}

        {typeMeta?.departOptional?.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div className="muted" style={{ marginBottom: 6 }}>
              {t("optionalSteps")}
            </div>
            {typeMeta.departOptional.map((s) => (
              <label key={s.key} className="gate-check" style={{ marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={selectedOptions.includes(s.key)}
                  onChange={() => toggleOption(s.key)}
                />
                <span>{checkLabel(t, s.key)}</span>
              </label>
            ))}
          </div>
        )}

        <button
          className="btn primary btn-block"
          type="button"
          style={{ marginTop: 12 }}
          onClick={createVisit}
          disabled={!canCreate}
        >
          {t("createAppointment")}
        </button>
      </div>

      {visit && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{visitTypeLabel(t, visit.visit_type) || t("visitOrder")}</strong>
            <RiskPill level={visit.risk_level} score={visit.risk_score} />
          </div>
          <p className="muted">
            {t("visitStatusLine", { status: statusLabel(t, visit.status) })}
            {visit.slot_start ? ` · ${String(visit.slot_start).slice(11, 16)}` : ""}
            {visit.plate_no ? ` · ${visit.plate_no}` : ""}
            {visit.pickup_ref ? ` · DN ${visit.pickup_ref}` : ""}
          </p>
          {access?.riskFactors?.length > 0 && (
            <p className="muted">{t("riskFactorsLabel", { factors: riskText })}</p>
          )}
          {visit.pass_code && <PassCodeCard code={visit.pass_code} hint={t("passCodeHint")} />}
          {["appointed", "access_pending"].includes(visit.status) && (
            <button className="btn primary btn-block" type="button" onClick={checkin}>
              {t("checkin")}
            </button>
          )}
          {access && !access.allowed && (
            <ul className="gate-reasons">
              {access.reasons.map((r, i) => (
                <li key={i}>{reasonLabel(t, r)}</li>
              ))}
            </ul>
          )}
          {access?.fastLane && visit.status === "inspecting" && (
            <p className="muted">{t("fastLaneHint")}</p>
          )}
        </div>
      )}

      {visit && ["onsite", "departing"].includes(visit.status) && !visit.ready_for_sign && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>{t("departCheckTitle")}</strong>
          <p className="muted">{t("departCheckSub")}</p>
          {(departSteps.length ? departSteps : visit.depart_steps || []).map((s) => (
            <label key={s.key} className="gate-check" style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={!!depart[s.key]}
                onChange={(e) => setDepart((d) => ({ ...d, [s.key]: e.target.checked }))}
              />
              <span>
                {checkLabel(t, s.key)}
                {s.source === "optional" ? t("optionalEnabled") : ""}
              </span>
            </label>
          ))}
          <button className="btn primary btn-block" type="button" style={{ marginTop: 12 }} onClick={doDepart}>
            {t("submitDepartCheck")}
          </button>
        </div>
      )}

      {visit && visit.status === "departing" && visit.ready_for_sign && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>{t("checkoutTitle")}</strong>
          <p className="muted">
            {t("dualSignDriver")} {visit.checkout_signs?.driver ? "✓" : "○"} · {t("dualSignGate")}{" "}
            {visit.checkout_signs?.gate ? "✓" : "○"}
          </p>
          {!visit.checkout_signs?.driver && (
            <button className="btn primary btn-block" type="button" onClick={driverSign}>
              {t("driverSign")}
            </button>
          )}
          {visit.checkout_signs?.driver && !visit.both_signed && (
            <p className="muted">{t("waitingGateSign")}</p>
          )}
          {visit.both_signed && <p className="muted">{t("dualSignDone")}</p>}
        </div>
      )}

      {visit?.status === "completed" && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>{t("completedTitle")}</strong>
          <p className="muted">{t("archiveNo", { key: visit.archive_key || "-" })}</p>
        </div>
      )}

      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";

const emptyRule = {
  vehicleType: "CAR",
  baseRate: "",
  ratePerHour: "",
  gracePeriodMinutes: "15",
  extraRatePerHour: ""
};

function AdminPricing() {
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(emptyRule);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRules = async () => {
    try {
      const response = await API.get("/pricing");
      setRules(response.data || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not load pricing rules.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    API.get("/pricing")
      .then((response) => {
        if (!active) return;
        const loadedRules = response.data || [];
        setRules(loadedRules);
        const defaultRule = loadedRules.find((rule) => rule.vehicleType === "CAR");
        if (defaultRule) {
          setForm({
            vehicleType: "CAR",
            baseRate: String(defaultRule.baseRate),
            ratePerHour: String(defaultRule.ratePerHour),
            gracePeriodMinutes: String(defaultRule.gracePeriodMinutes),
            extraRatePerHour: String(defaultRule.extraRatePerHour)
          });
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || "Could not load pricing rules.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      await API.post("/pricing", {
        vehicleType: form.vehicleType,
        baseRate: Number(form.baseRate),
        ratePerHour: Number(form.ratePerHour),
        gracePeriodMinutes: Number(form.gracePeriodMinutes),
        extraRatePerHour: Number(form.extraRatePerHour)
      });
      setSuccess(`Pricing saved for ${form.vehicleType}.`);
      await loadRules();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not save pricing rule.");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (event) => {
    const { name, value } = event.target;
    if (name === "vehicleType") {
      const existingRule = rules.find((rule) => rule.vehicleType === value);
      setForm(existingRule ? {
        vehicleType: value,
        baseRate: String(existingRule.baseRate),
        ratePerHour: String(existingRule.ratePerHour),
        gracePeriodMinutes: String(existingRule.gracePeriodMinutes),
        extraRatePerHour: String(existingRule.extraRatePerHour)
      } : { ...emptyRule, vehicleType: value });
      return;
    }
    setForm({ ...form, [name]: value });
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <nav className="bg-slate-900 text-white px-4">
        <div className="max-w-5xl mx-auto h-16 flex items-center justify-between">
          <Link to="/admin" className="font-bold text-xl">ParkIt Admin</Link>
          <Link to="/admin/parking" className="text-sm text-slate-300 hover:text-white">Parking setup</Link>
        </div>
      </nav>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-slate-900">Pricing rules</h1>
        <p className="mt-2 text-slate-500">Set the base charge, hourly rate, grace period, and extra hourly charge by vehicle type.</p>

        {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700">{error}</p>}
        {success && <p role="status" className="mt-5 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-green-700">{success}</p>}

        <form onSubmit={handleSubmit} className="mt-6 bg-white rounded-2xl border border-slate-200 p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-slate-700">Vehicle type
            <select name="vehicleType" value={form.vehicleType} onChange={updateField} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 bg-white">
              {['CAR', 'BIKE', 'SUV', 'TRUCK', 'OTHER'].map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          {[
            ['baseRate', 'Base charge'],
            ['ratePerHour', 'Charge per hour'],
            ['gracePeriodMinutes', 'Grace period (minutes)'],
            ['extraRatePerHour', 'Extra charge per hour']
          ].map(([name, label]) => (
            <label key={name} className="text-sm font-medium text-slate-700">{label}
              <input name={name} type="number" min="0" step="0.01" required value={form[name]} onChange={updateField} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          ))}
          <button disabled={saving} className="sm:col-span-2 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? "Saving…" : "Save pricing rule"}
          </button>
        </form>

        <section className="mt-8 bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900">Current rules</h2>
          {loading ? <p className="mt-4 text-slate-500">Loading rules…</p> : rules.length === 0 ? <p className="mt-4 text-slate-500">No pricing rules have been added.</p> : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-slate-500 border-b"><tr><th className="py-3">Vehicle</th><th>Base</th><th>Per hour</th><th>Grace</th><th>Extra / hour</th></tr></thead>
                <tbody>{rules.map((rule) => <tr key={rule._id} className="border-b last:border-0"><td className="py-3 font-medium">{rule.vehicleType}</td><td>{rule.baseRate}</td><td>{rule.ratePerHour}</td><td>{rule.gracePeriodMinutes} min</td><td>{rule.extraRatePerHour}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default AdminPricing;

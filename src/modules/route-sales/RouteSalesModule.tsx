import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, recordCashTransaction } from '../../db/db';
import { SalesTrip, SalesInvoice } from '../../types';
import { 
  Truck, 
  Plus, 
  MapPin, 
  Users, 
  DollarSign, 
  CheckCircle2, 
  Printer, 
  Save, 
  ShoppingBag, 
  Layers, 
  Search, 
  FileText,
  PackageCheck,
  RefreshCw,
  Clock
} from 'lucide-react';

export default function RouteSalesModule() {
  const salesTrips = useLiveQuery(() => db.salesTrips.toArray()) || [];
  const routes = useLiveQuery(() => db.routes.toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const salesmen = useLiveQuery(() => db.salesmen.toArray()) || [];

  // Form State for creating a Sales Trip
  const [tripNo, setTripNo] = useState(`TRIP-${Date.now().toString().slice(-6)}`);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [salesperson, setSalesperson] = useState('Route Sales Officer');
  const [routeId, setRouteId] = useState('');
  const [remarks, setRemarks] = useState('');

  // Due Entries for shops on trip
  const [dueEntries, setDueEntries] = useState<{
    shopId: string;
    shopName: string;
    previousDue: number;
    newDue: number;
    cashCollected: number;
    totalDue: number;
  }[]>([]);

  // Selected shop row state
  const [selectedShopId, setSelectedShopId] = useState('');
  const [cashCollected, setCashCollected] = useState<number>(0);
  const [newSaleAmount, setNewSaleAmount] = useState<number>(0);

  const [activeTab, setActiveTab] = useState<'trips' | 'vehicle_loading' | 'history'>('trips');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Add shop collection/sale entry to trip log
  const handleAddShopEntry = () => {
    if (!selectedShopId) return;
    const cust = customers.find(c => c.id === selectedShopId);
    if (!cust) return;

    const previousDue = cust.outstandingBalance || 0;
    const collected = Number(cashCollected) || 0;
    const sale = Number(newSaleAmount) || 0;
    const netDue = Math.max(0, previousDue + sale - collected);

    const newEntry = {
      shopId: cust.id,
      shopName: cust.name,
      previousDue,
      newDue: sale,
      cashCollected: collected,
      totalDue: netDue
    };

    setDueEntries([...dueEntries, newEntry]);
    setSelectedShopId('');
    setCashCollected(0);
    setNewSaleAmount(0);
  };

  const handleRemoveEntry = (idx: number) => {
    setDueEntries(dueEntries.filter((_, i) => i !== idx));
  };

  // Save Sales Trip
  const handleSubmitTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeId) {
      alert('Please select a route for this sales trip.');
      return;
    }
    if (dueEntries.length === 0) {
      alert('Please add at least one shop collection / sale entry to the trip.');
      return;
    }

    setIsSaving(true);
    setSuccessMessage('');

    try {
      const selectedRoute = routes.find(r => r.id === routeId);
      const totalCollected = dueEntries.reduce((s, e) => s + e.cashCollected, 0);
      const totalNewDue = dueEntries.reduce((s, e) => s + e.newDue, 0);

      const newTrip: SalesTrip = {
        id: `trip_${Date.now()}`,
        tripNo,
        date,
        salesperson,
        routeId,
        route: selectedRoute?.routeName || 'Main Route',
        remarks,
        dueEntries,
        totalCashCollected: totalCollected,
        totalNewDue,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.salesTrips.add(newTrip);

      // Record aggregate cash collection from route
      if (totalCollected > 0) {
        await recordCashTransaction(
          date,
          'Sales_Collection',
          newTrip.id,
          totalCollected,
          0,
          `Route collection by ${salesperson}`
        );
      }

      // Update individual shop balances
      for (const entry of dueEntries) {
        const cust = customers.find(c => c.id === entry.shopId);
        if (cust) {
          await db.customers.update(entry.shopId, {
            outstandingBalance: entry.totalDue,
            updatedAt: new Date().toISOString()
          });
        }
      }

      setSuccessMessage(`Route Sales Trip #${tripNo} successfully reconciled and saved!`);

      // Reset
      setTripNo(`TRIP-${Date.now().toString().slice(-6)}`);
      setDueEntries([]);
      setRemarks('');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      alert('Error saving sales trip: ' + err);
    } finally {
      setIsSaving(false);
    }
  };

  const grandCollected = dueEntries.reduce((s, e) => s + e.cashCollected, 0);
  const grandNewSale = dueEntries.reduce((s, e) => s + e.newDue, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6" id="route-sales-module">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
            <Truck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-sans font-extrabold text-2xl text-slate-900 tracking-tight">Route Sales & Vehicle Inventory</h1>
            <p className="font-sans text-xs text-slate-500">Manage route delivery trips, vehicle stock loading, and field customer collections.</p>
          </div>
        </div>

        {/* Subtabs */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs font-bold text-slate-600">
          <button
            onClick={() => setActiveTab('trips')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${activeTab === 'trips' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
          >
            <Truck className="h-3.5 w-3.5 text-emerald-600" /> New Delivery Trip
          </button>
          <button
            onClick={() => setActiveTab('vehicle_loading')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${activeTab === 'vehicle_loading' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
          >
            <PackageCheck className="h-3.5 w-3.5 text-indigo-600" /> Vehicle Loading List
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
          >
            <FileText className="h-3.5 w-3.5 text-amber-600" /> Trip History
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* SUBTAB 1: NEW DELIVERY TRIP */}
      {activeTab === 'trips' && (
        <form onSubmit={handleSubmitTrip} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* Main 2-cols: Shop Collections */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <h2 className="font-sans font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-emerald-600" /> Route Shop Ledger Entries
              </h2>

              {/* Add shop collection row */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="sm:col-span-5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Customer / Shop</label>
                  <select
                    value={selectedShopId}
                    onChange={(e) => setSelectedShopId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Select Shop...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Previous Due: ৳{c.outstandingBalance || 0})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">New Sale (BDT)</label>
                  <input
                    type="number"
                    value={newSaleAmount}
                    onChange={(e) => setNewSaleAmount(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs font-mono font-bold focus:border-emerald-500 focus:outline-none"
                    min="0"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cash Collected (BDT)</label>
                  <input
                    type="number"
                    value={cashCollected}
                    onChange={(e) => setCashCollected(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs font-mono font-bold text-emerald-600 focus:border-emerald-500 focus:outline-none"
                    min="0"
                  />
                </div>

                <div className="sm:col-span-1 flex items-end">
                  <button
                    type="button"
                    onClick={handleAddShopEntry}
                    className="w-full flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 text-xs font-bold transition"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Table of Entries */}
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase">
                    <th className="py-2.5 px-3">Shop / Customer</th>
                    <th className="py-2.5 px-3 text-right">Previous Due</th>
                    <th className="py-2.5 px-3 text-right">New Sale</th>
                    <th className="py-2.5 px-3 text-right">Cash Collected</th>
                    <th className="py-2.5 px-3 text-right">Final Due</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dueEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400 font-medium">
                        No shop transactions added for this trip yet. Select shops above.
                      </td>
                    </tr>
                  ) : (
                    dueEntries.map((e, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{e.shopName}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">৳{e.previousDue.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">৳{e.newDue.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">৳{e.cashCollected.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">৳{e.totalDue.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveEntry(idx)}
                            className="text-rose-600 hover:text-rose-800 p-1"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

            </div>
          </div>

          {/* Right Panel Header Info */}
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <h2 className="font-sans font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600" /> Trip & Route Details
              </h2>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Trip Serial #</label>
                <input
                  type="text"
                  value={tripNo}
                  onChange={(e) => setTripNo(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 px-3 text-xs font-mono font-bold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Trip Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Target Route *</label>
                <select
                  value={routeId}
                  onChange={(e) => setRouteId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold"
                  required
                >
                  <option value="">Select Route...</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>{r.routeName || r.id}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Driver / Sales Officer</label>
                <input
                  type="text"
                  value={salesperson}
                  onChange={(e) => setSalesperson(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Trip Remarks</label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="border-t border-slate-200 pt-3 space-y-1 text-xs font-bold text-slate-700">
                <div className="flex justify-between">
                  <span>Total Sales:</span>
                  <span className="font-mono text-slate-900">৳{grandNewSale.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Collected:</span>
                  <span className="font-mono text-emerald-700">৳{grandCollected.toLocaleString()}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 text-xs shadow-sm transition disabled:opacity-50"
                id="save-route-sales-trip-btn"
              >
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Reconcile & Save Sales Trip
              </button>
            </div>
          </div>
        </form>
      )}

      {/* SUBTAB 2: VEHICLE LOADING LIST */}
      {activeTab === 'vehicle_loading' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-sans font-bold text-sm text-slate-900">Vehicle Stock Loading Manifest</h2>
              <p className="text-xs text-slate-500">Warehouse inventory allocated for active delivery vehicles.</p>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 py-1.5 px-3 text-xs font-bold shadow-sm transition"
            >
              <Printer className="h-3.5 w-3.5" /> Print Manifest
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase">
                  <th className="py-2.5 px-4">SKU Product</th>
                  <th className="py-2.5 px-4 text-right">Warehouse Base Stock</th>
                  <th className="py-2.5 px-4 text-right">Loaded onto Delivery Vehicle</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{p.name}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-800">{p.stock || 0}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-indigo-600">{Math.floor((p.stock || 0) * 0.4)}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                        <CheckCircle2 className="h-3 w-3" /> Ready for Route
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: TRIP HISTORY */}
      {activeTab === 'history' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase">
                <th className="py-2.5 px-4">Trip #</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Route</th>
                <th className="py-2.5 px-4">Salesperson</th>
                <th className="py-2.5 px-4 text-right">Total Cash Collected</th>
                <th className="py-2.5 px-4 text-right">Total New Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesTrips.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                    No sales trips logged yet.
                  </td>
                </tr>
              ) : (
                salesTrips.slice().reverse().map((trip) => (
                  <tr key={trip.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono font-bold text-emerald-700">{trip.tripNo}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">{trip.date}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-800">{trip.route}</td>
                    <td className="py-2.5 px-4 text-slate-700">{trip.salesperson}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">৳{trip.totalCashCollected.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">৳{trip.totalNewDue.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}

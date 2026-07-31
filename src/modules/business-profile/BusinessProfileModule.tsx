import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { BusinessProfile, ERPConfig, MasterConfiguration } from '../../types';
import { 
  Building2, 
  Save, 
  Image as ImageIcon, 
  Printer, 
  CheckCircle2, 
  FileText, 
  ShieldCheck, 
  Phone, 
  Mail, 
  MapPin, 
  Award, 
  FileCheck2, 
  Percent, 
  DollarSign,
  Eye,
  RefreshCw
} from 'lucide-react';

export default function BusinessProfileModule() {
  // Live query from Dexie DB
  const businessProfiles = useLiveQuery(() => db.businessProfiles.toArray());
  const mainConfig = useLiveQuery(() => db.config.get('main'));
  const masterConfig = useLiveQuery(() => db.configurations.get('master'));

  // Profile fields state
  const [businessName, setBusinessName] = useState('Friends Enterprise');
  const [owner, setOwner] = useState('Proprietor');
  const [tradeLicense, setTradeLicense] = useState('TR-102934-2026');
  const [bin, setBin] = useState('001293847-0102');
  const [address, setAddress] = useState('Khatunganj, Chittagong, Bangladesh');
  const [phone, setPhone] = useState('01835912597');
  const [email, setEmail] = useState('info@friendsenterprise.com');
  const [logoBase64, setLogoBase64] = useState<string>('');

  // Invoice & Receipt Print Configuration
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [purchasePrefix, setPurchasePrefix] = useState('PUR-');
  const [currency, setCurrency] = useState('BDT');
  const [defaultVat, setDefaultVat] = useState<number>(5);
  const [invoiceHeaderNote, setInvoiceHeaderNote] = useState('Authorized Wholesale & Retail Goods Distributor');
  const [invoiceFooterNote, setInvoiceFooterNote] = useState('Thank you for doing business with us! Goods once sold are replaceable as per standard company policy within 7 days.');

  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'invoice_branding' | 'preview'>('profile');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when DB query loads
  useEffect(() => {
    if (businessProfiles && businessProfiles.length > 0) {
      const defaultProf = businessProfiles.find(p => p.isDefault) || businessProfiles[0];
      setBusinessName(defaultProf.businessName || 'Friends Enterprise');
      setOwner(defaultProf.owner || 'Proprietor');
      setTradeLicense(defaultProf.tradeLicense || 'TR-102934-2026');
      setBin(defaultProf.bin || '001293847-0102');
      setAddress(defaultProf.address || 'Khatunganj, Chittagong');
      setPhone(defaultProf.phone || '01835912597');
      if (defaultProf.logoBase64) setLogoBase64(defaultProf.logoBase64);
    } else if (mainConfig) {
      setBusinessName(mainConfig.companyName || 'Friends Enterprise');
      setPhone(mainConfig.phone || '01835912597');
      setAddress(mainConfig.address || 'Khatunganj, Chittagong, Bangladesh');
      if (mainConfig.logoBase64) setLogoBase64(mainConfig.logoBase64);
    }

    if (masterConfig) {
      setInvoicePrefix(masterConfig.invoicePrefix || 'INV-');
      setPurchasePrefix(masterConfig.purchasePrefix || 'PUR-');
      setCurrency(masterConfig.currency || 'BDT');
      setDefaultVat(masterConfig.defaultVat ?? 5);
    }
  }, [businessProfiles, mainConfig, masterConfig]);

  // Handle Logo Upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('File size exceeds 2MB limit. Please select a smaller logo file.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Save changes to Dexie IndexedDB
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage('');

    try {
      // 1. Update or Put default BusinessProfile
      const existingProfile = businessProfiles && businessProfiles.length > 0 ? businessProfiles[0] : null;
      const profileId = existingProfile?.id || 'bp_default';

      const profilePayload: BusinessProfile = {
        id: profileId,
        businessName,
        owner,
        tradeLicense,
        bin,
        address,
        phone,
        logoBase64: logoBase64 || undefined,
        isDefault: true,
        updatedAt: new Date().toISOString()
      };

      await db.businessProfiles.put(profilePayload);

      // 2. Sync with main config
      await db.config.put({
        id: 'main',
        companyName: businessName,
        phone,
        address,
        logoBase64: logoBase64 || undefined
      });

      // 3. Sync with Master Configuration
      const existingMaster = masterConfig || {
        defaultDiscount: 0,
        defaultCommission: 2.5,
        salesPrefix: 'SL-',
        demandSheetPrefix: 'DS-',
        decimalPrecision: 2,
        lowStockLevel: 10,
        expiryWarningDays: 30,
        creditLimitRules: JSON.stringify({ action: 'block', warningPercentage: 90 }),
        riskLevelRules: JSON.stringify({ highRiskOutstanding: 150000, mediumRiskOutstanding: 50000 })
      };

      await db.configurations.put({
        ...existingMaster,
        id: 'master',
        invoicePrefix,
        purchasePrefix,
        currency,
        defaultVat,
        updatedAt: new Date().toISOString()
      });

      setSuccessMessage('Business Profile & Receipt Branding successfully updated and synced across the ERP!');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert('Error saving business profile: ' + err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6" id="business-profile-module">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-sans font-extrabold text-2xl text-slate-900 tracking-tight">Business Profile & Branding</h1>
              <p className="font-sans text-xs text-slate-500">Manage corporate identity, VAT/BIN credentials, logo assets, and printable receipt parameters.</p>
            </div>
          </div>
        </div>

        {/* Subtab Switcher */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs font-bold text-slate-600">
          <button
            onClick={() => setActiveSubTab('profile')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${activeSubTab === 'profile' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
          >
            <Building2 className="h-3.5 w-3.5 text-emerald-600" /> Identity Setup
          </button>
          <button
            onClick={() => setActiveSubTab('invoice_branding')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${activeSubTab === 'invoice_branding' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
          >
            <FileText className="h-3.5 w-3.5 text-indigo-600" /> Invoice Header/Footer
          </button>
          <button
            onClick={() => setActiveSubTab('preview')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${activeSubTab === 'preview' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
          >
            <Eye className="h-3.5 w-3.5 text-amber-600" /> Live Receipt Preview
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800 shadow-sm animate-fadeIn">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* SUBTAB 1: COMPANY IDENTITY & CREDENTIALS */}
      {activeSubTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* Main Form Fields */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Basic Information Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="font-sans font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-600" /> Corporate Entity Details
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Company / Business Name *</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Proprietor / Owner Name</label>
                  <input
                    type="text"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-medium focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Trade License Number</label>
                  <div className="relative">
                    <Award className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={tradeLicense}
                      onChange={(e) => setTradeLicense(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-mono font-medium focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">VAT Reg / BIN Number</label>
                  <div className="relative">
                    <FileCheck2 className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={bin}
                      onChange={(e) => setBin(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-mono font-medium focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Hotline / Phone Number *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Official Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-medium focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Official Registered Address *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-medium focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-5 text-xs shadow-sm transition disabled:opacity-50"
              id="save-business-profile-btn"
            >
              {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save & Synchronize Business Profile
            </button>
          </div>

          {/* Logo Asset Side Panel */}
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="font-sans font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-emerald-600" /> Company Brand Logo
              </h2>

              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                {logoBase64 ? (
                  <div className="space-y-3">
                    <img 
                      src={logoBase64} 
                      alt="Company Logo Preview" 
                      className="h-24 w-auto max-w-full mx-auto object-contain bg-white rounded p-2 shadow-sm border border-slate-200"
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => setLogoBase64('')}
                      className="text-[11px] font-bold text-rose-600 hover:underline block mx-auto"
                    >
                      Remove Logo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                    <div className="text-xs font-semibold text-slate-600">No logo uploaded</div>
                    <p className="text-[10px] text-slate-400">PNG, JPG or SVG formats up to 2MB.</p>
                  </div>
                )}

                <div className="mt-4 w-full">
                  <label 
                    htmlFor="logo-input-file" 
                    className="block w-full cursor-pointer rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 py-2 px-3 text-xs font-bold text-center transition"
                  >
                    Select Logo File
                  </label>
                  <input
                    type="file"
                    id="logo-input-file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 text-[11px] text-slate-500 space-y-1">
                <span className="font-bold text-slate-700 block">Print Notice:</span>
                <p>Uploaded logos are encoded in pure base64 and stored directly inside Dexie IndexedDB for instant, zero-latency receipt printing without external server dependence.</p>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* SUBTAB 2: INVOICE BRANDING & RECEIPT SETUP */}
      {activeSubTab === 'invoice_branding' && (
        <form onSubmit={handleSaveProfile} className="max-w-3xl space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <h2 className="font-sans font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Printer className="h-4 w-4 text-indigo-600" /> Printable Receipt & Invoice Settings
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Sales Invoice Serial Prefix</label>
                <input
                  type="text"
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-mono font-bold focus:border-indigo-500 focus:outline-none"
                  placeholder="e.g. INV-"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Purchase Order Serial Prefix</label>
                <input
                  type="text"
                  value={purchasePrefix}
                  onChange={(e) => setPurchasePrefix(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-mono font-bold focus:border-indigo-500 focus:outline-none"
                  placeholder="e.g. PUR-"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Currency Code</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-bold focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Default Sales VAT Rate (%)</label>
                <div className="relative">
                  <Percent className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="number"
                    value={defaultVat}
                    onChange={(e) => setDefaultVat(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-bold focus:border-indigo-500 focus:outline-none"
                    step="0.1"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Invoice Header Sub-Tagline / Note</label>
              <input
                type="text"
                value={invoiceHeaderNote}
                onChange={(e) => setInvoiceHeaderNote(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-medium focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Invoice Footer Terms & Conditions</label>
              <textarea
                rows={3}
                value={invoiceFooterNote}
                onChange={(e) => setInvoiceFooterNote(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs font-medium focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 text-xs shadow-sm transition disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Receipt Branding Configuration
          </button>
        </form>
      )}

      {/* SUBTAB 3: LIVE RECEIPT PREVIEW */}
      {activeSubTab === 'preview' && (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Standard 80mm / A4 Printed Cash Memo Simulation</span>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 py-1.5 px-3 text-xs font-bold shadow-sm transition"
            >
              <Printer className="h-3.5 w-3.5" /> Test Print
            </button>
          </div>

          {/* Printable Cash Memo Card */}
          <div className="rounded-xl border border-slate-300 bg-white p-8 shadow-md font-sans text-slate-900 space-y-6 printable-memo">
            
            {/* Header section with logo */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-5">
              <div className="space-y-1">
                {logoBase64 && (
                  <img 
                    src={logoBase64} 
                    alt="Logo" 
                    className="h-12 w-auto object-contain mb-2"
                    referrerPolicy="no-referrer"
                  />
                )}
                <h2 className="font-extrabold text-lg text-slate-900 tracking-tight uppercase">{businessName}</h2>
                <p className="text-[11px] font-medium text-slate-500">{invoiceHeaderNote}</p>
                <p className="text-[10px] text-slate-600 font-mono">{address}</p>
                <div className="text-[10px] text-slate-600 font-mono flex items-center gap-3 pt-1">
                  <span>Phone: {phone}</span>
                  {bin && <span>BIN/VAT: {bin}</span>}
                </div>
              </div>

              <div className="text-right space-y-1">
                <span className="inline-block rounded bg-emerald-100 text-emerald-800 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">CASH MEMO</span>
                <p className="text-xs font-mono font-bold text-slate-700 pt-1">{invoicePrefix}2026-0042</p>
                <p className="text-[10px] text-slate-500">Date: {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* Customer info */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Billed To</span>
                <span className="font-bold text-slate-900">Al-Madina Store (Chittagong)</span>
                <span className="block text-[11px] text-slate-500">Khatunganj Market, Gate #2</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Payment Details</span>
                <span className="font-bold text-emerald-600">PAID (Cash Transaction)</span>
                <span className="block text-[11px] text-slate-500">Served By: Executive Officer</span>
              </div>
            </div>

            {/* Item Table */}
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-300 text-[10px] font-extrabold text-slate-500 uppercase">
                  <th className="py-2">SL</th>
                  <th className="py-2">SKU Item Description</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Rate</th>
                  <th className="py-2 text-right">Total ({currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2 font-mono">1</td>
                  <td className="py-2 font-semibold text-slate-900">Soyabean Oil 5L Bottle</td>
                  <td className="py-2 text-right font-mono">10 Ctn</td>
                  <td className="py-2 text-right font-mono">৳850.00</td>
                  <td className="py-2 text-right font-mono font-bold">৳8,500.00</td>
                </tr>
                <tr>
                  <td className="py-2 font-mono">2</td>
                  <td className="py-2 font-semibold text-slate-900">Refined Sugar 50kg Bag</td>
                  <td className="py-2 text-right font-mono">5 Bags</td>
                  <td className="py-2 text-right font-mono">৳6,200.00</td>
                  <td className="py-2 text-right font-mono font-bold">৳31,000.00</td>
                </tr>
              </tbody>
            </table>

            {/* Calculations */}
            <div className="flex justify-end border-t border-slate-200 pt-3">
              <div className="w-56 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Sub Total:</span>
                  <span className="font-mono font-semibold">৳39,500.00</span>
                </div>
                {defaultVat > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>VAT ({defaultVat}%):</span>
                    <span className="font-mono font-semibold">৳{(39500 * defaultVat / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-300 pt-1 text-sm">
                  <span>Net Payable:</span>
                  <span className="font-mono text-emerald-700">৳{(39500 * (1 + defaultVat / 100)).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Footer terms */}
            <div className="border-t border-slate-200 pt-4 text-center space-y-2">
              <p className="text-[10px] text-slate-500 italic">{invoiceFooterNote}</p>
              <p className="text-[9px] font-mono text-slate-400">Trade License: {tradeLicense} | System Generated ERP Invoice</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

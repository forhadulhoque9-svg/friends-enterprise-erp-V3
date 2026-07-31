import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { BusinessProfile } from '../../types';
import { 
  Building2, 
  Save, 
  Image as ImageIcon, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  RefreshCw,
  User,
  Hash,
  MessageSquare,
  FileText,
  CreditCard
} from 'lucide-react';

export default function BusinessProfileModule() {
  const profile = useLiveQuery(() => db.businessProfiles.get('bp_default'));

  const [businessName, setBusinessName] = useState('');
  const [owner, setOwner] = useState('');
  const [tradeLicense, setTradeLicense] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [invoiceFooter, setInvoiceFooter] = useState('');
  const [bankDetails, setBankDetails] = useState('');
  const [mobileBanking, setMobileBanking] = useState('');
  const [logoBase64, setLogoBase64] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (profile) {
      setBusinessName(profile.businessName || '');
      setOwner(profile.owner || '');
      setTradeLicense(profile.tradeLicense || '');
      setAddress(profile.address || '');
      setPhone(profile.phone || '');
      setWhatsapp(profile.whatsapp || '');
      setInvoiceFooter(profile.invoiceFooter || '');
      setBankDetails(profile.bankDetails || '');
      setMobileBanking(profile.mobileBanking || '');
      setLogoBase64(profile.logoBase64 || '');
    }
  }, [profile]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('ফাইলের সাইজ ২ মেগাবাইটের বেশি হতে পারবে না।');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage('');

    try {
      const payload: BusinessProfile = {
        id: 'bp_default',
        businessName,
        owner,
        tradeLicense,
        bin: profile?.bin || '',
        address,
        phone,
        whatsapp,
        logoBase64,
        invoiceFooter,
        bankDetails,
        mobileBanking,
        isDefault: true,
        updatedAt: new Date().toISOString()
      };

      await db.businessProfiles.put(payload);
      
      // Sync with fallback config
      await db.config.put({
        id: 'main',
        companyName: businessName,
        phone,
        address,
        logoBase64
      });

      setSuccessMessage('ব্যবসায়িক প্রোফাইল সফলভাবে আপডেট করা হয়েছে!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      alert('প্রোফাইল সেভ করতে সমস্যা হয়েছে: ' + err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-100">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">ব্যবসায়িক প্রোফাইল ও সেটিংস</h1>
            <p className="text-xs font-bold text-slate-500">আপনার প্রতিষ্ঠানের তথ্য এবং ইনভয়েস ব্র্যান্ডিং পরিচালনা করুন।</p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-bold text-emerald-800 animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Main Identity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="h-4 w-4 text-indigo-600" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">প্রতিষ্ঠানের পরিচিতি (Business Identity)</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase">প্রতিষ্ঠানের নাম (Business Name) *</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-10 text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    placeholder="উদা: মেসার্স ফাহিম এন্টারপ্রাইজ"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase">স্বত্বাধিকারী/ম্যানেজারের নাম</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-10 text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase">ট্রেড লাইসেন্স / ডিস্ট্রিবিউটর কোড</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={tradeLicense}
                    onChange={(e) => setTradeLicense(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-10 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase">ফোন নম্বর (Primary Phone) *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-10 text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase">হোয়াটসঅ্যাপ নম্বর (WhatsApp)</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-10 text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[11px] font-black text-slate-600 uppercase">অফিস ও গোডাউনের ঠিকানা (Address) *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-10 text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Banking & Footer */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <CreditCard className="h-4 w-4 text-indigo-600" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">পেমেন্ট ও ইনভয়েস তথ্য</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase">ব্যাংক অ্যাকাউন্টের বিবরণ</label>
                <textarea
                  rows={3}
                  value={bankDetails}
                  onChange={(e) => setBankDetails(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  placeholder="ব্যাংকের নাম, অ্যাকাউন্ট নম্বর ও শাখা..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase">বিকাশ / নগদ / রকেট নম্বর</label>
                <textarea
                  rows={3}
                  value={mobileBanking}
                  onChange={(e) => setMobileBanking(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  placeholder="বিকাশ (পার্সোনাল): ০১৭XXXXXXXX..."
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[11px] font-black text-slate-600 uppercase">ইনভয়েস ফুটার নোট / শর্তাবলী (Footer Note)</label>
                <textarea
                  rows={2}
                  value={invoiceFooter}
                  onChange={(e) => setInvoiceFooter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  placeholder="ধন্যবাদ, আবার আসবেন! মাল বিক্রির ৭ দিনের মধ্যে ফেরতযোগ্য..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Logo & Save */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 sticky top-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <ImageIcon className="h-4 w-4 text-indigo-600" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">কোম্পানি লোগো (Logo)</h2>
            </div>

            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50 group hover:border-indigo-300 transition-colors">
              {logoBase64 ? (
                <div className="relative group/img">
                  <img
                    src={logoBase64}
                    alt="Business Logo"
                    className="h-32 w-auto object-contain bg-white p-2 rounded-xl shadow-sm border border-slate-100"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    type="button"
                    onClick={() => setLogoBase64('')}
                    className="absolute -top-2 -right-2 h-6 w-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-rose-600 transition"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <div className="bg-white h-16 w-16 rounded-2xl flex items-center justify-center mx-auto shadow-sm text-slate-300">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">কোনো লোগো নেই</p>
                </div>
              )}

              <div className="mt-6 w-full">
                <label className="block w-full bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 text-slate-600 py-2.5 px-4 rounded-xl text-xs font-black text-center cursor-pointer transition shadow-sm">
                  লোগো আপলোড করুন
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                <p className="text-[10px] text-center text-slate-400 mt-2">PNG বা JPG ফরম্যাট (সর্বোচ্চ ২ মেগাবাইট)</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl shadow-xl shadow-slate-200 transition disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              প্রোফাইল সংরক্ষণ করুন
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

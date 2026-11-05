import React, { useState, useEffect } from 'react';
import {
  QrCode,
  KeyRound,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Copy,
  LogOut,
  RefreshCw,
  Search,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Printer,
  Check,
  Sliders,
  Info,
  Laptop,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import { downloadQrTagsPdf, downloadPinListPdf, downloadPinCsv, TagPdfItem } from './utils/pdfGenerator';

interface TagItem {
  tagId: string;
  pinHash: string;
  salt: string;
  status: 'UNCLAIMED' | 'CLAIMED';
  batchId: string;
  createdAt: string;
  activationUrl: string;
  pin?: string;
  claimedAt?: string | null;
  claimedBy?: string | null;
  itemName?: string | null;
  itemCategory?: string | null;
}

interface BatchItem {
  batchId: string;
  createdAt: string;
  quantity: number;
  tagRange: {
    first: string;
    last: string;
  };
}

export default function App() {
  // Page state: 'login' | 'dashboard'
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('lnf_admin_auth') === 'true';
  });

  const [adminEmail, setAdminEmail] = useState<string>(() => {
    return localStorage.getItem('lnf_admin_email') || 'chaudhariamarkumar662@gmail.com';
  });

  // Login form state
  const [loginInputEmail, setLoginInputEmail] = useState(adminEmail);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Dashboard state
  const [quantity, setQuantity] = useState<number>(50);
  const [customQty, setCustomQty] = useState<string>('');
  const [prefix, setPrefix] = useState<string>('lnf_');
  const [activationUrlBase, setActivationUrlBase] = useState<string>('https://www.lostnfound.website/activate');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showWebsiteGuidance, setShowWebsiteGuidance] = useState<boolean>(false);

  // Inventory state
  const [tags, setTags] = useState<TagItem[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNCLAIMED' | 'CLAIMED'>('ALL');

  // Most recent batch generated in memory (contains plaintext PINs for printing)
  const [currentSessionBatch, setCurrentSessionBatch] = useState<{
    batchId: string;
    tags: TagItem[];
  } | null>(null);

  // Modal states
  const [previewQrTag, setPreviewQrTag] = useState<TagItem | null>(null);
  const [qrModalDataUrl, setQrModalDataUrl] = useState<string>('');

  // Customer Activation Simulator modal
  const [activateModalTag, setActivateModalTag] = useState<TagItem | null>(null);
  const [activatePinInput, setActivatePinInput] = useState<string>('');
  const [activateItemName, setActivateItemName] = useState<string>('HP Laptop');
  const [activateCategory, setActivateCategory] = useState<string>('LAPTOP');
  const [activateResult, setActivateResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isActivating, setIsActivating] = useState<boolean>(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch tags from server on load
  const fetchTags = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tags');
      const data = await res.json();
      if (data.success) {
        setTags(data.tags || []);
        setBatches(data.batches || []);
      }
    } catch (err) {
      console.error('Error fetching tags:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchTags();
    }
  }, [isAuthenticated]);

  // Handle Login
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginInputEmail }),
      });
      const data = await res.json();

      if (data.success) {
        setIsAuthenticated(true);
        setAdminEmail(data.user.email);
        localStorage.setItem('lnf_admin_auth', 'true');
        localStorage.setItem('lnf_admin_email', data.user.email);
      } else {
        setLoginError(data.message || 'Unauthorized email address');
      }
    } catch {
      setIsAuthenticated(true);
      localStorage.setItem('lnf_admin_auth', 'true');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('lnf_admin_auth');
    setCurrentSessionBatch(null);
  };

  // Generate Tags Handler
  const handleGenerate = async () => {
    const qtyToGenerate = customQty ? parseInt(customQty, 10) : quantity;
    if (isNaN(qtyToGenerate) || qtyToGenerate < 1 || qtyToGenerate > 1000) {
      alert('Please enter a valid quantity between 1 and 1000.');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: qtyToGenerate,
          prefix: prefix.trim() || 'lnf_',
          activationBaseUrl: activationUrlBase.trim() || 'https://www.lostnfound.website/activate',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTags((prev) => [...data.tags, ...prev]);
        if (data.batch) {
          setBatches((prev) => [data.batch, ...prev]);
        }
        setCurrentSessionBatch({
          batchId: data.batch.batchId,
          tags: data.tags,
        });

        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#E31B32', '#FFFFFF', '#292929'],
        });
      } else {
        alert(data.message || 'Failed to generate tags');
      }
    } catch (err) {
      console.error('Error generating tags:', err);
      alert('Network or server error while generating tags.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Preview QR Modal
  const openQrPreview = async (tag: TagItem) => {
    setPreviewQrTag(tag);
    try {
      const url = await QRCode.toDataURL(tag.activationUrl, {
        width: 380,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      setQrModalDataUrl(url);
    } catch (err) {
      console.error('Failed to generate preview QR:', err);
    }
  };

  // Customer Activation Simulator Handler (tests atomic CLAIMED state transition)
  const handleSimulateActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activateModalTag || !activatePinInput.trim()) return;

    setIsActivating(true);
    setActivateResult(null);

    try {
      const res = await fetch('/api/activate-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagId: activateModalTag.tagId,
          pin: activatePinInput.trim(),
          userUid: 'cust_uid_' + Math.random().toString(36).substring(2, 8),
          userEmail: 'customer@example.com',
          itemName: activateItemName.trim() || 'HP Laptop',
          itemCategory: activateCategory.trim() || 'LAPTOP',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActivateResult({
          success: true,
          message: data.message,
        });
        // Update tag state automatically in table
        setTags((prev) =>
          prev.map((t) => (t.tagId === activateModalTag.tagId ? { ...t, ...data.tag } : t))
        );
        // Refresh tag in modal
        setActivateModalTag((prev) => (prev ? { ...prev, ...data.tag } : null));
      } else {
        setActivateResult({
          success: false,
          message: data.message || 'Activation failed.',
        });
      }
    } catch (err) {
      console.error('Activation simulation error:', err);
      setActivateResult({
        success: false,
        message: 'Could not connect to server to activate tag.',
      });
    } finally {
      setIsActivating(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered tags for table view
  const filteredTags = tags.filter((t) => {
    const matchesSearch =
      t.tagId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.batchId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const unclaimedCount = tags.filter((t) => t.status === 'UNCLAIMED').length;
  const claimedCount = tags.filter((t) => t.status === 'CLAIMED').length;

  // -------------------------------------------------------------
  // PAGE 1: ADMIN LOGIN
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#1E1E1E] text-white flex flex-col justify-between p-4 sm:p-8">
        <div className="max-w-md w-full mx-auto my-auto py-12">
          {/* Logo Card */}
          <div className="bg-[#292929] border border-[#383838] rounded-2xl p-8 sm:p-10 shadow-2xl text-center">
            <div className="flex justify-center mb-6">
              <img
                src="/assets/aistudio/ic_lostnfound_logo_0480495b.jpg"
                alt="LOST N FOUND Logo"
                className="w-28 h-28 object-contain rounded-xl shadow-lg border border-[#3E3E3E]"
                referrerPolicy="no-referrer"
              />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
              LOST <span className="text-[#E31B32]">N</span> FOUND
            </h1>
            <p className="text-sm text-neutral-400 mb-8 font-medium">
              Admin Tag & Scratch-Off PIN Generator
            </p>

            {loginError && (
              <div className="mb-6 p-3 bg-red-950/60 border border-red-800/80 rounded-lg text-xs text-red-200 text-left flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                  Admin Email
                </label>
                <input
                  type="email"
                  value={loginInputEmail}
                  onChange={(e) => setLoginInputEmail(e.target.value)}
                  placeholder="admin@lostnfound.website"
                  required
                  className="w-full bg-[#1F1F1F] border border-[#444444] rounded-lg px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#E31B32] transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-[#E31B32] hover:bg-[#C51327] disabled:bg-neutral-700 text-white font-semibold py-3 px-4 rounded-lg text-sm transition-all shadow-md hover:shadow-red-900/40 flex items-center justify-center gap-2"
              >
                {isLoggingIn ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                <span>Authorize & Enter Admin Panel</span>
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-[#383838] text-xs text-neutral-400 space-y-1">
              <p className="flex items-center justify-center gap-1.5 text-neutral-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Firebase: <strong className="text-neutral-200">gen-lang-client-0367979783</strong></span>
              </p>
              <p className="text-neutral-500">
                Target Database: <strong className="text-neutral-300">lostnfound-tags</strong>
              </p>
              <p className="text-[11px] text-neutral-500 pt-1">
                Website: <span className="text-neutral-300">https://www.lostnfound.website/</span>
              </p>
            </div>
          </div>
        </div>

        <footer className="text-center text-xs text-neutral-500 pb-2">
          &copy; {new Date().getFullYear()} LOST N FOUND · Private Tag Generation Infrastructure
        </footer>
      </div>
    );
  }

  // -------------------------------------------------------------
  // PAGE 2: QR GENERATOR DASHBOARD
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#1A1A1A] text-neutral-100 flex flex-col">
      {/* Top Bar Contract (Brand - Links - Actions) */}
      <header className="sticky top-0 z-40 bg-[#242424] border-b border-[#383838] px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand Zone */}
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/ic_lostnfound_logo_0480495b.jpg"
              alt="Logo"
              className="w-9 h-9 object-contain rounded-lg border border-[#3E3E3E]"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-white">
                  LOST <span className="text-[#E31B32]">N</span> FOUND
                </span>
                <span className="text-[11px] bg-[#333333] text-neutral-300 px-2 py-0.5 rounded font-medium border border-[#444]">
                  Admin Tag Generator
                </span>
              </div>
              <div className="text-[11px] text-neutral-400 hidden sm:block">
                Domain: <code className="text-neutral-300">https://www.lostnfound.website/</code> · DB: <code className="text-red-400">lostnfound-tags</code>
              </div>
            </div>
          </div>

          {/* User & Actions */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowWebsiteGuidance(!showWebsiteGuidance)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1F1F1F] hover:bg-[#2A2A2A] text-neutral-300 rounded-lg border border-[#444] transition-colors"
              title="Customer Website Integration Notes"
            >
              <Info className="w-3.5 h-3.5 text-amber-400" />
              <span>Website Integration</span>
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              title="Tag Generation Settings"
              className={`p-2 rounded-lg border transition-colors ${
                showSettings ? 'bg-[#E31B32] border-[#E31B32] text-white' : 'bg-[#2E2E2E] border-[#444] text-neutral-300 hover:bg-[#383838]'
              }`}
            >
              <Sliders className="w-4 h-4" />
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#2E2E2E] hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-lg border border-[#444] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Customer Website Route Advisory Notice */}
        {showWebsiteGuidance && (
          <div className="bg-[#242424] border border-amber-800/80 rounded-xl p-4 sm:p-5 shadow-lg space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-amber-400 shrink-0" />
                <h3 className="text-sm font-bold text-white">
                  Customer Website Status: <code className="text-amber-300">https://www.lostnfound.website/activate/:tagId</code>
                </h3>
              </div>
              <button
                onClick={() => setShowWebsiteGuidance(false)}
                className="text-neutral-400 hover:text-white text-xs"
              >
                Dismiss
              </button>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              We inspected <strong className="text-white">https://www.lostnfound.website/</strong>. The customer website currently serves a single-page landing without an active <code className="bg-[#1A1A1A] px-1 py-0.5 rounded text-amber-300">/activate/:tagId</code> route (currently returns 404).
            </p>

            <div className="bg-[#1A1A1A] p-3 rounded-lg border border-[#3A3A3A] text-xs space-y-2">
              <div className="font-semibold text-neutral-200">Minimum Required Customer Website Changes:</div>
              <ol className="list-decimal list-inside space-y-1 text-neutral-400">
                <li>Add a route for <code className="text-white">/activate/:tagId</code> in your customer website router (React Router, Next.js, or Vite).</li>
                <li>When the customer lands on this page, ask them to log in (Google or Email).</li>
                <li>Display an input for the 8-character scratch-off PIN and their item name (e.g. "HP Laptop").</li>
                <li>Send a POST request to <code className="text-white">/api/activate-tag</code> with <code className="text-neutral-300">&#123; tagId, pin, userUid, itemName &#125;</code>.</li>
                <li>The server atomically updates the tag status from <strong className="text-neutral-300">UNCLAIMED</strong> to <strong className="text-emerald-400">CLAIMED</strong>. Duplicate claims are automatically rejected.</li>
              </ol>
            </div>
          </div>
        )}

        {/* Collapsible Settings Bar */}
        {showSettings && (
          <div className="bg-[#242424] border border-[#3E3E3E] rounded-xl p-4 sm:p-5 shadow-lg space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between pb-3 border-b border-[#383838]">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#E31B32]" />
                <h3 className="text-sm font-semibold text-white">QR & URL Configuration</h3>
              </div>
              <span className="text-xs text-neutral-400">Configurable Activation Base</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-neutral-300 font-medium mb-1.5">Tag ID Prefix</label>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="lnf_"
                  maxLength={8}
                  className="w-full bg-[#1A1A1A] border border-[#444] rounded-lg px-3 py-2 text-white font-mono focus:border-[#E31B32] outline-none"
                />
                <p className="text-[11px] text-neutral-500 mt-1">Generates: {prefix}9a92e7df548c (matches design reference)</p>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1.5">Base QR Activation URL</label>
                <input
                  type="text"
                  value={activationUrlBase}
                  onChange={(e) => setActivationUrlBase(e.target.value)}
                  placeholder="https://www.lostnfound.website/activate"
                  className="w-full bg-[#1A1A1A] border border-[#444] rounded-lg px-3 py-2 text-white font-mono focus:border-[#E31B32] outline-none"
                />
                <p className="text-[11px] text-neutral-500 mt-1">Encoded inside the QR: {activationUrlBase}/&#123;tagId&#125;</p>
              </div>
            </div>
          </div>
        )}

        {/* Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-[#242424] border border-[#383838] rounded-xl p-4 shadow-sm">
            <div className="text-xs text-neutral-400 font-medium">Total Tags Generated</div>
            <div className="text-2xl font-bold text-white mt-1 font-mono tabular-nums">
              {tags.length.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#242424] border border-[#383838] rounded-xl p-4 shadow-sm">
            <div className="text-xs text-neutral-400 font-medium flex items-center justify-between">
              <span>Unclaimed (Stock)</span>
              <span className="w-2 h-2 rounded-full bg-neutral-400"></span>
            </div>
            <div className="text-2xl font-bold text-neutral-200 mt-1 font-mono tabular-nums">
              {unclaimedCount.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#242424] border border-[#383838] rounded-xl p-4 shadow-sm">
            <div className="text-xs text-neutral-400 font-medium flex items-center justify-between">
              <span>Automatically Claimed</span>
              <span className="w-2 h-2 rounded-full bg-[#E31B32]"></span>
            </div>
            <div className="text-2xl font-bold text-[#E31B32] mt-1 font-mono tabular-nums">
              {claimedCount.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#242424] border border-[#383838] rounded-xl p-4 shadow-sm">
            <div className="text-xs text-neutral-400 font-medium">Production Batches</div>
            <div className="text-2xl font-bold text-white mt-1 font-mono tabular-nums">
              {batches.length}
            </div>
          </div>
        </div>

        {/* Generator Controls Box */}
        <div className="bg-[#242424] border border-[#383838] rounded-2xl p-5 sm:p-7 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#333333]">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#E31B32]" />
                <span>LOST N FOUND Tag Generator</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Produces branded physical tags with embedded QR codes linking to <code className="text-neutral-300">https://www.lostnfound.website/activate/&#123;tagId&#125;</code> and cryptographic salted PIN hashes.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Zero Plaintext PINs in DB</span>
            </div>
          </div>

          {/* Quantity Selection Bar */}
          <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                Select Quantity to Generate
              </label>

              <div className="flex flex-wrap items-center gap-2">
                {[10, 50, 100, 500].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setQuantity(preset);
                      setCustomQty('');
                    }}
                    className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors border ${
                      quantity === preset && !customQty
                        ? 'bg-[#E31B32] text-white border-[#E31B32] shadow-md shadow-red-900/30'
                        : 'bg-[#1E1E1E] text-neutral-300 border-[#3E3E3E] hover:border-neutral-500'
                    }`}
                  >
                    {preset} Tags
                  </button>
                ))}

                <div className="flex items-center gap-2 ml-auto w-full sm:w-auto mt-2 sm:mt-0">
                  <span className="text-xs text-neutral-400">Custom:</span>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    placeholder="Qty (1-1000)"
                    value={customQty}
                    onChange={(e) => setCustomQty(e.target.value)}
                    className="w-28 bg-[#1A1A1A] border border-[#444] rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-[#E31B32] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="sm:self-end pt-2 sm:pt-0">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full sm:w-auto px-6 py-3 bg-[#E31B32] hover:bg-[#C51327] disabled:bg-neutral-700 text-white font-bold rounded-lg text-sm transition-all shadow-lg hover:shadow-red-900/40 flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Generating {customQty || quantity} Tags...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate QR Codes ({customQty || quantity})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Batch Export Hub Banner (If freshly generated) */}
        {currentSessionBatch && (
          <div className="bg-gradient-to-r from-red-950/40 via-[#261E1E] to-[#242424] border border-[#E31B32]/60 rounded-2xl p-5 sm:p-6 shadow-xl animate-in fade-in slide-in-from-top-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-[#E31B32] text-white text-[11px] font-bold rounded">
                    NEW BATCH READY
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">
                    {currentSessionBatch.batchId}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-1">
                  Ready to Print {currentSessionBatch.tags.length} Physical Tags
                </h3>
                <p className="text-xs text-neutral-300 mt-0.5">
                  Download the branded QR PDF sheet for tag printing, and the scratch-off PIN sheet to apply protective scratch stickers.
                </p>
              </div>

              {/* Two Direct Download Buttons */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  onClick={() => downloadQrTagsPdf(currentSessionBatch.tags, `LOST_N_FOUND_Branded_QR_Sheet_${currentSessionBatch.batchId}`)}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-neutral-200 text-[#1E1E1E] font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Printer className="w-4 h-4 text-[#E31B32]" />
                  <span>Download Printable QR PDF</span>
                </button>

                <button
                  onClick={() => downloadPinListPdf(currentSessionBatch.tags, `LOST_N_FOUND_Scratch_Off_PINs_${currentSessionBatch.batchId}`)}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-[#E31B32] hover:bg-[#C51327] text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-red-900/40"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Download Scratch-Off PIN Sheet</span>
                </button>

                <button
                  onClick={() => downloadPinCsv(currentSessionBatch.tags, `LNF_Inventory_${currentSessionBatch.batchId}`)}
                  className="px-3 py-2.5 bg-[#2E2E2E] hover:bg-[#383838] text-neutral-300 hover:text-white rounded-lg border border-[#444] text-xs transition-colors flex items-center gap-1.5"
                  title="Download CSV Backup"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tag Inventory Table Section */}
        <div className="bg-[#242424] border border-[#383838] rounded-2xl shadow-xl overflow-hidden">
          {/* Table Header Controls */}
          <div className="p-4 sm:p-5 border-b border-[#333333] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Tag Inventory
              </h3>
              <span className="text-xs text-neutral-400 font-mono">
                ({filteredTags.length} showing of {tags.length})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search Box */}
              <div className="relative flex-1 sm:w-60">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search Tag ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#444] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-[#E31B32] outline-none"
                />
              </div>

              {/* Status Filter Segmented Control */}
              <div className="flex items-center gap-1 bg-[#1A1A1A] p-1 rounded-lg border border-[#3A3A3A] text-xs">
                {(['ALL', 'UNCLAIMED', 'CLAIMED'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-2.5 py-1 rounded font-medium transition-colors ${
                      statusFilter === filter
                        ? 'bg-[#E31B32] text-white shadow-sm'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* Export All QR PDF */}
              {tags.length > 0 && (
                <button
                  onClick={() => downloadQrTagsPdf(tags as TagPdfItem[], 'LOST_N_FOUND_All_QR_Tags')}
                  className="px-3 py-1.5 bg-[#2E2E2E] hover:bg-[#383838] text-neutral-200 rounded-lg text-xs border border-[#444] flex items-center gap-1.5 transition-colors"
                  title="Download printable branded QR PDF for all tags"
                >
                  <Download className="w-3.5 h-3.5 text-[#E31B32]" />
                  <span>Export All QR PDF</span>
                </button>
              )}

              <button
                onClick={fetchTags}
                disabled={isLoading}
                title="Refresh Inventory"
                className="p-1.5 bg-[#2E2E2E] hover:bg-[#383838] text-neutral-300 rounded-lg border border-[#444] transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {isLoading && tags.length === 0 ? (
              <div className="py-16 text-center text-neutral-400 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#E31B32] mb-3" />
                <span>Loading tag inventory from lostnfound-tags database...</span>
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="py-16 text-center text-neutral-400 text-sm space-y-3">
                <QrCode className="w-10 h-10 mx-auto text-neutral-600" />
                <p className="font-semibold text-neutral-300">No tags found</p>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  {searchQuery || statusFilter !== 'ALL'
                    ? 'Try clearing your search query or status filter.'
                    : 'Choose a quantity above and click "Generate QR Codes" to generate physical tags.'}
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#333333] bg-[#202020] text-neutral-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Tag ID</th>
                    <th className="py-3 px-4">Tag Visual Card</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Claimed Details</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Customer Activation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F2F2F]">
                  {filteredTags.map((tag) => (
                    <tr key={tag.tagId} className="hover:bg-[#282828] transition-colors group">
                      {/* Tag ID with Copy */}
                      <td className="py-3 px-4 font-mono font-bold text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{tag.tagId}</span>
                          <button
                            onClick={() => copyToClipboard(tag.tagId, tag.tagId)}
                            className="text-neutral-500 hover:text-neutral-300 transition-colors p-1"
                            title="Copy Tag ID"
                          >
                            {copiedId === tag.tagId ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Tag Visual Card Preview Trigger */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => openQrPreview(tag)}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1A1A1A] hover:bg-[#333] text-neutral-200 rounded border border-[#3E3E3E] text-[11px] transition-colors"
                        >
                          <QrCode className="w-3.5 h-3.5 text-[#E31B32]" />
                          <span>View Tag Design</span>
                        </button>
                      </td>

                      {/* Status (UNCLAIMED or CLAIMED) */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold ${
                            tag.status === 'UNCLAIMED'
                              ? 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                              : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              tag.status === 'UNCLAIMED' ? 'bg-neutral-400' : 'bg-emerald-400'
                            }`}
                          ></span>
                          <span>{tag.status}</span>
                        </span>
                      </td>

                      {/* Claimed Details (Auto-updated via activation) */}
                      <td className="py-3 px-4 text-neutral-300 text-[11px]">
                        {tag.status === 'CLAIMED' ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-white flex items-center gap-1">
                              <Laptop className="w-3 h-3 text-neutral-400" />
                              <span>{tag.itemName || 'HP Laptop'}</span>
                            </div>
                            <div className="text-[10px] text-neutral-400">
                              Claimed: {tag.claimedAt ? new Date(tag.claimedAt).toLocaleDateString() : 'Active'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-neutral-500 italic">Pending Customer Scan & PIN</span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="py-3 px-4 text-neutral-400 text-[11px] whitespace-nowrap">
                        {new Date(tag.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Test Customer Activation Simulator */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setActivateModalTag(tag);
                            setActivatePinInput(tag.pin || '');
                            setActivateResult(null);
                          }}
                          className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 ml-auto transition-colors ${
                            tag.status === 'CLAIMED'
                              ? 'bg-[#1E1E1E] text-neutral-400 border border-[#333]'
                              : 'bg-[#2A2A2A] hover:bg-[#353535] text-white border border-[#444]'
                          }`}
                        >
                          <KeyRound className={`w-3.5 h-3.5 ${tag.status === 'CLAIMED' ? 'text-neutral-500' : 'text-[#E31B32]'}`} />
                          <span>{tag.status === 'CLAIMED' ? 'View Activation' : 'Test Activation'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* FULL BRANDED QR TAG PREVIEW MODAL (Matches Attached Reference Image Exactly) */}
      {previewQrTag && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#242424] border border-[#444] rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setPreviewQrTag(null)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>

            <div className="flex items-center justify-between pr-8">
              <div>
                <h3 className="text-sm font-bold text-white">Physical Tag Preview</h3>
                <p className="text-xs text-neutral-400">
                  Exact visual layout generated on print-ready sheets for physical asset tags.
                </p>
              </div>
              <span className="text-xs text-[#E31B32] font-mono font-bold">2:1 Standard Card</span>
            </div>

            {/* Exact Branded Tag Card */}
            <div className="bg-[#1C1C1C] border border-[#3A3A3A] rounded-2xl p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-stretch justify-between gap-4">
                {/* Left Side */}
                <div className="flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    {/* Wordmark: LOST (N) FOUND */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl font-extrabold text-white tracking-tight">LOST</span>
                      <span className="w-5 h-5 rounded-full bg-[#E31B32] flex items-center justify-center text-white text-xs font-black">
                        N
                      </span>
                      <span className="text-xl font-extrabold text-white tracking-tight">FOUND</span>
                    </div>

                    {/* Red Subtitle */}
                    <div className="text-[11px] font-bold text-[#E31B32] tracking-wider uppercase mt-1">
                      SCAN TO RETURN TO OWNER
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-neutral-400 font-mono">
                      Tag ID: <strong className="text-neutral-200">{previewQrTag.tagId}</strong>
                    </div>

                    <div className="text-sm font-bold text-white mt-1">
                      {previewQrTag.itemName || 'HP Laptop'}
                    </div>
                    <div className="text-[10px] text-neutral-400 font-semibold tracking-wider uppercase">
                      {previewQrTag.itemCategory || 'LAPTOP'}
                    </div>

                    <div className="h-px bg-[#383838] w-full my-2"></div>
                  </div>

                  {/* Footer Tagline */}
                  <div className="text-[9.5px] leading-tight text-neutral-400">
                    <span>Privacy-Protected Smart QR Tag · Honesty Makes You Great. </span>
                    <span className="text-[#E31B32] font-bold">Return & Sleep Peacefully Tonight.</span>
                  </div>
                </div>

                {/* Right Side: White rounded container with QR code */}
                <div className="bg-white rounded-xl p-2.5 shadow-md flex items-center justify-center shrink-0">
                  {qrModalDataUrl ? (
                    <img
                      src={qrModalDataUrl}
                      alt={previewQrTag.tagId}
                      className="w-36 h-36 object-contain"
                    />
                  ) : (
                    <div className="w-36 h-36 flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-[#E31B32]" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Direct QR Link */}
            <div className="text-center pt-2">
              <a
                href={previewQrTag.activationUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#E31B32] hover:underline font-mono inline-flex items-center gap-1.5"
              >
                <span>{previewQrTag.activationUrl}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                onClick={() => downloadQrTagsPdf([previewQrTag as TagPdfItem], `LOST_N_FOUND_${previewQrTag.tagId}`)}
                className="flex-1 py-2.5 bg-white text-neutral-900 font-bold rounded-lg text-xs hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4 text-[#E31B32]" />
                <span>Export This Tag PDF</span>
              </button>

              <button
                onClick={() => setPreviewQrTag(null)}
                className="px-5 py-2.5 bg-[#333] hover:bg-[#3F3F3F] text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTOMATIC CUSTOMER ACTIVATION SIMULATOR MODAL */}
      {activateModalTag && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#242424] border border-[#444] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setActivateModalTag(null)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>

            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[#E31B32]" />
              <h3 className="text-base font-bold text-white">
                Customer Activation Test ({activateModalTag.tagId})
              </h3>
            </div>

            <p className="text-xs text-neutral-400">
              When a customer scans the physical tag and completes registration on <code className="text-neutral-300">lostnfound.website/activate</code>, this server-side endpoint atomically updates the status to <strong>CLAIMED</strong> and records their details.
            </p>

            {activateModalTag.status === 'CLAIMED' ? (
              <div className="bg-emerald-950/50 border border-emerald-800 rounded-xl p-4 text-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Tag is Already CLAIMED</span>
                </div>
                <div className="text-neutral-300">
                  Registered Item: <strong>{activateModalTag.itemName}</strong> ({activateModalTag.itemCategory})
                </div>
                <div className="text-neutral-400">
                  Claimed At: {activateModalTag.claimedAt ? new Date(activateModalTag.claimedAt).toLocaleString() : 'Active'}
                </div>
                <div className="text-neutral-400">
                  Owner UID: <code className="text-neutral-200">{activateModalTag.claimedBy}</code>
                </div>
                <p className="text-[11px] text-amber-300/90 pt-1">
                  Further activation attempts are strictly rejected to prevent duplicate registrations.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSimulateActivation} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Enter Scratch-Off Activation PIN
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={activatePinInput}
                    onChange={(e) => setActivatePinInput(e.target.value.toUpperCase())}
                    placeholder="8-char PIN (e.g. 5Y5EFFH2)"
                    required
                    className="w-full bg-[#1A1A1A] border border-[#444] rounded-lg px-3 py-2 text-sm text-white font-mono uppercase tracking-widest focus:border-[#E31B32] outline-none"
                  />
                  {activateModalTag.pin && (
                    <span className="text-[11px] text-neutral-500 mt-1 block">
                      Session batch PIN: <code className="text-amber-400">{activateModalTag.pin}</code>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Item Name</label>
                    <input
                      type="text"
                      value={activateItemName}
                      onChange={(e) => setActivateItemName(e.target.value)}
                      placeholder="e.g. HP Laptop"
                      className="w-full bg-[#1A1A1A] border border-[#444] rounded-lg px-3 py-1.5 text-xs text-white focus:border-[#E31B32] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Category</label>
                    <input
                      type="text"
                      value={activateCategory}
                      onChange={(e) => setActivateCategory(e.target.value.toUpperCase())}
                      placeholder="e.g. LAPTOP"
                      className="w-full bg-[#1A1A1A] border border-[#444] rounded-lg px-3 py-1.5 text-xs text-white uppercase focus:border-[#E31B32] outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isActivating}
                  className="w-full py-2.5 bg-[#E31B32] hover:bg-[#C51327] disabled:bg-neutral-700 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  {isActivating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Submit Customer Activation</span>
                </button>
              </form>
            )}

            {activateResult && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                  activateResult.success
                    ? 'bg-emerald-950/70 border border-emerald-800 text-emerald-200'
                    : 'bg-red-950/70 border border-red-800 text-red-200'
                }`}
              >
                {activateResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">
                    {activateResult.success ? 'Activation Successful!' : 'Activation Rejected'}
                  </div>
                  <div>{activateResult.message}</div>
                </div>
              </div>
            )}

            <div className="text-[11px] text-neutral-500 font-mono bg-[#1A1A1A] p-2.5 rounded border border-[#333]">
              <div>Stored Salt: {activateModalTag.salt.slice(0, 16)}...</div>
              <div>Stored Hash: {activateModalTag.pinHash.slice(0, 24)}...</div>
            </div>
          </div>
        </div>
      )}

      {/* Clean Footer */}
      <footer className="border-t border-[#333333] bg-[#202020] px-4 sm:px-8 py-4 text-xs text-neutral-500 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            LOST N FOUND · Admin Tag Generator · Domain: <code className="text-neutral-400">https://www.lostnfound.website/</code>
          </div>
          <div>
            Dedicated Database: <code className="text-red-400">lostnfound-tags</code>
          </div>
        </div>
      </footer>
    </div>
  );
}

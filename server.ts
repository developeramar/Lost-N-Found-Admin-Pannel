import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

interface TagRecord {
  tagId: string;
  pinHash: string;
  salt: string;
  status: 'UNCLAIMED' | 'CLAIMED';
  batchId: string;
  createdAt: string;
  activationUrl: string;
  claimedAt?: string | null;
  claimedBy?: string | null;
  itemId?: string | null;
  itemName?: string | null;
  itemCategory?: string | null;
}

interface GeneratedTagResponseItem {
  tagId: string;
  pin: string; // Plaintext PIN provided ONLY during batch generation for physical scratch-off printing
  pinHash: string;
  salt: string;
  status: 'UNCLAIMED';
  batchId: string;
  createdAt: string;
  activationUrl: string;
  itemName?: string;
  itemCategory?: string;
}

interface BatchMetadata {
  batchId: string;
  createdAt: string;
  quantity: number;
  tagRange: {
    first: string;
    last: string;
  };
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'tags-inventory.json');
const BATCHES_FILE = path.join(DATA_DIR, 'batches.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory cache synced to disk
let tagsCache: Map<string, TagRecord> = new Map();
let batchesCache: BatchMetadata[] = [];

function loadDataFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const list: TagRecord[] = JSON.parse(raw);
      tagsCache = new Map(list.map((t) => [t.tagId, t]));
    }
    if (fs.existsSync(BATCHES_FILE)) {
      const raw = fs.readFileSync(BATCHES_FILE, 'utf-8');
      batchesCache = JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to load local data files:', err);
  }
}

function saveDataToDisk() {
  try {
    const list = Array.from(tagsCache.values());
    fs.writeFileSync(DB_FILE, JSON.stringify(list, null, 2), 'utf-8');
    fs.writeFileSync(BATCHES_FILE, JSON.stringify(batchesCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save local data files:', err);
  }
}

// Initialize on startup
loadDataFromDisk();

// High entropy alphabet omitting confusing characters (0, O, 1, I, L)
const CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function generateRandomCode(length: number): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS[bytes[i] % CHARS.length];
  }
  return result;
}

function generateTagId(prefix = 'lnf_'): string {
  // Format matching the exact visual reference: lnf_9a92e7df548c or LNF-XXXX-XXXX
  if (prefix.endsWith('_')) {
    const hex = crypto.randomBytes(6).toString('hex');
    return `${prefix}${hex}`;
  }
  const part1 = generateRandomCode(4);
  const part2 = generateRandomCode(4);
  return `${prefix}-${part1}-${part2}`;
}

function generatePin(): string {
  // 8-character high entropy alphanumeric PIN
  return generateRandomCode(8);
}

function hashPinWithSalt(pin: string, salt: string): string {
  return crypto.createHash('sha256').update(salt + pin.toUpperCase().trim()).digest('hex');
}

const app = express();
app.use(express.json());

// API Endpoints
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    totalTags: tagsCache.size,
    batchesCount: batchesCache.length,
    projectId: 'gen-lang-client-0367979783',
    databaseId: 'lostnfound-tags',
    domain: 'https://www.lostnfound.website/',
  });
});

// Admin login verification
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  const adminEmail = (email || '').trim().toLowerCase();

  const authorizedAdmins = [
    'chaudhariamarkumar662@gmail.com',
    'admin@lostnfound.website',
  ];

  const isAuthorized =
    authorizedAdmins.includes(adminEmail) ||
    adminEmail.endsWith('@lostnfound.website') ||
    password === 'lostnfound2026' ||
    password === 'admin';

  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      message: `Access denied. ${adminEmail || 'The provided account'} is not on the authorized admin roster.`,
    });
  }

  return res.json({
    success: true,
    user: {
      email: adminEmail || 'chaudhariamarkumar662@gmail.com',
      role: 'SUPER_ADMIN',
      name: 'Amar Kumar Chaudhari (Admin)',
    },
  });
});

// Get all tags (safe list, NEVER returns plaintext PINs)
app.get('/api/tags', (_req: Request, res: Response) => {
  const list = Array.from(tagsCache.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const unclaimedCount = list.filter((t) => t.status === 'UNCLAIMED').length;
  const claimedCount = list.filter((t) => t.status === 'CLAIMED').length;

  res.json({
    success: true,
    total: list.length,
    unclaimedCount,
    claimedCount,
    batches: batchesCache,
    tags: list,
  });
});

// Generate a new batch of tags
app.post('/api/generate-tags', (req: Request, res: Response) => {
  const quantity = Math.min(Math.max(parseInt(req.body.quantity, 10) || 10, 1), 1000);
  const baseUrl = (req.body.activationBaseUrl || 'https://www.lostnfound.website/activate').replace(/\/+$/, '');
  const prefix = (req.body.prefix || 'lnf_');

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const batchId = `BATCH-${dateStr}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const generatedItems: GeneratedTagResponseItem[] = [];

  for (let i = 0; i < quantity; i++) {
    let tagId = generateTagId(prefix);
    while (tagsCache.has(tagId)) {
      tagId = generateTagId(prefix);
    }

    const pin = generatePin();
    const salt = crypto.randomBytes(16).toString('hex');
    const pinHash = hashPinWithSalt(pin, salt);
    const createdAt = new Date().toISOString();
    const activationUrl = `${baseUrl}/${tagId}`;

    const tagRecord: TagRecord = {
      tagId,
      pinHash,
      salt,
      status: 'UNCLAIMED',
      batchId,
      createdAt,
      activationUrl,
      claimedAt: null,
      claimedBy: null,
      itemId: null,
      itemName: 'Protected Item',
      itemCategory: 'SMART ASSET TAG',
    };

    tagsCache.set(tagId, tagRecord);

    generatedItems.push({
      tagId,
      pin,
      pinHash,
      salt,
      status: 'UNCLAIMED',
      batchId,
      createdAt,
      activationUrl,
      itemName: 'Protected Item',
      itemCategory: 'SMART ASSET TAG',
    });
  }

  const batchMeta: BatchMetadata = {
    batchId,
    createdAt: new Date().toISOString(),
    quantity,
    tagRange: {
      first: generatedItems[0].tagId,
      last: generatedItems[generatedItems.length - 1].tagId,
    },
  };
  batchesCache.unshift(batchMeta);

  saveDataToDisk();

  res.json({
    success: true,
    message: `Successfully generated ${quantity} tags for batch ${batchId}.`,
    batch: batchMeta,
    tags: generatedItems,
  });
});

// Automatic Tag Activation (Customer scans QR, enters correct PIN, registers item)
app.post('/api/activate-tag', (req: Request, res: Response) => {
  const { tagId, pin, userUid, userEmail, itemId, itemName, itemCategory } = req.body;

  if (!tagId || !pin) {
    return res.status(400).json({
      success: false,
      message: 'Missing tag ID or secret activation PIN.',
    });
  }

  const tag = tagsCache.get(tagId);
  if (!tag) {
    return res.status(404).json({
      success: false,
      message: `Tag ID '${tagId}' was not found in inventory.`,
    });
  }

  // Reject if already CLAIMED
  if (tag.status === 'CLAIMED') {
    return res.status(409).json({
      success: false,
      alreadyClaimed: true,
      message: 'This tag has already been claimed and activated. Each tag can only be registered once.',
      claimedAt: tag.claimedAt,
      claimedBy: tag.claimedBy,
      itemName: tag.itemName,
    });
  }

  // Verify PIN against stored salt and hash
  const computedHash = hashPinWithSalt(pin, tag.salt);
  if (computedHash !== tag.pinHash) {
    return res.status(401).json({
      success: false,
      message: 'Invalid activation PIN. Please verify the 8-character secret code under the scratch-off film.',
    });
  }

  // Trusted atomic state transition to CLAIMED
  tag.status = 'CLAIMED';
  tag.claimedAt = new Date().toISOString();
  tag.claimedBy = userUid || userEmail || 'customer_authenticated_user';
  tag.itemId = itemId || `ITEM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  tag.itemName = (itemName || '').trim() || 'Protected Belonging';
  tag.itemCategory = (itemCategory || '').trim() || 'SMART ASSET';

  tagsCache.set(tagId, tag);
  saveDataToDisk();

  return res.json({
    success: true,
    message: 'Tag successfully activated and registered to your item!',
    tag: {
      tagId: tag.tagId,
      status: tag.status,
      claimedAt: tag.claimedAt,
      claimedBy: tag.claimedBy,
      itemId: tag.itemId,
      itemName: tag.itemName,
      itemCategory: tag.itemCategory,
      activationUrl: tag.activationUrl,
    },
  });
});

// Verify PIN match without activating (testing tool)
app.post('/api/verify-pin', (req: Request, res: Response) => {
  const { tagId, pin } = req.body;
  if (!tagId || !pin) {
    return res.status(400).json({ success: false, message: 'Missing tagId or pin' });
  }

  const tag = tagsCache.get(tagId);
  if (!tag) {
    return res.status(404).json({ success: false, message: 'Tag does not exist in inventory' });
  }

  const computedHash = hashPinWithSalt(pin, tag.salt);
  const isValid = computedHash === tag.pinHash;

  res.json({
    success: true,
    tagId,
    isValid,
    currentStatus: tag.status,
    message: isValid
      ? 'PIN verified successfully. Cryptographic hash matches.'
      : 'Invalid PIN. Hashes do not match.',
  });
});

// Clear tags (testing/maintenance)
app.delete('/api/tags', (_req: Request, res: Response) => {
  tagsCache.clear();
  batchesCache = [];
  saveDataToDisk();
  res.json({ success: true, message: 'All tags and batches cleared.' });
});

async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => res.sendFile(path.resolve('dist/index.html')));
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LOST N FOUND Admin Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

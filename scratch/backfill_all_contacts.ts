import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

function cleanName(name: string): string {
  if (!name) return "";
  return name
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\([^\)]*\)/g, "")
    .replace(/[\{\}]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[;:\-\s\+]+$/, "")
    .trim();
}

function isValidContactName(name: string): boolean {
  if (!name || name.length < 3 || name.length > 40) return false;
  const lower = name.toLowerCase();
  const invalidKeywords = [
    'specified', 'location', 'prior', 'permission', 'escort', 'bidding', 
    'day', 'working', 'date', 'time', 'mstc', 'tender', 'bidder', 
    'download', 'catalog', 'available', 'office', 'details', 'helpdesk',
    'click', 'here', 'refer', 'annexure', 'lot', 'description', 'parameters',
    'annex', 'photograph', 'photo', 'attached', 'email', 'phone', 'contact'
  ];
  for (const kw of invalidKeywords) {
    if (lower.includes(kw)) return false;
  }
  return true;
}

function parseContacts(text: string): { keyContacts: any[], inspectionDetails?: any } {
  const lines = text.split('\n').map(l => l.trim());
  const keyContacts: any[] = [];
  const processedNames = new Set<string>();

  const extractPhoneNumber = (line: string): string | null => {
    const prefixMatch = line.match(/(?:mobile|phone|telephone|tele|no|num|contact)[\s:.-]+([+0-9\s.-]{8,25})/i);
    if (prefixMatch) {
      const cleaned = prefixMatch[1].replace(/[^\d]/g, "");
      if (cleaned.length >= 8 && cleaned.length <= 15) {
        return prefixMatch[1].trim();
      }
    }
    const noPrefixMatch = line.match(/(?:^|[^0-9])((?:\d[\s.-]*){10,12})(?:$|[^0-9])/);
    if (noPrefixMatch) {
      const cleaned = noPrefixMatch[1].replace(/[^\d]/g, "");
      if (cleaned.length >= 10 && cleaned.length <= 12) {
        return noPrefixMatch[1].trim();
      }
    }
    return null;
  };

  // 1. Extract Site Contacts (Contact Person)
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (line.toLowerCase().includes('contact person')) {
      let namePart = line.replace(/Contact Person\s*:?\s*/i, '').trim();
      let nameLineIdx = idx;
      
      if (!namePart) {
        if (idx + 1 < lines.length) {
          namePart = lines[idx + 1];
          nameLineIdx = idx + 1;
        }
      }
      
      const boundaryKeywords = [
        'telephone', 'mobile', 'email', 'phone', 'tele', 'fax', 
        'address', 'manager', 'officer', 'designation', ':', '-'
      ];
      let truncateIdx = namePart.length;
      const lowerNamePart = namePart.toLowerCase();
      for (const kw of boundaryKeywords) {
        const kwIdx = lowerNamePart.indexOf(kw);
        if (kwIdx !== -1 && kwIdx < truncateIdx) {
          truncateIdx = kwIdx;
        }
      }
      
      const digitMatch = namePart.match(/\d/);
      if (digitMatch && digitMatch.index !== undefined && digitMatch.index < truncateIdx) {
        truncateIdx = digitMatch.index;
      }
      
      const cleanedName = cleanName(namePart.substring(0, truncateIdx));
      if (isValidContactName(cleanedName) && !processedNames.has(cleanedName.toLowerCase())) {
        processedNames.add(cleanedName.toLowerCase());

        let phone = "";
        let email = "";
        for (let offset = 0; offset <= 4; offset++) {
          const targetIdx = nameLineIdx + offset;
          if (targetIdx >= lines.length) break;
          const targetLine = lines[targetIdx];
          
          if (!phone) {
            const extractedPhone = extractPhoneNumber(targetLine);
            if (extractedPhone) {
              phone = extractedPhone;
            }
          }
          if (!email) {
            const m2 = targetLine.match(/([a-zA-Z0-9\._-]+@[a-zA-Z0-9\._-]+)/);
            if (m2) {
              email = m2[1];
            }
          }
        }

        keyContacts.push({
          role: "Site Contact / Engineer",
          name: cleanedName,
          email: email || "see-catalog@mstc.co.in",
          phone: phone || "no contact info available"
        });
      }
    }
  }

  // 2. Extract MSTC Officers
  const officerOneMatch = text.match(/Officer OneName:\s*([^\n]+)/i) || text.match(/Officer OneName\s*([^\n]+)/i);
  if (officerOneMatch) {
    let offName = cleanName(officerOneMatch[1]);
    let offEmail = "";
    let offPhone = "";
    
    const idx = lines.findIndex(l => l.includes("Officer OneName"));
    if (idx !== -1) {
      for (let i = idx + 1; i < Math.min(idx + 5, lines.length); i++) {
        const line = lines[i];
        if (line.includes("Officer TwoName")) break;
        const emailM = line.match(/Email\s*:?\s*([^\s\n]+)/i);
        if (emailM) offEmail = emailM[1].trim();
        const extractedPhone = extractPhoneNumber(line);
        if (extractedPhone) offPhone = extractedPhone;
      }
    }
    
    if (offName && isValidContactName(offName) && !processedNames.has(offName.toLowerCase())) {
      processedNames.add(offName.toLowerCase());
      keyContacts.unshift({
        role: "Auction Officer (MSTC)",
        name: offName,
        email: offEmail || "info@mstcindia.co.in",
        phone: offPhone || "no contact info available"
      });
    }
  }

  const officerTwoMatch = text.match(/Officer TwoName:\s*([^\n]+)/i) || text.match(/Officer TwoName\s*([^\n]+)/i);
  if (officerTwoMatch) {
    let offName = cleanName(officerTwoMatch[1]);
    let offEmail = "";
    let offPhone = "";
    
    const idx = lines.findIndex(l => l.includes("Officer TwoName"));
    if (idx !== -1) {
      for (let i = idx + 1; i < Math.min(idx + 5, lines.length); i++) {
        const line = lines[i];
        const emailM = line.match(/Email\s*:?\s*([^\s\n]+)/i);
        if (emailM) offEmail = emailM[1].trim();
        const extractedPhone = extractPhoneNumber(line);
        if (extractedPhone) offPhone = extractedPhone;
      }
    }
    
    if (offName && isValidContactName(offName) && !processedNames.has(offName.toLowerCase())) {
      processedNames.add(offName.toLowerCase());
      const insertIdx = keyContacts.findIndex(c => c.role.includes("Site Contact"));
      if (insertIdx !== -1) {
        keyContacts.splice(insertIdx, 0, {
          role: "Auction Officer (MSTC)",
          name: offName,
          email: offEmail || "info@mstcindia.co.in",
          phone: offPhone || "no contact info available"
        });
      } else {
        keyContacts.push({
          role: "Auction Officer (MSTC)",
          name: offName,
          email: offEmail || "info@mstcindia.co.in",
          phone: offPhone || "no contact info available"
        });
      }
    }
  }

  // 3. Fallback/Generate inspection details
  const mainContact = keyContacts.find(c => c.role.toLowerCase().includes('site') || c.role.toLowerCase().includes('engineer')) || keyContacts[0];
  const inspectionDetails = {
    time: 'From publication date to 1 day prior to bidding (10:00 AM - 4:00 PM on working days)',
    contact: mainContact ? `${mainContact.name} (${mainContact.phone || 'phone listed in catalog'})` : 'Site In-Charge'
  };

  return { keyContacts, inspectionDetails };
}

async function backfillContacts() {
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, sanitized_document_path, raw_materials_text')
    .not('sanitized_document_path', 'is', null);

  if (error) {
    console.error('Failed to fetch records:', error.message);
    return;
  }

  console.log(`Starting contact backfill for ${records.length} records...`);

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    console.log(`[${i + 1}/${records.length}] Processing ${r.mstc_auction_number}`);

    try {
      const res = await fetch(r.sanitized_document_path!);
      if (!res.ok) {
        console.warn(`  Failed to download PDF: ${res.status}`);
        continue;
      }
      const buffer = await res.buffer();
      if (buffer.toString('utf-8', 0, 4) !== '%PDF') {
        console.warn('  Invalid PDF buffer');
        continue;
      }

      const parsedPdf = await pdf(buffer);
      const { keyContacts, inspectionDetails } = parseContacts(parsedPdf.text || '');

      let rawObj: any = {};
      if (r.raw_materials_text) {
        try {
          rawObj = JSON.parse(r.raw_materials_text);
        } catch {
          rawObj = {};
        }
      }

      // Update only keyContacts and inspectionDetails to preserve items, etc.
      rawObj.keyContacts = keyContacts;
      rawObj.inspectionDetails = inspectionDetails;

      const { error: updateError } = await supabase
        .from('mstc_auctions')
        .update({ raw_materials_text: JSON.stringify(rawObj) })
        .eq('id', r.id);

      if (updateError) {
        console.error(`  Failed to update record: ${updateError.message}`);
      } else {
        console.log(`  Updated successfully with ${keyContacts.length} contacts.`);
      }
    } catch (err: any) {
      console.error(`  Error processing:`, err.message);
    }
  }

  console.log('Contacts backfill completed successfully!');
}

backfillContacts();

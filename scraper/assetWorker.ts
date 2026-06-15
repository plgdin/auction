import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import * as dotenv from "dotenv";
import * as fs from "fs";
import puppeteer from "puppeteer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const FAILSAFE_RETRIES_CEILING = 3;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "CRITICAL EXCEPTION: Background worker is missing database environment keys.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function parseMstcCatalogText(
  text: string,
  categoryName: string,
  sellerName: string,
  location: string,
): any {
  const cleanName = (name: string): string => {
    if (!name) return "";
    return name
      .replace(/\[[^\]]*\]/g, "")
      .replace(/\([^\)]*\)/g, "")
      .replace(/[\{\}]/g, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/[;:\-\s\+]+$/, "")
      .trim();
  };

  const isValidContactName = (name: string): boolean => {
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
  };

  const lines = text.split("\n").map((l) => l.trim());
  const keyContacts: any[] = [];
  const processedNames = new Set<string>();

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
            const m1 = targetLine.match(/(?:mobile|phone|telephone|tele|no|num|contact)[\s:.-]*(\d{10,12})/i) ||
                       targetLine.match(/(\d{10})/);
            if (m1) {
              phone = m1[1];
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
        const phoneM = line.match(/Phone\s*:?\s*(\d+)/i) || line.match(/Mobile\s*:?\s*(\d+)/i);
        if (phoneM) offPhone = phoneM[1].trim();
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
        const phoneM = line.match(/Phone\s*:?\s*(\d+)/i) || line.match(/Mobile\s*:?\s*(\d+)/i);
        if (phoneM) offPhone = phoneM[1].trim();
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

  // 3. Extract EMD Details
  let emdValue = "10% of total bid value";
  let preBidDdg = "Not required for registered MSME bidders";

  // Try to find Post-Bid EMD percentage (e.g. "Post Bid EMD % - 25.0")
  const emdPercentMatch =
    cleanText.match(/Post\s*Bid\s*EMD\s*%\s*-\s*\n*([\d\.]+)/i) ||
    cleanText.match(/Post\s*Bid\s*EMD\s*%\s*-\s*([\d\.]+)/i);
  if (emdPercentMatch) {
    emdValue = `${emdPercentMatch[1]}% of total bid value (Post-Bid EMD)`;
  } else {
    // If no percentage is specified, look for general/Pre-Bid EMD
    const preBidMatch = cleanText.match(/Pre-Bid EMD:\s*([^\n]+)/);
    if (preBidMatch) {
      const matchVal = preBidMatch[1].trim();
      if (
        !matchVal.toLowerCase().includes("not a auto") &&
        !matchVal.toLowerCase().includes("item wise")
      ) {
        const numOnly = matchVal.replace(/[^\d]/g, "");
        if (numOnly && parseInt(numOnly, 10) > 100) {
          preBidDdg = `₹${parseInt(numOnly, 10).toLocaleString("en-IN")}`;
          emdValue = "10% of total bid value";
        } else {
          emdValue = matchVal;
        }
      }
    }
  }

  // Extract explicit Pre-Bid EMD Amount (which could be in the lot details or elsewhere)
  const explicitPreBidMatch = cleanText.match(
    /(?:Pre-Bid\s*(?:EMD\s*)?Amount|Pre-Bid\s*Amount)[\s\S]{0,50}?(?:Rs\.?|₹)?\s*([\d,]{4,10})/i,
  );
  if (explicitPreBidMatch) {
    const val = explicitPreBidMatch[1].replace(/,/g, "");
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 100) {
      preBidDdg = `₹${num.toLocaleString("en-IN")}`;
    }
  }

  // 4. Extract Lots (Identified Inventory)
  const items: any[] = [];
  const lotBlocks = cleanText.split(/Lot No\s*-\s*/);

  if (lotBlocks.length > 1) {
    for (let i = 1; i < lotBlocks.length; i++) {
      const block = lotBlocks[i];
      const linesBlock = block.split("\n");

      const lotNo = parseInt(linesBlock[0].trim());
      if (isNaN(lotNo)) continue;

      let lotName = "";
      const nameMatch = block.match(
        /Lot Name\s*-\s*([\s\S]*?)(?=Product Type)/i,
      );
      if (nameMatch) {
        lotName = nameMatch[1].replace(/\r?\n/g, " ").trim();
      }

      let qty = "1";
      let unit = "Lot";
      const qtyMatch = block.match(/Quantity\s*-\s*([\d\.,]+)\s*([A-Za-z]+)?/i);
      if (qtyMatch) {
        qty = qtyMatch[1].trim();
        unit = (qtyMatch[2] || "Lot").trim();
      }

      let gst = "As Applicable";
      const gstMatch = block.match(
        /GST\s*\(%\)\s*-\s*([\s\S]*?)(?=Lot Location|State|Lot State|TCS|Bid Valid|$)/i,
      );
      if (gstMatch) {
        gst = gstMatch[1].replace(/\r?\n/g, " ").trim();
      }

      let tcs = "0.0";
      const tcsMatch = block.match(
        /TCS\s*\(%\)\s*-\s*([\s\S]*?)(?=GST|Lot Location|State|Lot State|Bid Valid|$)/i,
      );
      if (tcsMatch) {
        tcs = tcsMatch[1].replace(/\r?\n/g, " ").trim();
      }

      let taxRate = `${gst} GST${tcs && tcs !== "0.0" && tcs !== "0" ? " + " + tcs + "% TCS" : ""}`;

      // Search for sub-items within the lot description
      const subItems: any[] = [];
      const blockLines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      for (let j = 0; j < blockLines.length; j++) {
        const line = blockLines[j];
        if (line.toLowerCase().startsWith('quantity -')) continue;

        let subQty = '';
        let subUnit = '';
        
        const directMatch = line.match(/(?:QTY|Quantity)\s*[:\-]\s*([\d,.]+)\s*([A-Za-z]+)?/i);
        if (directMatch) {
          subQty = directMatch[1];
          subUnit = directMatch[2] || '';
        } else if (/^(?:QTY|Quantity)\s*[:\-]?$/i.test(line) && j + 1 < blockLines.length) {
          const nextLine = blockLines[j + 1];
          const nextMatch = nextLine.match(/^([\d,.]+)\s*([A-Za-z]+)?/i);
          if (nextMatch) {
            subQty = nextMatch[1];
            subUnit = nextMatch[2] || '';
          }
        }

        if (subQty) {
          // Find description by looking upwards
          let desc = '';
          for (let k = j - 1; k >= 0; k--) {
            const prevLine = blockLines[k];
            if (
              prevLine.includes('Lot No -') ||
              prevLine.includes('Lot Name -') ||
              prevLine.includes('Product Type -') ||
              prevLine.includes('Category -') ||
              prevLine.toLowerCase().startsWith('qty') ||
              prevLine.toLowerCase().includes('(approx') ||
              prevLine === '(approx.)'
            ) {
              break;
            }
            
            const cleanPrev = prevLine.trim();
            if (desc === '') {
              desc = cleanPrev;
            } else {
              desc = cleanPrev + ' ' + desc;
            }
            
            // If it seems to be the main starting line of the item, we can stop
            if (
              cleanPrev.toLowerCase().includes('poly bag') ||
              cleanPrev.toLowerCase().includes('rags') ||
              cleanPrev.toLowerCase().includes('cfc') ||
              cleanPrev.toLowerCase().includes('tin') ||
              cleanPrev.toLowerCase().includes('brl') ||
              cleanPrev.toLowerCase().includes('jerrican') ||
              cleanPrev.toLowerCase().includes('grease drum') ||
              cleanPrev.toLowerCase().includes('iron scrap') ||
              cleanPrev.toLowerCase().includes('bag 1 md') ||
              cleanPrev.length > 15
            ) {
              break;
            }
          }
          
          if (desc) {
            subItems.push({
              sr: lotNo,
              description: desc.trim(),
              qty: subQty.replace(/,/g, ''),
              unit: subUnit.trim() || 'Nos',
              taxRate
            });
          }
        }
      }

      if (subItems.length > 0) {
        items.push(...subItems);
      } else {
        items.push({
          sr: lotNo,
          description: lotName || categoryName || "Auction Lot Items",
          qty,
          unit,
          taxRate,
        });
      }
    }
  }

  // Fallback if no lots parsed
  if (items.length === 0) {
    items.push({
      sr: 1,
      description: categoryName || "Auction Lot Items",
      qty: "1",
      unit: "Lot",
      taxRate: "18% GST",
    });
  }

  // 5. Build Overview & Scope
  const itemNames = items.map((it) => it.description.toLowerCase()).join(", ");
  const overview = `This auction is conducted by MSTC on behalf of ${sellerName} for the disposal of ${itemNames} located at ${location || "designated site areas"}.`;
  const scopeOfWork = `Lifting, clearing, and disposal of designated lots of ${itemNames} in accordance with MSTC Special Terms & Conditions (STC). All items are sold on an "As-Is-Where-Is" basis.`;

  // 6. Eligibility
  const eligibility = [
    "Valid MSTC Buyer Registration in active status.",
    "GSTIN Registration Certificate matching the buyer profile.",
  ];

  const textLower = text.toLowerCase();
  if (
    textLower.includes("hazardous") ||
    textLower.includes("waste") ||
    textLower.includes("battery") ||
    textLower.includes("oil")
  ) {
    eligibility.push(
      "Hazardous waste/smelter authorization from State Pollution Control Board (SPCB) is mandatory.",
    );
  }
  if (
    textLower.includes("telecom") ||
    textLower.includes("cable") ||
    textLower.includes("e-waste")
  ) {
    eligibility.push(
      "CPCB/SPCB E-Waste recycler registration required for e-waste lots.",
    );
  }

  // 7. Extract Inspection details
  let inspectionTime = "From publication date to 1 day prior to bidding (10:00 AM - 4:00 PM on working days)";
  let inspectionContact = "Site In-Charge / Contact Person listed in catalog";

  const insTimeMatch = cleanText.match(/(?:Inspection\s*(?:Date\s*&?\s*Time|Period|From|Allowed)?\s*[:\-]|Inspection\s*Date\s*[:\-]?)\s*([^\n]+)/i);
  if (insTimeMatch) {
    const val = insTimeMatch[1].trim();
    if (val && val.length > 5 && val.length < 250) {
      inspectionTime = val.replace(/[\[\{\(]\s*[-_.\s]*\s*[\]\}\)]/g, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    }
  }

  const insContMatch = cleanText.match(/(?:Contact\s*Person\s*for\s*Inspection|Inspection\s*Contact|Contact\s*Person\s*)\s*[:\-]?\s*([^\n]+)/i);
  if (insContMatch) {
    const val = insContMatch[1].trim();
    if (val && val.length > 3 && val.length < 150) {
      inspectionContact = val.replace(/[\[\{\(]\s*[-_.\s]*\s*[\]\}\)]/g, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    }
  } else if (contactName) {
    inspectionContact = `${contactName} (${contactPhone || "phone listed in catalog"})`;
  }

  return {
    overview,
    scopeOfWork,
    items,
    eligibility,
    depositDetails: {
      emd: emdValue,
      preBidDdg,
      adminCharges: "₹11,800 (incl. GST) non-refundable service provider fees",
    },
    keyContacts,
    inspectionDetails: {
      time: inspectionTime,
      contact: inspectionContact
    }
  };
}

async function renderPdfFirstPage(fileBuffer: Buffer): Promise<Buffer | null> {
  let browser = null;
  try {
    const pdfBase64 = fileBuffer.toString("base64");
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600 });

    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <script>
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        </script>
      </head>
      <body>
        <canvas id="pdf-canvas"></canvas>
      </body>
      </html>
    `);

    const dataUrl = await page.evaluate(async (base64Data) => {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const loadingTask = (window as any).pdfjsLib.getDocument({ data: bytes });
      const pdfDoc = await loadingTask.promise;
      const pdfPage = await pdfDoc.getPage(1);
      const viewport = pdfPage.getViewport({ scale: 1.5 });
      const canvas = document.getElementById("pdf-canvas") as HTMLCanvasElement;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const canvasContext = canvas.getContext("2d");
      if (!canvasContext) throw new Error("Failed to get 2d context");
      await pdfPage.render({ canvasContext, viewport }).promise;
      return canvas.toDataURL("image/jpeg", 0.85);
    }, pdfBase64);

    const base64Image = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
    return Buffer.from(base64Image, "base64");
  } catch (err: any) {
    console.error(
      "[PDF Preview Render Error] Failed to render PDF page to image:",
      err.message,
    );
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function extractEmbeddedJpegs(pdfBuffer: Buffer): Buffer[] {
  const jpegs: Buffer[] = [];
  let pos = 0;
  const maxImages = 5;

  while (pos < pdfBuffer.length && jpegs.length < maxImages) {
    const streamIdx = pdfBuffer.indexOf("stream", pos);
    if (streamIdx === -1) break;

    const dictStart = pdfBuffer.lastIndexOf("<<", streamIdx);
    if (dictStart !== -1) {
      const dictBuffer = pdfBuffer.slice(dictStart, streamIdx);
      const dictStr = dictBuffer.toString("ascii");

      if (
        dictStr.includes("/Subtype /Image") &&
        dictStr.includes("/Filter /DCTDecode")
      ) {
        const endstreamIdx = pdfBuffer.indexOf("endstream", streamIdx);
        if (endstreamIdx !== -1) {
          let start = streamIdx + 6;
          while (
            start < endstreamIdx &&
            (pdfBuffer[start] === 10 || pdfBuffer[start] === 13)
          ) {
            start++;
          }
          let end = endstreamIdx;
          while (
            end > start &&
            (pdfBuffer[end - 1] === 10 || pdfBuffer[end - 1] === 13)
          ) {
            end--;
          }

          const streamData = pdfBuffer.slice(start, end);
          if (streamData.length > 5000) {
            jpegs.push(streamData);
          }
        }
      }
    }
    pos = streamIdx + 6;
  }

  return jpegs;
}

async function downloadAttachment(
  fileName: string,
  docType: string,
  headers: Record<string, string>,
): Promise<Buffer | null> {
  const fileUrl = `https://www.mstcecommerce.com/auctionhome/mstc/admin/upload/downAttachedFiles.jsp?FILE_ID=${fileName}&doc_type=${docType}`;
  console.log(
    `[Lot Attachments] Downloading ${fileName} (doc_type: ${docType}) from: ${fileUrl}`,
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(fileUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(
        `[Lot Attachments] Failed to download ${fileName} with type ${docType}: status ${response.status}`,
      );
      return null;
    }

    const docBuffer = await response.buffer();
    if (docBuffer.toString("utf-8", 0, 4) === "%PDF") {
      return docBuffer;
    }
  } catch (e: any) {
    console.warn(
      `[Lot Attachments] Network error downloading ${fileName} with type ${docType}:`,
      e.message,
    );
  } finally {
    clearTimeout(timeoutId);
  }
  return null;
}

function parseAnnexItems(text: string, taxRate: string): any[] {
  const items: any[] = [];
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  
  // Try to find matching pattern: Sr/Sl/No + description + qty + unit
  // e.g. "1 Poly Bag 50 Kg 4643 Nos" or "1. LT PANEL 1 LOT"
  const itemPattern = /^(\d+)\.?\s+([A-Za-z0-9_\-\s,\(\)\/\.]{3,70})\s+([\d,.]+)\s*([A-Za-z]{2,10})/i;
  
  let currentSr = 1;
  for (const line of lines) {
    if (
      line.toLowerCase().includes("page") ||
      line.toLowerCase().includes("tender") ||
      line.toLowerCase().includes("mstc") ||
      line.toLowerCase().includes("quantity") ||
      line.toLowerCase().includes("description")
    ) {
      continue;
    }
    
    const match = line.match(itemPattern);
    if (match) {
      const parsedSr = parseInt(match[1], 10);
      const desc = match[2].trim();
      const qtyStr = match[3].replace(/,/g, '');
      const unit = match[4].trim();
      
      const qtyVal = parseFloat(qtyStr);
      if (!isNaN(qtyVal) && qtyVal > 0 && desc.length > 2) {
        items.push({
          sr: parsedSr || currentSr,
          description: desc,
          qty: qtyStr,
          unit: unit || 'Nos',
          taxRate
        });
        currentSr++;
      }
    } else {
      const qtyMatch = line.match(/([A-Za-z0-9_\-\s,\(\)\/\.]{3,50})\s+(?:Qty|Quantity|Nos)\s*[:\-]?\s*([\d,.]+)\s*([A-Za-z]{2,10})?/i);
      if (qtyMatch) {
        const desc = qtyMatch[1].trim();
        const qtyStr = qtyMatch[2].replace(/,/g, '');
        const unit = qtyMatch[3] || 'Nos';
        const qtyVal = parseFloat(qtyStr);
        if (!isNaN(qtyVal) && qtyVal > 0 && desc.length > 2) {
          items.push({
            sr: currentSr,
            description: desc,
            qty: qtyStr,
            unit: unit.trim(),
            taxRate
          });
          currentSr++;
        }
      }
    }
  }
  return items;
}

async function extractAndProcessLotDocuments(
  catalogText: string,
  sanitizedAuctionNum: string,
  headers: Record<string, string>,
): Promise<{ imageUrls: string[]; extractedItems: any[] }> {
  // Reconstruct filename if there are newlines or spaces
  const cleanedText = catalogText
    .replace(/\r?\n/g, " ")
    .replace(
      /(Annex_|Photo_)\s*([a-zA-Z0-9_]+)\s*([a-zA-Z0-9_]*)\s*(\.pdf)/gi,
      (_match, p1, p2, p3, p4) => {
        return `${p1}${p2}${p3 || ""}${p4}`;
      },
    );

  const matches = cleanedText.match(/([a-zA-Z0-9_]+\.pdf)/g) || [];
  const uniqueAttachments = Array.from(new Set(matches)).filter((name) => {
    const n = name.toLowerCase();
    return n.startsWith("photo_") || n.startsWith("annex_");
  });

  if (uniqueAttachments.length === 0) {
    return { imageUrls: [], extractedItems: [] };
  }

  console.log(
    `[Lot Attachments] Found ${uniqueAttachments.length} attachments: ${uniqueAttachments.join(", ")}`,
  );
  const imageUrls: string[] = [];
  const extractedItems: any[] = [];

  for (let i = 0; i < uniqueAttachments.length; i++) {
    const fileName = uniqueAttachments[i];

    // Determine initial doc_type
    const primaryType = fileName.toLowerCase().startsWith("photo_")
      ? "attached_photo"
      : "attached_annex";
    const fallbackType =
      primaryType === "attached_photo" ? "attached_annex" : "attached_photo";

    let docBuffer = await downloadAttachment(fileName, primaryType, headers);
    if (!docBuffer) {
      console.log(
        `[Lot Attachments] Trying fallback doc_type: ${fallbackType}`,
      );
      docBuffer = await downloadAttachment(fileName, fallbackType, headers);
    }

    if (!docBuffer) {
      console.warn(
        `[Lot Attachments Warning] Could not retrieve valid PDF for attachment ${fileName}`,
      );
      continue;
    }

    console.log(
      `[Lot Attachments] Successfully retrieved attachment ${fileName} (${docBuffer.length} bytes). Processing...`,
    );

    // Try to parse text from the PDF attachment
    try {
      const parsedDoc = await pdf(docBuffer);
      if (parsedDoc && parsedDoc.text) {
        console.log(`[Lot Attachments] Extracted text from ${fileName} (${parsedDoc.text.length} chars). Parsing items...`);
        let parsedItems: any[] = [];
        if (parsedDoc.text.includes("Lot No -")) {
          const tempSummary = parseMstcCatalogText(parsedDoc.text, "", "", "");
          if (tempSummary && tempSummary.items && tempSummary.items.length > 0) {
            parsedItems = tempSummary.items;
          }
        } else {
          parsedItems = parseAnnexItems(parsedDoc.text, "As Applicable GST");
        }
        if (parsedItems.length > 0) {
          console.log(`[Lot Attachments] Found ${parsedItems.length} items in ${fileName}.`);
          extractedItems.push(...parsedItems);
        }
      }
    } catch (parseErr: any) {
      console.warn(`[Lot Attachments Text Parse Warning] Failed to parse PDF text for ${fileName}:`, parseErr.message);
    }

    // 1. Try to extract embedded JPEGs first (high-res original)
    const embeddedJpegs = extractEmbeddedJpegs(docBuffer);
    if (embeddedJpegs.length > 0) {
      console.log(
        `[Lot Attachments] Extracted ${embeddedJpegs.length} embedded images from ${fileName}. Uploading...`,
      );
      for (let j = 0; j < embeddedJpegs.length; j++) {
        const imgBuffer = embeddedJpegs[j];
        const imgPath = `mstc-extracted-images/${sanitizedAuctionNum}_lot_doc_${i}_img_${j}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("auction_documents")
          .upload(imgPath, imgBuffer, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicMeta } = supabase.storage
            .from("auction_documents")
            .getPublicUrl(imgPath);
          imageUrls.push(publicMeta.publicUrl);
        } else {
          console.warn(
            `[Lot Attachments Warning] Failed to upload extracted image: ${uploadError.message}`,
          );
        }
      }
    } else {
      // 2. If no embedded JPEGs, render the first page of the PDF to image
      console.log(
        `[Lot Attachments] No embedded JPEGs found in ${fileName}. Rendering page to image...`,
      );
      const renderBuffer = await renderPdfFirstPage(docBuffer);
      if (renderBuffer) {
        const imgPath = `mstc-extracted-images/${sanitizedAuctionNum}_lot_doc_${i}_page.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("auction_documents")
          .upload(imgPath, renderBuffer, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicMeta } = supabase.storage
            .from("auction_documents")
            .getPublicUrl(imgPath);
          imageUrls.push(publicMeta.publicUrl);
        } else {
          console.warn(
            `[Lot Attachments Warning] Failed to upload rendered image: ${uploadError.message}`,
          );
        }
      }
    }
  }

  return { imageUrls, extractedItems };
}

async function runAssetPipelineQueue() {
  const { data: executableQueue, error: queryError } = await supabase
    .from("mstc_auctions")
    .select(
      "id, mstc_auction_number, source_pdf_url, retry_count, category_name, seller_name, location, raw_materials_text",
    )
    .or("asset_status.eq.pending,asset_status.eq.failed")
    .lt("retry_count", FAILSAFE_RETRIES_CEILING)
    .limit(10); // Throttle downloads to avoid triggering IP blocking

  if (queryError) {
    console.error("Queue state querying engine failed:", queryError.message);
    return;
  }

  if (!executableQueue || executableQueue.length === 0) {
    return;
  }

  console.log(
    `Processing queue batch: Found ${executableQueue.length} pending catalogs.`,
  );

  for (const record of executableQueue) {
    // Row-Lock: Set state to processing immediately so concurrent instances don't pull the same task
    await supabase
      .from("mstc_auctions")
      .update({ asset_status: "processing" })
      .eq("id", record.id);

    try {
      console.log(
        `Downloading document for index key: ${record.mstc_auction_number}`,
      );

      const url = new URL(record.source_pdf_url);
      const aucId = url.searchParams.get("auc") || "";

      const formData = new URLSearchParams();
      formData.append("auc", aucId);
      formData.append("cat", "0");
      formData.append("sell", "0");

      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
      };

      try {
        if (fs.existsSync("cookies.txt")) {
          const cookieString = fs.readFileSync("cookies.txt", "utf-8");
          if (cookieString.trim()) {
            headers["Cookie"] = cookieString.trim();
          }
        }
      } catch (cookieErr: any) {
        console.warn("Warning reading cookies.txt:", cookieErr.message);
      }

      const payloadResponse = await fetch(
        "https://www.mstcecommerce.com/auctionhome/mstc/auction_detailed_report_pdf.jsp",
        {
          method: "POST",
          body: formData,
          headers,
          timeout: 45000,
        } as any,
      );

      if (!payloadResponse.ok) {
        throw new Error(
          `External file target thrown bad response: status ${payloadResponse.status}`,
        );
      }

      // Node-fetch body payload casting to buffer
      const fileBuffer = await payloadResponse.buffer();

      // Corrupt payload guard: ensure the file data is an actual valid PDF structure
      if (fileBuffer.toString("utf-8", 0, 4) !== "%PDF") {
        const preview = fileBuffer.toString("utf-8", 0, 200);
        if (
          preview.includes("session") ||
          preview.includes("timeout") ||
          preview.includes("login")
        ) {
          throw new Error(
            "Verification failed: session is expired or invalid. Please run the scraper again to renew cookies.",
          );
        }
        throw new Error(
          "Asset payload content failed structural binary layout verification.",
        );
      }

      const sanitizedAuctionNum = record.mstc_auction_number.replace(
        /[\/\\:*?"<>|]/g,
        "_",
      );
      const cloudStorageLocation = `mstc-catalogs/${sanitizedAuctionNum}.pdf`;

      // Upload payload buffer. Upsert: true replaces files in place, avoiding storage bloat.
      const { error: storageWriteError } = await supabase.storage
        .from("auction_documents")
        .upload(cloudStorageLocation, fileBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (storageWriteError) throw storageWriteError;

      const { data: structuralPublicMeta } = supabase.storage
        .from("auction_documents")
        .getPublicUrl(cloudStorageLocation);

      // 1. Render First Page Preview
      console.log(
        `Rendering PDF first page preview for: ${record.mstc_auction_number}`,
      );
      let previewImageUrl: string | null = null;
      const previewBuffer = await renderPdfFirstPage(fileBuffer);
      if (previewBuffer) {
        const previewStoragePath = `mstc-previews/${sanitizedAuctionNum}.jpg`;
        const { error: previewUploadError } = await supabase.storage
          .from("auction_documents")
          .upload(previewStoragePath, previewBuffer, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (!previewUploadError) {
          const { data: previewPublicMeta } = supabase.storage
            .from("auction_documents")
            .getPublicUrl(previewStoragePath);
          previewImageUrl = previewPublicMeta.publicUrl;
          console.log(`Uploaded first page preview: ${previewImageUrl}`);
        } else {
          console.warn(
            `[PDF Preview Warning] Failed to upload preview to storage:`,
            previewUploadError.message,
          );
        }
      }

      // 2. Extract Embedded Images
      console.log(
        `Checking for embedded images in: ${record.mstc_auction_number}`,
      );
      const embeddedImages = extractEmbeddedJpegs(fileBuffer);
      const extractedImageUrls: string[] = [];
      if (embeddedImages.length > 0) {
        console.log(
          `Found ${embeddedImages.length} embedded images. Uploading...`,
        );
        for (let i = 0; i < embeddedImages.length; i++) {
          const imgBuffer = embeddedImages[i];
          const imgPath = `mstc-extracted-images/${sanitizedAuctionNum}_img_${i}.jpg`;
          const { error: imgUploadError } = await supabase.storage
            .from("auction_documents")
            .upload(imgPath, imgBuffer, {
              contentType: "image/jpeg",
              upsert: true,
            });

          if (!imgUploadError) {
            const { data: imgPublicMeta } = supabase.storage
              .from("auction_documents")
              .getPublicUrl(imgPath);
            extractedImageUrls.push(imgPublicMeta.publicUrl);
          } else {
            console.warn(
              `[PDF Extraction Warning] Failed to upload extracted image ${i} to storage:`,
              imgUploadError.message,
            );
          }
        }
      }

      // 3. Extract PDF content and generate structured catalog summary
      let raw_materials_text = record.raw_materials_text;
      try {
        console.log(`Parsing PDF text for: ${record.mstc_auction_number}`);
        const parsedPdf = await pdf(fileBuffer);
        if (parsedPdf && parsedPdf.text) {
          let annexItems: any[] = [];
          // Extract attachments images and text from the parsed PDF text
          try {
            const { imageUrls, extractedItems } = await extractAndProcessLotDocuments(
              parsedPdf.text,
              sanitizedAuctionNum,
              headers,
            );
            if (imageUrls.length > 0) {
              extractedImageUrls.push(...imageUrls);
              console.log(
                `[Lot Attachments] Successfully extracted and added ${imageUrls.length} image URLs to results.`,
              );
            }
            if (extractedItems.length > 0) {
              annexItems = extractedItems;
              console.log(
                `[Lot Attachments] Successfully extracted ${extractedItems.length} items from attachments.`,
              );
            }
          } catch (attErr: any) {
            console.warn(
              `[Lot Attachments Processing Error] Failed to process attachments:`,
              attErr.message,
            );
          }

          const summaryObj = parseMstcCatalogText(
            parsedPdf.text,
            record.category_name || "",
            record.seller_name || "",
            record.location || "",
          );

          if (annexItems.length > 0) {
            // If main catalog items are generic (like '1 LOT'), replace with details
            const mainItemsAreGeneric = summaryObj.items.every((it: any) => 
              it.qty === '1' && it.unit.toLowerCase() === 'lot'
            );
            if (mainItemsAreGeneric) {
              console.log(`[Lot Attachments] Replacing generic main catalog items with detailed annex items.`);
              summaryObj.items = annexItems;
            } else {
              console.log(`[Lot Attachments] Appending detailed annex items to main catalog items.`);
              summaryObj.items = [...summaryObj.items, ...annexItems];
            }
          }

          // Inject preview image and extracted images into the summary object
          summaryObj.preview_image_url = previewImageUrl;
          summaryObj.extracted_images = extractedImageUrls;

          raw_materials_text = JSON.stringify(summaryObj);
          console.log(
            `Successfully parsed PDF. Extracted summary length: ${raw_materials_text.length}`,
          );
        }
      } catch (parseErr: any) {
        console.warn(
          `[PDF Parse Warning] Failed to parse PDF text for ${record.mstc_auction_number}:`,
          parseErr.message,
        );
      }

      // Successfully processed: update row data with our secure public path link
      await supabase
        .from("mstc_auctions")
        .update({
          asset_status: "completed",
          sanitized_document_path: structuralPublicMeta.publicUrl,
          raw_materials_text,
          error_log: null,
        })
        .eq("id", record.id);

      // Log download event to audit logs
      await supabase.from("audit_logs").insert({
        action: "mstc_auction_downloaded",
        entity_type: "mstc_auction",
        entity_id: record.id,
        details: {
          mstc_auction_number: record.mstc_auction_number,
          sanitized_document_path: structuralPublicMeta.publicUrl,
        },
      });

      console.log(
        `Document processing successfully finalized for: ${record.mstc_auction_number}`,
      );
    } catch (jobExecutionFault: any) {
      const scaledRetryTracker = record.retry_count + 1;
      const reachedMaxLimit = scaledRetryTracker >= FAILSAFE_RETRIES_CEILING;

      console.error(
        `Asset Sync processing error caught on item ${record.mstc_auction_number}:`,
        jobExecutionFault.message,
      );

      await supabase
        .from("mstc_auctions")
        .update({
          asset_status: reachedMaxLimit ? "failed" : "pending",
          retry_count: scaledRetryTracker,
          error_log: `[Error State Cycle ${scaledRetryTracker}] ${jobExecutionFault.message}`,
        })
        .eq("id", record.id);

      // Log failure event to audit logs
      await supabase.from("audit_logs").insert({
        action: "mstc_auction_failed",
        entity_type: "mstc_auction",
        entity_id: record.id,
        details: {
          mstc_auction_number: record.mstc_auction_number,
          retry_count: scaledRetryTracker,
          reached_max_limit: reachedMaxLimit,
          error: jobExecutionFault.message,
        },
      });
    }
  }
}

async function startWorker() {
  console.log(
    "Background Worker Service Started. Scanning for pending uploads every 15 seconds...",
  );
  while (true) {
    try {
      await runAssetPipelineQueue();
    } catch (err: any) {
      console.error("Worker loop iteration failed:", err.message);
    }
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }
}

startWorker();

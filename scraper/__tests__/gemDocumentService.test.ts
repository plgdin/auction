import { describe, it, expect } from "vitest";
import {
  isValidPdfBuffer,
  isValidImageBuffer,
} from "../utils/gem/gemDocumentService.js";
import { parseGemBusinessRulesHtml } from "../parsers/gem/gemBusinessRulesParser.js";
import { parseGemDocumentPageHtml } from "../parsers/gem/gemDocumentPageParser.js";

describe("GeM Real Document & Parser Suite", () => {
  describe("Binary Buffer Validation", () => {
    it("validates authentic PDF buffer starting with %PDF- header", () => {
      const validPdf = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Title (Notice) >>\nendobj\ntrailer\n%%EOF");
      expect(isValidPdfBuffer(validPdf)).toBe(true);
    });

    it("rejects HTML or session-expired responses masquerading as PDF", () => {
      const htmlResponse = Buffer.from("<!DOCTYPE html><html><body>Session Expired</body></html>");
      expect(isValidPdfBuffer(htmlResponse)).toBe(false);

      const tinyBuffer = Buffer.from("%PDF");
      expect(isValidPdfBuffer(tinyBuffer)).toBe(false);
    });

    it("validates authentic JPEG and PNG preview images", () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(isValidImageBuffer(jpegBuffer)).toBe(true);

      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
      expect(isValidImageBuffer(pngBuffer)).toBe(true);

      const invalidBuffer = Buffer.from("not-an-image");
      expect(isValidImageBuffer(invalidBuffer)).toBe(false);
    });
  });

  describe("parseGemBusinessRulesHtml", () => {
    it("extracts opening price, bid increment, office zone, and auto extension", () => {
      const sampleHtml = `
        <div class="card">
          <table>
            <tr><td>Auction ID :</td><td>40415</td></tr>
            <tr><td>Office / Zone :</td><td>MINISTRY OF DEFENCE</td></tr>
            <tr><td>Seller / Auctioneer Name :</td><td>COMMANDING OFFICER 66 BN BSF</td></tr>
            <tr><td>Reference No :</td><td>66BN/DISP/2026/01</td></tr>
            <tr><td>Auto Extension :</td><td>Unlimited Auto Extension</td></tr>
          </table>
          <table>
            <thead>
              <tr><th>S.No</th><th>Item Name</th><th>Opening Price</th><th>Increment Price</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>HEAVY CONDEMNED VEHICLES</td>
                <td>1,50,000</td>
                <td>5,000</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;

      const result = parseGemBusinessRulesHtml(sampleHtml);
      expect(result.opening_price_value).toBe(150000);
      expect(result.bid_increment_amount).toBe(5000);
      expect(result.office_zone).toBe("MINISTRY OF DEFENCE");
      expect(result.seller_name).toBe("COMMANDING OFFICER 66 BN BSF");
      expect(result.reference_no).toBe("66BN/DISP/2026/01");
      expect(result.auto_extension).toBe("Unlimited Auto Extension");
      expect(result.items.length).toBe(1);
      expect(result.items[0].item_name).toBe("HEAVY CONDEMNED VEHICLES");
    });
  });

  describe("parseGemDocumentPageHtml", () => {
    it("extracts document download rows from eauction-download-document table", () => {
      const sampleHtml = `
        <table>
          <tr><td>Auction ID :</td><td>40415</td></tr>
          <tr><td>Office / Zone :</td><td>MINISTRY OF DEFENCE</td></tr>
        </table>
        <table>
          <thead>
            <tr><th>Sl.No</th><th>Document Description</th><th>Size (MB)</th><th>Approval Date & Time</th><th>Action</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>AUCTION NOTICE 66 BN BSF.pdf</td>
              <td>1.45</td>
              <td>14/09/2026 11:30:00</td>
              <td><a href="/eprocure/download-file/40415/doc1.pdf">Download</a></td>
            </tr>
          </tbody>
        </table>
      `;

      const result = parseGemDocumentPageHtml(sampleHtml);
      expect(result.auction_id).toBe("40415");
      expect(result.office_zone).toBe("MINISTRY OF DEFENCE");
      expect(result.documents.length).toBe(1);
      expect(result.documents[0].description).toBe("AUCTION NOTICE 66 BN BSF.pdf");
      expect(result.documents[0].size_mb).toBe("1.45");
      expect(result.documents[0].download_url).toBe("/eprocure/download-file/40415/doc1.pdf");
    });
  });
});

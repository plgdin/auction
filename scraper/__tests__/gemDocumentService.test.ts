import { describe, it, expect, vi } from "vitest";
import {
  buildOfficialNoticeHtml,
  renderNoticeHtmlToPdf,
} from "../utils/gem/gemDocumentService.js";

describe("GeM Document Service Suite", () => {
  describe("buildOfficialNoticeHtml", () => {
    it("wraps raw notice HTML with official executive Government e-Marketplace header", () => {
      const rawNotice = `
        <div class="epnew-contentresizrform">
          <h3>General Detail</h3>
          <table>
            <tr><td>Office/Zone :</td><td>Ministry of Defense</td></tr>
          </table>
        </div>
      `;

      const styled = buildOfficialNoticeHtml(rawNotice, "40415", "Heavy Scrap Material");

      expect(styled).toContain("Government e-Marketplace (GeM)");
      expect(styled).toContain("Official Forward e-Auction Notice & Schedule Document");
      expect(styled).toContain("AUCTION ID: 40415");
      expect(styled).toContain("Item: Heavy Scrap Material");
      expect(styled).toContain("Ministry of Defense");
      expect(styled).toContain("@page");
      expect(styled).toContain("size: A4");
    });

    it("hides portal navigation chrome, login buttons, and back buttons in print stylesheet", () => {
      const styled = buildOfficialNoticeHtml("<div>Notice Content</div>", "12345");

      expect(styled).toContain("header, nav, footer, .top-header, .navbar");
      expect(styled).toContain("display: none !important");
    });
  });

  describe("renderNoticeHtmlToPdf", () => {
    it("renders valid PDF binary buffer with %PDF- header", async () => {
      // Mock browser page and pdf generation
      const mockPdfBuffer = Buffer.from("%PDF-1.4 mock binary pdf stream");
      const mockPage = {
        setContent: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue(undefined),
        pdf: vi.fn().mockResolvedValue(mockPdfBuffer),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockBrowser = {
        newPage: vi.fn().mockResolvedValue(mockPage),
      };

      const buffer = await renderNoticeHtmlToPdf(
        mockBrowser as any,
        "<html><body>Official Notice</body></html>"
      );

      expect(mockPage.setContent).toHaveBeenCalled();
      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({ format: "A4", printBackground: true })
      );
      expect(buffer.toString().startsWith("%PDF-")).toBe(true);
      expect(mockPage.close).toHaveBeenCalled();
    });
  });
});

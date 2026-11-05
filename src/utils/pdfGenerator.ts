import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export interface TagPdfItem {
  tagId: string;
  activationUrl: string;
  pin?: string;
  createdAt?: string;
  itemName?: string | null;
  itemCategory?: string | null;
}

/**
 * Generates a print-ready PDF sheet matching the exact LOST N FOUND branded tag design
 * from reference: /public/assets/aistudio/LOST_N_FOUND_lnf_9a92e7df548c_44307ac1.png
 *
 * Each tag features:
 * - Charcoal dark rounded card background (#1C1C1C)
 * - LOST (N) FOUND brand logo with red circular badge
 * - "SCAN TO RETURN TO OWNER" in brand red
 * - Tag ID in monospace font
 * - Item category / placeholder lines with divider
 * - Footer: "Privacy-Protected Smart QR Tag · Honesty Makes You Great. Return & Sleep Peacefully Tonight."
 * - Right-hand side: White rounded box with large, high-density, easily scannable QR code
 * - URL: https://www.lostnfound.website/activate/{tagId}
 */
export async function downloadQrTagsPdf(tags: TagPdfItem[], title = 'LOST_N_FOUND_Physical_QR_Tags') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 11;
  const marginTop = 16;
  const cols = 2;
  const rows = 5; // 10 tags per A4 sheet with comfortable 2:1 aspect ratio
  const tagsPerPage = cols * rows;

  const cardWidth = (pageWidth - marginX * 2 - (cols - 1) * 8) / cols; // ~90mm
  const cardHeight = 46; // 46mm height (close to standard business/credit card tag 85x54mm)

  const totalPages = Math.ceil(tags.length / tagsPerPage) || 1;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (pageIdx > 0) doc.addPage();

    // Top Header
    doc.setFillColor(28, 28, 28);
    doc.rect(0, 0, pageWidth, 11, 'F');
    doc.setFillColor(227, 27, 50);
    doc.rect(0, 11, pageWidth, 0.8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('LOST N FOUND  ·  PHYSICAL ASSET TAG PRINT SHEET', 14, 7.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(190, 190, 190);
    doc.text(`Sheet ${pageIdx + 1} of ${totalPages}  |  https://www.lostnfound.website/`, pageWidth - 14, 7.5, { align: 'right' });

    const pageTags = tags.slice(pageIdx * tagsPerPage, (pageIdx + 1) * tagsPerPage);

    for (let i = 0; i < pageTags.length; i++) {
      const tag = pageTags[i];
      const col = i % cols;
      const row = Math.floor(i / cols);

      const x = marginX + col * (cardWidth + 8);
      const y = marginTop + row * (cardHeight + 7);

      // Card outer boundary - Dark Charcoal (#1F1F1F)
      doc.setFillColor(31, 31, 31);
      doc.setDrawColor(45, 45, 45);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, cardWidth, cardHeight, 3.5, 3.5, 'FD');

      // --- LEFT SIDE: BRANDING & DETAILS ---
      const leftX = x + 4.5;
      let curY = y + 7.5;

      // Wordmark: "LOST", "(N)" badge, "FOUND"
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(255, 255, 255);
      doc.text('LOST', leftX, curY);

      // Red circle badge for "N"
      const circleX = leftX + 13.5;
      const circleY = curY - 2.8;
      const circleRadius = 3.2;
      doc.setFillColor(227, 27, 50);
      doc.circle(circleX, circleY, circleRadius, 'F');

      // White 'N' inside circle
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('N', circleX, circleY + 2.4, { align: 'center' });

      // "FOUND"
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(255, 255, 255);
      doc.text('FOUND', circleX + 5.2, curY);

      // Red Subtitle: "SCAN TO RETURN TO OWNER"
      curY += 5.2;
      doc.setTextColor(227, 27, 50);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.8);
      doc.text('SCAN TO RETURN TO OWNER', leftX, curY);

      // Tag ID
      curY += 5.8;
      doc.setTextColor(140, 140, 140);
      doc.setFont('courier', 'normal');
      doc.setFontSize(5.6);
      doc.text(`Tag ID: ${tag.tagId}`, leftX, curY);

      // Item Name / Label (bold white)
      curY += 5.5;
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(tag.itemName || 'Protected Belonging', leftX, curY);

      // Category line
      curY += 3.8;
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5);
      doc.text(tag.itemCategory || 'SMART ASSET TAG', leftX, curY);

      // Hairline divider
      curY += 3;
      doc.setDrawColor(60, 60, 60);
      doc.setLineWidth(0.2);
      doc.line(leftX, curY, leftX + 44, curY);

      // Footer notice:
      curY += 4.2;
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(3.8);
      doc.text('Privacy-Protected Smart QR Tag · Honesty Makes You Great.', leftX, curY);
      doc.setTextColor(227, 27, 50);
      doc.setFont('helvetica', 'bold');
      doc.text('Return & Sleep Peacefully Tonight.', leftX, curY + 3.2);

      // --- RIGHT SIDE: WHITE ROUNDED CONTAINER WITH QR CODE ---
      const qrBoxSize = 38;
      const qrBoxX = x + cardWidth - qrBoxSize - 4;
      const qrBoxY = y + (cardHeight - qrBoxSize) / 2;

      // White rounded background box
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 2.5, 2.5, 'F');

      // Generate and embed scannable QR Code
      try {
        const qrDataUrl = await QRCode.toDataURL(tag.activationUrl, {
          errorCorrectionLevel: 'M',
          margin: 0,
          width: 320,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });

        // Insert QR code with comfortable 2.5mm margin inside white box for rapid phone camera focus
        const qrPadding = 2.5;
        const qrDrawSize = qrBoxSize - qrPadding * 2;
        doc.addImage(qrDataUrl, 'PNG', qrBoxX + qrPadding, qrBoxY + qrPadding, qrDrawSize, qrDrawSize);
      } catch (err) {
        console.error('Failed to generate QR for tag:', tag.tagId, err);
      }

      // Subtle cutting guide marks
      doc.setDrawColor(180, 180, 180);
      doc.setLineDashPattern([0.8, 0.8], 0);
      doc.line(x - 2, y, x + 2, y);
      doc.line(x, y - 2, x, y + 2);
      doc.setLineDashPattern([], 0);
    }

    // Sheet footer
    doc.setTextColor(140, 140, 140);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('LOST N FOUND Physical Tag Generator  ·  https://www.lostnfound.website/activate/{tagId}', pageWidth / 2, pageHeight - 6, { align: 'center' });
  }

  doc.save(`${title}_${Date.now()}.pdf`);
}

/**
 * Generates confidential PIN sheet specifically for applying scratch-off stickers
 */
export async function downloadPinListPdf(tags: TagPdfItem[], title = 'LOST_N_FOUND_Scratch_Off_PINs') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 12;
  const marginTop = 18;
  const cols = 2;
  const rows = 9;
  const tagsPerPage = cols * rows;

  const cardWidth = (pageWidth - marginX * 2 - (cols - 1) * 8) / cols;
  const cardHeight = 26;

  const totalPages = Math.ceil(tags.length / tagsPerPage) || 1;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (pageIdx > 0) doc.addPage();

    // Top Header Banner
    doc.setFillColor(31, 31, 31);
    doc.rect(0, 0, pageWidth, 12, 'F');
    doc.setFillColor(227, 27, 50);
    doc.rect(0, 12, pageWidth, 0.8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('LOST N FOUND  ·  CONFIDENTIAL SCRATCH-OFF PIN LABELS', 14, 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(200, 200, 200);
    doc.text(`Sheet ${pageIdx + 1} of ${totalPages}  |  https://www.lostnfound.website/`, pageWidth - 14, 8, { align: 'right' });

    const pageTags = tags.slice(pageIdx * tagsPerPage, (pageIdx + 1) * tagsPerPage);

    for (let i = 0; i < pageTags.length; i++) {
      const tag = pageTags[i];
      const col = i % cols;
      const row = Math.floor(i / cols);

      const x = marginX + col * (cardWidth + 8);
      const y = marginTop + row * (cardHeight + 4);

      // Card border
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.3);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');

      // Tag ID Label
      doc.setTextColor(90, 90, 90);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text('TAG ID', x + 4, y + 6);

      doc.setTextColor(30, 30, 30);
      doc.setFont('courier', 'bold');
      doc.setFontSize(9.5);
      doc.text(tag.tagId, x + 4, y + 11.5);

      // Scratch-off PIN target box
      const pinBoxX = x + cardWidth - 44;
      const pinBoxY = y + 4;
      const pinBoxW = 40;
      const pinBoxH = 17;

      doc.setFillColor(250, 250, 250);
      doc.setDrawColor(227, 27, 50);
      doc.setLineWidth(0.4);
      doc.roundedRect(pinBoxX, pinBoxY, pinBoxW, pinBoxH, 1, 1, 'FD');

      // Mini helper label
      doc.setTextColor(227, 27, 50);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.text('SECRET ACTIVATION PIN', pinBoxX + pinBoxW / 2, pinBoxY + 4, { align: 'center' });

      // PIN text
      doc.setTextColor(20, 20, 20);
      doc.setFont('courier', 'bold');
      doc.setFontSize(11);
      doc.text(tag.pin || '••••••••', pinBoxX + pinBoxW / 2, pinBoxY + 10.5, { align: 'center' });

      // Guidance
      doc.setTextColor(130, 130, 130);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.text('Apply scratch sticker over box', pinBoxX + pinBoxW / 2, pinBoxY + 15, { align: 'center' });

      // Status info
      doc.setTextColor(110, 110, 110);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text(`Batch Seq #${pageIdx * tagsPerPage + i + 1}`, x + 4, y + 17.5);
      doc.text(`Status: UNCLAIMED`, x + 4, y + 21.5);
    }

    // Sheet footer
    doc.setTextColor(180, 40, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text('CONFIDENTIAL: Apply scratch-off stickers directly over the red PIN box before shipping tags to customers.', pageWidth / 2, pageHeight - 6, { align: 'center' });
  }

  doc.save(`${title}_${Date.now()}.pdf`);
}

/**
 * Downloads a simple CSV backup for inventory spreadsheets.
 */
export function downloadPinCsv(tags: TagPdfItem[], filename = 'LOST_N_FOUND_Tags_Export') {
  const header = ['Tag_ID', 'Activation_PIN', 'Activation_URL', 'Status', 'Created_At'];
  const rows = tags.map((t) => [
    t.tagId,
    t.pin || 'SECRET_HASHED',
    t.activationUrl,
    'UNCLAIMED',
    t.createdAt || new Date().toISOString(),
  ]);

  const csvContent = [header, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

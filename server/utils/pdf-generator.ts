import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface BillData {
  property: {
    name: string;
    address: string;
  };
  room: {
    name: string;
  };
  tenant: {
    name: string;
  } | null;
  period: string;
  rentBill?: {
    id: string;
    monthsCovered?: number;
    roomPrice: number | string;
    totalAmount: number | string;
    isPaid: boolean;
    generatedAt: string;
  };
  utilityBill?: {
    id: string;
    meterStart: number;
    meterEnd: number;
    costPerKwh: number | string;
    usageCost: number | string;
    waterFee: number | string;
    trashFee: number | string;
    additionalCost: number | string;
    totalAmount: number | string;
    isPaid: boolean;
    generatedAt: string;
  };
}

const formatCurrency = (val: number | string): string => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(val));
};

export const generateCombinedPdf = (data: BillData): Buffer => {
  const { property, room, tenant, period, rentBill, utilityBill } = data;

  const mainBill = rentBill || utilityBill;
  if (!mainBill) throw new Error("No bill data provided");

  const isFullyPaid =
    (rentBill ? rentBill.isPaid : true) &&
    (utilityBill ? utilityBill.isPaid : true);
  const partialPaid =
    !isFullyPaid &&
    ((rentBill && rentBill.isPaid) || (utilityBill && utilityBill.isPaid));

  let title = "MONTHLY STATEMENT";
  if (isFullyPaid) title = "PAYMENT RECEIPT";
  else if (partialPaid) title = "PARTIAL STATEMENT";
  else title = "INVOICE STATEMENT";

  const doc = new jsPDF();

  // --- Header ---
  doc.setFontSize(18);
  doc.text(property.name, 14, 15);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(property.address, 14, 21);
  doc.text(`Room: ${room.name}`, 14, 26);

  if (tenant) {
    doc.text(`Tenant: ${tenant.name}`, 14, 31);
  }

  // --- Info (Right Aligned) ---
  const pageWidth = doc.internal.pageSize.width;
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(title.toUpperCase(), pageWidth - 14, 15, { align: "right" });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`No: ${mainBill.id.slice(0, 8).toUpperCase()}`, pageWidth - 14, 21, {
    align: "right",
  });
  doc.text(
    `Date: ${new Date(mainBill.generatedAt).toLocaleDateString("id-ID")}`,
    pageWidth - 14,
    26,
    { align: "right" }
  );

  // Status color
  if (isFullyPaid) {
    doc.setTextColor(0, 128, 0); // Green
    doc.text("PAID", pageWidth - 14, 31, { align: "right" });
  } else if (partialPaid) {
    doc.setTextColor(255, 165, 0); // Orange
    doc.text("PARTIAL", pageWidth - 14, 31, { align: "right" });
  } else {
    doc.setTextColor(255, 0, 0); // Red
    doc.text("UNPAID", pageWidth - 14, 31, { align: "right" });
  }

  // --- Table Body ---
  const tableBody: any[] = [];

  // 1. Rent Section
  if (rentBill) {
    tableBody.push([
      {
        content: "RENT CHARGES",
        colSpan: 3,
        styles: { fontStyle: "bold", fillColor: [240, 240, 240] },
      },
    ]);
    
    // Room rent with period range
    let periodDesc = `${rentBill.monthsCovered || 1} Month(s)`;
    if (rentBill.periodEnd) {
      periodDesc = `${rentBill.period} - ${rentBill.periodEnd}`;
    }
    
    tableBody.push([
      "Room Rent",
      periodDesc,
      formatCurrency(Number(rentBill.roomPrice)),
    ]);
    
    // Water fee (if included in multi-month rent)
    if (Number(rentBill.waterFee || 0) > 0) {
      tableBody.push([
        "Water Fee",
        `${rentBill.monthsCovered || 1} Month(s)`,
        formatCurrency(Number(rentBill.waterFee)),
      ]);
    }
    
    // Trash fee (if included in multi-month rent)
    if (Number(rentBill.trashFee || 0) > 0) {
      tableBody.push([
        "Trash Fee",
        `${rentBill.monthsCovered || 1} Month(s)`,
        formatCurrency(Number(rentBill.trashFee)),
      ]);
    }
  }

  // 2. Utility Section
  if (utilityBill) {
    tableBody.push([
      {
        content: "UTILITY CHARGES",
        colSpan: 3,
        styles: { fontStyle: "bold", fillColor: [240, 240, 240] },
      },
    ]);
    tableBody.push([
      "Electricity",
      `${utilityBill.meterStart} -> ${utilityBill.meterEnd} (${utilityBill.meterEnd - utilityBill.meterStart} kWh)`,
      formatCurrency(utilityBill.usageCost),
    ]);
    tableBody.push([
      "Water Fee",
      "Flat Rate",
      formatCurrency(utilityBill.waterFee),
    ]);
    if (Number(utilityBill.trashFee) > 0) {
      tableBody.push([
        "Trash Fee",
        "Monthly",
        formatCurrency(utilityBill.trashFee),
      ]);
    }
    if (Number(utilityBill.additionalCost) > 0) {
      tableBody.push([
        "Additional Cost",
        "-",
        formatCurrency(utilityBill.additionalCost),
      ]);
    }
  }

  const totalRent = rentBill ? Number(rentBill.totalAmount) : 0;
  const totalUtil = utilityBill ? Number(utilityBill.totalAmount) : 0;
  const grandTotal = totalRent + totalUtil;

  autoTable(doc, {
    startY: 40,
    head: [["Item", "Description", "Amount"]],
    body: tableBody,
    foot: [["GRAND TOTAL", "", formatCurrency(grandTotal)]],
    theme: "grid",
    headStyles: { fillColor: [66, 66, 66] },
    footStyles: {
      fillColor: [50, 50, 50],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: { 2: { halign: "right" } },
  });

  // --- Footer ---
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setTextColor(150);
  doc.setFontSize(8);
  doc.text("Thank you for your payment.", 14, finalY);
  doc.text("Generated by KostMan", pageWidth - 14, finalY, { align: "right" });

  // Return as Buffer
  return Buffer.from(doc.output("arraybuffer"));
};

export type { BillData };

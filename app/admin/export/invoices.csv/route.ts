import { csvDownload } from "@/lib/export-route";
import { invoicesCsv } from "@/lib/exports";

export function GET(request: Request) {
  return csvDownload(request, "invoices", invoicesCsv);
}

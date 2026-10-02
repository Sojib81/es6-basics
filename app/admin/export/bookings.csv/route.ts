import { csvDownload } from "@/lib/export-route";
import { bookingsCsv } from "@/lib/exports";

export function GET(request: Request) {
  return csvDownload(request, "bookings", bookingsCsv);
}

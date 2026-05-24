import { useState, useEffect, useCallback } from "react";
import { Download, FileText, Search, Loader2, ReceiptText, IndianRupee, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { toast } from "@/hooks/use-toast";
import { applications } from "@/lib/api";

interface ReceiptItem {
  paymentId: string;
  applicationId: string;
  applicationNumber: string;
  beneficiaryName: string;
  schemeName: string;
  amount: number;
  paidAt: string;
  district?: string;
  area?: string;
  unit?: string;
}

interface ReceiptsResponse {
  success: boolean;
  data: ReceiptItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
  };
}

export default function Receipts() {
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchReceipts = useCallback(async (page: number, searchTerm: string) => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (searchTerm) params.search = searchTerm;
      const response = await applications.getReceipts(params) as any;
      // Handle both old format {data: {receipts, pagination}} and new flat format {data: [], pagination}
      const rawData = response.data;
      const items: ReceiptItem[] = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.receipts)
          ? rawData.receipts.map((p: any) => ({
              paymentId: p._id,
              applicationId: p.application?._id || '',
              applicationNumber: p.application?.applicationNumber || '',
              beneficiaryName: p.beneficiary?.name || '',
              schemeName: p.scheme?.name || '',
              amount: p.amount || 0,
              paidAt: p.timeline?.completedAt || '',
              district: p.application?.district || '',
              area: p.application?.area || '',
              unit: p.application?.unit || '',
            }))
          : [];
      const paginationSrc = Array.isArray(rawData) ? response.pagination : rawData?.pagination;
      setReceipts(items);
      setTotalPages(paginationSrc?.totalPages ?? paginationSrc?.pages ?? 1);
      setTotalCount(paginationSrc?.totalCount ?? paginationSrc?.total ?? 0);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load receipts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReceipts(currentPage, search);
  }, [fetchReceipts, currentPage, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    setSearch(searchInput);
  };

  const handleDownload = async (paymentId: string) => {
    setDownloadingId(paymentId);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "/api";
      const token = localStorage.getItem("authToken") || sessionStorage.getItem("authToken");
      const tenant = localStorage.getItem("tenantId") || sessionStorage.getItem("tenantId");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (tenant) headers["x-tenant-id"] = tenant;

      const response = await fetch(`${baseUrl}/payments/${paymentId}/receipt`, { headers });
      if (!response.ok) throw new Error("Failed to download receipt");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${paymentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "Download Failed",
        description: "Could not download receipt. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <ReceiptText className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Receipts</h1>
            <p className="text-sm text-muted-foreground">
              Disbursement receipts for approved applications
            </p>
          </div>
        </div>
        {!loading && (
          <Badge variant="outline" className="text-sm px-3 py-1 self-start sm:self-auto">
            {totalCount} receipt{totalCount !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by beneficiary name or application number..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="default">
              Search
            </Button>
            {search && (
              <Button
                type="button"
                variant="outline"
                onClick={() => { setSearchInput(""); setSearch(""); setCurrentPage(1); }}
              >
                Clear
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Receipt Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-16">
              <ReceiptText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground text-sm">
                {search ? "No receipts found matching your search." : "No receipts available yet."}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application No.</TableHead>
                      <TableHead>Beneficiary</TableHead>
                      <TableHead>Scheme</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">
                        <span className="flex items-center justify-end gap-1">
                          <IndianRupee className="h-3.5 w-3.5" />
                          Amount
                        </span>
                      </TableHead>
                      <TableHead>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Date
                        </span>
                      </TableHead>
                      <TableHead className="text-center">Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipts.map((item) => (
                      <TableRow key={item.paymentId}>
                        <TableCell>
                          <span className="font-mono text-sm font-medium">
                            {item.applicationNumber}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{item.beneficiaryName}</div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{item.schemeName}</span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {[item.unit, item.area, item.district].filter(Boolean).join(" / ") || "-"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-green-700">
                            ₹{formatAmount(item.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{formatDate(item.paidAt)}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(item.paymentId)}
                            disabled={downloadingId === item.paymentId}
                            className="gap-1.5"
                          >
                            {downloadingId === item.paymentId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                            PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page =
                          totalPages <= 5
                            ? i + 1
                            : currentPage <= 3
                            ? i + 1
                            : currentPage >= totalPages - 2
                            ? totalPages - 4 + i
                            : currentPage - 2 + i;
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

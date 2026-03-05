"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Papa from "papaparse";
import { ApiConfig } from "@/components/api-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Upload,
  Play,
  FileSpreadsheet,
  Tag,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  getAccountId,
  createLabel,
  searchContact,
  createContact,
  updateContactLabels,
} from "@/lib/chatwoot";

interface CsvRow {
  [key: string]: string;
}

interface LogEntry {
  type: "info" | "success" | "error";
  message: string;
}

export default function ImportPage() {
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [accountId, setAccountId] = useState<number | null>(null);

  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");

  const [campaignName, setCampaignName] = useState("");
  const [labelSplit, setLabelSplit] = useState(50);

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (importing) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [importing]);

  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    setLogs((prev) => [...prev, { type, message }]);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          toast.error("CSV file is empty");
          return;
        }

        const firstRow = results.data[0];
        const a1 = (firstRow[0] || "").trim();
        const b1 = (firstRow[1] || "").trim();

        const a1Upper = a1.toUpperCase();
        const b1Upper = b1.toUpperCase();

        let hasHeaders = false;

        if (a1Upper === "NAME" && (b1Upper === "PHONE" || b1Upper === "PHONE_NUMBER" || b1Upper === "PHONE NUMBER")) {
          hasHeaders = true;
        } else {
          // Check if it looks like data (no headers)
          // A phone number usually has digits
          const hasDigits = /\d/.test(b1);
          if (hasDigits) {
            hasHeaders = false;
          } else {
            toast.error("Invalid CSV format. A1 must be 'NAME' and B1 must be 'PHONE'.");
            if (fileInputRef.current) fileInputRef.current.value = "";
            setFileName("");
            setCsvData([]);
            setCsvHeaders([]);
            return;
          }
        }

        const mappedData: CsvRow[] = [];
        const startIdx = hasHeaders ? 1 : 0;

        for (let i = startIdx; i < results.data.length; i++) {
          const row = results.data[i];
          mappedData.push({
            NAME: row[0] || "",
            PHONE: row[1] || "",
            ...(row[2] ? { EMAIL: row[2] } : {})
          });
        }

        setCsvData(mappedData);
        setCsvHeaders(firstRow.length > 2 ? ["NAME", "PHONE", "EMAIL"] : ["NAME", "PHONE"]);
        toast.success(`Loaded ${mappedData.length} contacts from CSV ${!hasHeaders ? '(Auto-identified headers)' : ''}`);
      },
      error: (err) => {
        toast.error(`Failed to parse CSV: ${err.message}`);
      },
    });
  };

  const handleImport = async () => {
    if (!apiUrl || !apiKey) {
      toast.error("Please configure API connection first");
      return;
    }
    if (csvData.length === 0) {
      toast.error("Please upload a CSV file first");
      return;
    }
    if (!campaignName.trim()) {
      toast.error("Please enter a campaign name");
      return;
    }

    setImporting(true);
    setProgress(0);
    setLogs([]);
    abortRef.current = false;

    try {
      let accId = accountId;
      if (!accId) {
        addLog("info", "Fetching account ID...");
        accId = await getAccountId(apiUrl, apiKey);
        setAccountId(accId);
      }
      addLog("success", `Using account #${accId}`);

      const totalContacts = csvData.length;
      const totalBatches = Math.ceil(totalContacts / labelSplit);

      addLog("info", `Will create ${totalBatches} label(s) for ${totalContacts} contacts`);

      // Create labels first
      const labelNames: string[] = [];
      for (let i = 0; i < totalBatches; i++) {
        if (abortRef.current) break;
        const labelName = `${campaignName}-${i + 1}`;
        labelNames.push(labelName);

        try {
          await createLabel(apiUrl, apiKey, accId, labelName, `Campaign: ${campaignName}, batch ${i + 1}`);
          addLog("success", ` [SYSTEM] Created new global label definition: '${labelName}'`);
        } catch (err: any) {
          if (err.message && err.message.includes("422")) {
            // 422 usually means "Label already exists", which is fine.
          } else {
            addLog("error", ` [ERROR] Failed to define label '${labelName}': ${err.message}`);
          }
        }
      }

      // Process each contact
      for (let i = 0; i < totalContacts; i++) {
        if (abortRef.current) {
          addLog("error", "Import cancelled by user");
          break;
        }

        const row = csvData[i];
        const batchIndex = Math.floor(i / labelSplit);
        const labelName = labelNames[batchIndex];
        const name = row.name || row.Name || row.NAME || "";
        let phone = row.phone_number || row.phone || row.Phone || row.PHONE || "";
        phone = String(phone).trim();
        if (phone && !phone.startsWith("+")) {
          phone = "+" + phone;
        }

        addLog("info", `[${i + 1}/${totalContacts}] ${name} -> Label: ${labelName}`);

        try {
          // Try to search for existing contact by phone
          let contactId = null;
          if (phone) {
            const searchRes = await searchContact(apiUrl, apiKey, accId, phone);
            if (searchRes?.id) contactId = searchRes.id;
          }

          // Create if not found
          if (!contactId) {
            const newContact = await createContact(apiUrl, apiKey, accId, { name, phone_number: phone });
            if (newContact?.id) contactId = newContact.id;
          }

          // Assign label
          if (contactId) {
            try {
              await updateContactLabels(apiUrl, apiKey, accId, contactId, [labelName]);
            } catch (err: any) {
              addLog("error", ` -> FAILED to tag contact. API says: ${err.message}`);
            }
          }
        } catch (err) {
          addLog("error", ` -> Error processing row ${i + 1}: ${err}`);
        }

        // Match python script's time.sleep(0.2)
        await new Promise(r => setTimeout(r, 200));

        setProgress(((i + 1) / totalContacts) * 100);
      }

      if (!abortRef.current) {
        addLog("success", `✓ Import complete! ${totalContacts} contacts processed with ${totalBatches} labels.`);
        toast.success("Import complete!");
      }
    } catch (err) {
      addLog("error", `Fatal error: ${err}`);
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleCancel = () => {
    abortRef.current = true;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Import & Label</h2>
        <p className="text-sm text-muted-foreground">
          Upload contacts from CSV and auto-create campaign labels
        </p>
      </div>

      <ApiConfig
        apiUrl={apiUrl}
        apiKey={apiKey}
        onApiUrlChange={setApiUrl}
        onApiKeyChange={setApiKey}
        onAccountId={setAccountId}
      />

      {/* CSV Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-4 w-4" />
            CSV Upload
          </CardTitle>
          <CardDescription>
            Upload a CSV file. <span className="text-amber-500">The first two columns must be &quot;NAME&quot; and &quot;PHONE&quot; (Required).</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-3 w-3" />
              Choose File
            </Button>
            {fileName && (
              <span className="text-sm text-muted-foreground">{fileName}</span>
            )}
            {csvData.length > 0 && (
              <Badge variant="secondary">{csvData.length} contacts</Badge>
            )}
          </div>

          {csvData.length > 0 && (
            <div className="max-h-64 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    {csvHeaders.map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvData.slice(0, 10).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      {csvHeaders.map((h) => (
                        <TableCell key={h}>{row[h]}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {csvData.length > 10 && (
                    <TableRow>
                      <TableCell
                        colSpan={csvHeaders.length + 1}
                        className="text-center text-muted-foreground"
                      >
                        ... and {csvData.length - 10} more rows
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaign Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="h-4 w-4" />
            Campaign Settings
          </CardTitle>
          <CardDescription>
            Configure label names and split size
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                placeholder="e.g. promo-march"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Labels will be: {campaignName || "campaign"}-1, {campaignName || "campaign"}-2, ...
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="label-split">Label Split (contacts per label)</Label>
              <Input
                id="label-split"
                type="number"
                min={1}
                value={labelSplit}
                onChange={(e) => setLabelSplit(Number(e.target.value) || 50)}
              />
              <p className="text-xs text-muted-foreground">
                {csvData.length > 0
                  ? `${Math.ceil(csvData.length / labelSplit)} label(s) will be created`
                  : "Each label will contain this many contacts"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action */}
      <div className="flex gap-3">
        <Button onClick={handleImport} disabled={importing || csvData.length === 0}>
          {importing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          {importing ? "Importing..." : "Start Import"}
        </Button>
        {importing && (
          <Button variant="destructive" onClick={handleCancel}>
            Cancel
          </Button>
        )}
      </div>

      {/* Progress & Logs */}
      {(importing || logs.length > 0) && (
        <Card className={importing ? "border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]" : ""}>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Progress
              {importing && (
                <Badge variant="outline" className="text-amber-500 border-amber-500/50 bg-amber-500/10">
                  DON'T CLOSE THE TAB AND BROWSER
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">
              {Math.round(progress)}% complete ({Math.round((progress / 100) * csvData.length)} / {csvData.length} contacts)
            </p>
            <Separator />
            <div className="max-h-64 space-y-1 overflow-auto font-mono text-xs">
              {logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2">
                  {log.type === "success" && (
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                  )}
                  {log.type === "error" && (
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                  )}
                  {log.type === "info" && (
                    <span className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground">•</span>
                  )}
                  <span
                    className={
                      log.type === "error"
                        ? "text-destructive"
                        : log.type === "success"
                          ? "text-emerald-400"
                          : "text-muted-foreground"
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

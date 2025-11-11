import { useState, useEffect } from "react";
import Papa from "papaparse";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface CsvColumnMapperProps {
  onFileLoad: (data: { headers: string[]; rows: string[][]; mappings: Record<string, string> }) => void;
  requiredFields: { key: string; label: string; required?: boolean }[];
  onValidationChange?: (isValid: boolean) => void;
}

export function CsvColumnMapper({ onFileLoad, requiredFields, onValidationChange }: CsvColumnMapperProps) {
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [previewRows, setPreviewRows] = useState<string[][]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      
      // Parse CSV using Papa Parse for robust handling of quotes, commas, and line endings
      const result = Papa.parse<string[]>(text, {
        skipEmptyLines: true,
      });

      if (result.errors && result.errors.length > 0) {
        console.error("CSV parsing errors:", result.errors);
        return;
      }

      const data = result.data;
      if (!data || data.length === 0) return;

      const headers = data[0].map(h => (typeof h === 'string' ? h.trim() : String(h)));
      const rows = data.slice(1);
      
      setCsvHeaders(headers);
      setCsvRows(rows);
      setPreviewRows(rows.slice(0, 3)); // Show first 3 rows as preview

      // Auto-map columns with matching names
      const autoMappings: Record<string, string> = {};
      requiredFields.forEach(field => {
        const matchingHeader = headers.find(h => 
          h.toLowerCase() === field.key.toLowerCase() ||
          h.toLowerCase().replace(/[_\s]/g, '') === field.key.toLowerCase().replace(/[_\s]/g, '')
        );
        if (matchingHeader) {
          autoMappings[field.key] = matchingHeader;
        }
      });
      setMappings(autoMappings);
    };
    reader.readAsText(selectedFile);
  };

  const handleMappingChange = (fieldKey: string, csvHeader: string) => {
    setMappings(prev => ({
      ...prev,
      [fieldKey]: csvHeader,
    }));
  };

  useEffect(() => {
    if (csvHeaders.length > 0 && csvRows.length > 0) {
      onFileLoad({ headers: csvHeaders, rows: csvRows, mappings });
      
      // Validate that all required fields are mapped
      const allRequiredMapped = requiredFields
        .filter(f => f.required !== false)
        .every(field => mappings[field.key] && mappings[field.key] !== "");
      
      onValidationChange?.(allRequiredMapped);
    }
  }, [mappings, csvHeaders, csvRows]);

  const getPreviewValue = (rowIndex: number, fieldKey: string) => {
    const csvHeader = mappings[fieldKey];
    if (!csvHeader) return "-";
    
    const headerIndex = csvHeaders.indexOf(csvHeader);
    if (headerIndex === -1) return "-";
    
    return previewRows[rowIndex]?.[headerIndex] || "-";
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="csv-file">Upload CSV File</Label>
        <Input
          id="csv-file"
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          data-testid="input-csv-file"
          className="mt-2"
        />
        {file && (
          <p className="text-sm text-muted-foreground mt-2">
            Selected: {file.name} ({csvRows.length} rows)
          </p>
        )}
      </div>

      {csvHeaders.length > 0 && (
        <>
          <Alert>
            <AlertDescription className="text-sm">
              <strong>Map CSV columns to database fields:</strong> Select which column from your CSV corresponds to each required field.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <Label className="text-base font-semibold">Column Mapping</Label>
            {requiredFields.map(field => (
              <div key={field.key} className="flex items-center gap-4">
                <div className="w-48 flex items-center gap-2">
                  <Label className="text-sm">{field.label}</Label>
                  {field.required !== false && (
                    <Badge variant="secondary" className="text-xs">Required</Badge>
                  )}
                </div>
                <Select
                  value={mappings[field.key] || "__unmapped__"}
                  onValueChange={(value) => handleMappingChange(field.key, value === "__unmapped__" ? "" : value)}
                >
                  <SelectTrigger className="flex-1" data-testid={`select-map-${field.key}`}>
                    <SelectValue placeholder="Select CSV column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unmapped__">-- Not Mapped --</SelectItem>
                    {csvHeaders.map(header => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {previewRows.length > 0 && (
            <div className="mt-6">
              <Label className="text-base font-semibold mb-3 block">Preview (First 3 rows)</Label>
              <div className="border rounded-md overflow-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {requiredFields.map(field => (
                        <TableHead key={field.key}>{field.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((_, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {requiredFields.map(field => (
                          <TableCell key={field.key} className="font-mono text-xs">
                            {getPreviewValue(rowIndex, field.key)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

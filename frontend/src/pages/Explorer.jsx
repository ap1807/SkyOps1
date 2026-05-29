import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { Panel } from "@/components/widgets";
import { Upload, Database, Filter } from "lucide-react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function Explorer() {
  const [rows, setRows] = useState([]);
  const [source, setSource] = useState("");
  const [cls, setCls] = useState("all");
  const [sat, setSat] = useState("all");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = () => {
    const params = new URLSearchParams({ limit: "60" });
    if (cls !== "all") params.append("travel_class", cls);
    if (sat !== "all") params.append("satisfied", sat);
    api.get(`/analytics/explorer?${params.toString()}`).then((r) => {
      setRows(r.data.rows);
      setSource(r.data.source);
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls, sat]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await api.post("/analytics/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`Loaded ${res.data.rows.toLocaleString()} rows — analytics refreshed`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const cols = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <div className="space-y-6">
      <Panel testid="panel-upload" title="Dataset Source"
        subtitle="Explore the active dataset or load your own"
        right={<span className="flex items-center gap-1.5 text-xs text-slate-400"><Database className="w-3.5 h-3.5" /> {source}</span>}>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 block mb-1.5 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" /> Cabin Class
            </label>
            <Select value={cls} onValueChange={setCls}>
              <SelectTrigger data-testid="filter-class" className="w-40 rounded-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                <SelectItem value="Business">Business</SelectItem>
                <SelectItem value="Eco Plus">Eco Plus</SelectItem>
                <SelectItem value="Eco">Economy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 block mb-1.5">Satisfaction</label>
            <Select value={sat} onValueChange={setSat}>
              <SelectTrigger data-testid="filter-satisfied" className="w-40 rounded-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Passengers</SelectItem>
                <SelectItem value="1">Satisfied</SelectItem>
                <SelectItem value="0">Dissatisfied</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto">
            <input ref={fileRef} type="file" accept=".csv" onChange={handleUpload} className="hidden" data-testid="csv-input" />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="upload-button"
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 rounded-sm transition-colors disabled:opacity-60 active:scale-[0.99]">
              <Upload className="w-4 h-4" /> {uploading ? "Uploading…" : "Upload CSV"}
            </button>
          </div>
        </div>
      </Panel>

      <Panel testid="panel-explorer-table" title="Passenger Records" subtitle={`Showing ${rows.length} records`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                {cols.map((c) => (
                  <th key={c} className="text-left font-semibold py-2 px-3">{c.replace(/_/g, " ")}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  {cols.map((c) => (
                    <td key={c} className="py-2 px-3 text-slate-600 font-plex-mono text-xs">
                      {c === "satisfied" ? (
                        <span className={`px-2 py-0.5 rounded-sm text-[11px] font-semibold ${r[c] ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                          {r[c] ? "Satisfied" : "Dissatisfied"}
                        </span>
                      ) : (
                        String(r[c])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

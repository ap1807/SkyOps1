import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Panel } from "@/components/widgets";
import { Mail, BellRing, CalendarClock, Send, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get("/email/settings").then((r) => setSettings(r.data)).catch(() => {});
  }, []);

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/email/settings", {
        alerts_enabled: settings.alerts_enabled,
        alert_threshold: settings.alert_threshold,
        daily_digest: settings.daily_digest,
      });
      setSettings(data);
      toast.success("Preferences saved");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not save preferences");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setSending(true);
    try {
      const { data } = await api.post("/email/test");
      toast.success(`Test email sent to ${data.to}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Email delivery failed");
    } finally {
      setSending(false);
    }
  };

  if (!settings) return <div className="text-sm text-slate-400">Loading…</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <Panel testid="panel-email-recipient" title="Email Delivery"
        subtitle="Operational emails are sent to your account address"
        right={
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-sm ${settings.email_configured ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            <ShieldCheck className="w-3.5 h-3.5" />{settings.email_configured ? "Service active" : "Not configured"}
          </span>
        }>
        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-sm">
          <div className="w-10 h-10 bg-slate-900 rounded-sm flex items-center justify-center">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-900" data-testid="recipient-email">{settings.email}</div>
            <div className="text-xs text-slate-400">Recipient of all SkyOps notifications</div>
          </div>
          <button onClick={sendTest} disabled={sending} data-testid="send-test-button"
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 rounded-sm transition-colors disabled:opacity-60 active:scale-[0.99]">
            <Send className="w-4 h-4" /> {sending ? "Sending…" : "Send test email"}
          </button>
        </div>
      </Panel>

      <Panel testid="panel-realtime-alerts" title="Real-time Disruption Alerts"
        subtitle="Get emailed automatically when network risk crosses your threshold">
        <Row icon={BellRing} title="Enable disruption alerts"
          desc="Auto-email when the live disruption forecast crosses your threshold (30 min cooldown).">
          <Switch data-testid="toggle-alerts" checked={settings.alerts_enabled}
            onCheckedChange={(v) => set("alerts_enabled", v)} />
        </Row>
        <div className="flex items-center justify-between py-4 border-t border-slate-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-slate-300 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-slate-800">Alert threshold</div>
              <div className="text-xs text-slate-400">Minimum risk level that triggers an email</div>
            </div>
          </div>
          <Select value={settings.alert_threshold} onValueChange={(v) => set("alert_threshold", v)}
            disabled={!settings.alerts_enabled}>
            <SelectTrigger data-testid="select-threshold" className="w-40 rounded-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Elevated">Elevated &amp; above</SelectItem>
              <SelectItem value="High">High only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Panel>

      <Panel testid="panel-digest" title="Scheduled Digest"
        subtitle="A daily snapshot of network performance">
        <Row icon={CalendarClock} title="Daily operations digest"
          desc="Receive a daily summary (KPIs, forecast and recommendations) each morning.">
          <Switch data-testid="toggle-digest" checked={settings.daily_digest}
            onCheckedChange={(v) => set("daily_digest", v)} />
        </Row>
      </Panel>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 max-w-md">
          Note: in test mode, emails deliver only to your verified address. Verify a domain in Resend to email any recipient.
        </p>
        <button onClick={save} disabled={saving} data-testid="save-settings-button"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-2.5 rounded-sm transition-colors disabled:opacity-60 active:scale-[0.99]">
          {saving ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </div>
  );
}

function Row({ icon: Icon, title, desc, children }) {
  return (
    <div className="flex items-center justify-between py-4 first:pt-0">
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-slate-300 mt-0.5" />
        <div>
          <div className="text-sm font-medium text-slate-800">{title}</div>
          <div className="text-xs text-slate-400 max-w-md">{desc}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

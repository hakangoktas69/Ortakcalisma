import SecurityView from "@/components/SecurityView";
import SettingsView from "@/components/SettingsView";

export const instant = false;

export default function Page() {
  return (
    <div className="space-y-8">
      <SecurityView />
      <SettingsView />
    </div>
  );
}

import { CompanyTrackerApp } from "@/components/company/CompanyTrackerApp";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function TrackerPage() {
  return (
    <ErrorBoundary>
      <CompanyTrackerApp />
    </ErrorBoundary>
  );
}

import { ErrorBoundary } from "@/components/ui/error-boundary";
import { CompanyTrackerApp } from "@/components/company/CompanyTrackerApp";

export default function Home() {
  return (
    <ErrorBoundary>
      <CompanyTrackerApp />
    </ErrorBoundary>
  );
}

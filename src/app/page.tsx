import { ErrorBoundary } from "@/components/ui/error-boundary";
import { FitAnalyzerApp } from "@/components/fit/FitAnalyzerApp";

export default function Home() {
  return (
    <ErrorBoundary>
      <FitAnalyzerApp />
    </ErrorBoundary>
  );
}

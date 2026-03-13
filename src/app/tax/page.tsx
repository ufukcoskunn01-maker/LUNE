import { ReferenceViewer, referenceMetadata } from "@/components/reference/ReferenceViewer";

export const metadata = referenceMetadata("Tax");

export default function TaxReferencePage() {
  return (
    <ReferenceViewer
      title="Tax"
      mode="html"
      src="/reference-pages/tax/Tax.html"
    />
  );
}
